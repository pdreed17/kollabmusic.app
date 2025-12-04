import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Alert,
  ActivityIndicator,
  TextInput,
} from 'react-native'
import * as DocumentPicker from 'expo-document-picker'
import { Ionicons } from '@expo/vector-icons'
import { Audio } from 'expo-av'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { Colors, Typography, Spacing, BorderRadius } from '../constants/theme'
import Header from '../components/Header'

// Support all professional audio formats
const ALLOWED_FORMATS = [
  'audio/wav', 'audio/x-wav',           // WAV
  'audio/mpeg', 'audio/mp3',            // MP3
  'audio/flac', 'audio/x-flac',         // FLAC
  'audio/aiff', 'audio/x-aiff',         // AIFF
  'audio/aac', 'audio/mp4',             // AAC/M4A
  'audio/ogg',                          // OGG
  'audio/opus',                         // OPUS
]

const ALLOWED_EXTENSIONS = [
  '.wav', '.mp3', '.flac', '.aiff', '.aif',
  '.m4a', '.mp4', '.aac', '.ogg', '.opus'
]

const MAX_FILE_SIZE = 500 * 1024 * 1024 // 500 MB

export default function HighlightUploadScreen({ navigation }: any) {
  const { user, userProfile } = useAuth()

  // File state
  const [selectedFile, setSelectedFile] = useState<any>(null)
  const [fileName, setFileName] = useState('')
  const [bpm, setBpm] = useState('')
  const [keySignature, setKeySignature] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [audioDuration, setAudioDuration] = useState<number | null>(null)

  // Preview playback
  const [previewSound, setPreviewSound] = useState<Audio.Sound | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)

  // Recording state
  const [recording, setRecording] = useState<Audio.Recording | null>(null)
  const [isRecording, setIsRecording] = useState(false)
  const [recordingDuration, setRecordingDuration] = useState(0)

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (previewSound) {
        previewSound.unloadAsync().catch(() => {})
      }
      if (recording) {
        recording.getStatusAsync().then((status) => {
          if (status.canRecord || status.isRecording) {
            recording.stopAndUnloadAsync().catch(() => {})
          }
        }).catch(() => {})
      }
    }
  }, [previewSound, recording])

  const getAudioDuration = async (uri: string): Promise<number | null> => {
    try {
      const { sound } = await Audio.Sound.createAsync(
        { uri },
        { shouldPlay: false }
      )

      const status = await sound.getStatusAsync()
      await sound.unloadAsync()

      if (status.isLoaded && status.durationMillis) {
        return status.durationMillis
      }
      return null
    } catch (error) {
      console.error('Error getting duration:', error)
      return null
    }
  }

  const handleSelectFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'audio/*',
        copyToCacheDirectory: true,
      })

      if (result.canceled) return

      const file = result.assets[0]

      // Validate file size
      if (file.size && file.size > MAX_FILE_SIZE) {
        Alert.alert('File Too Large', 'Maximum file size is 500 MB')
        return
      }

      // Validate file format
      const fileNameLower = file.name.toLowerCase()
      const isValidFormat = ALLOWED_FORMATS.some(format =>
        file.mimeType?.includes(format)
      ) || ALLOWED_EXTENSIONS.some(ext => fileNameLower.endsWith(ext))

      if (!isValidFormat) {
        Alert.alert(
          'Unsupported Format',
          'Please select a supported audio file:\nWAV, MP3, MP4, FLAC, AIFF, AAC, M4A, OGG, OPUS'
        )
        return
      }

      // Warn for very large files
      if (file.size && file.size > 100 * 1024 * 1024) {
        Alert.alert(
          'Large File',
          'This file is quite large. Upload may take several minutes.',
          [
            { text: 'Cancel', style: 'cancel', onPress: () => {} },
            { text: 'Continue', onPress: () => processFile(file) }
          ]
        )
        return
      }

      processFile(file)
    } catch (error) {
      console.error('Error selecting file:', error)
      Alert.alert('Error', 'Failed to select file')
    }
  }

  const processFile = async (file: any) => {
    try {
      setSelectedFile(file)

      // Auto-set file name from filename (remove extension)
      const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '')
      setFileName(nameWithoutExt)

      // Get audio duration
      const duration = await getAudioDuration(file.uri)
      if (duration === null) {
        Alert.alert(
          'Note',
          'Could not detect audio duration. File will still upload.',
          [{ text: 'OK' }]
        )
      }
      setAudioDuration(duration)

      // Setup preview sound
      try {
        const { sound } = await Audio.Sound.createAsync(
          { uri: file.uri },
          { shouldPlay: false }
        )
        setPreviewSound(sound)
      } catch (error) {
        console.error('Error creating preview sound:', error)
      }

    } catch (error) {
      console.error('Error processing file:', error)
      Alert.alert('Error', 'Failed to process file')
    }
  }

  const startRecording = async () => {
    try {
      // Request permissions
      const permission = await Audio.requestPermissionsAsync()
      if (!permission.granted) {
        Alert.alert('Permission Required', 'Please grant microphone permission to record audio')
        return
      }

      // Set audio mode for recording
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      })

      // Start recording
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      )

      setRecording(recording)
      setIsRecording(true)
      setRecordingDuration(0)

      // Update duration every second
      const durationInterval = setInterval(async () => {
        if (recording) {
          const status = await recording.getStatusAsync()
          if (status.isRecording) {
            setRecordingDuration(status.durationMillis)
          }
        }
      }, 100)

      // Store interval ID for cleanup
      ;(recording as any).durationInterval = durationInterval

    } catch (error) {
      console.error('Error starting recording:', error)
      Alert.alert('Error', 'Failed to start recording')
    }
  }

  const stopRecording = async () => {
    if (!recording) return

    try {
      // Clear interval
      if ((recording as any).durationInterval) {
        clearInterval((recording as any).durationInterval)
      }

      setIsRecording(false)
      await recording.stopAndUnloadAsync()
      const uri = recording.getURI()

      if (uri) {
        // Create a file object similar to DocumentPicker result
        const recordedFile = {
          uri,
          name: `Recording_${new Date().toISOString().replace(/[:.]/g, '-')}.m4a`,
          mimeType: 'audio/mp4',
          size: 0,
        }

        // Process the recorded file
        await processFile(recordedFile)
      }

      setRecording(null)
      setRecordingDuration(0)

      // Reset audio mode
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      })
    } catch (error) {
      console.error('Error stopping recording:', error)
      Alert.alert('Error', 'Failed to stop recording')
    }
  }

  const cancelRecording = async () => {
    if (!recording) return

    try {
      // Clear interval
      if ((recording as any).durationInterval) {
        clearInterval((recording as any).durationInterval)
      }

      setIsRecording(false)
      await recording.stopAndUnloadAsync()
      setRecording(null)
      setRecordingDuration(0)

      // Reset audio mode
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      })
    } catch (error) {
      console.error('Error canceling recording:', error)
    }
  }

  const handlePlayPreview = async () => {
    if (!previewSound) return

    try {
      if (isPlaying) {
        await previewSound.pauseAsync()
        setIsPlaying(false)
      } else {
        await previewSound.playAsync()
        setIsPlaying(true)

        // Reset when finished
        previewSound.setOnPlaybackStatusUpdate((status) => {
          if (status.isLoaded && status.didJustFinish) {
            setIsPlaying(false)
            previewSound.setPositionAsync(0)
          }
        })
      }
    } catch (error) {
      console.error('Error playing preview:', error)
      Alert.alert('Playback Error', 'Could not play audio preview')
    }
  }

  const handleUpload = async () => {
    if (!selectedFile) {
      Alert.alert('No File', 'Please select an audio file first')
      return
    }

    if (!fileName.trim()) {
      Alert.alert('No Name', 'Please enter a name for this highlight')
      return
    }

    if (!user?.id) {
      Alert.alert('Error', 'User not authenticated')
      return
    }

    try {
      setUploading(true)
      setUploadProgress(0)

      // Check highlights limit
      const { count, error: countError } = await supabase
        .from('highlights')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)

      if (countError) throw countError

      if (count && count >= 5) {
        Alert.alert('Limit Reached', 'You can only have up to 5 highlights. Please delete one first.')
        setUploading(false)
        return
      }

      // Stop preview if playing
      if (previewSound && isPlaying) {
        await previewSound.stopAsync()
        setIsPlaying(false)
      }

      // Generate unique filename
      const fileExt = selectedFile.name.split('.').pop()
      const timestamp = Date.now()
      const storageFileName = `${timestamp}_${fileName.replace(/[^a-zA-Z0-9]/g, '_')}.${fileExt}`
      const filePath = `${user.id}/${storageFileName}`

      setUploadProgress(10)

      // Convert file URI to ArrayBuffer for upload
      const response = await fetch(selectedFile.uri)
      const arrayBuffer = await response.arrayBuffer()

      setUploadProgress(40)

      // Normalize mime type
      let contentType = selectedFile.mimeType || 'audio/mpeg'
      const mimeTypeMap: Record<string, string> = {
        'audio/vnd.wave': 'audio/wav',
        'audio/x-wav': 'audio/wav',
        'audio/x-m4a': 'audio/mpeg',
        'audio/mp4': 'audio/mpeg',
        'audio/x-flac': 'audio/flac',
        'audio/x-aiff': 'audio/aiff',
      }
      contentType = mimeTypeMap[contentType] || contentType

      // Upload to Supabase Storage (highlights bucket)
      const { error: uploadError } = await supabase.storage
        .from('highlights')
        .upload(filePath, arrayBuffer, {
          contentType,
          upsert: false,
        })

      if (uploadError) throw uploadError

      setUploadProgress(70)

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('highlights')
        .getPublicUrl(filePath)

      setUploadProgress(80)

      // Get next order index
      const { data: existingHighlights } = await supabase
        .from('highlights')
        .select('order_index')
        .eq('user_id', user.id)
        .order('order_index', { ascending: false })
        .limit(1)

      const nextOrderIndex = existingHighlights && existingHighlights.length > 0
        ? (existingHighlights[0].order_index || 0) + 1
        : 0

      // Insert into database
      const { error: dbError } = await supabase
        .from('highlights')
        .insert({
          user_id: user.id,
          file_url: publicUrl,
          file_name: fileName.trim(),
          duration: audioDuration || 0,
          bpm: bpm ? parseInt(bpm) : null,
          key: keySignature.trim() || null,
          order_index: nextOrderIndex,
        })

      if (dbError) throw dbError

      setUploadProgress(100)

      // Cleanup
      if (previewSound) {
        await previewSound.unloadAsync()
      }

      // Success!
      Alert.alert(
        'Upload Complete',
        'Your highlight has been added to your profile!',
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ]
      )

    } catch (error: any) {
      console.error('Error uploading file:', error)
      Alert.alert('Upload Failed', error.message || 'Failed to upload file')
    } finally {
      setUploading(false)
      setUploadProgress(0)
    }
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const formatDuration = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  return (
    <SafeAreaView style={styles.container}>
      <Header
        title="Add Highlight"
        variant="compact"
        showBack={true}
        onBack={() => navigation.goBack()}
        showProfile={true}
        onProfilePress={() => navigation.navigate('Profile')}
        profilePhotoUrl={userProfile?.avatar_url}
      />

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* File Selection */}
        {!selectedFile ? (
          <View>
            <Text style={styles.sectionTitle}>Choose Audio Source</Text>
            <Text style={styles.sectionSubtitle}>
              Supports: WAV, MP3, MP4, FLAC, AIFF, AAC, M4A, OGG, OPUS • Max 500 MB
            </Text>

            {/* Cloud Storage Options */}
            <View style={styles.cloudOptionsContainer}>
              <TouchableOpacity
                style={styles.cloudOption}
                onPress={handleSelectFile}
                disabled={uploading}
              >
                <View style={[styles.cloudIcon, { backgroundColor: '#E3F2FD' }]}>
                  <Ionicons name="cloud-outline" size={28} color="#007AFF" />
                </View>
                <View style={styles.cloudInfo}>
                  <Text style={styles.cloudTitle}>iCloud Drive</Text>
                  <Text style={styles.cloudSubtitle}>Access your iCloud files</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.cloudOption}
                onPress={handleSelectFile}
                disabled={uploading}
              >
                <View style={[styles.cloudIcon, { backgroundColor: '#E8F5E9' }]}>
                  <Ionicons name="logo-google" size={28} color="#4285F4" />
                </View>
                <View style={styles.cloudInfo}>
                  <Text style={styles.cloudTitle}>Google Drive</Text>
                  <Text style={styles.cloudSubtitle}>Browse Google Drive files</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.cloudOption}
                onPress={handleSelectFile}
                disabled={uploading}
              >
                <View style={[styles.cloudIcon, { backgroundColor: '#E3F2FD' }]}>
                  <Ionicons name="logo-dropbox" size={28} color="#0061FF" />
                </View>
                <View style={styles.cloudInfo}>
                  <Text style={styles.cloudTitle}>Dropbox</Text>
                  <Text style={styles.cloudSubtitle}>Access Dropbox files</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.cloudOption}
                onPress={handleSelectFile}
                disabled={uploading}
              >
                <View style={[styles.cloudIcon, { backgroundColor: '#F3E5F5' }]}>
                  <Ionicons name="folder-outline" size={28} color={Colors.primary} />
                </View>
                <View style={styles.cloudInfo}>
                  <Text style={styles.cloudTitle}>Browse All Files</Text>
                  <Text style={styles.cloudSubtitle}>Local & other cloud storage</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Recording Option */}
            <View style={styles.recordingSection}>
              <Text style={styles.sectionDivider}>OR</Text>

              {!isRecording ? (
                <TouchableOpacity
                  style={[styles.recordButton, styles.recordButtonStart]}
                  onPress={startRecording}
                  disabled={uploading}
                >
                  <View style={styles.recordIconContainer}>
                    <Ionicons name="mic" size={32} color="#FFF" />
                  </View>
                  <Text style={styles.recordButtonText}>Record Audio</Text>
                  <Text style={styles.recordButtonSubtext}>Tap to start recording</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.recordingContainer}>
                  <View style={styles.recordingIndicator}>
                    <View style={styles.recordingDot} />
                    <Text style={styles.recordingText}>Recording...</Text>
                    <Text style={styles.recordingDuration}>
                      {formatDuration(recordingDuration)}
                    </Text>
                  </View>

                  <View style={styles.recordingControls}>
                    <TouchableOpacity
                      style={[styles.recordingControlButton, styles.cancelButton]}
                      onPress={cancelRecording}
                    >
                      <Ionicons name="close" size={24} color={Colors.text} />
                      <Text style={styles.recordingControlText}>Cancel</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.recordingControlButton, styles.stopButton]}
                      onPress={stopRecording}
                    >
                      <Ionicons name="stop" size={24} color="#FFF" />
                      <Text style={[styles.recordingControlText, { color: '#FFF' }]}>Done</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>

            <View style={styles.helpBox}>
              <Ionicons name="information-circle-outline" size={18} color={Colors.info} />
              <Text style={styles.helpText}>
                Tap any option to open Files app, then navigate to your storage location
              </Text>
            </View>
          </View>
        ) : (
          <View style={styles.selectedFileContainer}>
            <View style={styles.selectedFileHeader}>
              <Ionicons name="musical-note" size={48} color={Colors.success} />
              <Text style={styles.selectedFileName}>{selectedFile.name}</Text>
              <Text style={styles.selectedFileSize}>
                {formatFileSize(selectedFile.size)}
                {audioDuration && ` • ${formatDuration(audioDuration)}`}
              </Text>

              {/* Preview Button */}
              {previewSound && (
                <TouchableOpacity
                  style={styles.previewButton}
                  onPress={handlePlayPreview}
                >
                  <Ionicons
                    name={isPlaying ? "pause-circle" : "play-circle"}
                    size={48}
                    color={Colors.primary}
                  />
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={styles.changeFileButton}
                onPress={handleSelectFile}
                disabled={uploading}
              >
                <Ionicons name="swap-horizontal" size={18} color={Colors.primary} />
                <Text style={styles.changeFileButtonText}>Change File</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Metadata Form */}
        {selectedFile && (
          <View style={styles.detailsSection}>
            {/* File Name */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Track Name</Text>
              <TextInput
                style={styles.input}
                value={fileName}
                onChangeText={setFileName}
                placeholder="e.g., My Best Track"
                placeholderTextColor={Colors.textTertiary}
                editable={!uploading}
              />
            </View>

            {/* BPM (Optional) */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>BPM (Optional)</Text>
              <TextInput
                style={styles.input}
                value={bpm}
                onChangeText={(text) => setBpm(text.replace(/[^0-9]/g, ''))}
                placeholder="e.g., 120"
                placeholderTextColor={Colors.textTertiary}
                keyboardType="number-pad"
                editable={!uploading}
              />
            </View>

            {/* Key (Optional) */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Key (Optional)</Text>
              <TextInput
                style={styles.input}
                value={keySignature}
                onChangeText={setKeySignature}
                placeholder="e.g., C Major, A Minor"
                placeholderTextColor={Colors.textTertiary}
                editable={!uploading}
              />
            </View>

            {/* Upload Button */}
            <TouchableOpacity
              style={[
                styles.uploadButton,
                uploading && styles.uploadButtonDisabled,
              ]}
              onPress={handleUpload}
              disabled={uploading || !fileName.trim()}
            >
              {uploading ? (
                <>
                  <ActivityIndicator color={Colors.text} size="small" />
                  <Text style={styles.uploadButtonText}>
                    Uploading... {uploadProgress}%
                  </Text>
                </>
              ) : (
                <>
                  <Ionicons name="cloud-upload" size={20} color={Colors.text} />
                  <Text style={styles.uploadButtonText}>Add to Highlights</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Tips Section */}
        <View style={styles.tipsSection}>
          <Text style={styles.tipsTitle}>Highlight Tips</Text>

          <View style={styles.tip}>
            <Ionicons name="checkmark-circle" size={20} color={Colors.success} />
            <Text style={styles.tipText}>
              Showcase your best work - you can add up to 5 highlights
            </Text>
          </View>

          <View style={styles.tip}>
            <Ionicons name="checkmark-circle" size={20} color={Colors.success} />
            <Text style={styles.tipText}>
              Use high-quality audio files for the best impression
            </Text>
          </View>

          <View style={styles.tip}>
            <Ionicons name="checkmark-circle" size={20} color={Colors.success} />
            <Text style={styles.tipText}>
              Add BPM and key info to help others find compatible tracks
            </Text>
          </View>
        </View>
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
  },
  contentContainer: {
    padding: Spacing.lg,
  },
  sectionTitle: {
    ...Typography.h2,
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  sectionSubtitle: {
    ...Typography.body,
    color: Colors.textSecondary,
    marginBottom: Spacing.lg,
  },
  cloudOptionsContainer: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.sm,
    marginBottom: Spacing.md,
  },
  cloudOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
  },
  cloudIcon: {
    width: 52,
    height: 52,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  cloudInfo: {
    flex: 1,
  },
  cloudTitle: {
    ...Typography.bodyLarge,
    color: Colors.text,
    fontWeight: '600',
    marginBottom: Spacing.xxs,
  },
  cloudSubtitle: {
    ...Typography.caption,
    color: Colors.textSecondary,
  },
  helpBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },
  helpText: {
    ...Typography.caption,
    color: Colors.textSecondary,
    flex: 1,
  },
  selectedFileContainer: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  selectedFileHeader: {
    alignItems: 'center',
  },
  selectedFileName: {
    ...Typography.h3,
    color: Colors.text,
    marginTop: Spacing.md,
    textAlign: 'center',
  },
  selectedFileSize: {
    ...Typography.body,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },
  previewButton: {
    marginTop: Spacing.md,
  },
  changeFileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  changeFileButtonText: {
    ...Typography.body,
    color: Colors.primary,
    fontWeight: '600',
  },
  detailsSection: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  formGroup: {
    marginBottom: Spacing.lg,
  },
  label: {
    ...Typography.bodyLarge,
    color: Colors.text,
    fontWeight: '600',
    marginBottom: Spacing.sm,
  },
  input: {
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    color: Colors.text,
    ...Typography.body,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.md,
  },
  uploadButtonDisabled: {
    opacity: 0.6,
  },
  uploadButtonText: {
    ...Typography.bodyLarge,
    color: Colors.text,
    fontWeight: '600',
  },
  tipsSection: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
  },
  tipsTitle: {
    ...Typography.h3,
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  tip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  tipText: {
    ...Typography.body,
    color: Colors.text,
    flex: 1,
    lineHeight: 22,
  },
  recordingSection: {
    marginTop: Spacing.xl,
    paddingTop: Spacing.xl,
  },
  sectionDivider: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.lg,
    fontWeight: '600',
  },
  recordButton: {
    alignItems: 'center',
    padding: Spacing.xl,
    borderRadius: BorderRadius.lg,
    borderWidth: 2,
    borderStyle: 'dashed',
  },
  recordButtonStart: {
    borderColor: Colors.error,
    backgroundColor: `${Colors.error}10`,
  },
  recordIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.error,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  recordButtonText: {
    ...Typography.h3,
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  recordButtonSubtext: {
    ...Typography.body,
    color: Colors.textSecondary,
  },
  recordingContainer: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    borderWidth: 2,
    borderColor: Colors.error,
  },
  recordingIndicator: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  recordingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.error,
    marginBottom: Spacing.sm,
  },
  recordingText: {
    ...Typography.h3,
    color: Colors.error,
    marginBottom: Spacing.xs,
  },
  recordingDuration: {
    ...Typography.h1,
    color: Colors.text,
    fontVariant: ['tabular-nums'],
  },
  recordingControls: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  recordingControlButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  cancelButton: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  stopButton: {
    backgroundColor: Colors.error,
  },
  recordingControlText: {
    ...Typography.bodyLarge,
    fontWeight: '600',
  },
})
