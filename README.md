# Video Player (Windows 11 desktop app)

Electron app. Plays virtually any video without installing codecs (bundled ffmpeg):
HEVC/H.265, AV1, VP9, H.264, ProRes, MPEG-2, VC-1, DivX… and AC3, E-AC3, DTS, TrueHD, FLAC, Opus…

- **HW / SW decoding** (Settings > Playback; restarts the app)
- **Audio output device** selection, stereo / surround option
- **HDR button** – enabled only for HDR videos (HDR10, HLG, Dolby Vision base layer). Turn on "Use HDR" in Windows Settings > Display.
  If a video can't be decoded directly it is converted (HDR is tone-mapped to SDR in that case).
- Multiple audio tracks, embedded subtitles, .vtt subtitles
- Keyboard: Space play/pause, ←/→ seek (Shift = 30s), ↑/↓ volume, N/P next/previous, M mute

Converted/remuxed files are cached in the app data folder (Settings > Playback > clear cache).

## Build
GitHub Actions builds the installer and portable exe on every push (see Releases). Locally: `build-windows.bat` (needs Node.js).
