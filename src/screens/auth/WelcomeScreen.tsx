import React from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Colors, Typography, Spacing, BorderRadius } from '../../constants/theme'  // ← ADD THIS
// Add full logo at top
<Image source={require('../../assets/logo-full.png')} />

type Props = {
  navigation: NativeStackNavigationProp<any>
}

export function WelcomeScreen({ navigation }: Props) {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Logo Section - UPDATED */}
        <View style={styles.logoContainer}>
          <Image 
            source={require('../../assets/logo-full.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        <Text style={styles.subtitle}>
          Professional music collaboration for everyone
        </Text>

        <View style={styles.featuresContainer}>
          <Text style={styles.features}>
            ✓ Upload WAV, MP3, MP4, FLAC, MIDI{'\n'}
            ✓ Time-stamped feedback{'\n'}
            ✓ Cross-DAW compatible{'\n'}
            ✓ Transparent rights management
          </Text>
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.button, styles.primaryButton]}
            onPress={() => navigation.navigate('SignUp')}
          >
            <Text style={styles.primaryButtonText}>Start Free Trial</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.secondaryButton]}
            onPress={() => navigation.navigate('Login')}
          >
            <Text style={styles.secondaryButtonText}>Sign In</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.disclaimer}>
          14-day free trial • No credit card required
        </Text>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.backgroundDark,  // ← Dark theme
  },
  content: {
    flex: 1,
    padding: Spacing.xl,
    justifyContent: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  logo: {
    width: 160,
    height: 160,
    marginBottom: Spacing.lg,
  },
  subtitle: {
    ...Typography.h2,
    textAlign: 'center',
    color: Colors.text,
    marginBottom: Spacing.xl,
  },
  featuresContainer: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  features: {
    ...Typography.bodyLarge,
    lineHeight: 28,
    color: Colors.text,
  },
  buttonContainer: {
    gap: Spacing.md,
  },
  button: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: Colors.primary,
  },
  primaryButtonText: {
    color: Colors.text,
    ...Typography.bodyLarge,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  secondaryButtonText: {
    color: Colors.primary,
    ...Typography.bodyLarge,
    fontWeight: '600',
  },
  disclaimer: {
    marginTop: Spacing.lg,
    textAlign: 'center',
    color: Colors.textSecondary,
    ...Typography.body,
  },
})