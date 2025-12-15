import React from 'react'
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  View,
  Pressable,
  ViewStyle,
  TextStyle,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Colors, Typography, Spacing, BorderRadius, Shadows, Animation } from '../constants/theme'
import { scale } from '../utils/responsive'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive'
type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps {
  title: string
  onPress: () => void
  variant?: ButtonVariant
  size?: ButtonSize
  leftIcon?: keyof typeof Ionicons.glyphMap
  rightIcon?: keyof typeof Ionicons.glyphMap
  loading?: boolean
  disabled?: boolean
  fullWidth?: boolean
  style?: ViewStyle
  textStyle?: TextStyle
}

export default function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  leftIcon,
  rightIcon,
  loading = false,
  disabled = false,
  fullWidth = false,
  style,
  textStyle,
}: ButtonProps) {
  const isDisabled = disabled || loading

  const getVariantStyles = (): ViewStyle => {
    switch (variant) {
      case 'primary':
        return {
          backgroundColor: Colors.primary,
          borderColor: Colors.primary,
          ...Shadows.glow(Colors.primary),
        }
      case 'secondary':
        return {
          backgroundColor: Colors.surfaceElevated,
          borderColor: Colors.border,
          borderWidth: 1,
          ...Shadows.sm,
        }
      case 'ghost':
        return {
          backgroundColor: 'transparent',
          borderColor: 'transparent',
        }
      case 'destructive':
        return {
          backgroundColor: Colors.error,
          borderColor: Colors.error,
          ...Shadows.glow(Colors.error),
        }
      default:
        return {}
    }
  }

  const getSizeStyles = (): ViewStyle => {
    switch (size) {
      case 'sm':
        return {
          paddingVertical: Spacing.xs,
          paddingHorizontal: Spacing.md,
          minHeight: scale(36),
        }
      case 'md':
        return {
          paddingVertical: Spacing.sm,
          paddingHorizontal: Spacing.lg,
          minHeight: scale(48),
        }
      case 'lg':
        return {
          paddingVertical: Spacing.md,
          paddingHorizontal: Spacing.xl,
          minHeight: scale(56),
        }
      default:
        return {}
    }
  }

  const getTextColor = (): string => {
    if (isDisabled) return Colors.textTertiary
    switch (variant) {
      case 'primary':
      case 'destructive':
        return Colors.text
      case 'secondary':
        return Colors.text
      case 'ghost':
        return Colors.primary
      default:
        return Colors.text
    }
  }

  const getIconSize = (): number => {
    switch (size) {
      case 'sm':
        return scale(16)
      case 'md':
        return scale(20)
      case 'lg':
        return scale(24)
      default:
        return scale(20)
    }
  }

  const getTextStyle = (): TextStyle => {
    switch (size) {
      case 'sm':
        return Typography.body
      case 'md':
        return Typography.bodyLarge
      case 'lg':
        return Typography.h3
      default:
        return Typography.bodyLarge
    }
  }

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.button,
        getVariantStyles(),
        getSizeStyles(),
        fullWidth && styles.fullWidth,
        isDisabled && styles.disabled,
        pressed && !isDisabled && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={getTextColor()} size="small" />
      ) : (
        <View style={styles.content}>
          {leftIcon && (
            <Ionicons
              name={leftIcon}
              size={getIconSize()}
              color={getTextColor()}
              style={styles.leftIcon}
            />
          )}
          <Text
            style={[
              getTextStyle(),
              styles.text,
              { color: getTextColor() },
              textStyle,
            ]}
          >
            {title}
          </Text>
          {rightIcon && (
            <Ionicons
              name={rightIcon}
              size={getIconSize()}
              color={getTextColor()}
              style={styles.rightIcon}
            />
          )}
        </View>
      )}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  button: {
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  fullWidth: {
    width: '100%',
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    transform: [{ scale: 0.97 }],
    opacity: 0.9,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontWeight: '600',
  },
  leftIcon: {
    marginRight: Spacing.xs,
  },
  rightIcon: {
    marginLeft: Spacing.xs,
  },
})
