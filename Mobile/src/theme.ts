import { I18nManager, Platform } from 'react-native';

/** Bright, saturated accents on a clean light background — playful and easy to read. */
export const C = {
  bg: '#FFFCF5',
  ink: '#1D3229',
  sub: '#55685F',
  mute: '#8C9A92',
  line: 'rgba(29,50,41,0.10)',
  white: '#FFFFFF',
  green: '#58CC02',
  greenDark: '#46A302',
  greenSoft: '#D7FFB8',
  red: '#FF4B4B',
  redDark: '#D93636',
  redSoft: '#FFDFE0',
  gold: '#FFC800',
  goldDark: '#D99A00',
  goldSoft: '#FFF4CC',
  blue: '#1CB0F6',
  blueSoft: '#DDF4FF',
  lock: '#D3D9D4',
  lockDark: '#B4BEB7',
  surface: 'rgba(255,255,255,0.72)',
  surfaceStrong: 'rgba(255,255,255,0.9)',
  hairline: 'rgba(255,255,255,0.9)',
};

/** Thmanyah Serif Text, one family name per weight (never combined with fontWeight). */
export const F = {
  light: 'Thmanyah-Light',
  regular: 'Thmanyah-Regular',
  medium: 'Thmanyah-Medium',
  bold: 'Thmanyah-Bold',
  black: 'Thmanyah-Black',
};

export const FONT_FILES = {
  [F.light]: require('../assets/fonts/thmanyah-serif-text-light.otf'),
  [F.regular]: require('../assets/fonts/thmanyah-serif-text-regular.otf'),
  [F.medium]: require('../assets/fonts/thmanyah-serif-text-medium.otf'),
  [F.bold]: require('../assets/fonts/thmanyah-serif-text-bold.otf'),
  [F.black]: require('../assets/fonts/thmanyah-serif-text-black.otf'),
};

/** English text uses the platform UI font (SF Pro on iOS, Roboto on Android). */
export const EN_FONT = Platform.select({ web: 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif', default: undefined });

/*
 * The interface is always Arabic-first, whatever the device language is. React Native mirrors
 * rows and text alignment when the device itself is RTL, so every direction goes through these
 * constants instead of literal 'row' / 'right'.
 */
const mirrored = I18nManager.isRTL;
/** Row whose first child sits on the right (Arabic reading order). */
export const ROW = (mirrored ? 'row' : 'row-reverse') as 'row' | 'row-reverse';
/** Row whose first child sits on the left (English reading order). */
export const ROW_EN = (mirrored ? 'row-reverse' : 'row') as 'row' | 'row-reverse';
/** textAlign value that lands on the physical right / left edge. */
export const RIGHT = (mirrored ? 'left' : 'right') as 'left' | 'right';
export const LEFT = (mirrored ? 'right' : 'left') as 'left' | 'right';
/** alignItems / alignSelf values for the physical right / left edge of a column. */
export const AT_RIGHT = (mirrored ? 'flex-start' : 'flex-end') as 'flex-start' | 'flex-end';
export const AT_LEFT = (mirrored ? 'flex-end' : 'flex-start') as 'flex-start' | 'flex-end';

export const R = { sm: 12, md: 18, lg: 24, xl: 32, pill: 999 };

export const shadow = (depth: 1 | 2 | 3 = 2) =>
  Platform.select({
    web: { boxShadow: `0 ${depth * 6}px ${depth * 14}px rgba(29,50,41,${0.05 + depth * 0.025})` } as object,
    android: { elevation: depth * 3, shadowColor: '#1D3229' },
    default: {
      shadowColor: '#1D3229',
      shadowOpacity: 0.06 + depth * 0.03,
      shadowRadius: depth * 8,
      shadowOffset: { width: 0, height: depth * 4 },
    },
  }) as object;

/** Max content width so the phone layout also holds on tablets and the web preview. */
export const MAX_W = 460;
