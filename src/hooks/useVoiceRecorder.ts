// MediaRecorder-based voice recorder.
// Web: uses native MediaRecorder API (browser prompts for mic).
// Android (Capacitor WebView): same getUserMedia path; RECORD_AUDIO permission
// granted via AndroidManifest is requested at first use by the WebView.
// Output: a single webm/opus File ready for uploadMedia().
import { useCallback, useEffect, useRef, useState } from "react";

export type RecorderState = "idle" | "requesting" | "recording" | "stopping";

interface UseVoiceRecorderOptions {
  onError?: (error: Error) => void;
}

interface UseVoiceRecorderReturn {
  state: RecorderState;
  durationMs: number;
  start: () => Promise<boolean>;
  stop: () => Promise<File | null>;
  cancel: () => void;
}

const pickMimeType = (): string => {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
  ];
  for (const m of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported?.(m)) return m;
  }
  return "";
};

export function useVoiceRecorder(opts: UseVoiceRecorderOptions = {}): UseVoiceRecorderReturn {
  const [state, setState] = useState<RecorderState>("idle");
  const [durationMs, setDurationMs] = useState(0);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const startedAtRef = useRef<number>(0);
  const tickRef = useRef<number | null>(null);
  const cancelledRef = useRef(false);
  const stopResolverRef = useRef<((file: File | null) => void) | null>(null);

  const cleanupStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (tickRef.current !== null) {
      window.clearInterval(tickRef.current);
      tickRef.current = null;
    }
  }, []);

  // Always release mic if component unmounts mid-recording.
  useEffect(() => {
    return () => {
      try { recorderRef.current?.stop(); } catch { /* ignore */ }
      cleanupStream();
    };
  }, [cleanupStream]);

  const start = useCallback(async (): Promise<boolean> => {
    if (state !== "idle") return false;
    setState("requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;

      const mimeType = pickMimeType();
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      recorderRef.current = recorder;
      chunksRef.current = [];
      cancelledRef.current = false;

      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) chunksRef.current.push(ev.data);
      };
      recorder.onstop = () => {
        const resolver = stopResolverRef.current;
        stopResolverRef.current = null;
        cleanupStream();
        if (cancelledRef.current || chunksRef.current.length === 0) {
          setState("idle");
          setDurationMs(0);
          resolver?.(null);
          return;
        }
        const type = recorder.mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type });
        const ext = type.includes("mp4") ? "m4a" : type.includes("ogg") ? "ogg" : "webm";
        const file = new File([blob], `voice-${Date.now()}.${ext}`, { type, lastModified: Date.now() });
        setState("idle");
        setDurationMs(0);
        resolver?.(file);
      };

      startedAtRef.current = Date.now();
      setDurationMs(0);
      tickRef.current = window.setInterval(() => {
        setDurationMs(Date.now() - startedAtRef.current);
      }, 100);

      recorder.start(250); // 250ms timeslice → progressive chunks for safety
      setState("recording");
      return true;
    } catch (err) {
      cleanupStream();
      setState("idle");
      opts.onError?.(err as Error);
      return false;
    }
  }, [state, cleanupStream, opts]);

  const stop = useCallback(async (): Promise<File | null> => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === "inactive") {
      cleanupStream();
      setState("idle");
      return null;
    }
    setState("stopping");
    return new Promise<File | null>((resolve) => {
      stopResolverRef.current = resolve;
      try {
        recorder.stop();
      } catch {
        cleanupStream();
        setState("idle");
        resolve(null);
      }
    });
  }, [cleanupStream]);

  const cancel = useCallback(() => {
    cancelledRef.current = true;
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      try { recorder.stop(); } catch { /* ignore */ }
    } else {
      cleanupStream();
      setState("idle");
      setDurationMs(0);
    }
  }, [cleanupStream]);

  return { state, durationMs, start, stop, cancel };
}
