/**
 * Audio Cache Management Utility
 *
 * Caches audio files locally to reduce egress costs
 * - 50 MB cache limit
 * - Auto-cleanup when limit exceeded (LRU eviction)
 * - Tracks last access time for smart eviction
 */

import * as FileSystem from 'expo-file-system/legacy'
import AsyncStorage from '@react-native-async-storage/async-storage'

const CACHE_DIR = `${FileSystem.cacheDirectory}audio_cache/`
const CACHE_METADATA_KEY = 'kollab_audio_cache_metadata'
const MAX_CACHE_SIZE_BYTES = 50 * 1024 * 1024 // 50 MB

interface CacheEntry {
  id: string // unique identifier (audio file id or highlight id)
  uri: string // local file path
  size: number // file size in bytes
  lastAccessed: number // timestamp of last access
  originalUrl: string // original remote URL (for re-download if needed)
}

interface CacheMetadata {
  entries: { [id: string]: CacheEntry }
  totalSize: number
}

/**
 * Initialize cache directory
 */
async function ensureCacheDir(): Promise<void> {
  const dirInfo = await FileSystem.getInfoAsync(CACHE_DIR)
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true })
  }
}

/**
 * Get cache metadata from AsyncStorage
 */
async function getCacheMetadata(): Promise<CacheMetadata> {
  try {
    const data = await AsyncStorage.getItem(CACHE_METADATA_KEY)
    if (data) {
      return JSON.parse(data)
    }
  } catch (error) {
    console.error('Error reading cache metadata:', error)
  }
  return { entries: {}, totalSize: 0 }
}

/**
 * Save cache metadata to AsyncStorage
 */
async function saveCacheMetadata(metadata: CacheMetadata): Promise<void> {
  try {
    await AsyncStorage.setItem(CACHE_METADATA_KEY, JSON.stringify(metadata))
  } catch (error) {
    console.error('Error saving cache metadata:', error)
  }
}

/**
 * Check if audio is cached and return local URI
 */
export async function getCachedAudio(id: string): Promise<string | null> {
  try {
    const metadata = await getCacheMetadata()
    const entry = metadata.entries[id]

    if (!entry) {
      return null
    }

    // Verify file still exists
    const fileInfo = await FileSystem.getInfoAsync(entry.uri)
    if (!fileInfo.exists) {
      // File was deleted, remove from metadata
      delete metadata.entries[id]
      metadata.totalSize -= entry.size
      await saveCacheMetadata(metadata)
      return null
    }

    // Update last accessed time
    entry.lastAccessed = Date.now()
    await saveCacheMetadata(metadata)

    return entry.uri
  } catch (error) {
    console.error('Error getting cached audio:', error)
    return null
  }
}

/**
 * Cache audio file locally
 */
export async function cacheAudio(
  id: string,
  remoteUrl: string,
  onProgress?: (progress: number) => void
): Promise<string | null> {
  try {
    await ensureCacheDir()

    // Check if already cached
    const existingUri = await getCachedAudio(id)
    if (existingUri) {
      return existingUri
    }

    // Extract file extension from URL (before query params)
    const urlWithoutParams = remoteUrl.split('?')[0]
    const extensionMatch = urlWithoutParams.match(/\.(\w+)$/)
    const extension = extensionMatch ? extensionMatch[1] : 'm4a' // default to m4a

    const localUri = `${CACHE_DIR}${id}.${extension}`

    // Download the file
    const downloadResult = await FileSystem.downloadAsync(remoteUrl, localUri, {
      // Progress callback not directly supported, but we can check for completion
    })

    if (downloadResult.status !== 200) {
      console.error('Failed to download audio:', downloadResult.status)
      return null
    }

    // Get file size
    const fileInfo = await FileSystem.getInfoAsync(localUri)
    const fileSize = (fileInfo as any).size || 0

    // Get current metadata
    const metadata = await getCacheMetadata()

    // Check if we need to evict old files to make room
    await evictIfNeeded(metadata, fileSize)

    // Add new entry
    metadata.entries[id] = {
      id,
      uri: localUri,
      size: fileSize,
      lastAccessed: Date.now(),
      originalUrl: remoteUrl,
    }
    metadata.totalSize += fileSize

    await saveCacheMetadata(metadata)

    return localUri
  } catch (error) {
    console.error('Error caching audio:', error)
    return null
  }
}

