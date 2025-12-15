import React from 'react'
import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { useAuth } from '../contexts/AuthContext'
import { ActivityIndicator, View } from 'react-native'

// Screens
import { LoginScreen } from '../screens/auth/LoginScreen'
import { SignupScreen } from '../screens/auth/SignUpScreen'
import MainNavigator from './MainNavigator'
import AudioUploadScreen from '../screens/AudioUploadScreen'
import ProjectDetailScreen from '../screens/ProjectDetailScreen'
import EditProjectScreen from '../screens/EditProjectScreen'
import InviteCollaboratorScreen from '../screens/InviteCollaboratorScreen'
import CreateProjectScreen from '../screens/CreateProjectScreen'
import ProjectStudioScreen from '../screens/ProjectStudioScreen'
import WebDAWScreen from '../screens/WebDAWScreen'
import NativeDAWScreen from '../screens/NativeDAWScreen'
import EditProfileScreen from '../screens/EditProfileScreen'
import BlockedUsersScreen from '../screens/BlockedUsersScreen'
import CollaboratorsScreen from '../screens/CollaboratorsScreen'
import PendingInvitationsScreen from '../screens/PendingInvitationsScreen'
import ExportToDAWScreen from '../screens/ExportToDAWScreen'
import SettingsScreen from '../screens/SettingsScreen'
import ChangePasswordScreen from '../screens/ChangePasswordScreen'
import SubscriptionScreen from '../screens/SubscriptionScreen'
import BillingHistoryScreen from '../screens/BillingHistoryScreen'
import PrivacyPolicyScreen from '../screens/PrivacyPolicyScreen'
import TermsOfServiceScreen from '../screens/TermsOfServiceScreen'
import SimilarTracksScreen from '../screens/SimilarTracksScreen'
import HighlightUploadScreen from '../screens/HighlightUploadScreen'
import UserProfileScreen from '../screens/UserProfileScreen'

const Stack = createNativeStackNavigator()

export default function AppNavigator() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#6366F1" />
      </View>
    )
  }

  return (
    <NavigationContainer>
      <Stack.Navigator>
        {user ? (
          // Authenticated screens
          <>
            <Stack.Screen
              name="MainTabs"
              component={MainNavigator}
              options={{ headerShown: false }}
            />
            <Stack.Screen 
              name="CreateProject" 
              component={CreateProjectScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="AudioUpload"
              component={AudioUploadScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="HighlightUpload"
              component={HighlightUploadScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="ProjectDetail"
              component={ProjectDetailScreen as any}
              options={{ headerShown: false }}
            />
            <Stack.Screen 
              name="EditProject" 
              component={EditProjectScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen 
              name="InviteCollaborator" 
              component={InviteCollaboratorScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen 
  name="Collaborators" 
  component={CollaboratorsScreen}
  options={{ headerShown: false }}
/>
            <Stack.Screen 
  name="EditProfile" 
  component={EditProfileScreen}
  options={{ headerShown: false }}
/>
<Stack.Screen 
  name="BlockedUsers" 
  component={BlockedUsersScreen}
  options={{ headerShown: false }}
/>
<Stack.Screen 
  name="PendingInvitations" 
  component={PendingInvitationsScreen}
  options={{ headerShown: false }}
/>
<Stack.Screen
  name="ExportToDAW"
  component={ExportToDAWScreen}
  options={{ headerShown: false }}
/>
            <Stack.Screen
              name="Settings"
              component={SettingsScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="ChangePassword"
              component={ChangePasswordScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Subscription"
              component={SubscriptionScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="BillingHistory"
              component={BillingHistoryScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="PrivacyPolicy"
              component={PrivacyPolicyScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="TermsOfService"
              component={TermsOfServiceScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="ProjectStudio"
              component={ProjectStudioScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="WebDAW"
              component={WebDAWScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="NativeDAW"
              component={NativeDAWScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="SimilarTracks"
              component={SimilarTracksScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="UserProfile"
              component={UserProfileScreen}
              options={{ headerShown: false }}
            />
          </>
        ) : (
          // Auth screens
          <>
            <Stack.Screen 
              name="Login" 
              component={LoginScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen 
              name="Signup" 
              component={SignupScreen}
              options={{ headerShown: false }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  )
}