// Bridge to the Electron main process (bundled ffmpeg: probing, conversion, subtitles).
// In a plain browser every helper degrades gracefully.
import { AudioStreamInfo, VideoItem } from '@/src/types/video';

export interface NativeProbe {
  ok: boolean;
  size?: number;
  container: string;
  duration: number;
  bitrateKbps?: number;
  tags: Record<string, string>;
  video: {
    codec: string;
    profile: string;
    pixFmt: string;
    bitDepth: number;
    transfer: string;
    primaries: string;
    matrix: string;
    width: number;
    height: number;
    fps: number;
    bitrateKbps?: number;
    hdr: string;
  } | null;
  audio: {
    index: number;
    codec: string;
    profile?: string;
    channels: number;
    layout?: string;
    sampleRateHz?: number;
    bitrateKbps?: number;
    language?: string;
    title?: string;
    isDefault?: boolean;
  }[];
  subtitles: { index: number; codec: string; language?: string; title?: string; text: boolean }[];
  thumbnail?: { mime: string; data: Uint8Array } | null;
}

export interface PrepareOptions {
  video: 'copy' | 'transcode';
  audio: 'copy' | 'aac' | 'none';
  audioIndex: number;
  audioChannels: number;
  surround: boolean;
  tonemap: boolean;
  hevc: boolean;
  duration: number;
}

export interface NativeCaps {
  zscale: boolean;
  tonemap: boolean;
  hwEncoders: string[];
  hwDecode: boolean;
}

