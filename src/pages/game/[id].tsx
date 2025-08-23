import { useRouter } from 'next/router';
import { useGameSync } from '@/hooks/useGameSync';
import { useUnifiedGameStore } from '@/stores/unifiedGameStore';
import { useAuth } from '@/contexts/AuthContext';

export default function GamePage() {
  const router = useRouter();
  const { id: gameId } = router.query;
  const { user } = useAuth();
  
  const engine = useUnifiedGameStore(s => s.engine);
  const playAction = useUnifiedGameStore(s => s.playAction);
  
  useGameSync(gameId as string);
  
  if (!engine) {
    return <div>Loading game...</div>;
  }
  
  const handleAction = async (from: string, to: string) => {
    const nextType = engine.nextActionType();
    const action = nextType === 'move'
      ? { move: { from, to } }
      : { ban: { from, to } };
    
    await playAction(action);
  };
  
  return (
    <div>
      <h1>Game {gameId}</h1>
      <p>Turn: {engine.turn}</p>
      <p>Next: {engine.nextActionType()}</p>
      <p>FEN: {engine.fen()}</p>
      {engine.gameOver() && <p>Game Over</p>}
    </div>
  );
}