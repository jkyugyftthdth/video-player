import { EQ_FREQUENCIES, SynthRecipe, VideoItem } from '@/src/types/video';
import { nativeApi, planPlayback } from '@/src/media/native';

export interface EngineSettings {
  outputDeviceId: string; // '' = system default
  surround: boolean; // keep 5.1/7.1 instead of downmixing to stereo
}

export type PrepareStatus =
  | { type: 'progress'; id: string; title: string; progress: number }
  | { type: 'done'; id: string }
  | { type: 'error'; id: string; title: string; message: string };

function loadEngineSettings(): EngineSettings {
  try {
    const raw = JSON.parse(localStorage.getItem('vp-audio-settings') || '{}');
    return { outputDeviceId: raw.outputDeviceId || '', surround: Boolean(raw.surround) };
  } catch {
    return { outputDeviceId: '', surround: false };
  }
}

function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/**
 * Generates a warm stereo WAV Blob URL for built-in sample videos so they support
 * synchronized playback, instant scrubbing, playback speed, 10-band EQ,
 * and real-time AnalyserNode visualization alongside local <video> files.
 */
function synthesizeSoundtrackWavUrl(recipe: SynthRecipe, durationSec: number): string {
  const sampleRate = 22050;
  const totalSamples = Math.floor(sampleRate * durationSec);
  const left = new Float32Array(totalSamples);
  const right = new Float32Array(totalSamples);

  const beatSec = 60 / recipe.bpm;
  const barSec = beatSec * 4;
  const eighthSec = beatSec / 2;

  const { rootMidi, scaleIntervals, progression, waveform, hasPercussion, arpPattern, brightness } =
    recipe;

  let seed = rootMidi * 1337 + recipe.bpm * 17;
  const nextRand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return (seed / 0xffffffff) * 2 - 1;
  };

  for (let i = 0; i < totalSamples; i++) {
    const t = i / sampleRate;
    const barIndex = Math.floor(t / barSec);
    const barPos = (t % barSec) / barSec;
    const beatPos = (t % beatSec) / beatSec;
    const eighthIndex = Math.floor(t / eighthSec);
    const eighthPos = (t % eighthSec) / eighthSec;

    const progStep = progression[barIndex % progression.length];
    const chordRootInterval = scaleIntervals[progStep % scaleIntervals.length];
    const chordRootMidi = rootMidi + chordRootInterval - 12;

    const idx3 = (progStep + 2) % scaleIntervals.length;
    const idx5 = (progStep + 4) % scaleIntervals.length;
    const idx7 = (progStep + 6) % scaleIntervals.length;
    const octave3 = progStep + 2 >= scaleIntervals.length ? 12 : 0;
    const octave5 = progStep + 4 >= scaleIntervals.length ? 12 : 0;
    const octave7 = progStep + 6 >= scaleIntervals.length ? 12 : 0;

    const chordNotes = [
      midiToFreq(rootMidi + chordRootInterval),
      midiToFreq(rootMidi + scaleIntervals[idx3] + octave3),
      midiToFreq(rootMidi + scaleIntervals[idx5] + octave5),
      midiToFreq(rootMidi + scaleIntervals[idx7] + octave7),
    ];

    const chordEnv =
      Math.min(1, barPos * 8) * Math.pow(Math.max(0, 1 - barPos * 0.45), 0.7);

    let padL = 0;
    let padR = 0;
    for (let c = 0; c < chordNotes.length; c++) {
      const f = chordNotes[c];
      const detune = (c - 1.5) * 0.0022;
      const phaseL = 2 * Math.PI * f * (1 + detune) * t;
      const phaseR = 2 * Math.PI * f * (1 - detune) * t;

      let voiceL = 0;
      let voiceR = 0;
      if (waveform === 'sine') {
        voiceL = Math.sin(phaseL) + 0.18 * Math.sin(phaseL * 2);
        voiceR = Math.sin(phaseR) + 0.18 * Math.sin(phaseR * 2);
      } else if (waveform === 'triangle') {
        voiceL =
          0.7 * Math.sin(phaseL) +
          0.25 * Math.sin(phaseL * 2) * brightness +
          0.1 * Math.sin(phaseL * 3) * brightness;
        voiceR =
          0.7 * Math.sin(phaseR) +
          0.25 * Math.sin(phaseR * 2) * brightness +
          0.1 * Math.sin(phaseR * 3) * brightness;
      } else if (waveform === 'epiano') {
        const bell = Math.exp(-barPos * 6) * 0.35 * brightness;
        voiceL = Math.sin(phaseL) + bell * Math.sin(phaseL * 3) + 0.15 * Math.sin(phaseL * 2);
        voiceR = Math.sin(phaseR) + bell * Math.sin(phaseR * 3) + 0.15 * Math.sin(phaseR * 2);
      } else {
        voiceL =
          0.75 * Math.sin(phaseL) +
          0.25 * Math.sin(phaseL * 0.5) +
          0.14 * Math.sin(phaseL * 2) * brightness;
        voiceR =
          0.75 * Math.sin(phaseR) +
          0.25 * Math.sin(phaseR * 0.5) +
          0.14 * Math.sin(phaseR * 2) * brightness;
      }

      const pan = 0.35 + (c / (chordNotes.length - 1)) * 0.3;
      padL += voiceL * (1 - pan);
      padR += voiceR * pan;
    }
    padL *= 0.14 * chordEnv;
    padR *= 0.14 * chordEnv;

    const bassFreq = midiToFreq(chordRootMidi);
    const bassEnv = Math.min(1, beatPos * 14) * Math.exp(-beatPos * 1.3);
    const bass =
      (0.85 * Math.sin(2 * Math.PI * bassFreq * t) +
        0.15 * Math.sin(2 * Math.PI * bassFreq * 2 * t)) *
      0.16 *
      bassEnv;

    const arpDegree = arpPattern[eighthIndex % arpPattern.length];
    const arpScaleIdx = (progStep + arpDegree) % scaleIntervals.length;
    const arpOctave = progStep + arpDegree >= scaleIntervals.length ? 24 : 12;
    const arpFreq = midiToFreq(rootMidi + scaleIntervals[arpScaleIdx] + arpOctave);
    const arpEnv = Math.min(1, eighthPos * 22) * Math.exp(-eighthPos * 4.2);
    const arpGate = eighthIndex % 5 === 4 ? 0.2 : 1.0;
    const arpSig =
      (Math.sin(2 * Math.PI * arpFreq * t) + 0.2 * Math.sin(2 * Math.PI * arpFreq * 2 * t)) *
      0.085 *
      arpEnv *
      arpGate;
    const arpPan = eighthIndex % 2 === 0 ? 0.38 : 0.62;

    let percL = 0;
    let percR = 0;
    if (hasPercussion) {
      const noise = nextRand();
      const beatIndex = Math.floor(t / beatSec) % 4;
      if (beatIndex === 0 || beatIndex === 2) {
        const kickEnv = Math.exp(-beatPos * 16);
        const kickFreq = 52 + 85 * Math.exp(-beatPos * 28);
        const kick = Math.sin(2 * Math.PI * kickFreq * t) * 0.22 * kickEnv;
        percL += kick;
        percR += kick;
      }
      if (beatIndex === 1 || beatIndex === 3) {
        const snareEnv = Math.exp(-beatPos * 20);
        const snare = noise * 0.055 * snareEnv;
        percL += snare * 0.9;
        percR += snare * 1.1;
      }
      const hatEnv = Math.exp(-eighthPos * 30);
      const hat = noise * 0.022 * hatEnv;
      percL += hat * 1.1;
      percR += hat * 0.9;
    }

    const fadeIn = Math.min(1, t / 1.0);
    const fadeOut = Math.min(1, (durationSec - t) / 1.8);
    const masterEnv = Math.max(0, Math.min(fadeIn, fadeOut));

    const sampleL = Math.tanh((padL + bass + arpSig * (1 - arpPan) + percL) * masterEnv);
    const sampleR = Math.tanh((padR + bass + arpSig * arpPan + percR) * masterEnv);

    left[i] = sampleL;
    right[i] = sampleR;
  }

  const numChannels = 2;
  const bitsPerSample = 16;
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataSize = totalSamples * blockAlign;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < totalSamples; i++) {
    const l = Math.max(-1, Math.min(1, left[i]));
    const r = Math.max(-1, Math.min(1, right[i]));
    view.setInt16(offset, l < 0 ? l * 0x8000 : l * 0x7fff, true);
    view.setInt16(offset + 2, r < 0 ? r * 0x8000 : r * 0x7fff, true);
    offset += 4;
  }

  const blob = new Blob([buffer], { type: 'audio/wav' });
  return URL.createObjectURL(blob);
}

