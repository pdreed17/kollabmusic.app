import { supabase } from '../lib/supabase'
import { Audio } from 'expo-av'

// Comprehensive audio format support
export const AUDIO_FORMATS = {
  // Lossless formats (best quality)
  WAV: { extensions: ['.wav'], mimeTypes: ['audio/wav', 'audio/x-wav'], lossless: true },
  FLAC: { extensions: ['.flac'], mimeTypes: ['audio/flac', 'audio/x-flac'], lossless: true },
  AIFF: { extensions: ['.aiff', '.aif'], mimeTypes: ['audio/aiff', 'audio/x-aiff'], lossless: true },
  ALAC: { extensions: ['.m4a'], mimeTypes: ['audio/mp4'], lossless: true },

  // Lossy formats (compressed)
  MP3: { extensions: ['.mp3'], mimeTypes: ['audio/mpeg', 'audio/mp3'], lossless: false },
  AAC: { extensions: ['.aac', '.m4a'], mimeTypes: ['audio/aac', 'audio/mp4'], lossless: false },
  OGG: { extensions: ['.ogg'], mimeTypes: ['audio/ogg'], lossless: false },
  OPUS: { extensions: ['.opus'], mimeTypes: ['audio/opus'], lossless: false },

  // Professional formats
  MIDI: { extensions: ['.mid', '.midi'], mimeTypes: ['audio/midi', 'audio/x-midi'], lossless: false },
}

export interface AudioMetadata {
  duration: number // in milliseconds
  format: string
  sampleRate?: number
  bitrate?: number
  channels?: number
  isLossless: boolean
}

export interface AudioValidation {
  valid: boolean
  error?: string
  warnings?: string[]
  metadata?: AudioMetadata
}

class AudioService {
  /**
   * Get all audio files for a project
   */
  async getProjectAudioFiles(projectId: string) {
    try {
      const { data, error } = await supabase
        .from('audio_files')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: true })

