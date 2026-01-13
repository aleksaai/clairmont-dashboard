-- Allow all authenticated users to view all roles (needed for team visibility filtering)
DROP POLICY IF EXISTS "Users can view own role" ON public.user_roles;

CREATE POLICY "Authenticated users can view all roles" 
ON public.user_roles 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

-- Admins can still manage all roles
-- (This policy already exists, keeping it)