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
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    // Get user's Canvas URL from profile
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('canvas_url')
      .eq('id', user.id)
      .single();

    if (profileError || !profile?.canvas_url) {
      throw new Error('Canvas URL not configured');
    }

    // Validate Canvas URL to prevent SSRF attacks
    const canvasUrl = profile.canvas_url.trim();
    
    // Parse and validate URL
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(canvasUrl);
    } catch {
      throw new Error('Invalid Canvas URL format');
    }

    // Only allow HTTPS protocol
    if (parsedUrl.protocol !== 'https:') {
      throw new Error('Canvas URL must use HTTPS protocol');
    }

    // Allowlist of valid Canvas domains
    const allowedDomains = [
      'instructure.com',
      'canvas.instructure.com',
    ];

    const hostname = parsedUrl.hostname.toLowerCase();
    const isAllowed = allowedDomains.some(domain => 
      hostname === domain || hostname.endsWith(`.${domain}`)
    );

    if (!isAllowed) {
      throw new Error('Canvas URL must be from an authorized Canvas domain (*.instructure.com)');
    }

    // Reject private IP ranges (RFC 1918, loopback, link-local)
    const privateIpPatterns = [
      /^127\./,           // Loopback
      /^10\./,            // Private 10.0.0.0/8
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // Private 172.16.0.0/12
      /^192\.168\./,      // Private 192.168.0.0/16
      /^169\.254\./,      // Link-local
      /^localhost$/i,     // Localhost
    ];

    if (privateIpPatterns.some(pattern => pattern.test(hostname))) {
      throw new Error('Canvas URL cannot be a private IP address');
    }

    const canvasToken = Deno.env.get('CANVAS_API_TOKEN');
    if (!canvasToken) {
      throw new Error('Canvas API token not configured');
    }

    // Fetch assignments from Canvas API
    const canvasResponse = await fetch(
      `${profile.canvas_url}/api/v1/courses?enrollment_state=active`,
      {
        headers: {
          'Authorization': `Bearer ${canvasToken}`,
        },
      }
    );

    if (!canvasResponse.ok) {
      throw new Error(`Canvas API error: ${canvasResponse.status}`);
    }

    const courses = await canvasResponse.json();
    const allAssignments = [];

    // Fetch assignments for each active course
    for (const course of courses) {
      const assignmentsResponse = await fetch(
        `${profile.canvas_url}/api/v1/courses/${course.id}/assignments?order_by=due_at`,
        {
          headers: {
            'Authorization': `Bearer ${canvasToken}`,
          },
        }
      );

      if (assignmentsResponse.ok) {
        const assignments = await assignmentsResponse.json();
        
        // Filter assignments with due dates in the future
        const upcomingAssignments = assignments.filter(
          (a: any) => a.due_at && new Date(a.due_at) > new Date()
        );

        for (const assignment of upcomingAssignments) {
          allAssignments.push({
            user_id: user.id,
            title: `${course.name}: ${assignment.name}`,
            description: assignment.description || '',
            duration_minutes: 60, // Default duration
            priority: 'medium',
            tags: ['canvas', 'homework'],
            status: 'pending',
            scheduled_date: assignment.due_at ? new Date(assignment.due_at).toISOString().split('T')[0] : null,
            color: '#dc2626', // Red color for homework
          });
        }
      }
    }

    // Check for existing Canvas homework tasks to avoid duplicates
    const { data: existingTasks } = await supabaseClient
      .from('tasks')
      .select('title')
      .eq('user_id', user.id)
      .contains('tags', ['canvas']);

    const existingTitles = new Set(existingTasks?.map(t => t.title) || []);
    const newAssignments = allAssignments.filter(a => !existingTitles.has(a.title));

    // Insert new assignments as tasks
    if (newAssignments.length > 0) {
      const { error: insertError } = await supabaseClient
        .from('tasks')
        .insert(newAssignments);

      if (insertError) throw insertError;
    }

    // Update last sync time
    await supabaseClient
      .from('profiles')
      .update({ 
        canvas_last_sync: new Date().toISOString(),
        canvas_connected: true 
      })
      .eq('id', user.id);

    console.log(`Synced ${newAssignments.length} new assignments from Canvas`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        synced: newAssignments.length,
        message: `Successfully synced ${newAssignments.length} new assignment(s)` 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Canvas sync error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});