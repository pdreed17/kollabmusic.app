import { scale, moderateScale } from '../utils/responsive'

export const Colors = {
  // Primary
  primary: '#6366F1',
  primaryDark: '#4F46E5',
  primaryLight: '#818CF8',

  // Backgrounds
  backgroundDark: '#0F0F0F',
  background: '#1A1A1A',
  surface: '#262626',
  surfaceElevated: '#303030',
  border: '#404040',

  // Text
  text: '#FFFFFF',
  textSecondary: '#9CA3AF',
  textTertiary: '#6B7280',

  // Stem Colors
  vocals: '#F59E0B',
  drums: '#EF4444',
  bass: '#8B5CF6',
  guitar: '#10B981',
  keys: '#3B82F6',
  synth: '#EC4899',

  // Semantic
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
  info: '#3B82F6',
}

// Responsive Typography - scales based on screen size
export const Typography = {
  hero: {
    fontSize: scale(32),
    fontWeight: '700' as const,
  },
  h1: {
    fontSize: scale(24),
    fontWeight: '600' as const,
  },
  h2: {
    fontSize: scale(20),
    fontWeight: '600' as const,
  },
  h3: {
    fontSize: scale(18),
    fontWeight: '500' as const,
  },
  bodyLarge: {
    fontSize: scale(16),
    fontWeight: '400' as const,
  },
  body: {
    fontSize: scale(14),
    fontWeight: '400' as const,
  },
  caption: {
    fontSize: scale(12),
    fontWeight: '500' as const,
  },
  tiny: {
    fontSize: scale(10),
    fontWeight: '500' as const,
  },
}

// Responsive Spacing - uses moderate scale for padding/margins
export const Spacing = {
  xxs: moderateScale(4),
  xs: moderateScale(8),
  sm: moderateScale(12),
  md: moderateScale(16),
  lg: moderateScale(24),
  xl: moderateScale(32),
  xxl: moderateScale(48),
  xxxl: moderateScale(64),
}

// Border Radius - slight responsive scaling
export const BorderRadius = {
  sm: moderateScale(8),
  md: moderateScale(12),
  lg: moderateScale(16),
  xl: moderateScale(24),
  full: 999,
}