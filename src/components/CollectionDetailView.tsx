import {
  ArrowLeft,
  Heart,
  Info,
  ListPlus,
  Pause,
  Play,
  Plus,
  Shuffle,
} from 'lucide-react';
import { useState } from 'react';
import { AccentTheme, VideoCollection, VideoItem, VideoPlaylist } from '@/src/types/video';
import { ACCENT_PALETTES } from '@/src/utils/accent';
import { formatDuration, formatTotalDuration } from '@/src/utils/format';
import { VideoThumb } from './VideoThumb';

interface CollectionDetailViewProps {
  collection: VideoCollection;
  videos: VideoItem[];
  currentVideo: VideoItem | null;
  isPlaying: boolean;
  favorites: Set<string>;
  playlists: VideoPlaylist[];
  accent: AccentTheme;
  onBack: () => void;
  onSelectCreator: (creatorId: string) => void;
  onPlayVideo: (video: VideoItem, contextVideos: VideoItem[]) => void;
  onTogglePlayPause: () => void;
  onPlayCollection: (collectionId: string, shuffle?: boolean) => void;
  onAddCollectionToQueue: (collectionId: string) => void;
  onAddVideoToQueue: (video: VideoItem) => void;
  onToggleFavorite: (videoId: string) => void;
  onAddVideoToPlaylist: (playlistId: string, videoId: string) => void;
  onOpenDetails: (video: VideoItem) => void;
}

