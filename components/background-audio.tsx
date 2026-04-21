"use client";

import { useEffect, useRef, useState } from "react";

const audioPreferencesKey = "jac-live-pulse-audio-preferences";
const defaultVolume = 0.35;

type AudioPreferences = {
  isMuted: boolean;
  isPlaying: boolean;
  volume: number;
};

function readStoredPreferences(): AudioPreferences {
  if (typeof window === "undefined") {
    return {
      isMuted: false,
      isPlaying: true,
      volume: defaultVolume
    };
  }

  const rawPreferences = window.localStorage.getItem(audioPreferencesKey);

  if (!rawPreferences) {
    return {
      isMuted: false,
      isPlaying: true,
      volume: defaultVolume
    };
  }

  try {
    const parsedPreferences = JSON.parse(rawPreferences) as Partial<AudioPreferences>;

    return {
      isMuted: parsedPreferences.isMuted ?? false,
      isPlaying: parsedPreferences.isPlaying ?? true,
      volume:
        typeof parsedPreferences.volume === "number"
          ? Math.min(Math.max(parsedPreferences.volume, 0), 1)
          : defaultVolume
    };
  } catch {
    return {
      isMuted: false,
      isPlaying: true,
      volume: defaultVolume
    };
  }
}

export function BackgroundAudio() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [volume, setVolume] = useState(defaultVolume);
  const [isMuted, setIsMuted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    const storedPreferences = readStoredPreferences();

    setVolume(storedPreferences.volume);
    setIsMuted(storedPreferences.isMuted);
    setIsPlaying(storedPreferences.isPlaying);
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (!isHydrated || typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(
      audioPreferencesKey,
      JSON.stringify({
        isMuted,
        isPlaying,
        volume
      })
    );
  }, [isHydrated, isMuted, isPlaying, volume]);

  useEffect(() => {
    const audioElement = audioRef.current;

    if (!audioElement) {
      return;
    }

    audioElement.volume = volume;
    audioElement.muted = isMuted;
  }, [isMuted, volume]);

  useEffect(() => {
    const audioElement = audioRef.current;

    if (!audioElement || !isHydrated) {
      return;
    }

    if (!isPlaying) {
      audioElement.pause();
      setAutoplayBlocked(false);
      return;
    }

    const playAudio = async () => {
      try {
        await audioElement.play();
        setAutoplayBlocked(false);
      } catch {
        setAutoplayBlocked(true);
        setIsPlaying(false);
      }
    };

    playAudio();
  }, [isHydrated, isPlaying]);

  function togglePlayback() {
    setIsPlaying((currentValue) => !currentValue);
  }

  function toggleMute() {
    setIsMuted((currentValue) => !currentValue);
  }

  function handleVolumeChange(nextVolume: number) {
    setVolume(nextVolume);

    if (nextVolume > 0 && isMuted) {
      setIsMuted(false);
    }
  }

  return (
    <>
      <audio ref={audioRef} src="/soundeffect.mp3" loop preload="auto" />

      <section className="audio-dock" aria-label="Controles de audio de fondo">
        <div className="audio-dock-main">
          <div className="audio-dock-status">
            <span className="audio-dock-label">Audio ambiente</span>
            <strong className="audio-dock-title">
              {isPlaying ? "Activo" : "En pausa"}
            </strong>
          </div>

          <div className="audio-dock-controls">
            <span className={`tag audio-level-tag ${isMuted ? "danger" : ""}`}>
              {isMuted ? "Mute" : `${Math.round(volume * 100)}%`}
            </span>
          </div>

          <button className="pill audio-pill" onClick={togglePlayback} type="button">
            {isPlaying ? "Pausa" : "Play"}
          </button>
          <button className="pill audio-pill" onClick={toggleMute} type="button">
            {isMuted ? "Audio on" : "Mute"}
          </button>

          <label className="audio-slider-group">
            <span className="muted small audio-slider-label">Volumen</span>
            <input
              aria-label="Control de volumen del audio de fondo"
              className="audio-slider"
              max="1"
              min="0"
              onChange={(event) => handleVolumeChange(Number(event.target.value))}
              step="0.01"
              type="range"
              value={volume}
            />
          </label>
        </div>

        {autoplayBlocked ? (
          <p className="audio-dock-note">
            El navegador bloqueó la reproducción automática. Usa <strong>Play</strong> para
            iniciarla manualmente.
          </p>
        ) : (
          <p className="audio-dock-note">Puedes ajustar el volumen o silenciarlo cuando quieras.</p>
        )}
      </section>
    </>
  );
}
