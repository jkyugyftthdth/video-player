import {
  ArrowDown,
  ArrowUp,
  Film,
  Heart,
  Info,
  ListPlus,
  Pause,
  Play,
  Plus,
  Settings,
  Shuffle,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  AccentTheme,
  SortDirection,
  VideoItem,
  VideoPlaylist,
  VideoSortColumn,
} from '@/src/types/video';
import { ACCENT_PALETTES } from '@/src/utils/accent';
import { formatDuration, formatTotalDuration } from '@/src/utils/format';
import { VideoThumb } from './VideoThumb';

interface VideosViewProps {
  videos: VideoItem[];
  currentVideo: VideoItem | null;
  isPlaying: boolean;
  favorites: Set<string>;
  playlists: VideoPlaylist[];
  accent: AccentTheme;
  onPlayVideo: (video: VideoItem, contextVideos: VideoItem[]) => void;
  onTogglePlayPause: () => void;
  onPlayAll: (videos: VideoItem[], shuffle?: boolean) => void;
  onAddVideoToQueue: (video: VideoItem) => void;
  onToggleFavorite: (videoId: string) => void;
  onAddVideoToPlaylist: (playlistId: string, videoId: string) => void;
  onOpenDetails: (video: VideoItem) => void;
  onSelectCollection: (collectionId: string) => void;
  onSelectCreator: (creatorId: string) => void;
  onOpenSettings: () => void;
}

