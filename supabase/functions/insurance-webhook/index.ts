import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.4";

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

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify webhook secret via Authorization header
    const authHeader = req.headers.get("authorization");
    const expectedSecret = Deno.env.get("INSURANCE_WEBHOOK_SECRET");
    const providedSecret = authHeader?.replace("Bearer ", "");
    
    if (!providedSecret || providedSecret !== expectedSecret) {
      console.error("Invalid or missing authorization");
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize Supabase client with service role key for admin access
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body
    const payload: WebhookPayload = await req.json();
    
    // Extract customer data from Clermont format
    const customerName = `${payload.formData?.firstName || ''} ${payload.formData?.lastName || ''}`.trim();
    const customerEmail = payload.formData?.email || null;
    
    console.log("Received insurance webhook for customer:", customerName);

    // Validate required fields
    if (!payload.formData?.firstName || !payload.formData?.lastName || !payload.pdfContent?.data) {
      console.error("Missing required fields: formData.firstName, formData.lastName, or pdfContent.data");
      return new Response(
        JSON.stringify({ error: "Missing required fields: formData (firstName, lastName) and pdfContent.data are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create folder name from customer name and timestamp
    const timestamp = new Date().toISOString().split('T')[0];
    const folderName = `${customerName} - ${timestamp}`;

    // Create new folder in "Versicherung" -> "Neu"
    console.log("Creating insurance folder:", folderName);
    const { data: folder, error: folderError } = await supabase
      .from('folders')
      .insert({
        name: folderName,
        customer_name: customerName,
        customer_email: customerEmail,
        product: 'versicherung',
        status: 'neu',
        partner_code: null,
        created_by: null, // System upload
      })
      .select()
      .single();

    if (folderError) {
      console.error("Error creating folder:", folderError);
      return new Response(
        JSON.stringify({ error: "Failed to create folder", details: folderError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Folder created with ID:", folder.id);

    // Upload form PDF using pdfContent from Clermont format
    const pdfFileName = payload.pdfContent.name || `Formular_${customerName.replace(/\s+/g, '_')}_${timestamp}.pdf`;
    const pdfPath = `${folder.id}/${pdfFileName}`;
    
    // Decode base64 PDF
    const pdfData = Uint8Array.from(atob(payload.pdfContent.data), c => c.charCodeAt(0));
    
    console.log("Uploading form PDF:", pdfFileName);
    const { error: pdfUploadError } = await supabase.storage
      .from('documents')
      .upload(pdfPath, pdfData, {
        contentType: 'application/pdf',
        upsert: false
      });

    if (pdfUploadError) {
      console.error("Error uploading PDF:", pdfUploadError);
    } else {
      // Create document record for PDF
      const fileExt = pdfFileName.split('.').pop() || 'pdf';
      await supabase.from('documents').insert({
        folder_id: folder.id,
        name: pdfFileName,
        file_path: pdfPath,
        file_type: fileExt,
        file_size: pdfData.length,
        uploaded_by: null,
      });
      console.log("PDF document record created");
    }

    // Upload additional files if provided
    if (payload.files && payload.files.length > 0) {
      console.log(`Uploading ${payload.files.length} additional files`);
      
      for (const file of payload.files) {
        try {
          const fileData = Uint8Array.from(atob(file.data), c => c.charCodeAt(0));
          const filePath = `${folder.id}/${file.name}`;
          
          const { error: fileUploadError } = await supabase.storage
            .from('documents')
            .upload(filePath, fileData, {
              contentType: file.type,
              upsert: false
            });

          if (fileUploadError) {
            console.error(`Error uploading file ${file.name}:`, fileUploadError);
            continue;
          }

          // Create document record
          const fileExt = file.name.split('.').pop() || '';
          await supabase.from('documents').insert({
            folder_id: folder.id,
            name: file.name,
            file_path: filePath,
            file_type: fileExt,
            file_size: fileData.length,
            uploaded_by: null,
          });
          
          console.log(`File uploaded: ${file.name}`);
        } catch (fileError) {
          console.error(`Error processing file ${file.name}:`, fileError);
        }
      }
    }

    console.log("Insurance webhook processing completed successfully");
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        folder_id: folder.id,
        message: "Insurance case created successfully"
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Webhook error:", errorMessage);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
