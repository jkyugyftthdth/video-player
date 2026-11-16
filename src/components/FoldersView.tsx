import {
  Captions,
  ChevronDown,
  ChevronRight,
  Folder,
  FolderOpen,
  FolderTree,
  HardDrive,
  Info,
  LayoutGrid,
  List,
  ListPlus,
  Pause,
  Play,
  Plus,
  Settings,
  Shuffle,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { AccentTheme, FolderViewMode, VideoItem } from '@/src/types/video';
import { ACCENT_PALETTES } from '@/src/utils/accent';
import { formatDuration, formatTotalDuration } from '@/src/utils/format';
import { VideoThumb } from './VideoThumb';

interface FoldersViewProps {
  videos: VideoItem[];
  currentVideo: VideoItem | null;
  isPlaying: boolean;
  accent: AccentTheme;
  onOpenSettings: () => void;
  onPlayVideo: (video: VideoItem, contextVideos: VideoItem[]) => void;
  onPlayFolderVideos: (folderVideos: VideoItem[], shuffle?: boolean) => void;
  onAddFolderToQueue: (folderVideos: VideoItem[]) => void;
  onTogglePlayPause: () => void;
  onAddVideoToQueue: (video: VideoItem) => void;
  onOpenDetails: (video: VideoItem) => void;
}

interface DirectoryNode {
  path: string; // e.g. "" for root, "Videos", "Videos / Nordic Horizon (4K)"
  name: string;
  segments: string[];
  isLocal: boolean;
  children: DirectoryNode[];
  directVideos: VideoItem[];
  allVideos: VideoItem[];
  totalSec: number;
}

function normalizeSegments(rawPath: string): string[] {
  return rawPath
    .split('/')
    .map((s) => s.trim())
    .filter(Boolean);
}

function buildDirectoryTree(videos: VideoItem[]): DirectoryNode {
  const nodeMap = new Map<string, DirectoryNode>();

  const root: DirectoryNode = {
    path: '',
    name: 'All Directories',
    segments: [],
    isLocal: false,
    children: [],
    directVideos: [],
    allVideos: [],
    totalSec: 0,
  };
  nodeMap.set('', root);

  const ensureNode = (segments: string[], isLocal: boolean): DirectoryNode => {
    const path = segments.join(' / ');
    const existing = nodeMap.get(path);
    if (existing) {
      if (isLocal) existing.isLocal = true;
      return existing;
    }

    const parentSegments = segments.slice(0, -1);
    const parent = parentSegments.length > 0 ? ensureNode(parentSegments, isLocal) : root;

    const node: DirectoryNode = {
      path,
      name: segments[segments.length - 1] || 'Folder',
      segments,
      isLocal,
      children: [],
      directVideos: [],
      allVideos: [],
      totalSec: 0,
    };
    nodeMap.set(path, node);
    parent.children.push(node);
    return node;
  };

  for (const video of videos) {
    const rawPath = video.folderPath || `Videos / ${video.collection}`;
    const segments = normalizeSegments(rawPath);
    const isLocal = Boolean(video.isLocal);

    if (segments.length === 0) {
      root.directVideos.push(video);
      root.allVideos.push(video);
      root.totalSec += video.duration;
      continue;
    }

    const leaf = ensureNode(segments, isLocal);
    leaf.directVideos.push(video);

    // Propagate recursive totals up the directory chain
    root.allVideos.push(video);
    root.totalSec += video.duration;
    for (let i = 1; i <= segments.length; i++) {
      const ancestorPath = segments.slice(0, i).join(' / ');
      const ancestor = nodeMap.get(ancestorPath);
      if (ancestor) {
        ancestor.allVideos.push(video);
        ancestor.totalSec += video.duration;
      }
    }
  }

  const sortNode = (node: DirectoryNode) => {
    node.children.sort((a, b) => {
      if (a.isLocal !== b.isLocal) return a.isLocal ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    node.directVideos.sort((a, b) =>
      (a.fileName || a.title).localeCompare(b.fileName || b.title)
    );
    node.children.forEach(sortNode);
  };

  sortNode(root);
  return root;
}

export function FoldersView({
  videos,
  currentVideo,
  isPlaying,
  accent,
  onOpenSettings,
  onPlayVideo,
  onPlayFolderVideos,
  onAddFolderToQueue,
  onTogglePlayPause,
  onAddVideoToQueue,
  onOpenDetails,
}: FoldersViewProps) {
  const [selectedPath, setSelectedPath] = useState<string>('');
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(() => new Set(['Videos']));
  const [includeSubfolders, setIncludeSubfolders] = useState(true);
  const [viewMode, setViewMode] = useState<FolderViewMode>('grid');
  const palette = ACCENT_PALETTES[accent];

  const { rootNode, nodeIndex } = useMemo(() => {
    const root = buildDirectoryTree(videos);
    const index = new Map<string, DirectoryNode>();
    const walk = (n: DirectoryNode) => {
      index.set(n.path, n);
      n.children.forEach(walk);
    };
    walk(root);
    return { rootNode: root, nodeIndex: index };
  }, [videos]);

  const activeNode = nodeIndex.get(selectedPath) || rootNode;

  const activePlayableVideos = useMemo(() => {
    if (includeSubfolders || activeNode.directVideos.length === 0) {
      return activeNode.allVideos;
    }
    return activeNode.directVideos;
  }, [activeNode, includeSubfolders]);

  const displayedVideos =
    activeNode.directVideos.length > 0 ? activeNode.directVideos : activeNode.allVideos;

  const selectDirectory = (path: string) => {
    setSelectedPath(path);
    if (path) {
      const segs = normalizeSegments(path);
      setExpandedPaths((prev) => {
        const next = new Set(prev);
        for (let i = 1; i <= segs.length; i++) {
          next.add(segs.slice(0, i).join(' / '));
        }
        return next;
      });
    }
  };

  const toggleExpand = (path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const renderTreeNodes = (nodes: DirectoryNode[], depth = 0) => {
    return nodes.map((node) => {
      const hasChildren = node.children.length > 0;
      const isExpanded = expandedPaths.has(node.path);
      const isSelected = activeNode.path === node.path;
      const isPlayingInside = node.allVideos.some((v) => v.id === currentVideo?.id);

      return (
        <div key={node.path}>
          <div
            style={{ paddingLeft: `${8 + depth * 14}px` }}
            onClick={() => selectDirectory(node.path)}
            className={`group h-8 pr-2 rounded-md flex items-center gap-1.5 text-[12.5px] cursor-pointer transition-colors ${
              isSelected
                ? 'bg-black/[0.08] dark:bg-white/[0.1] font-medium text-neutral-950 dark:text-white'
                : 'text-neutral-700 dark:text-neutral-300 hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'
            }`}
          >
            {hasChildren ? (
              <button
                type="button"
                aria-label={isExpanded ? `Collapse ${node.name}` : `Expand ${node.name}`}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleExpand(node.path);
                }}
                className="w-4 h-4 rounded flex items-center justify-center text-neutral-500 hover:text-neutral-900 dark:hover:text-white shrink-0"
              >
                {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
              </button>
            ) : (
              <span className="w-4 shrink-0" />
            )}

            {isSelected || isExpanded ? (
              <FolderOpen
                size={14}
                className={`shrink-0 ${
                  isSelected || isPlayingInside
                    ? palette.activeText
                    : 'text-neutral-500 dark:text-neutral-400'
                }`}
              />
            ) : (
              <Folder
                size={14}
                className={`shrink-0 ${
                  isPlayingInside ? palette.activeText : 'text-neutral-500 dark:text-neutral-400'
                }`}
              />
            )}

            <span
              className={`flex-1 truncate ${
                isPlayingInside && !isSelected ? palette.activeText : ''
              }`}
            >
              {node.name}
            </span>

            <span className="text-[11px] tabular-nums text-neutral-500 dark:text-neutral-400">
              {node.allVideos.length}
            </span>
          </div>

          {hasChildren && isExpanded && (
            <div className="mt-0.5 space-y-0.5">{renderTreeNodes(node.children, depth + 1)}</div>
          )}
        </div>
      );
    });
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header Bar */}
      <div className="px-6 pt-5 pb-4 border-b border-black/[0.06] dark:border-white/[0.06] flex flex-wrap items-center justify-between gap-4 shrink-0">
        <div className="min-w-0">
          <div className="flex items-baseline gap-3">
            <h1 className="font-display text-[28px] font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
              Folders &amp; Directory
            </h1>
            <span className="text-[13px] text-neutral-500 dark:text-neutral-400 tabular-nums">
              {activeNode.allVideos.length}{' '}
              {activeNode.allVideos.length === 1 ? 'video' : 'videos'} ·{' '}
              {formatTotalDuration(activeNode.totalSec)}
            </span>
          </div>

          {/* Windows 11 Breadcrumb Directory Path */}
          <nav
            aria-label="Directory breadcrumb"
            className="mt-2 flex flex-wrap items-center gap-1 text-[12.5px] text-neutral-600 dark:text-neutral-400"
          >
            <button
              type="button"
              onClick={() => selectDirectory('')}
              className={`px-2 py-0.5 rounded inline-flex items-center gap-1.5 transition-colors ${
                activeNode.path === ''
                  ? `font-medium bg-black/[0.06] dark:bg-white/[0.08] ${palette.activeText}`
                  : 'hover:bg-black/[0.05] dark:hover:bg-white/[0.07]'
              }`}
            >
              <HardDrive size={13} />
              <span>All Directories</span>
            </button>

            {activeNode.segments.map((seg, i) => {
              const segPath = activeNode.segments.slice(0, i + 1).join(' / ');
              const isLast = i === activeNode.segments.length - 1;
              return (
                <div key={segPath} className="inline-flex items-center gap-1">
                  <ChevronRight size={13} className="text-neutral-400" />
                  <button
                    type="button"
                    onClick={() => selectDirectory(segPath)}
                    className={`px-2 py-0.5 rounded transition-colors ${
                      isLast
                        ? `font-medium bg-black/[0.06] dark:bg-white/[0.08] ${palette.activeText}`
                        : 'hover:bg-black/[0.05] dark:hover:bg-white/[0.07]'
                    }`}
                  >
                    {seg}
                  </button>
                </div>
              );
            })}
          </nav>
        </div>

        {/* Folder-Wise Playback Actions & View Toggle */}
        <div className="flex flex-wrap items-center gap-2">
          {activeNode.children.length > 0 && activeNode.directVideos.length > 0 && (
            <button
              type="button"
              onClick={() => setIncludeSubfolders((v) => !v)}
              aria-pressed={includeSubfolders}
              title="Toggle whether folder playback includes subfolders"
              className={`h-9 px-3 rounded-md inline-flex items-center gap-1.5 text-[12.5px] font-medium border transition-colors whitespace-nowrap ${
                includeSubfolders
                  ? `bg-black/[0.06] dark:bg-white/[0.1] border-black/15 dark:border-white/15 ${palette.activeText}`
                  : 'bg-white dark:bg-[#2b2b2b] border-black/[0.08] dark:border-white/[0.08] text-neutral-700 dark:text-neutral-300'
              }`}
            >
              <FolderTree size={14} />
              <span>{includeSubfolders ? 'Incl. subfolders' : 'This folder only'}</span>
            </button>
          )}

          {/* Grid / List Switcher */}
          <div
            role="group"
            aria-label="Folder video layout"
            className="inline-flex items-center p-0.5 rounded-md bg-black/[0.06] dark:bg-white/[0.08] border border-black/[0.06] dark:border-white/[0.08]"
          >
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              aria-pressed={viewMode === 'grid'}
              title="Grid view"
              className={`h-8 px-2.5 rounded inline-flex items-center gap-1.5 text-[12px] font-medium transition-colors ${
                viewMode === 'grid'
                  ? 'bg-white dark:bg-[#383838] text-neutral-950 dark:text-white shadow-xs'
                  : 'text-neutral-600 dark:text-neutral-300 hover:text-neutral-950 dark:hover:text-white'
              }`}
            >
              <LayoutGrid size={14} />
              <span>Grid</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              aria-pressed={viewMode === 'list'}
              title="List view"
              className={`h-8 px-2.5 rounded inline-flex items-center gap-1.5 text-[12px] font-medium transition-colors ${
                viewMode === 'list'
                  ? 'bg-white dark:bg-[#383838] text-neutral-950 dark:text-white shadow-xs'
                  : 'text-neutral-600 dark:text-neutral-300 hover:text-neutral-950 dark:hover:text-white'
              }`}
            >
              <List size={14} />
              <span>List</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => onPlayFolderVideos(activePlayableVideos, false)}
            disabled={activePlayableVideos.length === 0}
            className={`h-9 px-3.5 rounded-md inline-flex items-center gap-1.5 text-[13px] font-medium transition-colors whitespace-nowrap disabled:opacity-40 ${palette.buttonBg} ${palette.buttonText}`}
          >
            <Play size={14} className="fill-current" />
            <span>Play folder</span>
          </button>

          <button
            type="button"
            onClick={() => onPlayFolderVideos(activePlayableVideos, true)}
            disabled={activePlayableVideos.length === 0}
            className="h-9 px-3.5 rounded-md inline-flex items-center gap-1.5 text-[12.5px] font-medium bg-white dark:bg-[#2b2b2b] hover:bg-neutral-50 dark:hover:bg-[#343434] text-neutral-800 dark:text-neutral-200 border border-black/[0.08] dark:border-white/[0.08] disabled:opacity-40 transition-colors whitespace-nowrap"
          >
            <Shuffle size={14} />
            <span>Shuffle</span>
          </button>

          <button
            type="button"
            onClick={() => onAddFolderToQueue(activePlayableVideos)}
            disabled={activePlayableVideos.length === 0}
            title="Add all videos in this directory to play queue"
            className="h-9 px-3 rounded-md inline-flex items-center gap-1.5 text-[12.5px] font-medium bg-white dark:bg-[#2b2b2b] hover:bg-neutral-50 dark:hover:bg-[#343434] text-neutral-800 dark:text-neutral-200 border border-black/[0.08] dark:border-white/[0.08] disabled:opacity-40 transition-colors whitespace-nowrap"
          >
            <ListPlus size={14} />
            <span className="hidden sm:inline">Queue folder</span>
          </button>

          <button
            type="button"
            onClick={onOpenSettings}
            className="h-9 px-3.5 rounded-md inline-flex items-center gap-1.5 text-[12.5px] font-medium bg-white dark:bg-[#2b2b2b] hover:bg-neutral-50 dark:hover:bg-[#343434] text-neutral-800 dark:text-neutral-200 border border-black/[0.08] dark:border-white/[0.08] transition-colors whitespace-nowrap"
          >
            <Settings size={14} />
            <span>Library Settings</span>
          </button>
        </div>
      </div>

      {/* Directory Explorer Split Layout: Tree Pane + Contents Pane */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        {/* Left Directory Tree Sidebar */}
        <aside
          aria-label="Directory tree"
          className="hidden md:flex w-64 shrink-0 flex-col border-r border-black/[0.06] dark:border-white/[0.06] bg-black/[0.015] dark:bg-white/[0.015] overflow-y-auto p-3"
        >
          <div className="px-2 pb-2 text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
            Directory tree
          </div>

          <button
            type="button"
            onClick={() => selectDirectory('')}
            className={`w-full h-8 px-2 rounded-md flex items-center gap-2 text-[12.5px] mb-1 transition-colors ${
              activeNode.path === ''
                ? `bg-black/[0.08] dark:bg-white/[0.1] font-medium ${palette.activeText}`
                : 'text-neutral-700 dark:text-neutral-300 hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'
            }`}
          >
            <HardDrive size={14} className="shrink-0" />
            <span className="flex-1 text-left truncate">All Directories</span>
            <span className="text-[11px] tabular-nums text-neutral-500 dark:text-neutral-400">
              {rootNode.allVideos.length}
            </span>
          </button>

          <div className="space-y-0.5">{renderTreeNodes(rootNode.children)}</div>
        </aside>

        {/* Right Directory Contents (Subfolders + Videos in Current Directory) */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* Subfolders Section */}
          {activeNode.children.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-[13px] font-semibold text-neutral-800 dark:text-neutral-200">
                  Folders ({activeNode.children.length})
                </h2>
              </div>

              <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3.5">
                {activeNode.children.map((folder) => {
                  const isActiveFolder = folder.allVideos.some(
                    (v) => v.id === currentVideo?.id
                  );
                  return (
                    <div
                      key={folder.path}
                      onClick={() => selectDirectory(folder.path)}
                      className={`group p-3.5 rounded-lg border cursor-pointer transition-colors flex flex-col justify-between gap-3 ${
                        isActiveFolder
                          ? 'bg-black/[0.05] dark:bg-[#2c2c2c] border-black/[0.1] dark:border-white/[0.12]'
                          : 'bg-white/60 dark:bg-[#272727]/80 hover:bg-white dark:hover:bg-[#2f2f2f] border-black/[0.05] dark:border-white/[0.05]'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-11 h-11 rounded-lg bg-black/[0.05] dark:bg-white/[0.07] flex items-center justify-center shrink-0">
                          <Folder size={22} className={palette.activeText} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3
                            className={`text-[14px] font-semibold truncate ${
                              isActiveFolder
                                ? palette.activeText
                                : 'text-neutral-900 dark:text-neutral-100'
                            }`}
                          >
                            {folder.name}
                          </h3>
                          <p className="text-[11.5px] text-neutral-500 dark:text-neutral-400 truncate mt-0.5">
                            {folder.children.length > 0
                              ? `${folder.children.length} ${
                                  folder.children.length === 1 ? 'subfolder' : 'subfolders'
                                } · `
                              : ''}
                            {folder.allVideos.length}{' '}
                            {folder.allVideos.length === 1 ? 'video' : 'videos'} ·{' '}
                            {formatTotalDuration(folder.totalSec)}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-2 border-t border-black/[0.05] dark:border-white/[0.05]">
                        <span className="text-[11.5px] text-neutral-500 dark:text-neutral-400 truncate">
                          {folder.isLocal ? 'PC directory' : 'Library directory'}
                        </span>

                        <div
                          className="flex items-center gap-1.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() => onAddFolderToQueue(folder.allVideos)}
                            title="Add folder to queue"
                            aria-label={`Queue ${folder.name}`}
                            className="w-8 h-8 rounded-md flex items-center justify-center text-neutral-600 dark:text-neutral-300 hover:bg-black/[0.06] dark:hover:bg-white/[0.09] transition-colors"
                          >
                            <Plus size={14} />
                          </button>

                          <button
                            type="button"
                            onClick={() => onPlayFolderVideos(folder.allVideos, false)}
                            className={`h-8 px-3 rounded-md inline-flex items-center gap-1.5 text-[12px] font-medium transition-colors ${palette.buttonBg} ${palette.buttonText}`}
                          >
                            <Play size={12} className="fill-current" />
                            <span>Play</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Direct Videos in Current Folder (or all videos when leaf) */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[13px] font-semibold text-neutral-800 dark:text-neutral-200">
                {activeNode.directVideos.length > 0
                  ? `Videos in "${activeNode.name}" (${activeNode.directVideos.length})`
                  : activeNode.allVideos.length > 0
                    ? `All videos under "${activeNode.name}" (${activeNode.allVideos.length})`
                    : 'Videos'}
              </h2>
            </div>

            {displayedVideos.length === 0 ? (
              <div className="h-56 flex flex-col items-center justify-center text-center rounded-xl border border-dashed border-black/10 dark:border-white/10 p-6">
                <FolderOpen size={36} className="text-neutral-400 dark:text-neutral-500 mb-2.5" />
                <p className="text-[14.5px] font-medium text-neutral-800 dark:text-neutral-200">
                  No folder locations added yet
                </p>
                <p className="text-[12.5px] text-neutral-500 dark:text-neutral-400 mt-1 max-w-md">
                  Videos only appear here after you add a folder location in Settings.
                </p>
                <button
                  type="button"
                  onClick={onOpenSettings}
                  className={`mt-4 h-9 px-4 rounded-md inline-flex items-center gap-2 text-[13px] font-medium transition-colors ${palette.buttonBg} ${palette.buttonText}`}
                >
                  <Settings size={14} />
                  <span>Open Settings to add folder</span>
                </button>
              </div>
            ) : viewMode === 'grid' ? (
              /* WINDOWS 11 MEDIA PLAYER VIDEO GRID VIEW */
              <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4">
                {displayedVideos.map((video) => {
                  const isCurrent = currentVideo?.id === video.id;
                  const subCount = video.subtitleTracks?.length ?? 0;
                  return (
                    <div
                      key={video.id}
                      onClick={() => {
                        if (isCurrent) {
                          onTogglePlayPause();
                        } else {
                          onPlayVideo(video, displayedVideos);
                        }
                      }}
                      className={`group rounded-lg p-2.5 border cursor-pointer transition-colors ${
                        isCurrent
                          ? 'bg-black/[0.05] dark:bg-[#2c2c2c] border-black/[0.12] dark:border-white/[0.15]'
                          : 'bg-white/70 dark:bg-[#272727]/85 hover:bg-white dark:hover:bg-[#2f2f2f] border-black/[0.05] dark:border-white/[0.05]'
                      }`}
                    >
                      <div className="relative aspect-video w-full overflow-hidden rounded-md mb-2.5 bg-neutral-900">
                        <VideoThumb
                          src={video.thumbnailUrl}
                          alt={video.title}
                          className="w-full h-full transition-transform duration-300 group-hover:scale-[1.03]"
                          iconSize={28}
                          roundedClass="rounded-md"
                        />

                        {/* Duration Overlay */}
                        <span className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/75 text-white text-[11px] font-mono-tabular">
                          {formatDuration(video.duration)}
                        </span>

                        {/* Subtitle Indicator Overlay */}
                        {subCount > 0 && (
                          <span
                            title={`${subCount} subtitle ${subCount === 1 ? 'track' : 'tracks'}`}
                            className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-black/65 text-white text-[10.5px] inline-flex items-center gap-1"
                          >
                            <Captions size={11} />
                            <span>{subCount}</span>
                          </span>
                        )}

                        {/* Hover Play/Pause & Quick Actions */}
                        <div
                          className={`absolute inset-0 bg-gradient-to-t from-black/65 via-black/15 to-transparent transition-opacity duration-200 flex items-center justify-center ${
                            isCurrent ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                          }`}
                        >
                          <span
                            className={`w-11 h-11 rounded-full flex items-center justify-center shadow-lg transition-transform group-hover:scale-105 ${palette.buttonBg} ${palette.buttonText}`}
                          >
                            {isCurrent && isPlaying ? (
                              <Pause size={18} className="fill-current" />
                            ) : (
                              <Play size={18} className="fill-current ml-0.5" />
                            )}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-start justify-between gap-2 min-w-0">
                        <div className="min-w-0 flex-1">
                          <h3
                            className={`text-[13.5px] font-medium truncate ${
                              isCurrent
                                ? palette.activeText
                                : 'text-neutral-900 dark:text-neutral-100'
                            }`}
                          >
                            {video.title}
                          </h3>
                          <p className="text-[12px] text-neutral-500 dark:text-neutral-400 truncate mt-0.5">
                            {video.creator}
                          </p>
                          <p className="text-[11px] text-neutral-400 dark:text-neutral-500 truncate mt-0.5">
                            {video.resolution} · {video.fileName || video.collection}
                          </p>
                        </div>

                        <div
                          className="flex items-center gap-0.5 shrink-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() => onOpenDetails(video)}
                            title="Video properties & bitrate"
                            aria-label={`View details for ${video.title}`}
                            className="w-7 h-7 rounded-md flex items-center justify-center text-neutral-500 dark:text-neutral-400 hover:bg-black/[0.06] dark:hover:bg-white/[0.08] transition-colors"
                          >
                            <Info size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => onAddVideoToQueue(video)}
                            title="Add to queue"
                            aria-label={`Add ${video.title} to queue`}
                            className="w-7 h-7 rounded-md flex items-center justify-center text-neutral-500 dark:text-neutral-400 hover:bg-black/[0.06] dark:hover:bg-white/[0.08] transition-colors"
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* LIST VIEW */
              <div className="divide-y divide-black/[0.04] dark:divide-white/[0.04]">
                {displayedVideos.map((video, idx, list) => {
                  const isCurrent = currentVideo?.id === video.id;
                  return (
                    <div
                      key={video.id}
                      onClick={() => {
                        if (isCurrent) {
                          onTogglePlayPause();
                        } else {
                          onPlayVideo(video, list);
                        }
                      }}
                      className={`group grid grid-cols-[38px_1fr_minmax(130px,1fr)_72px_76px] items-center gap-3 px-3 h-13 rounded-md cursor-pointer transition-colors ${
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
                        <div className="min-w-0">
                          <div
                            className={`text-[13.5px] font-medium truncate ${
                              isCurrent
                                ? palette.activeText
                                : 'text-neutral-900 dark:text-neutral-100'
                            }`}
                          >
                            {video.title}
                          </div>
                          <div className="text-[12px] text-neutral-500 dark:text-neutral-400 truncate">
                            {video.creator}
                          </div>
                        </div>
                      </div>

                      <span className="text-[12.5px] text-neutral-500 dark:text-neutral-400 truncate">
                        {video.fileName || video.folderPath || video.collection}
                      </span>

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
                          aria-label={`Add ${video.title} to queue`}
                          className="w-8 h-8 rounded-md opacity-0 group-hover:opacity-100 flex items-center justify-center text-neutral-500 dark:text-neutral-400 hover:bg-black/[0.06] dark:hover:bg-white/[0.08]"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
