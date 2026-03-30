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
  category?: string;
}

interface PdfContent {
  name: string;
  type: string;
  data: string; // Base64 encoded
}

interface FormData {
  firstName: string;
  lastName: string;
  email?: string;
  partnerCode?: string;
  [key: string]: unknown;
}

interface WebhookPayload {
  formType?: string;
  submittedAt?: string;
  formData: FormData;
  pdfContent: PdfContent;
  files?: FileData[];
  documentUrls?: Record<string, string[]>;
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
    
    // Extract customer data from Clermont format
    const customerName = `${payload.formData?.firstName || ''} ${payload.formData?.lastName || ''}`.trim();
    const customerEmail = payload.formData?.email || null;
    const partnerCode = payload.formData?.partnerCode || null;
    
    console.log('Received webhook payload for customer:', customerName);

    // Validate required fields
    if (!payload.formData?.firstName || !payload.formData?.lastName || !payload.pdfContent?.data) {
      console.error('Missing required fields: formData.firstName, formData.lastName, or pdfContent.data');
      return new Response(
        JSON.stringify({ error: 'Missing required fields: formData (firstName, lastName) and pdfContent.data are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client with service role key
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Create folder name from customer name and timestamp
    const timestamp = new Date().toISOString().split('T')[0];
    const folderName = `${customerName} - ${timestamp}`;

    // Create new folder in "Steuern" -> "Anfrage eingegangen"
    console.log('Creating folder:', folderName);
    const { data: folder, error: folderError } = await supabase
      .from('folders')
      .insert({
        name: folderName,
        customer_name: customerName,
        customer_email: customerEmail,
        product: 'steuern',
        status: 'anfrage_eingegangen',
        partner_code: partnerCode,
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

    // Upload form PDF using pdfContent from Clermont format
    const pdfFileName = payload.pdfContent.name || `Formular_${customerName.replace(/\s+/g, '_')}_${timestamp}.pdf`;
    const pdfPath = `${folder.id}/${pdfFileName}`;
    
    // Decode base64 PDF
    const pdfData = Uint8Array.from(atob(payload.pdfContent.data), c => c.charCodeAt(0));
    
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

    // Upload additional files - either from files array (base64) or documentUrls (signed URLs)
    const uploadedFiles: string[] = [pdfFileName];
    
    if (payload.files && payload.files.length > 0) {
      console.log(`Uploading ${payload.files.length} additional files (base64)`);
      for (const file of payload.files) {
        try {
          const filePath = `${folder.id}/${file.name}`;
          const fileData = Uint8Array.from(atob(file.data), c => c.charCodeAt(0));
          const fileExtension = file.name.split('.').pop()?.toLowerCase() || '';
          const { error: fileUploadError } = await supabase.storage.from('documents').upload(filePath, fileData, { contentType: file.type || 'application/octet-stream', upsert: false });
          if (fileUploadError) { console.error(`Error uploading file ${file.name}:`, fileUploadError); continue; }
          const { error: fileDocError } = await supabase.from('documents').insert({ name: file.name, file_path: filePath, file_type: fileExtension, file_size: fileData.length, folder_id: folder.id, uploaded_by: null });
          if (!fileDocError) uploadedFiles.push(file.name);
        } catch (fileError) { console.error(`Error processing file ${file.name}:`, fileError); }
      }
    } else if (payload.documentUrls && Object.keys(payload.documentUrls).length > 0) {
      console.log('Downloading files from signed URLs...');
      for (const [category, urls] of Object.entries(payload.documentUrls)) {
        if (!Array.isArray(urls)) continue;
        for (const url of urls) {
          try {
            const response = await fetch(url);
            if (!response.ok) { console.error(`Failed to download ${category}: ${response.status}`); continue; }
            const fileBuffer = new Uint8Array(await response.arrayBuffer());
            const urlPath = new URL(url).pathname;
            const originalName = decodeURIComponent(urlPath.split('/').pop() || `${category}_document`);
            const filePath = `${folder.id}/${originalName}`;
            const fileExtension = originalName.split('.').pop()?.toLowerCase() || '';
            const contentType = response.headers.get('content-type') || 'application/octet-stream';
            const { error: uploadError } = await supabase.storage.from('documents').upload(filePath, fileBuffer, { contentType, upsert: false });
            if (uploadError) { console.error(`Error uploading ${originalName}:`, uploadError); continue; }
            const { error: docError } = await supabase.from('documents').insert({ name: originalName, file_path: filePath, file_type: fileExtension, file_size: fileBuffer.length, folder_id: folder.id, uploaded_by: null });
            if (!docError) { uploadedFiles.push(originalName); console.log(`Downloaded and stored: ${originalName} (${category})`); }
          } catch (dlError) { console.error(`Error downloading from URL (${category}):`, dlError); }
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
