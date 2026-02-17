import { onMounted, onUnmounted, type Ref } from 'vue';

type TabName = 'agents' | 'worktrees' | 'tasks' | 'live' | 'history';

interface KeyboardShortcutOptions {
  activeTab: Ref<TabName>;
  showFilters: Ref<boolean>;
  showHelp: Ref<boolean>;
  showThemeManager: Ref<boolean>;
}

const TAB_KEYS: Record<string, TabName> = {
  '1': 'agents',
  '2': 'worktrees',
  '3': 'tasks',
  '4': 'live',
  '5': 'history',
};

export function useKeyboardShortcuts(options: KeyboardShortcutOptions) {
  const { activeTab, showFilters, showHelp, showThemeManager } = options;

  const handleKeyDown = (e: KeyboardEvent) => {
    // Ignore when focus is in an input, textarea, or contenteditable
    const target = e.target as HTMLElement;
    if (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.tagName === 'SELECT' ||
      target.isContentEditable
    ) {
      return;
    }

    // Escape: close any open overlay (cascading)
    if (e.key === 'Escape') {
      if (showHelp.value) {
        showHelp.value = false;
        e.preventDefault();
        return;
      }
      if (showThemeManager.value) {
        showThemeManager.value = false;
        e.preventDefault();
        return;
      }
      if (showFilters.value) {
        showFilters.value = false;
        e.preventDefault();
        return;
      }
      return;
    }

    // ? or Shift+/ → toggle help overlay
    if (e.key === '?' || (e.key === '/' && e.shiftKey)) {
      showHelp.value = !showHelp.value;
      e.preventDefault();
      return;
    }

    // Don't process other shortcuts when overlays are open
    if (showHelp.value || showThemeManager.value) return;

    // F → toggle filters (only on Live tab)
    if (e.key === 'f' || e.key === 'F') {
      if (activeTab.value === 'live') {
        showFilters.value = !showFilters.value;
        e.preventDefault();
      }
      return;
    }

    // 1-5 → switch tabs
    if (TAB_KEYS[e.key]) {
      activeTab.value = TAB_KEYS[e.key];
      e.preventDefault();
      return;
    }
  };

  onMounted(() => {
    window.addEventListener('keydown', handleKeyDown);
  });

  onUnmounted(() => {
    window.removeEventListener('keydown', handleKeyDown);
  });
}
