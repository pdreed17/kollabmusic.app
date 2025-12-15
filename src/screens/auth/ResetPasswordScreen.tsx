import React, { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
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
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { Colors, Typography, Spacing, BorderRadius } from '../../constants/theme'

type Props = {
  navigation: NativeStackNavigationProp<any>
}

export function ResetPasswordScreen({ navigation }: Props) {
  const { clearPasswordRecovery, signOut } = useAuth()
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const validatePassword = (password: string): string | null => {
    if (password.length < 8) {
      return 'Password must be at least 8 characters long'
    }
    if (!/[A-Z]/.test(password)) {
      return 'Password must contain at least one uppercase letter'
    }
    if (!/[a-z]/.test(password)) {
      return 'Password must contain at least one lowercase letter'
    }
    if (!/[0-9]/.test(password)) {
      return 'Password must contain at least one number'
    }
    return null
  }

  const handleResetPassword = async () => {
    if (!newPassword || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all fields')
      return
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match')
      return
    }

    const passwordError = validatePassword(newPassword)
    if (passwordError) {
      Alert.alert('Invalid Password', passwordError)
      return
    }

    setLoading(true)

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      })

      if (error) throw error

      // Clear recovery mode and sign out so user can sign in with new password
      clearPasswordRecovery()
      await signOut()
      setSuccess(true)
    } catch (error: any) {
      console.error('Reset password error:', error)
      Alert.alert('Error', error.message || 'Failed to reset password. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const getPasswordStrength = (password: string): { strength: string; color: string } => {
    if (password.length === 0) return { strength: '', color: Colors.border }
    if (password.length < 8) return { strength: 'Weak', color: Colors.error }

    let score = 0
    if (/[A-Z]/.test(password)) score++
    if (/[a-z]/.test(password)) score++
    if (/[0-9]/.test(password)) score++
    if (/[^A-Za-z0-9]/.test(password)) score++
    if (password.length >= 12) score++

    if (score <= 2) return { strength: 'Weak', color: Colors.error }
    if (score <= 3) return { strength: 'Medium', color: Colors.warning }
    return { strength: 'Strong', color: Colors.success }
  }

  const passwordStrength = getPasswordStrength(newPassword)

  if (success) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.successContainer}>
          <View style={styles.iconCircle}>
            <Ionicons name="checkmark-circle" size={64} color={Colors.success} />
          </View>
          <Text style={styles.successTitle}>Password Reset!</Text>
          <Text style={styles.successMessage}>
            Your password has been successfully updated.
          </Text>
          <Text style={styles.successSubtext}>
            You can now sign in with your new password.
          </Text>

          <TouchableOpacity
            style={styles.loginButton}
            onPress={() => navigation.navigate('Login')}
          >
            <Ionicons name="log-in-outline" size={20} color={Colors.text} />
            <Text style={styles.loginButtonText}>Sign In</Text>
          </TouchableOpacity>
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
            {/* Logo Section */}
            <View style={styles.logoContainer}>
              <Image
                source={require('../../../assets/logo-full.png')}
                style={styles.logo}
                resizeMode="contain"
              />
              <Text style={styles.title}>Set New Password</Text>
              <Text style={styles.subtitle}>
                Create a strong password to secure your account
              </Text>
            </View>

            {/* Form */}
            <View style={styles.form}>
              {/* New Password */}
              <View style={styles.inputSection}>
                <Text style={styles.label}>New Password</Text>
                <View style={styles.inputContainer}>
                  <TextInput
                    style={styles.input}
                    value={newPassword}
                    onChangeText={setNewPassword}
                    placeholder="Enter new password"
                    placeholderTextColor={Colors.textTertiary}
                    secureTextEntry={!showNewPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <TouchableOpacity
                    style={styles.eyeButton}
                    onPress={() => setShowNewPassword(!showNewPassword)}
                  >
                    <Ionicons
                      name={showNewPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={24}
                      color={Colors.textSecondary}
                    />
                  </TouchableOpacity>
                </View>

                {/* Password Strength Indicator */}
                {newPassword.length > 0 && (
                  <View style={styles.strengthContainer}>
                    <View style={styles.strengthBar}>
                      <View
                        style={[
                          styles.strengthFill,
                          {
                            width:
                              passwordStrength.strength === 'Weak'
                                ? '33%'
                                : passwordStrength.strength === 'Medium'
                                ? '66%'
                                : '100%',
                            backgroundColor: passwordStrength.color,
                          },
                        ]}
                      />
                    </View>
                    <Text style={[styles.strengthText, { color: passwordStrength.color }]}>
                      {passwordStrength.strength}
                    </Text>
                  </View>
                )}
              </View>

              {/* Confirm Password */}
              <View style={styles.inputSection}>
                <Text style={styles.label}>Confirm Password</Text>
                <View style={styles.inputContainer}>
                  <TextInput
                    style={styles.input}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    placeholder="Re-enter new password"
                    placeholderTextColor={Colors.textTertiary}
                    secureTextEntry={!showConfirmPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <TouchableOpacity
                    style={styles.eyeButton}
                    onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    <Ionicons
                      name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={24}
                      color={Colors.textSecondary}
                    />
                  </TouchableOpacity>
                </View>

                {confirmPassword.length > 0 && confirmPassword !== newPassword && (
                  <Text style={styles.errorText}>Passwords do not match</Text>
                )}
              </View>

              {/* Password Requirements */}
              <View style={styles.requirementsCard}>
                <Text style={styles.requirementsTitle}>Password Requirements:</Text>
                <View style={styles.requirement}>
                  <Ionicons
                    name={newPassword.length >= 8 ? 'checkmark-circle' : 'ellipse-outline'}
                    size={16}
                    color={newPassword.length >= 8 ? Colors.success : Colors.textSecondary}
                  />
                  <Text style={styles.requirementText}>At least 8 characters</Text>
                </View>
                <View style={styles.requirement}>
                  <Ionicons
                    name={/[A-Z]/.test(newPassword) ? 'checkmark-circle' : 'ellipse-outline'}
                    size={16}
                    color={/[A-Z]/.test(newPassword) ? Colors.success : Colors.textSecondary}
                  />
                  <Text style={styles.requirementText}>One uppercase letter</Text>
                </View>
                <View style={styles.requirement}>
                  <Ionicons
                    name={/[a-z]/.test(newPassword) ? 'checkmark-circle' : 'ellipse-outline'}
                    size={16}
                    color={/[a-z]/.test(newPassword) ? Colors.success : Colors.textSecondary}
                  />
                  <Text style={styles.requirementText}>One lowercase letter</Text>
                </View>
                <View style={styles.requirement}>
                  <Ionicons
                    name={/[0-9]/.test(newPassword) ? 'checkmark-circle' : 'ellipse-outline'}
                    size={16}
                    color={/[0-9]/.test(newPassword) ? Colors.success : Colors.textSecondary}
                  />
                  <Text style={styles.requirementText}>One number</Text>
                </View>
              </View>

              {/* Reset Button */}
              <TouchableOpacity
                style={[styles.resetButton, loading && styles.resetButtonDisabled]}
                onPress={handleResetPassword}
                disabled={loading}
                activeOpacity={0.8}
              >
                {loading ? (
                  <ActivityIndicator color={Colors.text} />
                ) : (
                  <>
                    <Ionicons name="lock-closed" size={20} color={Colors.text} />
                    <Text style={styles.resetButtonText}>Reset Password</Text>
                  </>
                )}
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
  logoContainer: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  logo: {
    width: 150,
    height: 150,
    marginBottom: Spacing.md,
  },
  title: {
    ...Typography.h1,
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
  inputSection: {
    marginBottom: Spacing.sm,
  },
  label: {
    ...Typography.bodyLarge,
    color: Colors.text,
    marginBottom: Spacing.xs,
    fontWeight: '600',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
  },
  input: {
    flex: 1,
    ...Typography.body,
    color: Colors.text,
    paddingVertical: Spacing.md,
  },
  eyeButton: {
    padding: Spacing.xs,
  },
  strengthContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.xs,
    gap: Spacing.sm,
  },
  strengthBar: {
    flex: 1,
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: 2,
    overflow: 'hidden',
  },
  strengthFill: {
    height: '100%',
    borderRadius: 2,
  },
  strengthText: {
    ...Typography.caption,
    fontWeight: '600',
  },
  errorText: {
    ...Typography.caption,
    color: Colors.error,
    marginTop: Spacing.xs,
  },
  requirementsCard: {
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    marginTop: Spacing.sm,
  },
  requirementsTitle: {
    ...Typography.bodyLarge,
    color: Colors.text,
    fontWeight: '600',
    marginBottom: Spacing.sm,
  },
  requirement: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  requirementText: {
    ...Typography.body,
    color: Colors.textSecondary,
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.xs,
    marginTop: Spacing.md,
  },
  resetButtonDisabled: {
    opacity: 0.6,
  },
  resetButtonText: {
    ...Typography.bodyLarge,
    color: Colors.text,
    fontWeight: '600',
  },
  successContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: `${Colors.success}20`,
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
  },
  successSubtext: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.xxxl,
  },
  loginButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },
  loginButtonText: {
    ...Typography.bodyLarge,
    color: Colors.text,
    fontWeight: '600',
  },
})
