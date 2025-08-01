import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { ThemeProvider as EmotionThemeProvider } from '@emotion/react';
import { themes, ThemeName, Theme } from './themes';

interface ThemeContextValue {
  currentTheme: ThemeName;
  theme: Theme;
  setTheme: (theme: ThemeName) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

interface ThemeProviderProps {
  children: React.ReactNode;
  initialTheme?: ThemeName;
  persistTheme?: boolean;
}

const THEME_STORAGE_KEY = 'rover-mission-control-theme';

export const ThemeProvider: React.FC<ThemeProviderProps> = ({
  children,
  initialTheme = 'default',
  persistTheme = true,
}) => {
  const [currentTheme, setCurrentTheme] = useState<ThemeName>(() => {
    if (persistTheme && typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
      if (savedTheme && savedTheme in themes) {
        return savedTheme as ThemeName;
      }
    }
    return initialTheme;
  });

  const theme = themes[currentTheme];

  useEffect(() => {
    if (persistTheme && typeof window !== 'undefined') {
      localStorage.setItem(THEME_STORAGE_KEY, currentTheme);
    }
    
    // Apply theme to document root for CSS variables
    const root = document.documentElement;
    root.setAttribute('data-theme', currentTheme);
    
    // Set color-scheme for native controls
    root.style.colorScheme = theme.mode;
    
    // Announce theme change to screen readers
    const announcement = document.createElement('div');
    announcement.setAttribute('role', 'status');
    announcement.setAttribute('aria-live', 'polite');
    announcement.setAttribute('aria-atomic', 'true');
    announcement.className = 'sr-only';
    announcement.textContent = `Theme changed to ${theme.name}`;
    document.body.appendChild(announcement);
    
    setTimeout(() => {
      document.body.removeChild(announcement);
    }, 1000);
  }, [currentTheme, theme, persistTheme]);

  const setTheme = (newTheme: ThemeName) => {
    if (newTheme in themes) {
      setCurrentTheme(newTheme);
    }
  };

  const toggleTheme = () => {
    const themeNames = Object.keys(themes) as ThemeName[];
    const currentIndex = themeNames.indexOf(currentTheme);
    const nextIndex = (currentIndex + 1) % themeNames.length;
    setCurrentTheme(themeNames[nextIndex]);
  };

  const contextValue = useMemo(
    () => ({
      currentTheme,
      theme,
      setTheme,
      toggleTheme,
    }),
    [currentTheme, theme]
  );

  return (
    <ThemeContext.Provider value={contextValue}>
      <EmotionThemeProvider theme={theme}>
        {children}
      </EmotionThemeProvider>
    </ThemeContext.Provider>
  );
};