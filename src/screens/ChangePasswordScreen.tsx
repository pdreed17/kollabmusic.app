import React, { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../lib/supabase'
import { Colors, Typography, Spacing, BorderRadius } from '../constants/theme'
import CompactHeader from '../components/CompactHeader'

export default function ChangePasswordScreen({ navigation }: any) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)

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

  const handleChangePassword = async () => {
    // Validation
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all fields')
      return
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'New passwords do not match')
      return
    }

    const passwordError = validatePassword(newPassword)
    if (passwordError) {
      Alert.alert('Invalid Password', passwordError)
      return
    }

    if (currentPassword === newPassword) {
      Alert.alert('Error', 'New password must be different from current password')
      return
    }

    setLoading(true)

    try {
      // Update password using Supabase
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      })

      if (error) throw error

      Alert.alert(
        'Success',
        'Your password has been changed successfully',
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ]
      )

      // Clear form
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (error: any) {
      console.error('Change password error:', error)
      Alert.alert('Error', error.message || 'Failed to change password')
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

  return (
    <SafeAreaView style={styles.container}>
      <CompactHeader
        title="Change Password"
        subtitle="Security"
        onBack={() => navigation.goBack()}
      />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.infoCard}>
          <Ionicons name="shield-checkmark" size={24} color={Colors.primary} />
          <Text style={styles.infoText}>
            Choose a strong password to keep your account secure
          </Text>
        </View>

        {/* Current Password */}
        <View style={styles.inputSection}>
          <Text style={styles.label}>Current Password</Text>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              value={currentPassword}
              onChangeText={setCurrentPassword}
              placeholder="Enter current password"
              placeholderTextColor={Colors.textSecondary}
              secureTextEntry={!showCurrentPassword}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity
              style={styles.eyeButton}
              onPress={() => setShowCurrentPassword(!showCurrentPassword)}
            >
              <Ionicons
                name={showCurrentPassword ? 'eye-off-outline' : 'eye-outline'}
                size={24}
                color={Colors.textSecondary}
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* New Password */}
        <View style={styles.inputSection}>
          <Text style={styles.label}>New Password</Text>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="Enter new password"
              placeholderTextColor={Colors.textSecondary}
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
          <Text style={styles.label}>Confirm New Password</Text>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Re-enter new password"
              placeholderTextColor={Colors.textSecondary}
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

        {/* Change Password Button */}
        <TouchableOpacity
          style={[styles.saveButton, loading && styles.saveButtonDisabled]}
          onPress={handleChangePassword}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color={Colors.text} />
          ) : (
            <>
              <Ionicons name="lock-closed" size={20} color={Colors.text} />
              <Text style={styles.saveButtonText}>Change Password</Text>
            </>
          )}
        </TouchableOpacity>

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
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  infoText: {
    ...Typography.body,
    color: Colors.textSecondary,
    flex: 1,
  },
  inputSection: {
    marginBottom: Spacing.lg,
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
    ...Typography.bodyLarge,
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
    marginBottom: Spacing.xl,
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
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.xs,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    ...Typography.bodyLarge,
    color: Colors.text,
    fontWeight: '600',
  },
  bottomSpacer: {
    height: Spacing.xxxl,
  },
})