/**
 * Evict old cache entries if needed to make room for new file
 */
async function evictIfNeeded(metadata: CacheMetadata, newFileSize: number): Promise<void> {
  const targetSize = MAX_CACHE_SIZE_BYTES - newFileSize

  if (metadata.totalSize <= targetSize) {
    return // No eviction needed
  }

  // Sort entries by last accessed time (oldest first)
  const sortedEntries = Object.values(metadata.entries).sort(
    (a, b) => a.lastAccessed - b.lastAccessed
  )

  // Evict until we have enough space
  for (const entry of sortedEntries) {
    if (metadata.totalSize <= targetSize) {
      break
    }

    try {
      // Delete the file
      await FileSystem.deleteAsync(entry.uri, { idempotent: true })

      // Update metadata
      metadata.totalSize -= entry.size
      delete metadata.entries[entry.id]

      console.log(`Evicted cached audio: ${entry.id} (${formatBytes(entry.size)})`)
    } catch (error) {
      console.error('Error evicting cache entry:', error)
    }
  }

  // Save updated metadata
  await saveCacheMetadata(metadata)
}

/**
 * Remove a specific cached audio file
 */
export async function removeCachedAudio(id: string): Promise<void> {
  try {
    const metadata = await getCacheMetadata()
    const entry = metadata.entries[id]

    if (!entry) {
      return
    }

    // Delete the file
    await FileSystem.deleteAsync(entry.uri, { idempotent: true })

    // Update metadata
    metadata.totalSize -= entry.size
    delete metadata.entries[id]

    await saveCacheMetadata(metadata)
  } catch (error) {
    console.error('Error removing cached audio:', error)
  }
}

/**
 * Clear entire audio cache
 */
export async function clearAudioCache(): Promise<void> {
  try {
    // Delete cache directory
    await FileSystem.deleteAsync(CACHE_DIR, { idempotent: true })

    // Reset metadata
    await saveCacheMetadata({ entries: {}, totalSize: 0 })

    console.log('Audio cache cleared')
  } catch (error) {
    console.error('Error clearing audio cache:', error)
  }
}

/**
 * Get cache statistics
 */
export async function getCacheStats(): Promise<{
  totalSize: number
  entryCount: number
  maxSize: number
  usagePercent: number
  formattedSize: string
  formattedMaxSize: string
}> {
  const metadata = await getCacheMetadata()

  return {
    totalSize: metadata.totalSize,
    entryCount: Object.keys(metadata.entries).length,
    maxSize: MAX_CACHE_SIZE_BYTES,
    usagePercent: Math.round((metadata.totalSize / MAX_CACHE_SIZE_BYTES) * 100),
    formattedSize: formatBytes(metadata.totalSize),
    formattedMaxSize: formatBytes(MAX_CACHE_SIZE_BYTES),
  }
}

/**
 * Format bytes to human-readable string
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

/**
 * Prefetch audio for caching (doesn't block, runs in background)
 */
export function prefetchAudio(id: string, remoteUrl: string): void {
  // Fire and forget - cache in background
  cacheAudio(id, remoteUrl).catch((error) => {
    console.log('Prefetch failed (non-blocking):', error)
  })
}

/**
 * Get or cache audio - returns local URI if cached, otherwise downloads and caches
 */
export async function getOrCacheAudio(
  id: string,
  remoteUrl: string
): Promise<{ uri: string; fromCache: boolean }> {
  // Check cache first
  const cachedUri = await getCachedAudio(id)
  if (cachedUri) {
    return { uri: cachedUri, fromCache: true }
  }

  // Download and cache
  const localUri = await cacheAudio(id, remoteUrl)
  if (localUri) {
    return { uri: localUri, fromCache: false }
  }

  // Fallback to remote URL if caching failed
  return { uri: remoteUrl, fromCache: false }
}
