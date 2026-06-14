"use client";

import { useEffect, useRef, useState, useCallback } from "react";

const PREF_KEY = "mianan.smart_stop_enabled";
const HIDDEN_THRESHOLD_MS = 60 * 1000;        // page hidden for at least 1 minute
const INACTIVITY_THRESHOLD_MS = 3 * 60 * 1000; // no touch / click / key in last 3 minutes

export type SleepInferenceState = {
  enabled: boolean;
  setEnabled: (next: boolean) => void;
  shouldAutoStop: () => boolean;
};

/**
 * L3 simplified sleep inference.
 *
 * Heuristic — at chapter end, if BOTH:
 *   - document has been hidden for ≥ 1 min (e.g. screen locked / app backgrounded), and
 *   - user has not interacted (touch/click/key) for ≥ 3 min
 * → infer the user has fallen asleep and stop instead of auto-advancing.
 *
 * Defaults to enabled; user can toggle in the player.
 * Toggle is persisted to localStorage.
 */
export function useSleepInference(): SleepInferenceState {
  const [enabled, setEnabledState] = useState<boolean>(true);
  const lastInteractionAt = useRef<number>(Date.now());
  const hiddenSince = useRef<number | null>(
    typeof document !== "undefined" && document.hidden ? Date.now() : null,
  );

  // Load persisted preference once.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(PREF_KEY);
      if (raw === "0") setEnabledState(false);
      else if (raw === "1") setEnabledState(true);
    } catch {
      // ignore (e.g. private mode)
    }
  }, []);

  const setEnabled = useCallback((next: boolean) => {
    setEnabledState(next);
    try {
      window.localStorage.setItem(PREF_KEY, next ? "1" : "0");
    } catch {
      // ignore
    }
  }, []);

  // Track visibility transitions.
  useEffect(() => {
    if (typeof document === "undefined") return;
    function onVisibilityChange() {
      if (document.hidden) {
        if (hiddenSince.current === null) hiddenSince.current = Date.now();
      } else {
        hiddenSince.current = null;
        // Coming back to visible counts as interaction.
        lastInteractionAt.current = Date.now();
      }
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, []);

  // Track user interactions.
  useEffect(() => {
    if (typeof window === "undefined") return;
    function bump() {
      lastInteractionAt.current = Date.now();
    }
    const opts: AddEventListenerOptions = { passive: true };
    window.addEventListener("pointerdown", bump, opts);
    window.addEventListener("keydown", bump, opts);
    window.addEventListener("touchstart", bump, opts);
    window.addEventListener("scroll", bump, opts);
    return () => {
      window.removeEventListener("pointerdown", bump, opts);
      window.removeEventListener("keydown", bump, opts);
      window.removeEventListener("touchstart", bump, opts);
      window.removeEventListener("scroll", bump, opts);
    };
  }, []);

  const shouldAutoStop = useCallback((): boolean => {
    if (!enabled) return false;
    const now = Date.now();
    const hidden = hiddenSince.current;
    if (hidden === null) return false;
    if (now - hidden < HIDDEN_THRESHOLD_MS) return false;
    if (now - lastInteractionAt.current < INACTIVITY_THRESHOLD_MS) return false;
    return true;
  }, [enabled]);

  return { enabled, setEnabled, shouldAutoStop };
}
