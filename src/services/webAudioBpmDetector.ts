import * as FileSystem from 'expo-file-system';
import { supabase } from '../lib/supabase';

/**
 * Professional BPM Detection using Web Audio API
 * Offline-first with intelligent caching
 */

export interface BPMDetectionResult {
  bpm: number;
  cached: boolean;
  method: 'offline' | 'online';
}

// Cache directory for audio files
const AUDIO_CACHE_DIR = `${FileSystem.documentDirectory}audio_cache/`;

/**
 * Initialize cache directory
 */
async function ensureCacheDir() {
  try {
    const dirInfo = await FileSystem.getInfoAsync(AUDIO_CACHE_DIR);
    if (!dirInfo.exists) {
      try {
        await FileSystem.makeDirectoryAsync(AUDIO_CACHE_DIR, { intermediates: true });
        console.log('[BPM Cache] Created cache directory');
      } catch (mkdirError) {
        console.warn('[BPM Cache] Could not create directory:', mkdirError);
      }
    }
  } catch (error) {
    // Directory doesn't exist, create it
    try {
      await FileSystem.makeDirectoryAsync(AUDIO_CACHE_DIR, { intermediates: true });
      console.log('[BPM Cache] Created cache directory');
    } catch (mkdirError) {
      console.warn('[BPM Cache] Could not create directory:', mkdirError);
    }
  }
}

/**
 * Get cached file path for a track
 */
function getCachedFilePath(trackId: string): string {
  return `${AUDIO_CACHE_DIR}${trackId}.m4a`;
}

/**
 * Check if file is cached locally
 */
async function isFileCached(trackId: string): Promise<boolean> {
  try {
    const cachedPath = getCachedFilePath(trackId);
    const fileInfo = await FileSystem.getInfoAsync(cachedPath);
    return fileInfo.exists;
  } catch (error) {
    return false;
  }
}

/**
 * Download and cache audio file
 */
async function downloadAndCache(signedUrl: string, trackId: string): Promise<string> {
  await ensureCacheDir();

  const cachedPath = getCachedFilePath(trackId);

  console.log('[BPM Cache] Downloading file to cache...');
  try {
    await FileSystem.downloadAsync(signedUrl, cachedPath);
    console.log('[BPM Cache] File cached at:', cachedPath);
  } catch (downloadError) {
    console.warn('[BPM Cache] Download failed:', downloadError);
    throw downloadError;
  }

  return cachedPath;
}

/**
 * Convert local file to base64 data URL for WebView
 */
async function fileToDataURL(localPath: string): Promise<string> {
  console.log('[BPM Detector] Converting file to base64...');

  const base64 = await FileSystem.readAsStringAsync(localPath, {
    encoding: FileSystem.EncodingType.Base64,
  });

  // Determine MIME type from extension
  const mimeType = localPath.endsWith('.mp3') ? 'audio/mpeg' :
                   localPath.endsWith('.m4a') ? 'audio/mp4' :
                   localPath.endsWith('.wav') ? 'audio/wav' :
                   'audio/mpeg'; // default

  const dataURL = `data:${mimeType};base64,${base64}`;
  console.log('[BPM Detector] Base64 data URL created');

  return dataURL;
}

/**
 * Get audio URL for BPM detection (offline-first)
 */
export async function getAudioURL(trackId: string, filePath: string): Promise<{
  url: string;
  method: 'offline' | 'online';
}> {
  await ensureCacheDir();

  // Check if file is cached locally
  const cached = await isFileCached(trackId);

  if (cached) {
    // Use cached file (offline)
    console.log('[BPM Detector] Using cached file (offline mode)');
    const cachedPath = getCachedFilePath(trackId);
    const dataURL = await fileToDataURL(cachedPath);

    return {
      url: dataURL,
      method: 'offline'
    };
  } else {
    // Download from Supabase (online)
    console.log('[BPM Detector] Fetching from Supabase (online mode)');

    const { data, error } = await supabase.storage
      .from('audio-files')
      .createSignedUrl(filePath, 3600);

    if (error) throw error;

    // Cache for future offline use
    try {
      await downloadAndCache(data.signedUrl, trackId);
      console.log('[BPM Detector] File downloaded and cached for future offline use');
    } catch (cacheError) {
      console.warn('[BPM Cache] Failed to cache file:', cacheError);
      // Continue anyway with online URL
    }

    return {
      url: data.signedUrl,
      method: 'online'
    };
  }
}

/**
 * Clear cache for a specific track
 */
export async function clearTrackCache(trackId: string): Promise<void> {
  try {
    const cachedPath = getCachedFilePath(trackId);
    const fileInfo = await FileSystem.getInfoAsync(cachedPath);

    if (fileInfo.exists) {
      await FileSystem.deleteAsync(cachedPath);
      console.log('[BPM Cache] Cleared cache for track:', trackId);
    }
  } catch (error) {
    // File doesn't exist, nothing to clear
  }
}

/**
 * Clear all cached audio files
 */
export async function clearAllCache(): Promise<void> {
  try {
    const dirInfo = await FileSystem.getInfoAsync(AUDIO_CACHE_DIR);

    if (dirInfo.exists) {
      await FileSystem.deleteAsync(AUDIO_CACHE_DIR, { idempotent: true });
      console.log('[BPM Cache] Cleared all cached audio files');
    }
  } catch (error) {
    // Directory doesn't exist, nothing to clear
  }
}

/**
 * Get cache size in MB
 */
export async function getCacheSize(): Promise<number> {
  try {
    const dirInfo = await FileSystem.getInfoAsync(AUDIO_CACHE_DIR);

    if (!dirInfo.exists) return 0;

    // Read all files in cache directory
    const files = await FileSystem.readDirectoryAsync(AUDIO_CACHE_DIR);
    let totalSize = 0;

    for (const file of files) {
      const filePath = `${AUDIO_CACHE_DIR}${file}`;
      try {
        const fileInfo = await FileSystem.getInfoAsync(filePath);
        if (fileInfo.exists && 'size' in fileInfo) {
          totalSize += fileInfo.size || 0;
        }
      } catch (error) {
        // Skip files that can't be accessed
        continue;
      }
    }

    // Convert to MB
    return totalSize / (1024 * 1024);
  } catch (error) {
    return 0;
  }
}
