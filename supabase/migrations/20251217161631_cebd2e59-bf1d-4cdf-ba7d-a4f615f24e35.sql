-- Create enums
CREATE TYPE public.case_status AS ENUM ('neu', 'bezahlt', 'in_bearbeitung', 'abgeschlossen', 'einspruch');
CREATE TYPE public.product_type AS ENUM ('steuern', 'kredit', 'versicherung');

-- Create folders table
CREATE TABLE public.folders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_email TEXT,
  status case_status NOT NULL DEFAULT 'neu',
  product product_type NOT NULL DEFAULT 'steuern',
  partner_code TEXT,
  assigned_to UUID REFERENCES public.profiles(id),
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create documents table
CREATE TABLE public.documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  folder_id UUID NOT NULL REFERENCES public.folders(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  uploaded_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- Folders policies
CREATE POLICY "Admins can manage all folders" ON public.folders FOR ALL USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Sachbearbeiter can view all folders" ON public.folders FOR SELECT USING (has_role(auth.uid(), 'sachbearbeiter'));
CREATE POLICY "Vertriebler can view assigned folders" ON public.folders FOR SELECT USING (has_role(auth.uid(), 'vertriebler') AND (assigned_to = auth.uid() OR created_by = auth.uid()));
CREATE POLICY "Vertriebler can create folders" ON public.folders FOR INSERT WITH CHECK (has_role(auth.uid(), 'vertriebler') AND created_by = auth.uid());

-- Documents policies
CREATE POLICY "Admins can manage all documents" ON public.documents FOR ALL USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Sachbearbeiter can view all documents" ON public.documents FOR SELECT USING (has_role(auth.uid(), 'sachbearbeiter'));
CREATE POLICY "Vertriebler can manage documents in their folders" ON public.documents FOR ALL USING (has_role(auth.uid(), 'vertriebler') AND EXISTS (SELECT 1 FROM public.folders WHERE folders.id = documents.folder_id AND (folders.assigned_to = auth.uid() OR folders.created_by = auth.uid())));

-- Storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('documents', 'documents', false);

-- Storage policies
CREATE POLICY "Users can upload documents" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'documents' AND auth.uid() IS NOT NULL);
CREATE POLICY "Users can view documents" ON storage.objects FOR SELECT USING (bucket_id = 'documents' AND auth.uid() IS NOT NULL);
CREATE POLICY "Admins can delete documents" ON storage.objects FOR DELETE USING (bucket_id = 'documents' AND has_role(auth.uid(), 'admin'));

-- Updated_at function and trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column() RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;
CREATE TRIGGER update_folders_updated_at BEFORE UPDATE ON public.folders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();