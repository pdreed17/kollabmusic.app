import React from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { Colors, Typography, Spacing, BorderRadius } from '../constants/theme'
import CompactHeader from '../components/CompactHeader'

interface Invoice {
  id: string
  date: string
  amount: number
  status: 'paid' | 'pending' | 'failed'
  plan: string
  period: string
  invoiceUrl?: string
}

export default function BillingHistoryScreen({ navigation }: any) {
  // Empty invoices until Stripe integration is complete
  // In production, this would come from Stripe API
  const invoices: Invoice[] = []

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const getStatusColor = (status: Invoice['status']) => {
    switch (status) {
      case 'paid':
        return Colors.success
      case 'pending':
        return Colors.warning
      case 'failed':
        return Colors.error
      default:
        return Colors.textSecondary
    }
  }

  const getStatusIcon = (status: Invoice['status']) => {
    switch (status) {
      case 'paid':
        return 'checkmark-circle'
      case 'pending':
        return 'time'
      case 'failed':
        return 'close-circle'
      default:
        return 'help-circle'
    }
  }

  const handleDownloadInvoice = (invoice: Invoice) => {
    // TODO: Implement invoice download from Stripe
    if (__DEV__) console.log('Download invoice:', invoice.id)
    // For now, show a coming soon message
    Alert.alert('Coming Soon', 'Invoice downloads will be available when billing is set up.')
  }

  const renderInvoice = (invoice: Invoice) => (
    <View key={invoice.id} style={styles.invoiceCard}>
      <View style={styles.invoiceHeader}>
        <View style={styles.invoiceLeft}>
          <View style={styles.invoiceIcon}>
            <Ionicons name="receipt-outline" size={24} color={Colors.primary} />
          </View>
          <View style={styles.invoiceInfo}>
            <Text style={styles.invoicePlan}>{invoice.plan}</Text>
            <Text style={styles.invoicePeriod}>{invoice.period}</Text>
            <Text style={styles.invoiceDate}>{formatDate(invoice.date)}</Text>
          </View>
        </View>

        <View style={styles.invoiceRight}>
          <Text style={styles.invoiceAmount}>${invoice.amount.toFixed(2)}</Text>
          <View style={[styles.statusBadge, { backgroundColor: `${getStatusColor(invoice.status)}20` }]}>
            <Ionicons
              name={getStatusIcon(invoice.status) as any}
              size={14}
              color={getStatusColor(invoice.status)}
            />
            <Text style={[styles.statusText, { color: getStatusColor(invoice.status) }]}>
              {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.invoiceActions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleDownloadInvoice(invoice)}
          activeOpacity={0.7}
        >
          <Ionicons name="download-outline" size={18} color={Colors.primary} />
          <Text style={styles.actionButtonText}>Download PDF</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => {}}
          activeOpacity={0.7}
        >
          <Ionicons name="mail-outline" size={18} color={Colors.primary} />
          <Text style={styles.actionButtonText}>Email Invoice</Text>
        </TouchableOpacity>
      </View>
    </View>
  )

  return (
    <SafeAreaView style={styles.container}>
      <CompactHeader
        title="Billing History"
        subtitle="Transaction History"
        onBack={() => navigation.goBack()}
      />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Summary Card */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Current Plan</Text>
            <Text style={styles.summaryValue}>Free Plan</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Next Billing Date</Text>
            <Text style={styles.summaryValue}>—</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Total Spent</Text>
            <Text style={styles.summaryValue}>$0.00</Text>
          </View>
        </View>

        {/* Invoices List */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payment History</Text>

          {invoices.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="receipt-outline" size={64} color={Colors.textSecondary} />
              <Text style={styles.emptyTitle}>No Invoices Yet</Text>
              <Text style={styles.emptyText}>
                Your payment history will appear here once you subscribe to a plan
              </Text>
              <TouchableOpacity
                style={styles.upgradeButton}
                onPress={() => navigation.navigate('Subscription')}
                activeOpacity={0.8}
              >
                <Text style={styles.upgradeButtonText}>View Plans</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.invoicesList}>
              {invoices.map((invoice) => renderInvoice(invoice))}
            </View>
          )}
        </View>

        {/* Payment Method Info */}
        <View style={styles.infoCard}>
          <Ionicons name="information-circle" size={20} color={Colors.primary} />
          <Text style={styles.infoText}>
            All payments are processed securely through Stripe. Need help with billing? Contact
            support@kollabapp.com
          </Text>
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
  summaryCard: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.lg,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryLabel: {
    ...Typography.caption,
    color: Colors.textSecondary,
    marginBottom: Spacing.xxs,
    textAlign: 'center',
  },
  summaryValue: {
    ...Typography.bodyLarge,
    color: Colors.text,
    fontWeight: '600',
    textAlign: 'center',
  },
  summaryDivider: {
    width: 1,
    backgroundColor: Colors.border,
    marginHorizontal: Spacing.xs,
  },
  section: {
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    ...Typography.h3,
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  invoicesList: {
    gap: Spacing.sm,
  },
  invoiceCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  invoiceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  invoiceLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
  },
  invoiceIcon: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
  },
  invoiceInfo: {
    flex: 1,
  },
  invoicePlan: {
    ...Typography.bodyLarge,
    color: Colors.text,
    fontWeight: '600',
  },
  invoicePeriod: {
    ...Typography.body,
    color: Colors.textSecondary,
  },
  invoiceDate: {
    ...Typography.caption,
    color: Colors.textSecondary,
    marginTop: Spacing.xxs,
  },
  invoiceRight: {
    alignItems: 'flex-end',
  },
  invoiceAmount: {
    ...Typography.h3,
    color: Colors.text,
    fontWeight: '700',
    marginBottom: Spacing.xs,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xs,
    paddingVertical: Spacing.xxs,
    borderRadius: BorderRadius.sm,
    gap: Spacing.xxs,
  },
  statusText: {
    ...Typography.caption,
    fontWeight: '600',
  },
  invoiceActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surfaceElevated,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    gap: Spacing.xs,
  },
  actionButtonText: {
    ...Typography.body,
    color: Colors.primary,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing.xxxl,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.lg,
  },
  emptyTitle: {
    ...Typography.h3,
    color: Colors.text,
    marginTop: Spacing.md,
    marginBottom: Spacing.xs,
  },
  emptyText: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.xl,
  },
  upgradeButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  upgradeButtonText: {
    ...Typography.bodyLarge,
    color: Colors.text,
    fontWeight: '600',
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.sm,
  },
  infoText: {
    ...Typography.body,
    color: Colors.textSecondary,
    flex: 1,
    lineHeight: 20,
  },
  bottomSpacer: {
    height: Spacing.xxxl,
  },
})
