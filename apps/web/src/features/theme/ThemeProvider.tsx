import { ConfigProvider, theme as antdTheme, type ThemeConfig } from 'antd';
import ptBR from 'antd/locale/pt_BR';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { local } from '../../lib/storage';

export type Theme = 'light' | 'dark';

interface ThemeState {
  theme: Theme;
  /* Applies the theme to the document synchronously; the toggler calls it
     inside a view transition callback. */
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeState | null>(null);
const KEY = 'bm-theme';

export function applyThemeToDocument(theme: Theme) {
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.classList.toggle('dark', theme === 'dark');
  root.style.colorScheme = theme;
}

const font = "'Manrope Variable', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

const shared: ThemeConfig['token'] = {
  fontFamily: font,
  fontSize: 16,
  borderRadius: 14,
  borderRadiusLG: 20,
  borderRadiusSM: 10,
  controlHeight: 44,
  controlHeightLG: 52,
  controlHeightSM: 34,
  motionDurationMid: '0.22s',
  wireframe: false
};

export const antdThemes: Record<Theme, ThemeConfig> = {
  light: {
    algorithm: antdTheme.defaultAlgorithm,
    token: {
      ...shared,
      colorPrimary: '#B92C28',
      colorSuccess: '#236544',
      colorWarning: '#9A6A00',
      colorError: '#B92C28',
      colorInfo: '#236544',
      colorLink: '#B92C28',
      colorText: '#191714',
      colorTextSecondary: '#62594F',
      colorTextTertiary: '#7A7065',
      colorBgLayout: '#FFF9F0',
      colorBgContainer: '#FFFFFF',
      colorBgElevated: '#FFFFFF',
      colorBorder: '#E7DCCD',
      colorBorderSecondary: '#F0E7DA',
      colorFillSecondary: '#F6EEE2',
      boxShadowSecondary: '0 18px 40px -18px rgba(70, 40, 15, 0.28)'
    },
    components: {
      Button: { fontWeight: 700, primaryShadow: 'none', defaultShadow: 'none', paddingInline: 20 },
      Input: { activeShadow: '0 0 0 3px rgba(185, 44, 40, 0.14)' },
      Radio: { dotSize: 10 },
      Segmented: { itemSelectedBg: '#FFFFFF', trackBg: '#F3EADD' }
    }
  },
  dark: {
    algorithm: antdTheme.darkAlgorithm,
    token: {
      ...shared,
      colorPrimary: '#C43A31',
      colorSuccess: '#7BC49A',
      colorWarning: '#F2BF4B',
      colorError: '#EF756B',
      colorInfo: '#7BC49A',
      colorLink: '#EF756B',
      colorText: '#F7F0E7',
      colorTextSecondary: '#C2B8AA',
      colorTextTertiary: '#A69B8D',
      colorBgLayout: '#141311',
      colorBgContainer: '#211E1A',
      colorBgElevated: '#2A2621',
      colorBorder: '#3B352E',
      colorBorderSecondary: '#2F2A24',
      colorFillSecondary: '#2C2722',
      boxShadowSecondary: '0 18px 40px -18px rgba(0, 0, 0, 0.6)'
    },
    components: {
      Button: { fontWeight: 700, primaryShadow: 'none', defaultShadow: 'none', paddingInline: 20 },
      Input: { activeShadow: '0 0 0 3px rgba(239, 117, 107, 0.2)' },
      Radio: { dotSize: 10 },
      Segmented: { itemSelectedBg: '#3A342D', trackBg: '#1B1916' }
    }
  }
};

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => (document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'));
  const [chosen, setChosen] = useState(() => {
    try {
      const saved = local?.getItem(KEY);
      return saved === 'light' || saved === 'dark';
    } catch {
      return false;
    }
  });

  const setTheme = useCallback((next: Theme) => {
    applyThemeToDocument(next);
    setThemeState(next);
    setChosen(true);
    // Plain string, read by the inline script in index.html before React loads.
    try {
      local?.setItem(KEY, next);
    } catch {
      /* storage unavailable */
    }
  }, []);

  // Follow the system until the customer picks a theme.
  useEffect(() => {
    if (chosen) return;
    const list = window.matchMedia('(prefers-color-scheme: dark)');
    const follow = () => {
      const next: Theme = list.matches ? 'dark' : 'light';
      applyThemeToDocument(next);
      setThemeState(next);
    };
    list.addEventListener('change', follow);
    return () => list.removeEventListener('change', follow);
  }, [chosen]);

  const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme]);
  return (
    <ThemeContext.Provider value={value}>
      <ConfigProvider theme={antdThemes[theme]} locale={ptBR} wave={{ disabled: true }}>
        {children}
      </ConfigProvider>
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme fora do ThemeProvider');
  return ctx;
}
