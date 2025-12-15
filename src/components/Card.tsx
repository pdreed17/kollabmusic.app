import React from 'react'
import {
  View,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { Colors, Spacing, BorderRadius, Shadows, Gradients } from '../constants/theme'

type CardVariant = 'default' | 'elevated' | 'outlined' | 'gradient'
type CardSize = 'sm' | 'md' | 'lg'

interface CardProps {
  children: React.ReactNode
  variant?: CardVariant
  size?: CardSize
  onPress?: () => void
  style?: ViewStyle
  highlighted?: boolean
  highlightColor?: string
}

export default function Card({
  children,
  variant = 'default',
  size = 'md',
  onPress,
  style,
  highlighted = false,
  highlightColor = Colors.primary,
}: CardProps) {
  const getVariantStyles = (): ViewStyle => {
    switch (variant) {
      case 'default':
        return {
          backgroundColor: Colors.surface,
          borderWidth: 1,
          borderColor: Colors.border,
          ...Shadows.sm,
        }
      case 'elevated':
        return {
          backgroundColor: Colors.surfaceElevated,
          borderWidth: 1,
          borderColor: Colors.border,
          // Subtle top border highlight for depth
          borderTopWidth: 1,
          borderTopColor: 'rgba(255,255,255,0.05)',
          ...Shadows.md,
        }
      case 'outlined':
        return {
          backgroundColor: 'transparent',
          borderWidth: 1,
          borderColor: Colors.border,
        }
      case 'gradient':
        // Handled separately with LinearGradient
        return {}
      default:
        return {}
    }
  }

  const getSizeStyles = (): ViewStyle => {
    switch (size) {
      case 'sm':
        return {
          padding: Spacing.sm,
          borderRadius: BorderRadius.sm,
        }
      case 'md':
        return {
          padding: Spacing.md,
          borderRadius: BorderRadius.md,
        }
      case 'lg':
        return {
          padding: Spacing.lg,
          borderRadius: BorderRadius.lg,
        }
      default:
        return {}
    }
  }

  const getHighlightStyles = (): ViewStyle => {
    if (!highlighted) return {}
    return {
      borderWidth: 2,
      borderColor: highlightColor,
      ...Shadows.glow(highlightColor),
    }
  }

  const containerStyles = [
    styles.card,
    getVariantStyles(),
    getSizeStyles(),
    getHighlightStyles(),
    style,
  ]

  // Gradient variant uses LinearGradient
  if (variant === 'gradient') {
    const content = (
      <LinearGradient
        colors={Gradients.card as [string, string]}
        style={[
          styles.card,
          getSizeStyles(),
          getHighlightStyles(),
          Shadows.md,
          style,
        ]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      >
        {children}
      </LinearGradient>
    )

    if (onPress) {
      return (
        <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
          {content}
        </TouchableOpacity>
      )
    }
    return content
  }

  // Standard card
  if (onPress) {
    return (
      <TouchableOpacity
        style={containerStyles}
        onPress={onPress}
        activeOpacity={0.8}
      >
        {children}
      </TouchableOpacity>
    )
  }

  return <View style={containerStyles}>{children}</View>
}

// Convenience sub-components
export function CardHeader({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.header, style]}>{children}</View>
}

export function CardBody({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.body, style]}>{children}</View>
}

export function CardFooter({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.footer, style]}>{children}</View>
}

const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
  },
  header: {
    marginBottom: Spacing.sm,
  },
  body: {
    flex: 1,
  },
  footer: {
    marginTop: Spacing.sm,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
})
