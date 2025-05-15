# Simplified Chess Application Database Schema

## Overview

This document outlines the simplified database schema for our chess application. The design focuses on minimal tables with clear relationships to reduce complexity while maintaining all needed functionality.

## Core Tables

### profiles

Stores user profile information.

| Column     | Type      | Description                        |
| ---------- | --------- | ---------------------------------- |
| id         | uuid      | Primary key, references auth.users |
| username   | text      | User's display name                |
| created_at | timestamp | When profile was created           |
| updated_at | timestamp | When profile was last updated      |

### games

Stores all chess game data.

| Column             | Type      | Description                                  |
| ------------------ | --------- | -------------------------------------------- |
| id                 | uuid      | Primary key                                  |
| white_player_id    | uuid      | References profiles.id                       |
| black_player_id    | uuid      | References profiles.id                       |
| status             | text      | Game status: 'active', 'finished'            |
| result             | text      | Game result: 'white', 'black', 'draw', null  |
| current_fen        | text      | Current FEN board position                   |
| pgn                | text      | Game PGN notation                            |
| turn               | text      | Current turn: 'white', 'black'               |
| last_move          | jsonb     | Last move made                               |
| banning_player     | text      | Player allowed to ban next move (nullable)   |
| draw_offered_by    | text      | Player who offered draw (nullable)           |
| rematch_offered_by | text      | Player who offered rematch (nullable)        |
| end_reason         | text      | Reason game ended (nullable)                 |
| parent_game_id     | uuid      | References games.id for rematches (nullable) |
| created_at         | timestamp | When game was created                        |
| updated_at         | timestamp | When game was last updated                   |

### matchmaking

Stores matchmaking queue information.

| Column      | Type      | Description                        |
| ----------- | --------- | ---------------------------------- |
| id          | uuid      | Primary key                        |
| player_id   | uuid      | References profiles.id             |
| status      | text      | Queue status: 'waiting', 'matched' |
| preferences | jsonb     | Player preferences (nullable)      |
| joined_at   | timestamp | When player joined queue           |

## Indexes

```sql
-- Game indexes
CREATE INDEX idx_games_white_player ON games(white_player_id);
CREATE INDEX idx_games_black_player ON games(black_player_id);
CREATE INDEX idx_games_status ON games(status);
CREATE INDEX idx_games_active_players ON games(white_player_id, black_player_id) WHERE status = 'active';

-- Matchmaking indexes
CREATE INDEX idx_matchmaking_status ON matchmaking(status);
CREATE INDEX idx_matchmaking_player ON matchmaking(player_id);
```

## Triggers and Functions

```sql
-- Auto-update updated_at on games
CREATE TRIGGER set_games_updated_at
BEFORE UPDATE ON games
FOR EACH ROW
EXECUTE PROCEDURE set_updated_at();

-- Notify players of game updates
CREATE TRIGGER notify_game_update
AFTER UPDATE ON games
FOR EACH ROW
EXECUTE PROCEDURE notify_game_change();

-- Match players in queue
CREATE FUNCTION match_players() RETURNS void AS $$
BEGIN
  -- Logic to match waiting players
END;
$$ LANGUAGE plpgsql;
```

## Security Policies

```sql
-- Game access limited to participants
CREATE POLICY game_participant_access ON games
  USING (auth.uid() = white_player_id OR auth.uid() = black_player_id);

-- Users can only view/update their own profile
CREATE POLICY profile_owner_access ON profiles
  USING (auth.uid() = id);

-- Matchmaking queue entries only viewable by the player
CREATE POLICY matchmaking_player_access ON matchmaking
  USING (auth.uid() = player_id);
```

## Notes

1. The original complex structure with separate notifications and move history tables has been simplified
2. Game state is consolidated in a single table with clear indexes
3. Matchmaking is separated for simpler queue management
4. Security is enforced via RLS policies
