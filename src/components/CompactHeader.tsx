import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/theme';
import { verticalScale, scale, moderateScale } from '../utils/responsive';

interface CompactHeaderProps {
  title: string;
  subtitle?: string;
  onBack: () => void;
  rightButton?: {
    icon: keyof typeof Ionicons.glyphMap;
    onPress: () => void;
  };
}

export default function CompactHeader({
  title,
  subtitle,
  onBack,
  rightButton
}: CompactHeaderProps) {
  return (
    <View style={styles.container}>
      {/* Back Button */}
      <TouchableOpacity
        style={styles.backButton}
        onPress={onBack}
        activeOpacity={0.7}
      >
        <Ionicons name="arrow-back" size={24} color={Colors.primary} />
      </TouchableOpacity>

      {/* Title & Subtitle */}
      <View style={styles.titleContainer}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {subtitle && (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        )}
      </View>

      {/* Optional Right Button */}
      {rightButton && (
        <TouchableOpacity
          style={styles.rightButton}
          onPress={rightButton.onPress}
          activeOpacity={0.7}
        >
          <Ionicons name={rightButton.icon} size={24} color={Colors.primary} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: verticalScale(52),
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: scale(16),
    backgroundColor: Colors.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backButton: {
    marginRight: scale(12),
    padding: scale(4),
    zIndex: 1,
  },
  titleContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    justifyContent: 'center',
    alignItems: 'center',
    pointerEvents: 'none',
  },
  title: {
    fontSize: moderateScale(16),
    fontWeight: '600',
    color: Colors.text,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: moderateScale(11),
    color: Colors.textSecondary,
    marginTop: scale(2),
    textAlign: 'center',
  },
  rightButton: {
    marginLeft: 'auto',
    padding: scale(4),
    zIndex: 1,
  },
});