class MediaPlaybackEngine {
  private audio: HTMLAudioElement;
  private video: HTMLVideoElement;
  private activeMode: 'audio' | 'video' = 'audio';
  private ctx: AudioContext | null = null;
  private audioSource: MediaElementAudioSourceNode | null = null;
  private videoSource: MediaElementAudioSourceNode | null = null;
  private filters: BiquadFilterNode[] = [];
  private gainNode: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private cachedUrls = new Map<string, string>();
  private currentVideoId: string | null = null;
  private pendingBands: number[] = new Array(10).fill(0);
  private pendingEqEnabled = true;
  private settings: EngineSettings = loadEngineSettings();
  private preparedUrls = new Map<string, string>();
  private statusListeners = new Set<(s: PrepareStatus) => void>();
  private loadToken = 0;
  /** Live (instant-start) ffmpeg stream state; the video element's time is mapped to the file's time. */
  private live: { item: VideoItem; offset: number; duration: number; fellBack: boolean } | null = null;
  private nativeSetTime!: (v: number) => void;
  private nativeGetTime!: () => number;

  constructor() {
    this.audio = new Audio();
    this.audio.crossOrigin = 'anonymous';
    this.audio.preload = 'auto';

    this.video = document.createElement('video');
    this.video.crossOrigin = 'anonymous';
    this.video.preload = 'auto';
    this.video.playsInline = true;
    this.installLiveTimeMapping();
  }

