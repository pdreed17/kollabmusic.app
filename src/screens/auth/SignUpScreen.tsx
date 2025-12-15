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
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { authService } from '../../services/auth.service'
import { Colors, Typography, Spacing, BorderRadius } from '../../constants/theme'

type Props = {
  navigation: NativeStackNavigationProp<any>
}

export function SignupScreen({ navigation }: Props) {
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSignup = async () => {
    if (!email || !username || !firstName || !password) {
      Alert.alert('Error', 'Please fill in all required fields')
      return
    }

    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters')
      return
    }

    setLoading(true)
    const { error } = await authService.signUp(
      email, 
      password, 
      username, 
      firstName, 
      lastName
    )
    setLoading(false)

    if (error) {
      Alert.alert('Signup Failed', error.message)
    } else {
      Alert.alert('Success', 'Account created! You can now sign in.')
    }
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
              <Text style={styles.title}>Create Account</Text>
              <Text style={styles.subtitle}>Join the collaboration</Text>
            </View>

            {/* Form */}
            <View style={styles.form}>
            <View style={styles.row}>
              <View style={styles.halfInputGroup}>
                <Text style={styles.label}>First Name *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="John"
                  placeholderTextColor={Colors.textTertiary}
                  value={firstName}
                  onChangeText={setFirstName}
                  autoCapitalize="words"
                  autoComplete="given-name"
                />
              </View>

              <View style={styles.halfInputGroup}>
                <Text style={styles.label}>Last Name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Doe"
                  placeholderTextColor={Colors.textTertiary}
                  value={lastName}
                  onChangeText={setLastName}
                  autoCapitalize="words"
                  autoComplete="family-name"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email *</Text>
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

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Username *</Text>
              <TextInput
                style={styles.input}
                placeholder="Your artist name or username"
                placeholderTextColor={Colors.textTertiary}
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoComplete="username"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Password *</Text>
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor={Colors.textTertiary}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoComplete="password"
              />
              <Text style={styles.hint}>At least 6 characters</Text>
            </View>

            <TouchableOpacity
              style={styles.signupButton}
              onPress={handleSignup}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={Colors.text} />
              ) : (
                <Text style={styles.signupButtonText}>Create Account</Text>
              )}
            </TouchableOpacity>

              <TouchableOpacity
                style={styles.loginLink}
                onPress={() => navigation.navigate('Login')}
              >
                <Text style={styles.loginLinkText}>
                  Already have an account? <Text style={styles.loginLinkBold}>Sign in</Text>
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
    minHeight: 700,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: Spacing.xxxl,
  },
 logo: {
    width: 200,           // ← UPDATED
    height: 200,          // ← UPDATED
    marginBottom: Spacing.lg,
  },
  logoEmoji: {
    fontSize: 40,
  },
  title: {
    ...Typography.hero,
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  subtitle: {
    ...Typography.body,
    color: Colors.textSecondary,
  },
  form: {
    gap: Spacing.md,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  inputGroup: {
    gap: Spacing.xs,
  },
  halfInputGroup: {
    flex: 1,
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
  hint: {
    ...Typography.caption,
    color: Colors.textTertiary,
  },
  signupButton: {
    backgroundColor: Colors.primary,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    marginTop: Spacing.md,
  },
  signupButtonText: {
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
})