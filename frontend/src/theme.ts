import { useColorScheme, StyleSheet } from "react-native";

export const palette = {
  light: {
    surface: "#FDFBF7",
    onSurface: "#1C1B1A",
    surfaceSecondary: "#FFFFFF",
    onSurfaceSecondary: "#1C1B1A",
    surfaceTertiary: "#F2EFE9",
    onSurfaceTertiary: "#4A4846",
    surfaceInverse: "#1C1B1A",
    onSurfaceInverse: "#FFFFFF",
    brand: "#2C5545",
    onBrand: "#FFFFFF",
    brandPrimary: "#2C5545",
    onBrandPrimary: "#FFFFFF",
    brandSecondary: "#3A705A",
    onBrandSecondary: "#FFFFFF",
    brandTertiary: "#E8F0EB",
    onBrandTertiary: "#2C5545",
    success: "#285C3F",
    onSuccess: "#FFFFFF",
    warning: "#B56D22",
    onWarning: "#FFFFFF",
    error: "#A13B3B",
    onError: "#FFFFFF",
    info: "#4A4846",
    onInfo: "#FFFFFF",
    border: "#E6E2DC",
    borderStrong: "#C2BCB3",
    divider: "#E6E2DC",
    muted: "#76736E",
  },
  dark: {
    surface: "#161514",
    onSurface: "#FDFBF7",
    surfaceSecondary: "#21201E",
    onSurfaceSecondary: "#FDFBF7",
    surfaceTertiary: "#2C2A28",
    onSurfaceTertiary: "#A3A09A",
    surfaceInverse: "#FDFBF7",
    onSurfaceInverse: "#1C1B1A",
    brand: "#508C73",
    onBrand: "#161514",
    brandPrimary: "#508C73",
    onBrandPrimary: "#161514",
    brandSecondary: "#68A88E",
    onBrandSecondary: "#161514",
    brandTertiary: "#1B3026",
    onBrandTertiary: "#68A88E",
    success: "#367A55",
    onSuccess: "#FDFBF7",
    warning: "#C97E2A",
    onWarning: "#FDFBF7",
    error: "#C24B4B",
    onError: "#FDFBF7",
    info: "#A3A09A",
    onInfo: "#161514",
    border: "#363330",
    borderStrong: "#54504C",
    divider: "#363330",
    muted: "#A3A09A",
  },
};

export type ThemeColors = typeof palette.light;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  "2xl": 32,
  "3xl": 48,
};

export const radius = {
  sm: 6,
  md: 12,
  lg: 20,
  pill: 999,
};

export const fontSize = {
  sm: 12,
  base: 14,
  lg: 16,
  xl: 20,
  "2xl": 24,
  "3xl": 30,
};

export interface Theme {
  colors: ThemeColors;
  spacing: typeof spacing;
  radius: typeof radius;
  fontSize: typeof fontSize;
  isDark: boolean;
}

export function useTheme(): Theme {
  const scheme = useColorScheme();
  const isDark = scheme === "dark";
  return {
    colors: isDark ? palette.dark : palette.light,
    spacing,
    radius,
    fontSize,
    isDark,
  };
}

type NamedStyles<T> = { [P in keyof T]: object };

export function makeStyles<T extends NamedStyles<T>>(
  factory: (theme: Theme) => T
) {
  return function useStyles(): T {
    const theme = useTheme();
    return StyleSheet.create(factory(theme));
  };
}
