-- Create table for partner provision configurations
CREATE TABLE public.partner_provision_configs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_code text NOT NULL UNIQUE,
    provision_type text NOT NULL CHECK (provision_type IN ('fixed', 'percentage')),
    provision_value numeric NOT NULL,
    bookkeeper_fee numeric NOT NULL DEFAULT 0,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    created_by uuid REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.partner_provision_configs ENABLE ROW LEVEL SECURITY;

-- Admins can manage all configs
CREATE POLICY "Admins can manage provision configs"
ON public.partner_provision_configs
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- All authenticated users can view configs (needed for calculations)
CREATE POLICY "Authenticated users can view provision configs"
ON public.partner_provision_configs
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Create trigger for updated_at
CREATE TRIGGER update_partner_provision_configs_updated_at
BEFORE UPDATE ON public.partner_provision_configs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert existing hardcoded configurations as initial data
INSERT INTO public.partner_provision_configs (partner_code, provision_type, provision_value, bookkeeper_fee) VALUES
('CA', 'percentage', 20, 49),
('CA-Stb', 'fixed', 0, 0),
('YF', 'percentage', 50, 49),
('FDW', 'percentage', 40, 49),
('TB', 'percentage', 30, 49),
('JK', 'percentage', 50, 49),
('DKB', 'percentage', 35, 49),
('JG', 'percentage', 50, 49),
('CS', 'percentage', 50, 49),
('PB', 'percentage', 50, 49),
('ET', 'percentage', 50, 49),
('YS', 'percentage', 50, 49),
('BS', 'percentage', 50, 49),
('NS', 'percentage', 50, 49),
('GH', 'percentage', 50, 49),
('MK', 'percentage', 50, 49),
('GM', 'percentage', 50, 49),
('JP', 'percentage', 50, 49),
('AA', 'percentage', 50, 49),
('VM', 'percentage', 50, 49),
('default', 'percentage', 50, 49);