import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Switch,
  Image,
  Linking,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '../contexts/AuthContext'
import { usePreferences } from '../contexts/PreferencesContext'
import { supabase } from '../lib/supabase'
import { authService } from '../services/auth.service'
import { Colors, Typography, Spacing, BorderRadius } from '../constants/theme'
import CompactHeader from '../components/CompactHeader'

interface SettingItem {
  id: string
  title: string
  subtitle?: string
  icon: keyof typeof Ionicons.glyphMap
  type: 'navigation' | 'toggle' | 'action'
  screen?: string
  value?: boolean
  onToggle?: (value: boolean) => void
  onPress?: () => void
  destructive?: boolean
}

export default function SettingsScreen({ navigation }: any) {
  const { user, userProfile } = useAuth()
  const { handedness, setHandedness } = usePreferences()
  const [notificationsEnabled, setNotificationsEnabled] = useState(true)
  const [loading, setLoading] = useState(false)

  // Load settings from database on mount
  useEffect(() => {
    if (userProfile?.settings) {
      setNotificationsEnabled(userProfile.settings.notifications_enabled ?? true)
    }
  }, [userProfile])

  // Save setting to database
  const saveSetting = async (key: string, value: boolean) => {
    if (!user?.id) return

    try {
      // Get current settings or create empty object
      const currentSettings = userProfile?.settings || {}

      const { error } = await supabase
        .from('users')
        .update({
          settings: {
            ...currentSettings,
            [key]: value
          }
        })
        .eq('id', user.id)

      if (error) throw error
    } catch (error) {
      console.error('Error saving setting:', error)
      // Don't show alert to user, just log it
    }
  }

  const handleNotificationsToggle = async (value: boolean) => {
    setNotificationsEnabled(value)
    await saveSetting('notifications_enabled', value)
  }

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to delete your account? This action cannot be undone and will permanently delete all your projects, files, and data.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Account',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true)

              const { error } = await authService.deleteAccount()

              if (error) {
                console.error('[Settings] Delete account error:', error)
                Alert.alert(
                  'Error',
                  'Failed to delete account. Please try again or contact support.'
                )
                setLoading(false)
              } else {
                // Success - user is signed out automatically by authService
                // AuthContext will handle navigation to login screen
                Alert.alert(
                  'Account Deleted',
                  'Your account has been permanently deleted.',
                  [{ text: 'OK' }]
                )
              }
            } catch (error) {
              console.error('[Settings] Delete account exception:', error)
              Alert.alert(
                'Error',
                'An unexpected error occurred. Please try again.'
              )
              setLoading(false)
            }
          },
        },
      ]
    )
  }


  const accountSettings: SettingItem[] = [
    {
      id: 'edit-profile',
      title: 'Edit Profile',
      subtitle: 'Update your name, bio, and avatar',
      icon: 'person-outline',
      type: 'navigation',
      screen: 'EditProfile',
      onPress: () => navigation.navigate('EditProfile'),
    },
    {
      id: 'change-password',
      title: 'Change Password',
      subtitle: 'Update your account password',
      icon: 'lock-closed-outline',
      type: 'navigation',
      onPress: () => navigation.navigate('ChangePassword'),
    },
    {
      id: 'blocked-users',
      title: 'Blocked Users',
      subtitle: 'Manage blocked users',
      icon: 'ban-outline',
      type: 'navigation',
      screen: 'BlockedUsers',
      onPress: () => navigation.navigate('BlockedUsers'),
    },
  ]

  const notificationSettings: SettingItem[] = [
    {
      id: 'push-notifications',
      title: 'Push Notifications',
      subtitle: 'Receive notifications for activity',
      icon: 'notifications-outline',
      type: 'toggle',
      value: notificationsEnabled,
      onToggle: handleNotificationsToggle,
    },
  ]

  const subscriptionSettings: SettingItem[] = [
    {
      id: 'manage-subscription',
      title: 'Manage Subscription',
      subtitle: 'View and update your plan',
      icon: 'card-outline',
      type: 'navigation',
      onPress: () => navigation.navigate('Subscription'),
    },
    {
      id: 'billing-history',
      title: 'Billing History',
      subtitle: 'View past invoices',
      icon: 'receipt-outline',
      type: 'navigation',
      onPress: () => navigation.navigate('BillingHistory'),
    },
  ]

  const handleSendFeedback = () => {
    Linking.openURL('mailto:feedback@kollabmusic.app?subject=Kollab Feedback')
  }

  const handleContactSupport = () => {
    Linking.openURL('mailto:support@kollabmusic.app?subject=Kollab Support Request')
  }

  const supportSettings: SettingItem[] = [
    {
      id: 'send-feedback',
      title: 'Send Feedback',
      subtitle: 'Help us improve Kollab',
      icon: 'chatbubble-outline',
      type: 'action',
      onPress: handleSendFeedback,
    },
    {
      id: 'contact-support',
      title: 'Contact Support',
      subtitle: 'Get help with your account',
      icon: 'help-circle-outline',
      type: 'action',
      onPress: handleContactSupport,
    },
  ]

  const privacySettings: SettingItem[] = [
    {
      id: 'privacy-policy',
      title: 'Privacy Policy',
      icon: 'shield-outline',
      type: 'navigation',
      onPress: () => navigation.navigate('PrivacyPolicy'),
    },
    {
      id: 'terms-of-service',
      title: 'Terms of Service',
      icon: 'document-text-outline',
      type: 'navigation',
      onPress: () => navigation.navigate('TermsOfService'),
    },
  ]

  const dangerZone: SettingItem[] = [
    {
      id: 'delete-account',
      title: 'Delete Account',
      subtitle: 'Permanently delete your account and data',
      icon: 'trash-outline',
      type: 'action',
      onPress: handleDeleteAccount,
      destructive: true,
    },
  ]

  const renderSettingItem = (item: SettingItem) => {
    if (item.type === 'toggle') {
      return (
        <View key={item.id} style={styles.settingRow}>
          <View style={styles.settingIcon}>
            <Ionicons name={item.icon} size={24} color={Colors.textSecondary} />
          </View>
          <View style={styles.settingContent}>
            <Text style={styles.settingTitle}>{item.title}</Text>
            {item.subtitle && <Text style={styles.settingSubtitle}>{item.subtitle}</Text>}
          </View>
          <Switch
            value={item.value}
            onValueChange={item.onToggle}
            trackColor={{ false: Colors.border, true: Colors.primary }}
            thumbColor={Colors.text}
          />
        </View>
      )
    }

    return (
      <TouchableOpacity
        key={item.id}
        style={styles.settingRow}
        onPress={item.onPress}
        activeOpacity={0.7}
      >
        <View style={styles.settingIcon}>
          <Ionicons
            name={item.icon}
            size={24}
            color={item.destructive ? Colors.error : Colors.textSecondary}
          />
        </View>
        <View style={styles.settingContent}>
          <Text
            style={[
              styles.settingTitle,
              item.destructive && styles.settingTitleDestructive,
            ]}
          >
            {item.title}
          </Text>
          {item.subtitle && <Text style={styles.settingSubtitle}>{item.subtitle}</Text>}
        </View>
        <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
      </TouchableOpacity>
    )
  }

  const renderHandednessSection = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Navigation</Text>
      <View style={styles.sectionCard}>
        <View style={styles.settingRow}>
          <View style={styles.settingIcon}>
            <Ionicons name="hand-left-outline" size={24} color={Colors.textSecondary} />
          </View>
          <View style={styles.settingContent}>
            <Text style={styles.settingTitle}>Hand Preference</Text>
            <Text style={styles.settingSubtitle}>Choose which hand you hold your phone with</Text>
          </View>
        </View>
        <View style={styles.divider} />
        <View style={styles.handednessOptions}>
          <TouchableOpacity
            style={[
              styles.handednessOption,
              handedness === 'left' && styles.handednessOptionActive,
            ]}
            onPress={() => setHandedness('left')}
            activeOpacity={0.7}
          >
            <Ionicons
              name={handedness === 'left' ? 'radio-button-on' : 'radio-button-off'}
              size={24}
              color={handedness === 'left' ? Colors.primary : Colors.textSecondary}
            />
            <View style={styles.handednessOptionContent}>
              <Text
                style={[
                  styles.handednessOptionTitle,
                  handedness === 'left' && styles.handednessOptionTitleActive,
                ]}
              >
                Left Hand
              </Text>
              <Text style={styles.handednessOptionSubtitle}>Nav on left, back on right</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.handednessOption,
              handedness === 'right' && styles.handednessOptionActive,
            ]}
            onPress={() => setHandedness('right')}
            activeOpacity={0.7}
          >
            <Ionicons
              name={handedness === 'right' ? 'radio-button-on' : 'radio-button-off'}
              size={24}
              color={handedness === 'right' ? Colors.primary : Colors.textSecondary}
            />
            <View style={styles.handednessOptionContent}>
              <Text
                style={[
                  styles.handednessOptionTitle,
                  handedness === 'right' && styles.handednessOptionTitleActive,
                ]}
              >
                Right Hand
              </Text>
              <Text style={styles.handednessOptionSubtitle}>Nav on right, back on left</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  )

  const renderSection = (title: string, items: SettingItem[]) => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionCard}>
        {items.map((item, index) => (
          <View key={item.id}>
            {renderSettingItem(item)}
            {index < items.length - 1 && <View style={styles.divider} />}
          </View>
        ))}
      </View>
    </View>
  )

  return (
    <SafeAreaView style={styles.container}>
      <CompactHeader
        title="Settings"
        subtitle="Preferences"
        onBack={() => navigation.goBack()}
      />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* User Info */}
        <View style={styles.userSection}>
          {userProfile?.avatar_url ? (
            <Image
              source={{ uri: userProfile.avatar_url }}
              style={styles.userAvatarImage}
            />
          ) : (
            <View style={styles.userAvatar}>
              <Ionicons name="person" size={32} color={Colors.text} />
            </View>
          )}
          <View style={styles.userInfo}>
            <Text style={styles.userName}>
              {userProfile?.display_name || userProfile?.username || user?.email}
            </Text>
            <Text style={styles.userEmail}>{user?.email}</Text>
          </View>
        </View>

        {renderSection('Account', accountSettings)}
        {renderHandednessSection()}
        {renderSection('Notifications', notificationSettings)}
        {renderSection('Subscription', subscriptionSettings)}
        {renderSection('Support & Feedback', supportSettings)}
        {renderSection('Legal & Privacy', privacySettings)}
        {renderSection('Danger Zone', dangerZone)}

        {/* App Version */}
        <View style={styles.versionSection}>
          <Text style={styles.versionText}>Kollab Music v1.0.0</Text>
          <Text style={styles.versionSubtext}>Made with care for musicians</Text>
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.backgroundDark,
  },
  content: {
    flex: 1,
  },
  userSection: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    backgroundColor: Colors.surface,
    marginHorizontal: Spacing.md,
    marginTop: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  userAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  userAvatarImage: {
    width: 64,
    height: 64,
    borderRadius: 32,
    marginRight: Spacing.md,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    ...Typography.h3,
    color: Colors.text,
    marginBottom: Spacing.xxs,
  },
  userEmail: {
    ...Typography.body,
    color: Colors.textSecondary,
  },
  section: {
    marginTop: Spacing.lg,
    paddingHorizontal: Spacing.md,
  },
  sectionTitle: {
    ...Typography.caption,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.xs,
    paddingHorizontal: Spacing.xxs,
  },
  sectionCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    minHeight: 60,
  },
  settingIcon: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.sm,
  },
  settingContent: {
    flex: 1,
  },
  settingTitle: {
    ...Typography.bodyLarge,
    color: Colors.text,
    marginBottom: 2,
  },
  settingTitleDestructive: {
    color: Colors.error,
  },
  settingSubtitle: {
    ...Typography.caption,
    color: Colors.textSecondary,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginLeft: 56,
  },
  versionSection: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
  },
  versionText: {
    ...Typography.caption,
    color: Colors.textSecondary,
    marginBottom: Spacing.xxs,
  },
  versionSubtext: {
    ...Typography.caption,
    color: Colors.textTertiary,
  },
  bottomSpacer: {
    height: Spacing.xxxl,
  },
  handednessOptions: {
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  handednessOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  handednessOptionActive: {
    borderColor: Colors.primary,
    backgroundColor: `${Colors.primary}10`,
  },
  handednessOptionContent: {
    marginLeft: Spacing.sm,
    flex: 1,
  },
  handednessOptionTitle: {
    ...Typography.bodyLarge,
    color: Colors.text,
    marginBottom: 2,
  },
  handednessOptionTitleActive: {
    fontWeight: '600',
  },
  handednessOptionSubtitle: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontSize: 11,
  },
})
