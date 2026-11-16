import { CaptionCue } from '@/src/types/video';

function parseVttTimestamp(ts: string): number {
  const clean = ts.trim().replace(',', '.');
  const parts = clean.split(':');
  if (parts.length === 3) {
    const hours = Number(parts[0]) || 0;
    const mins = Number(parts[1]) || 0;
    const secs = Number(parts[2]) || 0;
    return hours * 3600 + mins * 60 + secs;
  }
  if (parts.length === 2) {
    const mins = Number(parts[0]) || 0;
    const secs = Number(parts[1]) || 0;
    return mins * 60 + secs;
  }
  return Number(clean) || 0;
}

function stripVttTags(text: string): string {
  return text
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .trim();
}

/**
 * Parses WebVTT (.vtt) text content into timed CaptionCue[] items.
 */
export function parseVttContent(raw: string): CaptionCue[] {
  const normalized = raw.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const blocks = normalized.split(/\n{2,}/);
  const cues: CaptionCue[] = [];

  for (const block of blocks) {
    const lines = block
      .split('\n')
      .map((l) => l.trimEnd())
      .filter((l) => l.length > 0);

    if (lines.length === 0) continue;

    const first = lines[0].trim();
    if (
      first.startsWith('WEBVTT') ||
      first.startsWith('NOTE') ||
      first.startsWith('STYLE') ||
      first.startsWith('REGION')
    ) {
      continue;
    }

    const timingLineIdx = lines.findIndex((l) => l.includes('-->'));
    if (timingLineIdx === -1) continue;

    const timingLine = lines[timingLineIdx];
    const arrowIdx = timingLine.indexOf('-->');
    const startPart = timingLine.slice(0, arrowIdx).trim();
    const endAndSettings = timingLine.slice(arrowIdx + 3).trim();
    const endPart = endAndSettings.split(/\s+/)[0] || '';

    const startSec = parseVttTimestamp(startPart);
    const endSec = parseVttTimestamp(endPart);
    const cueText = stripVttTags(lines.slice(timingLineIdx + 1).join('\n'));

    if (cueText && Number.isFinite(startSec) && Number.isFinite(endSec) && endSec > startSec) {
      cues.push({ startSec, endSec, text: cueText });
    }
  }

  return cues.sort((a, b) => a.startSec - b.startSec);
}

const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  eng: 'English',
  es: 'Español',
  spa: 'Español',
  fr: 'Français',
  fre: 'Français',
  de: 'Deutsch',
  ger: 'Deutsch',
  it: 'Italiano',
  pt: 'Português',
  ja: '日本語',
  jpn: '日本語',
  ko: '한국어',
  zh: '中文',
  hi: 'हिन्दी',
  ta: 'தமிழ்',
  ar: 'العربية',
};

/**
 * Infers video stem and readable track label from a .vtt filename
 * e.g. "01_Movie.en.vtt" -> { videoStem: "01_Movie", label: "English (.vtt)", language: "en" }
 */
export function parseVttFilenameInfo(filename: string): {
  videoStem: string;
  label: string;
  language?: string;
} {
  const withoutVtt = filename.replace(/\.vtt$/i, '');
  const dotParts = withoutVtt.split('.');
  if (dotParts.length >= 2) {
    const lastSegment = dotParts[dotParts.length - 1].toLowerCase();
    const langCode = lastSegment.split(/[-_]/)[0];
    if (LANGUAGE_NAMES[langCode] || /^[a-z]{2,3}(-[a-z]{2,4})?$/i.test(lastSegment)) {
      const baseStem = dotParts.slice(0, -1).join('.');
      const readable = LANGUAGE_NAMES[langCode] || lastSegment.toUpperCase();
      return {
        videoStem: baseStem,
        label: `${readable} (.vtt)`,
        language: lastSegment,
      };
    }
  }

  return {
    videoStem: withoutVtt,
    label: `${withoutVtt} (.vtt)`,
  };
}
