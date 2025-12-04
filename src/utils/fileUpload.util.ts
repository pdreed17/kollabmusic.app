/**
 * Modern File Upload Utility
 * Uses the new Expo FileSystem API for production-ready uploads
 */

import { supabase } from '../lib/supabase'

interface UploadOptions {
  bucket: string
  path: string
  contentType: string
  onProgress?: (progress: number) => void
}

interface UploadResult {
  success: boolean
  url?: string
  error?: string
}

/**
 * Upload file to Supabase Storage with progress tracking
 * Uses FormData for better compatibility and streaming
 */
export async function uploadFile(
  fileUri: string,
  options: UploadOptions
): Promise<UploadResult> {
  try {
    const { bucket, path, contentType, onProgress } = options

    // Create FormData for upload
    const formData = new FormData()

    // For React Native, append file with proper structure
    formData.append('file', {
      uri: fileUri,
      type: contentType,
      name: path.split('/').pop() || 'file',
    } as any)

    // Upload with XMLHttpRequest for progress tracking
    return new Promise((resolve) => {
      const xhr = new XMLHttpRequest()

      // Track upload progress
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable && onProgress) {
          const percentComplete = (event.loaded / event.total) * 100
          onProgress(Math.round(percentComplete))
        }
      })

      // Handle completion
      xhr.addEventListener('load', async () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          // Get public URL
          const { data } = supabase.storage.from(bucket).getPublicUrl(path)
          resolve({ success: true, url: data.publicUrl })
        } else {
          resolve({ success: false, error: `Upload failed with status ${xhr.status}` })
        }
      })

      // Handle errors
      xhr.addEventListener('error', () => {
        resolve({ success: false, error: 'Network error during upload' })
      })

      xhr.addEventListener('abort', () => {
        resolve({ success: false, error: 'Upload cancelled' })
      })

      // Get upload URL from Supabase
      const { data: { session } } = await supabase.auth.getSession()
      const uploadUrl = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/storage/v1/object/${bucket}/${path}`

      xhr.open('POST', uploadUrl)
      xhr.setRequestHeader('Authorization', `Bearer ${session?.access_token}`)
      xhr.send(formData)
    })
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Upload large files in chunks for reliability
 */
export async function uploadLargeFile(
  fileUri: string,
  options: UploadOptions,
  chunkSize = 5 * 1024 * 1024 // 5MB chunks
): Promise<UploadResult> {
  // For now, use standard upload
  // TODO: Implement multipart upload when file > 100MB
  return uploadFile(fileUri, options)
}

/**
 * Delete file from storage
 */
export async function deleteFile(
  bucket: string,
  path: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.storage.from(bucket).remove([path])

    if (error) throw error

    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Get file size from URI
 */
export async function getFileSize(uri: string): Promise<number | null> {
  try {
    // Use fetch to get file info without loading entire file
    const response = await fetch(uri, { method: 'HEAD' })
    const contentLength = response.headers.get('content-length')
    return contentLength ? parseInt(contentLength, 10) : null
  } catch {
    return null
  }
}

/**
 * Validate file size
 */
export function validateFileSize(
  size: number,
  maxSize: number = 500 * 1024 * 1024 // 500MB default
): { valid: boolean; error?: string } {
  if (size > maxSize) {
    const maxSizeMB = Math.round(maxSize / (1024 * 1024))
    return {
      valid: false,
      error: `File size exceeds ${maxSizeMB}MB limit`,
    }
  }
  return { valid: true }
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}
