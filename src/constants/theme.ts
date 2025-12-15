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
  textTertiary: '#8B8B8B', // Improved from #6B7280 for 4.5:1 contrast ratio

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

// Shadow Presets - Add depth to cards and components
export const Shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  // Glow effect for primary elements
  glow: (color: string = Colors.primary) => ({
    shadowColor: color,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  }),
}

// Gradient Presets - For premium visual feel
export const Gradients = {
  primary: ['#6366F1', '#4F46E5'],
  primaryLight: ['#818CF8', '#6366F1'],
  surface: ['#262626', '#1A1A1A'],
  card: ['#303030', '#262626'],
  cardHighlight: ['#3A3A3A', '#303030'],
  // Stem gradients for audio tracks
  vocals: ['#FBBF24', '#F59E0B'],
  drums: ['#F87171', '#EF4444'],
  bass: ['#A78BFA', '#8B5CF6'],
  guitar: ['#34D399', '#10B981'],
  keys: ['#60A5FA', '#3B82F6'],
  synth: ['#F472B6', '#EC4899'],
}

// Animation Constants - Consistent timing across the app
export const Animation = {
  duration: {
    instant: 100,
    fast: 200,
    normal: 300,
    slow: 500,
  },
  spring: {
    snappy: { damping: 20, stiffness: 300 },
    bouncy: { damping: 15, stiffness: 150 },
    smooth: { damping: 25, stiffness: 200 },
  },
  // For NavigationPill and similar components
  pill: {
    friction: 8,
    tension: 100,
  },
}

// Responsive Typography - scales based on screen size
// Letter spacing: tighter for large text, looser for small text
export const Typography = {
  hero: {
    fontSize: scale(32),
    fontWeight: '700' as const,
    letterSpacing: -0.5,
  },
  h1: {
    fontSize: scale(24),
    fontWeight: '600' as const,
    letterSpacing: -0.3,
  },
  h2: {
    fontSize: scale(20),
    fontWeight: '600' as const,
    letterSpacing: -0.2,
  },
  h3: {
    fontSize: scale(18),
    fontWeight: '500' as const,
    letterSpacing: -0.1,
  },
  bodyLarge: {
    fontSize: scale(16),
    fontWeight: '400' as const,
    letterSpacing: 0,
  },
  body: {
    fontSize: scale(14),
    fontWeight: '400' as const,
    letterSpacing: 0.1,
  },
  caption: {
    fontSize: scale(12),
    fontWeight: '500' as const,
    letterSpacing: 0.3,
  },
  tiny: {
    fontSize: scale(10),
    fontWeight: '500' as const,
    letterSpacing: 0.4,
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