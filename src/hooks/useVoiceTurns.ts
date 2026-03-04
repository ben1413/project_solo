'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { registerMicStream, unregisterMicStream } from '@/lib/media/micRegistry';

type VoiceTurnState = 'idle' | 'recording' | 'processing' | 'speaking';

export type UseVoiceTurnsArgs = {
  isInputReadOnly: boolean;
  onVoiceSubmit?: (args: { audio: Blob; voice: string }) => Promise<void> | void;
  voice?: string;
  debug?: boolean;
};

function pickMimeType() {
  const candidates = ['audio/webm;codecs=opus', 'audio/webm'];
  for (const c of candidates) {
    try {
      if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(c)) return c;
    } catch {}
  }
  return '';
}

export function useVoiceTurns(args: UseVoiceTurnsArgs) {
  const { isInputReadOnly, onVoiceSubmit, voice = 'alloy' } = args;

  const [voiceSessionOn, setVoiceSessionOn] = useState(false);
  const voiceSessionOnRef = useRef(false);
  const [voiceTurnState, setVoiceTurnState] = useState<VoiceTurnState>('idle');
  const voiceTurnStateRef = useRef<VoiceTurnState>('idle');
  const [humanWaveLevel, setHumanWaveLevel] = useState(0);

  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const rafRef = useRef<number | null>(null);
  
  const startedAtRef = useRef<number>(0);
  const silenceMsRef = useRef<number>(0);
  const heardSpeechRef = useRef(false);
  
  // MUTEX: Prevents double-firing
  const isProcessingRef = useRef(false);
  const abortTurnRef = useRef(false);
  const startTurnRef = useRef<null | (() => void)>(null);
  
  const mimeType = pickMimeType();

  useEffect(() => { voiceSessionOnRef.current = voiceSessionOn; }, [voiceSessionOn]);
  useEffect(() => { voiceTurnStateRef.current = voiceTurnState; }, [voiceTurnState]);

  const fullTeardown = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    try { mediaRecorderRef.current?.stop(); } catch {}
    mediaRecorderRef.current = null;
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(t => t.stop());
      unregisterMicStream(mediaStreamRef.current);
    }
    mediaStreamRef.current = null;
    try { audioCtxRef.current?.close(); } catch {}
    audioCtxRef.current = null;
    analyserRef.current = null;
    sourceRef.current = null;
    setHumanWaveLevel(0);
  }, []);

  const stopRecordingButKeepMic = useCallback(() => {
    const r = mediaRecorderRef.current;
    if (r && r.state !== 'inactive') {
      try { r.stop(); } catch {}
    }
  }, []);

  const getRms = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser) return 0;
    const buf = new Uint8Array(analyser.fftSize);
    analyser.getByteTimeDomainData(buf);
    let sum = 0;
    for (let i = 0; i < buf.length; i++) {
      const v = (buf[i] - 128) / 128;
      sum += v * v;
    }
    return Math.sqrt(sum / buf.length);
  }, []);

  const startVoiceTurnRecording = useCallback(async () => {
    if (!voiceSessionOnRef.current || isInputReadOnly || !onVoiceSubmit || isProcessingRef.current) return;

    try {
      setVoiceTurnState('recording');
      startedAtRef.current = Date.now();
      silenceMsRef.current = 0;
      chunksRef.current = [];
      heardSpeechRef.current = false;
      abortTurnRef.current = false;
      isProcessingRef.current = false;

      if (!mediaStreamRef.current) {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } 
        });
        mediaStreamRef.current = stream;
        registerMicStream(stream);

        const w = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
        const AudioCtx = w.AudioContext || w.webkitAudioContext;
        if (AudioCtx) {
          const ctx = new AudioCtx();
          audioCtxRef.current = ctx;
          const src = ctx.createMediaStreamSource(stream);
          sourceRef.current = src;
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 256; 
          analyser.smoothingTimeConstant = 0.1; 
          analyserRef.current = analyser;
          src.connect(analyser);
        }
      }

      const rec = new MediaRecorder(mediaStreamRef.current, { mimeType });
      mediaRecorderRef.current = rec;

      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };

      rec.onstop = async () => {
        // 1. ABORT CHECK
        if (abortTurnRef.current) {
            setVoiceTurnState('idle');
            return;
        }

        // 2. PROCESSING CHECK (Prevent Double Tap)
        if (isProcessingRef.current) return;
        isProcessingRef.current = true;

        const blob = new Blob(chunksRef.current, { type: mimeType });
        const duration = Date.now() - startedAtRef.current;

        // 3. HALLUCINATION FILTER
        // If detection wasn't strong OR clip is super short, discard.
        if (!heardSpeechRef.current || duration < 600 || blob.size < 3000) {
           console.log("Ignored audio: too short/quiet");
           isProcessingRef.current = false; // Release lock
           setVoiceTurnState('idle');
           window.setTimeout(() => { if (voiceSessionOnRef.current) startTurnRef.current?.(); }, 200);
           return;
        }

        try {
          setVoiceTurnState('processing');
          await onVoiceSubmit({ audio: blob, voice });
        } catch (err) {
          console.error(err);
        } finally {
          isProcessingRef.current = false; // Release lock
          setVoiceTurnState('idle');
          window.setTimeout(() => { if (voiceSessionOnRef.current) startTurnRef.current?.(); }, 200);
        }
      };

      rec.start(200); 

      // HIGHER THRESHOLD = LESS HALLUCINATION
      const SILENCE_THRESHOLD = 0.03; 
      const SILENCE_STOP_MS = 2000;   
      const MIN_RECORD_MS = 800;

      const loop = () => {
        if (!voiceSessionOnRef.current) return;

        const rms = getRms();
        
        let rawHeight = rms * 12; 
        if (rawHeight > 1) rawHeight = 1; 
        setHumanWaveLevel(rawHeight);

        if (voiceTurnStateRef.current === 'recording') {
            if (rms >= SILENCE_THRESHOLD) {
              heardSpeechRef.current = true;
              silenceMsRef.current = 0;
            } else if (heardSpeechRef.current) {
              silenceMsRef.current += 16; 
            }

            const elapsed = Date.now() - (startedAtRef.current || Date.now());
            if (heardSpeechRef.current && elapsed >= MIN_RECORD_MS && silenceMsRef.current >= SILENCE_STOP_MS) {
              stopRecordingButKeepMic();
              return;
            }
        }
        rafRef.current = requestAnimationFrame(loop);
      };
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(loop);

    } catch (err) {
      console.error(err);
      fullTeardown();
      setVoiceSessionOn(false);
      setVoiceTurnState('idle');
    }
  }, [isInputReadOnly, onVoiceSubmit, voice, mimeType, fullTeardown, stopRecordingButKeepMic, getRms]);

  useEffect(() => {
    startTurnRef.current = () => { void startVoiceTurnRecording(); };
  }, [startVoiceTurnRecording]);

  const startVoiceConversation = useCallback(() => {
    if (isInputReadOnly || !onVoiceSubmit || voiceSessionOnRef.current) return;
    setVoiceSessionOn(true);
    setVoiceTurnState('idle');
    window.setTimeout(() => { if (voiceSessionOnRef.current) startTurnRef.current?.(); }, 50);
  }, [isInputReadOnly, onVoiceSubmit]);

  const stopVoiceConversation = useCallback(() => {
    abortTurnRef.current = true;
    setVoiceSessionOn(false);
    fullTeardown();
    setVoiceTurnState('idle');
  }, [fullTeardown]);

  useEffect(() => {
    return () => { try { fullTeardown(); } catch {} };
  }, [fullTeardown]);

  return { voiceSessionOn, voiceTurnState, humanWaveLevel, startVoiceConversation, stopVoiceConversation };
}
