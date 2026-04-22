import { nukeAllData } from "./storage";
import { destroyPeer } from "./p2p";

let panicActive = false;

export async function executePanic(): Promise<void> {
  if (panicActive) return;
  panicActive = true;

  try {
    destroyPeer();
    await nukeAllData();
    window.location.replace("/");
  } catch {
    window.location.replace("/");
  }
}

export function createPanicLongPress(onPanic: () => void) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const HOLD_DURATION = 3000;

  const start = () => {
    timer = setTimeout(() => {
      onPanic();
    }, HOLD_DURATION);
  };

  const cancel = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  };

  return {
    onTouchStart: start,
    onTouchEnd: cancel,
    onTouchCancel: cancel,
    onMouseDown: start,
    onMouseUp: cancel,
    onMouseLeave: cancel,
  };
}
