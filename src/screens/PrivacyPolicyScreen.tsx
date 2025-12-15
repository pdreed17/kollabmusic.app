import React from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Colors, Typography, Spacing, BorderRadius } from '../constants/theme'
import CompactHeader from '../components/CompactHeader'

export default function PrivacyPolicyScreen({ navigation }: any) {
  return (
    <SafeAreaView style={styles.container}>
      <CompactHeader
        title="Privacy Policy"
        subtitle="Last Updated: Dec 11, 2025"
        onBack={() => navigation.goBack()}
      />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.updateInfo}>
          <Text style={styles.updateText}>Last updated: December 11, 2025</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Introduction</Text>
          <Text style={styles.paragraph}>
            Welcome to Kollab ("we," "our," or "us"). We are committed to protecting your
            privacy and ensuring you have a positive experience on our platform. This Privacy
            Policy explains how we collect, use, disclose, and safeguard your information when
            you use our mobile application and services.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Information We Collect</Text>

          <Text style={styles.subsectionTitle}>Account Information</Text>
          <Text style={styles.paragraph}>
            When you create an account, we collect:
          </Text>
          <Text style={styles.bulletPoint}>• Email address</Text>
          <Text style={styles.bulletPoint}>• Username, first name, and last name</Text>
          <Text style={styles.bulletPoint}>• Display name and profile bio</Text>
          <Text style={styles.bulletPoint}>• Profile picture (optional)</Text>
          <Text style={styles.bulletPoint}>• Musical specialties/skills you select</Text>
          <Text style={styles.bulletPoint}>• Collaboration availability preferences</Text>

          <Text style={styles.subsectionTitle}>Audio Content</Text>
          <Text style={styles.paragraph}>
            When you use our service, we store:
          </Text>
          <Text style={styles.bulletPoint}>• Audio files you upload (stems, tracks, highlights)</Text>
          <Text style={styles.bulletPoint}>• Audio metadata (duration, format, BPM, key, sample rate)</Text>
          <Text style={styles.bulletPoint}>• Audio analysis data (waveforms, spectral features for similarity search)</Text>
          <Text style={styles.bulletPoint}>• Mixer settings (volume, pan, mute/solo states)</Text>

          <Text style={styles.subsectionTitle}>Project and Collaboration Data</Text>
          <Text style={styles.bulletPoint}>• Project titles, descriptions, and settings</Text>
          <Text style={styles.bulletPoint}>• Collaborator relationships and permissions</Text>
          <Text style={styles.bulletPoint}>• Comments and timestamped feedback</Text>
          <Text style={styles.bulletPoint}>• Activity logs (uploads, edits, invitations)</Text>

          <Text style={styles.subsectionTitle}>Device and Usage Data</Text>
          <Text style={styles.bulletPoint}>• Device type and operating system</Text>
          <Text style={styles.bulletPoint}>• App preferences (handedness, notification settings)</Text>
          <Text style={styles.bulletPoint}>• Session and authentication tokens</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Device Permissions</Text>
          <Text style={styles.paragraph}>
            Our app may request access to:
          </Text>
          <Text style={styles.bulletPoint}>• Microphone - to record audio</Text>
          <Text style={styles.bulletPoint}>• Photo Library - to upload profile pictures</Text>
          <Text style={styles.bulletPoint}>• File Storage - to import/export audio files</Text>
          <Text style={styles.bulletPoint}>• Bluetooth - to connect external audio devices</Text>
          <Text style={styles.paragraph}>
            You can revoke these permissions at any time in your device settings. Some features
            may not function without the required permissions.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>How We Use Your Information</Text>
          <Text style={styles.paragraph}>
            We use your information to:
          </Text>
          <Text style={styles.bulletPoint}>• Provide and maintain the Kollab service</Text>
          <Text style={styles.bulletPoint}>• Enable collaboration features between users</Text>
          <Text style={styles.bulletPoint}>• Process audio files and generate waveforms</Text>
          <Text style={styles.bulletPoint}>• Send notifications about project activity</Text>
          <Text style={styles.bulletPoint}>• Enforce subscription limits and usage quotas</Text>
          <Text style={styles.bulletPoint}>• Improve our platform and fix bugs</Text>
          <Text style={styles.bulletPoint}>• Prevent abuse and enforce our terms</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Data Storage and Security</Text>
          <Text style={styles.paragraph}>
            Your data is stored securely using Supabase infrastructure:
          </Text>
          <Text style={styles.bulletPoint}>• All data transmitted via HTTPS/TLS encryption</Text>
          <Text style={styles.bulletPoint}>• Passwords hashed using industry-standard algorithms</Text>
          <Text style={styles.bulletPoint}>• Audio files stored in secure cloud storage</Text>
          <Text style={styles.bulletPoint}>• Row-level security ensures you only access your data</Text>
          <Text style={styles.bulletPoint}>• Authentication tokens stored securely on device</Text>
          <Text style={styles.paragraph}>
            Free users: 200 MB storage limit. Pro users: 5 GB storage limit.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Data Sharing</Text>
          <Text style={styles.paragraph}>
            We do NOT sell your personal information. Your data may be shared:
          </Text>
          <Text style={styles.bulletPoint}>• With collaborators YOU invite to your projects</Text>
          <Text style={styles.bulletPoint}>• Publicly, if you set projects or profile to "public"</Text>
          <Text style={styles.bulletPoint}>• With service providers (Supabase for hosting)</Text>
          <Text style={styles.bulletPoint}>• When required by law or legal process</Text>
          <Text style={styles.paragraph}>
            Profile highlights (audio showcases) are publicly visible even if your profile is private.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Privacy Controls</Text>
          <Text style={styles.paragraph}>
            You can control your privacy through:
          </Text>
          <Text style={styles.bulletPoint}>• Profile visibility (Public/Followers/Private)</Text>
          <Text style={styles.bulletPoint}>• Project visibility (Public/Private/Unlisted)</Text>
          <Text style={styles.bulletPoint}>• Show/hide projects, collaborations, activity</Text>
          <Text style={styles.bulletPoint}>• Block users from contacting you</Text>
          <Text style={styles.bulletPoint}>• Notification preferences</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Rights</Text>
          <Text style={styles.paragraph}>
            You have the right to:
          </Text>
          <Text style={styles.bulletPoint}>• Access your personal data</Text>
          <Text style={styles.bulletPoint}>• Correct inaccurate information</Text>
          <Text style={styles.bulletPoint}>• Delete your account and all associated data</Text>
          <Text style={styles.bulletPoint}>• Opt-out of marketing communications</Text>
          <Text style={styles.paragraph}>
            To delete your account, go to Settings → Delete Account. This permanently removes
            all your data including projects, audio files, and collaborations.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Data Retention</Text>
          <Text style={styles.paragraph}>
            We retain your data as long as your account is active. When you delete your account:
          </Text>
          <Text style={styles.bulletPoint}>• All personal data is permanently deleted</Text>
          <Text style={styles.bulletPoint}>• All projects you created are deleted</Text>
          <Text style={styles.bulletPoint}>• All audio files you uploaded are deleted</Text>
          <Text style={styles.bulletPoint}>• Your comments and activity are removed</Text>
          <Text style={styles.paragraph}>
            This action is irreversible. Please export any content you wish to keep before
            deleting your account.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Children's Privacy</Text>
          <Text style={styles.paragraph}>
            Kollab is not intended for children under 13 years of age. We do not knowingly
            collect personal information from children under 13. If you believe we have collected
            information from a child, please contact us immediately and we will delete it.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Third-Party Services</Text>
          <Text style={styles.paragraph}>
            We use the following third-party services:
          </Text>
          <Text style={styles.bulletPoint}>• Supabase - Database, authentication, file storage</Text>
          <Text style={styles.paragraph}>
            We do NOT currently use analytics, advertising, or tracking services.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Changes to This Policy</Text>
          <Text style={styles.paragraph}>
            We may update this Privacy Policy from time to time. We will notify you of material
            changes by posting the new policy and updating the "Last Updated" date. Your continued
            use of Kollab after changes constitutes acceptance of the updated policy.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contact Us</Text>
          <Text style={styles.paragraph}>
            If you have questions about this Privacy Policy or your data:
          </Text>
          <Text style={styles.bulletPoint}>• Email: privacy@kollabapp.com</Text>
          <Text style={styles.bulletPoint}>• Support: support@kollabapp.com</Text>
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
    padding: Spacing.md,
  },
  updateInfo: {
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.lg,
  },
  updateText: {
    ...Typography.body,
    color: Colors.textSecondary,
    fontStyle: 'italic',
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    ...Typography.h2,
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  subsectionTitle: {
    ...Typography.h3,
    color: Colors.text,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  paragraph: {
    ...Typography.body,
    color: Colors.textSecondary,
    lineHeight: 22,
    marginBottom: Spacing.md,
  },
  bulletPoint: {
    ...Typography.body,
    color: Colors.textSecondary,
    lineHeight: 24,
    marginLeft: Spacing.md,
  },
  bottomSpacer: {
    height: Spacing.xxxl,
  },
})
