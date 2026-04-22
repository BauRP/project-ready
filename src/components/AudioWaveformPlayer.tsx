import { useState, useRef, useEffect, useCallback } from "react";
import { Play, Pause } from "lucide-react";

interface AudioWaveformPlayerProps {
  src: string;
  name?: string;
  sent?: boolean;
}

const BAR_COUNT = 32;
const BAR_WIDTH = 3;
const BAR_GAP = 2;
const CANVAS_HEIGHT = 36;

const AudioWaveformPlayer = ({ src, name, sent }: AudioWaveformPlayerProps) => {
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [peaks, setPeaks] = useState<number[]>([]);
  const audioRef = useRef<HTMLAudioElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);

  // Generate waveform peaks from audio data
  useEffect(() => {
    const generatePeaks = async () => {
      try {
        const response = await fetch(src);
        const arrayBuffer = await response.arrayBuffer();
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
        const channelData = audioBuffer.getChannelData(0);
        const blockSize = Math.floor(channelData.length / BAR_COUNT);
        const peakValues: number[] = [];

        for (let i = 0; i < BAR_COUNT; i++) {
          let sum = 0;
          for (let j = 0; j < blockSize; j++) {
            sum += Math.abs(channelData[i * blockSize + j]);
          }
          peakValues.push(sum / blockSize);
        }

        // Normalize
        const max = Math.max(...peakValues, 0.01);
        setPeaks(peakValues.map((p) => Math.max(0.08, p / max)));
        audioCtx.close();
      } catch {
        // Fallback: random-ish peaks for visual
        setPeaks(Array.from({ length: BAR_COUNT }, () => 0.15 + Math.random() * 0.85));
      }
    };
    generatePeaks();
  }, [src]);

  const drawWaveform = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || peaks.length === 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth;
    canvas.width = width * dpr;
    canvas.height = CANVAS_HEIGHT * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, CANVAS_HEIGHT);

    const progress = duration > 0 ? currentTime / duration : 0;

    const primaryColor = sent
      ? "hsla(0, 0%, 100%, 0.9)"
      : getComputedStyle(document.documentElement).getPropertyValue("--primary")
        ? `hsl(${getComputedStyle(document.documentElement).getPropertyValue("--primary").trim()})`
        : "#6366f1";

    const inactiveColor = sent
      ? "hsla(0, 0%, 100%, 0.3)"
      : "hsla(0, 0%, 60%, 0.3)";

    for (let i = 0; i < peaks.length; i++) {
      const x = i * (BAR_WIDTH + BAR_GAP);
      const barHeight = Math.max(4, peaks[i] * (CANVAS_HEIGHT - 4));
      const y = (CANVAS_HEIGHT - barHeight) / 2;
      const barProgress = i / peaks.length;

      ctx.fillStyle = barProgress <= progress ? primaryColor : inactiveColor;
      ctx.beginPath();
      ctx.roundRect(x, y, BAR_WIDTH, barHeight, 1.5);
      ctx.fill();
    }
  }, [peaks, currentTime, duration, sent]);

  useEffect(() => {
    drawWaveform();
  }, [drawWaveform]);

  const handlePlayPause = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
      cancelAnimationFrame(animRef.current);
    } else {
      audio.play();
      setPlaying(true);
      const tick = () => {
        setCurrentTime(audio.currentTime);
        if (!audio.paused) {
          animRef.current = requestAnimationFrame(tick);
        }
      };
      animRef.current = requestAnimationFrame(tick);
    }
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const canvasWidth = BAR_COUNT * (BAR_WIDTH + BAR_GAP);

  return (
    <div className="flex items-center gap-2.5 min-w-[200px]">
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onLoadedMetadata={(e) => setDuration((e.target as HTMLAudioElement).duration)}
        onEnded={() => {
          setPlaying(false);
          setCurrentTime(0);
          cancelAnimationFrame(animRef.current);
        }}
      />
      <button
        onClick={handlePlayPause}
        className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-colors ${
          sent ? "bg-primary-foreground/20 hover:bg-primary-foreground/30" : "bg-primary/15 hover:bg-primary/25"
        }`}
      >
        {playing ? (
          <Pause size={16} className={sent ? "text-primary-foreground" : "text-primary"} />
        ) : (
          <Play size={16} className={`${sent ? "text-primary-foreground" : "text-primary"} ml-0.5`} />
        )}
      </button>
      <div className="flex flex-col gap-1 flex-1 min-w-0">
        <canvas
          ref={canvasRef}
          width={canvasWidth}
          height={CANVAS_HEIGHT}
          className="w-full"
          style={{ height: CANVAS_HEIGHT }}
        />
        <div className="flex items-center justify-between">
          <span className={`text-[10px] ${sent ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
            {formatTime(playing ? currentTime : 0)}
          </span>
          <span className={`text-[10px] ${sent ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
            {duration > 0 ? formatTime(duration) : "--:--"}
          </span>
        </div>
      </div>
    </div>
  );
};

export default AudioWaveformPlayer;
