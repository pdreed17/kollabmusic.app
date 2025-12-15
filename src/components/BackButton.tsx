import React, { useMemo } from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../constants/theme';
import { usePreferences } from '../contexts/PreferencesContext';
import { scale, verticalScale, isTablet } from '../utils/responsive';

const BUTTON_WIDTH = isTablet() ? scale(90) : scale(70);
const BUTTON_HEIGHT = isTablet() ? verticalScale(100) : verticalScale(80);
const ICON_SIZE = scale(24);
const CORNER_RADIUS = scale(16);

// Static styles (created once)
const staticStyles = StyleSheet.create({
  buttonBase: {
    position: 'absolute',
    width: BUTTON_WIDTH,
    height: BUTTON_HEIGHT,
    backgroundColor: Colors.surface,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: scale(16),
    borderWidth: 2,
    borderColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
  },
});

export default function BackButton() {
  const navigation = useNavigation();
  const route = useRoute();
  const { handedness } = usePreferences();
  const insets = useSafeAreaInsets();

  // Position on opposite side from NavigationPill
  const isOnLeft = handedness === 'right'; // If nav pill is right, back is left

  // Dynamic styles (created when handedness or insets change) - MUST be before early return
  const styles = useMemo(() => StyleSheet.create({
    button: {
      ...staticStyles.buttonBase,
      bottom: insets.bottom,
      [isOnLeft ? 'left' : 'right']: 0,
      [isOnLeft ? 'borderLeftWidth' : 'borderRightWidth']: 0,
      // Round only the far corner
      borderTopLeftRadius: isOnLeft ? 0 : CORNER_RADIUS,
      borderTopRightRadius: isOnLeft ? CORNER_RADIUS : 0,
      borderBottomLeftRadius: 0,
      borderBottomRightRadius: 0,
    },
  }), [handedness, isOnLeft, insets.bottom]);

  // Don't show on Home screen
  const isHomeScreen = route.name === 'Home';

  // Only show if we can go back AND we're not on Home screen
  const canGoBack = navigation.canGoBack();

  if (!canGoBack || isHomeScreen) {
    return null;
  }

  return (
    <TouchableOpacity
      style={styles.button}
      onPress={() => navigation.goBack()}
      activeOpacity={0.7}
    >
      <Ionicons
        name="arrow-back"
        size={ICON_SIZE}
        color={Colors.primary}
      />
    </TouchableOpacity>
  );
}
