import { RotateCcw, SlidersHorizontal, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import {
  EQ_FREQUENCY_LABELS,
  EQ_PRESET_GAINS,
  EqPreset,
} from '@/src/types/video';

interface EqualizerModalProps {
  open: boolean;
  eqPreset: EqPreset;
  eqBands: number[];
  eqEnabled: boolean;
  playbackRate: number;
  onClose: () => void;
  onSelectPreset: (preset: Exclude<EqPreset, 'custom'>) => void;
  onChangeBand: (bandIndex: number, gainDb: number) => void;
  onToggleEnabled: () => void;
  onReset: () => void;
  onChangePlaybackRate: (rate: number) => void;
}

const PRESET_OPTIONS: { id: EqPreset; label: string }[] = [
  { id: 'custom', label: 'Custom' },
  { id: 'flat', label: 'Flat' },
  { id: 'bass', label: 'Cinema Bass' },
  { id: 'vocal', label: 'Dialogue Clarity' },
  { id: 'acoustic', label: 'Natural Room' },
  { id: 'electronic', label: 'Dynamic' },
  { id: 'rock', label: 'Action' },
  { id: 'pop', label: 'Balanced' },
];

export function EqualizerModal({
  open,
  eqPreset,
  eqBands,
  eqEnabled,
  playbackRate,
  onClose,
  onSelectPreset,
  onChangeBand,
  onToggleEnabled,
  onReset,
  onChangePlaybackRate,
}: EqualizerModalProps) {
  const [activeBand, setActiveBand] = useState<number | null>(null);
  const trackRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const updateBandFromClientY = (bandIndex: number, clientY: number) => {
    const el = trackRefs.current[bandIndex];
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const ratio = 1 - Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
    const db = Math.round((ratio * 24 - 12) * 2) / 2;
    onChangeBand(bandIndex, Math.max(-12, Math.min(12, db)));
  };

  const presetTitle =
    PRESET_OPTIONS.find((p) => p.id === eqPreset)?.label || 'Custom';

  const speedOptions = [0.5, 0.75, 1, 1.25, 1.5, 2];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Video Audio Equalizer"
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/55 backdrop-blur-xs flex items-center justify-center p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background:
            'linear-gradient(135deg, #165973 0%, #1d5d76 50%, #3a5b7d 100%)',
        }}
        className="w-full max-w-[840px] rounded-xl text-white border border-white/15 shadow-2xl overflow-hidden select-none"
      >
        {/* Header Bar */}
        <div className="px-6 pt-5 pb-4 flex flex-wrap items-center justify-between gap-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <SlidersHorizontal size={18} className="text-[#88d4ee]" />
            <h2 className="font-display text-xl font-semibold tracking-tight text-white">
              {presetTitle}
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <select
              aria-label="Equalizer preset"
              value={eqPreset}
              onChange={(e) => {
                const val = e.target.value as EqPreset;
                if (val !== 'custom' && EQ_PRESET_GAINS[val]) {
                  onSelectPreset(val);
                }
              }}
              className="h-8 px-3 rounded-md text-[12.5px] font-medium bg-white/12 hover:bg-white/18 text-white border border-white/15 focus:outline-none cursor-pointer"
            >
              {PRESET_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id} className="bg-[#1e3a4c] text-white">
                  Preset: {opt.label}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={onToggleEnabled}
              aria-pressed={eqEnabled}
              className={`h-8 px-3 rounded-md text-[12.5px] font-medium border transition-colors ${
                eqEnabled
                  ? 'bg-[#88d4ee] text-[#0c2735] border-[#88d4ee]'
                  : 'bg-white/10 text-white/80 border-white/15 hover:bg-white/15'
              }`}
            >
              {eqEnabled ? 'EQ On' : 'EQ Off'}
            </button>

            <button
              type="button"
              onClick={onReset}
              title="Reset all bands to 0 dB"
              className="h-8 px-3 rounded-md inline-flex items-center gap-1.5 text-[12.5px] font-medium bg-white/10 hover:bg-white/18 text-white border border-white/15 transition-colors"
            >
              <RotateCcw size={13} />
              <span>Reset</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close equalizer"
              className="w-8 h-8 rounded-md flex items-center justify-center text-white/80 hover:text-white hover:bg-white/12 transition-colors"
            >
              <X size={17} />
            </button>
          </div>
        </div>

        {/* 10-Band Vertical Graphic Equalizer */}
        <div className="px-6 py-7">
          <div className="flex items-stretch gap-4">
            <div className="w-12 h-[240px] flex flex-col justify-between text-[12.5px] font-mono-tabular text-white/90 text-right pr-1 shrink-0 py-0.5">
              <span>12 dB</span>
              <span>6 dB</span>
              <span>0 dB</span>
              <span>-6 dB</span>
              <span>-12 dB</span>
            </div>

            <div className="flex-1 grid grid-cols-10 gap-2">
              {EQ_FREQUENCY_LABELS.map((label, idx) => {
                const value = eqBands[idx] ?? 0;
                const pct = ((value + 12) / 24) * 100;
                const isActive = activeBand === idx;

                return (
                  <div key={label} className="flex flex-col items-center">
                    <div
                      ref={(el) => {
                        trackRefs.current[idx] = el;
                      }}
                      role="slider"
                      tabIndex={0}
                      aria-label={`${label} equalizer band`}
                      aria-valuemin={-12}
                      aria-valuemax={12}
                      aria-valuenow={value}
                      onPointerDown={(e) => {
                        e.currentTarget.setPointerCapture(e.pointerId);
                        setActiveBand(idx);
                        updateBandFromClientY(idx, e.clientY);
                      }}
                      onPointerMove={(e) => {
                        if (activeBand === idx && e.buttons > 0) {
                          updateBandFromClientY(idx, e.clientY);
                        }
                      }}
                      onPointerUp={() => setActiveBand(null)}
                      onPointerCancel={() => setActiveBand(null)}
                      onKeyDown={(e) => {
                        if (e.key === 'ArrowUp' || e.key === 'ArrowRight') {
                          e.preventDefault();
                          onChangeBand(idx, Math.min(12, value + 1));
                        } else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
                          e.preventDefault();
                          onChangeBand(idx, Math.max(-12, value - 1));
                        } else if (e.key === 'Home') {
                          e.preventDefault();
                          onChangeBand(idx, 0);
                        }
                      }}
                      className="relative w-10 h-[240px] flex items-center justify-center cursor-pointer touch-none focus:outline-none group"
                    >
                      <div
                        className={`w-[3px] h-full rounded-full transition-opacity ${
                          eqEnabled ? 'bg-[#8ad3ec]/80' : 'bg-white/30'
                        }`}
                      />

                      <div
                        style={{
                          bottom: `calc(${pct}% - 13px)`,
                        }}
                        className={`absolute left-1/2 -translate-x-1/2 w-[26px] h-[26px] rounded-full border-[2.5px] flex items-center justify-center transition-transform ${
                          eqEnabled
                            ? 'border-[#8ad3ec] bg-[#1b5a72]/90'
                            : 'border-white/50 bg-[#1b5a72]/80'
                        } ${isActive ? 'scale-115' : 'group-hover:scale-110'}`}
                      >
                        <span
                          className={`w-[10px] h-[10px] rounded-full ${
                            eqEnabled ? 'bg-[#8ad3ec]' : 'bg-white/60'
                          }`}
                        />
                      </div>

                      <div
                        className={`absolute -top-6 px-1.5 py-0.5 rounded text-[10.5px] font-mono-tabular bg-black/55 text-white pointer-events-none transition-opacity ${
                          isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                        }`}
                      >
                        {value > 0 ? `+${value}` : value} dB
                      </div>
                    </div>

                    <span className="mt-4 text-[12px] font-medium text-white/90 whitespace-nowrap">
                      {label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer: Playback Speed */}
        <div className="px-6 py-3.5 bg-black/15 border-t border-white/10 flex flex-wrap items-center justify-between gap-3">
          <span className="text-[12.5px] text-white/80">
            Adjust vertical bands (-12 dB to +12 dB) and video playback speed.
          </span>
          <div className="flex items-center gap-1.5">
            <span className="text-[12px] text-white/75 mr-1">Speed</span>
            {speedOptions.map((rate) => (
              <button
                key={rate}
                type="button"
                onClick={() => onChangePlaybackRate(rate)}
                className={`h-7 px-2.5 rounded text-[12px] font-mono-tabular transition-colors ${
                  playbackRate === rate
                    ? 'bg-[#88d4ee] text-[#0c2735] font-semibold'
                    : 'bg-white/10 text-white hover:bg-white/18'
                }`}
              >
                {rate}x
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
