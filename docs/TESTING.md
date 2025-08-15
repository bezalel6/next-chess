# Testing Documentation

## Quick Test Game Creation

### Overview
The `/test/new-game` endpoint provides a simple way to create test games with automatic user creation and authentication.

### Usage

#### Basic Usage
Navigate to: `http://localhost:3000/test/new-game`
- Creates a new test game with two test users
- Automatically signs you in as the white player
- Redirects to the game page

#### Query Parameters

1. **Player Selection**
   - `?player=white` (default) - Play as white
   - `?player=black` - Play as black
   
2. **Start with Ban**
   - `?withBan=true` - Game starts with e2-e4 already banned by black
   
3. **Combined Examples**
   - `/test/new-game?player=black` - Play as black
   - `/test/new-game?player=white&withBan=true` - Play as white with e2-e4 banned
   - `/test/new-game?player=black&withBan=true` - Play as black with ban already made

### How It Works

1. **Test User Creation**: Creates two test users with emails:
   - `white-test-{timestamp}@test.com`
   - `black-test-{timestamp}@test.com`
   - Both use password: `test123456`

2. **Game Creation**: Creates a game with ID `test-{timestamp}`

3. **Authentication**: Automatically signs in as the selected player

4. **Redirection**: Redirects to `/game/{gameId}`

### Testing Ban Functionality

To test if ban moves update in the moves list:
1. Open two browser windows (one regular, one incognito)
2. In window 1: Navigate to `/test/new-game?player=white`
3. In window 2: Navigate to `/test/new-game?player=black` (use same timestamp/game ID)
4. Black player bans a move - verify it appears in moves list
5. Both players should see the ban in their moves list

### API Endpoint

The underlying API endpoint is at `/api/test/create-game` and accepts:
```json
{
  "playAs": "white" | "black",
  "withBan": boolean
}
```

Returns:
```json
{
  "gameId": "test-123456789",
  "email": "white-test-123456789@test.com",
  "password": "test123456",
  "whitePlayerId": "uuid",
  "blackPlayerId": "uuid",
  "message": "Test game created. You are playing as white."
}
```

### Notes
- Test games and users are real database entries
- Clean up test data periodically to avoid clutter
- Service role key required for user creation
- Only works in development environment