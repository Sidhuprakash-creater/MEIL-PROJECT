import * as React from "react";

/**
 * Tracks transient user scroll/touch interruption so programmatic auto-scroll
 * yields while the user is actively inspecting history.
 */
export function useUserInterruption(durationMs = 200) {
  const interruptedRef = React.useRef(false);
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const interrupt = React.useCallback(() => {
    interruptedRef.current = true;
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      interruptedRef.current = false;
      timeoutRef.current = null;
    }, durationMs);
  }, [durationMs]);

  React.useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return { interruptedRef, interrupt };
}

