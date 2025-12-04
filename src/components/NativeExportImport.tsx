/**
 * Native Export/Import Component
 *
 * Comprehensive file management system for the native DAW.
 * Handles importing audio files, exporting projects in various formats,
 * and managing file operations with React Native file system APIs.
 */

import React, { useState, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  ActivityIndicator,
  Share,
  Platform,
} from 'react-native'
import { Audio, Video } from 'expo-av'
import * as FileSystem from 'expo-file-system'
import * as DocumentPicker from 'expo-document-picker'
import * as Sharing from 'expo-sharing'
import * as MediaLibrary from 'expo-media-library'
import { Colors, Typography, Spacing } from '../constants/theme'
import { AudioTrack, AudioEffect } from './NativeAudioEngine'
import Icon from 'react-native-vector-icons/MaterialIcons'

// =================== TYPES ===================

export interface ProjectData {
  id: string
  name: string
  description?: string
  createdAt: string
  updatedAt: string
  bpm: number
  duration: number
  tracks: AudioTrack[]
  masterVolume: number
  version: string
}

export interface ExportOptions {
  format: 'wav' | 'mp3' | 'aac' | 'project'
  quality: 'low' | 'medium' | 'high'
  includeEffects: boolean
  bounceToStereo: boolean
  normalizeAudio: boolean
}

export interface ImportResult {
  success: boolean
  tracks?: AudioTrack[]
  error?: string
}

export interface ExportResult {
  success: boolean
  fileUri?: string
  error?: string
}

interface NativeExportImportProps {
  projectData: ProjectData
  onProjectImport?: (projectData: ProjectData) => void
  onTracksImport?: (tracks: AudioTrack[]) => void
  onExportComplete?: (result: ExportResult) => void
  onError?: (error: string) => void
}

// =================== EXPORT/IMPORT HOOK ===================

