/**
 * Sparsh design tokens: a calm clinical palette (light and dark), gradients, spacing and radii.
 * Every text/background pair here meets WCAG AA contrast (4.5:1).
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    /** Page behind the cards. */
    background: '#F6F8F9',
    /** Cards and sheets. */
    surface: '#FFFFFF',
    /** Inputs, chips and other recessed areas. */
    surfaceMuted: '#EDF3F4',
    border: '#D9E4E6',
    text: '#152B32',
    textSecondary: '#5A6B70',
    primary: '#086D76',
    primarySoft: '#D9F0F1',
    onPrimary: '#FFFFFF',
    tint: '#086D76',
    onTint: '#FFFFFF',
    backgroundElement: '#FFFFFF',
    backgroundSelected: '#D9E4E6',
    alertBackground: '#FEE2E2',
    alertBorder: '#FCA5A5',
    alertText: '#7F1D1D',
    // Risk levels: a strong color for text and icons, and a soft one for chip backgrounds.
    normal: '#047857',
    normalSoft: '#D1FAE5',
    attention: '#B45309',
    attentionSoft: '#FEF3C7',
    danger: '#B91C1C',
    dangerSoft: '#FEE2E2',
  },
  dark: {
    background: '#0B1220',
    surface: '#111A2E',
    surfaceMuted: '#1A2540',
    border: '#26324D',
    text: '#E2E8F0',
    textSecondary: '#94A3B8',
    primary: '#60A5FA',
    primarySoft: '#1E3A5F',
    onPrimary: '#0B1220',
    tint: '#60A5FA',
    onTint: '#0B1220',
    backgroundElement: '#111A2E',
    backgroundSelected: '#26324D',
    alertBackground: '#3B1A22',
    alertBorder: '#7F1D1D',
    alertText: '#FCA5A5',
    normal: '#34D399',
    normalSoft: '#12352F',
    attention: '#FBBF24',
    attentionSoft: '#3A2E12',
    danger: '#F87171',
    dangerSoft: '#3B1A22',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

/** White text stays readable across each gradient, in both light and dark mode. */
export const Gradients = {
  brand: { from: '#1D4ED8', to: '#0E7490' },
  danger: { from: '#DC2626', to: '#991B1B' },
} as const;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const Radius = {
  sm: 10,
  md: 14,
  lg: 20,
  xl: 28,
  pill: 999,
} as const;

export const MaxContentWidth = 720;
