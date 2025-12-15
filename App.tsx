import React from 'react'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { AuthProvider } from './src/contexts/AuthContext'
import { PreferencesProvider } from './src/contexts/PreferencesContext'
import { NavigationProvider } from './src/contexts/NavigationContext'
import AppNavigator from './src/navigation/AppNavigator'
import ErrorBoundary from './src/components/ErrorBoundary'

function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ErrorBoundary>
        <PreferencesProvider>
          <AuthProvider>
            <NavigationProvider>
              <AppNavigator />
            </NavigationProvider>
          </AuthProvider>
        </PreferencesProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  )
}

export default App