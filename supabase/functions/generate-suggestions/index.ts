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

    console.log('Generating task scheduling suggestions');

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
      .in('status', ['pending', 'scheduled'])
      .order('priority', { ascending: false });

    if (!allTasks || allTasks.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No tasks to schedule', suggestions: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Only schedule tasks that are missing date OR time (unscheduled tasks)
    const unscheduledTasks = allTasks.filter(t => !t.scheduled_date || !t.scheduled_time);
    
    // Tasks with both date AND time are already scheduled - treat as conflicts to avoid
    const scheduledTasks = allTasks.filter(t => t.scheduled_date && t.scheduled_time);

    // If there are no unscheduled tasks, nothing to do
    if (unscheduledTasks.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No unscheduled tasks to place', suggestions: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch calendar events for next 7 days
    const now = new Date();
    const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    
    const { data: calendarEvents } = await supabase
      .from('calendar_events')
      .select('*')
      .eq('user_id', user.id)
      .gte('start_time', now.toISOString())
      .lte('start_time', sevenDaysLater.toISOString())
      .order('start_time', { ascending: true });

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
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `You are an expert human planner. Schedule tasks where users benefit most.

SCORING RUBRIC (use to evaluate each placement):
+0.4 if slot matches user focus preference and is during prime focus time
+0.25 if slot is on a day with spare time (less than average load)
+0.2 if slot avoids travel/conflict (no calendar events nearby)
-0.3 if slot is late-night or inside downtime
Final score normalized to 0–1

PLACEMENT LOGIC (must follow):
1. NEVER schedule inside downtime or outside wake_time–bed_time
2. Respect all calendarEvents and scheduledTasks: avoid overlaps, maintain 10min buffer
3. Prefer user focus_preference for high priority tasks (score ≥ 0.8 for high priority)
4. Tasks with requested date but no time: place on that day at BEST slot (not noon default)
5. Tasks without date/time: find next available day within 7 days, balance load (avoid exceeding ideal_focus_duration * 2 per day)
6. Return highest benefit score and include 1-2 sentence reason for each placement

EDGE CASES: If no conflict-free slot within 7 days, return best-effort with score < 0.5 and explain trade-offs.`
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
  description: t.description,
  requested_date: t.scheduled_date || null
})), null, 2)}

ALREADY SCHEDULED TASKS (avoid conflicts):
${JSON.stringify(scheduledTasks.map(t => ({ 
  date: t.scheduled_date, 
  time: t.scheduled_time, 
  duration_minutes: t.duration_minutes,
  title: t.title
})), null, 2)}

CALENDAR EVENTS (avoid conflicts):
${JSON.stringify((calendarEvents || []).map(e => ({ 
  start: e.start_time, 
  end: e.end_time,
  title: e.title
})), null, 2)}

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
    console.log('AI response received:', JSON.stringify(aiData, null, 2));
    
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

    // Delete old suggestions for this user
    await supabase
      .from('suggestions')
      .delete()
      .eq('user_id', user.id)
      .is('outcome', null);

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

    // Insert new suggestions and auto-schedule ALL tasks
    const insertData = suggestions.map((s: any) => {
      const fixedISO = ensureFullISO(s.suggested_start, context.profile.timezone || 'UTC');
      console.log(`Task ${s.task_id}: original=${s.suggested_start}, fixed=${fixedISO}, reason=${s.reason || 'N/A'}`);
      
      return {
        user_id: user.id,
        task_id: s.task_id,
        suggested_start: fixedISO,
        duration_minutes: s.duration_minutes,
        score: s.score || 0.8,
      };
    });

    if (insertData.length > 0) {
      const { error: insertError } = await supabase
        .from('suggestions')
        .insert(insertData);

      if (insertError) {
        console.error('Error inserting suggestions:', insertError);
      }

      // Update ONLY the unscheduled tasks with new schedule
      for (let i = 0; i < suggestions.length; i++) {
        const suggestion = suggestions[i];
        const insertItem = insertData[i];
        
        // Double-check that we're only updating tasks that were unscheduled
        const taskToUpdate = unscheduledTasks.find(t => t.id === suggestion.task_id);
        if (!taskToUpdate) {
          console.warn(`Skipping update for task ${suggestion.task_id} - not in unscheduled list`);
          continue;
        }

        const suggestedStart = new Date(insertItem.suggested_start);
        const scheduledDate = suggestedStart.toISOString().slice(0, 10); // YYYY-MM-DD
        const scheduledTime = suggestedStart.toISOString().slice(11, 19); // HH:MM:SS

        console.log(`Updating task ${suggestion.task_id}: date=${scheduledDate}, time=${scheduledTime}`);

        await supabase
          .from('tasks')
          .update({
            scheduled_date: scheduledDate,
            scheduled_time: scheduledTime,
            status: 'scheduled'
          })
          .eq('id', suggestion.task_id);
      }
    }

    console.log(`Task scheduling completed: ${insertData.length} tasks scheduled`);

    return new Response(
      JSON.stringify({ 
        message: `Scheduled ${insertData.length} unscheduled tasks`,
        suggestions: insertData 
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
