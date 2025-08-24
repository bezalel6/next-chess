import { useRouter } from 'next/router';
import { useGameSync } from '@/hooks/useGameSync';
import { useUnifiedGameStore } from '@/stores/unifiedGameStore';
import { useAuth } from '@/contexts/AuthContext';
// SimpleBoard removed - will be replaced with proper board

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
    console.log('handleAction called:', from, '->', to);
    const nextType = engine.nextActionType();
    const action = nextType === 'move'
      ? { move: { from, to } }
      : { ban: { from, to } };
    
    console.log('Sending action to server:', action);
    try {
      await playAction(action);
      console.log('Action sent successfully');
    } catch (error) {
      console.error('Action failed:', error);
    }
  };
  
  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <h1>Ban Chess Game</h1>
      <div style={{ marginBottom: '20px' }}>
        <p><strong>Game ID:</strong> {gameId}</p>
        <p><strong>Turn:</strong> {engine.turn === 'white' ? 'White' : 'Black'}</p>
        <p><strong>Next Action:</strong> {engine.nextActionType() === 'ban' ? 
          'Ban an opponent move' : 'Make a move'}</p>
        {engine.gameOver() && (
          <p style={{ color: 'red', fontWeight: 'bold' }}>Game Over!</p>
        )}
      </div>
      
      <div style={{ 
        padding: '20px', 
        border: '2px solid #ccc',
        borderRadius: '4px',
        backgroundColor: '#f5f5f5'
      }}>
        <p>Board component will be restored here</p>
        <p>Current FEN: {engine.fen()}</p>
      </div>
      
      <div style={{ marginTop: '20px' }}>
        <details>
          <summary>FEN</summary>
          <code>{engine.fen()}</code>
        </details>
      </div>
    </div>
  );
}