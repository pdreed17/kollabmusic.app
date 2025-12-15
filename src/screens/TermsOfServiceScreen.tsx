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

export default function TermsOfServiceScreen({ navigation }: any) {
  return (
    <SafeAreaView style={styles.container}>
      <CompactHeader
        title="Terms of Service"
        subtitle="Last Updated: Dec 11, 2025"
        onBack={() => navigation.goBack()}
      />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.updateInfo}>
          <Text style={styles.updateText}>Last updated: December 11, 2025</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>1. Acceptance of Terms</Text>
          <Text style={styles.paragraph}>
            By creating an account or using Kollab ("Service"), you agree to these Terms of
            Service ("Terms"). If you do not agree, do not use the Service. We may update these
            Terms at any time - continued use constitutes acceptance.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>2. Description of Service</Text>
          <Text style={styles.paragraph}>
            Kollab is a mobile platform for music collaboration. The Service allows you to:
          </Text>
          <Text style={styles.bulletPoint}>• Create and manage music projects</Text>
          <Text style={styles.bulletPoint}>• Upload, organize, and mix audio tracks</Text>
          <Text style={styles.bulletPoint}>• Invite collaborators to work on projects</Text>
          <Text style={styles.bulletPoint}>• Comment and provide timestamped feedback</Text>
          <Text style={styles.bulletPoint}>• Showcase audio highlights on your profile</Text>
          <Text style={styles.bulletPoint}>• Export projects to external DAWs</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>3. Account Requirements</Text>
          <Text style={styles.paragraph}>
            To use Kollab, you must:
          </Text>
          <Text style={styles.bulletPoint}>• Be at least 13 years of age</Text>
          <Text style={styles.bulletPoint}>• Provide accurate registration information</Text>
          <Text style={styles.bulletPoint}>• Maintain the security of your login credentials</Text>
          <Text style={styles.bulletPoint}>• Accept responsibility for all activity under your account</Text>
          <Text style={styles.bulletPoint}>• Notify us immediately of any unauthorized access</Text>
          <Text style={styles.paragraph}>
            One account per person. Shared or automated accounts are prohibited.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>4. Subscription Plans</Text>

          <Text style={styles.subsectionTitle}>Free Tier</Text>
          <Text style={styles.bulletPoint}>• 3 owned projects maximum</Text>
          <Text style={styles.bulletPoint}>• 3 active collaborations maximum</Text>
          <Text style={styles.bulletPoint}>• 8 tracks per project maximum</Text>
          <Text style={styles.bulletPoint}>• 200 MB total storage</Text>

          <Text style={styles.subsectionTitle}>Pro Tier ($4.99/month or $53.89/year)</Text>
          <Text style={styles.bulletPoint}>• Unlimited owned projects</Text>
          <Text style={styles.bulletPoint}>• Unlimited collaborations</Text>
          <Text style={styles.bulletPoint}>• Unlimited tracks per project</Text>
          <Text style={styles.bulletPoint}>• 5 GB total storage</Text>

          <Text style={styles.paragraph}>
            Subscriptions auto-renew unless cancelled at least 24 hours before the renewal date.
            No refunds for partial billing periods. We reserve the right to change pricing with
            30 days notice.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>5. Your Content and Ownership</Text>

          <Text style={styles.subsectionTitle}>You Own Your Content</Text>
          <Text style={styles.paragraph}>
            You retain full ownership of all audio files, projects, and content you upload to
            Kollab. We do not claim any ownership rights to your music.
          </Text>

          <Text style={styles.subsectionTitle}>License to Kollab</Text>
          <Text style={styles.paragraph}>
            By uploading content, you grant us a limited license to:
          </Text>
          <Text style={styles.bulletPoint}>• Store and process your files on our servers</Text>
          <Text style={styles.bulletPoint}>• Display content to collaborators you invite</Text>
          <Text style={styles.bulletPoint}>• Generate waveforms and audio analysis data</Text>
          <Text style={styles.bulletPoint}>• Create backups for service reliability</Text>
          <Text style={styles.paragraph}>
            This license ends when you delete your content or account.
          </Text>

          <Text style={styles.subsectionTitle}>Content Responsibility</Text>
          <Text style={styles.paragraph}>
            You are solely responsible for ensuring you have the rights to upload content. Do not
            upload copyrighted material you don't own or have permission to use.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>6. Collaboration Terms</Text>
          <Text style={styles.paragraph}>
            When collaborating with other users:
          </Text>
          <Text style={styles.bulletPoint}>• Project owners control collaborator permissions</Text>
          <Text style={styles.bulletPoint}>• Permissions include: upload, edit, delete, comment, download, invite, export</Text>
          <Text style={styles.bulletPoint}>• Collaborators can be removed at any time by the project owner</Text>
          <Text style={styles.bulletPoint}>• Revenue splits and ownership agreements are between collaborators</Text>
          <Text style={styles.paragraph}>
            Kollab is NOT a party to any agreements between collaborators. We provide tools to
            facilitate collaboration but do not mediate disputes or enforce revenue arrangements.
            Document your agreements externally.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>7. Acceptable Use Policy</Text>
          <Text style={styles.paragraph}>
            You agree NOT to:
          </Text>
          <Text style={styles.bulletPoint}>• Upload content you don't have rights to</Text>
          <Text style={styles.bulletPoint}>• Upload malware, viruses, or harmful code</Text>
          <Text style={styles.bulletPoint}>• Harass, threaten, or abuse other users</Text>
          <Text style={styles.bulletPoint}>• Spam or send unsolicited content</Text>
          <Text style={styles.bulletPoint}>• Attempt to bypass security or subscription limits</Text>
          <Text style={styles.bulletPoint}>• Use the Service for illegal activities</Text>
          <Text style={styles.bulletPoint}>• Impersonate others or misrepresent your identity</Text>
          <Text style={styles.bulletPoint}>• Scrape, crawl, or automate access to the Service</Text>
          <Text style={styles.bulletPoint}>• Reverse engineer or decompile the app</Text>
          <Text style={styles.paragraph}>
            Violation may result in immediate account termination without refund.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>8. Service Availability</Text>
          <Text style={styles.paragraph}>
            We strive to provide reliable service, but:
          </Text>
          <Text style={styles.bulletPoint}>• We do NOT guarantee 100% uptime</Text>
          <Text style={styles.bulletPoint}>• Maintenance may occur with or without notice</Text>
          <Text style={styles.bulletPoint}>• Features may be modified or discontinued</Text>
          <Text style={styles.bulletPoint}>• We are NOT liable for data loss</Text>
          <Text style={styles.paragraph}>
            IMPORTANT: Always maintain your own backups of important audio files. While we take
            reasonable precautions, we cannot guarantee against data loss due to technical
            failures, security incidents, or other unforeseen events.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>9. Account Termination</Text>
          <Text style={styles.paragraph}>
            We may suspend or terminate your account if you:
          </Text>
          <Text style={styles.bulletPoint}>• Violate these Terms</Text>
          <Text style={styles.bulletPoint}>• Engage in abusive behavior</Text>
          <Text style={styles.bulletPoint}>• Upload infringing content repeatedly</Text>
          <Text style={styles.bulletPoint}>• Fail to pay subscription fees</Text>
          <Text style={styles.bulletPoint}>• Are inactive for extended periods (12+ months)</Text>
          <Text style={styles.paragraph}>
            You may delete your account at any time from Settings. Upon deletion, all your data
            will be permanently removed and cannot be recovered.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>10. Intellectual Property</Text>
          <Text style={styles.paragraph}>
            The Kollab platform, including all software, design, logos, and features, is owned
            by us and protected by intellectual property laws. You may not copy, modify,
            distribute, sell, or lease any part of our Service without written permission.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>11. Disclaimer of Warranties</Text>
          <Text style={styles.paragraph}>
            THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND,
            EXPRESS OR IMPLIED. WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED,
            ERROR-FREE, OR COMPLETELY SECURE.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>12. Limitation of Liability</Text>
          <Text style={styles.paragraph}>
            TO THE MAXIMUM EXTENT PERMITTED BY LAW, KOLLAB SHALL NOT BE LIABLE FOR ANY INDIRECT,
            INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO:
          </Text>
          <Text style={styles.bulletPoint}>• Loss of data, revenue, or profits</Text>
          <Text style={styles.bulletPoint}>• Service interruptions</Text>
          <Text style={styles.bulletPoint}>• Unauthorized access to your account</Text>
          <Text style={styles.bulletPoint}>• Actions of other users or collaborators</Text>
          <Text style={styles.bulletPoint}>• Third-party content or services</Text>
          <Text style={styles.paragraph}>
            Our total liability shall not exceed the amount you paid us in the 12 months
            preceding the claim.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>13. Indemnification</Text>
          <Text style={styles.paragraph}>
            You agree to indemnify and hold Kollab harmless from any claims, damages, or expenses
            arising from your use of the Service, your content, or your violation of these Terms.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>14. Dispute Resolution</Text>
          <Text style={styles.paragraph}>
            Any disputes arising from these Terms or your use of the Service shall be resolved
            through binding arbitration, except where prohibited by law. Class action lawsuits
            and class-wide arbitrations are waived. For disputes under $10,000, you may choose
            small claims court instead.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>15. Governing Law</Text>
          <Text style={styles.paragraph}>
            These Terms are governed by the laws of the State of Delaware, United States,
            without regard to conflict of law principles.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>16. Severability</Text>
          <Text style={styles.paragraph}>
            If any provision of these Terms is found unenforceable, the remaining provisions
            will continue in full force and effect.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>17. Contact Information</Text>
          <Text style={styles.paragraph}>
            Questions about these Terms? Contact us:
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
