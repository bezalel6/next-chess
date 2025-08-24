# Ban Chess - Multiplayer Chess with Move Banning

A real-time multiplayer chess application with a unique "ban move" mechanic. Before each move, the opponent selects one legal move to ban, forcing constant adaptation and strategic thinking.

## Features

- **Ban Chess Mechanic**: Before every move, your opponent bans one of your legal moves
- **Real-time Multiplayer**: WebSocket-based gameplay via Supabase Realtime
- **Matchmaking System**: Automatic player pairing with queue system
- **Lichess-inspired UI**: Clean, familiar interface for chess players
- **Guest Authentication**: Quick play without registration
- **Time Controls**: Server-managed chess clocks for fair play

## Tech Stack

- **Frontend**: Next.js 15, TypeScript, Material-UI
- **Backend**: Supabase (PostgreSQL, Realtime, Auth, Edge Functions)
- **Chess Logic**: ban-chess.ts library (ONLY chess library used in this project)
- **State Management**: Zustand
- **Testing**: Playwright for E2E tests
- **Animations**: Framer Motion

### Important: Chess Library Usage
This project uses **ban-chess.ts** exclusively for all chess logic. This is a custom library that implements both standard chess rules and the Ban Chess variant. Do NOT use chess.js, chess.ts, or any other chess library.

## Development

### Prerequisites

- Node.js 18+
- Bun or npm
- Supabase CLI (for local development)

### Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   ```bash
   # Copy .env.example to .env and fill in your Supabase credentials
   cp .env.example .env
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

### Available Scripts

```bash
# Development
npm run dev              # Start with Turbopack
npm run dev:local        # Start with local environment

# Code Quality
npm run lint             # Run ESLint
npm run typecheck        # TypeScript type checking
npm run format:check     # Check Prettier formatting
npm run check            # Run lint + typecheck

# Testing
npm test                 # Run E2E tests with Playwright
npm run test:ui          # Interactive test UI
npm run test:debug       # Debug mode with visible browser
npm run test:headed      # Run tests with visible browser

# Build & Deploy
npm run build            # Build for production
npm run start            # Start production server
```

## Testing

### E2E Tests

The project uses Playwright for end-to-end testing with a type-safe selector system:

- **Linker Pattern**: Type-safe test selectors shared between tests and components
- **Rate Limit Management**: Built-in delays to avoid Supabase rate limits
- **Two-Player Testing**: Simulates real multiplayer scenarios

Run tests:
```bash
# Test mode automatically enables guest authentication
npm test
```

### Test Architecture

- `__tests__/e2e/` - E2E test files
- `src/test-utils/linker.ts` - Type-safe selector definitions
- Tests run with Chrome by default, other browsers available via flags

## Project Structure

```
src/
├── components/          # React components
│   ├── LichessBoardV2.tsx    # Main game board
│   ├── QueueSystem.tsx       # Matchmaking UI
│   └── auth-form.tsx         # Authentication forms
├── contexts/           # React contexts
├── services/           # Business logic
│   ├── gameService.ts       # Game state management
│   └── matchmakingService.ts # Player matching
├── pages/              # Next.js pages
│   ├── api/            # API routes
│   └── game/[id].tsx   # Game page
├── stores/             # Zustand stores
└── test-utils/         # Testing utilities
```

## Game Rules

### Ban Chess Mechanics

1. **Turn Sequence**:
   - Opponent views all your legal moves
   - Opponent selects ONE move to ban
   - You play any remaining legal move
   - Repeat for every turn

2. **Strategic Elements**:
   - Predict which move your opponent wants to play
   - Ban their most dangerous options
   - Adapt when your preferred move is banned

3. **Time Management**:
   - Ban selection counts against your clock
   - Both players must manage time for banning AND moving

## Contributing

1. Follow the existing code style
2. Add tests for new features
3. Ensure all tests pass before submitting PR
4. Update documentation as needed

## License

[MIT License](LICENSE)