import {
  ArrowLeft,
  Captions,
  Check,
  Crop,
  FileText,
  Film,
  Info,
  Maximize,
  Minimize,
  MoreHorizontal,
  Pause,
  PictureInPicture2,
  Play,
  RotateCcw,
  RotateCw,
  Scaling,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { isNativeAudio, nativeApi } from '@/src/media/native';
import {
  AccentTheme,
  ThemeMode,
  VideoFilterMode,
  VideoFitMode,
  VideoItem,
} from '@/src/types/video';
import { formatDuration } from '@/src/utils/format';
import { ASPECTS, CROPS, DEFAULT_VIEW, ViewSettings } from './PlaybackControls';
import { VideoCanvasSurface } from './VideoCanvasSurface';

interface VideoStageViewProps {
  video: VideoItem | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  muted: boolean;
  onSeek: (sec: number) => void;
  onNext: () => void;
  onPrev: () => void;
  onChangeVolume: (v: number) => void;
  onToggleMute: () => void;
  theme: ThemeMode;
  accent: AccentTheme;
  fitMode: VideoFitMode;
  postFilter: VideoFilterMode;
  hdrEnabled: boolean;
  audioDelayMs: number;
  onAdjustAudioDelay: (deltaMs: number | null) => void;
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


const POST_FILTER_OPTIONS: { id: VideoFilterMode; label: string }[] = [
  { id: 'none', label: 'Normal' },
  { id: 'grayscale', label: 'Grayscale' },
  { id: 'sepia', label: 'Sepia' },
  { id: 'high-contrast', label: 'High Contrast' },
];

type Panel = 'subs' | 'view' | 'audio' | 'more' | null;

const iconBtn =
  'w-10 h-10 rounded-full flex items-center justify-center text-white hover:bg-white/15 disabled:opacity-35 disabled:hover:bg-transparent transition-colors';
const rowBtn = 'w-full px-3 py-2 flex items-center justify-between gap-2 text-left hover:bg-white/10';
const secTitle = 'px-3 pt-2 pb-1 text-[11px] uppercase tracking-wide text-white/50';

export function VideoStageView({
  video,
  isPlaying,
  currentTime,
  duration,
  volume,
  muted,
  onSeek,
  onNext,
  onPrev,
  onChangeVolume,
  onToggleMute,
  fitMode,
  postFilter,
  hdrEnabled,
  audioDelayMs,
  onAdjustAudioDelay,
  onToggleHdr,
  onSelectAudioTrack,
  onToggleFitMode,
  onChangePostFilter,
  onSelectSubtitleTrack,
  onAttachVttFile,
  onTogglePlayPause,
  onToggleMiniPlayer,
  onBack,
  onOpenDetails,
}: VideoStageViewProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const vttInputRef = useRef<HTMLInputElement | null>(null);
  const [view, setView] = useState<ViewSettings>(DEFAULT_VIEW);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [panel, setPanel] = useState<Panel>(null);
  const [hwDecode, setHwDecode] = useState<boolean | null>(null);
  useEffect(() => {
    nativeApi()?.getSettings().then((st) => setHwDecode(st.hwDecode)).catch(() => {});
  }, []);
  const switchDecode = async () => {
    const api = nativeApi();
    if (!api || hwDecode === null) return;
    await api.setSettings({ hwDecode: !hwDecode });
    setHwDecode(!hwDecode);
    flash(`Restarting with ${!hwDecode ? 'GPU (hardware)' : 'CPU (software)'} decoding…`);
    setTimeout(() => api.relaunch(), 900);
  };
  const [osd, setOsd] = useState('');
  const osdTimer = useRef<number | null>(null);
  const [barVisible, setBarVisible] = useState(true);
  const [barHover, setBarHover] = useState(false);
  const hideTimer = useRef<number | null>(null);

  const flash = useCallback((msg: string) => {
    setOsd(msg);
    if (osdTimer.current) window.clearTimeout(osdTimer.current);
    osdTimer.current = window.setTimeout(() => setOsd(''), 1400);
  }, []);
  const viewRef = useRef(view);
  viewRef.current = view;
  const setViewFlash = (v: ViewSettings, msg: string) => {
    setView(v);
    flash(msg);
  };

  const wake = useCallback(() => {
    setBarVisible(true);
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => setBarVisible(false), 2500);
  }, []);
  useEffect(() => {
    wake();
    const move = () => wake();
    window.addEventListener('mousemove', move);
    window.addEventListener('keydown', move);
    window.addEventListener('mousedown', move);
    return () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('keydown', move);
      window.removeEventListener('mousedown', move);
      if (hideTimer.current) window.clearTimeout(hideTimer.current);
    };
  }, [wake]);

  const showBar = barVisible || barHover || panel !== null || !isPlaying;
  useEffect(() => {
    document.documentElement.classList.toggle('vp-hide-cursor', !showBar);
    return () => document.documentElement.classList.remove('vp-hide-cursor');
  }, [showBar]);

  useEffect(() => {
    setPanel(null);
  }, [video?.id]);

  useEffect(() => {
    const onFs = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else rootRef.current?.requestFullscreen?.().catch(() => {});
  }, []);

  // VLC-style shortcuts: F fullscreen, A aspect, C crop, Z/Shift+Z zoom, X reset, Esc close menus
  const cycle = <T,>(list: { label: string; value: T }[], cur: T) =>
    list[(list.findIndex((o) => o.value === cur) + 1) % list.length];
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || (t.tagName === 'INPUT' && (t as HTMLInputElement).type === 'text'))) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const v = viewRef.current;
      if (e.code === 'KeyF') toggleFullscreen();
      else if (e.code === 'KeyA') {
        const o = cycle(ASPECTS, v.aspect);
        setViewFlash({ ...v, aspect: o.value }, `Aspect ratio: ${o.label}`);
      } else if (e.code === 'KeyC') {
        const o = cycle(CROPS, v.crop);
        setViewFlash({ ...v, crop: o.value }, o.label);
      } else if (e.code === 'KeyZ') {
        const z = Math.min(3, Math.max(0.5, +(v.zoom + (e.shiftKey ? -0.1 : 0.1)).toFixed(2)));
        setViewFlash({ ...v, zoom: z }, `Zoom: ${Math.round(z * 100)}%`);
      } else if (e.code === 'KeyX') setViewFlash(DEFAULT_VIEW, 'Aspect, crop and zoom reset');
      else if (e.code === 'Escape') setPanel(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggleFullscreen]);

  if (!video) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center px-6">
        <Film size={48} className="text-neutral-400 dark:text-neutral-500 mb-3" />
        <h2 className="font-display text-xl font-medium text-neutral-800 dark:text-neutral-200">No video selected</h2>
        <button type="button" onClick={onBack} className="mt-4 h-9 px-4 rounded-md text-[13px] font-medium bg-black/[0.06] dark:bg-white/[0.08] text-neutral-800 dark:text-neutral-200">
          Back to library
        </button>
      </div>
    );
  }

  const tracks = video.subtitleTracks ?? [];
  const activeTrackId = video.activeSubtitleId === undefined ? tracks[0]?.id ?? null : video.activeSubtitleId;
  const activeTrack = tracks.find((t) => t.id === activeTrackId) || null;
  const activeCaption = activeTrack
    ? activeTrack.cues.find((c) => currentTime >= c.startSec && currentTime <= c.endSec)
    : undefined;

  const dur = duration > 0 ? duration : video.duration || 1;
  const pct = Math.min(100, Math.max(0, (currentTime / dur) * 100));
  const volPct = (muted ? 0 : volume) * 100;
  const streams = video.audioStreams ?? [];
  const defaultIdx = Math.max(0, streams.findIndex((a) => a.isDefault));
  const activeAudio = video.activeAudioIndex ?? defaultIdx;
  const isHdr = Boolean(video.isHdr);
  const hdrOn = hdrEnabled && isHdr;
  const seekRel = (d: number) => onSeek(Math.max(0, Math.min(dur, currentTime + d)));

  const menuCls =
    'absolute bottom-full mb-2 w-64 max-h-[60vh] overflow-auto py-1.5 rounded-lg bg-[#2c2c2c]/95 backdrop-blur text-white border border-white/10 shadow-2xl text-[13px]';
  const check = (on: boolean) => on && <Check size={14} className="shrink-0" />;

  return (
    <div
      ref={rootRef}
      className="relative h-full w-full overflow-hidden bg-black select-none"
      onWheel={(e) => {
        if (e.ctrlKey) {
          const v = viewRef.current;
          const z = Math.min(3, Math.max(0.5, +(v.zoom + (e.deltaY < 0 ? 0.1 : -0.1)).toFixed(2)));
          setViewFlash({ ...v, zoom: z }, `Zoom: ${Math.round(z * 100)}%`);
        } else {
          const nv = Math.min(1, Math.max(0, +(volume + (e.deltaY < 0 ? 0.05 : -0.05)).toFixed(2)));
          onChangeVolume(nv);
          flash(`Volume: ${Math.round(nv * 100)}%`);
        }
      }}
    >
      <input
        ref={vttInputRef}
        type="file"
        accept=".vtt,text/vtt"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            onAttachVttFile(video.id, file);
            e.target.value = '';
            setPanel(null);
          }
        }}
      />

      <VideoCanvasSurface
        video={video}
        isPlaying={isPlaying}
        fitMode={fitMode}
        postFilter={postFilter}
        hdr={hdrEnabled}
        aspect={view.aspect}
        cropAspect={view.crop}
        zoom={view.zoom}
        className="absolute inset-0 w-full h-full"
      />

      {/* click = play/pause, double-click = fullscreen, right-click = view menu */}
      <button
        type="button"
        aria-label={isPlaying ? 'Pause video' : 'Play video'}
        onClick={() => (panel ? setPanel(null) : onTogglePlayPause())}
        onDoubleClick={toggleFullscreen}
        onContextMenu={(e) => {
          e.preventDefault();
          setPanel('view');
        }}
        className="absolute inset-0 cursor-default focus:outline-none"
      />

      {osd && (
        <div className="pointer-events-none absolute top-5 left-5 px-3 py-1.5 rounded-md bg-black/70 text-white text-[14px] font-medium">
          {osd}
        </div>
      )}

      {activeCaption && (
        <div
          className={`pointer-events-none absolute left-1/2 -translate-x-1/2 max-w-[85%] px-4 py-1.5 rounded-md bg-black/75 text-white text-[15px] font-medium text-center whitespace-pre-line transition-all ${
            showBar ? 'bottom-36' : 'bottom-10'
          }`}
        >
          {activeCaption.text}
        </div>
      )}

      {/* Bottom control bar: appears on mouse movement, hides when idle */}
      <div
        onMouseEnter={() => setBarHover(true)}
        onMouseLeave={() => setBarHover(false)}
        onDoubleClick={(e) => e.stopPropagation()}
        className={`absolute bottom-0 inset-x-0 px-5 pb-4 pt-16 bg-gradient-to-t from-black/85 via-black/55 to-transparent transition-opacity duration-300 ${
          showBar ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="flex items-center gap-3">
          <span className="text-[12px] font-mono-tabular text-white/90 w-14 text-right">{formatDuration(currentTime)}</span>
          <input
            type="range"
            min={0}
            max={dur}
            step={0.25}
            value={Math.min(currentTime, dur)}
            onChange={(e) => onSeek(Number(e.target.value))}
            aria-label="Seek"
            style={{ background: `linear-gradient(to right, #ff8a3d ${pct}%, rgba(255,255,255,0.3) ${pct}%)` }}
            className="fluent-slider flex-1 h-1 rounded-full"
          />
          <span className="text-[12px] font-mono-tabular text-white/90 w-14">{formatDuration(dur)}</span>
        </div>

        <div className="mt-1.5 grid grid-cols-[1fr_auto_1fr] items-center">
          <div className="flex items-center gap-1">
            <button type="button" className={iconBtn} onClick={onBack} aria-label="Back to library" title="Back to library">
              <ArrowLeft size={18} />
            </button>
          </div>

          <div className="flex items-center gap-1">
            <button type="button" className={iconBtn} onClick={onPrev} aria-label="Previous" title="Previous"><SkipBack size={18} className="fill-current" /></button>
            <button type="button" className={iconBtn} onClick={() => seekRel(-10)} aria-label="Back 10 seconds" title="Back 10 s"><RotateCcw size={18} /></button>
            <button type="button" onClick={onTogglePlayPause} aria-label={isPlaying ? 'Pause' : 'Play'}
              className="w-12 h-12 rounded-full flex items-center justify-center text-white border-2 border-[#ff8a3d] hover:bg-white/15 transition-colors">
              {isPlaying ? <Pause size={20} className="fill-current" /> : <Play size={20} className="fill-current ml-0.5" />}
            </button>
            <button type="button" className={iconBtn} onClick={() => seekRel(30)} aria-label="Forward 30 seconds" title="Forward 30 s"><RotateCw size={18} /></button>
            <button type="button" className={iconBtn} onClick={onNext} aria-label="Next" title="Next"><SkipForward size={18} className="fill-current" /></button>
          </div>

          <div className="flex items-center justify-end gap-0.5">
            <button
              type="button"
              disabled={!isHdr}
              onClick={onToggleHdr}
              aria-pressed={hdrOn}
              title={isHdr ? (hdrOn ? 'HDR on' : 'HDR off') : 'HDR is only available for HDR videos'}
              className={`h-8 px-2.5 mr-1 rounded-md text-[12px] font-bold border transition-colors disabled:opacity-35 ${
                hdrOn ? 'bg-[#ff8a3d] text-black border-transparent' : 'text-white border-white/30 hover:bg-white/15'
              }`}
            >
              HDR
            </button>

            <div className="relative">
              <button type="button" className={`${iconBtn} ${activeTrack ? 'text-[#ff8a3d]' : ''}`} onClick={() => setPanel(panel === 'subs' ? null : 'subs')} aria-label="Subtitles" title="Subtitles">
                <Captions size={19} />
              </button>
              {panel === 'subs' && (
                <div role="menu" className={`${menuCls} right-0`}>
                  <div className={secTitle}>Subtitles</div>
                  <button type="button" className={rowBtn} onClick={() => { onSelectSubtitleTrack(video.id, null); setPanel(null); }}>
                    <span>Off</span>{check(!activeTrack)}
                  </button>
                  {tracks.map((tr) => (
                    <button key={tr.id} type="button" className={rowBtn} onClick={() => { onSelectSubtitleTrack(video.id, tr.id); setPanel(null); }}>
                      <span className="truncate">{tr.label}</span>{check(activeTrack?.id === tr.id)}
                    </button>
                  ))}
                  <button type="button" className={`${rowBtn} border-t border-white/10 mt-1`} onClick={() => vttInputRef.current?.click()}>
                    <span className="flex items-center gap-2"><FileText size={14} />Load .vtt file…</span>
                  </button>
                </div>
              )}
            </div>

            <div className="relative">
              <button type="button" className={`${iconBtn} ${view.aspect || view.crop || view.zoom !== 1 ? 'text-[#ff8a3d]' : ''}`} onClick={() => setPanel(panel === 'view' ? null : 'view')} aria-label="Aspect ratio, crop and zoom" title="Aspect ratio / Crop / Zoom">
                <Crop size={18} />
              </button>
              {panel === 'view' && (
                <div role="menu" className={`${menuCls} right-0 w-60`}>
                  <div className={secTitle}>Aspect ratio (A)</div>
                  {ASPECTS.map((o) => (
                    <button key={o.label} type="button" className={rowBtn} onClick={() => setViewFlash({ ...view, aspect: o.value }, `Aspect ratio: ${o.label}`)}>
                      <span>{o.label}</span>{check(o.value === view.aspect)}
                    </button>
                  ))}
                  <div className={`${secTitle} border-t border-white/10 mt-1`}>Crop (C)</div>
                  {CROPS.map((o) => (
                    <button key={o.label} type="button" className={rowBtn} onClick={() => setViewFlash({ ...view, crop: o.value }, o.label)}>
                      <span>{o.label}</span>{check(o.value === view.crop)}
                    </button>
                  ))}
                  <div className={`${secTitle} border-t border-white/10 mt-1`}>Zoom (Z)</div>
                  <div className="flex flex-wrap gap-1 px-3 pb-1">
                    {[0.5, 0.75, 1, 1.25, 1.5, 2].map((z) => (
                      <button key={z} type="button" onClick={() => setViewFlash({ ...view, zoom: z }, `Zoom: ${Math.round(z * 100)}%`)}
                        className={`px-2 h-7 rounded ${view.zoom === z ? 'bg-white/25' : 'bg-white/10 hover:bg-white/20'}`}>{Math.round(z * 100)}%</button>
                    ))}
                  </div>
                  <div className="px-3 pb-1">
                    <input type="range" min={0.5} max={3} step={0.01} value={view.zoom} aria-label="Zoom"
                      onChange={(e) => setView({ ...view, zoom: Number(e.target.value) })} className="w-full" />
                  </div>
                  <button type="button" className={`${rowBtn} border-t border-white/10 mt-1`} onClick={() => setViewFlash(DEFAULT_VIEW, 'Aspect, crop and zoom reset')}>
                    <span>Reset all (X)</span>
                  </button>
                </div>
              )}
            </div>

            <div className="group/vol flex items-center">
              <button type="button" className={iconBtn} onClick={onToggleMute} aria-label="Mute" title="Mute (M)">
                {muted || volume === 0 ? <VolumeX size={19} /> : <Volume2 size={19} />}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={muted ? 0 : volume}
                onChange={(e) => onChangeVolume(Number(e.target.value))}
                aria-label="Volume"
                style={{ background: `linear-gradient(to right, #fff ${volPct}%, rgba(255,255,255,0.3) ${volPct}%)` }}
                className="fluent-slider w-0 opacity-0 group-hover/vol:w-24 group-hover/vol:opacity-100 focus:w-24 focus:opacity-100 transition-all h-1 rounded-full mr-2"
              />
            </div>

            <button type="button" className={iconBtn} onClick={toggleFullscreen} aria-label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'} title="Fullscreen (F)">
              {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
            </button>
            <button type="button" className={iconBtn} onClick={onToggleMiniPlayer} aria-label="Mini player" title="Mini player">
              <PictureInPicture2 size={18} />
            </button>

            <div className="relative">
              <button type="button" className={iconBtn} onClick={() => setPanel(panel === 'more' ? null : 'more')} aria-label="More options" title="More">
                <MoreHorizontal size={19} />
              </button>
              {panel === 'more' && (
                <div role="menu" className={`${menuCls} right-0`}>
                  {streams.length > 1 && (
                    <>
                      <div className={secTitle}>Audio track</div>
                      {streams.map((a) => (
                        <button key={a.index} type="button" className={rowBtn} onClick={() => { setPanel(null); if (a.index !== activeAudio) onSelectAudioTrack(video.id, a.index); }}>
                          <span className="truncate">{a.label}{!isNativeAudio(a.codec) && <span className="ml-1 text-[11px] opacity-60">(converted)</span>}</span>
                          {check(a.index === activeAudio)}
                        </button>
                      ))}
                    </>
                  )}
                  <div className={`${secTitle} ${streams.length > 1 ? 'border-t border-white/10 mt-1' : ''}`}>Audio sync (J / K)</div>
                  <div className="px-3 pb-2 flex items-center gap-1.5">
                    <button type="button" className="px-2 h-7 rounded bg-white/10 hover:bg-white/20" onClick={() => onAdjustAudioDelay(-100)} title="Audio earlier">− 100</button>
                    <button type="button" className="px-2 h-7 rounded bg-white/10 hover:bg-white/20" onClick={() => onAdjustAudioDelay(-50)} title="Audio earlier">− 50</button>
                    <span className="flex-1 text-center text-[12px] tabular-nums">{audioDelayMs > 0 ? '+' : ''}{audioDelayMs} ms</span>
                    <button type="button" className="px-2 h-7 rounded bg-white/10 hover:bg-white/20" onClick={() => onAdjustAudioDelay(50)} title="Audio later">+ 50</button>
                    <button type="button" className="px-2 h-7 rounded bg-white/10 hover:bg-white/20" onClick={() => onAdjustAudioDelay(100)} title="Audio later">+ 100</button>
                  </div>
                  <div className="px-3 pb-1 text-[11px] text-white/50">Audio late? press − (earlier). Saved per audio track.</div>
                  <div className={`${secTitle} ${streams.length > 1 ? 'border-t border-white/10 mt-1' : ''}`}>Picture</div>
                  <button type="button" className={rowBtn} onClick={onToggleFitMode}>
                    <span className="flex items-center gap-2"><Scaling size={14} />{fitMode === 'contain' ? 'Fit to window' : 'Fill window'}</span>
                  </button>
                  {POST_FILTER_OPTIONS.map((o) => (
                    <button key={o.id} type="button" className={rowBtn} onClick={() => onChangePostFilter(o.id)}>
                      <span>{o.label}</span>{check(postFilter === o.id)}
                    </button>
                  ))}
                  {hwDecode !== null && (
                    <button type="button" className={`${rowBtn} border-t border-white/10 mt-1`} onClick={switchDecode}>
                      <span>Decoding: {hwDecode ? 'GPU (hardware)' : 'CPU (software)'}</span>
                      <span className="text-[11px] opacity-70">switch</span>
                    </button>
                  )}
                  <button type="button" className={`${rowBtn} border-t border-white/10 mt-1`} onClick={() => { setPanel(null); onOpenDetails(video); }}>
                    <span className="flex items-center gap-2"><Info size={14} />Video properties</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
