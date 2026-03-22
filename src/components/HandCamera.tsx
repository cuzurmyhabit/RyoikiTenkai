import { useCallback, useEffect, useRef, useState } from 'react';
import type { NormalizedLandmark } from '@mediapipe/tasks-vision';
import { HAND_CONNECTIONS } from '../handConnections';
import { handCenterOffset, resolveGesture } from '../gestures';
import { TECHNIQUE_CONFIG, type Technique } from '../technique';

type Props = {
  onTechnique: (t: Technique, strength: number) => void;
  onHandOffset: (o: { x: number; y: number } | null) => void;
};

const WASM_CDN =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.33/wasm';
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

export function HandCamera({ onTechnique, onHandOffset }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const landmarkerRef = useRef<
    import('@mediapipe/tasks-vision').HandLandmarker | null
  >(null);
  const lastTechRef = useRef<Technique>('idle');
  const lastStrengthRef = useRef(0);
  /** 영상처럼 안정된 제스처만 반영 (깜빡임 방지) */
  const stabRef = useRef<{
    candidate: Technique;
    count: number;
    strengthEma: number;
  }>({ candidate: 'idle', count: 0, strengthEma: 0 });
  const onTechniqueRef = useRef(onTechnique);
  const onHandOffsetRef = useRef(onHandOffset);
  onTechniqueRef.current = onTechnique;
  onHandOffsetRef.current = onHandOffset;

  useEffect(() => {
    let cancelled = false;
    const video = videoRef.current;
    if (!video) return;

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: 1280, height: 720 },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        video.srcObject = stream;
        await video.play();
      } catch (e) {
        setError(
          e instanceof Error ? e.message : '카메라를 열 수 없습니다.',
        );
        return;
      }

      try {
        const { FilesetResolver, HandLandmarker } = await import(
          '@mediapipe/tasks-vision'
        );
        const fileset = await FilesetResolver.forVisionTasks(WASM_CDN);
        const landmarker = await HandLandmarker.createFromOptions(fileset, {
          baseOptions: {
            modelAssetPath: MODEL_URL,
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          numHands: 1,
        });
        if (cancelled) {
          landmarker.close();
          return;
        }
        landmarkerRef.current = landmarker;
        setReady(true);
      } catch (e) {
        try {
          const { FilesetResolver, HandLandmarker } = await import(
            '@mediapipe/tasks-vision'
          );
          const fileset = await FilesetResolver.forVisionTasks(WASM_CDN);
          const landmarker = await HandLandmarker.createFromOptions(fileset, {
            baseOptions: {
              modelAssetPath: MODEL_URL,
              delegate: 'CPU',
            },
            runningMode: 'VIDEO',
            numHands: 1,
          });
          if (cancelled) {
            landmarker.close();
            return;
          }
          landmarkerRef.current = landmarker;
          setReady(true);
        } catch (e2) {
          setError(
            e2 instanceof Error ? e2.message : '손 인식 모델을 불러오지 못했습니다.',
          );
        }
      }
    })();

    return () => {
      cancelled = true;
      landmarkerRef.current?.close();
      landmarkerRef.current = null;
      const s = video.srcObject as MediaStream | null;
      s?.getTracks().forEach((t) => t.stop());
      video.srcObject = null;
    };
  }, []);

  const drawFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const lm = landmarkerRef.current;
    if (!video || !canvas || !lm || video.readyState < 2) return;

    const w = canvas.width;
    const h = canvas.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const result = lm.detectForVideo(video, performance.now());
    const landmarks = result.landmarks[0] as NormalizedLandmark[] | undefined;

    ctx.clearRect(0, 0, w, h);

    if (!landmarks) {
      stabRef.current = { candidate: 'idle', count: 0, strengthEma: 0 };
      onHandOffsetRef.current(null);
      if (lastTechRef.current !== 'idle') {
        lastTechRef.current = 'idle';
        lastStrengthRef.current = 0;
        onTechniqueRef.current('idle', 0);
      }
      return;
    }

    const raw = resolveGesture(landmarks);
    const s = stabRef.current;
    if (raw.technique !== s.candidate) {
      s.candidate = raw.technique;
      s.count = 1;
      s.strengthEma = raw.strength;
    } else {
      s.count += 1;
      s.strengthEma += 0.28 * (raw.strength - s.strengthEma);
    }

    const locked = s.count >= 4;
    const applied = locked ? s.candidate : lastTechRef.current;
    const color = TECHNIQUE_CONFIG[applied].skeleton;

    if (locked) {
      if (
        s.candidate !== lastTechRef.current ||
        Math.abs(s.strengthEma - lastStrengthRef.current) > 0.07
      ) {
        lastTechRef.current = s.candidate;
        lastStrengthRef.current = s.strengthEma;
        onTechniqueRef.current(s.candidate, s.strengthEma);
      }
    }

    onHandOffsetRef.current(handCenterOffset(landmarks));

    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 2.5;
    for (const [a, b] of HAND_CONNECTIONS) {
      const pa = landmarks[a];
      const pb = landmarks[b];
      ctx.beginPath();
      ctx.moveTo((1 - pa.x) * w, pa.y * h);
      ctx.lineTo((1 - pb.x) * w, pb.y * h);
      ctx.stroke();
    }
    for (const p of landmarks) {
      ctx.beginPath();
      ctx.arc((1 - p.x) * w, p.y * h, 3.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }, []);

  useEffect(() => {
    if (!ready) return;
    let id = 0;
    const loop = () => {
      drawFrame();
      id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, [ready, drawFrame]);

  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const syncSize = () => {
      const rect = video.getBoundingClientRect();
      const cw = Math.max(1, Math.round(rect.width));
      const ch = Math.max(1, Math.round(rect.height));
      canvas.width = cw;
      canvas.height = ch;
    };

    syncSize();
    const ro = new ResizeObserver(syncSize);
    ro.observe(video);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="hand-camera">
      <video
        ref={videoRef}
        className="hand-camera__video"
        playsInline
        muted
        autoPlay
      />
      <canvas ref={canvasRef} className="hand-camera__canvas" />
      {error && <div className="hand-camera__error">{error}</div>}
      {!ready && !error && (
        <div className="hand-camera__loading">손 인식 준비 중…</div>
      )}
    </div>
  );
}
