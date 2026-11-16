import {
  GripHorizontal,
  Heart,
  Info,
  Maximize2,
  Pause,
  Play,
  SkipBack,
  SkipForward,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { AccentTheme, ThemeMode, VideoFilterMode, VideoItem } from '@/src/types/video';
import { ACCENT_PALETTES } from '@/src/utils/accent';
import { formatDuration } from '@/src/utils/format';
import { VideoCanvasSurface } from './VideoCanvasSurface';

interface MiniPlayerProps {
  video: VideoItem | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  isFavorite: boolean;
  theme: ThemeMode;
  accent: AccentTheme;
  postFilter?: VideoFilterMode;
  onTogglePlayPause: () => void;
  onNext: () => void;
  onPrev: () => void;
  onSeek: (sec: number) => void;
  onToggleFavorite: (videoId: string) => void;
  onOpenDetails: (video: VideoItem) => void;
  onExitMiniPlayer: () => void;
}

export function MiniPlayer({
  video,
  isPlaying,
  currentTime,
  duration,
  isFavorite,
  theme,
  accent,
  postFilter = 'none',
  onTogglePlayPause,
  onNext,
  onPrev,
  onSeek,
  onToggleFavorite,
  onOpenDetails,
  onExitMiniPlayer,
}: MiniPlayerProps) {
  const palette = ACCENT_PALETTES[accent];
  const accentHex = theme === 'dark' ? palette.hexDark : palette.hexLight;
  const thumbRing = theme === 'dark' ? '#252525' : '#ffffff';

  const windowRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ x: number; y: number }>(() => {
    const w = typeof window !== 'undefined' ? window.innerWidth : 1200;
    const h = typeof window !== 'undefined' ? window.innerHeight : 800;
    return {
      x: Math.max(20, w - 404),
      y: Math.max(20, h - 350),
    };
  });

  const dragOffset = useRef<{ dx: number; dy: number } | null>(null);

  useEffect(() => {
    const onPointerMove = (e: PointerEvent) => {
      if (!dragOffset.current) return;
      const winW = window.innerWidth;
      const winH = window.innerHeight;
      const elW = windowRef.current?.offsetWidth || 380;
      const elH = windowRef.current?.offsetHeight || 310;
      const nextX = Math.min(Math.max(12, e.clientX - dragOffset.current.dx), winW - elW - 12);
      const nextY = Math.min(Math.max(12, e.clientY - dragOffset.current.dy), winH - elH - 12);
      setPos({ x: nextX, y: nextY });
    };

    const onPointerUp = () => {
      dragOffset.current = null;
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, []);

  const effectiveDuration = duration > 0 ? duration : video?.duration || 0;
  const progressPct =
    effectiveDuration > 0 ? Math.min(100, Math.max(0, (currentTime / effectiveDuration) * 100)) : 0;
  const trackBg = theme === 'dark' ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.14)';

  return (
    <div className="h-screen w-screen overflow-hidden relative bg-[#eaeaea] dark:bg-[#161616] flex items-center justify-center select-none">
      <div className="text-center px-6 max-w-sm">
        <p className="font-display text-[17px] font-medium text-neutral-800 dark:text-neutral-200">
          Video Player is in Mini Player mode
        </p>
        <p className="text-[13px] text-neutral-500 dark:text-neutral-400 mt-1">
          Drag the floating video window anywhere or restore the full player.
        </p>
        <button
          type="button"
          onClick={onExitMiniPlayer}
          className={`mt-4 h-9 px-4 rounded-md inline-flex items-center gap-2 text-[13px] font-medium transition-colors ${palette.buttonBg} ${palette.buttonText}`}
        >
          <Maximize2 size={14} />
          <span>Restore Video Player</span>
        </button>
      </div>

      {/* Floating Always-On-Top Mini Video Window */}
      <div
        ref={windowRef}
        role="region"
        aria-label="Mini Video Player"
        style={
          {
            left: `${pos.x}px`,
            top: `${pos.y}px`,
            '--accent-color': accentHex,
            '--thumb-ring': thumbRing,
          } as React.CSSProperties
        }
        className="fixed z-50 w-[380px] rounded-xl bg-white/95 dark:bg-[#252525]/95 backdrop-blur-2xl border border-black/15 dark:border-white/15 shadow-2xl overflow-hidden"
      >
        {/* Draggable Title Bar */}
        <div
          onPointerDown={(e) => {
            if ((e.target as HTMLElement).closest('button')) return;
            dragOffset.current = {
              dx: e.clientX - pos.x,
              dy: e.clientY - pos.y,
            };
          }}
          className="h-9 px-3 flex items-center justify-between border-b border-black/[0.06] dark:border-white/[0.06] cursor-grab active:cursor-grabbing"
        >
          <div className="flex items-center gap-1.5 text-[11.5px] font-medium text-neutral-600 dark:text-neutral-300">
            <GripHorizontal size={14} className="text-neutral-400" />
            <span>Video Player</span>
          </div>

          <div className="flex items-center gap-1">
            {video && (
              <button
                type="button"
                onClick={() => onOpenDetails(video)}
                title="Video properties & bitrate"
                aria-label="View video properties and bitrate"
                className="w-7 h-7 rounded flex items-center justify-center text-neutral-600 dark:text-neutral-300 hover:bg-black/[0.06] dark:hover:bg-white/[0.08] transition-colors"
              >
                <Info size={13} />
              </button>
            )}
            <button
              type="button"
              onClick={onExitMiniPlayer}
              title="Restore full window"
              aria-label="Exit mini player"
              className="w-7 h-7 rounded flex items-center justify-center text-neutral-600 dark:text-neutral-300 hover:bg-black/[0.06] dark:hover:bg-white/[0.08] transition-colors"
            >
              <Maximize2 size={13} />
            </button>
          </div>
        </div>

        {/* Live 16:9 Mini Video Preview */}
        <div
          onClick={onTogglePlayPause}
          className="relative aspect-video w-full bg-[#09090b] cursor-pointer group"
        >
          <VideoCanvasSurface
            video={video}
            isPlaying={isPlaying}
            fitMode="contain"
            postFilter={postFilter}
            className="w-full h-full"
          />
        </div>

        {/* Video Info & Controls */}
        <div className="p-3.5">
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <div className="text-[13.5px] font-semibold text-neutral-950 dark:text-white truncate">
                {video ? video.title : 'Nothing playing'}
              </div>
              <div className="text-[11.5px] text-neutral-600 dark:text-neutral-400 truncate mt-0.5">
                {video ? `${video.creator} · ${video.collection}` : 'Restore window to pick a video'}
              </div>
            </div>

            {video && (
              <button
                type="button"
                onClick={() => onToggleFavorite(video.id)}
                aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 transition-colors ${
                  isFavorite
                    ? palette.activeText
                    : 'text-neutral-500 dark:text-neutral-400 hover:bg-black/[0.05] dark:hover:bg-white/[0.07]'
                }`}
              >
                <Heart size={15} className={isFavorite ? 'fill-current' : ''} />
              </button>
            )}
          </div>

          <div className="mt-2.5 flex items-center gap-2">
            <span className="text-[10.5px] font-mono-tabular text-neutral-500 dark:text-neutral-400 w-9 text-right">
              {formatDuration(currentTime)}
            </span>
            <input
              type="range"
              min={0}
              max={effectiveDuration || 1}
              step={0.25}
              value={Math.min(currentTime, effectiveDuration || 1)}
              disabled={!video}
              onChange={(e) => onSeek(Number(e.target.value))}
              aria-label="Seek video position"
              style={{
                background: `linear-gradient(to right, ${accentHex} ${progressPct}%, ${trackBg} ${progressPct}%)`,
              }}
              className="fluent-slider flex-1 h-1 rounded-full disabled:opacity-40"
            />
            <span className="text-[10.5px] font-mono-tabular text-neutral-500 dark:text-neutral-400 w-9">
              {formatDuration(effectiveDuration)}
            </span>
          </div>

          <div className="mt-2 flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={onPrev}
              disabled={!video}
              aria-label="Previous video"
              className="w-8 h-8 rounded-md flex items-center justify-center text-neutral-800 dark:text-neutral-200 hover:bg-black/[0.06] dark:hover:bg-white/[0.08] disabled:opacity-40 transition-colors"
            >
              <SkipBack size={15} className="fill-current" />
            </button>

            <button
              type="button"
              onClick={onTogglePlayPause}
              disabled={!video}
              aria-label={isPlaying ? 'Pause' : 'Play'}
              className={`w-9 h-9 rounded-full flex items-center justify-center shadow-sm transition-transform active:scale-95 disabled:opacity-40 ${palette.buttonBg} ${palette.buttonText}`}
            >
              {isPlaying ? (
                <Pause size={16} className="fill-current" />
              ) : (
                <Play size={16} className="fill-current ml-0.5" />
              )}
            </button>

            <button
              type="button"
              onClick={onNext}
              disabled={!video}
              aria-label="Next video"
              className="w-8 h-8 rounded-md flex items-center justify-center text-neutral-800 dark:text-neutral-200 hover:bg-black/[0.06] dark:hover:bg-white/[0.08] disabled:opacity-40 transition-colors"
            >
              <SkipForward size={15} className="fill-current" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
