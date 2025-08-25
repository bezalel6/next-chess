import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { handleGameOperation } from "../_shared/game-handlers.ts";

serve(handleGameOperation);