  private installLiveTimeMapping() {
    const ct = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'currentTime')!;
    const du = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'duration')!;
    const v = this.video;
    this.nativeSetTime = (t) => ct.set!.call(v, t);
    this.nativeGetTime = () => ct.get!.call(v) as number;
    Object.defineProperty(v, 'currentTime', {
      configurable: true,
      get: () => this.nativeGetTime() + (this.live ? this.live.offset : 0),
      set: (t: number) => {
        if (this.live) this.liveSeek(t);
        else this.nativeSetTime(t);
      },
    });
    Object.defineProperty(v, 'duration', {
      configurable: true,
      get: () => (this.live ? this.live.duration : (du.get!.call(v) as number)),
    });
    v.addEventListener('error', () => {
      const l = this.live;
      if (!l || l.fellBack) return;
      l.fellBack = true;
      const at = this.nativeGetTime() + l.offset;
      this.live = null;
      void this.resolveVideoUrl(l.item).then((url) => {
        if (!url || this.currentVideoId !== l.item.id) return;
        v.src = url;
        v.addEventListener('loadedmetadata', () => this.nativeSetTime(at), { once: true });
        v.play().catch(() => {});
      });
    });
  }

  private liveUrl(item: VideoItem, startAt: number): string {
    const plan = planPlayback(item);
    const streams = item.audioStreams ?? [];
    const defaultIdx = Math.max(0, streams.findIndex((a) => a.isDefault));
    const ai = item.activeAudioIndex ?? defaultIdx;
    const q = new URLSearchParams({
      v: plan.video,
      a: plan.audio,
      ai: String(ai),
      ch: String(streams[ai]?.channels ?? 2),
      sur: this.settings.surround ? '1' : '0',
      tm: item.isHdr && plan.video === 'transcode' ? '1' : '0',
      hevc: /hevc|h\.265/i.test(item.codec) ? '1' : '0',
      ss: String(Math.max(0, startAt)),
    });
    return `localmedia://live/${encodeURIComponent(item.sourcePath!)}?${q.toString()}`;
  }

  private liveSeek(t: number) {
    const l = this.live;
    if (!l) return;
    t = Math.max(0, Math.min(t, l.duration || t));
    const pos = t - l.offset;
    const b = this.video.buffered;
    let end = 0;
    for (let i = 0; i < b.length; i++) if (b.start(i) <= Math.max(0, this.nativeGetTime()) + 0.1) end = Math.max(end, b.end(i));
    if (pos >= 0 && pos < end - 0.5) {
      this.nativeSetTime(pos);
      return;
    }
    l.offset = t;
    this.video.src = this.liveUrl(l.item, t);
    this.video.play().catch(() => {});
  }

  private ensureGraph() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return;
    }

    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    this.ctx = new AudioCtx();
    this.audioSource = this.ctx.createMediaElementSource(this.audio);
    this.videoSource = this.ctx.createMediaElementSource(this.video);

    this.filters = EQ_FREQUENCIES.map((freq, idx) => {
      const filter = this.ctx!.createBiquadFilter();
      if (idx === 0) {
        filter.type = 'lowshelf';
      } else if (idx === EQ_FREQUENCIES.length - 1) {
        filter.type = 'highshelf';
      } else {
        filter.type = 'peaking';
        filter.Q.value = 1.4;
      }
      filter.frequency.value = freq;
      filter.gain.value = this.pendingEqEnabled ? (this.pendingBands[idx] ?? 0) : 0;
      return filter;
    });

    this.gainNode = this.ctx.createGain();
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 256;
    this.analyser.smoothingTimeConstant = 0.84;

    // Both audio and video sources feed the shared 10-band EQ + Analyser chain cleanly
    this.audioSource.connect(this.filters[0]);
    this.videoSource.connect(this.filters[0]);

    for (let i = 0; i < this.filters.length - 1; i++) {
      this.filters[i].connect(this.filters[i + 1]);
    }
    this.filters[this.filters.length - 1].connect(this.gainNode);
    this.gainNode.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);
    this.applyOutputSettings();
  }

  private applyOutputSettings() {
    const ctx = this.ctx as (AudioContext & { setSinkId?: (id: string) => Promise<void> }) | null;
    if (!ctx) return;
    try {
      const max = ctx.destination.maxChannelCount || 2;
      ctx.destination.channelCount = this.settings.surround ? Math.min(max, 8) : 2;
      ctx.destination.channelCountMode = 'explicit';
      ctx.destination.channelInterpretation = 'speakers';
    } catch {
      // device does not support this channel layout
    }
    if (ctx.setSinkId) {
      ctx.setSinkId(this.settings.outputDeviceId || '').catch(() => {});
    }
  }

  getSettings(): EngineSettings {
    return { ...this.settings };
  }

  updateSettings(patch: Partial<EngineSettings>) {
    this.settings = { ...this.settings, ...patch };
    try {
      localStorage.setItem('vp-audio-settings', JSON.stringify(this.settings));
    } catch {
      // storage unavailable
    }
    this.ensureGraph();
    this.applyOutputSettings();
  }

  onPrepareStatus(cb: (s: PrepareStatus) => void): () => void {
    this.statusListeners.add(cb);
    return () => this.statusListeners.delete(cb);
  }

  private emit(s: PrepareStatus) {
    this.statusListeners.forEach((cb) => cb(s));
  }

  /** Direct file URL, or a cached fast-remux / converted MP4 when the source needs it. */
  private async resolveVideoUrl(item: VideoItem): Promise<string | null> {
    const api = nativeApi();
    if (!api || !item.sourcePath) return item.videoUrl ?? null;
    const plan = planPlayback(item);
    if (plan.direct) return item.videoUrl ?? api.mediaUrl(item.sourcePath);

    const streams = item.audioStreams ?? [];
    const defaultIdx = Math.max(0, streams.findIndex((a) => a.isDefault));
    const audioIndex = item.activeAudioIndex ?? defaultIdx;
    const stream = streams[audioIndex];
    const surround = this.settings.surround;
    const key = `${item.id}|${audioIndex}|${surround}`;
    const cached = this.preparedUrls.get(key);
    if (cached) return cached;

    const off = api.onPrepareProgress((d) => {
      if (d.id === key) this.emit({ type: 'progress', id: item.id, title: item.title, progress: d.progress });
    });
    this.emit({ type: 'progress', id: item.id, title: item.title, progress: 0 });
    try {
      const url = await api.prepare(key, item.sourcePath, {
        video: plan.video,
        audio: plan.audio,
        audioIndex,
        audioChannels: stream?.channels ?? 2,
        surround,
        tonemap: Boolean(item.isHdr) && plan.video === 'transcode',
        hevc: /hevc|h\.265/i.test(item.codec),
        duration: item.duration,
      });
      this.preparedUrls.set(key, url);
      this.emit({ type: 'done', id: item.id });
      return url;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      if (!/cancelled/i.test(message)) this.emit({ type: 'error', id: item.id, title: item.title, message });
      return null;
    } finally {
      off();
    }
  }

  getAudioElement(): HTMLAudioElement {
    return this.audio;
  }

  getVideoElement(): HTMLVideoElement {
    return this.video;
  }

  getActiveMode(): 'audio' | 'video' {
    return this.activeMode;
  }

  getActiveElement(): HTMLMediaElement {
    return this.activeMode === 'video' ? this.video : this.audio;
  }

  getAnalyser(): AnalyserNode | null {
    return this.analyser;
  }

  async loadAndPlay(
    item: VideoItem,
    volume: number,
    muted: boolean,
    playbackRate: number,
    eqBands: number[],
    eqEnabled: boolean,
    startAt = 0
  ) {
    this.ensureGraph();

    if (item.videoUrl || item.sourcePath) {
      // Real local <video> playback
      this.audio.pause();
      this.activeMode = 'video';
      const token = ++this.loadToken;
      this.currentVideoId = item.id;

      const api = nativeApi();
      if (item.sourcePath && api && !planPlayback(item).direct) {
        // Instant start: stream through the bundled ffmpeg instead of waiting for a converted file.
        this.live = { item, offset: startAt > 0 ? startAt : 0, duration: item.duration, fellBack: false };
        this.video.src = this.liveUrl(item, startAt);
      } else {
        this.live = null;
        const url = item.videoUrl ?? (item.sourcePath && api ? await api.mediaUrl(item.sourcePath) : null);
        if (!url || token !== this.loadToken) return;
        if (this.video.src !== url) {
          this.video.src = url;
          this.video.load();
        }
        if (startAt && startAt > 0) {
          this.video.addEventListener('loadedmetadata', () => this.nativeSetTime(startAt), { once: true });
        }
      }

      this.video.volume = muted ? 0 : volume;
      this.video.playbackRate = playbackRate;
      this.setEqBands(eqBands, eqEnabled);

      try {
        await this.video.play();
      } catch {
        // Quick-switch or autoplay guard handled gracefully
      }
      return;
    }

    // Built-in procedural video with synthesized soundtrack
    this.loadToken++;
    this.video.pause();
    this.activeMode = 'audio';

    let url = this.cachedUrls.get(item.id);
    if (!url && item.synthRecipe) {
      url = synthesizeSoundtrackWavUrl(item.synthRecipe, item.duration);
      this.cachedUrls.set(item.id, url);
    }

    if (!url) return;

    if (this.currentVideoId !== item.id || this.audio.src !== url) {
      this.currentVideoId = item.id;
      this.audio.src = url;
      this.audio.load();
    }

    this.audio.volume = muted ? 0 : volume;
    this.audio.playbackRate = playbackRate;
    this.setEqBands(eqBands, eqEnabled);

    try {
      await this.audio.play();
    } catch {
      // Quick-switch or autoplay guard handled gracefully
    }
  }

  async play() {
    this.ensureGraph();
    try {
      await this.getActiveElement().play();
    } catch {
      // Ignore interrupted play errors
    }
  }

  pause() {
    this.audio.pause();
    this.video.pause();
  }

  seek(timeSec: number) {
    if (Number.isFinite(timeSec) && timeSec >= 0) {
      this.getActiveElement().currentTime = timeSec;
    }
  }

  setVolume(volume: number, muted: boolean) {
    const val = muted ? 0 : Math.max(0, Math.min(1, volume));
    this.audio.volume = val;
    this.video.volume = val;
  }

  setPlaybackRate(rate: number) {
    this.audio.playbackRate = rate;
    this.video.playbackRate = rate;
  }

  setEqBands(bands: number[], enabled: boolean) {
    this.pendingBands = [...bands];
    this.pendingEqEnabled = enabled;
    this.filters.forEach((filter, idx) => {
      const targetGain = enabled ? Math.max(-12, Math.min(12, bands[idx] ?? 0)) : 0;
      filter.gain.value = targetGain;
    });
  }
}

export const mediaEngine = new MediaPlaybackEngine();
