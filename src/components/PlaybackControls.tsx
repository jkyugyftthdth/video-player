import { Check, ChevronDown, Volume2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { isNativeAudio } from '@/src/media/native';
import { AccentTheme, VideoItem } from '@/src/types/video';
import { ACCENT_PALETTES } from '@/src/utils/accent';

interface HdrButtonProps {
  video: VideoItem | null;
  enabled: boolean;
  accent: AccentTheme;
  onToggle: () => void;
}

/** HDR switch: only usable for HDR videos (HDR10 / HLG / Dolby Vision base layer). */
export function HdrButton({ video, enabled, accent, onToggle }: HdrButtonProps) {
  const palette = ACCENT_PALETTES[accent];
  const isHdr = Boolean(video?.isHdr);
  const passthrough = isHdr && video?.videoNative !== false;
  const on = enabled && passthrough;

  const title = !isHdr
    ? 'HDR is only available for HDR videos'
    : !passthrough
      ? `${video?.hdrFormat ?? 'HDR'} video: this PC cannot decode it directly, so it is converted to SDR`
      : on
        ? `HDR on (${video?.hdrFormat}). Turn on HDR in Windows Settings > Display for the full effect`
        : `Turn HDR on (${video?.hdrFormat})`;

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={!passthrough}
      aria-pressed={on}
      title={title}
      aria-label={title}
      className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-[12.5px] font-bold tracking-wide border backdrop-blur-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
        on
          ? `bg-white dark:bg-[#353535] border-black/15 dark:border-white/20 ${palette.activeText}`
          : 'bg-white/85 dark:bg-[#2b2b2b]/85 hover:bg-white dark:hover:bg-[#343434] text-neutral-700 dark:text-neutral-300 border-black/[0.08] dark:border-white/[0.08]'
      }`}
    >
      <span>HDR</span>
      {isHdr && (
        <span className="text-[10px] font-medium opacity-70">{on ? 'On' : 'Off'}</span>
      )}
    </button>
  );
}

interface AudioTrackMenuProps {
  video: VideoItem | null;
  accent: AccentTheme;
  onSelect: (videoId: string, audioIndex: number) => void;
}

export function AudioTrackMenu({ video, accent, onSelect }: AudioTrackMenuProps) {
  const palette = ACCENT_PALETTES[accent];
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const streams = video?.audioStreams ?? [];

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [open]);

  if (!video || streams.length < 2) return null;
  const defaultIdx = Math.max(0, streams.findIndex((a) => a.isDefault));
  const activeIdx = video.activeAudioIndex ?? defaultIdx;
  const active = streams[activeIdx] ?? streams[0];

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Audio track"
        title={`Audio: ${active.label}`}
        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-[12.5px] font-medium border backdrop-blur-xs transition-colors bg-white/85 dark:bg-[#2b2b2b]/85 hover:bg-white dark:hover:bg-[#343434] text-neutral-700 dark:text-neutral-300 border-black/[0.08] dark:border-white/[0.08]"
      >
        <Volume2 size={14} />
        <span className="max-w-[130px] truncate">{active.label}</span>
        <ChevronDown size={13} className="opacity-70 shrink-0" />
      </button>
      {open && (
        <div
          role="menu"
          aria-label="Audio tracks"
          className="absolute right-0 top-9 w-72 py-1.5 rounded-lg bg-white dark:bg-[#2c2c2c] border border-black/10 dark:border-white/10 shadow-xl z-40"
        >
          <div className="px-3 py-1 text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
            Audio tracks ({streams.length})
          </div>
          {streams.map((a) => (
            <button
              key={a.index}
              type="button"
              role="menuitemradio"
              aria-checked={a.index === activeIdx}
              onClick={() => {
                setOpen(false);
                if (a.index !== activeIdx) onSelect(video.id, a.index);
              }}
              className={`w-full px-3 py-2 flex items-center justify-between gap-2 text-left text-[13px] transition-colors ${
                a.index === activeIdx
                  ? `bg-black/[0.06] dark:bg-white/[0.09] font-medium ${palette.activeText}`
                  : 'text-neutral-800 dark:text-neutral-200 hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'
              }`}
            >
              <span className="truncate">
                {a.label}
                {!isNativeAudio(a.codec) && (
                  <span className="ml-1.5 text-[11px] opacity-60">(converted)</span>
                )}
              </span>
              {a.index === activeIdx && <Check size={14} className="shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
