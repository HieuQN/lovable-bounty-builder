import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client with service role key for admin operations
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Demo user credentials
    const demoEmail = 'demo@intellehouse.com';
    const demoPassword = 'demo123';
    const demoFirstName = 'Demo';

    console.log('Creating demo user...');

    // Create the demo user
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: demoEmail,
      password: demoPassword,
      email_confirm: true, // Skip email confirmation for demo user
      user_metadata: {
        first_name: demoFirstName
      }
    });

    if (authError) {
      // If user already exists, that's ok
      if (authError.message.includes('User already registered')) {
        console.log('Demo user already exists');
        return new Response(
          JSON.stringify({ success: true, message: 'Demo user already exists' }),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders,
            },
          }
        );
      }
      throw authError;
    }

    console.log('Demo user created successfully:', authData.user?.id);

    // Create profile record
    if (authData.user) {
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .insert({
          user_id: authData.user.id,
          email: demoEmail,
          first_name: demoFirstName,
          user_type: 'Buyer',
          is_verified: true
        });

      if (profileError && !profileError.message.includes('duplicate key')) {
        console.error('Error creating profile:', profileError);
        // Don't fail the whole operation if profile creation fails
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Demo user created successfully',
        user_id: authData.user?.id 
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    );
  } catch (error: any) {
    console.error('Error in create-demo-user function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }
};

serve(handler);