import {
  ArrowLeft,
  Check,
  Info,
  LayoutGrid,
  List,
  MoreHorizontal,
  Pause,
  Play,
  Plus,
  Shuffle,
  Users,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import {
  AccentTheme,
  Creator,
  CreatorViewMode,
  VideoCollection,
  VideoItem,
} from '@/src/types/video';
import { ACCENT_PALETTES } from '@/src/utils/accent';
import { formatDuration, formatTotalDuration } from '@/src/utils/format';
import { VideoThumb } from './VideoThumb';

interface CreatorsViewProps {
  creators: Creator[];
  collections: VideoCollection[];
  videos: VideoItem[];
  selectedCreatorId: string | null;
  viewMode: CreatorViewMode;
  onChangeViewMode: (mode: CreatorViewMode) => void;
  onSelectCreator: (creatorId: string | null) => void;
  onSelectCollection: (collectionId: string) => void;
  onPlayVideo: (video: VideoItem, contextVideos: VideoItem[]) => void;
  onTogglePlayPause: () => void;
  onPlayCreator: (creatorId: string, shuffle?: boolean) => void;
  onAddVideoToQueue: (video: VideoItem) => void;
  onOpenDetails: (video: VideoItem) => void;
  currentVideo: VideoItem | null;
  isPlaying: boolean;
  accent: AccentTheme;
  onOpenSettings: () => void;
}

export function CreatorsView({
  creators,
  collections,
  videos,
  selectedCreatorId,
  viewMode,
  onChangeViewMode,
  onSelectCreator,
  onSelectCollection,
  onPlayVideo,
  onTogglePlayPause,
  onPlayCreator,
  onAddVideoToQueue,
  onOpenDetails,
  currentVideo,
  isPlaying,
  accent,
  onOpenSettings,
}: CreatorsViewProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const palette = ACCENT_PALETTES[accent];

  useEffect(() => {
    if (!menuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  const selectedCreator = selectedCreatorId
    ? creators.find((c) => c.id === selectedCreatorId) || null
    : null;

  if (selectedCreator) {
    const creatorCollections = collections.filter((col) => col.creatorId === selectedCreator.id);
    const creatorVideos = videos.filter((v) => v.creatorId === selectedCreator.id);
    const totalSec = creatorVideos.reduce((sum, v) => sum + v.duration, 0);

    return (
      <div className="h-full overflow-y-auto">
        <div className="px-6 pt-5 pb-7 border-b border-black/[0.06] dark:border-white/[0.06] bg-gradient-to-b from-black/[0.03] dark:from-white/[0.03] to-transparent">
          <button
            type="button"
            onClick={() => onSelectCreator(null)}
            className="inline-flex items-center gap-2 px-2.5 py-1.5 -ml-2.5 mb-4 rounded-md text-[13px] font-medium text-neutral-700 dark:text-neutral-300 hover:bg-black/[0.05] dark:hover:bg-white/[0.07] transition-colors"
          >
            <ArrowLeft size={15} />
            <span>Creators</span>
          </button>

          <div className="flex flex-col sm:flex-row sm:items-center gap-6">
            <div className="w-36 h-36 sm:w-44 sm:h-44 shrink-0 rounded-full overflow-hidden shadow-lg border border-black/10 dark:border-white/10">
              <VideoThumb
                src={selectedCreator.thumbnailUrl}
                alt={selectedCreator.name}
                className="w-full h-full"
                iconSize={44}
                roundedClass="rounded-full"
              />
            </div>

            <div className="min-w-0 flex-1">
              <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight text-neutral-950 dark:text-white">
                {selectedCreator.name}
              </h1>
              <p className="text-[13.5px] text-neutral-600 dark:text-neutral-400 mt-1.5 max-w-2xl">
                {selectedCreator.bio}
              </p>
              <div className="flex flex-wrap items-center gap-2 mt-2.5 text-[13px] text-neutral-500 dark:text-neutral-400 tabular-nums">
                <span>
                  {creatorCollections.length}{' '}
                  {creatorCollections.length === 1 ? 'collection' : 'collections'}
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  {creatorVideos.length} {creatorVideos.length === 1 ? 'video' : 'videos'}
                </span>
                <span aria-hidden="true">·</span>
                <span>{formatTotalDuration(totalSec)}</span>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 mt-5">
                <button
                  type="button"
                  onClick={() => onPlayCreator(selectedCreator.id, false)}
                  disabled={creatorVideos.length === 0}
                  className={`h-9 px-5 rounded-md inline-flex items-center gap-2 text-[13px] font-medium transition-colors ${palette.buttonBg} ${palette.buttonText}`}
                >
                  <Play size={14} className="fill-current" />
                  <span>Play all</span>
                </button>
                <button
                  type="button"
                  onClick={() => onPlayCreator(selectedCreator.id, true)}
                  disabled={creatorVideos.length === 0}
                  className="h-9 px-4 rounded-md inline-flex items-center gap-2 text-[13px] font-medium bg-white dark:bg-[#2d2d2d] hover:bg-neutral-50 dark:hover:bg-[#353535] text-neutral-800 dark:text-neutral-100 border border-black/[0.08] dark:border-white/[0.08] transition-colors"
                >
                  <Shuffle size={14} />
                  <span>Shuffle</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Collections by Creator */}
        <div className="px-6 py-5">
          <h2 className="font-display text-[17px] font-semibold text-neutral-900 dark:text-neutral-100 mb-3.5">
            Collections
          </h2>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4">
            {creatorCollections.map((col) => (
              <div
                key={col.id}
                onClick={() => onSelectCollection(col.id)}
                className="group p-3 rounded-lg bg-white/60 dark:bg-[#272727]/80 hover:bg-white dark:hover:bg-[#2f2f2f] border border-black/[0.05] dark:border-white/[0.05] cursor-pointer transition-colors"
              >
                <div className="aspect-video w-full rounded-md overflow-hidden mb-2.5">
                  <VideoThumb
                    src={col.thumbnailUrl}
                    alt={col.title}
                    className="w-full h-full group-hover:scale-[1.03] transition-transform duration-300"
                    roundedClass="rounded-md"
                  />
                </div>
                <div className="text-[13.5px] font-medium text-neutral-900 dark:text-neutral-100 truncate">
                  {col.title}
                </div>
                <div className="text-[12px] text-neutral-500 dark:text-neutral-400 tabular-nums mt-0.5">
                  {col.year}
                </div>
              </div>
            ))}
          </div>

          {/* All Videos by Creator */}
          <h2 className="font-display text-[17px] font-semibold text-neutral-900 dark:text-neutral-100 mt-8 mb-3">
            Videos
          </h2>
          <div className="divide-y divide-black/[0.04] dark:divide-white/[0.04]">
            {creatorVideos.map((video, idx) => {
              const isCurrent = currentVideo?.id === video.id;
              return (
                <div
                  key={video.id}
                  onClick={() => {
                    if (isCurrent) {
                      onTogglePlayPause();
                    } else {
                      onPlayVideo(video, creatorVideos);
                    }
                  }}
                  className={`group grid grid-cols-[36px_1fr_minmax(120px,1fr)_72px_76px] items-center gap-3 px-3 h-13 rounded-md cursor-pointer transition-colors ${
                    isCurrent
                      ? 'bg-black/[0.06] dark:bg-white/[0.08]'
                      : 'hover:bg-black/[0.04] dark:hover:bg-white/[0.05]'
                  }`}
                >
                  <div className="flex items-center justify-center">
                    <span
                      className={`text-[12.5px] tabular-nums group-hover:hidden ${
                        isCurrent ? palette.activeText : 'text-neutral-500 dark:text-neutral-400'
                      }`}
                    >
                      {isCurrent && isPlaying ? '▶' : idx + 1}
                    </span>
                    <span className="hidden group-hover:flex items-center justify-center text-neutral-900 dark:text-white">
                      {isCurrent && isPlaying ? (
                        <Pause size={14} className="fill-current" />
                      ) : (
                        <Play size={14} className="fill-current ml-0.5" />
                      )}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 min-w-0">
                    <VideoThumb
                      src={video.thumbnailUrl}
                      alt={video.title}
                      className="w-14 h-8 shrink-0"
                      iconSize={14}
                      roundedClass="rounded"
                    />
                    <span
                      className={`text-[13.5px] font-medium truncate ${
                        isCurrent ? palette.activeText : 'text-neutral-900 dark:text-neutral-100'
                      }`}
                    >
                      {video.title}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectCollection(video.collectionId);
                    }}
                    className="text-left text-[13px] text-neutral-500 dark:text-neutral-400 hover:underline truncate"
                  >
                    {video.collection}
                  </button>

                  <span className="text-[12.5px] font-mono-tabular text-neutral-500 dark:text-neutral-400 text-right">
                    {formatDuration(video.duration)}
                  </span>

                  <div
                    className="flex items-center justify-end gap-0.5"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      onClick={() => onOpenDetails(video)}
                      title="Video properties & bitrate"
                      aria-label={`View details for ${video.title}`}
                      className="w-8 h-8 rounded-md opacity-0 group-hover:opacity-100 flex items-center justify-center text-neutral-500 dark:text-neutral-400 hover:bg-black/[0.06] dark:hover:bg-white/[0.08]"
                    >
                      <Info size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => onAddVideoToQueue(video)}
                      title="Add to queue"
                      className="w-8 h-8 rounded-md opacity-0 group-hover:opacity-100 flex items-center justify-center text-neutral-500 dark:text-neutral-400 hover:bg-black/[0.06] dark:hover:bg-white/[0.08]"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="px-6 pt-5 pb-4 border-b border-black/[0.06] dark:border-white/[0.06] flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-baseline gap-3">
          <h1 className="font-display text-[28px] font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
            Creators
          </h1>
          <span className="text-[13px] text-neutral-500 dark:text-neutral-400 tabular-nums">
            {creators.length} {creators.length === 1 ? 'creator' : 'creators'}
          </span>
        </div>

        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label={`Creator view options (${viewMode === 'grid' ? 'Grid' : 'Name list'})`}
            className="h-9 px-3 rounded-md inline-flex items-center gap-2 text-[12.5px] font-medium bg-white dark:bg-[#2b2b2b] hover:bg-neutral-50 dark:hover:bg-[#343434] text-neutral-800 dark:text-neutral-200 border border-black/[0.08] dark:border-white/[0.08] transition-colors"
          >
            <span>{viewMode === 'grid' ? 'Grid' : 'Name list'}</span>
            <MoreHorizontal size={16} />
          </button>

          {menuOpen && (
            <div
              role="menu"
              aria-label="Creator view options"
              className="absolute right-0 top-10 w-40 py-1.5 rounded-lg bg-white dark:bg-[#2c2c2c] border border-black/10 dark:border-white/10 shadow-xl z-40"
            >
              <div className="px-3 py-1 text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
                View as
              </div>
              <button
                type="button"
                role="menuitemradio"
                aria-checked={viewMode === 'grid'}
                onClick={() => {
                  onChangeViewMode('grid');
                  setMenuOpen(false);
                }}
                className={`w-full px-3 py-2 flex items-center justify-between text-[13px] transition-colors ${
                  viewMode === 'grid'
                    ? `bg-black/[0.06] dark:bg-white/[0.09] font-medium ${palette.activeText}`
                    : 'text-neutral-800 dark:text-neutral-200 hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <LayoutGrid size={14} />
                  <span>Grid</span>
                </span>
                {viewMode === 'grid' && <Check size={14} />}
              </button>
              <button
                type="button"
                role="menuitemradio"
                aria-checked={viewMode === 'list'}
                onClick={() => {
                  onChangeViewMode('list');
                  setMenuOpen(false);
                }}
                className={`w-full px-3 py-2 flex items-center justify-between text-[13px] transition-colors ${
                  viewMode === 'list'
                    ? `bg-black/[0.06] dark:bg-white/[0.09] font-medium ${palette.activeText}`
                    : 'text-neutral-800 dark:text-neutral-200 hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <List size={14} />
                  <span>Name list</span>
                </span>
                {viewMode === 'list' && <Check size={14} />}
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5">
        {creators.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-center">
            <Users size={36} className="text-neutral-400 dark:text-neutral-500 mb-3" />
            <p className="text-[15px] font-medium text-neutral-800 dark:text-neutral-200">
              {videos.length === 0 ? 'No video library folders added' : 'No creators found'}
            </p>
            <p className="text-[13px] text-neutral-500 dark:text-neutral-400 mt-1 max-w-md">
              {videos.length === 0
                ? 'Add a folder location in Settings to populate creators and collections.'
                : 'Try clearing your search filter.'}
            </p>
            {videos.length === 0 && (
              <button
                type="button"
                onClick={onOpenSettings}
                className={`mt-4 h-9 px-4 rounded-md inline-flex items-center gap-2 text-[13px] font-medium transition-colors ${palette.buttonBg} ${palette.buttonText}`}
              >
                <span>Open Settings to add folder</span>
              </button>
            )}
          </div>
        ) : viewMode === 'list' ? (
          <div className="divide-y divide-black/[0.04] dark:divide-white/[0.04]">
            {creators.map((creator) => {
              const creatorCols = collections.filter((col) => col.creatorId === creator.id);
              const creatorVids = videos.filter((v) => v.creatorId === creator.id);
              const isCurrent = currentVideo?.creatorId === creator.id;
              return (
                <div
                  key={creator.id}
                  onClick={() => onSelectCreator(creator.id)}
                  className="group grid grid-cols-[minmax(220px,1.8fr)_120px_110px_48px] items-center gap-3 px-3 h-13 rounded-md hover:bg-black/[0.04] dark:hover:bg-white/[0.05] cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <VideoThumb
                      src={creator.thumbnailUrl}
                      alt={creator.name}
                      className="w-9 h-9 shrink-0"
                      iconSize={16}
                      roundedClass="rounded-full"
                    />
                    <span
                      className={`text-[14px] font-medium truncate ${
                        isCurrent ? palette.activeText : 'text-neutral-900 dark:text-neutral-100'
                      }`}
                    >
                      {creator.name}
                    </span>
                  </div>
                  <span className="text-[12.5px] text-neutral-500 dark:text-neutral-400 tabular-nums text-right">
                    {creatorCols.length} {creatorCols.length === 1 ? 'collection' : 'collections'}
                  </span>
                  <span className="text-[12.5px] text-neutral-500 dark:text-neutral-400 tabular-nums text-right">
                    {creatorVids.length} {creatorVids.length === 1 ? 'video' : 'videos'}
                  </span>
                  <div className="flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onPlayCreator(creator.id);
                      }}
                      aria-label={`Play ${creator.name}`}
                      className="w-8 h-8 rounded-full flex items-center justify-center bg-black/[0.07] dark:bg-white/[0.12] text-neutral-900 dark:text-white"
                    >
                      <Play size={13} className="fill-current ml-0.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(204px,1fr))] gap-5">
            {creators.map((creator) => {
              const creatorCols = collections.filter((col) => col.creatorId === creator.id);
              const creatorVids = videos.filter((v) => v.creatorId === creator.id);
              const isCurrent = currentVideo?.creatorId === creator.id;
              return (
                <div
                  key={creator.id}
                  onClick={() => onSelectCreator(creator.id)}
                  className="group p-4 rounded-lg bg-white/60 dark:bg-[#272727]/80 hover:bg-white dark:hover:bg-[#2f2f2f] border border-black/[0.05] dark:border-white/[0.05] cursor-pointer transition-colors flex flex-col items-center text-center"
                >
                  <div className="relative w-32 h-32 rounded-full overflow-hidden mb-3 shadow-sm">
                    <VideoThumb
                      src={creator.thumbnailUrl}
                      alt={creator.name}
                      className="w-full h-full transition-transform duration-300 group-hover:scale-105"
                      iconSize={34}
                      roundedClass="rounded-full"
                    />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onPlayCreator(creator.id);
                      }}
                      aria-label={`Play ${creator.name}`}
                      className={`absolute bottom-1.5 right-1.5 w-9 h-9 rounded-full flex items-center justify-center shadow-md opacity-0 group-hover:opacity-100 transition-opacity ${palette.buttonBg} ${palette.buttonText}`}
                    >
                      <Play size={15} className="fill-current ml-0.5" />
                    </button>
                  </div>
                  <h2
                    className={`text-[14.5px] font-medium truncate w-full ${
                      isCurrent ? palette.activeText : 'text-neutral-900 dark:text-neutral-100'
                    }`}
                  >
                    {creator.name}
                  </h2>
                  <p className="text-[12px] text-neutral-500 dark:text-neutral-400 mt-0.5 tabular-nums">
                    {creatorCols.length} {creatorCols.length === 1 ? 'collection' : 'collections'} ·{' '}
                    {creatorVids.length} {creatorVids.length === 1 ? 'video' : 'videos'}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
