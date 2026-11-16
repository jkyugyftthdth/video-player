import {
  Check,
  Film,
  FolderOpen,
  FolderPlus,
  Moon,
  Palette,
  Sun,
  Trash2,
} from 'lucide-react';
import { AccentTheme, LibraryFolderLocation, ThemeMode } from '@/src/types/video';
import { PlaybackSettings } from './PlaybackSettings';
import { ACCENT_PALETTES } from '@/src/utils/accent';

interface SettingsViewProps {
  libraryFolders: LibraryFolderLocation[];
  hasSampleFolder: boolean;
  totalVideos: number;
  theme: ThemeMode;
  accent: AccentTheme;
  onAddLocalFolder: () => void;
  onAddSampleFolder: () => void;
  onRemoveFolder: (folderId: string) => void;
  onToggleTheme: (nextTheme: ThemeMode) => void;
  onChangeAccent: (nextAccent: AccentTheme) => void;
  onBrowseFolders: () => void;
}

export function SettingsView({
  libraryFolders,
  hasSampleFolder,
  totalVideos,
  theme,
  accent,
  onAddLocalFolder,
  onAddSampleFolder,
  onRemoveFolder,
  onToggleTheme,
  onChangeAccent,
  onBrowseFolders,
}: SettingsViewProps) {
  const palette = ACCENT_PALETTES[accent];

  return (
    <div className="h-full overflow-y-auto px-6 py-5">
      <div className="max-w-4xl space-y-8 pb-8">
        {/* Page Header */}
        <div className="border-b border-black/[0.06] dark:border-white/[0.06] pb-4">
          <h1 className="font-display text-[28px] font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
            Settings
          </h1>
          <p className="text-[13px] text-neutral-500 dark:text-neutral-400 mt-1">
            Manage folder locations for your video library and customize player appearance.
          </p>
        </div>

        {/* Video Library Locations */}
        <section aria-labelledby="settings-library-heading" className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2
                id="settings-library-heading"
                className="text-[15px] font-semibold text-neutral-900 dark:text-neutral-100"
              >
                Video library locations
              </h2>
              <p className="text-[12.5px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                Videos and external <span className="font-mono">.vtt</span> subtitle tracks appear
                in your library only after you add a folder location here.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={onAddLocalFolder}
                className={`h-9 px-4 rounded-md inline-flex items-center gap-2 text-[13px] font-medium transition-colors whitespace-nowrap ${palette.buttonBg} ${palette.buttonText}`}
              >
                <FolderPlus size={15} />
                <span>Add folder</span>
              </button>

              <button
                type="button"
                onClick={onAddSampleFolder}
                disabled={hasSampleFolder}
                className="h-9 px-3.5 rounded-md inline-flex items-center gap-2 text-[12.5px] font-medium bg-white dark:bg-[#2b2b2b] hover:bg-neutral-50 dark:hover:bg-[#343434] text-neutral-800 dark:text-neutral-200 border border-black/[0.08] dark:border-white/[0.08] disabled:opacity-45 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
              >
                <Film size={14} />
                <span>{hasSampleFolder ? 'Sample folder added' : 'Add sample cinema folder'}</span>
              </button>
            </div>
          </div>

          <div className="rounded-lg border border-black/[0.08] dark:border-white/[0.08] bg-white/80 dark:bg-[#272727]/85 divide-y divide-black/[0.06] dark:divide-white/[0.06] overflow-hidden">
            {libraryFolders.length === 0 ? (
              <div className="px-5 py-8 flex flex-col items-center justify-center text-center">
                <FolderOpen size={32} className="text-neutral-400 dark:text-neutral-500 mb-2.5" />
                <p className="text-[14px] font-medium text-neutral-800 dark:text-neutral-200">
                  No folder locations added
                </p>
                <p className="text-[12.5px] text-neutral-500 dark:text-neutral-400 mt-1 max-w-md">
                  Your library is empty. Click <span className="font-medium">Add folder</span> to
                  import videos (and matching <span className="font-mono">.vtt</span> subtitles)
                  from a directory on your PC, or add the sample 4K cinema folder.
                </p>
              </div>
            ) : (
              libraryFolders.map((folder) => (
                <div
                  key={folder.id}
                  className="px-4 py-3.5 flex items-center justify-between gap-4 hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-10 h-10 rounded-md bg-black/[0.05] dark:bg-white/[0.07] flex items-center justify-center shrink-0">
                      <FolderOpen size={18} className={palette.activeText} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[13.5px] font-medium text-neutral-900 dark:text-neutral-100 truncate">
                          {folder.name}
                        </span>
                        <span className="text-[11px] px-1.5 py-0.5 rounded bg-black/[0.06] dark:bg-white/[0.09] text-neutral-600 dark:text-neutral-300 shrink-0">
                          {folder.source === 'sample' ? 'Sample archive' : 'PC directory'}
                        </span>
                      </div>
                      <p className="text-[12px] text-neutral-500 dark:text-neutral-400 truncate mt-0.5">
                        {folder.path} ·{' '}
                        <span className="tabular-nums">
                          {folder.videoCount} {folder.videoCount === 1 ? 'video' : 'videos'}
                        </span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={onBrowseFolders}
                      className="h-8 px-3 rounded-md text-[12px] font-medium text-neutral-700 dark:text-neutral-200 hover:bg-black/[0.06] dark:hover:bg-white/[0.08] transition-colors"
                    >
                      Open in Folders
                    </button>
                    <button
                      type="button"
                      onClick={() => onRemoveFolder(folder.id)}
                      aria-label={`Remove folder ${folder.name}`}
                      title="Remove folder location from library"
                      className="h-8 px-2.5 rounded-md inline-flex items-center gap-1.5 text-[12px] font-medium text-red-600 dark:text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      <Trash2 size={14} />
                      <span>Remove</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {libraryFolders.length > 0 && (
            <p className="text-[12px] text-neutral-500 dark:text-neutral-400 tabular-nums">
              Indexing {totalVideos} {totalVideos === 1 ? 'video' : 'videos'} across{' '}
              {libraryFolders.length}{' '}
              {libraryFolders.length === 1 ? 'folder location' : 'folder locations'}.
            </p>
          )}
        </section>

        {/* Personalization */}
        <section aria-labelledby="settings-personalization-heading" className="space-y-3">
          <h2
            id="settings-personalization-heading"
            className="text-[15px] font-semibold text-neutral-900 dark:text-neutral-100"
          >
            Personalization
          </h2>

          <div className="rounded-lg border border-black/[0.08] dark:border-white/[0.08] bg-white/80 dark:bg-[#272727]/85 divide-y divide-black/[0.06] dark:divide-white/[0.06]">
            {/* App Theme */}
            <div className="px-4 py-3.5 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                {theme === 'dark' ? (
                  <Moon size={18} className="text-neutral-600 dark:text-neutral-300" />
                ) : (
                  <Sun size={18} className="text-neutral-600 dark:text-neutral-300" />
                )}
                <div>
                  <div className="text-[13.5px] font-medium text-neutral-900 dark:text-neutral-100">
                    App theme
                  </div>
                  <div className="text-[12px] text-neutral-500 dark:text-neutral-400">
                    Choose light or dark Windows 11 Mica surface
                  </div>
                </div>
              </div>

              <div
                role="group"
                aria-label="Theme mode"
                className="inline-flex items-center p-0.5 rounded-md bg-black/[0.05] dark:bg-white/[0.08] border border-black/[0.06] dark:border-white/[0.08]"
              >
                <button
                  type="button"
                  onClick={() => onToggleTheme('light')}
                  className={`h-8 px-3 rounded text-[12.5px] font-medium transition-colors ${
                    theme === 'light'
                      ? 'bg-white text-neutral-950 shadow-xs'
                      : 'text-neutral-600 dark:text-neutral-300 hover:text-neutral-950 dark:hover:text-white'
                  }`}
                >
                  Light
                </button>
                <button
                  type="button"
                  onClick={() => onToggleTheme('dark')}
                  className={`h-8 px-3 rounded text-[12.5px] font-medium transition-colors ${
                    theme === 'dark'
                      ? 'bg-[#383838] text-white shadow-xs'
                      : 'text-neutral-600 dark:text-neutral-300 hover:text-neutral-950 dark:hover:text-white'
                  }`}
                >
                  Dark
                </button>
              </div>
            </div>

            {/* Accent Color */}
            <div className="px-4 py-3.5 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Palette size={18} className="text-neutral-600 dark:text-neutral-300" />
                <div>
                  <div className="text-[13.5px] font-medium text-neutral-900 dark:text-neutral-100">
                    Accent palette
                  </div>
                  <div className="text-[12px] text-neutral-500 dark:text-neutral-400">
                    Highlight color for active controls and focus indicators
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {(Object.keys(ACCENT_PALETTES) as AccentTheme[]).map((key) => {
                  const p = ACCENT_PALETTES[key];
                  const selected = accent === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => onChangeAccent(key)}
                      aria-pressed={selected}
                      className={`h-8 px-3 rounded-md inline-flex items-center gap-2 text-[12.5px] border transition-colors ${
                        selected
                          ? 'bg-black/[0.06] dark:bg-white/[0.1] border-black/20 dark:border-white/25 font-medium text-neutral-950 dark:text-white'
                          : 'bg-white dark:bg-[#2b2b2b] border-black/[0.08] dark:border-white/[0.08] text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-[#333]'
                      }`}
                    >
                      <span
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: theme === 'dark' ? p.hexDark : p.hexLight }}
                      />
                      <span>{p.label}</span>
                      {selected && <Check size={13} />}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        <PlaybackSettings />
      </div>
    </div>
  );
}