interface ElectronAPI {
  isElectron: true;
  getPathForFile(file: File): string;
  analyze(path: string): Promise<NativeProbe>;
  subtitles(path: string, count: number): Promise<string[]>;
  prepare(id: string, path: string, opts: PrepareOptions): Promise<string>;
  cancelPrepare(): Promise<void>;
  mediaUrl(path: string): Promise<string>;
  capabilities(): Promise<NativeCaps>;
  clearCache(): Promise<boolean>;
  getSettings(): Promise<{ hwDecode: boolean }>;
  setSettings(patch: { hwDecode?: boolean }): Promise<{ hwDecode: boolean }>;
  relaunch(): Promise<void>;
  onPrepareProgress(cb: (d: { id: string; progress: number }) => void): () => void;
  onOpenFiles(cb: (paths: string[]) => void): () => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export const nativeApi = (): ElectronAPI | undefined =>
  typeof window !== 'undefined' ? window.electronAPI : undefined;

/** Every video container the player accepts (ffmpeg demuxes the ones Chromium cannot). */
export const VIDEO_EXTENSIONS = [
  'mp4', 'm4v', 'mov', 'mkv', 'webm', 'avi', 'wmv', 'asf', 'flv', 'f4v', 'ts', 'm2ts', 'mts', 'mpg', 'mpeg', 'mpe',
  'vob', 'ogv', 'ogm', '3gp', '3g2', 'divx', 'xvid', 'rm', 'rmvb', 'mxf', 'qt', 'dv', 'm2v', 'evo', 'wtv',
];
const VIDEO_EXT_RE = new RegExp(`\\.(${VIDEO_EXTENSIONS.join('|')})$`, 'i');
export const isVideoFile = (f: File) => f.type.startsWith('video/') || VIDEO_EXT_RE.test(f.name);

// ---- what can the built-in player engine decode directly? ----
function videoContentType(codec: string, depth: number): string | null {
  const ten = depth > 8;
  switch (codec) {
    case 'h264': return `video/mp4; codecs="${ten ? 'avc1.6E0033' : 'avc1.640033'}"`;
    case 'hevc': return `video/mp4; codecs="${ten ? 'hvc1.2.4.L153.B0' : 'hvc1.1.6.L153.B0'}"`;
    case 'av1': return `video/mp4; codecs="${ten ? 'av01.0.12M.10' : 'av01.0.12M.08'}"`;
    case 'vp9': return `video/webm; codecs="${ten ? 'vp09.02.10.10' : 'vp09.00.40.08'}"`;
    case 'vp8': return 'video/webm; codecs="vp8"';
    default: return null;
  }
}

export async function canDecodeVideo(v: NonNullable<NativeProbe['video']>): Promise<boolean> {
  const contentType = videoContentType(v.codec, v.bitDepth);
  if (!contentType) return false;
  try {
    const info = await navigator.mediaCapabilities.decodingInfo({
      type: 'file',
      video: {
        contentType,
        width: v.width || 1920,
        height: v.height || 1080,
        bitrate: Math.max(1_000_000, (v.bitrateKbps ?? 8000) * 1000),
        framerate: v.fps || 24,
      },
    });
    return info.supported;
  } catch {
    return v.codec === 'h264' && v.bitDepth <= 8;
  }
}

const NATIVE_AUDIO = new Set(['aac', 'mp3', 'opus', 'vorbis', 'flac']);
const NATIVE_CONTAINER_EXT = new Set(['mp4', 'm4v', 'mov', 'webm', 'mkv']);

export function isNativeAudio(codec: string): boolean {
  return NATIVE_AUDIO.has(codec);
}

export function containerIsNative(fileName: string, videoCodec: string): boolean {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  if (!NATIVE_CONTAINER_EXT.has(ext)) return false;
  if (ext === 'mkv' && videoCodec === 'hevc') return false; // remux HEVC to MP4 for reliable playback
  return true;
}

export interface PlaybackPlan {
  direct: boolean;
  video: 'copy' | 'transcode';
  audio: 'copy' | 'aac' | 'none';
}

/** Decide how to play: straight from disk, or via a fast remux / audio conversion / full transcode. */
export function planPlayback(item: VideoItem): PlaybackPlan {
  const streams = item.audioStreams ?? [];
  const defaultIdx = Math.max(0, streams.findIndex((a) => a.isDefault));
  const idx = item.activeAudioIndex ?? defaultIdx;
  const a = streams[idx];
  const audioNative = !a || isNativeAudio(a.codec);
  const video: 'copy' | 'transcode' = item.videoNative ? 'copy' : 'transcode';
  const audio: 'copy' | 'aac' | 'none' = !a ? 'none' : audioNative ? 'copy' : 'aac';
  const direct = Boolean(item.videoNative && item.containerNative && audioNative && idx === defaultIdx);
  return { direct, video, audio };
}

export function audioLabel(a: NativeProbe['audio'][number], i: number): string {
  const lang = a.language ? a.language.toUpperCase() : '';
  const ch = a.channels >= 6 ? `${a.layout || '5.1'}` : a.channels === 1 ? 'Mono' : a.channels === 2 ? 'Stereo' : `${a.channels}ch`;
  const parts = [a.title || (lang ? lang : `Track ${i + 1}`), a.codec.toUpperCase(), ch];
  return parts.filter(Boolean).join(' · ');
}

export function toAudioStreams(p: NativeProbe): AudioStreamInfo[] {
  return p.audio.map((a, i) => ({
    index: i,
    codec: a.codec,
    channels: a.channels,
    layout: a.layout,
    language: a.language,
    title: a.title,
    sampleRateHz: a.sampleRateHz,
    bitrateKbps: a.bitrateKbps,
    isDefault: a.isDefault,
    label: audioLabel(a, i),
  }));
}

const VIDEO_CODEC_NAMES: Record<string, string> = {
  h264: 'H.264 / AVC', hevc: 'H.265 / HEVC', av1: 'AV1', vp9: 'VP9', vp8: 'VP8', mpeg2video: 'MPEG-2', mpeg4: 'MPEG-4',
  vc1: 'VC-1', wmv3: 'WMV9', prores: 'Apple ProRes', theora: 'Theora', mjpeg: 'Motion JPEG', dnxhd: 'DNxHD',
};
export function videoCodecLabel(v: NonNullable<NativeProbe['video']>, container: string, hdr: string): string {
  const name = VIDEO_CODEC_NAMES[v.codec] || v.codec.toUpperCase();
  const parts = [name + (v.profile ? ` ${v.profile}` : ''), v.bitDepth > 8 ? `${v.bitDepth}-bit` : '', hdr].filter(Boolean);
  return `${parts.join(' · ')} (${container.split(',')[0].toUpperCase()})`;
}

export function thumbToUrl(t: NativeProbe['thumbnail']): string | undefined {
  if (!t || !t.data?.length) return undefined;
  return URL.createObjectURL(new Blob([t.data as BlobPart], { type: t.mime }));
}
