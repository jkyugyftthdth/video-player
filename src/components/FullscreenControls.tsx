import { Minimize, Pause, Play, SkipBack, SkipForward, Volume2, VolumeX } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { formatDuration } from '@/src/utils/format';

interface Props {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  muted: boolean;
  title: string;
  onTogglePlayPause: () => void;
  onSeek: (sec: number) => void;
  onNext: () => void;
  onPrev: () => void;
  onChangeVolume: (v: number) => void;
  onToggleMute: () => void;
  onExit: () => void;
}

/** VLC-style fullscreen controls: hidden until the mouse moves, auto-hide with the cursor after 2.5 s. */
export function FullscreenControls(p: Props) {
  const [visible, setVisible] = useState(true);
  const [hover, setHover] = useState(false);
  const timer = useRef<number | null>(null);

  const wake = useCallback(() => {
    setVisible(true);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setVisible(false), 2500);
  }, []);

  useEffect(() => {
    wake();
    window.addEventListener('mousemove', wake);
    window.addEventListener('keydown', wake);
    return () => {
      window.removeEventListener('mousemove', wake);
      window.removeEventListener('keydown', wake);
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [wake]);

  const show = visible || hover || !p.isPlaying;
  useEffect(() => {
    document.documentElement.classList.toggle('vp-hide-cursor', !show);
    return () => document.documentElement.classList.remove('vp-hide-cursor');
  }, [show]);
  const dur = p.duration > 0 ? p.duration : 1;
  const pct = Math.min(100, Math.max(0, (p.currentTime / dur) * 100));
  const btn = 'w-10 h-10 rounded-full flex items-center justify-center text-white hover:bg-white/15 transition-colors';

  return (
    <div
      className="absolute inset-0 pointer-events-none"
    >
      <div
        className={`absolute top-0 inset-x-0 px-6 py-4 bg-gradient-to-b from-black/70 to-transparent text-white text-[15px] font-medium truncate transition-opacity duration-300 ${show ? 'opacity-100' : 'opacity-0'}`}
      >
        {p.title}
      </div>
      <div
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onClick={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
        className={`absolute bottom-0 inset-x-0 px-6 pb-5 pt-12 bg-gradient-to-t from-black/80 to-transparent transition-opacity duration-300 ${show ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
      >
        <div className="flex items-center gap-3">
          <span className="text-[12px] font-mono-tabular text-white/90 w-12 text-right">{formatDuration(p.currentTime)}</span>
          <input
            type="range"
            min={0}
            max={dur}
            step={0.25}
            value={Math.min(p.currentTime, dur)}
            onChange={(e) => p.onSeek(Number(e.target.value))}
            aria-label="Seek"
            style={{ background: `linear-gradient(to right, #fff ${pct}%, rgba(255,255,255,0.3) ${pct}%)` }}
            className="fluent-slider flex-1 h-1 rounded-full"
          />
          <span className="text-[12px] font-mono-tabular text-white/90 w-12">{formatDuration(dur)}</span>
        </div>
        <div className="mt-2 flex items-center justify-between">
          <div className="flex items-center gap-1">
            <button type="button" className={btn} onClick={p.onPrev} aria-label="Previous"><SkipBack size={18} className="fill-current" /></button>
            <button type="button" className={btn} onClick={p.onTogglePlayPause} aria-label={p.isPlaying ? 'Pause' : 'Play'}>
              {p.isPlaying ? <Pause size={20} className="fill-current" /> : <Play size={20} className="fill-current ml-0.5" />}
            </button>
            <button type="button" className={btn} onClick={p.onNext} aria-label="Next"><SkipForward size={18} className="fill-current" /></button>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" className={btn} onClick={p.onToggleMute} aria-label="Mute">
              {p.muted || p.volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={p.muted ? 0 : p.volume}
              onChange={(e) => p.onChangeVolume(Number(e.target.value))}
              aria-label="Volume"
              style={{ background: `linear-gradient(to right, #fff ${(p.muted ? 0 : p.volume) * 100}%, rgba(255,255,255,0.3) ${(p.muted ? 0 : p.volume) * 100}%)` }}
              className="fluent-slider w-28 h-1 rounded-full"
            />
            <button type="button" className={btn} onClick={p.onExit} aria-label="Exit fullscreen"><Minimize size={18} /></button>
          </div>
        </div>
      </div>
    </div>
  );
}
