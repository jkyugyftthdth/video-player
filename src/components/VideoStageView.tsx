import {
  ArrowLeft,
  Captions,
  Check,
  ChevronDown,
  FileText,
  Film,
  Info,
  Maximize,
  Minimize,
  Pause,
  PictureInPicture2,
  Play,
  Scaling,
  Wand2,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { mediaEngine } from '@/src/media/MediaEngine';
import {
  AccentTheme,
  ThemeMode,
  VideoFilterMode,
  VideoFitMode,
  VideoItem,
} from '@/src/types/video';
import { ACCENT_PALETTES } from '@/src/utils/accent';
import { AudioTrackMenu, HdrButton } from './PlaybackControls';
import { VideoCanvasSurface } from './VideoCanvasSurface';

interface VideoStageViewProps {
  video: VideoItem | null;
  isPlaying: boolean;
  currentTime: number;
  theme: ThemeMode;
  accent: AccentTheme;
  fitMode: VideoFitMode;
  postFilter: VideoFilterMode;
  hdrEnabled: boolean;
  onToggleHdr: () => void;
  onSelectAudioTrack: (videoId: string, audioIndex: number) => void;
  onToggleFitMode: () => void;
  onChangePostFilter: (filter: VideoFilterMode) => void;
  onSelectSubtitleTrack: (videoId: string, subtitleId: string | null) => void;
  onAttachVttFile: (videoId: string, file: File) => void;
  onTogglePlayPause: () => void;
  onToggleMiniPlayer: () => void;
  onBack: () => void;
  onSelectCollection: (collectionId: string) => void;
  onSelectCreator: (creatorId: string) => void;
  onOpenDetails: (video: VideoItem) => void;
}

type VisualizerMode = 'spectrum' | 'wave' | 'off';

const POST_FILTER_OPTIONS: { id: VideoFilterMode; label: string }[] = [
  { id: 'none', label: 'Normal' },
  { id: 'grayscale', label: 'Grayscale' },
  { id: 'sepia', label: 'Sepia' },
  { id: 'high-contrast', label: 'High Contrast' },
];

export function VideoStageView({
  video,
  isPlaying,
  currentTime,
  theme,
  accent,
  fitMode,
  postFilter,
  hdrEnabled,
  onToggleHdr,
  onSelectAudioTrack,
  onToggleFitMode,
  onChangePostFilter,
  onSelectSubtitleTrack,
  onAttachVttFile,
  onTogglePlayPause,
  onToggleMiniPlayer,
  onBack,
  onSelectCollection,
  onSelectCreator,
  onOpenDetails,
}: VideoStageViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const stageBoxRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const subtitleMenuRef = useRef<HTMLDivElement | null>(null);
  const vttInputRef = useRef<HTMLInputElement | null>(null);
  const smoothedBinsRef = useRef<Float32Array>(new Float32Array(72));
  const [vizMode, setVizMode] = useState<VisualizerMode>('spectrum');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [subtitleMenuOpen, setSubtitleMenuOpen] = useState(false);

  const palette = ACCENT_PALETTES[accent];

  useEffect(() => {
    if (!subtitleMenuOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (subtitleMenuRef.current && !subtitleMenuRef.current.contains(e.target as Node)) {
        setSubtitleMenuOpen(false);
      }
    };
    window.addEventListener('mousedown', handleOutside);
    return () => window.removeEventListener('mousedown', handleOutside);
  }, [subtitleMenuOpen]);

  useEffect(() => {
    setSubtitleMenuOpen(false);
  }, [video?.id]);

  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const handleToggleFullscreen = () => {
    const el = stageBoxRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      el.requestFullscreen?.().catch(() => {});
    }
  };

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let animId = 0;
    let width = container.clientWidth;
    let height = container.clientHeight;

    const syncCanvasSize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = container.clientWidth;
      height = container.clientHeight;
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    syncCanvasSize();
    const resizeObserver = new ResizeObserver(syncCanvasSize);
    resizeObserver.observe(container);

    const freqBuffer = new Uint8Array(128);
    const barCount = 72;
    const smoothed = smoothedBinsRef.current;

    const renderFrame = () => {
      ctx.clearRect(0, 0, width, height);

      if (vizMode === 'off') {
        return;
      }

      const analyser = mediaEngine.getAnalyser();
      const hasLiveAnalyser = Boolean(analyser && isPlaying && !prefersReducedMotion);

      if (hasLiveAnalyser && analyser) {
        analyser.getByteFrequencyData(freqBuffer);
      }

      const accentColor = theme === 'dark' ? palette.hexDark : palette.hexLight;
      let bassSum = 0;

      for (let i = 0; i < barCount; i++) {
        let target = 0.03;
        if (hasLiveAnalyser && analyser) {
          const binCount = Math.min(analyser.frequencyBinCount, 96);
          const binIdx = Math.min(binCount - 1, Math.floor((i / barCount) * binCount));
          target = freqBuffer[binIdx] / 255;
        } else if (isPlaying) {
          target = 0.14 + 0.08 * Math.sin(i * 0.35);
        }

        const lerpFactor = target > smoothed[i] ? 0.35 : 0.12;
        smoothed[i] += (target - smoothed[i]) * lerpFactor;
        if (i < 10) bassSum += smoothed[i];
      }

      const bassEnergy = bassSum / 10;

      const glowRadius = Math.max(width, height) * (0.38 + bassEnergy * 0.22);
      const radial = ctx.createRadialGradient(
        width * 0.5,
        height * 0.45,
        16,
        width * 0.5,
        height * 0.45,
        glowRadius
      );
      radial.addColorStop(0, accentColor);
      radial.addColorStop(1, 'transparent');

      ctx.save();
      ctx.globalAlpha = (theme === 'dark' ? 0.1 : 0.08) + bassEnergy * 0.14;
      ctx.fillStyle = radial;
      ctx.fillRect(0, 0, width, height);
      ctx.restore();

      if (vizMode === 'spectrum') {
        const gap = Math.max(3, Math.floor(width / 220));
        const totalGap = gap * (barCount - 1);
        const barWidth = Math.max(2, (width - totalGap) / barCount);
        const maxBarHeight = height * 0.38;

        const barGrad = ctx.createLinearGradient(0, height - maxBarHeight, 0, height);
        barGrad.addColorStop(0, accentColor);
        barGrad.addColorStop(1, 'transparent');

        ctx.fillStyle = barGrad;
        for (let i = 0; i < barCount; i++) {
          const val = smoothed[i];
          const barH = Math.max(4, val * maxBarHeight);
          const x = i * (barWidth + gap);
          const y = height - barH;

          ctx.globalAlpha = (theme === 'dark' ? 0.14 : 0.1) + val * 0.3;
          ctx.beginPath();
          ctx.roundRect(x, y, barWidth, barH, [3, 3, 0, 0]);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      } else if (vizMode === 'wave') {
        const maxAmp = height * 0.24;
        const baseLine = height * 0.85;

        const drawWaveLayer = (alpha: number, scale: number, phaseShift: number) => {
          ctx.beginPath();
          ctx.moveTo(0, height);
          for (let i = 0; i < barCount; i++) {
            const x = (i / (barCount - 1)) * width;
            const idx = (i + phaseShift) % barCount;
            const y = baseLine - smoothed[idx] * maxAmp * scale;
            if (i === 0) {
              ctx.lineTo(x, y);
            } else {
              const prevX = ((i - 1) / (barCount - 1)) * width;
              const prevIdx = (i - 1 + phaseShift) % barCount;
              const prevY = baseLine - smoothed[prevIdx] * maxAmp * scale;
              const midX = (prevX + x) / 2;
              ctx.quadraticCurveTo(prevX, prevY, midX, (prevY + y) / 2);
            }
          }
          ctx.lineTo(width, height);
          ctx.closePath();

          const fillGrad = ctx.createLinearGradient(0, baseLine - maxAmp, 0, height);
          fillGrad.addColorStop(0, accentColor);
          fillGrad.addColorStop(1, 'transparent');

          ctx.globalAlpha = alpha;
          ctx.fillStyle = fillGrad;
          ctx.fill();
        };

        drawWaveLayer(theme === 'dark' ? 0.24 : 0.18, 1.0, 0);
        drawWaveLayer(theme === 'dark' ? 0.14 : 0.1, 0.72, 4);
        ctx.globalAlpha = 1;
      }

      if (isPlaying && !prefersReducedMotion) {
        animId = requestAnimationFrame(renderFrame);
      }
    };

    renderFrame();

    return () => {
      resizeObserver.disconnect();
      if (animId) cancelAnimationFrame(animId);
    };
  }, [isPlaying, theme, palette.hexDark, palette.hexLight, video?.id, vizMode]);

  if (!video) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center px-6">
        <Film size={48} className="text-neutral-400 dark:text-neutral-500 mb-3" />
        <h2 className="font-display text-xl font-medium text-neutral-800 dark:text-neutral-200">
          No video selected
        </h2>
        <p className="text-[13px] text-neutral-500 dark:text-neutral-400 mt-1">
          Pick a collection or video from your library to start watching.
        </p>
        <button
          type="button"
          onClick={onBack}
          className="mt-4 h-9 px-4 rounded-md text-[13px] font-medium bg-black/[0.06] dark:bg-white/[0.08] text-neutral-800 dark:text-neutral-200"
        >
          Back to library
        </button>
      </div>
    );
  }

  const tracks = video.subtitleTracks ?? [];
  const activeTrackId =
    video.activeSubtitleId === undefined ? tracks[0]?.id ?? null : video.activeSubtitleId;
  const activeTrack = tracks.find((t) => t.id === activeTrackId) || null;
  const activeCaption = activeTrack
    ? activeTrack.cues.find((c) => currentTime >= c.startSec && currentTime <= c.endSec)
    : undefined;

  return (
    <div
      ref={containerRef}
      className="h-full relative overflow-hidden flex flex-col px-6 py-4 bg-gradient-to-b from-black/[0.03] dark:from-white/[0.03] to-transparent"
    >
      {/* Hidden external .vtt subtitle uploader */}
      <input
        ref={vttInputRef}
        type="file"
        accept=".vtt,text/vtt"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file && video) {
            onAttachVttFile(video.id, file);
            e.target.value = '';
            setSubtitleMenuOpen(false);
          }
        }}
      />

      {/* Background HTML5 Canvas Audio Visualizer */}
      <canvas
        ref={canvasRef}
        aria-label="Audio frequency background visualizer"
        className="absolute inset-0 w-full h-full pointer-events-none z-0"
      />

      {/* Top Stage Controls */}
      <div className="relative z-20 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 px-2.5 py-1.5 -ml-2.5 rounded-md text-[13px] font-medium text-neutral-700 dark:text-neutral-300 hover:bg-black/[0.05] dark:hover:bg-white/[0.07] transition-colors"
        >
          <ArrowLeft size={15} />
          <span>Back to library</span>
        </button>

        <div className="flex flex-wrap items-center gap-2">
          {/* Background Visualizer Mode */}
          <div
            role="group"
            aria-label="Background visualizer style"
            className="inline-flex items-center p-0.5 rounded-md bg-black/[0.06] dark:bg-white/[0.08] border border-black/[0.06] dark:border-white/[0.08]"
          >
            {(['spectrum', 'wave', 'off'] as VisualizerMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setVizMode(mode)}
                className={`h-7 px-2.5 rounded text-[12px] font-medium transition-colors ${
                  vizMode === mode
                    ? 'bg-white dark:bg-[#383838] text-neutral-950 dark:text-white shadow-xs'
                    : 'text-neutral-600 dark:text-neutral-300 hover:text-neutral-950 dark:hover:text-white'
                }`}
              >
                {mode === 'spectrum' ? 'Bars' : mode === 'wave' ? 'Wave' : 'Off'}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={onToggleFitMode}
            title={fitMode === 'contain' ? 'Switch to Fill frame' : 'Switch to Fit frame'}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-[12.5px] font-medium bg-white/85 dark:bg-[#2b2b2b]/85 hover:bg-white dark:hover:bg-[#343434] text-neutral-800 dark:text-neutral-200 border border-black/[0.08] dark:border-white/[0.08] backdrop-blur-xs transition-colors"
          >
            <Scaling size={14} />
            <span>{fitMode === 'contain' ? 'Fit' : 'Fill'}</span>
          </button>

          <HdrButton video={video} enabled={hdrEnabled} accent={accent} onToggle={onToggleHdr} />
          <AudioTrackMenu video={video} accent={accent} onSelect={onSelectAudioTrack} />

          {/* Subtitle Track Selector Menu */}
          <div className="relative" ref={subtitleMenuRef}>
            <button
              type="button"
              onClick={() => setSubtitleMenuOpen((open) => !open)}
              aria-haspopup="menu"
              aria-expanded={subtitleMenuOpen}
              aria-label="Subtitle track selector"
              title={
                activeTrack
                  ? `Subtitles: ${activeTrack.label}`
                  : tracks.length > 0
                    ? 'Subtitles: Off'
                    : 'Subtitles (load .vtt file)'
              }
              className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-[12.5px] font-medium border backdrop-blur-xs transition-colors ${
                activeTrack
                  ? `bg-white dark:bg-[#353535] border-black/15 dark:border-white/20 ${palette.activeText}`
                  : 'bg-white/85 dark:bg-[#2b2b2b]/85 hover:bg-white dark:hover:bg-[#343434] text-neutral-700 dark:text-neutral-300 border-black/[0.08] dark:border-white/[0.08]'
              }`}
            >
              <Captions size={14} />
              <span className="max-w-[130px] truncate">
                {activeTrack ? activeTrack.label : 'Subtitles: Off'}
              </span>
              <ChevronDown size={13} className="opacity-70 shrink-0" />
            </button>

            {subtitleMenuOpen && (
              <div
                role="menu"
                aria-label="Subtitle tracks"
                className="absolute right-0 top-9 w-64 py-1.5 rounded-lg bg-white dark:bg-[#2c2c2c] border border-black/10 dark:border-white/10 shadow-xl z-40"
              >
                <div className="px-3 py-1 text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
                  Subtitles &amp; captions ({tracks.length})
                </div>

                {/* Turn Subtitles Off */}
                <button
                  type="button"
                  role="menuitemradio"
                  aria-checked={!activeTrack}
                  onClick={() => {
                    onSelectSubtitleTrack(video.id, null);
                    setSubtitleMenuOpen(false);
                  }}
                  className={`w-full px-3 py-2 flex items-center justify-between text-[13px] transition-colors ${
                    !activeTrack
                      ? `bg-black/[0.06] dark:bg-white/[0.09] font-medium ${palette.activeText}`
                      : 'text-neutral-800 dark:text-neutral-200 hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'
                  }`}
                >
                  <span>Off</span>
                  {!activeTrack && <Check size={14} />}
                </button>

                {tracks.length > 0 && (
                  <div className="my-1 border-t border-black/[0.06] dark:border-white/[0.06]" />
                )}

                {tracks.map((track) => {
                  const selected = activeTrack?.id === track.id;
                  return (
                    <button
                      key={track.id}
                      type="button"
                      role="menuitemradio"
                      aria-checked={selected}
                      onClick={() => {
                        onSelectSubtitleTrack(video.id, track.id);
                        setSubtitleMenuOpen(false);
                      }}
                      className={`w-full px-3 py-2 flex items-center justify-between gap-2 text-left text-[13px] transition-colors ${
                        selected
                          ? `bg-black/[0.06] dark:bg-white/[0.09] font-medium ${palette.activeText}`
                          : 'text-neutral-800 dark:text-neutral-200 hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate">{track.label}</div>
                        <div className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate">
                          {track.kind === 'vtt'
                            ? track.sourceName || 'External .vtt track'
                            : 'Embedded track'}
                        </div>
                      </div>
                      {selected && <Check size={14} className="shrink-0" />}
                    </button>
                  );
                })}

                <div className="my-1 border-t border-black/[0.06] dark:border-white/[0.06]" />

                <button
                  type="button"
                  role="menuitem"
                  onClick={() => vttInputRef.current?.click()}
                  className="w-full px-3 py-2 flex items-center gap-2 text-[12.5px] font-medium text-neutral-700 dark:text-neutral-200 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors"
                >
                  <FileText size={14} className={palette.activeText} />
                  <span>Load .vtt subtitle file...</span>
                </button>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={onToggleMiniPlayer}
            title="Switch to Mini Player"
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-[12.5px] font-medium bg-white/85 dark:bg-[#2b2b2b]/85 hover:bg-white dark:hover:bg-[#343434] text-neutral-800 dark:text-neutral-200 border border-black/[0.08] dark:border-white/[0.08] backdrop-blur-xs transition-colors"
          >
            <PictureInPicture2 size={14} />
            <span className="hidden sm:inline">Mini Player</span>
          </button>

          <button
            type="button"
            onClick={() => onOpenDetails(video)}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-[12.5px] font-medium bg-white/85 dark:bg-[#2b2b2b]/85 hover:bg-white dark:hover:bg-[#343434] text-neutral-800 dark:text-neutral-200 border border-black/[0.08] dark:border-white/[0.08] backdrop-blur-xs transition-colors"
          >
            <Info size={14} />
            <span>Details</span>
          </button>
        </div>
      </div>

      {/* Main 16:9 Video Cinema Stage */}
      <div className="relative z-10 flex-1 min-h-0 flex flex-col items-center justify-center py-2">
        <div
          ref={stageBoxRef}
          className={`relative w-full max-w-4xl aspect-video max-h-[60vh] rounded-xl overflow-hidden shadow-2xl border border-black/15 dark:border-white/15 bg-[#09090b] group ${
            isFullscreen ? 'max-w-none max-h-none rounded-none border-none' : ''
          }`}
        >
          <VideoCanvasSurface
            video={video}
            isPlaying={isPlaying}
            fitMode={fitMode}
            postFilter={postFilter}
            hdr={hdrEnabled}
            className="w-full h-full"
          />

          {/* Interactive Play/Pause Click Overlay */}
          <button
            type="button"
            onClick={onTogglePlayPause}
            aria-label={isPlaying ? 'Pause video' : 'Play video'}
            className="absolute inset-0 flex items-center justify-center cursor-pointer focus:outline-none"
          >
            <span
              className={`w-16 h-16 rounded-full bg-black/55 backdrop-blur-md text-white flex items-center justify-center border border-white/20 shadow-xl transition-opacity duration-200 ${
                isPlaying ? 'opacity-0 group-hover:opacity-100' : 'opacity-100'
              }`}
            >
              {isPlaying ? (
                <Pause size={26} className="fill-current" />
              ) : (
                <Play size={26} className="fill-current ml-1" />
              )}
            </span>
          </button>

          {/* Closed Captions / WebVTT Overlay */}
          {activeCaption && (
            <div className="pointer-events-none absolute bottom-12 left-1/2 -translate-x-1/2 max-w-[85%] px-4 py-1.5 rounded-md bg-black/75 text-white text-[13.5px] sm:text-[15px] font-medium text-center shadow-lg whitespace-pre-line">
              {activeCaption.text}
            </div>
          )}

          {/* Fullscreen Corner Button */}
          <div className="absolute bottom-3 right-3 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              type="button"
              onClick={handleToggleFullscreen}
              title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
              aria-label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
              className="w-9 h-9 rounded-md bg-black/65 hover:bg-black/85 text-white flex items-center justify-center backdrop-blur-xs border border-white/15 transition-colors"
            >
              {isFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
            </button>
          </div>
        </div>

        {/* Video Title & Metadata Below Frame */}
        <div className="mt-3 text-center max-w-2xl px-4">
          <h1 className="font-display text-xl sm:text-2xl font-semibold tracking-tight text-neutral-950 dark:text-white truncate">
            {video.title}
          </h1>
          <div className="flex items-center justify-center flex-wrap gap-x-2 gap-y-1 mt-0.5 text-[13.5px] text-neutral-700 dark:text-neutral-300">
            <button
              type="button"
              onClick={() => onSelectCreator(video.creatorId)}
              className={`font-medium hover:underline ${palette.activeText}`}
            >
              {video.creator}
            </button>
            <span aria-hidden="true">·</span>
            <button
              type="button"
              onClick={() => onSelectCollection(video.collectionId)}
              className="hover:underline"
            >
              {video.collection}
            </button>
          </div>
        </div>

        {/* Post-Processing CSS Filter Section */}
        <section
          aria-label="Post-processing filters"
          className="mt-3 flex flex-wrap items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/80 dark:bg-[#262626]/85 border border-black/[0.08] dark:border-white/[0.08] backdrop-blur-md shadow-xs"
        >
          <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-neutral-600 dark:text-neutral-300 px-1.5">
            <Wand2 size={13} className={palette.activeText} />
            <span>Post-processing</span>
          </span>

          <div
            role="group"
            aria-label="Video color filter"
            className="inline-flex flex-wrap items-center gap-1"
          >
            {POST_FILTER_OPTIONS.map((opt) => {
              const active = postFilter === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onChangePostFilter(opt.id)}
                  className={`h-7 px-2.5 rounded-md text-[12px] font-medium transition-colors whitespace-nowrap ${
                    active
                      ? `${palette.buttonBg} ${palette.buttonText} shadow-xs`
                      : 'text-neutral-700 dark:text-neutral-300 hover:bg-black/[0.06] dark:hover:bg-white/[0.08]'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
