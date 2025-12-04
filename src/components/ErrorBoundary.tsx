import React, { Component, ReactNode, ErrorInfo } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Colors, Typography, Spacing, BorderRadius } from '../constants/theme'

interface Props {
  children: ReactNode
  fallback?: (error: Error, resetError: () => void) => ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
}

/**
 * ErrorBoundary component to catch JavaScript errors anywhere in the component tree
 * Logs errors and displays a fallback UI instead of crashing the app
 */
class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error to error reporting service (e.g., Sentry)
    console.error('ErrorBoundary caught an error:', error, errorInfo)

    this.setState({
      error,
      errorInfo,
    })

    // TODO: Send error to monitoring service
    // Example: Sentry.captureException(error, { extra: errorInfo })
  }

  resetError = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    })
  }

  render() {
    const { hasError, error, errorInfo } = this.state
    const { children, fallback } = this.props

    if (hasError && error) {
      // If custom fallback is provided, use it
      if (fallback) {
        return fallback(error, this.resetError)
      }

      // Default fallback UI
      return (
        <View style={styles.container}>
          <View style={styles.content}>
            <View style={styles.iconContainer}>
              <Ionicons name="warning" size={64} color={Colors.error} />
            </View>

            <Text style={styles.title}>Oops! Something went wrong</Text>
            <Text style={styles.message}>
              We encountered an unexpected error. Don't worry, your data is safe.
            </Text>

            <TouchableOpacity
              style={styles.primaryButton}
              onPress={this.resetError}
              activeOpacity={0.8}
            >
              <Ionicons name="refresh" size={20} color={Colors.text} />
              <Text style={styles.primaryButtonText}>Try Again</Text>
            </TouchableOpacity>

            {__DEV__ && (
              <View style={styles.errorDetails}>
                <TouchableOpacity
                  style={styles.detailsToggle}
                  onPress={() => {
                    // In production, you might want to show a less detailed error
                    console.log('Error details:', error, errorInfo)
                  }}
                >
                  <Text style={styles.detailsToggleText}>View Error Details (Dev Only)</Text>
                </TouchableOpacity>

                <ScrollView style={styles.errorScroll}>
                  <View style={styles.errorBlock}>
                    <Text style={styles.errorLabel}>Error:</Text>
                    <Text style={styles.errorText}>{error.toString()}</Text>
                  </View>

                  {errorInfo && (
                    <View style={styles.errorBlock}>
                      <Text style={styles.errorLabel}>Component Stack:</Text>
                      <Text style={styles.errorText}>{errorInfo.componentStack}</Text>
                    </View>
                  )}

                  {error.stack && (
                    <View style={styles.errorBlock}>
                      <Text style={styles.errorLabel}>Stack Trace:</Text>
                      <Text style={styles.errorText}>{error.stack}</Text>
                    </View>
                  )}
                </ScrollView>
              </View>
            )}
          </View>
        </View>
      )
    }

    return children
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.backgroundDark,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  content: {
    maxWidth: 400,
    width: '100%',
    alignItems: 'center',
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: `${Colors.error}20`,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  title: {
    ...Typography.h1,
    color: Colors.text,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  message: {
    ...Typography.bodyLarge,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.xl,
    lineHeight: 22,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.md,
    gap: Spacing.xs,
  },
  primaryButtonText: {
    ...Typography.bodyLarge,
    color: Colors.text,
    fontWeight: '600',
  },
  errorDetails: {
    width: '100%',
    marginTop: Spacing.xl,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  detailsToggle: {
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  detailsToggleText: {
    ...Typography.body,
    color: Colors.primary,
    textAlign: 'center',
  },
  errorScroll: {
    maxHeight: 200,
  },
  errorBlock: {
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  errorLabel: {
    ...Typography.caption,
    color: Colors.error,
    fontWeight: '600',
    marginBottom: Spacing.xs,
    textTransform: 'uppercase',
  },
  errorText: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontFamily: 'monospace',
    lineHeight: 16,
  },
})

export default ErrorBoundary
