-- Function to look up profiles by email addresses (via auth.users join).
-- Used by the supporter intent dashboard to show Patronage profiles alongside captured emails.
CREATE OR REPLACE FUNCTION get_profiles_by_emails(emails text[])
RETURNS TABLE(email text, username text, full_name text, avatar_url text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT au.email, p.username, p.full_name, p.avatar_url
  FROM auth.users au
  JOIN public.profiles p ON p.id = au.id
  WHERE au.email = ANY(emails);
$$;
