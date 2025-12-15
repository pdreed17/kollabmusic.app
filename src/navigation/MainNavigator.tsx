import React from 'react';
import { View, StyleSheet, TouchableWithoutFeedback, StatusBar, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

// Screens
import HomeScreen from '../screens/HomeScreen';
import ProjectsListScreen from '../screens/ProjectsListScreen';
import SearchScreen from '../screens/SearchScreen';
import ActivityScreen from '../screens/ActivityScreen';
import ProfileScreen from '../screens/ProfileScreen';

// New Navigation Components
import ThinHeader from '../components/ThinHeader';
import NavigationPill from '../components/NavigationPill';
import BackButton from '../components/BackButton';
import { Colors } from '../constants/theme';
import { useNavigationPill } from '../contexts/NavigationContext';

const Stack = createNativeStackNavigator();

// Screen wrapper that adds ThinHeader, NavigationPill, and BackButton to each screen
function ScreenWrapper({
  children,
  screenName
}: {
  children: React.ReactNode;
  screenName: string;
}) {
  const { isNavExpanded, setIsNavExpanded } = useNavigationPill();

  const handleOverlayPress = () => {
    if (isNavExpanded) {
      setIsNavExpanded(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ThinHeader screenName={screenName} />
      <View style={styles.content}>
        {children}
      </View>
      {isNavExpanded && (
        <TouchableWithoutFeedback onPress={handleOverlayPress}>
          <View style={styles.overlay} />
        </TouchableWithoutFeedback>
      )}
      <BackButton />
      <NavigationPill />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    flex: 1,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
  },
});

export default function MainNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'none', // Instant transitions between tabs
      }}
    >
      <Stack.Screen name="Home">
        {({ navigation, route }) => (
          <ScreenWrapper screenName="Home">
            <HomeScreen navigation={navigation} route={route} />
          </ScreenWrapper>
        )}
      </Stack.Screen>
      <Stack.Screen name="Projects">
        {({ navigation, route }) => (
          <ScreenWrapper screenName="Projects">
            <ProjectsListScreen navigation={navigation} route={route} />
          </ScreenWrapper>
        )}
      </Stack.Screen>
      <Stack.Screen name="Activity">
        {({ navigation, route }) => (
          <ScreenWrapper screenName="Activity">
            <ActivityScreen navigation={navigation} route={route} />
          </ScreenWrapper>
        )}
      </Stack.Screen>
      <Stack.Screen name="Search">
        {({ navigation, route }) => (
          <ScreenWrapper screenName="Search">
            <SearchScreen navigation={navigation} route={route} />
          </ScreenWrapper>
        )}
      </Stack.Screen>
      <Stack.Screen name="Profile">
        {({ navigation, route }) => (
          <ScreenWrapper screenName="Profile">
            <ProfileScreen navigation={navigation} route={route} />
          </ScreenWrapper>
        )}
      </Stack.Screen>
    </Stack.Navigator>
  );
}
