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

      console.log('Callback received - code:', !!code, 'state:', state);

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
        console.log('Parsed state - userId:', userId, 'appOrigin:', appOrigin);
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
        console.log('Fetched Google email:', googleEmail);
      }
      
      const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );

      // Calculate token expiration
      const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

      // Store tokens in user profile
      const { error: updateError } = await supabaseClient
        .from('profiles')
        .update({
          google_calendar_access_token: tokens.access_token,
          google_calendar_refresh_token: tokens.refresh_token,
          google_calendar_token_expires_at: expiresAt,
          google_calendar_connected: true,
          google_calendar_email: googleEmail,
        })
        .eq('id', userId);

      if (updateError) {
        console.error('Profile update error:', updateError);
        throw new Error('Failed to save Google Calendar credentials');
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
