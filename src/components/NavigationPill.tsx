import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  Platform,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../constants/theme';
import { useNavigation, useRoute } from '@react-navigation/native';
import { usePreferences } from '../contexts/PreferencesContext';
import { useAuth } from '../contexts/AuthContext';
import { useNavigationPill } from '../contexts/NavigationContext';
import { scale, verticalScale, isTablet } from '../utils/responsive';

const PILL_WIDTH = isTablet() ? scale(90) : scale(70);
const PILL_HEIGHT = isTablet() ? verticalScale(100) : verticalScale(80);
const ICON_SIZE = scale(24);
const CORNER_RADIUS = scale(16);

interface NavigationItem {
  name: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
}

const navigationItems: NavigationItem[] = [
  { name: 'Home', icon: 'home', label: 'Home' },
  { name: 'Projects', icon: 'folder-open', label: 'Projects' },
  { name: 'Activity', icon: 'notifications', label: 'Activity' },
  { name: 'Search', icon: 'search', label: 'Search' },
  { name: 'Profile', icon: 'person', label: 'Profile' },
];

// Static styles (created once, never change)
const staticStyles = StyleSheet.create({
  mainPillBase: {
    width: PILL_WIDTH,
    height: PILL_HEIGHT,
    backgroundColor: Colors.primary,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 16,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  expandedPillBase: {
    width: PILL_WIDTH,
    height: PILL_HEIGHT,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.primary,
    borderBottomWidth: 0,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 5,
  },
  profileImageBase: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: PILL_WIDTH,
    height: PILL_HEIGHT,
  },
});

export default function NavigationPill() {
  const { handedness } = usePreferences();
  const { userProfile } = useAuth();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute();
  const { isNavExpanded, setIsNavExpanded } = useNavigationPill();

  const expandAnimation = useRef(new Animated.Value(0)).current;
  const opacityAnimation = useRef(new Animated.Value(0)).current;

  const currentScreen = route.name;

  const currentItem = useMemo(() => {
    return navigationItems.find(item => item.name === currentScreen) || navigationItems[0];
  }, [currentScreen]);

  const otherItems = useMemo(() => {
    return navigationItems.filter(item => item.name !== currentScreen);
  }, [currentScreen]);

  // Sync animation with context state
  useEffect(() => {
    const toValue = isNavExpanded ? 1 : 0;

    Animated.parallel([
      Animated.spring(expandAnimation, {
        toValue,
        useNativeDriver: true,
        friction: 8,
        tension: 100,
      }),
      Animated.timing(opacityAnimation, {
        toValue,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, [isNavExpanded, expandAnimation, opacityAnimation]);

  const toggleExpanded = useCallback(() => {
    setIsNavExpanded(!isNavExpanded);
  }, [isNavExpanded, setIsNavExpanded]);

  const handleNavigate = useCallback((screenName: string) => {
    toggleExpanded();
    setTimeout(() => {
      navigation.navigate(screenName as never);
    }, 200);
  }, [navigation, toggleExpanded]);

  // Dynamic styles (created when handedness or insets change)
  const styles = useMemo(() => StyleSheet.create({
    container: {
      position: 'absolute',
      bottom: insets.bottom,
      [handedness === 'left' ? 'left' : 'right']: 0,
      alignItems: handedness === 'left' ? 'flex-start' : 'flex-end',
    },
    mainPill: {
      ...staticStyles.mainPillBase,
      borderTopLeftRadius: handedness === 'left' ? 0 : CORNER_RADIUS,
      borderTopRightRadius: handedness === 'right' ? 0 : CORNER_RADIUS,
      borderRightWidth: handedness === 'right' ? 0 : 2,
      borderLeftWidth: handedness === 'left' ? 0 : 2,
      borderTopWidth: 2,
      borderColor: Colors.primary,
    },
    expandedContainer: {
      position: 'absolute',
      bottom: PILL_HEIGHT + 8,
      [handedness === 'left' ? 'left' : 'right']: 0,
      gap: 8,
    },
    expandedPill: {
      ...staticStyles.expandedPillBase,
      borderTopLeftRadius: handedness === 'left' ? 0 : CORNER_RADIUS,
      borderTopRightRadius: handedness === 'right' ? 0 : CORNER_RADIUS,
      borderBottomLeftRadius: handedness === 'left' ? 0 : CORNER_RADIUS,
      borderBottomRightRadius: handedness === 'right' ? 0 : CORNER_RADIUS,
      borderRightWidth: handedness === 'right' ? 0 : 2,
      borderLeftWidth: handedness === 'left' ? 0 : 2,
    },
    profileImageMain: {
      ...staticStyles.profileImageBase,
      borderTopLeftRadius: handedness === 'left' ? 0 : CORNER_RADIUS,
      borderTopRightRadius: handedness === 'right' ? 0 : CORNER_RADIUS,
    },
    profileImageExpanded: {
      ...staticStyles.profileImageBase,
      borderTopLeftRadius: handedness === 'left' ? 0 : CORNER_RADIUS,
      borderTopRightRadius: handedness === 'right' ? 0 : CORNER_RADIUS,
      borderBottomLeftRadius: handedness === 'left' ? 0 : CORNER_RADIUS,
      borderBottomRightRadius: handedness === 'right' ? 0 : CORNER_RADIUS,
    },
  }), [handedness, insets.bottom]);

  return (
    <View style={styles.container}>
      {isNavExpanded && (
        <Animated.View
          style={[
            styles.expandedContainer,
            {
              opacity: opacityAnimation,
              transform: [
                {
                  translateY: expandAnimation.interpolate({
                    inputRange: [0, 1],
                    outputRange: [20, 0],
                  }),
                },
                {
                  scale: expandAnimation.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.8, 1],
                  }),
                },
              ],
            },
          ]}
        >
          {otherItems.map((item, index) => (
            <TouchableOpacity
              key={item.name}
              style={styles.expandedPill}
              onPress={() => handleNavigate(item.name)}
              activeOpacity={0.7}
            >
              {item.name === 'Profile' && userProfile?.avatar_url ? (
                <Image
                  source={{ uri: userProfile.avatar_url }}
                  style={styles.profileImageExpanded}
                  resizeMode="cover"
                />
              ) : (
                <Ionicons name={item.icon} size={ICON_SIZE} color={Colors.text} />
              )}
            </TouchableOpacity>
          ))}
        </Animated.View>
      )}

      <TouchableOpacity
        style={styles.mainPill}
        onPress={toggleExpanded}
        activeOpacity={0.7}
      >
        {currentItem.name === 'Profile' && userProfile?.avatar_url ? (
          <Image
            source={{ uri: userProfile.avatar_url }}
            style={styles.profileImageMain}
            resizeMode="cover"
          />
        ) : (
          <Ionicons name={currentItem.icon} size={ICON_SIZE} color="#FFFFFF" />
        )}
      </TouchableOpacity>
    </View>
  );
}