export function useNativeExportImport({
  projectData,
  onProjectImport,
  onTracksImport,
  onExportComplete,
  onError,
}: NativeExportImportProps) {
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState(0)

  // =================== IMPORT FUNCTIONS ===================

  const importAudioFiles = useCallback(async (): Promise<ImportResult> => {
    try {
      setIsProcessing(true)
      setProgress(0)

      const result = await DocumentPicker.getDocumentAsync({
        type: 'audio/*',
        multiple: true,
        copyToCacheDirectory: true,
      })

      if (result.canceled || !result.assets) {
        setIsProcessing(false)
        return { success: false, error: 'No files selected' }
      }

      const importedTracks: AudioTrack[] = []

      for (let i = 0; i < result.assets.length; i++) {
        const asset = result.assets[i]
        setProgress((i + 1) / result.assets.length)

        try {
          // Copy file to app's document directory
          const fileName = asset.name || `imported_audio_${Date.now()}.${getFileExtension(asset.uri)}`
          const destinationUri = `${FileSystem.documentDirectory}audio/${fileName}`

          // Ensure directory exists
          await FileSystem.makeDirectoryAsync(`${FileSystem.documentDirectory}audio/`, {
            intermediates: true,
          })

          // Copy file
          await FileSystem.copyAsync({
            from: asset.uri,
            to: destinationUri,
          })

          // Get audio duration using expo-av
          const { sound } = await Audio.Sound.createAsync({ uri: destinationUri })
          const status = await sound.getStatusAsync()

          let duration = 0
          if (status.isLoaded) {
            duration = (status.durationMillis || 0) / 1000
          }

          await sound.unloadAsync()

          // Generate waveform data (placeholder - in real implementation, you'd analyze the audio)
          const waveformData = await generateWaveformFromAudio(destinationUri)

          const track: AudioTrack = {
            id: `imported_${Date.now()}_${i}`,
            uri: destinationUri,
            name: fileName.replace(/\.[^/.]+$/, ''), // Remove extension
            volume: 0.8,
            muted: false,
            solo: false,
            startTime: 0,
            duration,
            effects: [],
            waveformData,
          }

          importedTracks.push(track)
        } catch (error) {
          console.error(`Failed to import ${asset.name}:`, error)
          onError?.(`Failed to import ${asset.name}: ${error}`)
        }
      }

      setIsProcessing(false)
      setProgress(0)

      if (importedTracks.length > 0) {
        onTracksImport?.(importedTracks)
        return { success: true, tracks: importedTracks }
      }

      return { success: false, error: 'No tracks imported successfully' }
    } catch (error) {
      setIsProcessing(false)
      const errorMessage = `Import failed: ${error}`
      onError?.(errorMessage)
      return { success: false, error: errorMessage }
    }
  }, [onTracksImport, onError])

  const importProject = useCallback(async (): Promise<ImportResult> => {
    try {
      setIsProcessing(true)

      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true,
      })

      if (result.canceled || !result.assets?.[0]) {
        setIsProcessing(false)
        return { success: false, error: 'No project file selected' }
      }

      const asset = result.assets[0]
      const projectJson = await FileSystem.readAsStringAsync(asset.uri)
      const importedProject: ProjectData = JSON.parse(projectJson)

      // Validate project structure
      if (!validateProjectData(importedProject)) {
        throw new Error('Invalid project file format')
      }

      // Copy audio files to app directory
      const updatedTracks: AudioTrack[] = []
      for (const track of importedProject.tracks) {
        if (track.uri && track.uri.startsWith('file://')) {
          try {
            const fileName = track.uri.split('/').pop() || `track_${track.id}.wav`
            const destinationUri = `${FileSystem.documentDirectory}audio/${fileName}`

            await FileSystem.makeDirectoryAsync(`${FileSystem.documentDirectory}audio/`, {
              intermediates: true,
            })

            if (await FileSystem.getInfoAsync(track.uri)) {
              await FileSystem.copyAsync({
                from: track.uri,
                to: destinationUri,
              })

              updatedTracks.push({
                ...track,
                uri: destinationUri,
              })
            } else {
              console.warn(`Track file not found: ${track.uri}`)
              updatedTracks.push(track)
            }
          } catch (error) {
            console.warn(`Failed to copy track file: ${track.uri}`, error)
            updatedTracks.push(track)
          }
        } else {
          updatedTracks.push(track)
        }
      }

      const finalProject: ProjectData = {
        ...importedProject,
        id: `imported_${Date.now()}`,
        tracks: updatedTracks,
      }

      setIsProcessing(false)
      onProjectImport?.(finalProject)

      return { success: true }
    } catch (error) {
      setIsProcessing(false)
      const errorMessage = `Project import failed: ${error}`
      onError?.(errorMessage)
      return { success: false, error: errorMessage }
    }
  }, [onProjectImport, onError])

  // =================== EXPORT FUNCTIONS ===================

  const exportProject = useCallback(async (): Promise<ExportResult> => {
    try {
      setIsProcessing(true)

      const projectJson = JSON.stringify(projectData, null, 2)
      const fileName = `${projectData.name.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.json`
      const fileUri = `${FileSystem.documentDirectory}projects/${fileName}`

      // Ensure directory exists
      await FileSystem.makeDirectoryAsync(`${FileSystem.documentDirectory}projects/`, {
        intermediates: true,
      })

      // Write project file
      await FileSystem.writeAsStringAsync(fileUri, projectJson)

      setIsProcessing(false)

      const result: ExportResult = { success: true, fileUri }
      onExportComplete?.(result)

      return result
    } catch (error) {
      setIsProcessing(false)
      const errorMessage = `Project export failed: ${error}`
      onError?.(errorMessage)
      return { success: false, error: errorMessage }
    }
  }, [projectData, onExportComplete, onError])

  const exportAudio = useCallback(async (options: ExportOptions): Promise<ExportResult> => {
    try {
      setIsProcessing(true)
      setProgress(0)

      // For now, this is a simplified implementation
      // In a real app, you'd mix all tracks together with effects

      if (projectData.tracks.length === 0) {
        throw new Error('No tracks to export')
      }

      // Create output filename
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const fileName = `${projectData.name}_export_${timestamp}.${options.format}`
      const outputUri = `${FileSystem.documentDirectory}exports/${fileName}`

      // Ensure directory exists
      await FileSystem.makeDirectoryAsync(`${FileSystem.documentDirectory}exports/`, {
        intermediates: true,
      })

      // Simplified: just copy the first track as an example
      // In reality, you'd mix all tracks, apply effects, etc.
      const firstTrack = projectData.tracks[0]
      if (firstTrack.uri) {
        await FileSystem.copyAsync({
          from: firstTrack.uri,
          to: outputUri,
        })
      } else {
        throw new Error('No audio data to export')
      }

      setIsProcessing(false)
      setProgress(0)

      const result: ExportResult = { success: true, fileUri: outputUri }
      onExportComplete?.(result)

      return result
    } catch (error) {
      setIsProcessing(false)
      const errorMessage = `Audio export failed: ${error}`
      onError?.(errorMessage)
      return { success: false, error: errorMessage }
    }
  }, [projectData, onExportComplete, onError])

  const shareFile = useCallback(async (fileUri: string, mimeType?: string) => {
    try {
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType,
          dialogTitle: 'Share exported file',
        })
      } else {
        if (Platform.OS === 'ios') {
          await Share.share({
            url: fileUri,
          })
        } else {
          throw new Error('Sharing not available on this device')
        }
      }
    } catch (error) {
      console.error('Share failed:', error)
      onError?.(`Share failed: ${error}`)
    }
  }, [onError])

  const saveToMediaLibrary = useCallback(async (fileUri: string) => {
    try {
      const permission = await MediaLibrary.requestPermissionsAsync()
      if (!permission.granted) {
        throw new Error('Media library permission not granted')
      }

      const asset = await MediaLibrary.createAssetAsync(fileUri)
      Alert.alert('Success', 'File saved to media library')

      return asset
    } catch (error) {
      console.error('Save to media library failed:', error)
      onError?.(`Save to media library failed: ${error}`)
    }
  }, [onError])

  return {
    // State
    isProcessing,
    progress,

    // Import functions
    importAudioFiles,
    importProject,

    // Export functions
    exportProject,
    exportAudio,

    // Sharing functions
    shareFile,
    saveToMediaLibrary,
  }
}

