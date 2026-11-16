import { useEffect, useState } from 'react';
import { mediaEngine } from '@/src/media/MediaEngine';
import { NativeCaps, nativeApi } from '@/src/media/native';

const selectCls =
  'h-9 px-3 rounded-md text-[13px] bg-white dark:bg-[#2b2b2b] border border-black/10 dark:border-white/10 text-neutral-900 dark:text-neutral-100 max-w-full';

export function PlaybackSettings() {
  const api = nativeApi();
  const [hwDecode, setHwDecode] = useState(true);
  const [caps, setCaps] = useState<NativeCaps | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [device, setDevice] = useState(mediaEngine.getSettings().outputDeviceId);
  const [surround, setSurround] = useState(mediaEngine.getSettings().surround);
  const [note, setNote] = useState('');

  useEffect(() => {
    api?.getSettings().then((s) => setHwDecode(s.hwDecode)).catch(() => {});
    api?.capabilities().then(setCaps).catch(() => {});
    (async () => {
      try {
        // A brief mic permission request makes Chromium reveal device names.
        const st = await navigator.mediaDevices.getUserMedia({ audio: true }).catch(() => null);
        st?.getTracks().forEach((t) => t.stop());
        const all = await navigator.mediaDevices.enumerateDevices();
        setDevices(all.filter((d) => d.kind === 'audiooutput'));
      } catch { /* ignore */ }
    })();
  }, []);

  const changeDecode = async (hw: boolean) => {
    setHwDecode(hw);
    await api?.setSettings({ hwDecode: hw });
    setNote('Restarting to apply the decoding mode…');
    setTimeout(() => api?.relaunch(), 600);
  };

  return (
    <section aria-labelledby="settings-playback-heading" className="space-y-3">
      <h2 id="settings-playback-heading" className="font-display text-[15px] font-semibold">
        Playback
      </h2>
      <div className="rounded-lg border border-black/[0.08] dark:border-white/[0.08] bg-white dark:bg-[#2b2b2b] p-4 space-y-5">
        <div>
          <div className="text-[13.5px] font-medium">Video decoding</div>
          <p className="text-[12px] text-neutral-500 dark:text-neutral-400 mt-0.5">
            Hardware uses your GPU (HEVC, AV1, VP9, H.264). Software uses the CPU. Formats the
            player can't decode natively are converted automatically
            {caps?.hwEncoders?.length ? ` (GPU encoder: ${caps.hwEncoders.join(', ')})` : ''}.
          </p>
          <div className="mt-2 inline-flex rounded-md overflow-hidden border border-black/10 dark:border-white/10">
            {([true, false] as const).map((hw) => (
              <button
                key={String(hw)}
                type="button"
                onClick={() => hw !== hwDecode && changeDecode(hw)}
                aria-pressed={hwDecode === hw}
                className={`h-9 px-4 text-[13px] ${
                  hwDecode === hw
                    ? 'bg-black/10 dark:bg-white/15 font-semibold'
                    : 'hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'
                }`}
              >
                {hw ? 'Hardware (HW)' : 'Software (SW)'}
              </button>
            ))}
          </div>
          {note && <p className="text-[12px] mt-2 text-neutral-500">{note}</p>}
        </div>

        <div>
          <div className="text-[13.5px] font-medium">Audio output device</div>
          <select
            className={`${selectCls} mt-2`}
            value={device}
            aria-label="Audio output device"
            onChange={(e) => {
              setDevice(e.target.value);
              mediaEngine.updateSettings({ outputDeviceId: e.target.value });
            }}
          >
            <option value="">System default</option>
            {devices
              .filter((d) => d.deviceId && d.deviceId !== 'default')
              .map((d) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label || 'Audio device'}
                </option>
              ))}
          </select>
        </div>

        <div>
          <label className="flex items-center gap-2 text-[13.5px] font-medium cursor-pointer">
            <input
              type="checkbox"
              checked={surround}
              onChange={(e) => {
                setSurround(e.target.checked);
                mediaEngine.updateSettings({ surround: e.target.checked });
              }}
            />
            Keep surround sound (5.1 / 7.1) when converting audio
          </label>
          <p className="text-[12px] text-neutral-500 dark:text-neutral-400 mt-0.5">
            Off: AC3, E-AC3, DTS, TrueHD are downmixed to stereo. Applies the next time a video loads.
          </p>
        </div>

        <div>
          <button
            type="button"
            onClick={async () => {
              await api?.clearCache();
              setNote('Converted-video cache cleared');
            }}
            className="h-9 px-4 rounded-md text-[13px] border border-black/10 dark:border-white/10 hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
          >
            Clear converted-video cache
          </button>
        </div>
      </div>
    </section>
  );
}
