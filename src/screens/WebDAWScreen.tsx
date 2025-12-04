import React, { useState, useEffect } from 'react'
import { View, StyleSheet, Alert, ActivityIndicator, Text } from 'react-native'
import { WebView } from 'react-native-webview'
import { SafeAreaView } from 'react-native-safe-area-context'
import Header from '../components/Header'
import { Colors, Typography, Spacing } from '../constants/theme'

export default function WebDAWScreen() {
  const [isLoading, setIsLoading] = useState(true)
  const [webDAWUrl, setWebDAWUrl] = useState<string | null>(null)

  useEffect(() => {
    // Check if web DAW server is running locally
    checkWebDAWServer()
  }, [])

  const checkWebDAWServer = async () => {
    // Try common development ports for the web DAW
    const ports = [3000, 3001, 5173, 8080]

    for (const port of ports) {
      try {
        const url = `http://localhost:${port}`
        const response = await fetch(url, { method: 'HEAD' })
        if (response.ok) {
          setWebDAWUrl(url)
          setIsLoading(false)
          return
        }
      } catch (error) {
        // Continue to next port
      }
    }

    // If no local server found, show instructions
    setIsLoading(false)
    Alert.alert(
      'Web DAW Server Not Found',
      'Please start the web DAW development server:\n\n' +
      '1. Open Terminal\n' +
      '2. cd /Users/petahdacheetah/Documents/kollabMusicApp/web-daw\n' +
      '3. npm install\n' +
      '4. npm run dev\n\n' +
      'Then reopen this screen.',
      [
        {
          text: 'Retry',
          onPress: () => {
            setIsLoading(true)
            checkWebDAWServer()
          }
        }
      ]
    )
  }

  const handleWebViewError = (error: any) => {
    console.error('WebView error:', error)
    Alert.alert(
      'WebView Error',
      'Failed to load the Web DAW. Make sure the development server is running.',
      [
        {
          text: 'Retry',
          onPress: () => {
            setIsLoading(true)
            checkWebDAWServer()
          }
        }
      ]
    )
  }

  const handleLoadEnd = () => {
    setIsLoading(false)
  }

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <Header title="Web DAW" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>
            {webDAWUrl ? 'Loading Web DAW...' : 'Checking for Web DAW server...'}
          </Text>
        </View>
      </SafeAreaView>
    )
  }

  if (!webDAWUrl) {
    return (
      <SafeAreaView style={styles.container}>
        <Header title="Web DAW" />
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Web DAW Server Not Found</Text>
          <Text style={styles.errorMessage}>
            To use the Web DAW component, please start the development server:
          </Text>
          <Text style={styles.codeText}>
            cd web-daw{'\n'}
            npm install{'\n'}
            npm run dev
          </Text>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <Header title="Web DAW" />

      <WebView
        source={{ uri: webDAWUrl }}
        style={styles.webview}
        onError={handleWebViewError}
        onLoadEnd={handleLoadEnd}
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={false}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={true}
        renderLoading={() => (
          <View style={styles.webviewLoadingContainer}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.loadingText}>Loading Web DAW...</Text>
          </View>
        )}
        onMessage={(event) => {
          console.log('WebView message:', event.nativeEvent.data)
        }}
        // Allow audio to work in WebView
        allowsFullscreenVideo={true}
        mixedContentMode="compatibility"
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  loadingText: {
    ...Typography.body,
    color: Colors.textSecondary,
    marginTop: Spacing.md,
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  errorTitle: {
    ...Typography.h3,
    color: Colors.text,
    marginBottom: Spacing.md,
    textAlign: 'center',
  },
  errorMessage: {
    ...Typography.body,
    color: Colors.textSecondary,
    marginBottom: Spacing.lg,
    textAlign: 'center',
    lineHeight: 20,
  },
  codeText: {
    ...Typography.code,
    backgroundColor: Colors.surfaceElevated,
    padding: Spacing.md,
    borderRadius: 8,
    color: Colors.text,
    fontFamily: 'Courier',
  },
  webview: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
  webviewLoadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.surface,
  },
})