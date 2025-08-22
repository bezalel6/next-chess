-- Force PostgREST to reload schema cache after adding new columns
NOTIFY pgrst, 'reload schema';

