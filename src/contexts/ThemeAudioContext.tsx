import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from "react";

type EntranceOptions = {
  /** streamId (or broadcastId) used to play once per session per stream */
  streamId: string;
  /** default: true */
  enabled?: boolean;
  /** default: 0.25 */
  volume?: number;
};

interface ThemeAudioContextType {
  /**
   * Legacy API kept to avoid breaking imports/usages.
   * DOES NOTHING by default (no more home/landing auto-play).
   */
  playTheme: () => void;

  /**
   * Stops any currently playing entrance audio.
   */
  stopTheme: () => void;

  /**
   * NEW: Plays entrance fanfare ON DEMAND (broadcast listener only).
   * Plays once per streamId per sessionStorage.
   */
  playEntranceForStream: (opts: EntranceOptions) => void;
}

const ThemeAudioContext = createContext<ThemeAudioContextType | undefined>(
  undefined
);

const ENTRANCE_SRC = "/sounds/entrance/royal_fanfare.mp3";

export const ThemeAudioProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  // Track current Audio instance so we can stop/cleanup
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  const stopTheme = useCallback(() => {
    // Stop any currently playing entrance SFX
    try {
      if (cleanupRef.current) cleanupRef.current();
    } catch {
      // ignore
    } finally {
      cleanupRef.current = null;
      currentAudioRef.current = null;
    }
  }, []);

  const playEntranceForStream = useCallback(
    ({ streamId, enabled = true, volume = 0.25 }: EntranceOptions) => {
      if (!enabled) return;
      if (!streamId) return;

      const key = `entranceSfxPlayed:${streamId}`;
      if (sessionStorage.getItem(key) === "1") return;

      // Mark as played immediately to prevent double-trigger from re-renders
      sessionStorage.setItem(key, "1");

      // Stop anything already playing
      stopTheme();

      const audio = new Audio(ENTRANCE_SRC);
      audio.preload = "auto";
      audio.loop = false;
      audio.volume = Math.max(0, Math.min(1, volume));

      currentAudioRef.current = audio;

      let cancelled = false;

      const cleanup = () => {
        cancelled = true;
        try {
          audio.pause();
        } catch {
          // ignore
        }
        try {
          audio.src = "";
          audio.load();
        } catch {
          // ignore
        }
      };

      cleanupRef.current = cleanup;

      // Wait until it can actually play before seeking/playing (avoids 416 spam)
      const start = async () => {
        if (cancelled) return;

        try {
          // Safe reset only when ready
          audio.currentTime = 0;
        } catch {
          // ignore
        }

        try {
          await audio.play();
        } catch (err) {
          // Autoplay may be blocked; do not spam retries
          // If you want: show toast prompting user interaction
          console.error("Entrance audio play blocked/failed:", err);
        }
      };

      audio.addEventListener("canplaythrough", start, { once: true });

      // Fallback in case canplaythrough is never fired (rare)
      audio.addEventListener(
        "error",
        () => {
          // If it errors, allow a future retry in the same session by clearing key
          sessionStorage.removeItem(key);
        },
        { once: true }
      );

      // Kick off load
      try {
        audio.load();
      } catch {
        // ignore
      }
    },
    [stopTheme]
  );

  // Legacy function: no-op to avoid breaking code that calls it
  const playTheme = useCallback(() => {
    // Intentionally disabled. Entrance audio must only play when joining broadcast as listener.
    return;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => stopTheme();
  }, [stopTheme]);

  const contextValue = useMemo(
    () => ({
      playTheme,
      stopTheme,
      playEntranceForStream,
    }),
    [playTheme, stopTheme, playEntranceForStream]
  );

  return (
    <ThemeAudioContext.Provider value={contextValue}>
      {children}
    </ThemeAudioContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useThemeAudio = () => {
  const context = useContext(ThemeAudioContext);
  if (!context) {
    throw new Error("useThemeAudio must be used within a ThemeAudioProvider");
  }
  return context;
};
