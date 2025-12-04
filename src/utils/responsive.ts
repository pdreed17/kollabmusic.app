/**
 * Responsive Design Utilities
 *
 * Provides screen size detection and responsive scaling for different device sizes
 */

import { Dimensions, Platform } from 'react-native'

// Get initial screen dimensions
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window')

// Device size breakpoints
export const BREAKPOINTS = {
  small: 380,   // iPhone SE, Mini
  medium: 430,  // Standard iPhones
  large: 480,   // Pro Max, Plus models
}

// Device type detection
export const isSmallDevice = SCREEN_WIDTH < BREAKPOINTS.small
export const isMediumDevice = SCREEN_WIDTH >= BREAKPOINTS.small && SCREEN_WIDTH < BREAKPOINTS.medium
export const isLargeDevice = SCREEN_WIDTH >= BREAKPOINTS.medium

// Screen dimensions
export const screenWidth = SCREEN_WIDTH
export const screenHeight = SCREEN_HEIGHT

/**
 * Scale factor based on screen width
 * iPhone SE (375) = 0.85x
 * iPhone 13/14 (390) = 0.93x
 * iPhone 15 Pro Max (430) = 1.0x
 */
const baseWidth = 430 // iPhone Pro Max as baseline
export const scaleFactor = SCREEN_WIDTH / baseWidth

/**
 * Scale a value based on screen width
 */
export const scale = (size: number): number => {
  return Math.round(size * scaleFactor)
}

/**
 * Moderately scale a value (less aggressive scaling)
 * Good for padding and margins
 */
export const moderateScale = (size: number, factor: number = 0.5): number => {
  return Math.round(size + (scale(size) - size) * factor)
}

/**
 * Vertical scale based on screen height
 */
export const verticalScale = (size: number): number => {
  const baseHeight = 932 // iPhone Pro Max height
  return Math.round((SCREEN_HEIGHT / baseHeight) * size)
}

/**
 * Responsive spacing values
 * Automatically scales based on device size
 */
export const responsiveSpacing = {
  xxs: scale(2),
  xs: scale(4),
  sm: scale(8),
  md: scale(16),
  lg: scale(24),
  xl: scale(32),
  xxl: scale(48),
  xxxl: scale(64),
}

/**
 * Responsive font sizes
 * Scales down on smaller devices
 */
export const responsiveFontSizes = {
  tiny: scale(10),
  caption: scale(12),
  body: scale(14),
  bodyLarge: scale(16),
  h3: scale(18),
  h2: scale(24),
  h1: scale(32),
  hero: scale(40),
}

/**
 * Responsive icon sizes
 */
export const responsiveIconSizes = {
  xs: scale(12),
  sm: scale(16),
  md: scale(20),
  lg: scale(24),
  xl: scale(32),
  xxl: scale(48),
}

/**
 * Get responsive value based on device size
 * @param small - Value for small devices
 * @param medium - Value for medium devices
 * @param large - Value for large devices
 */
export const getResponsiveValue = <T,>(
  small: T,
  medium: T,
  large?: T
): T => {
  if (isSmallDevice) return small
  if (isMediumDevice) return medium
  return large ?? medium
}

/**
 * Device info for debugging
 */
export const deviceInfo = {
  width: SCREEN_WIDTH,
  height: SCREEN_HEIGHT,
  isSmall: isSmallDevice,
  isMedium: isMediumDevice,
  isLarge: isLargeDevice,
  scaleFactor,
  platform: Platform.OS,
}

/**
 * Hook to get current window dimensions (updates on rotation)
 */
export { useWindowDimensions } from 'react-native'
