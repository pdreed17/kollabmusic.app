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

export default function TermsOfServiceScreen({ navigation }: any) {
  return (
    <SafeAreaView style={styles.container}>
      <Header
        title="Terms of Service"
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
          <Text style={styles.sectionTitle}>Acceptance of Terms</Text>
          <Text style={styles.paragraph}>
            By accessing and using Kollab Music ("Service"), you accept and agree to be bound by
            these Terms of Service ("Terms"). If you do not agree to these Terms, please do not
            use the Service.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Description of Service</Text>
          <Text style={styles.paragraph}>
            Kollab Music provides a cloud-based platform for music collaboration, allowing users
            to create, share, and collaborate on music projects across different digital audio
            workstations (DAWs).
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>User Accounts</Text>
          <Text style={styles.paragraph}>
            To use our Service, you must:
          </Text>
          <Text style={styles.bulletPoint}>• Be at least 13 years of age</Text>
          <Text style={styles.bulletPoint}>• Provide accurate and complete information</Text>
          <Text style={styles.bulletPoint}>• Maintain the security of your account credentials</Text>
          <Text style={styles.bulletPoint}>• Be responsible for all activity under your account</Text>
          <Text style={styles.bulletPoint}>• Notify us immediately of any unauthorized access</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Intellectual Property Rights</Text>

          <Text style={styles.subsectionTitle}>Your Content</Text>
          <Text style={styles.paragraph}>
            You retain all ownership rights to the content you upload to Kollab Music. By
            uploading content, you grant us a limited license to:
          </Text>
          <Text style={styles.bulletPoint}>• Store and process your files on our servers</Text>
          <Text style={styles.bulletPoint}>• Display your content to collaborators you invite</Text>
          <Text style={styles.bulletPoint}>• Enable collaboration features and tools</Text>
          <Text style={styles.bulletPoint}>• Create backups and ensure service reliability</Text>

          <Text style={styles.subsectionTitle}>Our Platform</Text>
          <Text style={styles.paragraph}>
            The Kollab Music platform, including all software, design, features, and trademarks,
            is owned by us and protected by intellectual property laws. You may not copy,
            modify, distribute, or reverse engineer any part of our Service.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Collaboration and Revenue Sharing</Text>
          <Text style={styles.paragraph}>
            When you collaborate on projects:
          </Text>
          <Text style={styles.bulletPoint}>• Agree on revenue splits and rights before publishing</Text>
          <Text style={styles.bulletPoint}>• Use our revenue split tools to document agreements</Text>
          <Text style={styles.bulletPoint}>• Resolve disputes among collaborators directly</Text>
          <Text style={styles.bulletPoint}>• Understand we are not a party to your agreements</Text>
          <Text style={styles.paragraph}>
            Kollab Music provides tools to facilitate agreements but is not responsible for
            enforcing revenue splits or resolving ownership disputes.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Acceptable Use Policy</Text>
          <Text style={styles.paragraph}>
            You agree NOT to:
          </Text>
          <Text style={styles.bulletPoint}>• Upload copyrighted material without permission</Text>
          <Text style={styles.bulletPoint}>• Harass, abuse, or harm other users</Text>
          <Text style={styles.bulletPoint}>• Upload malicious code or viruses</Text>
          <Text style={styles.bulletPoint}>• Attempt to bypass security measures</Text>
          <Text style={styles.bulletPoint}>• Use the Service for illegal activities</Text>
          <Text style={styles.bulletPoint}>• Spam or send unsolicited communications</Text>
          <Text style={styles.bulletPoint}>• Impersonate others or misrepresent affiliations</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Subscription and Payments</Text>
          <Text style={styles.paragraph}>
            Paid subscriptions:
          </Text>
          <Text style={styles.bulletPoint}>• Are billed monthly or annually as selected</Text>
          <Text style={styles.bulletPoint}>• Auto-renew unless cancelled before renewal date</Text>
          <Text style={styles.bulletPoint}>• Are non-refundable except as required by law</Text>
          <Text style={styles.bulletPoint}>• Can be cancelled at any time from account settings</Text>
          <Text style={styles.paragraph}>
            We reserve the right to change subscription prices with 30 days notice to existing
            subscribers.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Service Availability</Text>
          <Text style={styles.paragraph}>
            We strive to provide reliable service but:
          </Text>
          <Text style={styles.bulletPoint}>• Do not guarantee 100% uptime</Text>
          <Text style={styles.bulletPoint}>• May perform maintenance with or without notice</Text>
          <Text style={styles.bulletPoint}>• May modify or discontinue features</Text>
          <Text style={styles.bulletPoint}>• Are not liable for data loss (backup your work!)</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Termination</Text>
          <Text style={styles.paragraph}>
            We may suspend or terminate your account if:
          </Text>
          <Text style={styles.bulletPoint}>• You violate these Terms</Text>
          <Text style={styles.bulletPoint}>• Your account is inactive for extended periods</Text>
          <Text style={styles.bulletPoint}>• We are required to do so by law</Text>
          <Text style={styles.bulletPoint}>• Your payment method fails repeatedly</Text>
          <Text style={styles.paragraph}>
            You may delete your account at any time from Settings. Upon termination, your access
            to the Service will cease, and we may delete your data according to our retention
            policy.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Limitation of Liability</Text>
          <Text style={styles.paragraph}>
            To the maximum extent permitted by law, Kollab Music and its affiliates shall not
            be liable for any indirect, incidental, special, consequential, or punitive damages,
            or any loss of profits or revenues, whether incurred directly or indirectly, or any
            loss of data, use, goodwill, or other intangible losses resulting from:
          </Text>
          <Text style={styles.bulletPoint}>• Your use or inability to use the Service</Text>
          <Text style={styles.bulletPoint}>• Unauthorized access to your account or data</Text>
          <Text style={styles.bulletPoint}>• Conduct of any third party on the Service</Text>
          <Text style={styles.bulletPoint}>• Service interruptions or technical issues</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Dispute Resolution</Text>
          <Text style={styles.paragraph}>
            Any disputes arising from these Terms or use of the Service shall be resolved
            through binding arbitration in accordance with the rules of the American Arbitration
            Association, except where prohibited by law.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Changes to Terms</Text>
          <Text style={styles.paragraph}>
            We may revise these Terms at any time. Material changes will be notified via email
            or in-app notification. Continued use after changes constitutes acceptance of the
            revised Terms.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contact Information</Text>
          <Text style={styles.paragraph}>
            Questions about these Terms? Contact us at:
          </Text>
          <Text style={styles.bulletPoint}>• Email: legal@kollabapp.com</Text>
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
