import {
  canDecodeVideo,
  containerIsNative,
  isVideoFile,
  NativeProbe,
  nativeApi,
  planPlayback,
  thumbToUrl,
  toAudioStreams,
  videoCodecLabel,
} from '@/src/media/native';
import { Search, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CollectionDetailView } from '@/src/components/CollectionDetailView';
import { CollectionsView } from '@/src/components/CollectionsView';
import { CreatorsView } from '@/src/components/CreatorsView';
import { EqualizerModal } from '@/src/components/EqualizerModal';
import { FoldersView } from '@/src/components/FoldersView';
import { MiniPlayer } from '@/src/components/MiniPlayer';
import { PlayerBar } from '@/src/components/PlayerBar';
import { PlaylistsView } from '@/src/components/PlaylistsView';
import { QueueView } from '@/src/components/QueueView';
import { SettingsView } from '@/src/components/SettingsView';
import { Sidebar } from '@/src/components/Sidebar';
import { VideoDetailsModal } from '@/src/components/VideoDetailsModal';
import { VideoStageView } from '@/src/components/VideoStageView';
import { VideosView } from '@/src/components/VideosView';
import {
  INITIAL_COLLECTIONS,
  INITIAL_CREATORS,
  INITIAL_PLAYLISTS,
  INITIAL_VIDEOS,
  SAMPLE_FOLDER_ID,
  SAMPLE_FOLDER_LOCATION,
} from '@/src/data/videoLibrary';
import { mediaEngine } from '@/src/media/MediaEngine';
import {
  AccentTheme,
  ActiveSection,
  CaptionCue,
  CollectionSortOption,
  CollectionViewMode,
  Creator,
  CreatorViewMode,
  EQ_PRESET_GAINS,
  EqPreset,
  LibraryFolderLocation,
  RepeatMode,
  SubtitleTrack,
  ThemeMode,
  VideoCollection,
  VideoFilterMode,
  VideoFitMode,
  VideoItem,
  VideoPlaylist,
} from '@/src/types/video';
import { ACCENT_PALETTES } from '@/src/utils/accent';
import { sanitizeTitleFromFilename } from '@/src/utils/format';
import { parseVttContent, parseVttFilenameInfo } from '@/src/utils/vtt';

function shuffleArray<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function inferVideoCodecLabel(file: File): string {
  const ext = file.name.split('.').pop()?.toUpperCase();
  if (ext === 'MP4' || ext === 'M4V') return 'H.264 / HEVC (MP4)';
  if (ext === 'WEBM') return 'VP9 / AV1 (WebM)';
  if (ext === 'MOV') return 'QuickTime (MOV)';
  if (ext === 'MKV') return 'Matroska (MKV)';
  if (ext === 'AVI') return 'AVI Video';
  if (ext === 'OGV') return 'Ogg Theora (OGV)';
  return file.type || 'Video file';
}

function computeAspectRatio(w: number, h: number): string {
  if (!w || !h) return '16:9';
  const ratio = w / h;
  if (Math.abs(ratio - 16 / 9) < 0.08) return '16:9';
  if (Math.abs(ratio - 4 / 3) < 0.08) return '4:3';
  if (Math.abs(ratio - 21 / 9) < 0.12) return '21:9';
  if (Math.abs(ratio - 9 / 16) < 0.08) return '9:16';
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  const d = gcd(w, h);
  return `${Math.round(w / d)}:${Math.round(h / d)}`;
}

interface ExtractedVideoMetadata {
  duration: number;
  width: number;
  height: number;
  thumbnailUrl?: string;
}

function readLocalVideoMetadata(url: string): Promise<ExtractedVideoMetadata> {
  return new Promise((resolve) => {
    const probe = document.createElement('video');
    probe.preload = 'metadata';
    probe.muted = true;
    probe.playsInline = true;

    let settled = false;
    const finish = (meta: ExtractedVideoMetadata) => {
      if (settled) return;
      settled = true;
      probe.removeAttribute('src');
      probe.load();
      resolve(meta);
    };

    const timer = window.setTimeout(() => {
      finish({ duration: 60, width: 1920, height: 1080 });
    }, 3500);

    probe.onloadedmetadata = () => {
      const dur =
        Number.isFinite(probe.duration) && probe.duration > 0 ? Math.round(probe.duration) : 60;
      const w = probe.videoWidth || 1920;
      const h = probe.videoHeight || 1080;
      const seekTarget = Math.min(1.5, Math.max(0.1, dur * 0.1));
      probe.currentTime = seekTarget;

      probe.onseeked = () => {
        window.clearTimeout(timer);
        let thumbnailUrl: string | undefined;
        try {
          const canvas = document.createElement('canvas');
          canvas.width = 480;
          canvas.height = Math.max(180, Math.round((480 * h) / Math.max(1, w)));
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(probe, 0, 0, canvas.width, canvas.height);
            thumbnailUrl = canvas.toDataURL('image/jpeg', 0.8);
          }
        } catch {
          thumbnailUrl = undefined;
        }
        finish({ duration: dur, width: w, height: h, thumbnailUrl });
      };
    };

    probe.onerror = () => {
      window.clearTimeout(timer);
      finish({ duration: 60, width: 1920, height: 1080 });
    };

    probe.src = url;
  });
}

function getFileRelDirAndName(file: File): { dir: string; name: string; stem: string } {
  const relPath = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
  const parts = relPath.split('/').filter(Boolean);
  const fileName = parts.pop() || file.name;
  const dir = parts.join('/');
  const dotIdx = fileName.lastIndexOf('.');
  const stem = dotIdx > 0 ? fileName.slice(0, dotIdx) : fileName;
  return { dir, name: fileName, stem };
}

// Files opened from outside the page (Open with..., double-click) remember their disk path here.
const filePathHints = new WeakMap<File, string>();

