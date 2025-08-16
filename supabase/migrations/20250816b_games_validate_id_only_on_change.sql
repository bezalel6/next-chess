-- Limit validate_game_data trigger to INSERT or when id changes to avoid false positives on regular updates

DROP TRIGGER IF EXISTS validate_game_data_trigger ON public.games;
CREATE TRIGGER validate_game_data_trigger
  BEFORE INSERT OR UPDATE OF id ON public.games
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_game_data();

