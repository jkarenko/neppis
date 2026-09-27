// Audio unlock. Browsers only let a page play sound after a user gesture: the boot screen's tap or key calls
// unlockAudio(), which creates the context, resumes it, plays a silent buffer to warm it, and keeps it resumed when
// the tab comes back. There are no sounds yet; this is the plumbing they will plug into.
let ctx: AudioContext | null = null;

export function unlockAudio(): AudioContext | null {
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    try {
      ctx = new Ctor();
    } catch {
      return null;
    }
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && ctx?.state === 'suspended') void ctx.resume();
    });
  }
  const c = ctx;
  if (c.state === 'suspended') void c.resume();
  const src = c.createBufferSource();
  src.buffer = c.createBuffer(1, 1, 22050);
  src.connect(c.destination);
  src.start(0);
  return c;
}

export function audioContext(): AudioContext | null {
  return ctx;
}
