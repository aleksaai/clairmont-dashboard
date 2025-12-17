import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface FileData {
  name: string;
  type: string;
  data: string; // Base64 encoded
}

interface WebhookPayload {
  customer_name: string;
  customer_email?: string;
  form_pdf: string; // Base64 encoded PDF
  files?: FileData[];
  partner_code?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate webhook secret
    const authHeader = req.headers.get('authorization');
    const webhookSecret = Deno.env.get('FORM_WEBHOOK_SECRET');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('Missing or invalid authorization header');
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const providedSecret = authHeader.replace('Bearer ', '');
    if (providedSecret !== webhookSecret) {
      console.error('Invalid webhook secret');
      return new Response(
        JSON.stringify({ error: 'Invalid webhook secret' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const payload: WebhookPayload = await req.json();
    console.log('Received webhook payload for customer:', payload.customer_name);

    // Validate required fields
    if (!payload.customer_name || !payload.form_pdf) {
      console.error('Missing required fields: customer_name or form_pdf');
      return new Response(
        JSON.stringify({ error: 'Missing required fields: customer_name and form_pdf are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client with service role key
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Create folder name from customer name and timestamp
    const timestamp = new Date().toISOString().split('T')[0];
    const folderName = `${payload.customer_name} - ${timestamp}`;

    // Create new folder in "Steuern" -> "Anfrage eingegangen"
    console.log('Creating folder:', folderName);
    const { data: folder, error: folderError } = await supabase
      .from('folders')
      .insert({
        name: folderName,
        customer_name: payload.customer_name,
        customer_email: payload.customer_email || null,
        product: 'steuern',
        status: 'anfrage_eingegangen',
        partner_code: payload.partner_code || null,
        created_by: null, // System upload
      })
      .select()
      .single();

    if (folderError) {
      console.error('Error creating folder:', folderError);
      return new Response(
        JSON.stringify({ error: 'Failed to create folder', details: folderError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Folder created with ID:', folder.id);

    // Upload form PDF
    const pdfFileName = `Formular_${payload.customer_name.replace(/\s+/g, '_')}_${timestamp}.pdf`;
    const pdfPath = `${folder.id}/${pdfFileName}`;
    
    // Decode base64 PDF
    const pdfData = Uint8Array.from(atob(payload.form_pdf), c => c.charCodeAt(0));
    
    console.log('Uploading form PDF:', pdfFileName);
    const { error: pdfUploadError } = await supabase.storage
      .from('documents')
      .upload(pdfPath, pdfData, {
        contentType: 'application/pdf',
        upsert: false,
      });

    if (pdfUploadError) {
      console.error('Error uploading PDF:', pdfUploadError);
      return new Response(
        JSON.stringify({ error: 'Failed to upload form PDF', details: pdfUploadError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create document entry for PDF
    const { error: pdfDocError } = await supabase
      .from('documents')
      .insert({
        name: pdfFileName,
        file_path: pdfPath,
        file_type: 'pdf',
        file_size: pdfData.length,
        folder_id: folder.id,
        uploaded_by: null, // System upload
      });

    if (pdfDocError) {
      console.error('Error creating PDF document entry:', pdfDocError);
    }

    // Upload additional files if provided
    const uploadedFiles: string[] = [pdfFileName];
    
    if (payload.files && payload.files.length > 0) {
      console.log(`Uploading ${payload.files.length} additional files`);
      
      for (const file of payload.files) {
        try {
          const filePath = `${folder.id}/${file.name}`;
          const fileData = Uint8Array.from(atob(file.data), c => c.charCodeAt(0));
          
          // Get file extension
          const fileExtension = file.name.split('.').pop()?.toLowerCase() || '';
          
          console.log('Uploading file:', file.name);
          const { error: fileUploadError } = await supabase.storage
            .from('documents')
            .upload(filePath, fileData, {
              contentType: file.type || 'application/octet-stream',
              upsert: false,
            });

          if (fileUploadError) {
            console.error(`Error uploading file ${file.name}:`, fileUploadError);
            continue;
          }

          // Create document entry
          const { error: fileDocError } = await supabase
            .from('documents')
            .insert({
              name: file.name,
              file_path: filePath,
              file_type: fileExtension,
              file_size: fileData.length,
              folder_id: folder.id,
              uploaded_by: null, // System upload
            });

          if (fileDocError) {
            console.error(`Error creating document entry for ${file.name}:`, fileDocError);
          } else {
            uploadedFiles.push(file.name);
          }
        } catch (fileError) {
          console.error(`Error processing file ${file.name}:`, fileError);
        }
      }
    }

    console.log('Webhook processing completed successfully');
    
    return new Response(
      JSON.stringify({
        success: true,
        folder_id: folder.id,
        folder_name: folderName,
        uploaded_files: uploadedFiles,
        message: `Kundenordner "${folderName}" wurde erfolgreich erstellt mit ${uploadedFiles.length} Datei(en).`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error in webhook:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
