import React, { useState, useEffect } from 'react'
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
import { useAuth } from '../contexts/AuthContext'
import { getUserUsageStats, SubscriptionTier as SubTier } from '../utils/subscriptionLimits'

interface PlanOption {
  id: string
  name: string
  price: number
  period: 'month' | 'year'
  features: string[]
  highlighted?: boolean
  currentPlan?: boolean
}

export default function SubscriptionScreen({ navigation }: any) {
  const { user } = useAuth()
  const [selectedTier, setSelectedTier] = useState<string>('free')
  const [billingPeriod, setBillingPeriod] = useState<'month' | 'year'>('month')
  const [currentTier, setCurrentTier] = useState<SubTier>('free')
  const [usage, setUsage] = useState<{ ownedProjects: number; activeCollabs: number } | null>(null)

  useEffect(() => {
    if (user?.id) {
      loadUsageStats()
    }
  }, [user?.id])

  const loadUsageStats = async () => {
    if (!user?.id) return
    const stats = await getUserUsageStats(user.id)
    if (stats) {
      setCurrentTier(stats.tier)
      setUsage(stats.usage)
    }
  }

  const subscriptionTiers: PlanOption[] = [
    {
      id: 'free',
      name: 'Free',
      price: 0,
      period: 'month',
      currentPlan: currentTier === 'free',
      features: [
        '3 owned projects',
        'Collaborate on 3 projects',
        '8 tracks per project',
        '200 MB storage',
      ],
    },
    {
      id: 'pro',
      name: 'Pro',
      price: billingPeriod === 'month' ? 4.99 : 53.89,
      period: billingPeriod,
      highlighted: currentTier === 'free',
      currentPlan: currentTier === 'pro',
      features: [
        'Unlimited owned projects',
        'Unlimited collaborations',
        'Unlimited tracks per project',
        '5 GB storage',
      ],
    },
  ]

  const handleSubscribe = (tierId: string) => {
    if (tierId === currentTier) {
      Alert.alert('Current Plan', `You are already on the ${tierId === 'free' ? 'Free' : 'Pro'} plan`)
      return
    }

    if (tierId === 'free' && currentTier === 'pro') {
      Alert.alert(
        'Downgrade',
        'To downgrade to Free, please manage your subscription in Settings.',
        [{ text: 'OK' }]
      )
      return
    }

    Alert.alert(
      'Coming Soon',
      'Subscription management with Stripe will be available soon. Stay tuned!',
      [{ text: 'OK' }]
    )

    // TODO: Implement Stripe checkout
    // const tier = subscriptionTiers.find(t => t.id === tierId)
    // Navigate to Stripe checkout or in-app purchase flow
  }

  const handleManageSubscription = () => {
    Alert.alert(
      'Manage Subscription',
      'Subscription management portal will be available soon.',
      [{ text: 'OK' }]
    )

    // TODO: Open Stripe customer portal
  }

  const renderTier = (tier: PlanOption) => {
    const isSelected = selectedTier === tier.id
    const savings = tier.period === 'year' ? Math.round((1 - tier.price / (tier.price / 12 * 12)) * 100) : 0

    return (
      <TouchableOpacity
        key={tier.id}
        style={[
          styles.tierCard,
          tier.highlighted && styles.tierCardHighlighted,
          isSelected && styles.tierCardSelected,
        ]}
        onPress={() => setSelectedTier(tier.id)}
        activeOpacity={0.8}
      >
        {tier.highlighted && (
          <View style={styles.popularBadge}>
            <Text style={styles.popularText}>MOST POPULAR</Text>
          </View>
        )}

        {tier.currentPlan && (
          <View style={styles.currentBadge}>
            <Text style={styles.currentText}>CURRENT PLAN</Text>
          </View>
        )}

        <Text style={styles.tierName}>{tier.name}</Text>

        <View style={styles.priceContainer}>
          <Text style={styles.currency}>$</Text>
          <Text style={styles.price}>{tier.price}</Text>
          <Text style={styles.period}>/{tier.period}</Text>
        </View>

        {tier.period === 'year' && tier.price > 0 && (
          <Text style={styles.savings}>Save 10% annually</Text>
        )}

        <View style={styles.featuresContainer}>
          {tier.features.map((feature, index) => (
            <View key={index} style={styles.feature}>
              <Ionicons name="checkmark-circle" size={20} color={Colors.primary} />
              <Text style={styles.featureText}>{feature}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity
          style={[
            styles.selectButton,
            tier.highlighted && styles.selectButtonHighlighted,
            tier.currentPlan && styles.selectButtonCurrent,
          ]}
          onPress={() => handleSubscribe(tier.id)}
          activeOpacity={0.8}
        >
          <Text
            style={[
              styles.selectButtonText,
              tier.highlighted && styles.selectButtonTextHighlighted,
            ]}
          >
            {tier.currentPlan ? 'Current Plan' : isSelected ? 'Subscribe' : 'Select Plan'}
          </Text>
        </TouchableOpacity>
      </TouchableOpacity>
    )
  }

  const currentPlan = subscriptionTiers.find(tier => tier.currentPlan)

  return (
    <SafeAreaView style={styles.container}>
      <CompactHeader
        title="Subscription"
        subtitle={currentPlan ? `${currentPlan.name} Plan` : 'Manage Your Plan'}
        onBack={() => navigation.goBack()}
      />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Usage Stats (Free tier only) */}
        {currentTier === 'free' && usage && (
          <View style={styles.usageSection}>
            <Text style={styles.usageTitle}>Your Usage</Text>
            <View style={styles.usageRow}>
              <View style={styles.usageItem}>
                <Text style={styles.usageValue}>{usage.ownedProjects}/3</Text>
                <Text style={styles.usageLabel}>Projects</Text>
              </View>
              <View style={styles.usageDivider} />
              <View style={styles.usageItem}>
                <Text style={styles.usageValue}>{usage.activeCollabs}/3</Text>
                <Text style={styles.usageLabel}>Collaborations</Text>
              </View>
            </View>
          </View>
        )}

        {/* Billing Period Toggle */}
        <View style={styles.periodToggle}>
          <TouchableOpacity
            style={[
              styles.periodButton,
              billingPeriod === 'month' && styles.periodButtonActive,
            ]}
            onPress={() => setBillingPeriod('month')}
          >
            <Text
              style={[
                styles.periodButtonText,
                billingPeriod === 'month' && styles.periodButtonTextActive,
              ]}
            >
              Monthly
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.periodButton,
              billingPeriod === 'year' && styles.periodButtonActive,
            ]}
            onPress={() => setBillingPeriod('year')}
          >
            <Text
              style={[
                styles.periodButtonText,
                billingPeriod === 'year' && styles.periodButtonTextActive,
              ]}
            >
              Yearly
            </Text>
            <View style={styles.saveBadge}>
              <Text style={styles.saveText}>SAVE 10%</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Subscription Tiers */}
        <View style={styles.tiersContainer}>
          {subscriptionTiers.map((tier) => renderTier(tier))}
        </View>

        {/* FAQ */}
        <View style={styles.faqSection}>
          <Text style={styles.faqTitle}>Frequently Asked Questions</Text>

          <View style={styles.faqItem}>
            <Text style={styles.faqQuestion}>Can I cancel anytime?</Text>
            <Text style={styles.faqAnswer}>
              Yes! You can cancel your subscription at any time. You'll continue to have access
              until the end of your billing period.
            </Text>
          </View>

          <View style={styles.faqItem}>
            <Text style={styles.faqQuestion}>What payment methods do you accept?</Text>
            <Text style={styles.faqAnswer}>
              We accept all major credit cards, debit cards, and PayPal through our secure
              payment processor, Stripe.
            </Text>
          </View>

          <View style={styles.faqItem}>
            <Text style={styles.faqQuestion}>Can I upgrade or downgrade my plan?</Text>
            <Text style={styles.faqAnswer}>
              Absolutely! You can change your plan at any time. Upgrades take effect
              immediately, and downgrades occur at the end of your billing cycle.
            </Text>
          </View>
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
  periodToggle: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.xxs,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  periodButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    gap: Spacing.xs,
  },
  periodButtonActive: {
    backgroundColor: Colors.primary,
  },
  periodButtonText: {
    ...Typography.bodyLarge,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  periodButtonTextActive: {
    color: Colors.text,
  },
  saveBadge: {
    backgroundColor: Colors.success,
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  saveText: {
    ...Typography.tiny,
    color: Colors.backgroundDark,
    fontWeight: '700',
  },
  tiersContainer: {
    gap: Spacing.md,
  },
  tierCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 2,
    borderColor: Colors.border,
    position: 'relative',
  },
  tierCardHighlighted: {
    borderColor: Colors.primary,
  },
  tierCardSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.surfaceElevated,
  },
  popularBadge: {
    position: 'absolute',
    top: -10,
    right: Spacing.lg,
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xxs,
    borderRadius: BorderRadius.sm,
  },
  popularText: {
    ...Typography.caption,
    color: Colors.text,
    fontWeight: '700',
  },
  currentBadge: {
    position: 'absolute',
    top: -10,
    right: Spacing.lg,
    backgroundColor: Colors.success,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xxs,
    borderRadius: BorderRadius.sm,
  },
  currentText: {
    ...Typography.caption,
    color: Colors.backgroundDark,
    fontWeight: '700',
  },
  tierName: {
    ...Typography.h1,
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: Spacing.xs,
  },
  currency: {
    ...Typography.h2,
    color: Colors.text,
  },
  price: {
    ...Typography.hero,
    color: Colors.text,
    fontSize: 48,
    fontWeight: '700',
  },
  period: {
    ...Typography.bodyLarge,
    color: Colors.textSecondary,
    marginLeft: Spacing.xxs,
  },
  savings: {
    ...Typography.body,
    color: Colors.success,
    marginBottom: Spacing.md,
  },
  featuresContainer: {
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  feature: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  featureText: {
    ...Typography.body,
    color: Colors.text,
    flex: 1,
  },
  selectButton: {
    backgroundColor: Colors.border,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  selectButtonHighlighted: {
    backgroundColor: Colors.primary,
  },
  selectButtonCurrent: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  selectButtonText: {
    ...Typography.bodyLarge,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  selectButtonTextHighlighted: {
    color: Colors.text,
  },
  faqSection: {
    marginTop: Spacing.xl,
    backgroundColor: Colors.surface,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  faqTitle: {
    ...Typography.h2,
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  faqItem: {
    marginBottom: Spacing.lg,
  },
  faqQuestion: {
    ...Typography.bodyLarge,
    color: Colors.text,
    fontWeight: '600',
    marginBottom: Spacing.xs,
  },
  faqAnswer: {
    ...Typography.body,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  bottomSpacer: {
    height: Spacing.xxxl,
  },
  usageSection: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  usageTitle: {
    ...Typography.h3,
    color: Colors.text,
    marginBottom: Spacing.md,
    textAlign: 'center',
  },
  usageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  usageItem: {
    flex: 1,
    alignItems: 'center',
  },
  usageValue: {
    ...Typography.h1,
    color: Colors.primary,
    fontWeight: '700',
  },
  usageLabel: {
    ...Typography.body,
    color: Colors.textSecondary,
    marginTop: Spacing.xxs,
  },
  usageDivider: {
    width: 1,
    height: 40,
    backgroundColor: Colors.border,
    marginHorizontal: Spacing.lg,
  },
})
