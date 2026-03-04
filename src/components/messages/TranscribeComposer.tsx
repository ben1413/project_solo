"use client";

import { useEffect, useMemo, useRef, useState } from 'react';

type TranscribeComposerProps = {
  disabled?: boolean;
  onCancel: () => void;
  onTranscribed: (text: string) => void;
};

type Phase = 'idle' | 'recording' | 'ready' | 'transcribing' | 'error';
const MIN_BYTES = 1200;

export const TranscribeComposer = (props: TranscribeComposerProps) => {
  const { disabled, onCancel, onTranscribed } = props;
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState<string>('');

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const blobRef = useRef<Blob | null>(null);

  // Waveform refs
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const byteDataRef = useRef<Uint8Array | null>(null);

  const canInteract = useMemo(() => !disabled && phase !== 'transcribing', [disabled, phase]);

  const stopWave = () => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    try { sourceRef.current?.disconnect(); } catch {}
    try { analyserRef.current?.disconnect(); } catch {}
    try { audioCtxRef.current?.close(); } catch {}
    sourceRef.current = null;
    analyserRef.current = null;
    audioCtxRef.current = null;
    byteDataRef.current = null;
  };

  const stopTracks = (s: MediaStream | null) => {
    try { s?.getTracks()?.forEach((t) => t.stop()); } catch {}
  };

  const hardStop = () => {
    // 1) Stop recording
    try {
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        recorderRef.current.stop();
      }
    } catch {}

    // 2) Stop streams
    stopTracks(streamRef.current);

    // 3) Kill WebAudio
    stopWave();

    // 4) Clear refs
    recorderRef.current = null;
    streamRef.current = null;
    chunksRef.current = [];
    blobRef.current = null;
  };

  const drawLoop = () => {
    const canvas = canvasRef.current;
    const analyser = analyserRef.current;
    const data = byteDataRef.current;
    if (!canvas || !analyser || !data) return;

    const dpr = window.devicePixelRatio || 1;
    const cw = canvas.clientWidth;
    const ch = canvas.clientHeight;
    canvas.width = cw * dpr;
    canvas.height = ch * dpr;

    analyser.getByteTimeDomainData(data as Uint8Array<ArrayBuffer>);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 2 * dpr;
    ctx.beginPath();

    const sliceWidth = canvas.width / data.length;
    let x = 0;
    for (let i = 0; i < data.length; i++) {
      const v = data[i] / 128.0;
      const y = (v * canvas.height) / 2;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
      x += sliceWidth;
    }
    ctx.stroke();
    rafRef.current = requestAnimationFrame(drawLoop);
  };

  const startRecording = async () => {
    setError('');
    blobRef.current = null;
    chunksRef.current = [];
    hardStop();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Setup Visualizer
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      const audioCtx = new AudioCtx();
      audioCtxRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      sourceRef.current = source;
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048;
      analyserRef.current = analyser;
      source.connect(analyser);
      byteDataRef.current = new Uint8Array(analyser.fftSize);

      const rec = new MediaRecorder(stream);
      recorderRef.current = rec;

      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };

      rec.onstop = () => {
        stopWave();
        stopTracks(streamRef.current);
        const mime = rec.mimeType || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type: mime });
        chunksRef.current = [];

        if (blob.size < MIN_BYTES) {
          setPhase('idle');
          setError('Too short.');
          return;
        }
        blobRef.current = blob;
        setPhase('ready');
      };

      setPhase('recording');
      rec.start(100);
      rafRef.current = requestAnimationFrame(drawLoop);
    } catch (e) {
      console.error('Mic Error:', e);
      setPhase('error');
      setError('Mic access denied.');
      hardStop();
    }
  };

  const transcribe = async () => {
    const blob = blobRef.current;
    if (!blob) return;
    setError('');
    setPhase('transcribing');

    try {
      const fd = new FormData();
      fd.append('audio', blob, 'audio.webm');

      const res = await fetch('/api/audio/transcribe', { method: 'POST', body: fd });
      const data = await res.json();

      if (!res.ok || !data.ok) throw new Error(data.error || 'Failed');

      onTranscribed(data.text);
      onCancel();
    } catch (e) {
      console.error('Transcribe Error:', e);
      setPhase('error');
      setError('Failed to transcribe.');
    }
  };

  const onCheck = () => {
    if (phase === 'recording') {
      recorderRef.current?.stop();
    } else if (phase === 'ready') {
      transcribe();
    } else {
      startRecording();
    }
  };

  useEffect(() => {
    startRecording();
    return () => hardStop();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only: start on mount, stop on unmount
  }, []);

  return (
    <div className="flex items-center gap-2 bg-neutral-900 rounded-full px-2 py-1 border border-neutral-800">
      <button onClick={onCancel} className="w-8 h-8 rounded-full bg-neutral-800 text-[var(--text-blue)] flex items-center justify-center hover:bg-neutral-700">×</button>

      <div className="flex-1 min-w-[120px] h-8 relative flex items-center justify-center">
        <canvas ref={canvasRef} className="w-full h-full rounded opacity-50" />
        {error && <span className="absolute text-xs text-red-400">{error}</span>}
      </div>

      <button
        onClick={onCheck}
        disabled={phase === 'transcribing' || !canInteract}
        className={`w-8 h-8 rounded-full flex items-center justify-center text-[var(--text-blue)] transition-colors ${
          phase === 'recording' ? 'bg-red-600 hover:bg-red-700' :
          phase === 'transcribing' ? 'bg-neutral-700 cursor-wait' :
          'bg-green-600 hover:bg-green-700'
        }`}
      >
        {phase === 'recording' ? '■' : phase === 'transcribing' ? '...' : '✓'}
      </button>
    </div>
  );
};
