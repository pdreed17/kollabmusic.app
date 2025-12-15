import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type Handedness = 'left' | 'right';

interface PreferencesContextType {
  handedness: Handedness;
  setHandedness: (handedness: Handedness) => Promise<void>;
}

const PreferencesContext = createContext<PreferencesContextType | undefined>(undefined);

const PREFERENCES_KEY = '@kollab_preferences';

interface PreferencesProviderProps {
  children: ReactNode;
}

export function PreferencesProvider({ children }: PreferencesProviderProps) {
  const [handedness, setHandednessState] = useState<Handedness>('right');

  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    try {
      const stored = await AsyncStorage.getItem(PREFERENCES_KEY);
      if (stored) {
        const preferences = JSON.parse(stored);
        if (preferences.handedness) {
          setHandednessState(preferences.handedness);
        }
      }
    } catch (error) {
      // If loading fails, use default
    }
  };

  const setHandedness = async (newHandedness: Handedness) => {
    try {
      setHandednessState(newHandedness);
      const stored = await AsyncStorage.getItem(PREFERENCES_KEY);
      const preferences = stored ? JSON.parse(stored) : {};
      preferences.handedness = newHandedness;
      await AsyncStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences));
    } catch (error) {
      // If saving fails, at least update in-memory state
    }
  };

  return (
    <PreferencesContext.Provider value={{ handedness, setHandedness }}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences() {
  const context = useContext(PreferencesContext);
  if (!context) {
    throw new Error('usePreferences must be used within PreferencesProvider');
  }
  return context;
}
