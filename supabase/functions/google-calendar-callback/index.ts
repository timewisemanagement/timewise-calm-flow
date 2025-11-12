import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');

    if (error) {
      console.error('OAuth error:', error);
      const errorState = state ? JSON.parse(decodeURIComponent(state)) : { appOrigin: Deno.env.get('APP_ORIGIN') || 'http://localhost:5173' };
      return Response.redirect(`${errorState.appOrigin}?error=oauth_failed`);
    }

    if (!code || !state) {
      throw new Error('Missing authorization code or state');
    }

    const decodedState = JSON.parse(decodeURIComponent(state));
    const { userId, appOrigin } = decodedState;

    if (!userId || !appOrigin) {
      throw new Error('Invalid state parameter');
    }

    // Validate userId is a valid UUID
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!UUID_REGEX.test(userId)) {
      throw new Error('Invalid userId format');
    }

    // Validate appOrigin is from an allowed domain
    const allowedOrigins = [
      Deno.env.get('APP_ORIGIN'),
      'http://localhost:5173',
      'http://localhost:8080',
    ].filter(Boolean);
    
    if (!allowedOrigins.includes(appOrigin)) {
      throw new Error('Invalid origin domain');
    }

    const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
    const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');
    const redirectUri = Deno.env.get('GOOGLE_REDIRECT_URI');

    if (!clientId || !clientSecret || !redirectUri) {
      throw new Error('Google OAuth credentials not configured');
    }

    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error('Token exchange failed:', errorData);
      throw new Error('Failed to exchange authorization code for tokens');
    }

    const tokens = await tokenResponse.json();

    // Get user email from Google
    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
      },
    });

    if (!userInfoResponse.ok) {
      throw new Error('Failed to fetch user info from Google');
    }

    const userInfo = await userInfoResponse.json();
    const googleEmail = userInfo.email;

    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Store tokens in oauth_tokens table
    const { error: tokenError } = await supabase
      .from('oauth_tokens')
      .upsert({
        user_id: userId,
        provider: 'google_calendar',
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      }, {
        onConflict: 'user_id,provider'
      });

    if (tokenError) {
      console.error('Token storage error:', tokenError);
      throw new Error('Failed to store OAuth tokens');
    }

    // Update profile with Google Calendar connection
    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        google_calendar_connected: true,
        google_calendar_email: googleEmail,
        google_calendar_last_sync: new Date().toISOString(),
      })
      .eq('id', userId);

    if (profileError) {
      console.error('Profile update error:', profileError);
      throw new Error('Failed to update profile');
    }

    // Perform initial sync
    const eventsResponse = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?` +
      `timeMin=${new Date().toISOString()}&` +
      `maxResults=100&` +
      `singleEvents=true&` +
      `orderBy=startTime`,
      {
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
        },
      }
    );

    if (eventsResponse.ok) {
      const eventsData = await eventsResponse.json();
      const events = eventsData.items || [];

      if (events.length > 0) {
        const calendarEvents = events.map((event: any) => ({
          user_id: userId,
          google_event_id: event.id,
          summary: event.summary || 'Untitled Event',
          description: event.description || null,
          start_time: event.start.dateTime || event.start.date,
          end_time: event.end.dateTime || event.end.date,
          location: event.location || null,
          attendees: event.attendees ? event.attendees.map((a: any) => a.email) : [],
          is_all_day: !event.start.dateTime,
        }));

        await supabase
          .from('calendar_events')
          .upsert(calendarEvents, {
            onConflict: 'google_event_id'
          });

        console.log(`Synced ${events.length} events`);
      }
    }

    return Response.redirect(`${appOrigin}?success=google_calendar_connected`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Callback error:', errorMessage);
    const fallbackOrigin = Deno.env.get('APP_ORIGIN') || 'http://localhost:5173';
    return Response.redirect(`${fallbackOrigin}?error=${encodeURIComponent(errorMessage)}`);
  }
});
