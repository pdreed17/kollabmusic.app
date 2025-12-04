/**
 * Header Component - Standard header template for all screens
 *
 * Design Principles:
 * - Primary purple (#6366F1) color for title and icons
 * - Clean, modern styling with subtle borders (rgba)
 * - Consistent spacing and typography
 * - Support for title + subtitle combinations
 *
 * Usage Examples:
 *
 * 1. Basic header with back button:
 *    <Header
 *      title="My Screen"
 *      subtitle="Screen Description"
 *      variant="compact"
 *      showBack
 *      onBack={() => navigation.goBack()}
 *    />
 *
 * 2. Header with custom right button:
 *    <Header
 *      title="Settings"
 *      variant="compact"
 *      showBack
 *      onBack={() => navigation.goBack()}
 *      rightButton={{
 *        icon: "settings-outline",
 *        onPress: () => handleSettings()
 *      }}
 *    />
 *
 * 3. Large header with profile:
 *    <Header
 *      title="My Projects"
 *      variant="large"
 *      showProfile
 *      onProfilePress={() => navigation.navigate('Profile')}
 *    />
 *
 * 4. Logo header (for home screen):
 *    <Header
 *      variant="logo"
 *      showProfile
 *      onProfilePress={() => navigation.navigate('Profile')}
 *    />
 */

import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Colors, Typography, Spacing } from '../constants/theme'

interface HeaderProps {
  title?: string
  subtitle?: string
  variant?: 'large' | 'compact' | 'logo'
  showBack?: boolean
  onBack?: () => void
  showProfile?: boolean
  onProfilePress?: () => void
  profilePhotoUrl?: string | null
  leftButton?: {
    icon?: string
    onPress?: () => void
    component?: React.ReactNode
  }
  rightButton?: {
    icon?: string
    onPress?: () => void
    component?: React.ReactNode
  }
}

export default function Header({
  title,
  subtitle,
  variant = 'large',
  showBack = false,
  onBack,
  showProfile = false,
  onProfilePress,
  profilePhotoUrl,
  leftButton,
  rightButton
}: HeaderProps) {
  // Logo variant (for HomeScreen)
  if (variant === 'logo') {
    return (
      <View style={styles.headerLogo}>
        {/* Left Button */}
        <View style={styles.leftSection}>
          {leftButton && leftButton.component}
        </View>

        {/* Logo */}
        <View style={styles.logoContainer}>
          <Image 
            source={require('../../assets/logo-wordmark.png')}
            style={styles.logoWordmark}
            resizeMode="contain"
          />
        </View>

        {/* Right: Profile */}
        <View style={styles.rightSection}>
          {showProfile && (
            <TouchableOpacity style={styles.iconButton} onPress={onProfilePress}>
              {profilePhotoUrl ? (
                <Image
                  source={{ uri: profilePhotoUrl }}
                  style={styles.profilePhoto}
                />
              ) : (
                <Ionicons name="person-circle-outline" size={40} color={Colors.primary} />
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>
    )
  }

  // Standard variant (large or compact) - Your design style
  return (
    <View style={[styles.header, variant === 'large' && styles.headerLarge]}>
      {/* Left: Back Button or Custom */}
      <View style={styles.leftSection}>
        {showBack ? (
          <TouchableOpacity style={styles.iconButton} onPress={onBack}>
            <Ionicons name="arrow-back" size={26} color={Colors.primary} />
          </TouchableOpacity>
        ) : leftButton?.component ? (
          leftButton.component
        ) : leftButton?.icon ? (
          <TouchableOpacity style={styles.iconButton} onPress={leftButton.onPress}>
            <Ionicons name={leftButton.icon as any} size={26} color={Colors.primary} />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Center: Title & Subtitle */}
      <View style={styles.centerSection}>
        {title && (
          <>
            <Text
              style={variant === 'large' ? styles.titleLarge : styles.titleCompact}
              numberOfLines={1}
            >
              {title}
            </Text>
            {subtitle && (
              <Text style={styles.subtitle} numberOfLines={1}>
                {subtitle}
              </Text>
            )}
          </>
        )}
      </View>

      {/* Right: Profile or Custom */}
      <View style={styles.rightSection}>
        {showProfile ? (
          <TouchableOpacity style={styles.iconButton} onPress={onProfilePress}>
            {profilePhotoUrl ? (
              <Image
                source={{ uri: profilePhotoUrl }}
                style={styles.profilePhoto}
              />
            ) : (
              <Ionicons name="person-circle-outline" size={40} color={Colors.primary} />
            )}
          </TouchableOpacity>
        ) : rightButton?.component ? (
          rightButton.component
        ) : rightButton?.icon ? (
          <TouchableOpacity style={styles.iconButton} onPress={rightButton.onPress}>
            <Ionicons name={rightButton.icon as any} size={26} color={Colors.primary} />
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.lg,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
    minHeight: 88,
  },
  headerLarge: {
    minHeight: 104,
    paddingTop: Spacing.xxl,
    paddingBottom: Spacing.xl,
  },
  headerLogo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.lg,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
    minHeight: 96,
  },
  leftSection: {
    width: 56,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  centerSection: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
  },
  rightSection: {
    width: 56,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  titleLarge: {
    fontSize: 34,
    fontWeight: '700',
    color: Colors.primary,
    letterSpacing: -0.5,
  },
  titleCompact: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.primary,
  },
  subtitle: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 4,
  },
  iconButton: {
    padding: Spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoWordmark: {
    width: 240,
    height: 60,
  },
  profilePhoto: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: Colors.primary,
  },
})