// =================== EXPORT/IMPORT COMPONENT ===================

export default function NativeExportImport(props: NativeExportImportProps) {
  const [showModal, setShowModal] = useState(false)
  const [modalType, setModalType] = useState<'import' | 'export' | null>(null)
  const [exportOptions, setExportOptions] = useState<ExportOptions>({
    format: 'wav',
    quality: 'high',
    includeEffects: true,
    bounceToStereo: true,
    normalizeAudio: false,
  })

  const {
    isProcessing,
    progress,
    importAudioFiles,
    importProject,
    exportProject,
    exportAudio,
    shareFile,
    saveToMediaLibrary,
  } = useNativeExportImport(props)

  const handleImportAudio = useCallback(async () => {
    const result = await importAudioFiles()
    if (result.success) {
      Alert.alert('Success', `Imported ${result.tracks?.length || 0} audio files`)
      setShowModal(false)
    }
  }, [importAudioFiles])

  const handleImportProject = useCallback(async () => {
    const result = await importProject()
    if (result.success) {
      Alert.alert('Success', 'Project imported successfully')
      setShowModal(false)
    }
  }, [importProject])

  const handleExportProject = useCallback(async () => {
    const result = await exportProject()
    if (result.success && result.fileUri) {
      Alert.alert(
        'Export Complete',
        'Project exported successfully',
        [
          { text: 'OK' },
          { text: 'Share', onPress: () => shareFile(result.fileUri!, 'application/json') },
        ]
      )
      setShowModal(false)
    }
  }, [exportProject, shareFile])

  const handleExportAudio = useCallback(async () => {
    const result = await exportAudio(exportOptions)
    if (result.success && result.fileUri) {
      Alert.alert(
        'Export Complete',
        'Audio exported successfully',
        [
          { text: 'OK' },
          { text: 'Share', onPress: () => shareFile(result.fileUri!, 'audio/wav') },
          { text: 'Save to Library', onPress: () => saveToMediaLibrary(result.fileUri!) },
        ]
      )
      setShowModal(false)
    }
  }, [exportAudio, exportOptions, shareFile, saveToMediaLibrary])

  const openImportModal = useCallback(() => {
    setModalType('import')
    setShowModal(true)
  }, [])

  const openExportModal = useCallback(() => {
    setModalType('export')
    setShowModal(true)
  }, [])

  return (
    <View style={styles.container}>
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.actionButton, styles.importButton]}
          onPress={openImportModal}
          disabled={isProcessing}
        >
          <Icon name="file-upload" size={24} color={Colors.surface} />
          <Text style={styles.buttonText}>Import</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.exportButton]}
          onPress={openExportModal}
          disabled={isProcessing}
        >
          <Icon name="file-download" size={24} color={Colors.surface} />
          <Text style={styles.buttonText}>Export</Text>
        </TouchableOpacity>
      </View>

      {isProcessing && (
        <View style={styles.progressContainer}>
          <ActivityIndicator size="small" color={Colors.primary} />
          <Text style={styles.progressText}>
            {progress > 0 ? `Processing... ${Math.round(progress * 100)}%` : 'Processing...'}
          </Text>
        </View>
      )}

      {/* Import/Export Modal */}
      <Modal
        visible={showModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowModal(false)}
      >
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {modalType === 'import' ? 'Import' : 'Export'}
            </Text>
            <TouchableOpacity
              onPress={() => setShowModal(false)}
              style={styles.closeButton}
            >
              <Icon name="close" size={24} color={Colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            {modalType === 'import' ? (
              <ImportOptions
                onImportAudio={handleImportAudio}
                onImportProject={handleImportProject}
                isProcessing={isProcessing}
              />
            ) : (
              <ExportOptions
                options={exportOptions}
                onOptionsChange={setExportOptions}
                onExportProject={handleExportProject}
                onExportAudio={handleExportAudio}
                isProcessing={isProcessing}
                projectData={props.projectData}
              />
            )}
          </ScrollView>
        </View>
      </Modal>
    </View>
  )
}

