import React, { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Alert,
  Switch,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '../contexts/AuthContext'
import { Colors, Typography, Spacing, BorderRadius } from '../constants/theme'
import Header from '../components/Header'

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
  const { user, signOut } = useAuth()
  const [notificationsEnabled, setNotificationsEnabled] = useState(true)
  const [emailNotifications, setEmailNotifications] = useState(true)
  const [autoDownload, setAutoDownload] = useState(false)
  const [highQualityPlayback, setHighQualityPlayback] = useState(true)

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut()
              // Navigation will automatically switch to Login screen when user is cleared
            } catch (error) {
              console.error('Sign out error:', error)
              Alert.alert('Error', 'Failed to sign out. Please try again.')
            }
          },
        },
      ]
    )
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
          onPress: () => {
            // TODO: Implement account deletion
            Alert.alert(
              'Coming Soon',
              'Account deletion will be available soon. Please contact support@kollabapp.com for assistance.'
            )
          },
        },
      ]
    )
  }

  const handleExportData = () => {
    Alert.alert(
      'Export Data',
      'Your data export will be prepared and emailed to you within 24 hours.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Request Export',
          onPress: () => {
            // TODO: Implement data export
            Alert.alert('Success', 'Data export requested. You will receive an email shortly.')
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
      onToggle: setNotificationsEnabled,
    },
    {
      id: 'email-notifications',
      title: 'Email Notifications',
      subtitle: 'Receive updates via email',
      icon: 'mail-outline',
      type: 'toggle',
      value: emailNotifications,
      onToggle: setEmailNotifications,
    },
  ]

  const audioSettings: SettingItem[] = [
    {
      id: 'audio-quality',
      title: 'Audio Quality',
      subtitle: 'Upload and playback quality',
      icon: 'musical-note-outline',
      type: 'navigation',
      onPress: () => {
        Alert.alert(
          'Audio Quality',
          'Choose your preferred audio quality settings',
          [
            { text: 'Low (Faster)', onPress: () => {} },
            { text: 'Medium (Balanced)', onPress: () => {} },
            { text: 'High (Best Quality)', onPress: () => {} },
            { text: 'Cancel', style: 'cancel' },
          ]
        )
      },
    },
    {
      id: 'high-quality-playback',
      title: 'High Quality Playback',
      subtitle: 'Use maximum quality for playback',
      icon: 'headset-outline',
      type: 'toggle',
      value: highQualityPlayback,
      onToggle: setHighQualityPlayback,
    },
    {
      id: 'auto-download',
      title: 'Auto-Download Stems',
      subtitle: 'Automatically cache stems for offline use',
      icon: 'download-outline',
      type: 'toggle',
      value: autoDownload,
      onToggle: setAutoDownload,
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
    {
      id: 'export-data',
      title: 'Export My Data',
      subtitle: 'Request a copy of your data',
      icon: 'cloud-download-outline',
      type: 'action',
      onPress: handleExportData,
    },
  ]

  const dangerZone: SettingItem[] = [
    {
      id: 'sign-out',
      title: 'Sign Out',
      icon: 'log-out-outline',
      type: 'action',
      onPress: handleSignOut,
      destructive: true,
    },
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
      <Header
        title="Settings"
        subtitle="Preferences"
        variant="compact"
        showBack={true}
        onBack={() => navigation.goBack()}
      />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* User Info */}
        <View style={styles.userSection}>
          <View style={styles.userAvatar}>
            <Ionicons name="person" size={32} color={Colors.text} />
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{user?.email}</Text>
            <Text style={styles.userEmail}>Free Plan</Text>
          </View>
        </View>

        {renderSection('Account', accountSettings)}
        {renderSection('Notifications', notificationSettings)}
        {renderSection('Audio Settings', audioSettings)}
        {renderSection('Subscription', subscriptionSettings)}
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
})
