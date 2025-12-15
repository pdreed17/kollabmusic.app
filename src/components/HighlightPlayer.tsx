import React, { useState, useEffect, useRef } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Audio } from 'expo-av'
import { Colors, Typography, Spacing, BorderRadius } from '../constants/theme'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import {
  canPlayHighlight,
  recordHighlightPreview,
  formatTimeUntilReset,
  getPreviewDurationMs,
} from '../utils/previewLimits'
import { getOrCacheAudio } from '../utils/audioCache'

const PREVIEW_DURATION_MS = getPreviewDurationMs() // 30 seconds

interface HighlightPlayerProps {
  fileUrl: string
  fileName: string
  duration: number
  highlightId: string // Required for preview tracking
  profileUserId: string // Required for preview tracking
  bpm?: number
  keySignature?: string
  isOwner?: boolean
  isPro?: boolean // User's subscription status
  onDelete?: () => void
  onUpgradePrompt?: () => void // Callback when upgrade is needed
}

export default function HighlightPlayer({
  fileUrl,
  fileName,
  duration,
  highlightId,
  profileUserId,
  bpm,
  keySignature,
  isOwner = false,
  isPro = false,
  onDelete,
  onUpgradePrompt,
}: HighlightPlayerProps) {
  const { user } = useAuth()
  const [sound, setSound] = useState<Audio.Sound | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentPosition, setCurrentPosition] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [isMaximized, setIsMaximized] = useState(false)
  const [previewLimitReached, setPreviewLimitReached] = useState(false)
  const [timeUntilReset, setTimeUntilReset] = useState<number | null>(null)
  const [isPreviewMode, setIsPreviewMode] = useState(false)
  const [previewRecorded, setPreviewRecorded] = useState(false)

  // Determine if this is preview mode (free user viewing someone else's highlight)
  const shouldEnforcePreviewLimits = !isPro && !isOwner && user?.id !== profileUserId

  // Check preview limits on mount
  useEffect(() => {
    const checkPreviewLimits = async () => {
      if (!shouldEnforcePreviewLimits) {
        setIsPreviewMode(false)
        return
      }

      setIsPreviewMode(true)
      const result = await canPlayHighlight(profileUserId, highlightId)

      if (!result.canPlay) {
        setPreviewLimitReached(true)
        setTimeUntilReset(result.timeUntilReset)
      }
    }

    checkPreviewLimits()
  }, [shouldEnforcePreviewLimits, profileUserId, highlightId])

  // Set up audio mode on component mount
  useEffect(() => {
    const setupAudio = async () => {
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
        })
      } catch (error) {
        console.error('Error setting up audio mode:', error)
      }
    }
    setupAudio()
  }, [])

  useEffect(() => {
    return () => {
      if (sound) {
        sound.unloadAsync()
      }
    }
  }, [sound])

  const loadSound = async () => {
    try {
      // Check preview limits before playing
      if (shouldEnforcePreviewLimits && previewLimitReached) {
        Alert.alert(
          'Preview Limit Reached',
          `You've already previewed a highlight from this profile. Reset in ${formatTimeUntilReset(timeUntilReset || 0)}.\n\nUpgrade to Pro for unlimited streaming.`,
          [
            { text: 'Maybe Later', style: 'cancel' },
            {
              text: 'Upgrade to Pro',
              onPress: () => onUpgradePrompt?.(),
            },
          ]
        )
        return
      }

      setIsLoading(true)

      // Check if it's a valid URL or file path
      if (!fileUrl || fileUrl.trim() === '') {
        throw new Error('No file URL provided')
      }

      console.log('HighlightPlayer loading audio from:', fileUrl)

      // Set audio mode for playback
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
      })

      let audioUri = fileUrl

      // Check if it's a Supabase storage public URL and extract path to generate signed URL
      // Public URLs look like: https://xxx.supabase.co/storage/v1/object/public/highlights/path/to/file.mp3
      if (fileUrl.includes('/storage/v1/object/public/highlights/')) {
        // Extract the file path from the public URL
        const pathMatch = fileUrl.match(/\/storage\/v1\/object\/public\/highlights\/(.+)$/)
        if (pathMatch && pathMatch[1]) {
          const filePath = decodeURIComponent(pathMatch[1])
          console.log('Extracted highlight path:', filePath)

          // Generate signed URL from highlights bucket
          const { data: signedUrlData, error: signedUrlError } = await supabase.storage
            .from('highlights')
            .createSignedUrl(filePath, 3600) // 1 hour expiry

          if (signedUrlError) {
            console.error('Error getting signed URL for highlight:', signedUrlError)
            // Fall back to trying the public URL directly
            console.log('Falling back to public URL...')
          } else if (signedUrlData?.signedUrl) {
            audioUri = signedUrlData.signedUrl
            console.log('Got signed URL for highlight successfully')
          }
        }
      } else if (fileUrl.includes('/storage/v1/object/public/audio-files/')) {
        // Handle audio-files bucket URLs
        const pathMatch = fileUrl.match(/\/storage\/v1\/object\/public\/audio-files\/(.+)$/)
        if (pathMatch && pathMatch[1]) {
          const filePath = decodeURIComponent(pathMatch[1])
          console.log('Extracted audio-files path:', filePath)

          const { data: signedUrlData, error: signedUrlError } = await supabase.storage
            .from('audio-files')
            .createSignedUrl(filePath, 3600)

          if (!signedUrlError && signedUrlData?.signedUrl) {
            audioUri = signedUrlData.signedUrl
            console.log('Got signed URL for audio-files successfully')
          }
        }
      } else if (!fileUrl.startsWith('http')) {
        // It's a raw file path, try highlights bucket first, then audio-files
        console.log('Generating signed URL for raw path:', fileUrl)

        // Try highlights bucket first
        let { data: signedUrlData, error: signedUrlError } = await supabase.storage
          .from('highlights')
          .createSignedUrl(fileUrl, 3600)

        if (signedUrlError) {
          console.log('Highlights bucket failed, trying audio-files bucket...')
          // Try audio-files bucket
          const result = await supabase.storage
            .from('audio-files')
            .createSignedUrl(fileUrl, 3600)
          signedUrlData = result.data
          signedUrlError = result.error
        }

        if (signedUrlError) {
          console.error('Error getting signed URL:', signedUrlError)
          throw new Error(`Failed to get audio URL: ${signedUrlError.message}`)
        }

        if (signedUrlData?.signedUrl) {
          audioUri = signedUrlData.signedUrl
          console.log('Got signed URL successfully')
        }
      }

      // Try to use cached version first to reduce egress
      const { uri: finalUri, fromCache } = await getOrCacheAudio(highlightId, audioUri)
      console.log(`Loading highlight audio from ${fromCache ? 'cache' : 'remote'}:`, finalUri)

      let newSound: Audio.Sound

      try {
        const result = await Audio.Sound.createAsync(
          { uri: finalUri },
          {
            shouldPlay: false,
            volume: 1.0,
            isMuted: false,
          },
          onPlaybackStatusUpdate
        )
        newSound = result.sound
      } catch (cacheError) {
        // If cached version fails, try remote URL directly
        if (fromCache) {
          console.log('Cached audio failed, trying remote URL directly...')
          const result = await Audio.Sound.createAsync(
            { uri: audioUri },
            {
              shouldPlay: false,
              volume: 1.0,
              isMuted: false,
            },
            onPlaybackStatusUpdate
          )
          newSound = result.sound
        } else {
          throw cacheError
        }
      }

      // Ensure volume is set
      await newSound.setVolumeAsync(1.0)

      setSound(newSound)
      setIsLoading(false)

      // Record preview if in preview mode (only once)
      if (shouldEnforcePreviewLimits && !previewRecorded) {
        await recordHighlightPreview(profileUserId, highlightId)
        setPreviewRecorded(true)
      }

      // Auto-play after loading
      await newSound.playAsync()
    } catch (error: any) {
      console.error('Error loading highlight sound:', error)
      setIsLoading(false)
      Alert.alert(
        'Audio Load Error',
        `Could not load audio file: ${error.message || 'Unknown error'}`
      )
    }
  }

  const onPlaybackStatusUpdate = (status: any) => {
    if (status.isLoaded) {
      setCurrentPosition(status.positionMillis)
      setIsPlaying(status.isPlaying)

      // Enforce 30-second preview limit for free users
      if (
        isPreviewMode &&
        status.isPlaying &&
        status.positionMillis >= PREVIEW_DURATION_MS
      ) {
        sound?.pauseAsync()
        sound?.setPositionAsync(0)
        setIsPlaying(false)
        setCurrentPosition(0)
        Alert.alert(
          'Preview Ended',
          'Free users can preview 30 seconds per highlight. Upgrade to Pro for unlimited streaming.',
          [
            { text: 'OK', style: 'cancel' },
            {
              text: 'Upgrade to Pro',
              onPress: () => onUpgradePrompt?.(),
            },
          ]
        )
        return
      }

      if (status.didJustFinish) {
        setIsPlaying(false)
        setCurrentPosition(0)
        if (sound) {
          sound.setPositionAsync(0)
        }
      }
    }
  }

  const togglePlayback = async () => {
    if (!sound) {
      await loadSound()
      return
    }

    try {
      const status = await sound.getStatusAsync()

      if (status.isLoaded) {
        if (isPlaying) {
          await sound.pauseAsync()
        } else {
          // Check if we're at or near the end of the track - if so, restart from beginning
          const trackDuration = status.durationMillis || duration || 0
          const currentPos = status.positionMillis || 0

          // Consider "at the end" if within 500ms of the end
          const isAtEnd = trackDuration > 0 && (trackDuration - currentPos) < 500

          if (isAtEnd) {
            // Reset to beginning before playing
            await sound.setPositionAsync(0)
            setCurrentPosition(0)
          }

          await sound.playAsync()
        }
      } else {
        // Sound exists but not loaded, reload
        await loadSound()
      }
    } catch (error) {
      console.error('Error toggling playback:', error)
      // Try reloading
      await loadSound()
    }
  }

  const skipTime = async (seconds: number) => {
    if (!sound) return

    const newPosition = Math.max(0, Math.min(duration, currentPosition + seconds * 1000))
    await sound.setPositionAsync(newPosition)
  }

  const seekTo = async (position: number) => {
    if (!sound) return
    await sound.setPositionAsync(position)
  }

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  return (
    <TouchableOpacity
      style={[styles.container, isMaximized && styles.containerMaximized]}
      onPress={() => setIsMaximized(!isMaximized)}
      activeOpacity={0.9}
    >
      {/* Track Info */}
      <View style={styles.trackInfo}>
        <View style={styles.trackDetails}>
          <Text style={styles.trackName} numberOfLines={1}>
            {fileName}
          </Text>
          <View style={styles.metaRow}>
            <Text style={styles.metaText}>
              {isPreviewMode ? '30s preview' : formatTime(duration)}
            </Text>
            {bpm && (
              <>
                <Text style={styles.metaDot}>•</Text>
                <Text style={styles.metaText}>{bpm} BPM</Text>
              </>
            )}
            {keySignature && (
              <>
                <Text style={styles.metaDot}>•</Text>
                <Text style={styles.metaText}>{keySignature}</Text>
              </>
            )}
            {isPreviewMode && (
              <>
                <Text style={styles.metaDot}>•</Text>
                <View style={styles.previewBadge}>
                  <Ionicons name="lock-closed" size={10} color={Colors.warning} />
                  <Text style={styles.previewBadgeText}>PREVIEW</Text>
                </View>
              </>
            )}
          </View>
        </View>

        {/* Right side icons */}
        <View style={styles.headerIcons}>
          {/* Delete Icon - Only show when maximized and is owner */}
          {isMaximized && isOwner && onDelete && (
            <TouchableOpacity
              style={styles.deleteIconButton}
              onPress={(e) => {
                e.stopPropagation()
                onDelete()
              }}
            >
              <Ionicons name="trash-outline" size={20} color={Colors.error} />
            </TouchableOpacity>
          )}

          {/* Maximize/Minimize Icon */}
          <TouchableOpacity
            style={styles.maximizeButton}
            onPress={() => setIsMaximized(!isMaximized)}
          >
            <Ionicons
              name={isMaximized ? 'chevron-up' : 'chevron-down'}
              size={24}
              color={Colors.textSecondary}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Playback Controls - Only show when maximized */}
      {isMaximized && (
        <>
          {/* Progress Bar */}
          <TouchableOpacity
            style={styles.progressContainer}
            activeOpacity={1}
            onPress={(e) => {
              const locationX = e.nativeEvent.locationX
              const percentage = locationX / e.nativeEvent.target.offsetWidth
              const newPosition = percentage * duration
              seekTo(newPosition)
            }}
          >
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${duration > 0 ? (currentPosition / duration) * 100 : 0}%` },
                ]}
              />
            </View>
          </TouchableOpacity>

          {/* Controls */}
          <View style={styles.controlsContainer}>
            <Text style={styles.timeText}>{formatTime(currentPosition)}</Text>

            <View style={styles.controls}>
              <TouchableOpacity
                style={styles.controlButton}
                onPress={(e) => {
                  e.stopPropagation()
                  skipTime(-10)
                }}
                disabled={!sound}
              >
                <Ionicons
                  name="play-back"
                  size={18}
                  color={sound ? Colors.text : Colors.textSecondary}
                />
                <Text style={[styles.skipText, !sound && styles.skipTextDisabled]}>10</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.playButton}
                onPress={(e) => {
                  e.stopPropagation()
                  togglePlayback()
                }}
                disabled={isLoading}
              >
                <Ionicons
                  name={isPlaying ? 'pause' : 'play'}
                  size={24}
                  color={Colors.text}
                />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.controlButton}
                onPress={(e) => {
                  e.stopPropagation()
                  skipTime(10)
                }}
                disabled={!sound}
              >
                <Ionicons
                  name="play-forward"
                  size={18}
                  color={sound ? Colors.text : Colors.textSecondary}
                />
                <Text style={[styles.skipText, !sound && styles.skipTextDisabled]}>10</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.timeText}>{formatTime(duration)}</Text>
          </View>
        </>
      )}
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  containerMaximized: {
    backgroundColor: Colors.surfaceElevated,
    borderColor: Colors.primary,
    borderWidth: 2,
  },
  trackInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  trackDetails: {
    flex: 1,
  },
  trackName: {
    ...Typography.bodyLarge,
    color: Colors.text,
    fontWeight: '600',
    marginBottom: Spacing.xxs,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  metaText: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontSize: 11,
  },
  metaDot: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontSize: 11,
  },
  previewBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: `${Colors.warning}20`,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  previewBadgeText: {
    ...Typography.tiny,
    color: Colors.warning,
    fontWeight: '700',
    fontSize: 9,
  },
  progressContainer: {
    paddingVertical: Spacing.sm,
  },
  progressBar: {
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.primary,
  },
  controlsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  controlButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    padding: Spacing.xs,
  },
  playButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  skipText: {
    ...Typography.tiny,
    color: Colors.text,
    fontWeight: '600',
    fontSize: 10,
  },
  skipTextDisabled: {
    color: Colors.textSecondary,
  },
  timeText: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontWeight: '600',
    minWidth: 40,
  },
  headerIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  maximizeButton: {
    padding: Spacing.xs,
  },
  deleteIconButton: {
    padding: Spacing.xs,
    backgroundColor: `${Colors.error}15`,
    borderRadius: BorderRadius.sm,
  },
})