// =================== SUB-COMPONENTS ===================

interface ImportOptionsProps {
  onImportAudio: () => void
  onImportProject: () => void
  isProcessing: boolean
}

function ImportOptions({ onImportAudio, onImportProject, isProcessing }: ImportOptionsProps) {
  return (
    <View style={styles.optionsContainer}>
      <TouchableOpacity
        style={styles.optionButton}
        onPress={onImportAudio}
        disabled={isProcessing}
      >
        <Icon name="audiotrack" size={32} color={Colors.primary} />
        <Text style={styles.optionTitle}>Import Audio Files</Text>
        <Text style={styles.optionDescription}>
          Import WAV, MP3, AIFF, or other audio files as tracks
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.optionButton}
        onPress={onImportProject}
        disabled={isProcessing}
      >
        <Icon name="folder" size={32} color={Colors.primary} />
        <Text style={styles.optionTitle}>Import Project</Text>
        <Text style={styles.optionDescription}>
          Import a previously exported DAW project file
        </Text>
      </TouchableOpacity>
    </View>
  )
}

interface ExportOptionsProps {
  options: ExportOptions
  onOptionsChange: (options: ExportOptions) => void
  onExportProject: () => void
  onExportAudio: () => void
  isProcessing: boolean
  projectData: ProjectData
}

