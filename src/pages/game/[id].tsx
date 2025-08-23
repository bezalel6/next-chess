import { useRouter } from 'next/router';
import { useGameSync } from '@/hooks/useGameSync';
import { useUnifiedGameStore } from '@/stores/unifiedGameStore';
import { useAuth } from '@/contexts/AuthContext';
import SimpleBoard from '@/components/SimpleBoard';

export default function GamePage() {
  const router = useRouter();
  const { id: gameId } = router.query;
  const { user } = useAuth();
  
  const engine = useUnifiedGameStore(s => s.engine);
  const playAction = useUnifiedGameStore(s => s.playAction);
  
  useGameSync(gameId as string);
  
  if (!engine) {
    return <div style={{ padding: '20px' }}>Loading game...</div>;
  }
  
  const handleAction = async (from: string, to: string) => {
    const nextType = engine.nextActionType();
    const action = nextType === 'move'
      ? { move: { from, to } }
      : { ban: { from, to } };
    
    try {
      await playAction(action);
    } catch (error) {
      console.error('Action failed:', error);
    }
  };
  
  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <h1>Ban Chess Game</h1>
      <div style={{ marginBottom: '20px' }}>
        <p><strong>Game ID:</strong> {gameId}</p>
        <p><strong>Turn:</strong> {engine.turn === 'w' ? 'White' : 'Black'}</p>
        <p><strong>Next Action:</strong> {engine.nextActionType() === 'ban' ? 
          'Ban an opponent move' : 'Make a move'}</p>
        {engine.gameOver() && (
          <p style={{ color: 'red', fontWeight: 'bold' }}>Game Over!</p>
        )}
      </div>
      
      <SimpleBoard engine={engine} onAction={handleAction} />
      
      <div style={{ marginTop: '20px' }}>
        <details>
          <summary>FEN</summary>
          <code>{engine.fen()}</code>
        </details>
      </div>
    </div>
  );
}