import React, { createContext, useContext, ReactNode, useState, useEffect } from "react";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppStore } from './store/appStore';

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
  dangerSoft: string;
  brandAccent: string;
  overlay: string;
  activeTabBg: string;
  activeTabIcon: string;
};

export const palettes: Record<string, ThemeColors> = {
  classic: {
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
    dangerSoft: "#FFE3E5",
    brandAccent: "#FF9F1C",
    overlay: "rgba(24, 18, 15, 0.1)",
    activeTabBg: "#FFE0DD",
    activeTabIcon: "#FF4F59",
  },
  monochrome: {
    background: "#F5F5F5",
    surface: "#FFFFFF",
    surfaceMuted: "#E0E0E0",
    ink: "#121212",
    muted: "#757575",
    border: "rgba(18, 18, 18, 0.12)",
    teal: "#333333",
    tealSoft: "#E0E0E0",
    coral: "#000000",
    coralSoft: "#E0E0E0",
    amber: "#666666",
    amberSoft: "#F0F0F0",
    green: "#4D4D4D",
    greenSoft: "#E8E8E8",
    purple: "#1A1A1A",
    purpleSoft: "#D4D4D4",
    blue: "#2B2B2B",
    blueSoft: "#DBDBDB",
    sage: "#595959",
    mint: "#CCCCCC",
    peach: "#404040",
    butter: "#E6E6E6",
    danger: "#C81622",
    dangerSoft: "#FFE3E5",
    brandAccent: "#666666",
    overlay: "rgba(0, 0, 0, 0.6)",
    activeTabBg: "#E0E0E0",
    activeTabIcon: "#000000",
  },
  pinkBlossom: {
    background: "#FFF5F7",
    surface: "#FFFFFF",
    surfaceMuted: "#FFEBF0",
    ink: "#32272B",
    muted: "#9E8A90",
    border: "rgba(92, 67, 74, 0.12)",
    teal: "#F28FB0",
    tealSoft: "#FDE2EA",
    coral: "#FFB6C1",
    coralSoft: "#FFF0F3",
    amber: "#FADADD",
    amberSoft: "#FFF5F5",
    green: "#A0D8B3",
    greenSoft: "#E6F5EB",
    purple: "#D1B3DF",
    purpleSoft: "#F4ECF7",
    blue: "#AEC6CF",
    blueSoft: "#EBF1F5",
    sage: "#D8E2DC",
    mint: "#C6E2E9",
    peach: "#FFDAC1",
    butter: "#FFF3CD",
    danger: "#C81622",
    dangerSoft: "#FFE3E5",
    brandAccent: "#FADADD",
    overlay: "rgba(92, 67, 74, 0.08)",
    activeTabBg: "#FFE1E9",
    activeTabIcon: "#7A3044",
  },
  softHorizon: {
    background: "#F5F8FF",
    surface: "#FFFFFF",
    surfaceMuted: "#EBF2FF",
    ink: "#29313D",
    muted: "#8A949E",
    border: "rgba(67, 77, 92, 0.12)",
    teal: "#8FB2F2",
    tealSoft: "#E2EDFD",
    coral: "#5D8DF5",
    coralSoft: "#E7EFFF",
    amber: "#C98920",
    amberSoft: "#F5F8FF",
    green: "#2F9F6B",
    greenSoft: "#E6F5EB",
    purple: "#D1B3DF",
    purpleSoft: "#F4ECF7",
    blue: "#AEC6CF",
    blueSoft: "#EBF1F5",
    sage: "#D8E2DC",
    mint: "#C6E2E9",
    peach: "#FFDAC1",
    butter: "#FFF3CD",
    danger: "#C81622",
    dangerSoft: "#FFE3E5",
    brandAccent: "#DAE8FA",
    overlay: "rgba(67, 77, 92, 0.08)",
    activeTabBg: "#F0F5FF",
    activeTabIcon: "#B6CFFF",
  },
  pearGarden: {
    background: "#F6FBF7",
    surface: "#FFFFFF",
    surfaceMuted: "#EBF7F0",
    ink: "#20342A",
    muted: "#8A9E92",
    border: "rgba(67, 92, 76, 0.12)",
    teal: "#8FC9A3",
    tealSoft: "#E2F5E9",
    coral: "#A9DEC0",
    coralSoft: "#F0FAF4",
    amber: "#FF9F1C",
    amberSoft: "#FFE7A8",
    green: "#A0D8B3",
    greenSoft: "#E6F5EB",
    purple: "#D1B3DF",
    purpleSoft: "#EFE5FF",
    blue: "#AEC6CF",
    blueSoft: "#DDEBFF",
    sage: "#D8E2DC",
    mint: "#E7F0D5",
    peach: "#FFD9C7",
    butter: "#FFF0BF",
    danger: "#C81622",
    dangerSoft: "#FFE3E5",
    brandAccent: "#C4E8D1",
    overlay: "rgba(67, 92, 76, 0.08)",
    activeTabBg: "#DDF4E6",
    activeTabIcon: "#245C3A",
  },
  lavenderHaze: {
    background: "#FAF5FF",
    surface: "#FFFFFF",
    surfaceMuted: "#F3E8FF",
    ink: "#2E2735",
    muted: "#938A9E",
    border: "rgba(79, 67, 92, 0.12)",
    teal: "#C4B5FD",
    tealSoft: "#EDE9FE",
    coral: "#D8B4FE",
    coralSoft: "#F3E8FF",
    amber: "#E9D5FF",
    amberSoft: "#FAF5FF",
    green: "#A0D8B3",
    greenSoft: "#E6F5EB",
    purple: "#D1B3DF",
    purpleSoft: "#F4ECF7",
    blue: "#AEC6CF",
    blueSoft: "#EBF1F5",
    sage: "#D8E2DC",
    mint: "#C6E2E9",
    peach: "#FFDAC1",
    butter: "#FFF3CD",
    danger: "#C81622",
    dangerSoft: "#FFE3E5",
    brandAccent: "#E9D5FF",
    overlay: "rgba(79, 67, 92, 0.08)",
    activeTabBg: "#EEE4FF",
    activeTabIcon: "#4E2E7A",
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
export const colors = palettes.classic;

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
  themeName: 'classic',
  colors: palettes.classic,
  setTheme: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const profile = useAppStore((state) => state.profile);
  const [themeName, setThemeName] = useState('classic');

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

  const effectiveThemeName = profile ? themeName : 'classic';
  const themeColors = palettes[effectiveThemeName] || palettes.classic;

  return (
    <ThemeContext.Provider value={{ themeName: effectiveThemeName, colors: themeColors, setTheme: handleSetTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
