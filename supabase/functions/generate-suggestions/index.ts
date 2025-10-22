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

    console.log(`Generating suggestions for user: ${user.id}`);

    // Fetch user's profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    // Fetch ALL tasks (including scheduled ones) for re-evaluation
    const { data: allTasks } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', user.id)
      .in('status', ['pending', 'scheduled'])
      .order('priority', { ascending: false });

    if (!allTasks || allTasks.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No tasks to schedule', suggestions: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Separate tasks: unscheduled (AI needs to place) vs scheduled (user/AI placed, check for conflicts)
    const unscheduledTasks = allTasks.filter(t => !t.scheduled_date || !t.scheduled_time);
    const scheduledTasks = allTasks.filter(t => t.scheduled_date && t.scheduled_time);

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

    // Call AI to generate suggestions
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
            content: `You are a smart scheduling assistant that prevents conflicts and optimizes schedules.

CRITICAL RULES:
1. NO OVERLAPS: Tasks cannot overlap. Check scheduled_time and duration_minutes for conflicts.
2. BUFFER TIME: Leave at least 10 minutes between all tasks.
3. COMMUTE TIME: For tasks with commute_minutes > 0, add (commute_minutes + 10) BEFORE and AFTER the task.
4. WAKE/SLEEP: User wakes at ${context.profile.wake_time || '08:00:00'}, sleeps at ${context.profile.bed_time || '22:00:00'}. Never schedule outside this window.
${context.profile.downtime_start && context.profile.downtime_end ? `5. DOWNTIME: User has downtime ${context.profile.downtime_start} to ${context.profile.downtime_end}. Avoid unless necessary.` : ''}

CONFLICT RESOLUTION:
- If a day is too full, move lower priority tasks to the next available day
- Respect user-scheduled tasks but resolve conflicts by moving other tasks
- Always find a valid time slot with no overlaps

PREFERENCES:
- Focus preference: ${context.profile.focus_preference}
- Ideal focus duration: ${context.profile.ideal_focus_duration} minutes
- Avoid calendar events
- Prioritize high-priority tasks
- Current time: ${context.currentTime}

INPUT:
- Unscheduled tasks: Need time slots assigned
- Scheduled tasks: Already have times, but check for conflicts
- Calendar events: External events to avoid

OUTPUT JSON (return ONLY the JSON array):
[
  {
    "task_id": "uuid",
    "suggested_start": "2025-10-22T09:00:00Z",
    "duration_minutes": 60,
    "score": 0.95,
    "reasoning": "No conflicts, morning preference"
  }
]

Return suggestions for ALL tasks (unscheduled + any scheduled tasks that need to move due to conflicts).`
          },
          {
            role: 'user',
            content: `Unscheduled Tasks (need placement): ${JSON.stringify(context.unscheduledTasks)}

Scheduled Tasks (check for conflicts): ${JSON.stringify(context.scheduledTasks)}

Calendar Events: ${JSON.stringify(context.calendarEvents)}

Re-evaluate the schedule, resolve all conflicts, and return suggestions for optimal placement.`
          }
        ],
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!aiResponse.ok) {
      throw new Error(`AI API error: ${aiResponse.statusText}`);
    }

    const aiData = await aiResponse.json();
    const aiContent = aiData.choices[0].message.content;
    
    console.log('AI Response:', aiContent);
    
    // Parse AI response
    let suggestions;
    try {
      // Extract JSON array from response
      const jsonMatch = aiContent.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        suggestions = JSON.parse(jsonMatch[0]);
      } else {
        suggestions = JSON.parse(aiContent);
      }
    } catch (e) {
      console.error('Failed to parse AI response:', e);
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

      // Update ALL tasks with the conflict-free schedule
      for (const suggestion of suggestions) {
        const suggestedStart = new Date(suggestion.suggested_start);
        const scheduledDate = suggestedStart.toISOString().split('T')[0];
        const scheduledTime = suggestedStart.toISOString().split('T')[1].substring(0, 5);

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

    console.log(`Optimized schedule with ${insertData.length} conflict-free tasks`);

    return new Response(
      JSON.stringify({ 
        message: `Optimized schedule with ${insertData.length} conflict-free tasks`,
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
