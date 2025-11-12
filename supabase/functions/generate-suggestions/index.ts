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

    // Call AI with simpler prompt for faster response
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
            role: 'user',
            content: `You are a scheduling assistant. Schedule these unscheduled tasks optimally.

RULES:
- Never overlap with scheduled tasks or calendar events
- Respect wake time (${context.profile.wake_time || '08:00:00'}) and bed time (${context.profile.bed_time || '22:00:00'})
- Leave 10 minutes between tasks
- High priority tasks get better time slots

Unscheduled tasks: ${JSON.stringify(context.unscheduledTasks.map(t => ({ id: t.id, title: t.title, duration: t.duration_minutes, priority: t.priority })))}
Scheduled tasks (avoid these times): ${JSON.stringify(context.scheduledTasks.map(t => ({ date: t.scheduled_date, time: t.scheduled_time, duration: t.duration_minutes })))}
Calendar events (avoid these): ${JSON.stringify(context.calendarEvents.map(e => ({ start: e.start_time, end: e.end_time })))}

Return ONLY a JSON array, no markdown:
[{"task_id":"uuid","suggested_start":"2025-11-12T09:00:00Z","duration_minutes":60,"score":0.9,"reasoning":"morning slot"}]`
          }
        ],
        temperature: 0.3,
        max_tokens: 1500,
      }),
    });

    if (!aiResponse.ok) {
      throw new Error(`AI API error: ${aiResponse.statusText}`);
    }

    const aiData = await aiResponse.json();
    const aiContent = aiData.choices[0].message.content;
    
    console.log('AI scheduling response received');
    
    // Parse JSON response
    let suggestions = [];
    try {
      // Clean and extract JSON array
      let cleaned = aiContent.trim();
      // Remove markdown code blocks if present
      cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
      // Extract array
      const match = cleaned.match(/\[[\s\S]*\]/);
      if (match) {
        suggestions = JSON.parse(match[0]);
      } else {
        console.error('No JSON array found in response');
        suggestions = [];
      }
    } catch (e) {
      console.error('Failed to parse AI response:', e);
      console.error('AI response:', aiContent);
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