export function VideosView({
  videos,
  currentVideo,
  isPlaying,
  favorites,
  playlists,
  accent,
  onPlayVideo,
  onTogglePlayPause,
  onPlayAll,
  onAddVideoToQueue,
  onToggleFavorite,
  onAddVideoToPlaylist,
  onOpenDetails,
  onSelectCollection,
  onSelectCreator,
  onOpenSettings,
}: VideosViewProps) {
  const [sortCol, setSortCol] = useState<VideoSortColumn>('title');
  const [sortDir, setSortDir] = useState<SortDirection>('asc');
  const [playlistMenuVideoId, setPlaylistMenuVideoId] = useState<string | null>(null);
  const [favoritesOnly, setFavoritesOnly] = useState(false);

  const palette = ACCENT_PALETTES[accent];

  const filteredAndSorted = useMemo(() => {
    let list = videos;
    if (favoritesOnly) {
      list = list.filter((v) => favorites.has(v.id));
    }

    const sorted = [...list].sort((a, b) => {
      let cmp = 0;
      switch (sortCol) {
        case 'title':
          cmp = a.title.localeCompare(b.title);
          break;
        case 'creator':
          cmp = a.creator.localeCompare(b.creator) || a.title.localeCompare(b.title);
          break;
        case 'collection':
          cmp = a.collection.localeCompare(b.collection) || a.episodeNumber - b.episodeNumber;
          break;
        case 'duration':
          cmp = a.duration - b.duration;
          break;
        default:
          cmp = a.episodeNumber - b.episodeNumber;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return sorted;
  }, [videos, favoritesOnly, favorites, sortCol, sortDir]);

  const totalSec = filteredAndSorted.reduce((s, v) => s + v.duration, 0);

  const toggleSort = (col: VideoSortColumn) => {
    if (sortCol === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortCol(col);
      setSortDir('asc');
    }
  };

  const renderSortIcon = (col: VideoSortColumn) => {
    if (sortCol !== col) return null;
    return sortDir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />;
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header & Toolbar */}
      <div className="px-6 pt-5 pb-4 border-b border-black/[0.06] dark:border-white/[0.06] flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-baseline gap-3">
          <h1 className="font-display text-[28px] font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
            Videos
          </h1>
          <span className="text-[13px] text-neutral-500 dark:text-neutral-400 tabular-nums">
            {filteredAndSorted.length} {filteredAndSorted.length === 1 ? 'video' : 'videos'} ·{' '}
            {formatTotalDuration(totalSec)}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setFavoritesOnly((v) => !v)}
            aria-pressed={favoritesOnly}
            className={`h-9 px-3 rounded-md inline-flex items-center gap-1.5 text-[12.5px] font-medium border transition-colors whitespace-nowrap ${
              favoritesOnly
                ? `bg-black/[0.07] dark:bg-white/[0.12] border-black/15 dark:border-white/20 ${palette.activeText}`
                : 'bg-white dark:bg-[#2b2b2b] border-black/[0.08] dark:border-white/[0.08] text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-[#333]'
            }`}
          >
            <Heart size={13} className={favoritesOnly ? 'fill-current' : ''} />
            <span>Favorites</span>
          </button>

          <button
            type="button"
            onClick={onOpenSettings}
            className="h-9 px-3.5 rounded-md inline-flex items-center gap-2 text-[12.5px] font-medium bg-white dark:bg-[#2b2b2b] hover:bg-neutral-50 dark:hover:bg-[#343434] text-neutral-800 dark:text-neutral-200 border border-black/[0.08] dark:border-white/[0.08] transition-colors whitespace-nowrap"
          >
            <Settings size={14} />
            <span>Folder locations</span>
          </button>

          <button
            type="button"
            onClick={() => onPlayAll(filteredAndSorted, true)}
            disabled={filteredAndSorted.length === 0}
            className={`h-9 px-4 rounded-md inline-flex items-center gap-2 text-[13px] font-medium transition-colors whitespace-nowrap disabled:opacity-40 ${palette.buttonBg} ${palette.buttonText}`}
          >
            <Shuffle size={14} />
            <span>Shuffle & play</span>
          </button>
        </div>
      </div>

      {/* Videos Table (no inline genre or bitrate columns) */}
      <div className="flex-1 overflow-y-auto px-6 py-3">
        {filteredAndSorted.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-center">
            <Film size={36} className="text-neutral-400 dark:text-neutral-500 mb-3" />
            <p className="text-[15px] font-medium text-neutral-800 dark:text-neutral-200">
              {videos.length === 0 ? 'No video library folders added' : 'No videos found'}
            </p>
            <p className="text-[13px] text-neutral-500 dark:text-neutral-400 mt-1 max-w-md">
              {videos.length === 0
                ? 'Videos are added to your library only when you add a folder location in Settings.'
                : 'Adjust your search or favorites filter.'}
            </p>
            {videos.length === 0 && (
              <button
                type="button"
                onClick={onOpenSettings}
                className={`mt-4 h-9 px-4 rounded-md inline-flex items-center gap-2 text-[13px] font-medium transition-colors ${palette.buttonBg} ${palette.buttonText}`}
              >
                <Settings size={14} />
                <span>Open Settings to add folder</span>
              </button>
            )}
          </div>
        ) : (
          <div className="w-full min-w-[680px]">
            <div className="grid grid-cols-[40px_minmax(220px,2.2fr)_minmax(140px,1.2fr)_minmax(140px,1.2fr)_76px_138px] items-center gap-3 px-3 py-2 text-[12px] font-medium text-neutral-500 dark:text-neutral-400 border-b border-black/[0.07] dark:border-white/[0.07] select-none">
              <span className="text-center">#</span>

              <button
                type="button"
                onClick={() => toggleSort('title')}
                className="flex items-center gap-1.5 text-left hover:text-neutral-900 dark:hover:text-white transition-colors"
              >
                <span>Title</span>
                {renderSortIcon('title')}
              </button>

              <button
                type="button"
                onClick={() => toggleSort('creator')}
                className="flex items-center gap-1.5 text-left hover:text-neutral-900 dark:hover:text-white transition-colors"
              >
                <span>Creator</span>
                {renderSortIcon('creator')}
              </button>

              <button
                type="button"
                onClick={() => toggleSort('collection')}
                className="flex items-center gap-1.5 text-left hover:text-neutral-900 dark:hover:text-white transition-colors"
              >
                <span>Collection</span>
                {renderSortIcon('collection')}
              </button>

              <button
                type="button"
                onClick={() => toggleSort('duration')}
                className="flex items-center justify-end gap-1.5 hover:text-neutral-900 dark:hover:text-white transition-colors"
              >
                {renderSortIcon('duration')}
                <span>Length</span>
              </button>

              <span className="sr-only">Actions</span>
            </div>

            <div className="divide-y divide-black/[0.04] dark:divide-white/[0.04]">
              {filteredAndSorted.map((video, idx) => {
                const isCurrent = currentVideo?.id === video.id;
                const isFav = favorites.has(video.id);
                return (
                  <div
                    key={video.id}
                    onClick={() => {
                      if (isCurrent) {
                        onTogglePlayPause();
                      } else {
                        onPlayVideo(video, filteredAndSorted);
                      }
                    }}
                    className={`group grid grid-cols-[40px_minmax(220px,2.2fr)_minmax(140px,1.2fr)_minmax(140px,1.2fr)_76px_138px] items-center gap-3 px-3 h-13 rounded-md cursor-pointer transition-colors relative ${
                      isCurrent
                        ? 'bg-black/[0.06] dark:bg-white/[0.08]'
                        : 'hover:bg-black/[0.04] dark:hover:bg-white/[0.05]'
                    }`}
                  >
                    <div className="flex items-center justify-center">
                      <span
                        className={`text-[12.5px] tabular-nums group-hover:hidden ${
                          isCurrent
                            ? palette.activeText
                            : 'text-neutral-500 dark:text-neutral-400'
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
                          isCurrent
                            ? palette.activeText
                            : 'text-neutral-900 dark:text-neutral-100'
                        }`}
                      >
                        {video.title}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectCreator(video.creatorId);
                      }}
                      className="text-left text-[13px] text-neutral-600 dark:text-neutral-300 hover:underline truncate"
                    >
                      {video.creator}
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectCollection(video.collectionId);
                      }}
                      className="text-left text-[13px] text-neutral-600 dark:text-neutral-300 hover:underline truncate"
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
                        className="w-8 h-8 rounded-md opacity-0 group-hover:opacity-100 flex items-center justify-center text-neutral-500 dark:text-neutral-400 hover:bg-black/[0.06] dark:hover:bg-white/[0.08] transition-colors"
                      >
                        <Info size={14} />
                      </button>

                      <button
                        type="button"
                        onClick={() => onToggleFavorite(video.id)}
                        aria-label={isFav ? 'Remove from favorites' : 'Add to favorites'}
                        className={`w-8 h-8 rounded-md flex items-center justify-center transition-colors ${
                          isFav
                            ? palette.activeText
                            : 'opacity-0 group-hover:opacity-100 text-neutral-500 dark:text-neutral-400 hover:bg-black/[0.06] dark:hover:bg-white/[0.08]'
                        }`}
                      >
                        <Heart size={14} className={isFav ? 'fill-current' : ''} />
                      </button>

                      <button
                        type="button"
                        onClick={() => onAddVideoToQueue(video)}
                        title="Add to queue"
                        aria-label={`Add ${video.title} to queue`}
                        className="w-8 h-8 rounded-md opacity-0 group-hover:opacity-100 flex items-center justify-center text-neutral-500 dark:text-neutral-400 hover:bg-black/[0.06] dark:hover:bg-white/[0.08] transition-colors"
                      >
                        <Plus size={14} />
                      </button>

                      <div className="relative">
                        <button
                          type="button"
                          onClick={() =>
                            setPlaylistMenuVideoId(
                              playlistMenuVideoId === video.id ? null : video.id
                            )
                          }
                          title="Add to playlist"
                          aria-label={`Add ${video.title} to playlist`}
                          className="w-8 h-8 rounded-md opacity-0 group-hover:opacity-100 flex items-center justify-center text-neutral-500 dark:text-neutral-400 hover:bg-black/[0.06] dark:hover:bg-white/[0.08] transition-colors"
                        >
                          <ListPlus size={14} />
                        </button>

                        {playlistMenuVideoId === video.id && (
                          <div className="absolute right-0 top-9 w-48 py-1 rounded-md bg-white dark:bg-[#2c2c2c] border border-black/10 dark:border-white/10 shadow-xl z-30">
                            <div className="px-3 py-1 text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
                              Add to playlist
                            </div>
                            {playlists.map((pl) => (
                              <button
                                key={pl.id}
                                type="button"
                                onClick={() => {
                                  onAddVideoToPlaylist(pl.id, video.id);
                                  setPlaylistMenuVideoId(null);
                                }}
                                className="w-full px-3 py-1.5 text-left text-[12.5px] text-neutral-800 dark:text-neutral-200 hover:bg-black/[0.05] dark:hover:bg-white/[0.08] truncate"
                              >
                                {pl.name}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
