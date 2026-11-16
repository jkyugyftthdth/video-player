import { Film, Play, Plus, X } from 'lucide-react';
import { useEffect } from 'react';
import { AccentTheme, VideoItem } from '@/src/types/video';
import { ACCENT_PALETTES } from '@/src/utils/accent';
import {
  formatBitrate,
  formatDuration,
  formatFileSize,
  formatSampleRate,
} from '@/src/utils/format';
import { VideoThumb } from './VideoThumb';

interface VideoDetailsModalProps {
  video: VideoItem | null;
  accent: AccentTheme;
  onClose: () => void;
  onPlayVideo: (video: VideoItem) => void;
  onAddToQueue: (video: VideoItem) => void;
  onSelectCollection: (collectionId: string) => void;
  onSelectCreator: (creatorId: string) => void;
}

export function VideoDetailsModal({
  video,
  accent,
  onClose,
  onPlayVideo,
  onAddToQueue,
  onSelectCollection,
  onSelectCreator,
}: VideoDetailsModalProps) {
  const palette = ACCENT_PALETTES[accent];

  useEffect(() => {
    if (!video) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [video, onClose]);

  if (!video) return null;

  const totalBitrateKbps =
    (video.videoBitrateKbps || 0) + (video.audioBitrateKbps || 0);

  const technicalSpecs = [
    { label: 'Resolution', value: video.resolution || '—' },
    { label: 'Frame rate', value: video.frameRate || '—' },
    { label: 'Video bitrate', value: formatBitrate(video.videoBitrateKbps) },
    { label: 'Audio bitrate', value: formatBitrate(video.audioBitrateKbps) },
    {
      label: 'Total bitrate',
      value: totalBitrateKbps > 0 ? formatBitrate(totalBitrateKbps) : '—',
    },
    { label: 'Codec / Format', value: video.codec || '—' },
    { label: 'Aspect ratio', value: video.aspectRatio || '16:9' },
    { label: 'Sample rate', value: formatSampleRate(video.sampleRateHz) },
    { label: 'Audio channels', value: video.channels || '2 (Stereo)' },
    { label: 'Duration', value: formatDuration(video.duration) },
    { label: 'File size', value: formatFileSize(video.fileSizeBytes) },
    { label: 'Release year', value: String(video.year) },
    { label: 'Director / Producer', value: video.director || video.creator },
    { label: 'Camera / Capture', value: video.cameraSpecs || 'Digital Video' },
    {
      label: 'Source file',
      value: video.fileName || `${video.title.toLowerCase().replace(/\s+/g, '_')}.mp4`,
    },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="video-details-title"
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl max-h-[88vh] flex flex-col rounded-xl bg-white dark:bg-[#272727] border border-black/10 dark:border-white/10 shadow-2xl overflow-hidden"
      >
        {/* Top Header */}
        <div className="px-6 py-4 border-b border-black/[0.07] dark:border-white/[0.07] flex items-center justify-between">
          <div className="flex items-center gap-2 text-[13px] font-medium text-neutral-600 dark:text-neutral-300">
            <Film size={15} className={palette.activeText} />
            <span>Video properties & details</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close video details"
            className="w-8 h-8 rounded-md flex items-center justify-center text-neutral-500 dark:text-neutral-400 hover:bg-black/[0.06] dark:hover:bg-white/[0.08] transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Header Summary with 16:9 Preview */}
          <div className="flex flex-col sm:flex-row gap-5 items-start">
            <div className="w-48 aspect-video rounded-lg overflow-hidden shrink-0 border border-black/10 dark:border-white/10 shadow-md">
              <VideoThumb
                src={video.thumbnailUrl}
                alt={video.title}
                className="w-full h-full"
                iconSize={30}
                roundedClass="rounded-lg"
              />
            </div>

            <div className="min-w-0 flex-1">
              <h2
                id="video-details-title"
                className="font-display text-xl sm:text-2xl font-semibold tracking-tight text-neutral-950 dark:text-white"
              >
                {video.title}
              </h2>

              <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13.5px] text-neutral-600 dark:text-neutral-300">
                <button
                  type="button"
                  onClick={() => {
                    onSelectCreator(video.creatorId);
                    onClose();
                  }}
                  className={`font-medium hover:underline ${palette.activeText}`}
                >
                  {video.creator}
                </button>
                <span aria-hidden="true">·</span>
                <button
                  type="button"
                  onClick={() => {
                    onSelectCollection(video.collectionId);
                    onClose();
                  }}
                  className="hover:underline"
                >
                  {video.collection}
                </button>
                <span aria-hidden="true">·</span>
                <span className="tabular-nums">{video.year}</span>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onPlayVideo(video);
                    onClose();
                  }}
                  className={`h-8 px-3.5 rounded-md inline-flex items-center gap-1.5 text-[12.5px] font-medium transition-colors ${palette.buttonBg} ${palette.buttonText}`}
                >
                  <Play size={13} className="fill-current" />
                  <span>Play video</span>
                </button>

                <button
                  type="button"
                  onClick={() => onAddToQueue(video)}
                  className="h-8 px-3.5 rounded-md inline-flex items-center gap-1.5 text-[12.5px] font-medium bg-black/[0.05] dark:bg-white/[0.08] hover:bg-black/[0.09] dark:hover:bg-white/[0.12] text-neutral-800 dark:text-neutral-200 transition-colors"
                >
                  <Plus size={14} />
                  <span>Add to queue</span>
                </button>
              </div>
            </div>
          </div>

          {/* About This Video */}
          <section>
            <h3 className="text-[12.5px] font-semibold text-neutral-900 dark:text-neutral-100 mb-2">
              About this video
            </h3>
            <p className="text-[13.5px] leading-relaxed text-neutral-700 dark:text-neutral-300 bg-black/[0.03] dark:bg-white/[0.04] rounded-lg p-3.5 border border-black/[0.05] dark:border-white/[0.05]">
              {video.about ||
                `"${video.title}" by ${video.creator} from the "${video.collection}" collection (${video.year}).`}
            </p>
          </section>

          {/* Technical Video & Audio Properties */}
          <section>
            <h3 className="text-[12.5px] font-semibold text-neutral-900 dark:text-neutral-100 mb-2.5">
              Video & audio properties
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {technicalSpecs.map((item) => (
                <div
                  key={item.label}
                  className="px-3.5 py-2.5 rounded-lg bg-black/[0.025] dark:bg-white/[0.035] border border-black/[0.05] dark:border-white/[0.05]"
                >
                  <div className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
                    {item.label}
                  </div>
                  <div className="text-[13px] font-medium text-neutral-900 dark:text-neutral-100 mt-0.5 font-mono-tabular break-all">
                    {item.value}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
