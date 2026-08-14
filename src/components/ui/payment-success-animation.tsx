import { useCallback, useEffect, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import paymentSuccessVideo from '@/assets/payment-success.mp4';

/**
 * How long the fallback success state stays visible before completing.
 */
const FALLBACK_HOLD_MS = 1400;

/**
 * If playback has not started within this window (autoplay blocked, slow
 * decode, etc.) we switch to the lightweight fallback success state.
 */
const START_TIMEOUT_MS = 3500;

/**
 * Absolute safety net: the user is never allowed to be stuck on this screen,
 * even if the browser never emits the video `ended` event.
 */
const MAX_TOTAL_MS = 9000;

/**
 * Duration of the white fade-in (on mount) and white fade-out (before
 * completing), in milliseconds.
 */
const FADE_MS = 500;

interface PaymentSuccessAnimationProps {
  /** Overridable video source; defaults to the bundled payment-success asset. */
  src?: string;
  /** Invoked exactly once when the animation finishes (or gracefully falls back). */
  onComplete: () => void;
  className?: string;
}

type Phase = 'video' | 'fallback';

/**
 * Full-screen payment success animation. Plays the bundled 9:16 video once on a
 * clean white background, fading in from white at the start and fading out to
 * white before completing. The video fills the screen on portrait devices
 * (object-cover) and stays contained on landscape screens so the artwork is
 * never badly cropped. Sound plays when the browser allows it (the video has a
 * small audio track); if autoplay with sound is blocked, it retries muted so
 * the animation still finishes. Degrades gracefully to a minimal success state
 * when the video cannot load, autoplay is rejected, or reduced motion is
 * preferred, and always completes within a hard timeout so the user is never
 * trapped.
 */
export function PaymentSuccessAnimation({
  src = paymentSuccessVideo,
  onComplete,
  className,
}: PaymentSuccessAnimationProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const doneRef = useRef(false);
  const exitStartedRef = useRef(false);
  const [phase, setPhase] = useState<Phase>(() =>
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ? 'fallback'
      : 'video'
  );
  const [portrait] = useState(() =>
    typeof window !== 'undefined'
      ? window.matchMedia('(orientation: portrait)').matches
      : true
  );
  const [whiteVisible, setWhiteVisible] = useState(true);

  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const complete = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    onCompleteRef.current();
  }, []);

  // Graceful exit: fade the white layer back in, then complete after the fade.
  const exit = useCallback(() => {
    if (exitStartedRef.current || doneRef.current) return;
    exitStartedRef.current = true;
    setWhiteVisible(true);
    window.setTimeout(complete, FADE_MS);
  }, [complete]);

  const enterFallback = useCallback(() => {
    if (doneRef.current || exitStartedRef.current) return;
    setPhase((prev) => (prev === 'video' ? 'fallback' : prev));
  }, []);

  // White fade-in on mount.
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      window.setTimeout(() => setWhiteVisible(false), 50);
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  // Fallback phase: show the static success state briefly, then fade out.
  useEffect(() => {
    if (phase !== 'fallback') return;
    const timer = window.setTimeout(exit, FALLBACK_HOLD_MS);
    return () => window.clearTimeout(timer);
  }, [phase, exit]);

  // Video phase: autoplay (with sound when allowed), listen for the real
  // `ended` event, and fall back if playback cannot start or never ends.
  useEffect(() => {
    if (phase !== 'video') return;
    const video = videoRef.current;
    if (!video) return;

    const handleEnded = () => exit();
    const handleError = () => enterFallback();
    let playbackStarted = false;
    const handlePlaying = () => {
      playbackStarted = true;
    };

    video.addEventListener('ended', handleEnded);
    video.addEventListener('error', handleError);
    video.addEventListener('playing', handlePlaying);

    const attemptPlay = () => {
      video.muted = false;
      const promise = video.play();
      if (promise && typeof promise.catch === 'function') {
        promise.catch(() => {
          // Autoplay with sound was blocked — retry muted so we never stall.
          video.muted = true;
          const retry = video.play();
          if (retry && typeof retry.catch === 'function') {
            retry.catch(() => enterFallback());
          }
        });
      }
    };

    attemptPlay();

    const startFallbackTimer = window.setTimeout(() => {
      if (!playbackStarted && !doneRef.current && !exitStartedRef.current) {
        enterFallback();
      }
    }, START_TIMEOUT_MS);

    const durationMs = Number.isFinite(video.duration) ? video.duration * 1000 : 0;
    const hardCapTimer = window.setTimeout(exit, Math.max(MAX_TOTAL_MS, durationMs + 5000));

    return () => {
      video.removeEventListener('ended', handleEnded);
      video.removeEventListener('error', handleError);
      video.removeEventListener('playing', handlePlaying);
      window.clearTimeout(startFallbackTimer);
      window.clearTimeout(hardCapTimer);
      video.pause();
    };
  }, [phase, exit, enterFallback]);

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'fixed inset-0 z-50 flex items-center justify-center bg-white overflow-hidden',
        className
      )}
    >
      <span className="sr-only">Payment successful</span>
      {phase === 'video' ? (
        <video
          ref={videoRef}
          src={src}
          className={cn(
            'h-full w-full',
            portrait ? 'object-cover' : 'object-contain'
          )}
          autoPlay
          playsInline
          loop={false}
          preload="auto"
          controls={false}
          disablePictureInPicture
          aria-hidden="true"
        />
      ) : (
        <div className="flex flex-col items-center justify-center gap-4 px-6 text-center">
          <div className="flex items-center justify-center w-20 h-20 rounded-full bg-success/10">
            <div className="flex items-center justify-center w-14 h-14 rounded-full bg-success">
              <Check className="w-8 h-8 text-success-foreground" strokeWidth={2.5} />
            </div>
          </div>
          <p className="text-sm font-medium text-foreground">Payment successful</p>
          <p className="text-xs text-muted-foreground">Opening your order bill…</p>
        </div>
      )}
      {/* White fade layer (in on mount, out before completing). */}
      <div
        aria-hidden="true"
        className={cn(
          'absolute inset-0 bg-white pointer-events-none transition-opacity duration-500',
          whiteVisible ? 'opacity-100' : 'opacity-0'
        )}
      />
    </div>
  );
}
