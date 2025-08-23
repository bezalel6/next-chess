-- Add missing is_following function
CREATE OR REPLACE FUNCTION public.is_following(follower uuid, following uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.follows 
    WHERE follower_id = follower 
      AND following_id = following
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_following(uuid, uuid) TO anon, authenticated, service_role;