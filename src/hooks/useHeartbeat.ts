import { useEffect, useRef } from "react";
import { useAuth } from "../contexts/AuthContext";
import { invokeWithAuth } from "../utils/supabase";

const HEARTBEAT_INTERVAL = 30000; // 30 seconds

export function useHeartbeat() {
  const { session } = useAuth();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  
  useEffect(() => {
    if (!session) {
      // Clear interval if no session
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }
    
    // Send initial heartbeat
    const sendHeartbeat = async () => {
      try {
        await invokeWithAuth("heartbeat", {});
      } catch (error) {
        console.error("[Heartbeat] Failed to send heartbeat:", error);
      }
    };
    
    sendHeartbeat();
    
    // Set up periodic heartbeat
    intervalRef.current = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL);
    
    // Cleanup on unmount or session change
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [session?.user?.id]); // Re-run when user ID changes
}