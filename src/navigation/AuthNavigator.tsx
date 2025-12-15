import React from 'react'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { LoginScreen } from '../screens/auth/LoginScreen'
import { SignupScreen } from '../screens/auth/SignUpScreen'
import { WelcomeScreen } from '../screens/auth/WelcomeScreen'
import { ForgotPasswordScreen } from '../screens/auth/ForgotPasswordScreen'
import { ResetPasswordScreen } from '../screens/auth/ResetPasswordScreen'
import { useAuth } from '../contexts/AuthContext'

const Stack = createNativeStackNavigator()

export function AuthNavigator() {
  const { isPasswordRecovery } = useAuth()

  return (
    <Stack.Navigator
      initialRouteName={isPasswordRecovery ? 'ResetPassword' : 'Welcome'}
      screenOptions={{
        headerShown: false,
      }}
    >
      {isPasswordRecovery ? (
        // Password recovery flow - only show reset screen
        <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
      ) : (
        // Normal auth flow
        <>
          <Stack.Screen name="Welcome" component={WelcomeScreen} />
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Signup" component={SignupScreen} />
          <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
        </>
      )}
      {/* Always include Login so reset screen can navigate to it */}
      {isPasswordRecovery && (
        <Stack.Screen name="Login" component={LoginScreen} />
      )}
    </Stack.Navigator>
  )
}