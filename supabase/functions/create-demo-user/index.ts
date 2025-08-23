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

  // Initialize Supabase client with service role key for admin operations
  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  const demoUserEmail = 'demo@intellehouse.com';
  const demoAgentEmail = 'agent@intellehouse.com';
  const demoPassword = 'demo123';

  try {
    // Create or get demo buyer user
    const { data: buyerAuthData, error: buyerAuthError } = await supabaseAdmin.auth.admin.createUser({
      email: demoUserEmail,
      password: demoPassword,
      email_confirm: true,
      user_metadata: {
        first_name: 'Demo'
      }
    });

    if (buyerAuthError && !buyerAuthError.message.includes('already registered')) {
      throw buyerAuthError;
    }

    let buyerUserId;
    if (buyerAuthData?.user) {
      buyerUserId = buyerAuthData.user.id;
    } else {
      // User already exists, get their ID
      const { data: existingBuyer } = await supabaseAdmin.auth.admin.listUsers();
      const existingBuyerUser = existingBuyer.users.find(u => u.email === demoUserEmail);
      if (!existingBuyerUser) {
        throw new Error('Failed to create or find demo user');
      }
      buyerUserId = existingBuyerUser.id;
    }

    // Create or update buyer profile
    const { error: buyerProfileError } = await supabaseAdmin
      .from('profiles')
      .upsert({
        user_id: buyerUserId,
        email: demoUserEmail,
        first_name: 'Demo',
        user_type: 'Buyer',
        credits: 1000,
        is_verified: true
      });

    if (buyerProfileError) {
      console.error('Error creating buyer profile:', buyerProfileError);
    }

    // Create or get demo agent user
    const { data: agentAuthData, error: agentAuthError } = await supabaseAdmin.auth.admin.createUser({
      email: demoAgentEmail,
      password: demoPassword,
      email_confirm: true,
      user_metadata: {
        first_name: 'Agent Demo'
      }
    });

    if (agentAuthError && !agentAuthError.message.includes('already registered')) {
      throw agentAuthError;
    }

    let agentUserId;
    if (agentAuthData?.user) {
      agentUserId = agentAuthData.user.id;
    } else {
      // User already exists, get their ID
      const { data: existingAgent } = await supabaseAdmin.auth.admin.listUsers();
      const existingAgentUser = existingAgent.users.find(u => u.email === demoAgentEmail);
      if (!existingAgentUser) {
        throw new Error('Failed to create or find demo agent');
      }
      agentUserId = existingAgentUser.id;
    }

    // Create or update agent profile
    const { error: agentProfileError } = await supabaseAdmin
      .from('profiles')
      .upsert({
        user_id: agentUserId,
        email: demoAgentEmail,
        first_name: 'Agent Demo',
        user_type: 'Agent',
        credits: 0,
        is_verified: true
      });

    if (agentProfileError) {
      console.error('Error creating agent profile:', agentProfileError);
    }

    // Create or update agent profile details
    const { error: agentDetailsError } = await supabaseAdmin
      .from('agent_profiles')
      .upsert({
        user_id: agentUserId,
        license_number: 'RE-12345-DEMO',
        brokerage_name: 'Demo Realty Group',
        credit_balance: 150,
        service_areas: ['San Francisco', 'Los Angeles', 'San Diego'],
        profile_bio: 'Demo agent for testing the platform'
      });

    if (agentDetailsError) {
      console.error('Error creating agent details:', agentDetailsError);
    }

    return new Response(
      JSON.stringify({ 
        message: 'Demo accounts created successfully',
        buyerEmail: demoUserEmail,
        agentEmail: demoAgentEmail,
        password: demoPassword
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    );
  }
};

serve(handler);