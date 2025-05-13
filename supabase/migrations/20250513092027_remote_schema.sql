alter table "public"."games" drop constraint "games_banningPlayer_check";

alter table "public"."games" add constraint "games_banningplayer_check" CHECK (("banningPlayer" = ANY (ARRAY['white'::text, 'black'::text]))) not valid;

alter table "public"."games" validate constraint "games_banningplayer_check";


