import React from 'react'
import { View, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Colors, BorderRadius } from '../constants/theme'

interface ProjectIconProps {
  size?: 'small' | 'medium' | 'large'
  genre?: string
}

export default function ProjectIcon({ size = 'medium', genre }: ProjectIconProps) {
  const dimensions = {
    small: { width: 36, height: 36, iconSize: 18 },
    medium: { width: 48, height: 48, iconSize: 24 },
    large: { width: 64, height: 64, iconSize: 32 },
  }

  const { width, height, iconSize } = dimensions[size]

  return (
    <View style={[
      styles.container,
      {
        width,
        height,
        borderRadius: width / 2,
      }
    ]}>
      <Ionicons name="musical-notes" size={iconSize} color={Colors.primary} />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: `${Colors.primary}20`,
    justifyContent: 'center',
    alignItems: 'center',
  },
})