import { create } from 'zustand';

type Theme = 'light' | 'dark' | 'system';

interface UiState {
  sidebarOpen: boolean;
  theme: Theme;
  /** Tracks whether the mobile nav overlay is visible */
  mobileMenuOpen: boolean;

  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setTheme: (theme: Theme) => void;
  toggleMobileMenu: () => void;
  setMobileMenuOpen: (open: boolean) => void;
}

function getInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'system';
  return (localStorage.getItem('csn-theme') as Theme) ?? 'system';
}

function applyThemeToDocument(theme: Theme): void {
  const root = document.documentElement;
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const isDark = theme === 'dark' || (theme === 'system' && prefersDark);
  root.classList.toggle('dark', isDark);
}

export const useUiStore = create<UiState>()((set) => {
  const initialTheme = getInitialTheme();

  // Apply on first load
  if (typeof window !== 'undefined') {
    applyThemeToDocument(initialTheme);
  }

  return {
    sidebarOpen: true,
    theme: initialTheme,
    mobileMenuOpen: false,

    toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
    setSidebarOpen: (open) => set({ sidebarOpen: open }),

    setTheme: (theme) => {
      localStorage.setItem('csn-theme', theme);
      applyThemeToDocument(theme);
      set({ theme });
    },

    toggleMobileMenu: () => set((s) => ({ mobileMenuOpen: !s.mobileMenuOpen })),
    setMobileMenuOpen: (open) => set({ mobileMenuOpen: open }),
  };
});