      if (error) throw error
      return data || []
    } catch (error) {
      if (__DEV__) console.error('Error getting audio files:', error)
      throw error
    }
  }

  /**
   * Get signed URL for audio file
   */
  async getAudioUrl(filePath: string): Promise<string> {
    try {
      const { data, error } = await supabase.storage
        .from('audio-files')
        .createSignedUrl(filePath, 3600) // 1 hour expiry

      if (error) throw error
      return data.signedUrl
    } catch (error) {
      if (__DEV__) console.error('Error getting audio URL:', error)
      throw error
    }
  }

  /**
   * Update mixer settings for a track
   */
  async updateMixerSettings(
    audioFileId: string,
    settings: {
      volume?: number
      pan?: number
      is_muted?: boolean
      is_soloed?: boolean
    }
  ) {
    try {
      const { error } = await supabase
        .from('audio_files')
        .update(settings)
        .eq('id', audioFileId)

      if (error) throw error
    } catch (error) {
      if (__DEV__) console.error('Error updating mixer settings:', error)
      throw error
    }
  }

  /**
   * Get audio duration in milliseconds
   */
  async getAudioDuration(fileUri: string): Promise<number> {
    try {
      const { sound } = await Audio.Sound.createAsync(
        { uri: fileUri },
        { shouldPlay: false }
      )

      const status = await sound.getStatusAsync()
      await sound.unloadAsync()

      if (status.isLoaded && status.durationMillis) {
        return status.durationMillis
      }

      return 0
    } catch (error) {
      if (__DEV__) console.error('Error getting audio duration:', error)
      return 0
    }
  }

  /**
   * Upload audio file to project
   */
  async uploadAudioFile(
    fileData: {
      projectId: string
      fileName: string
      fileUri: string
      fileSize: number
      stemType: string
      stemName: string
    },
    userId: string,
    onProgress?: (progress: number) => void
  ): Promise<{ audioFile?: any; error?: any }> {
    try {
      // Get file extension
      const fileExtension = fileData.fileName.split('.').pop()?.toLowerCase() || 'wav'
      const fileId = `${Date.now()}-${Math.random().toString(36).substring(7)}`
      const storagePath = `${fileData.projectId}/stems/${fileId}.${fileExtension}`

      // Progress callback
      if (onProgress) onProgress(10)

      // Convert file URI to blob
      const response = await fetch(fileData.fileUri)
      const fileBlob = await response.blob()
      
      if (onProgress) onProgress(30)

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('audio-files')
        .upload(storagePath, fileBlob, {
          contentType: `audio/${fileExtension}`,
          upsert: false,
        })

      if (uploadError) throw uploadError

      if (onProgress) onProgress(70)

      // Get duration
      const duration = await this.getAudioDuration(fileData.fileUri)

      if (onProgress) onProgress(85)

      // Insert metadata into database
      const { data: audioFile, error: dbError } = await supabase
        .from('audio_files')
        .insert({
          project_id: fileData.projectId,
          file_path: storagePath,
          file_name: fileData.fileName,
          file_size: fileData.fileSize,
          file_type: 'audio',
          format: fileExtension,
          stem_type: fileData.stemType,
          stem_name: fileData.stemName,
          duration_ms: duration,
          volume: 1.0,
          pan: 0.0,
          is_muted: false,
          is_soloed: false,
          created_by: userId,
        })
        .select()
        .single()

      if (dbError) throw dbError

      if (onProgress) onProgress(100)

      return { audioFile }
    } catch (error) {
      if (__DEV__) console.error('Error uploading audio file:', error)
      return { error }
    }
  }

  /**
   * Delete audio file
   */
  async deleteAudioFile(audioFileId: string, filePath: string) {
    try {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('audio-files')
        .remove([filePath])

      if (storageError && __DEV__) console.error('Storage delete error:', storageError)

      // Delete from database
      const { error: dbError} = await supabase
        .from('audio_files')
        .delete()
        .eq('id', audioFileId)

      if (dbError) throw dbError
    } catch (error) {
      if (__DEV__) console.error('Error deleting audio file:', error)
      throw error
    }
  }

  /**
   * Validate audio file format
   */
  validateAudioFormat(
    fileName: string,
    mimeType?: string
  ): { valid: boolean; error?: string; format?: string } {
    const extension = fileName.toLowerCase().match(/\.[^.]+$/)?.[0]

    // Check extension
    for (const [format, config] of Object.entries(AUDIO_FORMATS)) {
      if (extension && config.extensions.includes(extension)) {
        return { valid: true, format }
      }
      if (mimeType && config.mimeTypes.some(type => mimeType.includes(type))) {
        return { valid: true, format }
      }
    }

    return {
      valid: false,
      error: 'Unsupported audio format. Please use WAV, MP3, FLAC, AIFF, AAC, OGG, or MIDI files.',
    }
  }

  /**
   * Extract audio metadata including duration and format info
   */
  async getAudioMetadata(uri: string, fileName: string): Promise<AudioMetadata | null> {
    try {
      const { sound, status } = await Audio.Sound.createAsync(
        { uri },
        { shouldPlay: false },
        null,
        false
      )

      await sound.unloadAsync()

      if (status.isLoaded && status.durationMillis) {
        const extension = fileName.toLowerCase().match(/\.[^.]+$/)?.[0]
        let format = 'unknown'
        let isLossless = false

        // Determine format and quality
        for (const [formatName, config] of Object.entries(AUDIO_FORMATS)) {
          if (extension && config.extensions.includes(extension)) {
            format = formatName
            isLossless = config.lossless
            break
          }
        }

        return {
          duration: status.durationMillis,
          format,
          isLossless,
        }
      }

      return null
    } catch (error) {
      if (__DEV__) console.error('Error extracting audio metadata:', error)
      return null
    }
  }

  /**
   * Comprehensive audio file validation
   */
  async validateAudioFile(
    uri: string,
    fileName: string,
    fileSize: number,
    mimeType?: string
  ): Promise<AudioValidation> {
    const warnings: string[] = []

    // 1. Format validation
    const formatCheck = this.validateAudioFormat(fileName, mimeType)
    if (!formatCheck.valid) {
      return { valid: false, error: formatCheck.error }
    }

    // 2. Size validation
    const MAX_SIZE = 500 * 1024 * 1024 // 500MB
    const LARGE_FILE_THRESHOLD = 100 * 1024 * 1024 // 100MB

    if (fileSize > MAX_SIZE) {
      return {
        valid: false,
        error: `File size exceeds 500MB limit. Current size: ${(fileSize / (1024 * 1024)).toFixed(1)}MB`,
      }
    }

    if (fileSize > LARGE_FILE_THRESHOLD) {
      warnings.push('Large file detected. Upload may take several minutes.')
    }

    // 3. Extract metadata
    const metadata = await this.getAudioMetadata(uri, fileName)
    if (!metadata) {
      warnings.push('Could not extract audio metadata. File may not be playable.')
    }

    // 4. Duration validation
    if (metadata && metadata.duration > 30 * 60 * 1000) {
      warnings.push('Audio file is longer than 30 minutes. Consider splitting for better performance.')
    }

    // 5. Quality recommendations
    if (metadata && !metadata.isLossless && fileSize < 1 * 1024 * 1024) {
      warnings.push('Low quality audio detected. Consider using higher bitrate or lossless format.')
    }

    return {
      valid: true,
      warnings: warnings.length > 0 ? warnings : undefined,
      metadata: metadata || undefined,
    }
  }

  /**
   * Format duration for display
   */
  formatDuration(milliseconds: number): string {
    const totalSeconds = Math.floor(milliseconds / 1000)
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  /**
   * Format file size for display
   */
  formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
  }

  /**
   * Get recommended format for upload based on use case
   */
  getRecommendedFormat(useCase: 'mixing' | 'mastering' | 'sharing' | 'demo'): string {
    switch (useCase) {
      case 'mixing':
      case 'mastering':
        return 'WAV or FLAC (24-bit, 48kHz or higher) for professional quality'
      case 'sharing':
        return 'MP3 (320kbps) or AAC for smaller file size with good quality'
      case 'demo':
        return 'MP3 (192kbps) for quick sharing and feedback'
      default:
        return 'WAV for best quality, MP3 for smaller size'
    }
  }

  /**
   * Estimate upload time based on file size
   */
  estimateUploadTime(
    fileSize: number,
    connectionSpeed: 'slow' | 'medium' | 'fast' = 'medium'
  ): string {
    const speeds = {
      slow: 500 * 1024, // 500 KB/s
      medium: 2 * 1024 * 1024, // 2 MB/s
      fast: 10 * 1024 * 1024, // 10 MB/s
    }

    const seconds = Math.ceil(fileSize / speeds[connectionSpeed])

    if (seconds < 60) return `~${seconds} seconds`
    if (seconds < 3600) return `~${Math.ceil(seconds / 60)} minutes`
    return `~${Math.ceil(seconds / 3600)} hours`
  }
}

export default new AudioService()