function ExportOptions({
  options,
  onOptionsChange,
  onExportProject,
  onExportAudio,
  isProcessing,
  projectData,
}: ExportOptionsProps) {
  const updateOption = useCallback(
    (key: keyof ExportOptions, value: any) => {
      onOptionsChange({ ...options, [key]: value })
    },
    [options, onOptionsChange]
  )

  return (
    <View style={styles.optionsContainer}>
      {/* Project Export */}
      <View style={styles.exportSection}>
        <Text style={styles.sectionTitle}>Export Project</Text>
        <TouchableOpacity
          style={styles.optionButton}
          onPress={onExportProject}
          disabled={isProcessing}
        >
          <Icon name="folder" size={32} color={Colors.primary} />
          <Text style={styles.optionTitle}>Export as Project File</Text>
          <Text style={styles.optionDescription}>
            Save project as JSON file to import later
          </Text>
        </TouchableOpacity>
      </View>

      {/* Audio Export */}
      <View style={styles.exportSection}>
        <Text style={styles.sectionTitle}>Export Audio</Text>

        {/* Format Selection */}
        <View style={styles.optionGroup}>
          <Text style={styles.optionGroupTitle}>Format</Text>
          <View style={styles.formatButtons}>
            {(['wav', 'mp3', 'aac'] as const).map((format) => (
              <TouchableOpacity
                key={format}
                style={[
                  styles.formatButton,
                  options.format === format && styles.formatButtonActive,
                ]}
                onPress={() => updateOption('format', format)}
              >
                <Text
                  style={[
                    styles.formatButtonText,
                    options.format === format && styles.formatButtonTextActive,
                  ]}
                >
                  {format.toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Quality Selection */}
        <View style={styles.optionGroup}>
          <Text style={styles.optionGroupTitle}>Quality</Text>
          <View style={styles.formatButtons}>
            {(['low', 'medium', 'high'] as const).map((quality) => (
              <TouchableOpacity
                key={quality}
                style={[
                  styles.formatButton,
                  options.quality === quality && styles.formatButtonActive,
                ]}
                onPress={() => updateOption('quality', quality)}
              >
                <Text
                  style={[
                    styles.formatButtonText,
                    options.quality === quality && styles.formatButtonTextActive,
                  ]}
                >
                  {quality.charAt(0).toUpperCase() + quality.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Export Options */}
        <View style={styles.optionGroup}>
          <Text style={styles.optionGroupTitle}>Options</Text>

          <TouchableOpacity
            style={styles.checkboxOption}
            onPress={() => updateOption('includeEffects', !options.includeEffects)}
          >
            <Icon
              name={options.includeEffects ? 'check-box' : 'check-box-outline-blank'}
              size={24}
              color={Colors.primary}
            />
            <Text style={styles.checkboxText}>Include Effects</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.checkboxOption}
            onPress={() => updateOption('bounceToStereo', !options.bounceToStereo)}
          >
            <Icon
              name={options.bounceToStereo ? 'check-box' : 'check-box-outline-blank'}
              size={24}
              color={Colors.primary}
            />
            <Text style={styles.checkboxText}>Bounce to Stereo</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.checkboxOption}
            onPress={() => updateOption('normalizeAudio', !options.normalizeAudio)}
          >
            <Icon
              name={options.normalizeAudio ? 'check-box' : 'check-box-outline-blank'}
              size={24}
              color={Colors.primary}
            />
            <Text style={styles.checkboxText}>Normalize Audio</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.exportAudioButton, isProcessing && styles.exportAudioButtonDisabled]}
          onPress={onExportAudio}
          disabled={isProcessing || projectData.tracks.length === 0}
        >
          <Icon name="audiotrack" size={24} color={Colors.surface} />
          <Text style={styles.exportAudioButtonText}>Export Audio</Text>
        </TouchableOpacity>

        {projectData.tracks.length === 0 && (
          <Text style={styles.warningText}>
            No tracks to export. Import or record some audio first.
          </Text>
        )}
      </View>
    </View>
  )
}

// =================== UTILITY FUNCTIONS ===================

function getFileExtension(uri: string): string {
  const parts = uri.split('.')
  return parts.length > 1 ? parts.pop() || 'wav' : 'wav'
}

function validateProjectData(data: any): data is ProjectData {
  return (
    data &&
    typeof data.id === 'string' &&
    typeof data.name === 'string' &&
    typeof data.bpm === 'number' &&
    Array.isArray(data.tracks)
  )
}

async function generateWaveformFromAudio(uri: string): Promise<number[]> {
  // Placeholder implementation - in reality, you'd analyze the audio file
  // This could use Web Audio API or a native audio analysis library
  const sampleLength = 200
  return Array.from({ length: sampleLength }, () => Math.random() * 0.8 + 0.1)
}

// =================== STYLES ===================

const styles = StyleSheet.create({
  container: {
    padding: Spacing.md,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.md,
    borderRadius: 12,
    gap: Spacing.sm,
  },
  importButton: {
    backgroundColor: Colors.success,
  },
  exportButton: {
    backgroundColor: Colors.primary,
  },
  buttonText: {
    ...Typography.body,
    color: Colors.surface,
    fontWeight: 'bold',
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.md,
    gap: Spacing.sm,
  },
  progressText: {
    ...Typography.body,
    color: Colors.textSecondary,
  },

  // Modal Styles
  modal: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: {
    ...Typography.h2,
    color: Colors.text,
  },
  closeButton: {
    padding: Spacing.sm,
  },
  modalContent: {
    flex: 1,
    padding: Spacing.lg,
  },
  optionsContainer: {
    gap: Spacing.lg,
  },
  optionButton: {
    padding: Spacing.lg,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  optionTitle: {
    ...Typography.h4,
    color: Colors.text,
  },
  optionDescription: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },

  // Export Options Styles
  exportSection: {
    gap: Spacing.md,
  },
  sectionTitle: {
    ...Typography.h3,
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  optionGroup: {
    gap: Spacing.sm,
  },
  optionGroupTitle: {
    ...Typography.body,
    color: Colors.text,
    fontWeight: 'bold',
  },
  formatButtons: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  formatButton: {
    flex: 1,
    padding: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  formatButtonActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  formatButtonText: {
    ...Typography.body,
    color: Colors.text,
    fontWeight: 'bold',
  },
  formatButtonTextActive: {
    color: Colors.surface,
  },
  checkboxOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  checkboxText: {
    ...Typography.body,
    color: Colors.text,
  },
  exportAudioButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.lg,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  exportAudioButtonDisabled: {
    backgroundColor: Colors.border,
  },
  exportAudioButtonText: {
    ...Typography.body,
    color: Colors.surface,
    fontWeight: 'bold',
  },
  warningText: {
    ...Typography.body,
    color: Colors.warning,
    textAlign: 'center',
    marginTop: Spacing.sm,
  },
})