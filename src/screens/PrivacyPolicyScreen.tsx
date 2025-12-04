import React from 'react'
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
} from 'react-native'
import { Colors, Typography, Spacing, BorderRadius } from '../constants/theme'
import Header from '../components/Header'

export default function PrivacyPolicyScreen({ navigation }: any) {
  return (
    <SafeAreaView style={styles.container}>
      <Header
        title="Privacy Policy"
        subtitle="Last Updated: Jan 1, 2024"
        variant="compact"
        showBack={true}
        onBack={() => navigation.goBack()}
      />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.updateInfo}>
          <Text style={styles.updateText}>Last updated: January 1, 2024</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Introduction</Text>
          <Text style={styles.paragraph}>
            Welcome to Kollab Music ("we," "our," or "us"). We are committed to protecting your
            privacy and ensuring you have a positive experience on our platform. This Privacy
            Policy explains how we collect, use, disclose, and safeguard your information when
            you use our mobile application and services.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Information We Collect</Text>

          <Text style={styles.subsectionTitle}>Personal Information</Text>
          <Text style={styles.paragraph}>
            When you create an account, we collect:
          </Text>
          <Text style={styles.bulletPoint}>• Email address</Text>
          <Text style={styles.bulletPoint}>• Name and display name</Text>
          <Text style={styles.bulletPoint}>• Profile information (bio, avatar, skills)</Text>
          <Text style={styles.bulletPoint}>• Authentication credentials</Text>

          <Text style={styles.subsectionTitle}>Content and Files</Text>
          <Text style={styles.paragraph}>
            We store and process:
          </Text>
          <Text style={styles.bulletPoint}>• Audio files you upload</Text>
          <Text style={styles.bulletPoint}>• Project metadata and settings</Text>
          <Text style={styles.bulletPoint}>• Comments and collaboration data</Text>
          <Text style={styles.bulletPoint}>• Usage data and analytics</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>How We Use Your Information</Text>
          <Text style={styles.paragraph}>
            We use your information to:
          </Text>
          <Text style={styles.bulletPoint}>• Provide and maintain our services</Text>
          <Text style={styles.bulletPoint}>• Process your transactions and manage subscriptions</Text>
          <Text style={styles.bulletPoint}>• Send you important updates and notifications</Text>
          <Text style={styles.bulletPoint}>• Improve our platform and user experience</Text>
          <Text style={styles.bulletPoint}>• Ensure security and prevent fraud</Text>
          <Text style={styles.bulletPoint}>• Comply with legal obligations</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Data Storage and Security</Text>
          <Text style={styles.paragraph}>
            We use industry-standard security measures to protect your data, including:
          </Text>
          <Text style={styles.bulletPoint}>• Encrypted data transmission (HTTPS/TLS)</Text>
          <Text style={styles.bulletPoint}>• Secure cloud storage with Supabase</Text>
          <Text style={styles.bulletPoint}>• Regular security audits and updates</Text>
          <Text style={styles.bulletPoint}>• Access controls and authentication</Text>
          <Text style={styles.paragraph}>
            Your audio files and project data are stored securely on our servers and are only
            accessible to you and collaborators you explicitly invite.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Data Sharing and Disclosure</Text>
          <Text style={styles.paragraph}>
            We do not sell your personal information. We may share your data:
          </Text>
          <Text style={styles.bulletPoint}>• With collaborators on your projects (as you choose)</Text>
          <Text style={styles.bulletPoint}>• With service providers (payment processing, analytics)</Text>
          <Text style={styles.bulletPoint}>• When required by law or to protect our rights</Text>
          <Text style={styles.bulletPoint}>• In connection with a business transfer or acquisition</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Rights and Choices</Text>
          <Text style={styles.paragraph}>
            You have the right to:
          </Text>
          <Text style={styles.bulletPoint}>• Access and download your personal data</Text>
          <Text style={styles.bulletPoint}>• Correct inaccurate information</Text>
          <Text style={styles.bulletPoint}>• Delete your account and data</Text>
          <Text style={styles.bulletPoint}>• Opt-out of marketing communications</Text>
          <Text style={styles.bulletPoint}>• Export your projects and files</Text>
          <Text style={styles.paragraph}>
            To exercise these rights, please contact us at privacy@kollabapp.com or use the data
            export feature in your account settings.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Cookies and Tracking</Text>
          <Text style={styles.paragraph}>
            We use cookies and similar technologies to improve your experience, analyze usage,
            and personalize content. You can manage cookie preferences in your device settings.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Children's Privacy</Text>
          <Text style={styles.paragraph}>
            Our services are not intended for children under 13 years of age. We do not knowingly
            collect personal information from children under 13. If you believe we have collected
            information from a child, please contact us immediately.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Changes to This Policy</Text>
          <Text style={styles.paragraph}>
            We may update this Privacy Policy from time to time. We will notify you of any
            material changes by posting the new policy on this page and updating the "Last
            Updated" date. Your continued use of our services after changes constitutes acceptance.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contact Us</Text>
          <Text style={styles.paragraph}>
            If you have questions about this Privacy Policy, please contact us:
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
