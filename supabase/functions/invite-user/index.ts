import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface InviteRequest {
  email: string;
  fullName: string;
  password: string;
  role: 'admin' | 'sachbearbeiter' | 'vertriebler';
  partnerCode?: string;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify the requesting user is an admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Nicht autorisiert");
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user: requestingUser }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !requestingUser) {
      throw new Error("Nicht autorisiert");
    }

    // Check if requesting user is admin
    const { data: roleData } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', requestingUser.id)
      .single();

    if (roleData?.role !== 'admin') {
      throw new Error("Nur Administratoren können Benutzer einladen");
    }

    const { email, fullName, password, role, partnerCode }: InviteRequest = await req.json();

    if (!email || !fullName || !password || !role) {
      throw new Error("Alle Felder sind erforderlich");
    }

    // For Vertriebler, partner code is required
    if (role === 'vertriebler' && !partnerCode) {
      throw new Error("Partnercode ist für Vertriebler erforderlich");
    }

    // Create user with admin client
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });

    if (createError) {
      console.error("Error creating user:", createError);
      throw new Error(`Benutzer konnte nicht erstellt werden: ${createError.message}`);
    }

    // Update the role if not vertriebler (default)
    if (role !== 'vertriebler' && newUser.user) {
      const { error: roleError } = await supabaseAdmin
        .from('user_roles')
        .update({ role })
        .eq('user_id', newUser.user.id);

      if (roleError) {
        console.error("Error updating role:", roleError);
      }
    }

    // Create partner code entry if provided
    if (partnerCode && newUser.user) {
      const { error: partnerError } = await supabaseAdmin
        .from('partner_codes')
        .insert({ user_id: newUser.user.id, code: partnerCode });

      if (partnerError) {
        console.error("Error creating partner code:", partnerError);
      }
    }

    // Send invitation email
    const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
    
    const roleNames: Record<string, string> = {
      'admin': 'Administrator',
      'sachbearbeiter': 'Sachbearbeiter',
      'vertriebler': 'Vertriebler'
    };

    const partnerCodeHtml = partnerCode 
      ? `<p style="margin: 5px 0;"><strong>Partnercode:</strong> ${partnerCode}</p>` 
      : '';

    const { error: emailError } = await resend.emails.send({
      from: "Clairmont Advisory <noreply@tax.clairmont-advisory.com>",
      to: [email],
      subject: "Ihre Einladung zum Clairmont Dashboard",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #333;">Willkommen bei Clairmont!</h1>
          <p>Hallo ${fullName},</p>
          <p>Sie wurden zum Clairmont Dashboard eingeladen. Hier sind Ihre Anmeldedaten:</p>
          <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>E-Mail:</strong> ${email}</p>
            <p style="margin: 5px 0;"><strong>Passwort:</strong> ${password}</p>
            <p style="margin: 5px 0;"><strong>Rolle:</strong> ${roleNames[role]}</p>
            ${partnerCodeHtml}
          </div>
          <div style="text-align: center; margin: 30px 0;">
            <a href="https://app.clairmont-advisory.com" style="display: inline-block; background-color: #0f172a; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
              Jetzt anmelden
            </a>
          </div>
          <p style="color: #666; font-size: 14px;">Bitte ändern Sie Ihr Passwort nach der ersten Anmeldung.</p>
          <p style="margin-top: 30px;">Mit freundlichen Grüßen,<br>Das Clairmont Team</p>
        </div>
      `,
    });

    if (emailError) {
      console.error("Error sending email:", emailError);
      // Don't throw - user was created successfully
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Benutzer wurde erfolgreich eingeladen",
        emailSent: !emailError 
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error: any) {
    console.error("Error in invite-user function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