export function CollectionDetailView({
  collection,
  videos,
  currentVideo,
  isPlaying,
  favorites,
  playlists,
  accent,
  onBack,
  onSelectCreator,
  onPlayVideo,
  onTogglePlayPause,
  onPlayCollection,
  onAddCollectionToQueue,
  onAddVideoToQueue,
  onToggleFavorite,
  onAddVideoToPlaylist,
  onOpenDetails,
}: CollectionDetailViewProps) {
  const [playlistMenuVideoId, setPlaylistMenuVideoId] = useState<string | null>(null);
  const palette = ACCENT_PALETTES[accent];

  const sortedVideos = [...videos].sort((a, b) => a.episodeNumber - b.episodeNumber);
  const totalSec = sortedVideos.reduce((s, v) => s + v.duration, 0);

  return (
    <div className="h-full overflow-y-auto">
      {/* Collection Hero Header */}
      <div className="px-6 pt-5 pb-7 border-b border-black/[0.06] dark:border-white/[0.06] bg-gradient-to-b from-black/[0.03] dark:from-white/[0.03] to-transparent">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 px-2.5 py-1.5 -ml-2.5 mb-4 rounded-md text-[13px] font-medium text-neutral-700 dark:text-neutral-300 hover:bg-black/[0.05] dark:hover:bg-white/[0.07] transition-colors"
        >
          <ArrowLeft size={15} />
          <span>Collections</span>
        </button>

        <div className="flex flex-col md:flex-row md:items-end gap-6">
          <div className="w-64 sm:w-80 aspect-video shrink-0 shadow-xl rounded-lg overflow-hidden border border-black/10 dark:border-white/10">
            <VideoThumb
              src={collection.thumbnailUrl}
              alt={collection.title}
              className="w-full h-full"
              iconSize={48}
              roundedClass="rounded-lg"
            />
          </div>

          <div className="min-w-0 flex-1">
            <div className="text-[12px] font-medium text-neutral-500 dark:text-neutral-400">
              Video collection
            </div>
            <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight text-neutral-950 dark:text-white mt-1">
              {collection.title}
            </h1>
            <p className="text-[13.5px] text-neutral-600 dark:text-neutral-400 mt-1.5 max-w-2xl">
              {collection.description}
            </p>
            <div className="flex flex-wrap items-center gap-2 mt-2.5 text-[13.5px] text-neutral-600 dark:text-neutral-300 tabular-nums">
              <button
                type="button"
                onClick={() => onSelectCreator(collection.creatorId)}
                className={`font-medium hover:underline ${palette.activeText}`}
              >
                {collection.creator}
              </button>
              <span aria-hidden="true">·</span>
              <span>{collection.year}</span>
              <span aria-hidden="true">·</span>
              <span>
                {sortedVideos.length} {sortedVideos.length === 1 ? 'video' : 'videos'}
              </span>
              <span aria-hidden="true">·</span>
              <span>{formatTotalDuration(totalSec)}</span>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 mt-5">
              <button
                type="button"
                onClick={() => onPlayCollection(collection.id, false)}
                disabled={sortedVideos.length === 0}
                className={`h-9 px-5 rounded-md inline-flex items-center gap-2 text-[13px] font-medium transition-colors ${palette.buttonBg} ${palette.buttonText}`}
              >
                <Play size={14} className="fill-current" />
                <span>Play all</span>
              </button>

              <button
                type="button"
                onClick={() => onPlayCollection(collection.id, true)}
                disabled={sortedVideos.length === 0}
                className="h-9 px-4 rounded-md inline-flex items-center gap-2 text-[13px] font-medium bg-white dark:bg-[#2d2d2d] hover:bg-neutral-50 dark:hover:bg-[#353535] text-neutral-800 dark:text-neutral-100 border border-black/[0.08] dark:border-white/[0.08] transition-colors"
              >
                <Shuffle size={14} />
                <span>Shuffle</span>
              </button>

              <button
                type="button"
                onClick={() => onAddCollectionToQueue(collection.id)}
                disabled={sortedVideos.length === 0}
                className="h-9 px-4 rounded-md inline-flex items-center gap-2 text-[13px] font-medium bg-white dark:bg-[#2d2d2d] hover:bg-neutral-50 dark:hover:bg-[#353535] text-neutral-800 dark:text-neutral-100 border border-black/[0.08] dark:border-white/[0.08] transition-colors"
              >
                <Plus size={15} />
                <span>Add to queue</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Video Episode List */}
      <div className="px-6 py-4">
        <div className="grid grid-cols-[40px_1fr_76px_138px] items-center gap-3 px-3 py-2 text-[12px] font-medium text-neutral-500 dark:text-neutral-400 border-b border-black/[0.06] dark:border-white/[0.06]">
          <span className="text-center">#</span>
          <span>Title</span>
          <span className="text-right">Length</span>
          <span className="sr-only">Actions</span>
        </div>

        <div className="divide-y divide-black/[0.04] dark:divide-white/[0.04]">
          {sortedVideos.map((video) => {
            const isCurrent = currentVideo?.id === video.id;
            const isFav = favorites.has(video.id);
            return (
              <div
                key={video.id}
                onClick={() => {
                  if (isCurrent) {
                    onTogglePlayPause();
                  } else {
                    onPlayVideo(video, sortedVideos);
                  }
                }}
                className={`group grid grid-cols-[40px_1fr_76px_138px] items-center gap-3 px-3 h-14 rounded-md cursor-pointer transition-colors relative ${
                  isCurrent
                    ? 'bg-black/[0.06] dark:bg-white/[0.08]'
                    : 'hover:bg-black/[0.04] dark:hover:bg-white/[0.05]'
                }`}
              >
                <div className="flex items-center justify-center">
                  <span
                    className={`text-[13px] tabular-nums group-hover:hidden ${
                      isCurrent ? palette.activeText : 'text-neutral-500 dark:text-neutral-400'
                    }`}
                  >
                    {isCurrent && isPlaying ? '▶' : video.episodeNumber}
                  </span>
                  <span className="hidden group-hover:flex items-center justify-center text-neutral-900 dark:text-white">
                    {isCurrent && isPlaying ? (
                      <Pause size={15} className="fill-current" />
                    ) : (
                      <Play size={15} className="fill-current ml-0.5" />
                    )}
                  </span>
                </div>

                <div className="flex items-center gap-3 min-w-0">
                  <VideoThumb
                    src={video.thumbnailUrl}
                    alt={video.title}
                    className="w-16 h-9 shrink-0"
                    iconSize={15}
                    roundedClass="rounded"
                  />
                  <div className="min-w-0">
                    <div
                      className={`text-[14px] font-medium truncate ${
                        isCurrent ? palette.activeText : 'text-neutral-900 dark:text-neutral-100'
                      }`}
                    >
                      {video.title}
                    </div>
                    <div className="text-[12px] text-neutral-500 dark:text-neutral-400 truncate">
                      {video.creator}
                    </div>
                  </div>
                </div>

                <div className="text-[12.5px] font-mono-tabular text-neutral-500 dark:text-neutral-400 text-right">
                  {formatDuration(video.duration)}
                </div>

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
    </div>
  );
}
