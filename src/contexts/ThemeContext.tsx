import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type ColorTheme = 'green-teal' | 'yellow-blue' | 'orange-blue' | 'beige-teal';

interface ThemeColors {
  primary: string;
  secondary: string;
  primaryHSL: string;
  secondaryHSL: string;
  name: string;
}

/**
 * Convert hex color to HSL format (for Tailwind CSS variables)
 */
function hexToHSL(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return '0 0% 50%';

  let r = parseInt(result[1], 16) / 255;
  let g = parseInt(result[2], 16) / 255;
  let b = parseInt(result[3], 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  h = Math.round(h * 360);
  s = Math.round(s * 100);
  const lightness = Math.round(l * 100);

  return `${h} ${s}% ${lightness}%`;
}

const THEME_COLORS: Record<ColorTheme, ThemeColors> = {
  'green-teal': {
    primary: '#4ECDC4',
    secondary: '#44A08D',
    primaryHSL: '177 55% 60%',
    secondaryHSL: '165 44% 45%',
    name: 'Green & Teal (Default)',
  },
  'yellow-blue': {
    primary: '#FFC20A',
    secondary: '#0C7BDC',
    primaryHSL: hexToHSL('#FFC20A'),
    secondaryHSL: hexToHSL('#0C7BDC'),
    name: 'Yellow & Blue',
  },
  'orange-blue': {
    primary: '#994F00',
    secondary: '#006CD1',
    primaryHSL: hexToHSL('#994F00'),
    secondaryHSL: hexToHSL('#006CD1'),
    name: 'Orange & Blue',
  },
  'beige-teal': {
    primary: '#E1BE6A',
    secondary: '#40B0A6',
    primaryHSL: hexToHSL('#E1BE6A'),
    secondaryHSL: hexToHSL('#40B0A6'),
    name: 'Beige & Teal',
  },
};

interface ThemeContextType {
  theme: ColorTheme;
  setTheme: (theme: ColorTheme) => void;
  themeColors: ThemeColors;
  availableThemes: Array<{ id: ColorTheme; colors: ThemeColors }>;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ColorTheme>(() => {
    const saved = localStorage.getItem('colorTheme');
    return (saved as ColorTheme) || 'green-teal';
  });

  const setTheme = (newTheme: ColorTheme) => {
    setThemeState(newTheme);
    localStorage.setItem('colorTheme', newTheme);
  };

  useEffect(() => {
    const colors = THEME_COLORS[theme];

    // Apply hex colors for direct CSS usage
    document.documentElement.style.setProperty('--theme-primary', colors.primary);
    document.documentElement.style.setProperty('--theme-secondary', colors.secondary);

    // Apply HSL colors for Tailwind CSS variables
    document.documentElement.style.setProperty('--primary', colors.primaryHSL);
    document.documentElement.style.setProperty('--primary-foreground', '160 30% 8%');

    document.documentElement.style.setProperty('--secondary', colors.secondaryHSL);
    document.documentElement.style.setProperty('--secondary-foreground', '160 30% 8%');

    // Apply to ring (focus indicators)
    document.documentElement.style.setProperty('--ring', colors.primaryHSL);

    // Apply to accent elements
    document.documentElement.style.setProperty('--accent', colors.primaryHSL);
    document.documentElement.style.setProperty('--accent-foreground', '160 30% 8%');

    // For gradient classes
    document.documentElement.style.setProperty('--gradient-start', colors.primary);
    document.documentElement.style.setProperty('--gradient-end', colors.secondary);

    // Update sidebar colors
    document.documentElement.style.setProperty('--sidebar-primary', colors.primaryHSL);
    document.documentElement.style.setProperty('--sidebar-ring', colors.primaryHSL);
  }, [theme]);

  const availableThemes = Object.entries(THEME_COLORS).map(([id, colors]) => ({
    id: id as ColorTheme,
    colors,
  }));

  return (
    <ThemeContext.Provider
      value={{
        theme,
        setTheme,
        themeColors: THEME_COLORS[theme],
        availableThemes,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
