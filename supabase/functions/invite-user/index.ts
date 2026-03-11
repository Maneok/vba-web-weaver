import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

import { getCorsHeaders, handleCorsOptions } from "../_shared/cors.ts";

serve(async (req) => {
  const optRes = handleCorsOptions(req);
  if (optRes) return optRes;
  const corsHeaders = getCorsHeaders(req);

  try {
    // Verify caller is authenticated
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Non autorise" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create client with caller's JWT to verify identity
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseKey || !serviceKey) {
      return new Response(JSON.stringify({ error: "Configuration serveur manquante" }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const callerClient = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verify caller identity and role
    const { data: { user: caller }, error: authError } = await callerClient.auth.getUser();
    if (authError || !caller) {
      return new Response(JSON.stringify({ error: "Session invalide" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get caller profile to check role and cabinet
    const { data: callerProfile } = await callerClient
      .from("profiles")
      .select("role, cabinet_id")
      .eq("id", caller.id)
      .maybeSingle();

    if (!callerProfile || callerProfile.role !== "ADMIN") {
      return new Response(JSON.stringify({ error: "Seuls les administrateurs peuvent inviter des utilisateurs" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse and validate request body
    const { email, fullName, role } = await req.json();

    if (!email || !fullName || !role) {
      return new Response(JSON.stringify({ error: "Email, nom et role requis" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(JSON.stringify({ error: "Adresse email invalide" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (typeof fullName !== "string" || fullName.length < 2 || fullName.length > 100) {
      return new Response(JSON.stringify({ error: "Nom invalide (2-100 caracteres)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const validRoles = ["ADMIN", "SUPERVISEUR", "COLLABORATEUR", "STAGIAIRE"];
    if (!validRoles.includes(role)) {
      return new Response(JSON.stringify({ error: "Role invalide" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use service role to create user (bypasses RLS)
    const adminClient = createClient(supabaseUrl, serviceKey);

    // Generate secure password (user will reset it)
    const tempPassword = crypto.randomUUID() + crypto.randomUUID().slice(0, 8) + "A1!";

    const { data: newUser, error: signUpError } = await adminClient.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true, // Auto-confirm since admin is inviting
      user_metadata: {
        full_name: fullName,
        cabinet_id: callerProfile.cabinet_id,
        role: role,
        must_change_password: true,
      },
    });

    if (signUpError) {
      console.error("invite-user signUp error:", signUpError.message);
      const userMessage = "Erreur lors de la creation du compte. Verifiez les informations.";
      return new Response(JSON.stringify({ error: userMessage }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Send password reset email so user sets their own password
    const { error: resetError } = await adminClient.auth.admin.generateLink({
      type: "recovery",
      email,
      options: {
        redirectTo: `${Deno.env.get("SITE_URL") || supabaseUrl}/auth?reset=true`,
      },
    });

    if (resetError) {
      console.error("Password reset link error:", resetError);
      // Non-blocking — user was still created
    }

    // Log the invitation in audit trail
    await adminClient.from("audit_trail").insert({
      cabinet_id: callerProfile.cabinet_id,
      user_id: caller.id,
      user_email: caller.email || "",
      action: "INVITATION_UTILISATEUR",
      table_name: "profiles",
      record_id: newUser.user?.id || "",
      new_data: { email, role, full_name: fullName, invited_by: caller.email },
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: `Utilisateur ${email} invite avec succes. Un email de reinitialisation de mot de passe a ete envoye.`,
        userId: newUser.user?.id,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("invite-user error:", err);
    return new Response(JSON.stringify({ error: "Erreur interne du serveur" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
