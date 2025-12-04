import React, { useState, useEffect, useRef } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Audio } from 'expo-av'
import { Colors, Typography, Spacing, BorderRadius } from '../constants/theme'

interface HighlightPlayerProps {
  fileUrl: string
  fileName: string
  duration: number
  bpm?: number
  keySignature?: string
}

export default function HighlightPlayer({
  fileUrl,
  fileName,
  duration,
  bpm,
  keySignature,
}: HighlightPlayerProps) {
  const [sound, setSound] = useState<Audio.Sound | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentPosition, setCurrentPosition] = useState(0)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    return () => {
      if (sound) {
        sound.unloadAsync()
      }
    }
  }, [sound])

  const loadSound = async () => {
    try {
      setIsLoading(true)
      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: fileUrl },
        { shouldPlay: false },
        onPlaybackStatusUpdate
      )
      setSound(newSound)
      setIsLoading(false)
    } catch (error) {
      console.error('Error loading sound:', error)
      setIsLoading(false)
    }
  }

  const onPlaybackStatusUpdate = (status: any) => {
    if (status.isLoaded) {
      setCurrentPosition(status.positionMillis)
      setIsPlaying(status.isPlaying)

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

    if (isPlaying) {
      await sound.pauseAsync()
    } else {
      await sound.playAsync()
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
    <View style={styles.container}>
      {/* Track Info */}
      <View style={styles.trackInfo}>
        <View style={styles.trackDetails}>
          <Text style={styles.trackName} numberOfLines={1}>
            {fileName}
          </Text>
          <View style={styles.metaRow}>
            <Text style={styles.metaText}>{formatTime(duration)}</Text>
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
          </View>
        </View>
      </View>

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
            onPress={() => skipTime(-10)}
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
            onPress={togglePlayback}
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
            onPress={() => skipTime(10)}
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
    </View>
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
})
