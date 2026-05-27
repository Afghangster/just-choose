import React, { createContext, useContext, ReactNode, useState, useEffect } from "react";
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemeColors = {
  background: string;
  surface: string;
  surfaceMuted: string;
  ink: string;
  muted: string;
  border: string;
  teal: string;
  tealSoft: string;
  coral: string;
  coralSoft: string;
  amber: string;
  amberSoft: string;
  green: string;
  greenSoft: string;
  purple: string;
  purpleSoft: string;
  blue: string;
  blueSoft: string;
  sage: string;
  mint: string;
  peach: string;
  butter: string;
  danger: string;
  overlay: string;
};

export const palettes: Record<string, ThemeColors> = {
  light: {
    background: "#FFF7E8",
    surface: "#FFFFFF",
    surfaceMuted: "#FFE8DF",
    ink: "#18120F",
    muted: "#6F5A50",
    border: "rgba(24, 18, 15, 0.16)",
    teal: "#00A88E",
    tealSoft: "#D9FFF5",
    coral: "#FF4F59",
    coralSoft: "#FFE0DD",
    amber: "#FF9F1C",
    amberSoft: "#FFE7A8",
    green: "#19B96F",
    greenSoft: "#D8FFE5",
    purple: "#7B5CFF",
    purpleSoft: "#ECE5FF",
    blue: "#208BFF",
    blueSoft: "#DDF0FF",
    sage: "#EAF5DA",
    mint: "#B8FFE8",
    peach: "#FFBE8A",
    butter: "#FFF06A",
    danger: "#C81622",
    overlay: "rgba(24, 18, 15, 0.1)",
  },
  matcha: {
    background: "#FFF9F0",
    surface: "#FFFFFF",
    surfaceMuted: "#F2F6EC",
    ink: "#27322B",
    muted: "#6F7B70",
    border: "rgba(74, 95, 78, 0.13)",
    teal: "#59A98B",
    tealSoft: "#DFF8ED",
    coral: "#E88979",
    coralSoft: "#FFE7DF",
    amber: "#D9A534",
    amberSoft: "#FFF2C7",
    green: "#4E9B68",
    greenSoft: "#DFF8ED",
    purple: "#6E7BEA",
    purpleSoft: "#E9EEFF",
    blue: "#4A9BDA",
    blueSoft: "#E1F3FF",
    sage: "#EAF5EA",
    mint: "#D8F7E6",
    peach: "#FFE5D8",
    butter: "#FFF2BF",
    danger: "#A5362D",
    overlay: "rgba(39, 50, 43, 0.08)",
  },
  y2k: {
    background: "#FFF9F0",
    surface: "#FFFFFF",
    surfaceMuted: "#EEF8EE",
    ink: "#25372F",
    muted: "#718078",
    border: "rgba(61, 106, 84, 0.13)",
    teal: "#49A88D",
    tealSoft: "#DCF8EC",
    coral: "#EC7C93",
    coralSoft: "#FFE6E9",
    amber: "#E7A83E",
    amberSoft: "#FFF2C7",
    green: "#4CA477",
    greenSoft: "#DDF7E8",
    purple: "#6E7BEA",
    purpleSoft: "#E9EEFF",
    blue: "#4A9BDA",
    blueSoft: "#E1F3FF",
    sage: "#EAF5EA",
    mint: "#D8F7E6",
    peach: "#FFE5D8",
    butter: "#FFF2BF",
    danger: "#D00000",
    overlay: "rgba(37, 55, 47, 0.08)",
  }
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const radii = {
  sm: 14,
  md: 22,
  lg: 30,
  xl: 38,
};

// Fallback static export for unmigrated components
export const colors = palettes.light;

export const typography = {
  title: {
    fontSize: 38,
    lineHeight: 42,
    fontWeight: "900" as const,
    color: colors.ink,
  },
  h1: {
    fontSize: 28,
    lineHeight: 33,
    fontWeight: "900" as const,
    color: colors.ink,
  },
  h2: {
    fontSize: 20,
    lineHeight: 25,
    fontWeight: "900" as const,
    color: colors.ink,
  },
  body: {
    fontSize: 16,
    lineHeight: 22,
    color: colors.ink,
  },
  small: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.muted,
  },
};

type ThemeContextType = {
  themeName: string;
  colors: ThemeColors;
  setTheme: (name: string) => void;
};

const ThemeContext = createContext<ThemeContextType>({
  themeName: 'light',
  colors: palettes.light,
  setTheme: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeName, setThemeName] = useState('light');

  useEffect(() => {
    async function loadTheme() {
      try {
        const savedTheme = await AsyncStorage.getItem('app_theme');
        if (savedTheme && palettes[savedTheme]) {
          setThemeName(savedTheme);
        }
      } catch (e) {
        // Ignore load error
      }
    }
    loadTheme();
  }, []);

  const handleSetTheme = async (name: string) => {
    setThemeName(name);
    try {
      await AsyncStorage.setItem('app_theme', name);
    } catch (e) {
      // Ignore save error
    }
  };

  const themeColors = palettes[themeName] || palettes.light;

  return (
    <ThemeContext.Provider value={{ themeName, colors: themeColors, setTheme: handleSetTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
