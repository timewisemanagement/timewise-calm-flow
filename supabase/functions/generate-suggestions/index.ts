import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Task {
  id: string;
  title: string;
  description: string;
  duration_minutes: number;
  priority: string;
  tags: string[];
}

interface CalendarEvent {
  id: string;
  start_time: string;
  end_time: string;
  title: string;
}

interface Profile {
  focus_preference: string;
  ideal_focus_duration: number;
  timezone: string;
  wake_time?: string;
  bed_time?: string;
  downtime_start?: string | null;
  downtime_end?: string | null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      throw new Error('Invalid user token');
    }

    // Check if we're scheduling a specific task or all tasks
    const { taskId } = await req.json().catch(() => ({}));
    
    console.log(`Generating task scheduling suggestions${taskId ? ` for task ${taskId}` : ''}`);

    // Fetch user's profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    // Fetch ALL non-deleted tasks
    const { data: allTasks } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', user.id)
      .is('deleted_at', null)  // Only fetch non-deleted tasks
      .eq('status', 'scheduled')  // Only scheduled tasks (no pending status exists)
      .order('priority', { ascending: false });

    if (!allTasks || allTasks.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No tasks to schedule', suggestions: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Define time window for scheduling (next 7 days)
    const now = new Date();
    const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    // Only schedule tasks that are missing date OR time (unscheduled tasks)
    // If taskId is provided, only schedule that specific task
    // Otherwise, limit to top 10 by priority to avoid overwhelming the AI
    let unscheduledTasks = allTasks.filter(t => !t.scheduled_date || !t.scheduled_time);
    
    if (taskId) {
      unscheduledTasks = unscheduledTasks.filter(t => t.id === taskId);
    } else {
      unscheduledTasks = unscheduledTasks
        .sort((a, b) => {
          const priorityMap: { [key: string]: number } = { high: 3, medium: 2, low: 1 };
          return (priorityMap[b.priority] || 0) - (priorityMap[a.priority] || 0);
        })
        .slice(0, 10);
    }
    
    // Tasks with both date AND time are already scheduled - treat as conflicts to avoid
    // CRITICAL: Only include scheduled tasks in the NEXT 7 DAYS to reduce token count
    const scheduledTasks = allTasks.filter(t => {
      if (!t.scheduled_date || !t.scheduled_time) return false;
      const taskDate = new Date(t.scheduled_date);
      return taskDate >= now && taskDate <= sevenDaysLater;
    });

    // If there are no unscheduled tasks, nothing to do
    if (unscheduledTasks.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No unscheduled tasks to place', suggestions: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch calendar events for next 7 days
    const { data: calendarEvents } = await supabase
      .from('calendar_events')
      .select('*')
      .eq('user_id', user.id)
      .gte('start_time', now.toISOString())
      .lte('start_time', sevenDaysLater.toISOString())
      .order('start_time', { ascending: true });

    console.log(`Processing: ${unscheduledTasks.length} unscheduled, ${scheduledTasks.length} scheduled conflicts, ${calendarEvents?.length || 0} calendar conflicts`);

    // Prepare context for AI
    const context = {
      profile: profile || { 
        focus_preference: 'morning', 
        ideal_focus_duration: 60, 
        timezone: 'UTC',
        wake_time: '08:00:00',
        bed_time: '22:00:00'
      },
      unscheduledTasks: unscheduledTasks,
      scheduledTasks: scheduledTasks,
      calendarEvents: calendarEvents || [],
      currentTime: now.toISOString(),
    };

    // Use tool calling for reliable structured output with human-like reasoning
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('LOVABLE_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-lite',
        messages: [
          {
            role: 'system',
            content: `You are a task scheduler. Schedule tasks in optimal time slots.

RULES:
1. Avoid downtime and respect wake/bed times
2. Don't overlap with calendar events or scheduled tasks (keep 10min buffer)
3. Match user's focus preference (morning/afternoon/evening) for high priority
4. If task has a date but no time: find best time on that day
5. If task has no date/time: schedule in next 7 days
6. Return score 0-1 and brief reason for each placement`
          },
          {
            role: 'user',
            content: `Schedule these ${unscheduledTasks.length} unscheduled tasks over next 7 days starting ${now.toISOString()}.

USER PROFILE:
- Focus preference: ${context.profile.focus_preference || 'morning'}
- Ideal focus duration: ${context.profile.ideal_focus_duration || 60} minutes
- Timezone: ${context.profile.timezone || 'UTC'}
- Wake time: ${context.profile.wake_time || '08:00:00'}
- Bed time: ${context.profile.bed_time || '22:00:00'}
${context.profile.downtime_start && context.profile.downtime_end ? `- Downtime: ${context.profile.downtime_start} to ${context.profile.downtime_end}` : '- No downtime configured'}

TASKS TO SCHEDULE:
${JSON.stringify(unscheduledTasks.map(t => ({ 
  id: t.id, 
  title: t.title, 
  duration_minutes: t.duration_minutes, 
  priority: t.priority,
  requested_date: t.scheduled_date || null
})), null, 2)}

CONFLICTS TO AVOID:
Scheduled: ${scheduledTasks.map(t => `${t.scheduled_date} ${t.scheduled_time} (${t.duration_minutes}min)`).join(', ') || 'none'}
Events: ${(calendarEvents || []).map(e => `${e.start_time.slice(0,16)} to ${e.end_time.slice(11,16)}`).join(', ') || 'none'}

Schedule ALL ${unscheduledTasks.length} tasks. Return one suggestion per task with full ISO 8601 datetime (with timezone), score, and reason.`
          }
        ],
        tools: [{
          type: "function",
          function: {
            name: "schedule_tasks",
            description: "Schedule tasks into optimal time slots with human-like reasoning",
            parameters: {
              type: "object",
              properties: {
                schedules: {
                  type: "array",
                  description: "Array of task schedules with placement reasoning",
                  items: {
                    type: "object",
                    properties: {
                      task_id: { 
                        type: "string", 
                        description: "UUID of the task to schedule" 
                      },
                      suggested_start: { 
                        type: "string", 
                        description: "Full ISO 8601 datetime with timezone (e.g., 2025-11-22T14:00:00Z). REQUIRED: Must include time and timezone." 
                      },
                      duration_minutes: { 
                        type: "number",
                        description: "Duration of the task in minutes"
                      },
                      score: { 
                        type: "number", 
                        description: "Placement quality score 0-1 based on scoring rubric" 
                      },
                      reason: {
                        type: "string",
                        description: "1-2 sentence justification for this placement explaining why this slot benefits the user"
                      }
                    },
                    required: ["task_id", "suggested_start", "duration_minutes", "score", "reason"],
                    additionalProperties: false
                  }
                }
              },
              required: ["schedules"],
              additionalProperties: false
            }
          }
        }],
        tool_choice: { type: "function", function: { name: "schedule_tasks" } },
        temperature: 0.3,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error(`AI API error: ${aiResponse.status} - ${errorText}`);
      throw new Error(`AI API error: ${aiResponse.statusText}`);
    }

    const aiData = await aiResponse.json();
    console.log('AI response received - tokens:', aiData.usage?.total_tokens || 'unknown');
    console.log('AI response:', JSON.stringify(aiData, null, 2));
    
    let suggestions = [];
    try {
      const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
      if (toolCall?.function?.arguments) {
        const parsed = typeof toolCall.function.arguments === 'string' 
          ? JSON.parse(toolCall.function.arguments)
          : toolCall.function.arguments;
        suggestions = parsed.schedules || [];
        console.log(`Parsed ${suggestions.length} suggestions from tool call`);
      } else {
        console.error('No tool call found in response');
      }
    } catch (e) {
      console.error('Failed to parse AI response:', e);
      console.error('Full AI response:', JSON.stringify(aiData));
    }

    // Helper: ensure valid ISO datetime with fallback to 09:00:00
    const ensureFullISO = (suggested: string, profileTimezone: string): string => {
      // If date-only like "2025-11-22", add 09:00:00
      if (/^\d{4}-\d{2}-\d{2}$/.test(suggested)) {
        console.log(`Date-only format detected: ${suggested}, adding 09:00:00Z`);
        return `${suggested}T09:00:00Z`;
      }
      // If lacks timezone, treat as UTC
      if (!/[zZ]|[+\-]\d{2}:\d{2}$/.test(suggested)) {
        console.log(`No timezone detected: ${suggested}, adding Z`);
        return `${suggested}Z`;
      }
      return suggested;
    };

    // Track which tasks were scheduled by AI
    const scheduledTaskIds = new Set<string>();

    // Schedule tasks from AI suggestions
    if (suggestions.length > 0) {
      for (const suggestion of suggestions) {
        const taskToUpdate = unscheduledTasks.find((t: any) => t.id === suggestion.task_id);
        if (!taskToUpdate) {
          console.warn(`Skipping update for task ${suggestion.task_id} - not in unscheduled list`);
          continue;
        }

        const fixedISO = ensureFullISO(suggestion.suggested_start, context.profile.timezone || 'UTC');
        const suggestedStart = new Date(fixedISO);
        const scheduledDate = suggestedStart.toISOString().slice(0, 10);
        const scheduledTime = suggestedStart.toISOString().slice(11, 19);

        console.log(`AI scheduled task ${suggestion.task_id}: ${scheduledDate} ${scheduledTime}`);

        const { error: updateError } = await supabase
          .from('tasks')
          .update({
            scheduled_date: scheduledDate,
            scheduled_time: scheduledTime,
            status: 'scheduled'
          })
          .eq('id', suggestion.task_id)
          .eq('user_id', user.id);

        if (!updateError) {
          scheduledTaskIds.add(suggestion.task_id);
          console.log(`✓ Task ${suggestion.task_id} scheduled by AI`);
        } else {
          console.error(`Failed to schedule task ${suggestion.task_id}:`, updateError);
        }
      }
    }

    // FALLBACK: Schedule any remaining unscheduled tasks (AI missed them)
    const missedTasks = unscheduledTasks.filter((t: any) => !scheduledTaskIds.has(t.id));
    if (missedTasks.length > 0) {
      console.log(`⚠️ AI missed ${missedTasks.length} tasks, applying fallback scheduling`);
      
      // Start scheduling from tomorrow morning at wake time
      let fallbackDate = new Date(now);
      fallbackDate.setDate(fallbackDate.getDate() + 1);
      const wakeHour = parseInt((context.profile.wake_time || '08:00:00').slice(0, 2));
      fallbackDate.setHours(wakeHour, 0, 0, 0);

      for (const task of missedTasks) {
        const scheduledDate = fallbackDate.toISOString().slice(0, 10);
        const scheduledTime = fallbackDate.toISOString().slice(11, 19);

        console.log(`Fallback scheduling task ${task.id}: ${scheduledDate} ${scheduledTime}`);

        const { error: updateError } = await supabase
          .from('tasks')
          .update({
            scheduled_date: scheduledDate,
            scheduled_time: scheduledTime,
            status: 'scheduled'
          })
          .eq('id', task.id)
          .eq('user_id', user.id);

        if (!updateError) {
          scheduledTaskIds.add(task.id);
          console.log(`✓ Task ${task.id} scheduled by fallback`);
        }

        // Move to next slot (add task duration + 30min buffer)
        fallbackDate.setMinutes(fallbackDate.getMinutes() + (task.duration_minutes || 60) + 30);
      }
    }

    const totalScheduled = scheduledTaskIds.size;
    console.log(`Task scheduling completed: ${totalScheduled} tasks scheduled (${suggestions.length} by AI, ${totalScheduled - suggestions.length} by fallback)`);

    return new Response(
      JSON.stringify({ 
        message: `Scheduled ${totalScheduled} tasks`,
        scheduled: totalScheduled,
        ai_scheduled: suggestions.length,
        fallback_scheduled: totalScheduled - suggestions.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error generating suggestions:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
