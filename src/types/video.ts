export type CollectionViewMode = 'small' | 'medium' | 'large' | 'list';
export type CreatorViewMode = 'grid' | 'list';
export type FolderViewMode = 'grid' | 'list';
export type ActiveSection =
  | 'collections'
  | 'videos'
  | 'creators'
  | 'queue'
  | 'folders'
  | 'playlists'
  | 'player'
  | 'settings';

export type CollectionSortOption = 'title-asc' | 'title-desc' | 'creator' | 'year-desc' | 'year-asc';
export type VideoSortColumn = 'index' | 'title' | 'creator' | 'collection' | 'duration';
export type SortDirection = 'asc' | 'desc';
export type RepeatMode = 'off' | 'all' | 'one';
export type ThemeMode = 'dark' | 'light';
export type AccentTheme = 'sky' | 'amber' | 'emerald' | 'rose';
export type VideoFitMode = 'contain' | 'cover';
export type VideoFilterMode = 'none' | 'grayscale' | 'sepia' | 'high-contrast';
export type EqPreset =
  | 'custom'
  | 'flat'
  | 'bass'
  | 'vocal'
  | 'acoustic'
  | 'electronic'
  | 'rock'
  | 'pop';

export const EQ_FREQUENCIES = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000] as const;

export const EQ_FREQUENCY_LABELS = [
  '32 Hz',
  '64 Hz',
  '125 Hz',
  '250 Hz',
  '500 Hz',
  '1 kHz',
  '2 kHz',
  '4 kHz',
  '8 kHz',
  '16 kHz',
] as const;

export const EQ_PRESET_GAINS: Record<Exclude<EqPreset, 'custom'>, number[]> = {
  flat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  bass: [7, 6, 5, 3, 1, 0, 0, 0, 1, 1],
  vocal: [-2, -2, -1, 1, 4, 5, 5, 4, 2, 0],
  acoustic: [3, 2, 1, 1, 2, 2, 3, 4, 4, 3],
  electronic: [6, 5, 2, 0, -2, 1, 2, 4, 5, 6],
  rock: [5, 4, 2, 0, -1, -1, 2, 4, 5, 5],
  pop: [-1, 1, 3, 4, 3, 0, -1, -1, 2, 3],
};

export interface SynthRecipe {
  bpm: number;
  rootMidi: number;
  scaleIntervals: number[];
  progression: number[];
  waveform: 'sine' | 'triangle' | 'warm-pad' | 'epiano';
  hasPercussion: boolean;
  arpPattern: number[];
  brightness: number;
}

export interface CaptionCue {
  startSec: number;
  endSec: number;
  text: string;
}

export interface SubtitleTrack {
  id: string;
  label: string;
  language?: string;
  kind: 'embedded' | 'vtt';
  sourceName?: string;
  cues: CaptionCue[];
}

export interface LibraryFolderLocation {
  id: string;
  name: string;
  path: string;
  source: 'local' | 'sample';
  videoCount: number;
  addedAt: number;
}

export type SceneMotionStyle =
  | 'drift-right'
  | 'drift-left'
  | 'zoom-in'
  | 'zoom-out'
  | 'tilt-up'
  | 'pan-cinema';

export interface AudioStreamInfo {
  index: number; // position among the file's audio streams
  codec: string;
  channels: number;
  layout?: string;
  language?: string;
  title?: string;
  sampleRateHz?: number;
  bitrateKbps?: number;
  isDefault?: boolean;
  label: string;
}

export interface VideoItem {
  id: string;
  episodeNumber: number;
  title: string;
  creatorId: string;
  creator: string;
  collectionId: string;
  collection: string;
  year: number;
  duration: number; // seconds
  thumbnailUrl?: string;
  videoUrl?: string; // ObjectURL for local video files
  isLocal?: boolean;
  folderLocationId?: string; // Ties video to a folder configured in Settings
  folderPath?: string; // Directory path for folder view
  fileName?: string;
  sourcePath?: string; // absolute path on disk (desktop app)
  isHdr?: boolean;
  hdrFormat?: string; // HDR10 | HLG | Dolby Vision
  videoNative?: boolean; // video stream is decodable by the player engine as-is
  containerNative?: boolean;
  audioStreams?: AudioStreamInfo[];
  activeAudioIndex?: number;
  textSubtitleCount?: number; // embedded text subtitle streams that can be extracted
  subtitlesExtracted?: boolean;
  resolution: string;
  frameRate: string;
  videoBitrateKbps?: number;
  audioBitrateKbps?: number;
  sampleRateHz?: number;
  codec: string;
  aspectRatio: string;
  channels?: string;
  fileSizeBytes?: number;
  director?: string;
  cameraSpecs?: string;
  about?: string;
  subtitleTracks?: SubtitleTrack[];
  activeSubtitleId?: string | null;
  sceneStyle?: SceneMotionStyle;
  synthRecipe?: SynthRecipe;
}

export interface VideoCollection {
  id: string;
  title: string;
  creatorId: string;
  creator: string;
  year: number;
  thumbnailUrl?: string;
  accentHex: string;
  addedAt: number;
  description: string;
  folderLocationId?: string;
}

export interface Creator {
  id: string;
  name: string;
  bio: string;
  thumbnailUrl?: string;
  folderLocationId?: string;
}

export interface VideoPlaylist {
  id: string;
  name: string;
  videoIds: string[];
  createdAt: number;
}
