import {
  Clapperboard,
  Film,
  Folder,
  ListVideo,
  Menu,
  Moon,
  Palette,
  Plus,
  Settings,
  Sun,
  Users,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { AccentTheme, ActiveSection, ThemeMode, VideoPlaylist } from '@/src/types/video';
import { ACCENT_PALETTES } from '@/src/utils/accent';

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  activeSection: ActiveSection;
  activePlaylistId: string | null;
  onSelectSection: (section: ActiveSection, playlistId?: string | null) => void;
  playlists: VideoPlaylist[];
  onCreatePlaylist: (name: string) => void;
  queueCount: number;
  folderLocationCount: number;
  theme: ThemeMode;
  onToggleTheme: () => void;
  accent: AccentTheme;
  onChangeAccent: (accent: AccentTheme) => void;
}

export function Sidebar({
  collapsed,
  onToggleCollapse,
  activeSection,
  activePlaylistId,
  onSelectSection,
  playlists,
  onCreatePlaylist,
  queueCount,
  folderLocationCount,
  theme,
  onToggleTheme,
  accent,
  onChangeAccent,
}: SidebarProps) {
  const [creatingPlaylist, setCreatingPlaylist] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [showAppearance, setShowAppearance] = useState(false);

  const palette = ACCENT_PALETTES[accent];

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newPlaylistName.trim();
    if (trimmed) {
      onCreatePlaylist(trimmed);
      setNewPlaylistName('');
      setCreatingPlaylist(false);
    }
  };

  const navItems: { id: ActiveSection; label: string; icon: typeof Clapperboard; count?: number }[] = [
    { id: 'collections', label: 'Collections', icon: Clapperboard },
    { id: 'videos', label: 'Videos', icon: Film },
    { id: 'creators', label: 'Creators', icon: Users },
    { id: 'queue', label: 'Play queue', icon: ListVideo, count: queueCount },
    { id: 'folders', label: 'Folders', icon: Folder },
  ];

  const isSettingsActive = activeSection === 'settings';

  return (
    <aside
      aria-label="Video library navigation"
      className={`${
        collapsed ? 'w-[60px]' : 'w-[248px]'
      } shrink-0 h-full flex flex-col bg-[#f3f3f3]/90 dark:bg-[#202020]/95 border-r border-black/[0.07] dark:border-white/[0.06] transition-[width] duration-200 ease-out select-none relative z-20`}
    >
      {/* Window Titlebar / Hamburger Header */}
      <div className="flex items-center gap-2.5 px-3 pt-3.5 pb-2">
        <button
          type="button"
          onClick={onToggleCollapse}
          title={collapsed ? 'Expand navigation' : 'Collapse navigation'}
          aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
          className="w-9 h-9 rounded-md flex items-center justify-center text-neutral-700 dark:text-neutral-200 hover:bg-black/[0.05] dark:hover:bg-white/[0.06] transition-colors shrink-0"
        >
          <Menu size={18} />
        </button>
        {!collapsed && (
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-display text-[15px] font-semibold tracking-tight text-neutral-900 dark:text-neutral-100 whitespace-nowrap truncate">
              Video Player
            </span>
          </div>
        )}
      </div>

      {/* Primary Video Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 py-1 space-y-0.5">
        {!collapsed && (
          <div className="px-3 pt-2 pb-1 text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
            Video library
          </div>
        )}

        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeSection === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectSection(item.id, null)}
              title={collapsed ? item.label : undefined}
              className={`group relative w-full h-10 px-3 rounded-md flex items-center gap-3 text-[13.5px] font-medium transition-colors whitespace-nowrap ${
                isActive
                  ? 'bg-black/[0.06] dark:bg-white/[0.07] text-neutral-950 dark:text-white'
                  : 'text-neutral-700 dark:text-neutral-300 hover:bg-black/[0.04] dark:hover:bg-white/[0.05]'
              }`}
            >
              {isActive && (
                <span
                  aria-hidden="true"
                  className={`absolute left-0 top-2.5 bottom-2.5 w-[3px] rounded-full ${palette.indicatorBg}`}
                />
              )}
              <Icon
                size={17}
                strokeWidth={isActive ? 2.1 : 1.75}
                className={`shrink-0 ${isActive ? palette.activeText : ''}`}
              />
              {!collapsed && (
                <>
                  <span className="flex-1 text-left truncate">{item.label}</span>
                  {typeof item.count === 'number' && item.count > 0 && (
                    <span className="text-[11px] tabular-nums text-neutral-500 dark:text-neutral-400">
                      {item.count}
                    </span>
                  )}
                </>
              )}
            </button>
          );
        })}

        {/* Divider */}
        <div className="my-2.5 mx-2 border-t border-black/[0.07] dark:border-white/[0.06]" />

        {/* Playlists Section */}
        {!collapsed && (
          <div className="px-3 pt-1 pb-1 flex items-center justify-between">
            <span className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
              Playlists
            </span>
            <button
              type="button"
              onClick={() => setCreatingPlaylist((v) => !v)}
              title="New playlist"
              aria-label="Create new video playlist"
              className="w-6 h-6 rounded flex items-center justify-center text-neutral-600 dark:text-neutral-300 hover:bg-black/[0.06] dark:hover:bg-white/[0.08] transition-colors"
            >
              <Plus size={14} />
            </button>
          </div>
        )}

        {!collapsed && creatingPlaylist && (
          <form onSubmit={handleCreateSubmit} className="px-2 py-1.5">
            <input
              type="text"
              autoFocus
              value={newPlaylistName}
              onChange={(e) => setNewPlaylistName(e.target.value)}
              placeholder="Playlist name..."
              className="w-full h-8 px-2.5 text-[12.5px] rounded bg-white dark:bg-[#2b2b2b] text-neutral-900 dark:text-neutral-100 border border-black/15 dark:border-white/15 focus:outline-none focus:border-[#0067c0] dark:focus:border-[#60cdff]"
            />
            <div className="flex items-center justify-end gap-1.5 mt-1.5">
              <button
                type="button"
                onClick={() => {
                  setCreatingPlaylist(false);
                  setNewPlaylistName('');
                }}
                className="px-2.5 py-1 text-[11px] rounded text-neutral-600 dark:text-neutral-300 hover:bg-black/5 dark:hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                type="submit"
                className={`px-2.5 py-1 text-[11px] font-medium rounded ${palette.buttonBg} ${palette.buttonText}`}
              >
                Create
              </button>
            </div>
          </form>
        )}

        {!collapsed &&
          playlists.map((pl) => {
            const isActive = activeSection === 'playlists' && activePlaylistId === pl.id;
            return (
              <button
                key={pl.id}
                type="button"
                onClick={() => onSelectSection('playlists', pl.id)}
                className={`relative w-full h-9 px-3 rounded-md flex items-center gap-3 text-[13px] transition-colors ${
                  isActive
                    ? 'bg-black/[0.06] dark:bg-white/[0.07] text-neutral-950 dark:text-white font-medium'
                    : 'text-neutral-700 dark:text-neutral-300 hover:bg-black/[0.04] dark:hover:bg-white/[0.05]'
                }`}
              >
                {isActive && (
                  <span
                    aria-hidden="true"
                    className={`absolute left-0 top-2 bottom-2 w-[3px] rounded-full ${palette.indicatorBg}`}
                  />
                )}
                <ListVideo
                  size={15}
                  className={`shrink-0 ${isActive ? palette.activeText : 'text-neutral-500 dark:text-neutral-400'}`}
                />
                <span className="flex-1 text-left truncate">{pl.name}</span>
                <span className="text-[11px] tabular-nums text-neutral-500 dark:text-neutral-400">
                  {pl.videoIds.length}
                </span>
              </button>
            );
          })}
      </nav>

      {/* Bottom Actions: Settings & Theme/Accent */}
      <div className="p-2 border-t border-black/[0.07] dark:border-white/[0.06] space-y-1 relative">
        <button
          type="button"
          onClick={() => onSelectSection('settings', null)}
          title={collapsed ? 'Settings' : 'Manage folder locations and player settings'}
          className={`relative w-full h-10 px-3 rounded-md flex items-center gap-3 text-[13.5px] font-medium transition-colors whitespace-nowrap ${
            isSettingsActive
              ? 'bg-black/[0.06] dark:bg-white/[0.07] text-neutral-950 dark:text-white'
              : 'text-neutral-700 dark:text-neutral-200 hover:bg-black/[0.05] dark:hover:bg-white/[0.06]'
          }`}
        >
          {isSettingsActive && (
            <span
              aria-hidden="true"
              className={`absolute left-0 top-2.5 bottom-2.5 w-[3px] rounded-full ${palette.indicatorBg}`}
            />
          )}
          <Settings
            size={17}
            strokeWidth={isSettingsActive ? 2.1 : 1.75}
            className={`shrink-0 ${isSettingsActive ? palette.activeText : ''}`}
          />
          {!collapsed && (
            <>
              <span className="flex-1 text-left truncate">Settings</span>
              <span
                className="text-[11px] tabular-nums text-neutral-500 dark:text-neutral-400"
                title="Configured folder locations"
              >
                {folderLocationCount}
              </span>
            </>
          )}
        </button>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onToggleTheme}
            title={theme === 'dark' ? 'Switch to Light theme' : 'Switch to Dark theme'}
            className="flex-1 h-9 px-3 rounded-md flex items-center gap-3 text-[13px] text-neutral-700 dark:text-neutral-300 hover:bg-black/[0.05] dark:hover:bg-white/[0.06] transition-colors whitespace-nowrap"
          >
            {theme === 'dark' ? (
              <Sun size={16} className="shrink-0" />
            ) : (
              <Moon size={16} className="shrink-0" />
            )}
            {!collapsed && <span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>}
          </button>

          {!collapsed && (
            <button
              type="button"
              onClick={() => setShowAppearance((v) => !v)}
              title="Accent color"
              aria-label="Choose accent color"
              className="w-9 h-9 rounded-md flex items-center justify-center text-neutral-600 dark:text-neutral-300 hover:bg-black/[0.05] dark:hover:bg-white/[0.06] transition-colors shrink-0"
            >
              <Palette size={16} />
            </button>
          )}
        </div>

        {showAppearance && !collapsed && (
          <div className="absolute bottom-14 left-2 right-2 p-3 rounded-lg bg-white dark:bg-[#2c2c2c] border border-black/10 dark:border-white/10 shadow-xl z-30">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[12px] font-medium text-neutral-800 dark:text-neutral-200">
                Accent color
              </span>
              <button
                type="button"
                onClick={() => setShowAppearance(false)}
                className="p-0.5 rounded text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
              >
                <X size={13} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {(Object.keys(ACCENT_PALETTES) as AccentTheme[]).map((key) => {
                const p = ACCENT_PALETTES[key];
                const selected = accent === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      onChangeAccent(key);
                      setShowAppearance(false);
                    }}
                    className={`flex items-center gap-2 px-2.5 py-1.5 rounded text-[12px] text-left transition-colors ${
                      selected
                        ? 'bg-black/[0.08] dark:bg-white/[0.12] font-medium text-neutral-900 dark:text-white'
                        : 'hover:bg-black/[0.04] dark:hover:bg-white/[0.06] text-neutral-700 dark:text-neutral-300'
                    }`}
                  >
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: theme === 'dark' ? p.hexDark : p.hexLight }}
                    />
                    <span className="truncate">{p.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
