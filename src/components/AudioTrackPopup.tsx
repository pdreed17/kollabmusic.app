import React, { useState, useEffect, useRef } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  PanResponder,
  Dimensions,
  TextInput,
  Alert,
  Modal,
} from 'react-native'
import { Audio } from 'expo-av'
import Slider from '@react-native-community/slider'
import { Ionicons } from '@expo/vector-icons'
import { Colors, Typography, Spacing, BorderRadius } from '../constants/theme'
import { supabase } from '../lib/supabase'

const { width: screenWidth, height: screenHeight } = Dimensions.get('window')

type AudioFile = {
  id: string
  file_name: string
  file_path: string
  stem_type: string
  stem_name: string
  duration_ms: number
  color: string
  created_at: string
  bpm?: number
  key?: string
}

type Comment = {
  id: string
  content: string
  timestamp_ms: number
  created_at: string
  users: {
    username: string
    display_name: string
  }
}

interface AudioTrackPopupProps {
  audioFile: AudioFile | null
  isVisible: boolean
  onClose: () => void
  projectId: string
  userId: string
  trackComments: Comment[]
  onRefresh?: () => void
}

const MINIMIZED_HEIGHT = 80
const MAXIMIZED_HEIGHT = 400

export default function AudioTrackPopup({
  audioFile,
  isVisible,
  onClose,
  projectId,
  userId,
  trackComments,
  onRefresh
}: AudioTrackPopupProps) {
  // Animation States
  const slideAnim = useRef(new Animated.Value(screenHeight)).current
  const [isMaximized, setIsMaximized] = useState(false)

  // Audio States
  const [sound, setSound] = useState<Audio.Sound | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [position, setPosition] = useState(0)
  const [duration, setDuration] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const playbackInterval = useRef<NodeJS.Timeout | null>(null)

  // Edit States
  const [isEditing, setIsEditing] = useState(false)
  const [editedName, setEditedName] = useState('')
  const [editedBPM, setEditedBPM] = useState('')
  const [editedKey, setEditedKey] = useState('')

  // Comment States
  const [showCommentModal, setShowCommentModal] = useState(false)
  const [newComment, setNewComment] = useState('')
  const [commentTimestamp, setCommentTimestamp] = useState(0)
  const [localComments, setLocalComments] = useState<Comment[]>(trackComments)

  // Sync local comments with prop changes
  useEffect(() => {
    setLocalComments(trackComments)
  }, [trackComments])

  // Pan Responder for drag to close
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        return Math.abs(gestureState.dy) > 10 && !isMaximized
      },
      onPanResponderMove: (evt, gestureState) => {
        if (gestureState.dy > 0) {
          slideAnim.setValue(gestureState.dy)
        }
      },
      onPanResponderRelease: (evt, gestureState) => {
        if (gestureState.dy > 100) {
          closePopup()
        } else {
          Animated.spring(slideAnim, {
            toValue: 0,
            useNativeDriver: true,
          }).start()
        }
      },
    })
  ).current

  // Show/Hide popup animation
  useEffect(() => {
    if (isVisible && audioFile) {
      const headerHeight = 100 // Approximate header height
      slideAnim.setValue(-MAXIMIZED_HEIGHT - headerHeight) // Start from above header
      Animated.spring(slideAnim, {
        toValue: headerHeight, // Position below header
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }).start()
      loadAudio()
      setEditedName(audioFile.stem_name || audioFile.file_name)
      setEditedBPM(audioFile.bpm?.toString() || '')
      setEditedKey(audioFile.key || '')
    } else {
      closePopup()
    }

    return () => {
      if (sound) {
        sound.unloadAsync()
      }
      if (playbackInterval.current) {
        clearInterval(playbackInterval.current)
        playbackInterval.current = null
      }
    }
  }, [isVisible, audioFile])

  // Toggle maximize/minimize
  const toggleMaximize = () => {
    setIsMaximized(!isMaximized)
  }

  const closePopup = () => {
    const headerHeight = 100
    Animated.timing(slideAnim, {
      toValue: -MAXIMIZED_HEIGHT - headerHeight, // Slide up to hide above header
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setIsMaximized(false)
      if (sound) {
        sound.unloadAsync()
        setSound(null)
      }
      setIsPlaying(false)
      setPosition(0)
      setDuration(0)
      onClose()
    })
  }

  const loadAudio = async () => {
    if (!audioFile) return

    setIsLoading(true)
    try {
      console.log('Loading audio from:', audioFile.file_path)

      // Check if it's a valid URL or file path
      if (!audioFile.file_path || audioFile.file_path.trim() === '') {
        throw new Error('No file path provided')
      }

      // Set audio mode for playback
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: true,
      })

      // Generate signed URL from Supabase storage
      let audioUri = audioFile.file_path

      // Check if it's a Supabase storage path (not already a full URL)
      if (!audioFile.file_path.startsWith('http')) {
        console.log('Generating signed URL for:', audioFile.file_path)
        const { data: signedUrlData, error: signedUrlError } = await supabase.storage
          .from('audio-files')
          .createSignedUrl(audioFile.file_path, 3600) // 1 hour expiry

        if (signedUrlError) {
          console.error('Error getting signed URL:', signedUrlError)
          throw new Error(`Failed to get audio URL: ${signedUrlError.message}`)
        }

        if (signedUrlData?.signedUrl) {
          audioUri = signedUrlData.signedUrl
          console.log('Got signed URL successfully')
        }
      }

      console.log('Loading audio from URI:', audioUri)

      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: audioUri },
        { shouldPlay: false }
      )

      setSound(newSound)

      // Get duration
      const status = await newSound.getStatusAsync()
      if (status.isLoaded) {
        setDuration(status.durationMillis || audioFile.duration_ms)
      }

      // Set up playback status update
      newSound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded) {
          setPosition(status.positionMillis || 0)
          setIsPlaying(status.isPlaying || false)

          // Handle playback completion
          if (status.didJustFinish) {
            setPosition(0)
            setIsPlaying(false)
          }
        }
      })

      console.log('Audio loaded successfully')
    } catch (error: any) {
      console.error('Error loading audio:', error)
      setDuration(audioFile.duration_ms)
      Alert.alert(
        'Audio Load Error',
        `Could not load audio file: ${error.message || 'Unknown error'}. You can still view track info.`
      )
    } finally {
      setIsLoading(false)
    }
  }


  const playPause = async () => {
    if (sound) {
      // If we have actual audio loaded, use it
      try {
        if (isPlaying) {
          await sound.pauseAsync()
        } else {
          await sound.playAsync()
        }
      } catch (error: any) {
        console.error('Error playing/pausing audio:', error)
        Alert.alert(
          'Playback Error',
          `Could not play audio: ${error.message || 'Unknown error'}`
        )
      }
    } else if (isLoading) {
      // Still loading, do nothing
      console.log('Audio is still loading...')
    } else {
      // Audio failed to load
      Alert.alert(
        'Audio Not Available',
        'The audio file could not be loaded. Please try again later.'
      )
    }
  }

  const seekTo = async (value: number) => {
    if (sound) {
      try {
        await sound.setPositionAsync(value)
        setPosition(value)
      } catch (error) {
        console.error('Error seeking:', error)
      }
    } else {
      // Simulate seeking for UI demo
      setPosition(value)
    }
  }

  const skipTime = async (seconds: number) => {
    const newPosition = Math.max(0, Math.min(duration, position + (seconds * 1000)))
    await seekTo(newPosition)
  }

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  const saveEdits = async () => {
    if (!audioFile) return

    // Validate BPM if provided
    if (editedBPM.trim()) {
      const bpmValue = parseInt(editedBPM.trim())
      if (isNaN(bpmValue) || bpmValue < 20 || bpmValue > 300) {
        Alert.alert('Invalid BPM', 'BPM must be a number between 20 and 300')
        return
      }
    }

    try {
      const updates: any = {
        stem_name: editedName.trim(),
      }

      if (editedBPM.trim()) {
        updates.bpm = parseInt(editedBPM.trim())
      }

      if (editedKey.trim()) {
        updates.key = editedKey.trim()
      }

      const { error } = await supabase
        .from('audio_files')
        .update(updates)
        .eq('id', audioFile.id)

      if (error) throw error

      Alert.alert('Success', 'Audio file updated successfully')
      setIsEditing(false)
      onRefresh?.()
    } catch (error) {
      console.error('Error saving edits:', error)
      Alert.alert('Error', 'Failed to save changes')
    }
  }

  const deleteTrack = async () => {
    if (!audioFile) return

    Alert.alert(
      'Delete Track Permanently?',
      'This track will be permanently deleted and cannot be recovered. Make sure you have a backup if needed.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Forever',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('audio_files')
                .delete()
                .eq('id', audioFile.id)

              if (error) throw error

              Alert.alert('Success', 'Track deleted successfully')
              onRefresh?.()
              closePopup() // Close popup after deletion
            } catch (error) {
              console.error('Error deleting track:', error)
              Alert.alert('Error', 'Failed to delete track')
            }
          }
        }
      ]
    )
  }

  const addComment = async () => {
    if (!newComment.trim() || !audioFile) return

    try {
      const { data, error } = await supabase
        .from('comments')
        .insert({
          project_id: projectId,
          user_id: userId,
          content: newComment.trim(),
          timestamp_ms: commentTimestamp
        })
        .select('id, content, timestamp_ms, created_at, users:user_id(username, display_name)')
        .single()

      if (error) throw error

      // Immediately add the new comment to local state so it shows up right away
      if (data) {
        const newCommentObj: Comment = {
          id: data.id,
          content: data.content,
          timestamp_ms: data.timestamp_ms,
          created_at: data.created_at,
          users: data.users as any
        }
        setLocalComments(prev => [...prev, newCommentObj].sort((a, b) => a.timestamp_ms - b.timestamp_ms))
      }

      setNewComment('')
      setShowCommentModal(false)
      onRefresh?.() // Also refresh parent for consistency
    } catch (error) {
      console.error('Error adding comment:', error)
      Alert.alert('Error', 'Failed to add comment')
    }
  }

  const addCommentAtCurrentTime = () => {
    setNewComment('') // Clear any previous comment text
    setCommentTimestamp(position)
    setShowCommentModal(true)
  }

  if (!isVisible || !audioFile) return null

  return (
    <>
      <Animated.View
        style={[
          styles.container,
          {
            transform: [{ translateY: slideAnim }],
            height: isMaximized ? MAXIMIZED_HEIGHT : MINIMIZED_HEIGHT,
          },
        ]}
        {...panResponder.panHandlers}
      >
        {/* Drag Handle */}
        <View style={styles.dragHandle}>
          <View style={styles.dragBar} />
        </View>

        {/* Minimized View */}
        <View style={styles.minimizedContent}>
          <View style={[styles.trackIndicator, { backgroundColor: audioFile.color }]} />
          <View style={styles.trackInfo}>
            <Text style={styles.trackTitle} numberOfLines={1}>
              {audioFile.stem_name || audioFile.file_name}
            </Text>
            <Text style={styles.trackSubtitle}>{audioFile.stem_type}</Text>
          </View>

          {/* Playback Controls */}
          <TouchableOpacity
            style={styles.playButton}
            onPress={() => skipTime(-10)}
          >
            <Ionicons name="play-back" size={20} color={Colors.text} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.playButton}
            onPress={playPause}
            disabled={isLoading}
          >
            <Ionicons
              name={isPlaying ? "pause" : "play"}
              size={24}
              color={Colors.text}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.playButton}
            onPress={() => skipTime(10)}
          >
            <Ionicons name="play-forward" size={20} color={Colors.text} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.maximizeButton}
            onPress={toggleMaximize}
          >
            <Ionicons
              name={isMaximized ? "chevron-down" : "chevron-up"}
              size={20}
              color={Colors.primary}
            />
          </TouchableOpacity>

          <TouchableOpacity style={styles.closeButton} onPress={closePopup}>
            <Ionicons name="close" size={20} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Maximized Content */}
        {isMaximized && (
          <Animated.View
            style={[
              styles.maximizedContent,
              {
                opacity: isMaximized ? 1 : 0,
              }
            ]}
          >
            {/* Progress Bar */}
            <View style={styles.progressContainer}>
              <Text style={styles.timeText}>{formatTime(position)}</Text>
              <View style={styles.sliderContainer}>
                <Slider
                  style={styles.slider}
                  minimumValue={0}
                  maximumValue={duration}
                  value={position}
                  onValueChange={seekTo}
                  minimumTrackTintColor={Colors.primary}
                  maximumTrackTintColor={Colors.border}
                  thumbTintColor={Colors.primary}
                />
                {/* Comment Icons on Timeline */}
                <View style={styles.commentIndicators}>
                  {localComments.map((comment) => {
                    // Calculate precise position based on slider width
                    // Account for slider padding and thumb size for accurate alignment
                    const sliderPadding = 8 // Internal padding of slider
                    const thumbRadius = 8 // Half of thumb width (16px)
                    const availableWidth = 100 - (sliderPadding * 2) // Available slider track width
                    const rawPercentage = duration > 0 ? (comment.timestamp_ms / duration) * 100 : 0

                    // Map the percentage to the actual slider track area
                    const adjustedPercentage = sliderPadding + (rawPercentage * availableWidth / 100)

                    // Ensure the icon stays within visible bounds
                    const finalPercentage = Math.max(
                      sliderPadding + 2, // Minimum position (account for icon radius)
                      Math.min(100 - sliderPadding - 2, adjustedPercentage) // Maximum position
                    )

                    return (
                      <TouchableOpacity
                        key={comment.id}
                        style={[
                          styles.commentIndicator,
                          { left: `${finalPercentage}%` }
                        ]}
                        onPress={() => {
                          seekTo(comment.timestamp_ms)
                          setNewComment(comment.content)
                          setShowCommentModal(true)
                        }}
                      >
                        <Ionicons
                          name="chatbubble"
                          size={10}
                          color={Colors.surface}
                        />
                      </TouchableOpacity>
                    )
                  })}
                </View>
              </View>
              <Text style={styles.timeText}>{formatTime(duration)}</Text>
            </View>

            {/* Action Buttons */}
            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => setIsEditing(!isEditing)}
              >
                <Ionicons name="create-outline" size={20} color={Colors.primary} />
                <Text style={styles.actionButtonText}>Edit</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionButton}
                onPress={addCommentAtCurrentTime}
              >
                <Ionicons name="chatbubble-outline" size={20} color={Colors.primary} />
                <Text style={styles.actionButtonText}>Comment</Text>
              </TouchableOpacity>
            </View>

            {/* Edit Form */}
            {isEditing && (
              <View style={styles.editForm}>
                <Text style={styles.editLabel}>Track Name</Text>
                <TextInput
                  style={styles.editInput}
                  value={editedName}
                  onChangeText={setEditedName}
                  placeholder="Enter track name"
                  placeholderTextColor={Colors.textSecondary}
                />

                <Text style={styles.editLabel}>BPM</Text>
                <TextInput
                  style={styles.editInput}
                  value={editedBPM}
                  onChangeText={setEditedBPM}
                  placeholder="120"
                  placeholderTextColor={Colors.textSecondary}
                  keyboardType="numeric"
                />

                <Text style={styles.editLabel}>Key</Text>
                <TextInput
                  style={styles.editInput}
                  value={editedKey}
                  onChangeText={setEditedKey}
                  placeholder="C major"
                  placeholderTextColor={Colors.textSecondary}
                />

                <View style={styles.editButtons}>
                  <TouchableOpacity
                    style={styles.editButtonSecondary}
                    onPress={() => setIsEditing(false)}
                  >
                    <Text style={styles.editButtonTextSecondary}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.editButtonPrimary}
                    onPress={saveEdits}
                  >
                    <Text style={styles.editButtonTextPrimary}>Save</Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={deleteTrack}
                >
                  <Ionicons name="trash-outline" size={20} color={Colors.error} />
                  <Text style={styles.deleteButtonText}>Delete Track</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Comments Section */}
            <View style={styles.commentsSection}>
              <Text style={styles.commentsTitle}>
                Track Comments ({localComments.length})
              </Text>
              {localComments.slice(0, 3).map((comment) => (
                <View key={comment.id} style={styles.commentItem}>
                  <Text style={styles.commentTime}>
                    {formatTime(comment.timestamp_ms)}
                  </Text>
                  <Text style={styles.commentText} numberOfLines={2}>
                    {comment.content}
                  </Text>
                </View>
              ))}
              {localComments.length > 3 && (
                <Text style={styles.moreComments}>
                  +{localComments.length - 3} more comments
                </Text>
              )}
            </View>
          </Animated.View>
        )}
      </Animated.View>

      {/* Comment Modal */}
      <Modal
        visible={showCommentModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowCommentModal(false)}>
              <Text style={styles.modalCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Add Comment</Text>
            <TouchableOpacity
              onPress={addComment}
              disabled={!newComment.trim()}
            >
              <Text style={[
                styles.modalDone,
                !newComment.trim() && styles.modalDoneDisabled
              ]}>
                Done
              </Text>
            </TouchableOpacity>
          </View>
          <View style={styles.modalContent}>
            <Text style={styles.timestampLabel}>
              At {formatTime(commentTimestamp)}
            </Text>
            <TextInput
              style={styles.commentInput}
              placeholder="Enter your comment..."
              placeholderTextColor={Colors.textSecondary}
              value={newComment}
              onChangeText={setNewComment}
              multiline
              autoFocus
            />
          </View>
        </View>
      </Modal>
    </>
  )
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.surfaceElevated,
    borderBottomLeftRadius: BorderRadius.lg,
    borderBottomRightRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: Colors.backgroundDark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 10,
  },
  dragHandle: {
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  dragBar: {
    width: 40,
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: 2,
  },
  minimizedContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  trackIndicator: {
    width: 4,
    height: 40,
    borderRadius: 2,
    marginRight: Spacing.md,
  },
  trackInfo: {
    flex: 1,
  },
  trackTitle: {
    ...Typography.bodyLarge,
    color: Colors.text,
    fontWeight: '600',
  },
  trackSubtitle: {
    ...Typography.caption,
    color: Colors.textSecondary,
    textTransform: 'capitalize',
  },
  playButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: Spacing.sm,
  },
  maximizeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: Spacing.sm,
  },
  maximizedContent: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  timeText: {
    ...Typography.caption,
    color: Colors.textSecondary,
    minWidth: 40,
    textAlign: 'center',
  },
  sliderContainer: {
    flex: 1,
    position: 'relative',
    marginHorizontal: Spacing.md,
  },
  slider: {
    flex: 1,
    height: 30,
  },
  sliderThumb: {
    backgroundColor: Colors.primary,
    width: 16,
    height: 16,
  },
  commentIndicators: {
    position: 'absolute',
    top: 8, // Align with slider track
    left: 0,
    right: 0,
    height: 16,
    pointerEvents: 'box-none',
  },
  commentIndicator: {
    position: 'absolute',
    top: 0,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: -8, // Center the icon on position
    borderWidth: 2,
    borderColor: Colors.surface,
    shadowColor: Colors.backgroundDark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 3,
    elevation: 5,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: Spacing.lg,
  },
  actionButton: {
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  actionButtonText: {
    ...Typography.caption,
    color: Colors.primary,
    marginTop: Spacing.xs,
  },
  editForm: {
    marginBottom: Spacing.lg,
  },
  editLabel: {
    ...Typography.body,
    color: Colors.text,
    marginBottom: Spacing.xs,
    marginTop: Spacing.sm,
  },
  editInput: {
    ...Typography.body,
    color: Colors.text,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  editButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.lg,
  },
  editButtonSecondary: {
    flex: 0.48,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  editButtonPrimary: {
    flex: 0.48,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.primary,
    alignItems: 'center',
  },
  editButtonTextSecondary: {
    ...Typography.body,
    color: Colors.textSecondary,
  },
  editButtonTextPrimary: {
    ...Typography.body,
    color: Colors.text,
    fontWeight: '600',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    marginTop: Spacing.lg,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.error,
    gap: Spacing.sm,
  },
  deleteButtonText: {
    ...Typography.body,
    color: Colors.error,
    fontWeight: '600',
  },
  commentsSection: {
    flex: 1,
  },
  commentsTitle: {
    ...Typography.bodyLarge,
    color: Colors.text,
    fontWeight: '600',
    marginBottom: Spacing.md,
  },
  commentItem: {
    flexDirection: 'row',
    marginBottom: Spacing.sm,
  },
  commentTime: {
    ...Typography.caption,
    color: Colors.primary,
    width: 50,
    marginRight: Spacing.sm,
  },
  commentText: {
    ...Typography.body,
    color: Colors.text,
    flex: 1,
  },
  moreComments: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontStyle: 'italic',
    marginTop: Spacing.sm,
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: Colors.backgroundDark,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalCancel: {
    ...Typography.body,
    color: Colors.textSecondary,
  },
  modalTitle: {
    ...Typography.h3,
    color: Colors.text,
  },
  modalDone: {
    ...Typography.body,
    color: Colors.primary,
    fontWeight: '600',
  },
  modalDoneDisabled: {
    color: Colors.textSecondary,
  },
  modalContent: {
    flex: 1,
    padding: Spacing.lg,
  },
  timestampLabel: {
    ...Typography.body,
    color: Colors.primary,
    marginBottom: Spacing.md,
    fontWeight: '600',
  },
  commentInput: {
    ...Typography.body,
    color: Colors.text,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    minHeight: 120,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: Colors.border,
  },
})