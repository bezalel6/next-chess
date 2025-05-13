// hooks/useKeySequence.ts
import { useEffect, useRef } from "react";

type KeySequenceCallback = () => void;

interface KeySequence {
  sequence: string;
  callback: KeySequenceCallback;
  timeout?: number; // in ms, default 1000
}

export function useKeys(...sequences: KeySequence[]) {
  const bufferRef = useRef<string>("");
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      bufferRef.current += e.key.toLowerCase();

      for (const { sequence, callback } of sequences) {
        if (bufferRef.current.endsWith(sequence)) {
          callback();
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
