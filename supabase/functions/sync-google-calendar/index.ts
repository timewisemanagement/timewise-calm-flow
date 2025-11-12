import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function refreshAccessToken(refreshToken: string): Promise<{ accessToken: string; expiresAt: string }> {
  const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
  const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: clientId!,
      client_secret: clientSecret!,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }).toString(),
  });

  if (!response.ok) {
    throw new Error('Failed to refresh access token');
  }

  const data = await response.json();
  const expiresAt = new Date(Date.now() + data.expires_in * 1000).toISOString();

  return { accessToken: data.access_token, expiresAt };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    // Get user's Google Calendar credentials from profile
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('google_calendar_access_token, google_calendar_refresh_token, google_calendar_token_expires_at')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      throw new Error('Profile not found');
    }

    if (!profile.google_calendar_refresh_token) {
      throw new Error('Google Calendar not connected');
    }

    let accessToken = profile.google_calendar_access_token;
    const expiresAt = profile.google_calendar_token_expires_at;

    // Check if token needs refresh
    if (!accessToken || new Date(expiresAt) <= new Date()) {
      const { accessToken: newToken, expiresAt: newExpiresAt } = await refreshAccessToken(
        profile.google_calendar_refresh_token
      );

      accessToken = newToken;

      // Update profile with new token
      await supabaseClient
        .from('profiles')
        .update({
          google_calendar_access_token: newToken,
          google_calendar_token_expires_at: newExpiresAt,
        })
        .eq('id', user.id);
    }

    // Fetch calendar events from Google Calendar API
    // Fetch events from 30 days ago to 90 days in the future
    const timeMin = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(); // Last 30 days
    const timeMax = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(); // Next 90 days

    console.log(`Fetching events from ${timeMin} to ${timeMax}`);

    const calendarResponse = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );

    if (!calendarResponse.ok) {
      const errorData = await calendarResponse.json();
      console.error('Google Calendar API error:', errorData);
      throw new Error('Failed to fetch calendar events');
    }

    const calendarData = await calendarResponse.json();
    const events = calendarData.items || [];
    
    console.log(`Found ${events.length} total events from Google Calendar`);

    // Check existing calendar events to avoid duplicates
    const { data: existingEvents } = await supabaseClient
      .from('calendar_events')
      .select('provider_event_id')
      .eq('user_id', user.id);

    const existingEventIds = new Set(existingEvents?.map(e => e.provider_event_id) || []);

    // Prepare new events for insertion
    const newEvents = events
      .filter((event: any) => 
        event.start && 
        (event.start.dateTime || event.start.date) &&
        !existingEventIds.has(event.id)
      )
      .map((event: any) => ({
        user_id: user.id,
        provider_event_id: event.id,
        title: event.summary || 'Untitled Event',
        description: event.description || null,
        location: event.location || null,
        start_time: event.start.dateTime || event.start.date,
        end_time: event.end.dateTime || event.end.date,
        metadata: {
          htmlLink: event.htmlLink,
          status: event.status,
          organizer: event.organizer,
        },
      }));

    // Insert new events
    if (newEvents.length > 0) {
      const { error: insertError } = await supabaseClient
        .from('calendar_events')
        .insert(newEvents);

      if (insertError) {
        console.error('Insert error:', insertError);
        throw new Error('Failed to save calendar events');
      }
    }

    // Update last sync time
    await supabaseClient
      .from('profiles')
      .update({ google_calendar_last_sync: new Date().toISOString() })
      .eq('id', user.id);

    console.log(`Synced ${newEvents.length} new events from Google Calendar`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        synced: newEvents.length,
        message: `Successfully synced ${newEvents.length} new event(s)` 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Google Calendar sync error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
