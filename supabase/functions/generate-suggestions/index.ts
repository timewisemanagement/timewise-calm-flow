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

    // Call AI to generate suggestions using tool calling for structured output
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
            content: `You are a smart scheduling assistant that finds optimal time slots for unscheduled tasks.

CRITICAL RULES:
1. NEVER MOVE SCHEDULED TASKS: Tasks with scheduled_date and scheduled_time are FIXED. You cannot move them.
2. NO OVERLAPS: New tasks cannot overlap with scheduled tasks or calendar events.
3. BUFFER TIME: Leave at least 10 minutes between all tasks.
4. COMMUTE TIME: For tasks with commute_minutes > 0, reserve (commute_minutes) time BEFORE and AFTER the task duration.
5. WAKE/SLEEP: User wakes at ${context.profile.wake_time || '08:00:00'}, sleeps at ${context.profile.bed_time || '22:00:00'}. Never schedule outside this window.
${context.profile.downtime_start && context.profile.downtime_end ? `6. DOWNTIME: User has downtime ${context.profile.downtime_start} to ${context.profile.downtime_end}. Avoid scheduling during this time unless absolutely necessary.` : ''}

YOUR TASK:
- Schedule ONLY the unscheduled tasks (those without both date and time)
- Work AROUND existing scheduled tasks and calendar events - DO NOT move them
- Find the best available time slots that avoid all conflicts
- If you cannot fit a task without conflicts, schedule it on the next available day

PREFERENCES:
- Focus preference: ${context.profile.focus_preference}
- Ideal focus duration: ${context.profile.ideal_focus_duration} minutes
- Prioritize high-priority tasks for better time slots
- Current time: ${context.currentTime}

Return suggestions ONLY for unscheduled tasks. DO NOT include scheduled tasks in your output.`
          },
          {
            role: 'user',
            content: `Unscheduled Tasks (find time slots for these): ${JSON.stringify(context.unscheduledTasks)}

Scheduled Tasks (FIXED - work around these): ${JSON.stringify(context.scheduledTasks)}

Calendar Events (FIXED - work around these): ${JSON.stringify(context.calendarEvents)}

Find optimal time slots for the unscheduled tasks while avoiding all conflicts with scheduled tasks and calendar events.`
          }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "schedule_tasks",
              description: "Schedule unscheduled tasks in optimal time slots",
              parameters: {
                type: "object",
                properties: {
                  suggestions: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        task_id: { type: "string", description: "UUID of the task" },
                        suggested_start: { type: "string", description: "ISO 8601 datetime when task should start" },
                        duration_minutes: { type: "integer", description: "Duration in minutes" },
                        score: { type: "number", description: "Confidence score 0-1" },
                        reasoning: { type: "string", description: "Why this time slot was chosen" }
                      },
                      required: ["task_id", "suggested_start", "duration_minutes", "score", "reasoning"],
                      additionalProperties: false
                    }
                  }
                },
                required: ["suggestions"],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "schedule_tasks" } },
        temperature: 0.7,
      }),
    });

    if (!aiResponse.ok) {
      throw new Error(`AI API error: ${aiResponse.statusText}`);
    }

    const aiData = await aiResponse.json();
    
    console.log('AI scheduling response received');
    
    // Extract suggestions from tool call
    let suggestions = [];
    try {
      const toolCalls = aiData.choices[0].message.tool_calls;
      if (toolCalls && toolCalls.length > 0) {
        const functionCall = toolCalls[0].function;
        const args = JSON.parse(functionCall.arguments);
        suggestions = args.suggestions || [];
      } else {
        console.error('No tool calls in AI response');
      }
    } catch (e) {
      console.error('Failed to extract suggestions from AI response:', e);
      suggestions = [];
    }

    // Delete old suggestions for this user
    await supabase
      .from('suggestions')
      .delete()
      .eq('user_id', user.id)
      .is('outcome', null);

    // Insert new suggestions and auto-schedule ALL tasks (resolving conflicts)
    const insertData = suggestions.map((s: any) => ({
      user_id: user.id,
      task_id: s.task_id,
      suggested_start: s.suggested_start,
      duration_minutes: s.duration_minutes,
      score: s.score || 0.8,
    }));

    if (insertData.length > 0) {
      const { error: insertError } = await supabase
        .from('suggestions')
        .insert(insertData);

      if (insertError) {
        console.error('Error inserting suggestions:', insertError);
      }

      // Update ONLY the unscheduled tasks with new schedule
      for (const suggestion of suggestions) {
        // Double-check that we're only updating tasks that were unscheduled
        const taskToUpdate = unscheduledTasks.find(t => t.id === suggestion.task_id);
        if (!taskToUpdate) {
          console.warn(`Skipping update for task ${suggestion.task_id} - not in unscheduled list`);
          continue;
        }

        const suggestedStart = new Date(suggestion.suggested_start);
        const scheduledDate = suggestedStart.toISOString().split('T')[0];
        const scheduledTime = suggestedStart.toISOString().split('T')[1].substring(0, 8); // Include seconds (HH:MM:SS)

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
