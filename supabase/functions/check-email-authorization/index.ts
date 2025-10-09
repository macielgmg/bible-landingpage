import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email: rawEmail } = await req.json();
    const email = rawEmail.trim().toLowerCase(); // Normaliza o email de entrada

    // Create a Supabase client with the service role key
    // This client bypasses Row Level Security
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Check if the email is in the authorized_users table
    const { data: authorizedUser, error: authError } = await supabaseAdmin
      .from('authorized_users')
      .select('email')
      .eq('email', email) // Usa o email normalizado aqui
      .maybeSingle();

    if (authError && authError.code !== 'PGRST116') { // PGRST116 means "no rows found"
      console.error('Error checking authorized users in Edge Function:', authError);
      return new Response(JSON.stringify({ error: 'Erro interno ao verificar autorização.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    return new Response(JSON.stringify({ isAuthorized: !!authorizedUser }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Unexpected error in check-email-authorization Edge Function:', error);
    return new Response(JSON.stringify({ error: 'Ocorreu um erro inesperado.' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});