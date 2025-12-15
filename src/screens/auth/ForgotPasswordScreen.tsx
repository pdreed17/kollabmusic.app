import React, { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { authService } from '../../services/auth.service'
import { Colors, Typography, Spacing, BorderRadius } from '../../constants/theme'

type Props = {
  navigation: NativeStackNavigationProp<any>
}

export function ForgotPasswordScreen({ navigation }: Props) {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [emailSent, setEmailSent] = useState(false)

  const handleResetPassword = async () => {
    if (!email) {
      Alert.alert('Error', 'Please enter your email address')
      return
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      Alert.alert('Error', 'Please enter a valid email address')
      return
    }

    setLoading(true)
    const { error } = await authService.resetPassword(email)
    setLoading(false)

    if (error) {
      Alert.alert('Error', error.message)
    } else {
      setEmailSent(true)
    }
  }

  if (emailSent) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <View style={styles.successContainer}>
            <View style={styles.iconCircle}>
              <Ionicons name="mail" size={48} color={Colors.primary} />
            </View>
            <Text style={styles.successTitle}>Check Your Email</Text>
            <Text style={styles.successMessage}>
              We've sent password reset instructions to {email}
            </Text>
            <Text style={styles.successSubtext}>
              Click the link in the email to reset your password. The link will expire in 1 hour.
            </Text>

            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.navigate('Login')}
            >
              <Ionicons name="arrow-back" size={20} color={Colors.text} />
              <Text style={styles.backButtonText}>Back to Login</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.resendLink}
              onPress={() => setEmailSent(false)}
            >
              <Text style={styles.resendLinkText}>
                Didn't receive the email? <Text style={styles.resendLinkBold}>Try again</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.content}>
            {/* Header */}
            <TouchableOpacity
              style={styles.backLink}
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="arrow-back" size={24} color={Colors.textSecondary} />
            </TouchableOpacity>

            {/* Logo Section */}
            <View style={styles.logoContainer}>
              <Image
                source={require('../../../assets/logo-full.png')}
                style={styles.logo}
                resizeMode="contain"
              />
              <Text style={styles.title}>Forgot Password?</Text>
              <Text style={styles.subtitle}>
                No worries! Enter your email and we'll send you reset instructions.
              </Text>
            </View>

            {/* Form */}
            <View style={styles.form}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Email</Text>
                <TextInput
                  style={styles.input}
                  placeholder="you@example.com"
                  placeholderTextColor={Colors.textTertiary}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoComplete="email"
                />
              </View>

              <TouchableOpacity
                style={styles.resetButton}
                onPress={handleResetPassword}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color={Colors.text} />
                ) : (
                  <Text style={styles.resetButtonText}>Send Reset Link</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.loginLink}
                onPress={() => navigation.navigate('Login')}
              >
                <Text style={styles.loginLinkText}>
                  Remember your password? <Text style={styles.loginLinkBold}>Sign in</Text>
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.backgroundDark,
  },
  keyboardAvoid: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: Spacing.xxxl,
  },
  content: {
    flex: 1,
    padding: Spacing.lg,
    justifyContent: 'center',
    minHeight: 600,
  },
  backLink: {
    marginBottom: Spacing.lg,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: Spacing.xxxl,
  },
  logo: {
    width: 200,
    height: 200,
    marginBottom: Spacing.lg,
  },
  title: {
    ...Typography.hero,
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  subtitle: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: Spacing.md,
  },
  form: {
    gap: Spacing.md,
  },
  inputGroup: {
    gap: Spacing.xs,
  },
  label: {
    ...Typography.body,
    fontWeight: '600',
    color: Colors.text,
  },
  input: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    color: Colors.text,
    ...Typography.body,
  },
  resetButton: {
    backgroundColor: Colors.primary,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    marginTop: Spacing.md,
  },
  resetButtonText: {
    color: Colors.text,
    ...Typography.bodyLarge,
    fontWeight: '600',
  },
  loginLink: {
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  loginLinkText: {
    ...Typography.body,
    color: Colors.textSecondary,
  },
  loginLinkBold: {
    color: Colors.primary,
    fontWeight: '600',
  },
  successContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: `${Colors.primary}20`,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  successTitle: {
    ...Typography.h1,
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  successMessage: {
    ...Typography.bodyLarge,
    color: Colors.text,
    textAlign: 'center',
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.lg,
  },
  successSubtext: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.xxxl,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  backButtonText: {
    color: Colors.text,
    ...Typography.bodyLarge,
    fontWeight: '600',
  },
  resendLink: {
    alignItems: 'center',
    marginTop: Spacing.md,
  },
  resendLinkText: {
    ...Typography.body,
    color: Colors.textSecondary,
  },
  resendLinkBold: {
    color: Colors.primary,
    fontWeight: '600',
  },
})
