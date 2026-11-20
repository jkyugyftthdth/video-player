'use strict';
// ffmpeg-powered media helpers (main process). A full ffmpeg build is bundled, so every
// codec/container it knows (HEVC, AV1, VP9, ProRes, MPEG-2, VC-1, AC3, E-AC3, DTS, TrueHD, ...) is supported
// without installing anything on Windows.
const { spawn } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

function ffmpegBinary() {
  if (process.env.FFMPEG_PATH) return process.env.FFMPEG_PATH;
  let p = require('ffmpeg-static');
  if (p && p.includes('app.asar')) p = p.replace('app.asar', 'app.asar.unpacked');
  return p;
}

function run(args, { collectStdout = true, maxBytes = 64 * 1024 * 1024, onStdoutLine, onProc } = {}) {
  return new Promise((resolve) => {
    let proc;
    try {
      proc = spawn(ffmpegBinary(), args, { windowsHide: true });
    } catch (e) {
      resolve({ code: -1, stdout: Buffer.alloc(0), stderr: String(e) });
      return;
    }
    if (onProc) onProc(proc);
    const out = [];
    let outLen = 0;
    let lineBuf = '';
    const err = [];
    let errLen = 0;
    proc.stdout.on('data', (d) => {
      if (onStdoutLine) {
        lineBuf += d.toString('utf8');
        let i;
        while ((i = lineBuf.indexOf('\n')) >= 0) {
          onStdoutLine(lineBuf.slice(0, i).trim());
          lineBuf = lineBuf.slice(i + 1);
        }
      }
      if (!collectStdout) return;
      outLen += d.length;
      if (outLen <= maxBytes) out.push(d);
    });
    proc.stderr.on('data', (d) => {
      errLen += d.length;
      if (errLen < 2 * 1024 * 1024) err.push(d);
    });
    proc.on('error', (e) => resolve({ code: -1, stdout: Buffer.alloc(0), stderr: String(e) }));
    proc.on('close', (code) =>
      resolve({ code, stdout: Buffer.concat(out), stderr: Buffer.concat(err).toString('utf8') })
    );
  });
}

// ---------- probing ----------
const TEXT_SUB_CODECS = new Set(['subrip', 'srt', 'ass', 'ssa', 'mov_text', 'webvtt', 'text', 'microdvd', 'subviewer']);