export default function App() {
  // Library state — starts empty until a folder location is added in Settings
  const [libraryFolders, setLibraryFolders] = useState<LibraryFolderLocation[]>([]);
  const [collections, setCollections] = useState<VideoCollection[]>([]);
  const [creators, setCreators] = useState<Creator[]>([]);
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [playlists, setPlaylists] = useState<VideoPlaylist[]>(INITIAL_PLAYLISTS);
  const [favorites, setFavorites] = useState<Set<string>>(() => new Set());

  // Navigation & view state
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeSection, setActiveSection] = useState<ActiveSection>('folders');
  const [previousSection, setPreviousSection] = useState<ActiveSection>('folders');
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
  const [selectedCreatorId, setSelectedCreatorId] = useState<string | null>(null);
  const [activePlaylistId, setActivePlaylistId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // Mini Player, Video Details Modal, Equalizer Modal & Stage Preferences
  const [isMiniPlayer, setIsMiniPlayer] = useState(false);
  const [detailsVideo, setDetailsVideo] = useState<VideoItem | null>(null);
  const [showEqualizer, setShowEqualizer] = useState(false);
  const [fitMode, setFitMode] = useState<VideoFitMode>('contain');
  const [postFilter, setPostFilter] = useState<VideoFilterMode>('none');

  // Collections & Creators view options
  const [collectionViewMode, setCollectionViewMode] = useState<CollectionViewMode>('medium');
  const [collectionSortBy, setCollectionSortBy] = useState<CollectionSortOption>('title-asc');
  const [creatorViewMode, setCreatorViewMode] = useState<CreatorViewMode>('grid');

  // Theme & Accent
  const [theme, setTheme] = useState<ThemeMode>('dark');
  const [accent, setAccent] = useState<AccentTheme>('sky');

  // Playback state
  const [queue, setQueue] = useState<VideoItem[]>([]);
  const [currentVideoIndex, setCurrentVideoIndex] = useState<number>(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [muted, setMuted] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('all');
  const [playbackRate, setPlaybackRate] = useState(1);

  // 10-band Custom Equalizer state
  const [eqPreset, setEqPreset] = useState<EqPreset>('flat');
  const [eqBands, setEqBands] = useState<number[]>(() => [...EQ_PRESET_GAINS.flat]);
  const [eqEnabled, setEqEnabled] = useState(true);

  // Toast feedback, hidden video host & Settings folder picker
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);
  const videoHostRef = useRef<HTMLDivElement | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const [hdrEnabled, setHdrEnabled] = useState<boolean>(() => {
    try { return localStorage.getItem('vp-hdr') === '1'; } catch { return false; }
  });

  const palette = ACCENT_PALETTES[accent];

  const currentVideo =
    currentVideoIndex >= 0 && currentVideoIndex < queue.length ? queue[currentVideoIndex] : null;
  const currentVideoId = currentVideo?.id ?? null;

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
      setToastMessage(null);
    }, 2600);
  }, []);

  // Sync theme class with <html>
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  // Apply webkitdirectory attribute cleanly to Settings folder picker input
  useEffect(() => {
    if (folderInputRef.current) {
      folderInputRef.current.setAttribute('webkitdirectory', '');
      folderInputRef.current.setAttribute('directory', '');
    }
  }, []);

  // Keep MediaEngine's HTMLVideoElement mounted invisibly so hardware frame decoding continues cleanly
  useEffect(() => {
    const host = videoHostRef.current;
    const videoEl = mediaEngine.getVideoElement();
    if (host && videoEl.parentElement !== host) {
      videoEl.className = 'w-2 h-2 pointer-events-none';
      host.appendChild(videoEl);
    }
  }, []);

  // Play video helper
  const playVideoAtQueueIndex = useCallback(
    (idx: number, queueOverride?: VideoItem[], openStage = false) => {
      const targetQueue = queueOverride || queue;
      const item = targetQueue[idx];
      if (!item) return;

      setCurrentVideoIndex(idx);
      setCurrentTime(0);
      setDuration(item.duration);
      setIsPlaying(true);
      mediaEngine.loadAndPlay(item, volume, muted, playbackRate, eqBands, eqEnabled);

      if (openStage && !isMiniPlayer) {
        setActiveSection((prev) => {
          if (prev !== 'player') setPreviousSection(prev);
          return 'player';
        });
      }
    },
    [queue, volume, muted, playbackRate, eqBands, eqEnabled, isMiniPlayer]
  );

  // Next / Prev handlers
  const handleNext = useCallback(() => {
    if (queue.length === 0) return;

    if (repeatMode === 'one') {
      mediaEngine.seek(0);
      mediaEngine.play();
      return;
    }

    if (shuffle && queue.length > 1) {
      let nextIdx = currentVideoIndex;
      while (nextIdx === currentVideoIndex) {
        nextIdx = Math.floor(Math.random() * queue.length);
      }
      playVideoAtQueueIndex(nextIdx, undefined, false);
      return;
    }

    const nextIdx = currentVideoIndex + 1;
    if (nextIdx < queue.length) {
      playVideoAtQueueIndex(nextIdx, undefined, false);
    } else if (repeatMode === 'all') {
      playVideoAtQueueIndex(0, undefined, false);
    } else {
      mediaEngine.pause();
      setIsPlaying(false);
    }
  }, [queue.length, repeatMode, shuffle, currentVideoIndex, playVideoAtQueueIndex]);

  const handlePrev = useCallback(() => {
    if (queue.length === 0) return;
    if (currentTime > 3) {
      mediaEngine.seek(0);
      setCurrentTime(0);
      return;
    }
    const prevIdx = currentVideoIndex - 1;
    if (prevIdx >= 0) {
      playVideoAtQueueIndex(prevIdx, undefined, false);
    } else if (repeatMode === 'all') {
      playVideoAtQueueIndex(queue.length - 1, undefined, false);
    } else {
      mediaEngine.seek(0);
      setCurrentTime(0);
    }
  }, [queue.length, currentTime, currentVideoIndex, repeatMode, playVideoAtQueueIndex]);

  // Attach listeners to both audio & video elements managed by MediaEngine
  useEffect(() => {
    const audioEl = mediaEngine.getAudioElement();
    const videoEl = mediaEngine.getVideoElement();

    const syncEmbeddedTextTracks = () => {
      if (!currentVideoId || mediaEngine.getActiveElement() !== videoEl) return;
      const trackList = videoEl.textTracks;
      if (!trackList || trackList.length === 0) return;

      const discovered: SubtitleTrack[] = [];
      for (let i = 0; i < trackList.length; i++) {
        const tt = trackList[i];
        tt.mode = 'hidden';
        const cueList = tt.cues;
        const cues: CaptionCue[] = [];
        if (cueList) {
          for (let j = 0; j < cueList.length; j++) {
            const cue = cueList[j] as VTTCue;
            if (typeof cue.text === 'string' && cue.text.trim()) {
              cues.push({
                startSec: cue.startTime,
                endSec: cue.endTime,
                text: cue.text.trim(),
              });
            }
          }
        }
        if (cues.length > 0) {
          discovered.push({
            id: `embedded-${currentVideoId}-${i}`,
            label: tt.label || (tt.language ? `Embedded (${tt.language})` : `Track ${i + 1}`),
            language: tt.language || undefined,
            kind: 'embedded',
            cues,
          });
        }
      }

      if (discovered.length === 0) return;

      const mergeTracks = (item: VideoItem): VideoItem => {
        if (item.id !== currentVideoId) return item;
        const existing = item.subtitleTracks ?? [];
        const existingIds = new Set(existing.map((t) => t.id));
        const additions = discovered.filter((t) => !existingIds.has(t.id));
        if (additions.length === 0) return item;
        const combined = [...existing, ...additions];
        return {
          ...item,
          subtitleTracks: combined,
          activeSubtitleId:
            item.activeSubtitleId === undefined ? combined[0]?.id ?? null : item.activeSubtitleId,
        };
      };

      setVideos((prev) => prev.map(mergeTracks));
      setQueue((prev) => prev.map(mergeTracks));
    };

    const makeHandlers = (el: HTMLMediaElement) => ({
      onTimeUpdate: () => {
        if (mediaEngine.getActiveElement() !== el) return;
        setCurrentTime(el.currentTime || 0);
      },
      onLoadedMetadata: () => {
        if (mediaEngine.getActiveElement() !== el) return;
        if (Number.isFinite(el.duration) && el.duration > 0) {
          setDuration(el.duration);
        }
        if (el === videoEl) {
          syncEmbeddedTextTracks();
        }
      },
      onPlay: () => {
        if (mediaEngine.getActiveElement() !== el) return;
        setIsPlaying(true);
      },
      onPause: () => {
        if (mediaEngine.getActiveElement() !== el) return;
        setIsPlaying(false);
      },
      onEnded: () => {
        if (mediaEngine.getActiveElement() !== el) return;
        handleNext();
      },
    });

    const audioHandlers = makeHandlers(audioEl);
    const videoHandlers = makeHandlers(videoEl);

    const bind = (el: HTMLMediaElement, h: ReturnType<typeof makeHandlers>) => {
      el.addEventListener('timeupdate', h.onTimeUpdate);
      el.addEventListener('loadedmetadata', h.onLoadedMetadata);
      el.addEventListener('play', h.onPlay);
      el.addEventListener('pause', h.onPause);
      el.addEventListener('ended', h.onEnded);
    };

    const unbind = (el: HTMLMediaElement, h: ReturnType<typeof makeHandlers>) => {
      el.removeEventListener('timeupdate', h.onTimeUpdate);
      el.removeEventListener('loadedmetadata', h.onLoadedMetadata);
      el.removeEventListener('play', h.onPlay);
      el.removeEventListener('pause', h.onPause);
      el.removeEventListener('ended', h.onEnded);
    };

    bind(audioEl, audioHandlers);
    bind(videoEl, videoHandlers);

    return () => {
      unbind(audioEl, audioHandlers);
      unbind(videoEl, videoHandlers);
    };
  }, [handleNext, currentVideoId]);

  const handleTogglePlayPause = useCallback(() => {
    if (!currentVideo) return;
    const activeEl = mediaEngine.getActiveElement();
    if (!activeEl.src) {
      mediaEngine.loadAndPlay(currentVideo, volume, muted, playbackRate, eqBands, eqEnabled);
      setIsPlaying(true);
      return;
    }
    if (isPlaying) {
      mediaEngine.pause();
    } else {
      mediaEngine.play();
    }
  }, [currentVideo, isPlaying, volume, muted, playbackRate, eqBands, eqEnabled]);

  // Keyboard shortcuts: Space play/pause, arrows seek/volume, N/P next/prev, M mute
  useEffect(() => {
    const isTextField = (t: HTMLElement | null) => {
      if (!t) return false;
      if (t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable) return true;
      if (t.tagName === 'INPUT') {
        const type = (t as HTMLInputElement).type;
        return !['range', 'checkbox', 'radio', 'button'].includes(type);
      }
      return false;
    };
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (isTextField(target) || e.ctrlKey || e.metaKey || e.altKey) return;
      const seekBy = (d: number) => {
        const el = mediaEngine.getActiveElement();
        mediaEngine.seek(Math.max(0, Math.min((el.duration || 0) || 1e9, el.currentTime + d)));
      };
      switch (e.code) {
        case 'Space':
          e.preventDefault();
          if (target && (target.tagName === 'BUTTON' || target.tagName === 'INPUT')) target.blur();
          handleTogglePlayPause();
          break;
        case 'ArrowRight':
          if (target?.tagName === 'INPUT') return;
          e.preventDefault();
          seekBy(e.shiftKey ? 30 : 5);
          break;
        case 'ArrowLeft':
          if (target?.tagName === 'INPUT') return;
          e.preventDefault();
          seekBy(e.shiftKey ? -30 : -5);
          break;
        case 'ArrowUp':
          if (target?.tagName === 'INPUT') return;
          e.preventDefault();
          setVolume((v) => Math.min(1, +(v + 0.05).toFixed(2)));
          break;
        case 'ArrowDown':
          if (target?.tagName === 'INPUT') return;
          e.preventDefault();
          setVolume((v) => Math.max(0, +(v - 0.05).toFixed(2)));
          break;
        case 'KeyN':
          handleNext();
          break;
        case 'KeyP':
          handlePrev();
          break;
        case 'KeyM':
          setMuted((m) => !m);
          break;
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !isTextField(e.target as HTMLElement | null)) e.preventDefault();
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [handleTogglePlayPause, handleNext, handlePrev]);

  // Play video with context queue
  const handlePlayVideo = useCallback(
    (item: VideoItem, contextVideos: VideoItem[]) => {
      const list = contextVideos.length > 0 ? contextVideos : [item];
      const idx = list.findIndex((v) => v.id === item.id);
      const startIndex = idx >= 0 ? idx : 0;
      setQueue(list);
      playVideoAtQueueIndex(startIndex, list, true);
    },
    [playVideoAtQueueIndex]
  );

  const handlePlayAll = useCallback(
    (list: VideoItem[], shouldShuffle = false, openStage = true) => {
      if (list.length === 0) return;
      const ordered = shouldShuffle ? shuffleArray(list) : [...list];
      setShuffle(shouldShuffle);
      setQueue(ordered);
      playVideoAtQueueIndex(0, ordered, openStage);
    },
    [playVideoAtQueueIndex]
  );

  const handlePlayCollection = useCallback(
    (collectionId: string, shouldShuffle = false) => {
      const colVideos = videos
        .filter((v) => v.collectionId === collectionId)
        .sort((a, b) => a.episodeNumber - b.episodeNumber);
      handlePlayAll(colVideos, shouldShuffle, true);
    },
    [videos, handlePlayAll]
  );

  const handlePlayCreator = useCallback(
    (creatorId: string, shouldShuffle = false) => {
      const creatorVideos = videos.filter((v) => v.creatorId === creatorId);
      handlePlayAll(creatorVideos, shouldShuffle, true);
    },
    [videos, handlePlayAll]
  );

  const handleAddVideoToQueue = useCallback(
    (item: VideoItem) => {
      setQueue((prev) => {
        const next = [...prev, item];
        if (prev.length === 0) {
          playVideoAtQueueIndex(0, next, false);
        }
        return next;
      });
      showToast(`Added "${item.title}" to queue`);
    },
    [playVideoAtQueueIndex, showToast]
  );

  const handleAddCollectionToQueue = useCallback(
    (collectionId: string) => {
      const colVideos = videos
        .filter((v) => v.collectionId === collectionId)
        .sort((a, b) => a.episodeNumber - b.episodeNumber);
      if (colVideos.length === 0) return;
      setQueue((prev) => [...prev, ...colVideos]);
      showToast(`Added ${colVideos.length} videos to queue`);
    },
    [videos, showToast]
  );

  const handleToggleFavorite = useCallback((videoId: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(videoId)) {
        next.delete(videoId);
      } else {
        next.add(videoId);
      }
      return next;
    });
  }, []);

  const handleCreatePlaylist = useCallback(
    (name: string) => {
      const newPl: VideoPlaylist = {
        id: `pl-${Date.now()}`,
        name,
        videoIds: [],
        createdAt: Date.now(),
      };
      setPlaylists((prev) => [...prev, newPl]);
      setActiveSection('playlists');
      setActivePlaylistId(newPl.id);
      setSelectedCollectionId(null);
      setSelectedCreatorId(null);
      showToast(`Created playlist "${name}"`);
    },
    [showToast]
  );

  const handleAddVideoToPlaylist = useCallback(
    (playlistId: string, videoId: string) => {
      let playlistName = '';
      setPlaylists((prev) =>
        prev.map((pl) => {
          if (pl.id !== playlistId) return pl;
          playlistName = pl.name;
          if (pl.videoIds.includes(videoId)) return pl;
          return { ...pl, videoIds: [...pl.videoIds, videoId] };
        })
      );
      if (playlistName) {
        showToast(`Added to "${playlistName}"`);
      }
    },
    [showToast]
  );

  const handleRemoveVideoFromPlaylist = useCallback((playlistId: string, videoId: string) => {
    setPlaylists((prev) =>
      prev.map((pl) =>
        pl.id === playlistId
          ? { ...pl, videoIds: pl.videoIds.filter((id) => id !== videoId) }
          : pl
      )
    );
  }, []);

  const handleRenamePlaylist = useCallback((playlistId: string, newName: string) => {
    setPlaylists((prev) =>
      prev.map((pl) => (pl.id === playlistId ? { ...pl, name: newName } : pl))
    );
  }, []);

  const handleDeletePlaylist = useCallback((playlistId: string) => {
    setPlaylists((prev) => prev.filter((pl) => pl.id !== playlistId));
    setActivePlaylistId(null);
    setActiveSection('collections');
  }, []);

  const handleToggleHdr = useCallback(() => {
    setHdrEnabled((prev) => {
      const next = !prev;
      try { localStorage.setItem('vp-hdr', next ? '1' : '0'); } catch { /* ignore */ }
      if (next && !window.matchMedia('(dynamic-range: high)').matches) {
        showToast('HDR on. Turn on "Use HDR" for this display in Windows Settings > Display for the full effect');
      } else {
        showToast(next ? 'HDR on' : 'HDR off');
      }
      return next;
    });
  }, [showToast]);

  const handleSelectAudioTrack = useCallback(
    (videoId: string, audioIndex: number) => {
      const updateItem = (item: VideoItem): VideoItem =>
        item.id === videoId ? { ...item, activeAudioIndex: audioIndex } : item;
      setVideos((prev) => prev.map(updateItem));
      setDetailsVideo((prev) => (prev ? updateItem(prev) : null));
      const updatedQueue = queue.map(updateItem);
      setQueue(updatedQueue);
      const item = updatedQueue.find((v) => v.id === videoId);
      if (item && item.id === currentVideoId) {
        const at = mediaEngine.getActiveElement().currentTime || currentTime;
        setIsPlaying(true);
        mediaEngine.loadAndPlay(item, volume, muted, playbackRate, eqBands, eqEnabled, at);
      }
    },
    [queue, currentVideoId, currentTime, volume, muted, playbackRate, eqBands, eqEnabled]
  );

  // Conversion progress / errors from the playback engine
  useEffect(() => {
    return mediaEngine.onPrepareStatus((st) => {
      if (st.type === 'progress') {
        showToast(`Preparing "${st.title}" for playback… ${Math.round(st.progress * 100)}%`);
      } else if (st.type === 'error') {
        showToast(`Could not play "${st.title}": ${st.message}`);
        setIsPlaying(false);
      } else {
        setToastMessage(null);
      }
    });
  }, [showToast]);

  // Lazily extract embedded text subtitles of the current video
  useEffect(() => {
    const api = nativeApi();
    const v = currentVideo;
    if (!api || !v || !v.sourcePath || v.subtitlesExtracted || !v.textSubtitleCount) return;
    let cancelled = false;
    (async () => {
      try {
        const vtts = await api.subtitles(v.sourcePath!, v.textSubtitleCount!);
        if (cancelled) return;
        const tracks: SubtitleTrack[] = [];
        vtts.forEach((text, i) => {
          const cues = parseVttContent(text);
          if (cues.length) {
            tracks.push({
              id: `${v.id}-emb-${i}`,
              label: `Embedded subtitle ${i + 1}`,
              kind: 'embedded',
              cues,
            });
          }
        });
        const upd = (item: VideoItem): VideoItem =>
          item.id === v.id
            ? {
                ...item,
                subtitlesExtracted: true,
                subtitleTracks: [...(item.subtitleTracks ?? []), ...tracks],
                activeSubtitleId: item.activeSubtitleId ?? tracks[0]?.id ?? null,
              }
            : item;
        setVideos((prev) => prev.map(upd));
        setQueue((prev) => prev.map(upd));
        setDetailsVideo((prev) => (prev ? upd(prev) : null));
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, [currentVideoId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Subtitle selection & manual .vtt attachment handlers
  const handleSelectSubtitleTrack = useCallback((videoId: string, subtitleId: string | null) => {
    const updateItem = (item: VideoItem): VideoItem =>
      item.id === videoId ? { ...item, activeSubtitleId: subtitleId } : item;

    setVideos((prev) => prev.map(updateItem));
    setQueue((prev) => prev.map(updateItem));
    setDetailsVideo((prev) => (prev ? updateItem(prev) : null));
  }, []);

  const handleAttachVttFile = useCallback(
    async (videoId: string, file: File) => {
      try {
        const text = await file.text();
        const cues = parseVttContent(text);
        if (cues.length === 0) {
          showToast(`No valid cues found in "${file.name}"`);
          return;
        }
        const info = parseVttFilenameInfo(file.name);
        const newTrack: SubtitleTrack = {
          id: `vtt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          label: info.label,
          language: info.language,
          kind: 'vtt',
          sourceName: file.name,
          cues,
        };

        const appendTrack = (item: VideoItem): VideoItem => {
          if (item.id !== videoId) return item;
          const existing = item.subtitleTracks ?? [];
          return {
            ...item,
            subtitleTracks: [...existing, newTrack],
            activeSubtitleId: newTrack.id,
          };
        };

        setVideos((prev) => prev.map(appendTrack));
        setQueue((prev) => prev.map(appendTrack));
        setDetailsVideo((prev) => (prev ? appendTrack(prev) : null));
        showToast(`Loaded subtitle track "${newTrack.label}"`);
      } catch {
        showToast(`Unable to read "${file.name}"`);
      }
    },
    [showToast]
  );

  // Settings -> Add Local Folder Location (indexes videos + sidecar .vtt subtitle tracks)
  const handleAddLocalFolderLocation = useCallback(
    async (fileList: FileList) => {
      const allFiles = Array.from(fileList);
      const videoFiles = allFiles.filter(isVideoFile);

      if (videoFiles.length === 0) {
        showToast('No supported video files found in the selected folder');
        return;
      }

      const vttFiles = allFiles.filter((f) => /\.vtt$/i.test(f.name));
      const vttByDirAndStem = new Map<string, SubtitleTrack[]>();
      const vttByStem = new Map<string, SubtitleTrack[]>();

      for (const vttFile of vttFiles) {
        try {
          const text = await vttFile.text();
          const cues = parseVttContent(text);
          if (cues.length === 0) continue;

          const { dir, name } = getFileRelDirAndName(vttFile);
          const info = parseVttFilenameInfo(name);
          const track: SubtitleTrack = {
            id: `vtt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            label: info.label,
            language: info.language,
            kind: 'vtt',
            sourceName: name,
            cues,
          };

          const dirKey = `${dir.toLowerCase()}::${info.videoStem.toLowerCase()}`;
          vttByDirAndStem.set(dirKey, [...(vttByDirAndStem.get(dirKey) ?? []), track]);

          const stemKey = info.videoStem.toLowerCase();
          vttByStem.set(stemKey, [...(vttByStem.get(stemKey) ?? []), track]);
        } catch {
          // Ignore unreadable .vtt file
        }
      }

      const firstRel =
        (videoFiles[0] as File & { webkitRelativePath?: string }).webkitRelativePath || '';
      const rootFolderName = firstRel.split('/').filter(Boolean)[0] || 'Local Video Folder';
      const folderLocationId = `loc-local-${Date.now()}`;
      const localCreatorId = `cr-${folderLocationId}`;

      const newCreator: Creator = {
        id: localCreatorId,
        name: rootFolderName,
        bio: `Local directory "${rootFolderName}" added in Video Player Settings.`,
        folderLocationId,
      };

      const folderCollectionMap = new Map<string, VideoCollection>();
      const importedVideos: VideoItem[] = [];

      const sortedFiles = [...videoFiles].sort((a, b) => {
        const pathA = (a as File & { webkitRelativePath?: string }).webkitRelativePath || a.name;
        const pathB = (b as File & { webkitRelativePath?: string }).webkitRelativePath || b.name;
        return pathA.localeCompare(pathB);
      });

      // Desktop app: read every file with the bundled ffmpeg (any codec/container), 3 at a time.
      const api = nativeApi();
      const probes = new Map<File, NativeProbe | null>();
      if (api) {
        let next = 0;
        const worker = async () => {
          while (next < sortedFiles.length) {
            const f = sortedFiles[next++];
            const path = filePathHints.get(f) || api.getPathForFile(f);
            if (!path) {
              probes.set(f, null);
              continue;
            }
            try {
              const pr = await api.analyze(path);
              probes.set(f, pr.ok && pr.video ? pr : null);
            } catch {
              probes.set(f, null);
            }
          }
        };
        showToast(`Reading ${sortedFiles.length} video${sortedFiles.length === 1 ? '' : 's'}…`);
        await Promise.all(Array.from({ length: Math.min(3, sortedFiles.length) }, worker));
      }

      let episodeSeq = 1;
      for (const file of sortedFiles) {
        const probe = probes.get(file) ?? null;
        const srcPath = (api && (filePathHints.get(file) || api.getPathForFile(file))) || '';
        let objectUrl: string | undefined;
        let meta: ExtractedVideoMetadata;
        if (probe && probe.video && api) {
          objectUrl = await api.mediaUrl(srcPath);
          meta = {
            duration: Math.max(1, Math.round(probe.duration || 60)),
            width: probe.video.width || 1920,
            height: probe.video.height || 1080,
            thumbnailUrl: thumbToUrl(probe.thumbnail),
          };
        } else {
          objectUrl = URL.createObjectURL(file);
          meta = await readLocalVideoMetadata(objectUrl);
        }
        const pv = probe?.video ?? null;
        const audioStreams = probe ? toAudioStreams(probe) : undefined;
        const defaultAudio = audioStreams?.find((a) => a.isDefault) ?? audioStreams?.[0];
        const videoNative = pv ? await canDecodeVideo(pv) : undefined;
        const fileBytes = file.size || probe?.size || 0;
        const { dir, name, stem } = getFileRelDirAndName(file);
        const rawName = sanitizeTitleFromFilename(name);
        const dashSplit = rawName.split(' - ');
        const parsedCreator = dashSplit.length >= 2 ? dashSplit[0].trim() : rootFolderName;
        const parsedTitle =
          dashSplit.length >= 2 ? dashSplit.slice(1).join(' - ').trim() : rawName;

        const estimatedTotalKbps =
          meta.duration > 0 ? Math.round((fileBytes * 8) / (meta.duration * 1000)) : 4500;
        const audioBitrateKbps =
          defaultAudio?.bitrateKbps ?? Math.min(320, Math.max(128, Math.round(estimatedTotalKbps * 0.08)));
        const videoBitrateKbps = pv?.bitrateKbps ?? Math.max(250, estimatedTotalKbps - audioBitrateKbps);

        const folderPath = dir ? dir.split('/').join(' / ') : rootFolderName;
        const leafFolderName = dir.split('/').filter(Boolean).pop() || rootFolderName;

        let col = folderCollectionMap.get(folderPath);
        if (!col) {
          col = {
            id: `col-${folderLocationId}-${folderCollectionMap.size + 1}`,
            title: leafFolderName,
            creatorId: localCreatorId,
            creator: rootFolderName,
            year: new Date().getFullYear(),
            thumbnailUrl: meta.thumbnailUrl,
            accentHex: '#38bdf8',
            addedAt: Date.now(),
            description: `Videos inside "${folderPath}".`,
            folderLocationId,
          };
          folderCollectionMap.set(folderPath, col);
        } else if (!col.thumbnailUrl && meta.thumbnailUrl) {
          col.thumbnailUrl = meta.thumbnailUrl;
        }

        const matchedSubtitles =
          vttByDirAndStem.get(`${dir.toLowerCase()}::${stem.toLowerCase()}`) ??
          vttByStem.get(stem.toLowerCase()) ??
          [];

        importedVideos.push({
          id: `local-vid-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          episodeNumber: episodeSeq++,
          title: parsedTitle,
          creatorId: localCreatorId,
          creator: parsedCreator,
          collectionId: col.id,
          collection: col.title,
          year: new Date().getFullYear(),
          duration: meta.duration,
          thumbnailUrl: meta.thumbnailUrl,
          videoUrl: objectUrl,
          isLocal: true,
          folderLocationId,
          folderPath,
          fileName: name,
          fileSizeBytes: fileBytes,
          sourcePath: srcPath || undefined,
          isHdr: Boolean(pv?.hdr),
          hdrFormat: pv?.hdr || undefined,
          videoNative,
          containerNative: pv ? containerIsNative(name, pv.codec) : undefined,
          audioStreams,
          activeAudioIndex: audioStreams
            ? Math.max(0, audioStreams.findIndex((a) => a.isDefault))
            : undefined,
          textSubtitleCount: probe ? probe.subtitles.filter((x) => x.text).length : undefined,
          resolution: `${meta.width} × ${meta.height}`,
          frameRate: pv?.fps ? `${Math.round(pv.fps * 100) / 100} fps` : '30 fps',
          videoBitrateKbps,
          audioBitrateKbps,
          sampleRateHz: defaultAudio?.sampleRateHz ?? 48000,
          codec: pv && probe ? videoCodecLabel(pv, probe.container || name.split('.').pop() || '', pv.hdr) : inferVideoCodecLabel(file),
          aspectRatio: computeAspectRatio(meta.width, meta.height),
          channels: defaultAudio
            ? defaultAudio.channels === 1
              ? '1 (Mono)'
              : defaultAudio.channels === 2
                ? '2 (Stereo)'
                : `${defaultAudio.channels} (${defaultAudio.layout || 'Surround'})`
            : '2 (Stereo)',
          director: parsedCreator,
          cameraSpecs: 'Local Media File',
          subtitleTracks: matchedSubtitles.length > 0 ? matchedSubtitles : undefined,
          activeSubtitleId: matchedSubtitles[0]?.id ?? null,
          about: `Local video file "${name}" imported from folder location "${folderPath}".`,
        });
      }

      if (!newCreator.thumbnailUrl && importedVideos[0]?.thumbnailUrl) {
        newCreator.thumbnailUrl = importedVideos[0].thumbnailUrl;
      }

      const newLocation: LibraryFolderLocation = {
        id: folderLocationId,
        name: rootFolderName,
        path: rootFolderName,
        source: 'local',
        videoCount: importedVideos.length,
        addedAt: Date.now(),
      };

      setLibraryFolders((prev) => [...prev, newLocation]);
      setCreators((prev) => [...prev, newCreator]);
      setCollections((prev) => [...prev, ...Array.from(folderCollectionMap.values())]);
      setVideos((prev) => [...prev, ...importedVideos]);

      const totalVttCount = importedVideos.reduce(
        (sum, v) => sum + (v.subtitleTracks?.length ?? 0),
        0
      );
      showToast(
        `Added folder "${rootFolderName}" (${importedVideos.length} ${
          importedVideos.length === 1 ? 'video' : 'videos'
        }${totalVttCount > 0 ? `, ${totalVttCount} .vtt` : ''})`
      );
      return importedVideos;
    },
    [showToast]
  );

  // "Open with" / double-click on a video file in Explorer
  const openFilesRef = useRef<(paths: string[]) => void>(() => {});
  openFilesRef.current = async (paths: string[]) => {
    const files = paths.map((p) => {
      const f = new File([], p.split(/[\\/]/).pop() || 'video');
      filePathHints.set(f, p);
      return f;
    });
    const dt = new DataTransfer();
    files.forEach((f) => dt.items.add(f));
    const imported = await handleAddLocalFolderLocation(dt.files);
    if (imported && imported.length > 0) {
      playVideoAtQueueIndex(0, imported, true);
      setQueue(imported);
    }
  };
  useEffect(() => {
    const api = nativeApi();
    if (!api) return;
    return api.onOpenFiles((paths) => openFilesRef.current(paths));
  }, []);

  // Settings -> Explicitly add sample 4K cinema folder location
  const handleAddSampleFolderLocation = useCallback(() => {
    if (libraryFolders.some((f) => f.id === SAMPLE_FOLDER_ID)) {
      showToast('Sample cinema folder is already added');
      return;
    }

    setLibraryFolders((prev) => [...prev, { ...SAMPLE_FOLDER_LOCATION, addedAt: Date.now() }]);
    setCreators((prev) => [...prev, ...INITIAL_CREATORS]);
    setCollections((prev) => [...prev, ...INITIAL_COLLECTIONS]);
    setVideos((prev) => [...prev, ...INITIAL_VIDEOS]);
    showToast(`Added "${SAMPLE_FOLDER_LOCATION.name}" (${INITIAL_VIDEOS.length} videos)`);
  }, [libraryFolders, showToast]);

  // Settings -> Remove folder location & clean up its videos/collections/creators/queue
  const handleRemoveFolderLocation = useCallback(
    (folderId: string) => {
      const removedVideoIds = new Set(
        videos.filter((v) => v.folderLocationId === folderId).map((v) => v.id)
      );

      for (const v of videos) {
        if (v.folderLocationId === folderId && v.videoUrl?.startsWith('blob:')) {
          URL.revokeObjectURL(v.videoUrl);
        }
      }

      const folderObj = libraryFolders.find((f) => f.id === folderId);
      setLibraryFolders((prev) => prev.filter((f) => f.id !== folderId));
      setVideos((prev) => prev.filter((v) => v.folderLocationId !== folderId));
      setCollections((prev) => prev.filter((c) => c.folderLocationId !== folderId));
      setCreators((prev) => prev.filter((cr) => cr.folderLocationId !== folderId));

      setPlaylists((prev) =>
        prev.map((pl) => ({
          ...pl,
          videoIds: pl.videoIds.filter((id) => !removedVideoIds.has(id)),
        }))
      );

      setFavorites((prev) => {
        const next = new Set(prev);
        removedVideoIds.forEach((id) => next.delete(id));
        return next;
      });

      if (detailsVideo && removedVideoIds.has(detailsVideo.id)) {
        setDetailsVideo(null);
      }

      if (currentVideo && removedVideoIds.has(currentVideo.id)) {
        mediaEngine.pause();
        setIsPlaying(false);
        setCurrentTime(0);
        setDuration(0);
      }

      setQueue((prev) => {
        const next = prev.filter((item) => !removedVideoIds.has(item.id));
        if (next.length === 0) {
          setCurrentVideoIndex(-1);
        } else if (currentVideo && removedVideoIds.has(currentVideo.id)) {
          setCurrentVideoIndex(-1);
        } else if (currentVideo) {
          const newIdx = next.findIndex((item) => item.id === currentVideo.id);
          setCurrentVideoIndex(newIdx);
        }
        return next;
      });

      showToast(`Removed folder "${folderObj?.name || 'Location'}"`);
    },
    [videos, libraryFolders, detailsVideo, currentVideo, showToast]
  );

  // Filtered & sorted library slices
  const normalizedQuery = searchQuery.trim().toLowerCase();

  const filteredCollections = useMemo(() => {
    const matching = normalizedQuery
      ? collections.filter(
          (col) =>
            col.title.toLowerCase().includes(normalizedQuery) ||
            col.creator.toLowerCase().includes(normalizedQuery)
        )
      : collections;

    return [...matching].sort((a, b) => {
      switch (collectionSortBy) {
        case 'title-asc':
          return a.title.localeCompare(b.title);
        case 'title-desc':
          return b.title.localeCompare(a.title);
        case 'creator':
          return a.creator.localeCompare(b.creator) || a.title.localeCompare(b.title);
        case 'year-desc':
          return b.year - a.year || a.title.localeCompare(b.title);
        case 'year-asc':
          return a.year - b.year || a.title.localeCompare(b.title);
        default:
          return 0;
      }
    });
  }, [collections, normalizedQuery, collectionSortBy]);

  const filteredVideos = useMemo(() => {
    if (!normalizedQuery) return videos;
    return videos.filter(
      (v) =>
        v.title.toLowerCase().includes(normalizedQuery) ||
        v.creator.toLowerCase().includes(normalizedQuery) ||
        v.collection.toLowerCase().includes(normalizedQuery) ||
        (v.folderPath && v.folderPath.toLowerCase().includes(normalizedQuery))
    );
  }, [videos, normalizedQuery]);

  const filteredCreators = useMemo(() => {
    if (!normalizedQuery) return creators;
    return creators.filter((c) => c.name.toLowerCase().includes(normalizedQuery));
  }, [creators, normalizedQuery]);

  // Navigation helpers
  const navigateToSection = (section: ActiveSection, playlistId: string | null = null) => {
    if (section !== 'player') {
      setPreviousSection(section);
    }
    setActiveSection(section);
    setActivePlaylistId(playlistId);
    setSelectedCollectionId(null);
    setSelectedCreatorId(null);
  };

  const openCollectionDetail = (collectionId: string) => {
    setIsMiniPlayer(false);
    setActiveSection('collections');
    setSelectedCollectionId(collectionId);
    setSelectedCreatorId(null);
  };

  const openCreatorDetail = (creatorId: string | null) => {
    setIsMiniPlayer(false);
    setActiveSection('creators');
    setSelectedCreatorId(creatorId);
    setSelectedCollectionId(null);
  };

  const togglePlayerStage = () => {
    if (activeSection === 'player') {
      setActiveSection(previousSection === 'player' ? 'folders' : previousSection);
    } else {
      setPreviousSection(activeSection);
      setActiveSection('player');
    }
  };

  // Equalizer handlers
  const handleSelectEqPreset = (preset: Exclude<EqPreset, 'custom'>) => {
    const gains = [...EQ_PRESET_GAINS[preset]];
    setEqPreset(preset);
    setEqBands(gains);
    setEqEnabled(true);
    mediaEngine.setEqBands(gains, true);
  };

  const handleChangeEqBand = (bandIndex: number, gainDb: number) => {
    setEqPreset('custom');
    setEqEnabled(true);
    setEqBands((prev) => {
      const next = [...prev];
      next[bandIndex] = gainDb;
      mediaEngine.setEqBands(next, true);
      return next;
    });
  };

  const handleToggleEqEnabled = () => {
    const nextEnabled = !eqEnabled;
    setEqEnabled(nextEnabled);
    mediaEngine.setEqBands(eqBands, nextEnabled);
  };

  const handleResetEq = () => {
    const flat = [...EQ_PRESET_GAINS.flat];
    setEqPreset('flat');
    setEqBands(flat);
    setEqEnabled(true);
    mediaEngine.setEqBands(flat, true);
  };

  const selectedCollection = selectedCollectionId
    ? collections.find((col) => col.id === selectedCollectionId) || null
    : null;

  const activePlaylist = activePlaylistId
    ? playlists.find((pl) => pl.id === activePlaylistId) || null
    : null;

  const hasSampleFolder = libraryFolders.some((f) => f.id === SAMPLE_FOLDER_ID);

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col bg-[#f3f3f3] dark:bg-[#202020] text-[#1a1a1a] dark:text-[#f5f5f5]">
      {/* Hidden Hardware-Decoded Video Host */}
      <div
        ref={videoHostRef}
        data-video-host
        aria-hidden="true"
        className="fixed bottom-0 right-0 w-2 h-2 opacity-0 pointer-events-none -z-10"
      />

      {/* Hidden local video folder directory picker (triggered from Settings) */}
      <input
        ref={folderInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) {
            handleAddLocalFolderLocation(e.target.files);
            e.target.value = '';
          }
        }}
      />

      {isMiniPlayer ? (
        <MiniPlayer
          video={currentVideo}
          isPlaying={isPlaying}
          currentTime={currentTime}
          duration={duration}
          isFavorite={currentVideo ? favorites.has(currentVideo.id) : false}
          theme={theme}
          accent={accent}
          postFilter={postFilter}
          onTogglePlayPause={handleTogglePlayPause}
          onNext={handleNext}
          onPrev={handlePrev}
          onSeek={(sec) => {
            mediaEngine.seek(sec);
            setCurrentTime(sec);
          }}
          onToggleFavorite={handleToggleFavorite}
          onOpenDetails={(video) => setDetailsVideo(video)}
          onExitMiniPlayer={() => setIsMiniPlayer(false)}
        />
      ) : (
        <>
          {/* Main Workspace: Sidebar + Content Viewport */}
          <div className="flex-1 min-h-0 flex overflow-hidden">
            <Sidebar
              collapsed={sidebarCollapsed}
              onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
              activeSection={activeSection}
              activePlaylistId={activePlaylistId}
              onSelectSection={navigateToSection}
              playlists={playlists}
              onCreatePlaylist={handleCreatePlaylist}
              queueCount={queue.length}
              folderLocationCount={libraryFolders.length}
              theme={theme}
              onToggleTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
              accent={accent}
              onChangeAccent={setAccent}
            />

            <main className="flex-1 min-w-0 h-full flex flex-col overflow-hidden bg-[#fafafa] dark:bg-[#1c1c1c] rounded-tl-lg border-t border-l border-black/[0.05] dark:border-white/[0.05]">
              {/* Top Utility Strip with Search Button on the Right Side */}
              {activeSection !== 'player' && activeSection !== 'settings' && (
                <div className="px-6 pt-3 pb-1 flex items-center justify-end gap-2 shrink-0">
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      searchInputRef.current?.focus();
                    }}
                    className="flex items-center gap-1.5"
                  >
                    <div className="relative flex items-center">
                      <input
                        ref={searchInputRef}
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search videos, collections, creators..."
                        aria-label="Search video library"
                        className="w-60 sm:w-72 h-9 pl-3.5 pr-8 text-[13px] rounded-md bg-white dark:bg-[#2b2b2b] text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-500 dark:placeholder:text-neutral-400 border border-black/[0.08] dark:border-white/[0.08] border-b-black/20 dark:border-b-white/20 focus:outline-none focus:border-b-2 focus:border-b-[#0067c0] dark:focus:border-b-[#60cdff] transition-colors"
                      />
                      {searchQuery && (
                        <button
                          type="button"
                          onClick={() => setSearchQuery('')}
                          aria-label="Clear search"
                          className="absolute right-2 p-1 rounded text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
                        >
                          <X size={13} />
                        </button>
                      )}
                    </div>
                    <button
                      type="submit"
                      title="Search"
                      aria-label="Search"
                      className={`h-9 px-3.5 rounded-md inline-flex items-center gap-1.5 text-[12.5px] font-medium transition-colors whitespace-nowrap shrink-0 ${palette.buttonBg} ${palette.buttonText}`}
                    >
                      <Search size={14} />
                      <span>Search</span>
                    </button>
                  </form>
                </div>
              )}

              <div className="flex-1 min-h-0 overflow-hidden">
                {activeSection === 'player' && (
                  <VideoStageView
                    video={currentVideo}
                    isPlaying={isPlaying}
                    currentTime={currentTime}
                    duration={duration}
                    volume={volume}
                    muted={muted}
                    onSeek={(sec) => {
                      mediaEngine.seek(sec);
                      setCurrentTime(sec);
                    }}
                    onNext={handleNext}
                    onPrev={handlePrev}
                    onChangeVolume={(vol) => {
                      setVolume(vol);
                      if (vol > 0 && muted) setMuted(false);
                      mediaEngine.setVolume(vol, false);
                    }}
                    onToggleMute={() => {
                      const nextMuted = !muted;
                      setMuted(nextMuted);
                      mediaEngine.setVolume(volume, nextMuted);
                    }}
                    theme={theme}
                    accent={accent}
                    fitMode={fitMode}
                    postFilter={postFilter}
                    hdrEnabled={hdrEnabled}
                    onToggleHdr={handleToggleHdr}
                    onSelectAudioTrack={handleSelectAudioTrack}
                    onToggleFitMode={() =>
                      setFitMode((m) => (m === 'contain' ? 'cover' : 'contain'))
                    }
                    onChangePostFilter={setPostFilter}
                    onSelectSubtitleTrack={handleSelectSubtitleTrack}
                    onAttachVttFile={handleAttachVttFile}
                    onTogglePlayPause={handleTogglePlayPause}
                    onToggleMiniPlayer={() => setIsMiniPlayer(true)}
                    onBack={() =>
                      setActiveSection(
                        previousSection === 'player' ? 'folders' : previousSection
                      )
                    }
                    onSelectCollection={openCollectionDetail}
                    onSelectCreator={openCreatorDetail}
                    onOpenDetails={(video) => setDetailsVideo(video)}
                  />
                )}

                {activeSection === 'settings' && (
                  <SettingsView
                    libraryFolders={libraryFolders}
                    hasSampleFolder={hasSampleFolder}
                    totalVideos={videos.length}
                    theme={theme}
                    accent={accent}
                    onAddLocalFolder={() => folderInputRef.current?.click()}
                    onAddSampleFolder={handleAddSampleFolderLocation}
                    onRemoveFolder={handleRemoveFolderLocation}
                    onToggleTheme={setTheme}
                    onChangeAccent={setAccent}
                    onBrowseFolders={() => navigateToSection('folders', null)}
                  />
                )}

                {activeSection === 'collections' && selectedCollection && (
                  <CollectionDetailView
                    collection={selectedCollection}
                    videos={videos.filter((v) => v.collectionId === selectedCollection.id)}
                    currentVideo={currentVideo}
                    isPlaying={isPlaying}
                    favorites={favorites}
                    playlists={playlists}
                    accent={accent}
                    onBack={() => setSelectedCollectionId(null)}
                    onSelectCreator={openCreatorDetail}
                    onPlayVideo={handlePlayVideo}
                    onTogglePlayPause={handleTogglePlayPause}
                    onPlayCollection={handlePlayCollection}
                    onAddCollectionToQueue={handleAddCollectionToQueue}
                    onAddVideoToQueue={handleAddVideoToQueue}
                    onToggleFavorite={handleToggleFavorite}
                    onAddVideoToPlaylist={handleAddVideoToPlaylist}
                    onOpenDetails={(video) => setDetailsVideo(video)}
                  />
                )}

                {activeSection === 'collections' && !selectedCollection && (
                  <CollectionsView
                    collections={filteredCollections}
                    videos={videos}
                    viewMode={collectionViewMode}
                    onChangeViewMode={setCollectionViewMode}
                    sortBy={collectionSortBy}
                    onChangeSortBy={setCollectionSortBy}
                    onSelectCollection={openCollectionDetail}
                    onPlayCollection={handlePlayCollection}
                    onAddCollectionToQueue={handleAddCollectionToQueue}
                    onShuffleAll={() => handlePlayAll(videos, true, true)}
                    currentVideo={currentVideo}
                    isPlaying={isPlaying}
                    accent={accent}
                    onOpenSettings={() => navigateToSection('settings', null)}
                  />
                )}

                {activeSection === 'videos' && (
                  <VideosView
                    videos={filteredVideos}
                    currentVideo={currentVideo}
                    isPlaying={isPlaying}
                    favorites={favorites}
                    playlists={playlists}
                    accent={accent}
                    onPlayVideo={handlePlayVideo}
                    onTogglePlayPause={handleTogglePlayPause}
                    onPlayAll={(list, shouldShuffle) => handlePlayAll(list, shouldShuffle, true)}
                    onAddVideoToQueue={handleAddVideoToQueue}
                    onToggleFavorite={handleToggleFavorite}
                    onAddVideoToPlaylist={handleAddVideoToPlaylist}
                    onOpenDetails={(video) => setDetailsVideo(video)}
                    onSelectCollection={openCollectionDetail}
                    onSelectCreator={openCreatorDetail}
                    onOpenSettings={() => navigateToSection('settings', null)}
                  />
                )}

                {activeSection === 'creators' && (
                  <CreatorsView
                    creators={filteredCreators}
                    collections={collections}
                    videos={videos}
                    selectedCreatorId={selectedCreatorId}
                    viewMode={creatorViewMode}
                    onChangeViewMode={setCreatorViewMode}
                    onSelectCreator={openCreatorDetail}
                    onSelectCollection={openCollectionDetail}
                    onPlayVideo={handlePlayVideo}
                    onTogglePlayPause={handleTogglePlayPause}
                    onPlayCreator={handlePlayCreator}
                    onAddVideoToQueue={handleAddVideoToQueue}
                    onOpenDetails={(video) => setDetailsVideo(video)}
                    currentVideo={currentVideo}
                    isPlaying={isPlaying}
                    accent={accent}
                    onOpenSettings={() => navigateToSection('settings', null)}
                  />
                )}

                {activeSection === 'folders' && (
                  <FoldersView
                    videos={filteredVideos}
                    currentVideo={currentVideo}
                    isPlaying={isPlaying}
                    accent={accent}
                    onOpenSettings={() => navigateToSection('settings', null)}
                    onPlayVideo={handlePlayVideo}
                    onPlayFolderVideos={(folderVideos, shouldShuffle) =>
                      handlePlayAll(folderVideos, shouldShuffle, true)
                    }
                    onAddFolderToQueue={(folderVideos) => {
                      if (folderVideos.length === 0) return;
                      setQueue((prev) => [...prev, ...folderVideos]);
                      showToast(
                        `Added ${folderVideos.length} ${
                          folderVideos.length === 1 ? 'video' : 'videos'
                        } from folder to queue`
                      );
                    }}
                    onTogglePlayPause={handleTogglePlayPause}
                    onAddVideoToQueue={handleAddVideoToQueue}
                    onOpenDetails={(video) => setDetailsVideo(video)}
                  />
                )}

                {activeSection === 'queue' && (
                  <QueueView
                    queue={queue}
                    currentVideoIndex={currentVideoIndex}
                    isPlaying={isPlaying}
                    accent={accent}
                    onPlayAtIndex={(idx) => playVideoAtQueueIndex(idx, undefined, true)}
                    onTogglePlayPause={handleTogglePlayPause}
                    onRemoveAtIndex={(idx) => {
                      setQueue((prev) => {
                        const next = prev.filter((_, i) => i !== idx);
                        if (idx < currentVideoIndex) {
                          setCurrentVideoIndex((c) => Math.max(0, c - 1));
                        } else if (idx === currentVideoIndex) {
                          if (next.length === 0) {
                            mediaEngine.pause();
                            setIsPlaying(false);
                            setCurrentVideoIndex(-1);
                          } else {
                            const nextIdx = Math.min(idx, next.length - 1);
                            playVideoAtQueueIndex(nextIdx, next, false);
                          }
                        }
                        return next;
                      });
                    }}
                    onClearQueue={() => {
                      mediaEngine.pause();
                      setIsPlaying(false);
                      setQueue([]);
                      setCurrentVideoIndex(-1);
                      setCurrentTime(0);
                    }}
                    onShuffleQueue={() => {
                      if (queue.length < 2) return;
                      const current = currentVideo;
                      const rest = queue.filter((_, i) => i !== currentVideoIndex);
                      const shuffled = current
                        ? [current, ...shuffleArray(rest)]
                        : shuffleArray(queue);
                      setQueue(shuffled);
                      setCurrentVideoIndex(0);
                      setShuffle(true);
                    }}
                  />
                )}

                {activeSection === 'playlists' && (
                  <PlaylistsView
                    playlist={activePlaylist}
                    allVideos={videos}
                    currentVideo={currentVideo}
                    isPlaying={isPlaying}
                    accent={accent}
                    onPlayVideo={handlePlayVideo}
                    onTogglePlayPause={handleTogglePlayPause}
                    onPlayAll={(list, shouldShuffle) => handlePlayAll(list, shouldShuffle, true)}
                    onRemoveVideoFromPlaylist={handleRemoveVideoFromPlaylist}
                    onRenamePlaylist={handleRenamePlaylist}
                    onDeletePlaylist={handleDeletePlaylist}
                  />
                )}
              </div>
            </main>
          </div>

          {/* Bottom Persistent Windows 11 Video Transport Bar */}
          <PlayerBar
            currentVideo={currentVideo}
            isPlaying={isPlaying}
            currentTime={currentTime}
            duration={duration}
            volume={volume}
            muted={muted}
            shuffle={shuffle}
            repeatMode={repeatMode}
            playbackRate={playbackRate}
            eqPreset={eqPreset}
            eqEnabled={eqEnabled}
            isFavorite={currentVideo ? favorites.has(currentVideo.id) : false}
            isPlayerStageOpen={activeSection === 'player'}
            isQueueOpen={activeSection === 'queue'}
            theme={theme}
            accent={accent}
            onTogglePlayPause={handleTogglePlayPause}
            onNext={handleNext}
            onPrev={handlePrev}
            onSeek={(sec) => {
              mediaEngine.seek(sec);
              setCurrentTime(sec);
            }}
            onChangeVolume={(vol) => {
              setVolume(vol);
              if (vol > 0 && muted) setMuted(false);
              mediaEngine.setVolume(vol, false);
            }}
            onToggleMute={() => {
              const nextMuted = !muted;
              setMuted(nextMuted);
              mediaEngine.setVolume(volume, nextMuted);
            }}
            onToggleShuffle={() => setShuffle((s) => !s)}
            onCycleRepeat={() =>
              setRepeatMode((m) => (m === 'off' ? 'all' : m === 'all' ? 'one' : 'off'))
            }
            onOpenEqualizer={() => setShowEqualizer(true)}
            onToggleFavorite={handleToggleFavorite}
            onTogglePlayerStage={togglePlayerStage}
            onToggleMiniPlayer={() => setIsMiniPlayer(true)}
            onOpenDetails={(video) => setDetailsVideo(video)}
            onToggleQueue={() =>
              navigateToSection(activeSection === 'queue' ? 'folders' : 'queue', null)
            }
            onSelectCollection={openCollectionDetail}
            onSelectCreator={openCreatorDetail}
          />
        </>
      )}

      {/* Custom 10-Band Equalizer Modal */}
      <EqualizerModal
        open={showEqualizer}
        eqPreset={eqPreset}
        eqBands={eqBands}
        eqEnabled={eqEnabled}
        playbackRate={playbackRate}
        onClose={() => setShowEqualizer(false)}
        onSelectPreset={handleSelectEqPreset}
        onChangeBand={handleChangeEqBand}
        onToggleEnabled={handleToggleEqEnabled}
        onReset={handleResetEq}
        onChangePlaybackRate={(rate) => {
          setPlaybackRate(rate);
          mediaEngine.setPlaybackRate(rate);
        }}
      />

      {/* Video Details & Bitrate Properties Modal */}
      <VideoDetailsModal
        video={detailsVideo}
        accent={accent}
        onClose={() => setDetailsVideo(null)}
        onPlayVideo={(video) => handlePlayVideo(video, videos)}
        onAddToQueue={handleAddVideoToQueue}
        onSelectCollection={openCollectionDetail}
        onSelectCreator={openCreatorDetail}
      />

      {/* Subtle Action Toast */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-28 right-6 px-4 py-2.5 rounded-md bg-neutral-900 dark:bg-[#323232] text-white text-[13px] font-medium shadow-lg border border-white/10 z-50"
        >
          {toastMessage}
        </div>
      )}
    </div>
  );
}
