import { useCallback } from 'react';
import { useUnifiedGameStore } from '@/stores/unifiedGameStore';
import { useNotification } from '@/contexts/NotificationContext';

export function useGameActions() {
  const actions = useUnifiedGameStore(s => s.actions);
  const { notify, notifyError, notifySuccess } = useNotification();

  const resign = useCallback(async () => {
    try {
      await actions.resign();
      notifySuccess('You have resigned from the game');
    } catch (error) {
      notifyError('Failed to resign. Please try again.');
      console.error('Resign error:', error);
    }
  }, [actions, notifySuccess, notifyError]);

  const offerDraw = useCallback(async () => {
    try {
      await actions.offerDraw();
      notify('Draw offer sent to opponent', 'info');
    } catch (error) {
      notifyError('Failed to offer draw. Please try again.');
      console.error('Offer draw error:', error);
    }
  }, [actions, notify, notifyError]);

  const acceptDraw = useCallback(async () => {
    try {
      await actions.acceptDraw();
      notifySuccess('Draw accepted. Game ended.');
    } catch (error) {
      notifyError('Failed to accept draw. Please try again.');
      console.error('Accept draw error:', error);
    }
  }, [actions, notifySuccess, notifyError]);

  const declineDraw = useCallback(async () => {
    try {
      await actions.declineDraw();
      notify('Draw offer declined', 'info');
    } catch (error) {
      notifyError('Failed to decline draw. Please try again.');
      console.error('Decline draw error:', error);
    }
  }, [actions, notify, notifyError]);

  const offerRematch = useCallback(async () => {
    try {
      await actions.offerRematch();
      notify('Rematch offer sent to opponent', 'info');
    } catch (error) {
      notifyError('Failed to offer rematch. Please try again.');
      console.error('Offer rematch error:', error);
    }
  }, [actions, notify, notifyError]);

  const acceptRematch = useCallback(async () => {
    try {
      notify('Starting new game...', 'info');
      await actions.acceptRematch();
      // acceptRematch redirects to new game
    } catch (error) {
      notifyError('Failed to accept rematch. Please try again.');
      console.error('Accept rematch error:', error);
    }
  }, [actions, notify, notifyError]);

  const declineRematch = useCallback(async () => {
    try {
      await actions.declineRematch();
      notify('Rematch offer declined', 'info');
    } catch (error) {
      notifyError('Failed to decline rematch. Please try again.');
      console.error('Decline rematch error:', error);
    }
  }, [actions, notify, notifyError]);

  return {
    resign,
    offerDraw,
    acceptDraw,
    declineDraw,
    offerRematch,
    acceptRematch,
    declineRematch,
    resetGame: actions.resetGame,
    startLocalGame: actions.startLocalGame,
    flipBoardOrientation: actions.flipBoardOrientation,
  };
}