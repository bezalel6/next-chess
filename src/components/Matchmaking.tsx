import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/contexts/AuthContext';
import { GameService } from '@/services/gameService';
import { supabase } from '@/utils/supabase';

export default function Matchmaking() {
  const [inQueue, setInQueue] = useState(false);
  const [searching, setSearching] = useState(false);
  const [timeInQueue, setTimeInQueue] = useState(0);
  const { user } = useAuth();
  const router = useRouter();
  
  useEffect(() => {
    if (!user) return;
    
    // Check if already in queue
    GameService.checkMatchmakingStatus().then(status => {
      if (status) {
        setInQueue(true);
        setSearching(true);
      }
    });
  }, [user]);
  
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (searching) {
      interval = setInterval(() => {
        setTimeInQueue(prev => prev + 1);
      }, 1000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [searching]);
  
  useEffect(() => {
    if (!searching || !user) return;
    
    // Subscribe to player channel for game match notifications
    const channel = supabase
      .channel(`player:${user.id}`)
      .on('broadcast', { event: 'game_matched' }, (payload) => {
        // Game matched via matchmaking
        if (payload.payload?.gameId) {
          router.push(`/game/${payload.payload.gameId}`);
        }
      })
      .subscribe();
    
    return () => {
      supabase.removeChannel(channel);
    };
  }, [searching, user, router]);
  
  const handleFindGame = async () => {
    if (!user) {
      alert('Please sign in to play');
      return;
    }
    
    setSearching(true);
    setInQueue(true);
    setTimeInQueue(0);
    
    try {
      // Call matchmaking edge function to join queue
      const response = await supabase.functions.invoke('matchmaking', {
        body: { operation: 'joinQueue' }
      });
      
      if (response.data?.matchFound) {
        // Immediate match found
        router.push(`/game/${response.data.game.id}`);
      }
    } catch (error) {
      console.error('Failed to join queue:', error);
      setSearching(false);
      setInQueue(false);
    }
  };
  
  const handleCancel = async () => {
    setSearching(false);
    setInQueue(false);
    setTimeInQueue(0);
    
    try {
      // Call matchmaking edge function to leave queue
      await supabase.functions.invoke('matchmaking', {
        body: { operation: 'leaveQueue' }
      });
    } catch (error) {
      console.error('Failed to leave queue:', error);
    }
  };
  
  
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  if (!user) {
    return (
      <div style={{
        padding: '40px',
        textAlign: 'center',
        backgroundColor: '#f5f5f5',
        borderRadius: '8px',
      }}>
        <h2>Sign in to Play</h2>
        <p>Create an account or sign in to start playing Ban Chess</p>
      </div>
    );
  }
  
  if (searching) {
    return (
      <div style={{
        padding: '40px',
        textAlign: 'center',
        backgroundColor: '#f5f5f5',
        borderRadius: '8px',
      }}>
        <h2>Finding Opponent...</h2>
        <div style={{ fontSize: '48px', margin: '20px 0' }}>♟️</div>
        <p>Time in queue: {formatTime(timeInQueue)}</p>
        <button
          onClick={handleCancel}
          style={{
            marginTop: '20px',
            padding: '10px 30px',
            fontSize: '16px',
            backgroundColor: '#dc3545',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          Cancel
        </button>
      </div>
    );
  }
  
  return (
    <div style={{
      padding: '40px',
      textAlign: 'center',
      backgroundColor: '#f5f5f5',
      borderRadius: '8px',
    }}>
      <h2>Play Ban Chess</h2>
      <p style={{ marginBottom: '30px' }}>
        In Ban Chess, before each move, you ban one of your opponent's legal moves!
      </p>
      <button
        onClick={handleFindGame}
        style={{
          padding: '15px 40px',
          fontSize: '18px',
          backgroundColor: '#28a745',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          fontWeight: 'bold',
        }}
      >
        Find Game
      </button>
      <div style={{ marginTop: '20px', color: '#666' }}>
        <small>10+0 • Rated</small>
      </div>
    </div>
  );
}