-- Knowledge Base Tabelle für Admin-verwaltete Inhalte
CREATE TABLE public.knowledge_base (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT, -- Für Texteinträge
  file_path TEXT, -- Für PDF-Dateien
  file_name TEXT,
  content_type TEXT NOT NULL DEFAULT 'text', -- 'text' oder 'pdf'
  product_type product_type, -- Optional: spezifisch für Steuern, Kredit, Baufinanzierung
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.knowledge_base ENABLE ROW LEVEL SECURITY;

-- Nur Admins können KB verwalten
CREATE POLICY "Admins can manage knowledge base"
ON public.knowledge_base
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Alle authentifizierten Nutzer können KB lesen (für KI-Nutzung)
CREATE POLICY "Authenticated users can read knowledge base"
ON public.knowledge_base
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Trigger für updated_at
CREATE TRIGGER update_knowledge_base_updated_at
BEFORE UPDATE ON public.knowledge_base
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Storage Bucket für KB PDFs
INSERT INTO storage.buckets (id, name, public) VALUES ('knowledge-base', 'knowledge-base', false);

-- Storage Policies
CREATE POLICY "Admins can upload KB files"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'knowledge-base' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update KB files"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'knowledge-base' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete KB files"
ON storage.objects
FOR DELETE
USING (bucket_id = 'knowledge-base' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can read KB files"
ON storage.objects
FOR SELECT
USING (bucket_id = 'knowledge-base' AND auth.uid() IS NOT NULL);