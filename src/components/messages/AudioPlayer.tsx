"use client";

import React, { useState, useRef, useEffect } from 'react';

// Removed autoPlay if unused, or use it if needed.
export const AudioPlayer = ({ text, autoPlay = false }: { text: string, autoPlay?: boolean }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const hasAutoPlayed = useRef(false);

  const playAudio = async () => {
    if (audioRef.current) {
      audioRef.current.play();
      setIsPlaying(true);
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('/api/audio/speech', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });

      if (!res.ok) throw new Error("TTS Failed");

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      
      const audio = new Audio(url);
      audio.onended = () => setIsPlaying(false);
      audioRef.current = audio;
      
      await audio.play();
      setIsPlaying(true);
    } catch (e) {
      console.error("Audio Playback Error:", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (autoPlay && !hasAutoPlayed.current) {
      hasAutoPlayed.current = true;
      playAudio();
    }
    
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPlay]);

  return (
    <button 
      onClick={() => playAudio()} 
      disabled={isLoading || isPlaying}
      className={`ml-2 p-1 rounded-full transition-colors ${
        isLoading ? 'opacity-50' : 
        isPlaying ? 'text-[var(--text-blue)]' : 'text-[var(--text-blue)] hover:text-[var(--text-blue)]'
      }`}
    >
      {isLoading ? (
        <span className="text-[10px] animate-pulse">●</span>
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
           <path d="M11.536 14.01A8.473 8.473 0 0 0 14.026 8a8.473 8.473 0 0 0-2.49-6.01l-.708.707A7.476 7.476 0 0 1 13.025 8c0 2.071-.84 3.946-2.197 5.303l.708.707z"/>
           <path d="M10.121 12.596A6.48 6.48 0 0 0 12.025 8a6.48 6.48 0 0 0-1.904-4.596l-.707.707A5.483 5.483 0 0 1 11.025 8a5.483 5.483 0 0 1-1.61 3.89l.706.706z"/>
           <path d="M10.025 8a4.486 4.486 0 0 1-1.318 3.182L8 10.475A3.489 3.489 0 0 0 9.025 8c0-.966-.392-1.841-1.025-2.475l.707-.707A4.486 4.486 0 0 1 10.025 8zM7 4a.5.5 0 0 0-.812-.39L3.825 5.5H1.5A.5.5 0 0 0 1 6v4a.5.5 0 0 0 .5.5h2.325l2.363 1.89A.5.5 0 0 0 7 12V4zM4.312 6.39 6 5.04v5.92L4.312 9.61A.5.5 0 0 0 4 9.5H2v-3h2a.5.5 0 0 0 .312-.11z"/>
        </svg>
      )}
    </button>
  );
};