function parseProbe(stderr) {
  const dump = stderr.split(/\r?\n(?=Output #0|At least one output|Stream mapping)/)[0];
  const lines = dump.split(/\r?\n/);
  const result = { container: '', duration: 0, bitrateKbps: undefined, tags: {}, video: null, audio: [], subtitles: [], dolbyVision: false };

  const inp = dump.match(/Input #0, ([^,]+(?:,[^,]+)*?), from /);
  if (inp) result.container = inp[1];
  const dur = dump.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
  if (dur) result.duration = +dur[1] * 3600 + +dur[2] * 60 + parseFloat(dur[3]);
  const br = dump.match(/Duration:.*?bitrate:\s*(\d+)\s*kb\/s/);
  if (br) result.bitrateKbps = +br[1];

  let cur = null;
  let inMeta = false;
  let metaIndent = 0;
  let metaTarget = null;
  for (const raw of lines) {
    const st = raw.match(/^\s+Stream #0:(\d+)(?:\[[^\]]*\])?(?:\(([^)]*)\))?[^:]*: (Video|Audio|Subtitle|Attachment|Data): (.*)$/);
    if (st) {
      const kind = st[3];
      const rest = st[4];
      const lang = st[2] && st[2] !== 'und' ? st[2] : '';
      inMeta = false;
      if (kind === 'Video') {
        if (/\(attached pic\)/.test(rest) || result.video) { cur = null; continue; }
        const codec = rest.split(/[ ,(]/)[0];
        const profile = (rest.match(/^\S+ \(([^)]*)\)/) || [])[1] || '';
        const pf = rest.match(/,\s*((?:yuvj?|gbrp|rgb|bgr|nv|p0|p2|gray|ya|xyz|pal)[a-z0-9]*)(?:\(([^)]*)\))?/i);
        const pixFmt = pf ? pf[1] : '';
        const colorInfo = pf && pf[2] ? pf[2].split(',').map((s) => s.trim()) : [];
        const trip = (colorInfo.find((s) => s.includes('/')) || '').split('/');
        const res = rest.match(/(\d{2,5})x(\d{2,5})/);
        const fps = rest.match(/([\d.]+) fps/) || rest.match(/([\d.]+) tbr/);
        const sbr = rest.match(/(\d+) kb\/s/);
        const depth = /p(?:10|012|12|16)|10(?:le|be)|12(?:le|be)/.test(pixFmt) ? (/12/.test(pixFmt) ? 12 : 10) : 8;
        cur = {
          codec, profile, pixFmt, bitDepth: depth,
          matrix: trip[0] || '', primaries: trip[1] || '', transfer: trip[2] || '',
          width: res ? +res[1] : 0, height: res ? +res[2] : 0,
          fps: fps ? parseFloat(fps[1]) : 0, bitrateKbps: sbr ? +sbr[1] : undefined,
        };
        result.video = cur;
        metaTarget = null;
      } else if (kind === 'Audio') {
        const codec = rest.split(/[ ,(]/)[0];
        const prof = (rest.match(/^\S+ \(([^)]*)\)/) || [])[1] || '';
        const hz = rest.match(/(\d+) Hz/);
        let channels = 0;
        let layout = '';
        const nch = rest.match(/(\d+) channels/);
        if (nch) { channels = +nch[1]; }
        else if (/\bmono\b/.test(rest)) { channels = 1; layout = 'mono'; }
        else if (/\bstereo\b/.test(rest)) { channels = 2; layout = 'stereo'; }
        else {
          const l = rest.match(/\b(\d\.\d(?:\.\d)?)(?:\([^)]*\))?/);
          if (l) { layout = l[1]; channels = l[1].split('.').reduce((n, x) => n + +x, 0); }
        }
        const sbr = rest.match(/(\d+) kb\/s/);
        cur = {
          index: result.audio.length, streamIndex: +st[1], codec, profile: prof, sampleRateHz: hz ? +hz[1] : undefined,
          channels, layout, bitrateKbps: sbr ? +sbr[1] : undefined, language: lang, title: '', isDefault: /\(default\)/.test(rest),
        };
        result.audio.push(cur);
        metaTarget = cur;
      } else if (kind === 'Subtitle') {
        const codec = rest.split(/[ ,(]/)[0];
        cur = { index: result.subtitles.length, streamIndex: +st[1], codec, language: lang, title: '', isDefault: /\(default\)/.test(rest), text: TEXT_SUB_CODECS.has(codec) };
        result.subtitles.push(cur);
        metaTarget = cur;
      } else {
        cur = null;
        metaTarget = null;
      }
      continue;
    }
    if (/DOVI configuration record|Dolby Vision/i.test(raw)) result.dolbyVision = true;
    const mh = raw.match(/^(\s*)Metadata:\s*$/);
    if (mh) { inMeta = true; metaIndent = mh[1].length; continue; }
    if (inMeta) {
      const kv = raw.match(/^(\s+)([A-Za-z_ ]+?)\s*:\s(.*)$/);
      if (kv && kv[1].length > metaIndent) {
        const key = kv[2].trim().toLowerCase();
        if (metaTarget) {
          if (key === 'title' && !metaTarget.title) metaTarget.title = kv[3];
          if (key === 'language' && !metaTarget.language && kv[3] !== 'und') metaTarget.language = kv[3];
        } else if (!result.video && !/^(encoder|major_brand|minor_version|compatible_brands|creation_time|duration)$/.test(key)) {
          result.tags[key] = kv[3];
        }
        continue;
      }
      inMeta = false;
    }
  }
  const v = result.video;
  if (v) {
    v.hdr = v.transfer === 'smpte2084' ? (result.dolbyVision ? 'Dolby Vision' : 'HDR10') : v.transfer === 'arib-std-b67' ? 'HLG' : result.dolbyVision ? 'Dolby Vision' : '';
  }
  return result;
}

async function probe(file) {
  const r = await run(['-hide_banner', '-nostdin', '-i', file], { collectStdout: false });
  const info = parseProbe(r.stderr);
  info.ok = Boolean(info.video || info.audio.length);
  return info;
}

async function thumbnail(file, atSec) {
  const args = ['-v', 'error', '-nostdin', '-ss', String(Math.max(0, atSec || 0)), '-i', file, '-map', '0:v:0', '-frames:v', '1',
    '-vf', 'scale=480:-2', '-q:v', '4', '-f', 'image2pipe', '-c:v', 'mjpeg', '-'];
  const r = await run(args, { maxBytes: 4 * 1024 * 1024 });
  return r.stdout.length > 100 ? { mime: 'image/jpeg', data: r.stdout } : null;
}

async function extractSubtitles(file, count, dir) {
  fs.mkdirSync(dir, { recursive: true });
  const outs = [];
  const args = ['-v', 'error', '-nostdin', '-y', '-i', file];
  for (let i = 0; i < count; i++) {
    const out = path.join(dir, `sub-${crypto.randomBytes(4).toString('hex')}-${i}.vtt`);
    outs.push(out);
    args.push('-map', `0:s:${i}`, '-f', 'webvtt', out);
  }
  await run(args, { collectStdout: false });
  return outs.map((o) => {
    try { const t = fs.readFileSync(o, 'utf8'); fs.rmSync(o, { force: true }); return t; } catch { return ''; }
  });
}

// ---------- capabilities ----------
let capsPromise = null;
function capabilities() {
  if (!capsPromise) {
    capsPromise = (async () => {
      const f = await run(['-hide_banner', '-filters'], { maxBytes: 1024 * 1024 });
      const filters = f.stdout.toString('utf8');
      const caps = { zscale: / zscale /.test(filters), tonemap: / tonemap /.test(filters), hwEncoders: [] };
      const test = async (enc) => {
        const r = await run(['-v', 'error', '-nostdin', '-f', 'lavfi', '-i', 'color=black:s=256x256:d=0.2', '-frames:v', '2', '-c:v', enc, '-f', 'null', '-'], { collectStdout: false });
        return r.code === 0;
      };
      for (const enc of ['h264_nvenc', 'h264_qsv', 'h264_amf']) {
        if (await test(enc)) caps.hwEncoders.push(enc);
      }
      return caps;
    })();
  }
  return capsPromise;
}

// ---------- make a Chromium-playable MP4 ----------
const jobs = new Map(); // key -> { promise, proc }

function prepareKey(file, st, o) {
  return crypto.createHash('sha1')
    .update(JSON.stringify([file, st.size, st.mtimeMs, o.video, o.audioIndex, o.audio, o.surround, o.tonemap, o.hw]))
    .digest('hex').slice(0, 24);
}

function codecArgs(o, caps) {
  const args = [];
  if (o.video === 'copy') {
    args.push('-c:v', 'copy');
    if (o.hevc) args.push('-tag:v', 'hvc1');
  } else {
    const vf = [];
    if (o.tonemap) {
      if (caps.zscale && caps.tonemap) {
        vf.push('zscale=t=linear:npl=100', 'format=gbrpf32le', 'zscale=p=bt709', 'tonemap=tonemap=hable:desat=0',
          'zscale=t=bt709:m=bt709:r=tv');
      }
    }
    vf.push('format=yuv420p');
    args.push('-vf', vf.join(','));
    const hwEnc = o.hw ? caps.hwEncoders[0] : null;
    if (hwEnc === 'h264_nvenc') args.push('-c:v', 'h264_nvenc', '-preset', 'p5', '-rc', 'vbr', '-cq', '21', '-b:v', '0');
    else if (hwEnc === 'h264_qsv') args.push('-c:v', 'h264_qsv', '-global_quality', '21');
    else if (hwEnc === 'h264_amf') args.push('-c:v', 'h264_amf', '-quality', 'balanced', '-rc', 'cqp', '-qp_i', '21', '-qp_p', '23');
    else args.push('-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20');
    args.push('-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709');
  }

  if (o.audio === 'copy') args.push('-c:a', 'copy');
  else if (o.audio === 'aac') {
    const ch = o.surround ? Math.min(Math.max(o.audioChannels || 2, 2), 6) : 2;
    args.push('-c:a', 'aac', '-ac', String(ch), '-b:a', ch > 2 ? '448k' : '192k');
  }
  return args;
}

async function prepare(file, o, cacheDir, onProgress) {
  // o: { video: 'copy'|'transcode', audio: 'copy'|'aac'|'none', audioIndex, surround, tonemap, hw, duration, hevc, audioChannels }
  const st = fs.statSync(file);
  const key = prepareKey(file, st, o);
  const out = path.join(cacheDir, `${key}.mp4`);
  if (fs.existsSync(out)) { try { fs.utimesSync(out, new Date(), new Date()); } catch {} return out; }
  if (jobs.has(key)) return jobs.get(key).promise;

  fs.mkdirSync(cacheDir, { recursive: true });
  const tmp = `${out}.part.mp4`;
  const caps = await capabilities();

  const args = ['-hide_banner', '-v', 'error', '-nostdin', '-y'];
  if (o.hw && o.video === 'transcode') args.push('-hwaccel', 'auto');
  args.push('-i', file, '-map', '0:v:0');
  if (o.audio !== 'none') args.push('-map', `0:a:${o.audioIndex || 0}?`);

  args.push(...codecArgs(o, caps));
  args.push('-sn', '-dn', '-map_metadata', '-1', '-movflags', '+faststart', '-progress', 'pipe:1', '-nostats', '-f', 'mp4', tmp);

  let procRef = null;
  const total = Math.max(1, o.duration || 1);
  const job = { proc: null, cancelled: false };
  const promise = run(args, {
    collectStdout: false,
    onProc: (p) => { procRef = p; job.proc = p; },
    onStdoutLine: (line) => {
      const m = line.match(/^out_time_(?:us|ms)=(\d+)/);
      if (m && onProgress) onProgress(Math.min(0.99, +m[1] / 1e6 / total));
    },
  }).then((r) => {
    jobs.delete(key);
    if (job.cancelled) { try { fs.rmSync(tmp, { force: true }); } catch {} throw new Error('cancelled'); }
    if (r.code !== 0 || !fs.existsSync(tmp)) {
      try { fs.rmSync(tmp, { force: true }); } catch {}
      throw new Error(r.stderr.trim().split(/\r?\n/).slice(-3).join(' ') || 'ffmpeg failed');
    }
    fs.renameSync(tmp, out);
    if (onProgress) onProgress(1);
    return out;
  });
  job.promise = promise;
  jobs.set(key, job);
  return promise;
}


/** ffmpeg arguments that stream a fragmented MP4 to stdout, starting at `start` seconds (instant playback, no waiting). */
async function liveArgs(file, o, start) {
  const caps = await capabilities();
  const args = ['-hide_banner', '-v', 'error', '-nostdin'];
  if (o.hw && o.video === 'transcode') args.push('-hwaccel', 'auto');
  if (start > 0) args.push('-ss', String(start));
  args.push('-i', file, '-map', '0:v:0');
  if (o.audio !== 'none') args.push('-map', `0:a:${o.audioIndex || 0}?`);
  args.push(...codecArgs(o, caps));
  if (o.video === 'transcode') args.push('-force_key_frames', 'expr:gte(t,n_forced*2)');
  args.push('-sn', '-dn', '-map_metadata', '-1', '-avoid_negative_ts', 'make_zero',
    '-movflags', '+frag_keyframe+empty_moov+default_base_moof', '-f', 'mp4', 'pipe:1');
  return args;
}

function cancelAll() {
  for (const j of jobs.values()) { j.cancelled = true; try { j.proc && j.proc.kill(); } catch {} }
}

function pruneCache(cacheDir, maxBytes = 30 * 1024 * 1024 * 1024) {
  try {
    const files = fs.readdirSync(cacheDir).map((f) => {
      const p = path.join(cacheDir, f);
      const s = fs.statSync(p);
      return { p, size: s.size, t: s.mtimeMs };
    });
    for (const f of files) if (f.p.endsWith('.part.mp4')) { fs.rmSync(f.p, { force: true }); }
    let total = files.filter((f) => !f.p.endsWith('.part.mp4')).reduce((n, f) => n + f.size, 0);
    files.sort((a, b) => a.t - b.t);
    for (const f of files) {
      if (total <= maxBytes) break;
      if (f.p.endsWith('.part.mp4')) continue;
      fs.rmSync(f.p, { force: true });
      total -= f.size;
    }
  } catch {}
}

function clearCache(cacheDir) {
  try { fs.rmSync(cacheDir, { recursive: true, force: true }); } catch {}
}

module.exports = { liveArgs, probe, thumbnail, extractSubtitles, capabilities, prepare, cancelAll, pruneCache, clearCache, ffmpegBinary, parseProbe };
