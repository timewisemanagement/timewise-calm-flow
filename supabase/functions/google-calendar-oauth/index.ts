import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    
    // For POST requests, get action from body; for GET, from query params
    let action = url.searchParams.get('action');
    let body;
    if (req.method === 'POST') {
      body = await req.json();
      action = body.action;
    }

    // Handle authorization URL generation
    if (action === 'authorize') {
      // Get userId and appOrigin from request body
      const userId = body?.userId;
      const appOrigin = body?.appOrigin;
      
      if (!userId || !appOrigin) {
        return new Response(
          JSON.stringify({ error: 'User ID and app origin are required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
      const redirectUri = `${Deno.env.get('SUPABASE_URL')}/functions/v1/google-calendar-oauth?action=callback`;
      
      // Encode userId and appOrigin together in state
      const stateData = JSON.stringify({ userId, appOrigin });
      
      const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      authUrl.searchParams.append('client_id', clientId!);
      authUrl.searchParams.append('redirect_uri', redirectUri);
      authUrl.searchParams.append('response_type', 'code');
      authUrl.searchParams.append('scope', 'https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/userinfo.email');
      authUrl.searchParams.append('access_type', 'offline');
      authUrl.searchParams.append('prompt', 'consent');
      authUrl.searchParams.append('state', stateData);

      return new Response(
        JSON.stringify({ authUrl: authUrl.toString() }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle OAuth callback
    if (action === 'callback') {
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');

      console.log('OAuth callback received');

      if (!code) {
        throw new Error('No authorization code received');
      }

      // Parse state to get userId and appOrigin
      let userId;
      let appOrigin;
      
      if (!state) {
        console.error('No state parameter received');
        throw new Error('User authentication required - no state');
      }

      try {
        const stateData = JSON.parse(state);
        userId = stateData.userId;
        appOrigin = stateData.appOrigin;
        console.log('OAuth state parsed successfully');
      } catch (e) {
        console.error('Failed to parse state:', e, 'Raw state:', state);
        throw new Error('User authentication required - invalid state format');
      }

      if (!userId || !appOrigin) {
        console.error('Missing userId or appOrigin - userId:', userId, 'appOrigin:', appOrigin);
        throw new Error('User authentication required - missing data');
      }

      const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
      const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');
      const redirectUri = `${Deno.env.get('SUPABASE_URL')}/functions/v1/google-calendar-oauth?action=callback`;

      // Exchange authorization code for tokens
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          code,
          client_id: clientId!,
          client_secret: clientSecret!,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        }).toString(),
      });

      if (!tokenResponse.ok) {
        const errorData = await tokenResponse.json();
        console.error('Token exchange error:', errorData);
        throw new Error('Failed to exchange authorization code');
      }

      const tokens = await tokenResponse.json();
      
      // Fetch user's Google account email
      const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: {
          'Authorization': `Bearer ${tokens.access_token}`,
        },
      });

      let googleEmail = null;
      if (userInfoResponse.ok) {
        const userInfo = await userInfoResponse.json();
        googleEmail = userInfo.email;
        console.log('Google account information retrieved');
      }
      
      const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );

      // Calculate token expiration
      const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

      // Store tokens in secure oauth_tokens table
      const { error: tokensError } = await supabaseClient
        .from('oauth_tokens')
        .upsert({
          user_id: userId,
          provider: 'google_calendar',
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          token_expires_at: expiresAt,
        }, {
          onConflict: 'user_id,provider'
        });

      if (tokensError) {
        console.error('OAuth tokens save error:', tokensError);
        throw new Error('Failed to save Google Calendar credentials');
      }

      // Update profile with connection status and email
      const { error: profileError } = await supabaseClient
        .from('profiles')
        .update({
          google_calendar_connected: true,
          google_calendar_email: googleEmail,
        })
        .eq('id', userId);

      if (profileError) {
        console.error('Profile update error:', profileError);
        throw new Error('Failed to update profile');
      }

      // Immediately sync calendar events after connection
      try {
        const timeMin = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        const timeMax = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();

        const calendarResponse = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime`,
          {
            headers: {
              'Authorization': `Bearer ${tokens.access_token}`,
            },
          }
        );

        if (calendarResponse.ok) {
          const calendarData = await calendarResponse.json();
          const events = calendarData.items || [];
          
          const newEvents = events
            .filter((event: any) => 
              event.start && 
              (event.start.dateTime || event.start.date)
            )
            .map((event: any) => ({
              user_id: userId,
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

          if (newEvents.length > 0) {
            await supabaseClient.from('calendar_events').insert(newEvents);
          }

          console.log(`Initial calendar sync completed: ${newEvents.length} events`);
        }
      } catch (syncError) {
        console.error('Initial calendar sync error:', syncError);
        // Don't throw - we still want to redirect even if sync fails
      }

      // Redirect back to profile page
      return new Response(null, {
        status: 302,
        headers: {
          ...corsHeaders,
          'Location': `${appOrigin}/profile?google_calendar=connected`,
        },
      });
    }

    throw new Error('Invalid action');

  } catch (error) {
    console.error('Google Calendar OAuth error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
