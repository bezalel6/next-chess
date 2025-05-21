// hooks/useKeySequence.ts
import { useEffect, useRef } from "react";

// Special key constants for easier reference
export const Keys = {
  ArrowUp: "ArrowUp",
  ArrowDown: "ArrowDown",
  ArrowLeft: "ArrowLeft",
  ArrowRight: "ArrowRight",
  Escape: "Escape",
  Enter: "Enter",
  Space: " ",
  Tab: "Tab",
  Shift: "Shift",
  Control: "Control",
  Alt: "Alt",
} as const;

type KeySequenceCallback = (sequence: string) => void;
type KeyHandler = (e: KeyboardEvent) => void;

interface KeySequence {
  sequence: string;
  callback: KeySequenceCallback;
  timeout?: number; // in ms, default 1000
}

interface SingleKeyHandler {
  key: string;
  callback: KeyHandler;
}

export function useKeys(...sequences: KeySequence[]) {
  const bufferRef = useRef<string>("");
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Append the raw key value without toLowerCase() to preserve special keys
      bufferRef.current += e.key;

      for (const { sequence, callback } of sequences) {
        if (bufferRef.current.endsWith(sequence)) {
          callback(sequence);
          bufferRef.current = ""; // reset after match
          return;
        }
      }

      // Reset buffer after timeout
      if (timerRef.current) clearTimeout(timerRef.current);
      const maxTimeout = Math.max(...sequences.map((s) => s.timeout ?? 1000));
      timerRef.current = setTimeout(() => {
        bufferRef.current = "";
      }, maxTimeout);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [sequences]);
}

// New hook for handling individual key presses
export function useSingleKeys(...handlers: SingleKeyHandler[]) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      for (const { key, callback } of handlers) {
        if (e.key === key) {
          callback(e);
          return;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [handlers]);
}
