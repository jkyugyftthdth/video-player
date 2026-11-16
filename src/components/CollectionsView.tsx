import {
  ArrowUpDown,
  Check,
  Clapperboard,
  LayoutGrid,
  List,
  MoreHorizontal,
  Play,
  Plus,
  Shuffle,
  Square,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import {
  AccentTheme,
  CollectionSortOption,
  CollectionViewMode,
  VideoCollection,
  VideoItem,
} from '@/src/types/video';
import { ACCENT_PALETTES } from '@/src/utils/accent';
import { formatTotalDuration } from '@/src/utils/format';
import { VideoThumb } from './VideoThumb';

interface CollectionsViewProps {
  collections: VideoCollection[];
  videos: VideoItem[];
  viewMode: CollectionViewMode;
  onChangeViewMode: (mode: CollectionViewMode) => void;
  sortBy: CollectionSortOption;
  onChangeSortBy: (sort: CollectionSortOption) => void;
  onSelectCollection: (collectionId: string) => void;
  onPlayCollection: (collectionId: string, shuffle?: boolean) => void;
  onAddCollectionToQueue: (collectionId: string) => void;
  onShuffleAll: () => void;
  currentVideo: VideoItem | null;
  isPlaying: boolean;
  accent: AccentTheme;
  onOpenSettings: () => void;
}

export function CollectionsView({
  collections,
  videos,
  viewMode,
  onChangeViewMode,
  sortBy,
  onChangeSortBy,
  onSelectCollection,
  onPlayCollection,
  onAddCollectionToQueue,
  onShuffleAll,
  currentVideo,
  isPlaying,
  accent,
  onOpenSettings,
}: CollectionsViewProps) {
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

  const getCollectionStats = (collectionId: string) => {
    const items = videos.filter((v) => v.collectionId === collectionId);
    const totalSec = items.reduce((sum, v) => sum + v.duration, 0);
    return { count: items.length, totalSec };
  };

  const viewOptions: { id: CollectionViewMode; label: string; icon: typeof LayoutGrid }[] = [
    { id: 'small', label: 'Small', icon: LayoutGrid },
    { id: 'medium', label: 'Medium', icon: LayoutGrid },
    { id: 'large', label: 'Large', icon: Square },
    { id: 'list', label: 'Name list', icon: List },
  ];

  const activeViewLabel = viewOptions.find((v) => v.id === viewMode)?.label || 'Medium';

  const gridClass =
    viewMode === 'small'
      ? 'grid grid-cols-[repeat(auto-fill,minmax(175px,1fr))] gap-3.5'
      : viewMode === 'medium'
        ? 'grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-5'
        : 'grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-6';

  return (
    <div className="h-full flex flex-col">
      {/* Header & Toolbar */}
      <div className="px-6 pt-5 pb-4 border-b border-black/[0.06] dark:border-white/[0.06] flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-baseline gap-3">
          <h1 className="font-display text-[28px] font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
            Collections
          </h1>
          <span className="text-[13px] text-neutral-500 dark:text-neutral-400 tabular-nums">
            {collections.length} {collections.length === 1 ? 'collection' : 'collections'}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Sort Selector */}
          <div className="relative flex items-center">
            <ArrowUpDown
              size={13}
              className="absolute left-2.5 text-neutral-500 dark:text-neutral-400 pointer-events-none"
            />
            <select
              aria-label="Sort collections"
              value={sortBy}
              onChange={(e) => onChangeSortBy(e.target.value as CollectionSortOption)}
              className="h-9 pl-7 pr-7 text-[12.5px] font-medium rounded-md bg-white dark:bg-[#2b2b2b] text-neutral-800 dark:text-neutral-200 border border-black/[0.08] dark:border-white/[0.08] focus:outline-none cursor-pointer"
            >
              <option value="title-asc">Sort: A to Z</option>
              <option value="title-desc">Sort: Z to A</option>
              <option value="creator">Sort: Creator</option>
              <option value="year-desc">Sort: Release year (newest)</option>
              <option value="year-asc">Sort: Release year (oldest)</option>
            </select>
          </div>

          <button
            type="button"
            onClick={onShuffleAll}
            disabled={videos.length === 0}
            className={`h-9 px-4 rounded-md inline-flex items-center gap-2 text-[13px] font-medium transition-colors whitespace-nowrap shrink-0 disabled:opacity-40 ${palette.buttonBg} ${palette.buttonText}`}
          >
            <Shuffle size={14} />
            <span>Shuffle all</span>
          </button>

          {/* Three-dot View Options Menu */}
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-label={`View options (${activeViewLabel})`}
              title={`View options: ${activeViewLabel}`}
              className="h-9 px-3 rounded-md inline-flex items-center gap-2 text-[12.5px] font-medium bg-white dark:bg-[#2b2b2b] hover:bg-neutral-50 dark:hover:bg-[#343434] text-neutral-800 dark:text-neutral-200 border border-black/[0.08] dark:border-white/[0.08] transition-colors whitespace-nowrap"
            >
              <span>{activeViewLabel}</span>
              <MoreHorizontal size={16} />
            </button>

            {menuOpen && (
              <div
                role="menu"
                aria-label="Collection view options"
                className="absolute right-0 top-10 w-44 py-1.5 rounded-lg bg-white dark:bg-[#2c2c2c] border border-black/10 dark:border-white/10 shadow-xl z-40"
              >
                <div className="px-3 py-1 text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
                  View as
                </div>
                {viewOptions.map((opt) => {
                  const Icon = opt.icon;
                  const active = viewMode === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      role="menuitemradio"
                      aria-checked={active}
                      onClick={() => {
                        onChangeViewMode(opt.id);
                        setMenuOpen(false);
                      }}
                      className={`w-full px-3 py-2 flex items-center justify-between text-[13px] transition-colors ${
                        active
                          ? `bg-black/[0.06] dark:bg-white/[0.09] font-medium ${palette.activeText}`
                          : 'text-neutral-800 dark:text-neutral-200 hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'
                      }`}
                    >
                      <span className="flex items-center gap-2.5">
                        <Icon size={opt.id === 'small' ? 13 : opt.id === 'medium' ? 14 : 15} />
                        <span>{opt.label}</span>
                      </span>
                      {active && <Check size={14} />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {collections.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-center">
            <Clapperboard size={36} className="text-neutral-400 dark:text-neutral-500 mb-3" />
            <p className="text-[15px] font-medium text-neutral-800 dark:text-neutral-200">
              {videos.length === 0 ? 'No video library folders added' : 'No collections match your filter'}
            </p>
            <p className="text-[13px] text-neutral-500 dark:text-neutral-400 mt-1 max-w-md">
              {videos.length === 0
                ? 'Add a folder location in Settings to populate your collections and videos.'
                : 'Try clearing your search or checking your folder locations in Settings.'}
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
          /* NAME LIST VIEW */
          <div className="w-full">
            <div className="grid grid-cols-[minmax(220px,2fr)_minmax(140px,1.2fr)_80px_90px_90px_84px] items-center gap-3 px-3 py-2 text-[12px] font-medium text-neutral-500 dark:text-neutral-400 border-b border-black/[0.07] dark:border-white/[0.07]">
              <span>Collection name</span>
              <span>Creator</span>
              <span className="text-right">Year</span>
              <span className="text-right">Videos</span>
              <span className="text-right">Duration</span>
              <span className="sr-only">Actions</span>
            </div>
            <div className="divide-y divide-black/[0.04] dark:divide-white/[0.04]">
              {collections.map((collection) => {
                const stats = getCollectionStats(collection.id);
                const isCurrentCol = currentVideo?.collectionId === collection.id;
                return (
                  <div
                    key={collection.id}
                    onClick={() => onSelectCollection(collection.id)}
                    className={`group grid grid-cols-[minmax(220px,2fr)_minmax(140px,1.2fr)_80px_90px_90px_84px] items-center gap-3 px-3 h-12 rounded-md cursor-pointer transition-colors ${
                      isCurrentCol
                        ? 'bg-black/[0.05] dark:bg-white/[0.07]'
                        : 'hover:bg-black/[0.04] dark:hover:bg-white/[0.05]'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <VideoThumb
                        src={collection.thumbnailUrl}
                        alt={collection.title}
                        className="w-14 h-8 shrink-0"
                        iconSize={15}
                        roundedClass="rounded"
                      />
                      <span
                        className={`text-[13.5px] font-medium truncate ${
                          isCurrentCol
                            ? palette.activeText
                            : 'text-neutral-900 dark:text-neutral-100'
                        }`}
                      >
                        {collection.title}
                      </span>
                    </div>

                    <span className="text-[13px] text-neutral-600 dark:text-neutral-300 truncate">
                      {collection.creator}
                    </span>

                    <span className="text-[12.5px] text-neutral-500 dark:text-neutral-400 text-right tabular-nums">
                      {collection.year}
                    </span>

                    <span className="text-[12.5px] text-neutral-500 dark:text-neutral-400 text-right tabular-nums">
                      {stats.count} {stats.count === 1 ? 'video' : 'videos'}
                    </span>

                    <span className="text-[12.5px] text-neutral-500 dark:text-neutral-400 text-right tabular-nums">
                      {formatTotalDuration(stats.totalSec)}
                    </span>

                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        title="Play collection"
                        aria-label={`Play ${collection.title}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onPlayCollection(collection.id);
                        }}
                        className="w-8 h-8 rounded-full flex items-center justify-center bg-black/[0.07] dark:bg-white/[0.1] hover:bg-black/[0.14] dark:hover:bg-white/[0.2] text-neutral-900 dark:text-white"
                      >
                        <Play size={13} className="fill-current ml-0.5" />
                      </button>
                      <button
                        type="button"
                        title="Add collection to queue"
                        aria-label={`Add ${collection.title} to queue`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onAddCollectionToQueue(collection.id);
                        }}
                        className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-black/[0.08] dark:hover:bg-white/[0.12] text-neutral-700 dark:text-neutral-200"
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* SMALL / MEDIUM / LARGE 16:9 COLLECTION GRID */
          <div className={gridClass}>
            {collections.map((collection) => {
              const stats = getCollectionStats(collection.id);
              const isCurrentCol = currentVideo?.collectionId === collection.id;
              return (
                <div
                  key={collection.id}
                  onClick={() => onSelectCollection(collection.id)}
                  className={`group rounded-lg cursor-pointer transition-colors border ${
                    viewMode === 'small' ? 'p-2' : viewMode === 'medium' ? 'p-3' : 'p-3.5'
                  } ${
                    isCurrentCol
                      ? 'bg-black/[0.05] dark:bg-[#2c2c2c] border-black/[0.1] dark:border-white/[0.12]'
                      : 'bg-white/60 dark:bg-[#272727]/80 hover:bg-white dark:hover:bg-[#2f2f2f] border-black/[0.05] dark:border-white/[0.05]'
                  }`}
                >
                  <div className="relative aspect-video w-full overflow-hidden rounded-md mb-2.5 bg-neutral-200 dark:bg-[#1f1f1f]">
                    <VideoThumb
                      src={collection.thumbnailUrl}
                      alt={collection.title}
                      className="w-full h-full transition-transform duration-300 group-hover:scale-[1.03]"
                      iconSize={viewMode === 'small' ? 22 : 34}
                      roundedClass="rounded-md"
                    />

                    <div
                      className={`absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent transition-opacity duration-200 flex items-end justify-between p-2.5 ${
                        isCurrentCol && isPlaying
                          ? 'opacity-100'
                          : 'opacity-0 group-hover:opacity-100'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onPlayCollection(collection.id);
                        }}
                        aria-label={`Play ${collection.title}`}
                        className={`${
                          viewMode === 'small' ? 'w-8 h-8' : 'w-10 h-10'
                        } rounded-full flex items-center justify-center shadow-md transition-transform hover:scale-105 ${palette.buttonBg} ${palette.buttonText}`}
                      >
                        <Play
                          size={viewMode === 'small' ? 14 : 16}
                          className="fill-current ml-0.5"
                        />
                      </button>

                      {viewMode !== 'small' && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onAddCollectionToQueue(collection.id);
                          }}
                          title="Add to play queue"
                          aria-label={`Add ${collection.title} to queue`}
                          className="w-8 h-8 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center backdrop-blur-xs transition-colors"
                        >
                          <Plus size={15} />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="min-w-0">
                    <h2
                      className={`font-medium truncate ${
                        viewMode === 'small'
                          ? 'text-[12.5px]'
                          : viewMode === 'medium'
                            ? 'text-[14px]'
                            : 'text-[15.5px]'
                      } ${
                        isCurrentCol
                          ? palette.activeText
                          : 'text-neutral-900 dark:text-neutral-100'
                      }`}
                    >
                      {collection.title}
                    </h2>
                    <p
                      className={`truncate text-neutral-600 dark:text-neutral-400 mt-0.5 ${
                        viewMode === 'small' ? 'text-[11.5px]' : 'text-[12.5px]'
                      }`}
                    >
                      {collection.creator}
                    </p>
                    {viewMode === 'large' && (
                      <p className="text-[12px] text-neutral-500 dark:text-neutral-400 mt-1 tabular-nums truncate">
                        {collection.year} · {stats.count} {stats.count === 1 ? 'video' : 'videos'} ·{' '}
                        {formatTotalDuration(stats.totalSec)}
                      </p>
                    )}
                    {viewMode === 'medium' && (
                      <p className="text-[11.5px] text-neutral-500 dark:text-neutral-400 mt-0.5 tabular-nums truncate">
                        {collection.year} · {stats.count} {stats.count === 1 ? 'video' : 'videos'}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
