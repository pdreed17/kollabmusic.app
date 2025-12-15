import * as FileSystem from 'expo-file-system/legacy';
import { Audio, AVPlaybackSource } from 'expo-av';
import { supabase } from '../lib/supabase';
import { Platform } from 'react-native';

interface TrimOptions {
  audioFileId: string;
  sourceFilePath: string;
  startMs: number;
  endMs: number;
  projectId: string;
  userId: string;
}

interface TrimResult {
  success: boolean;
  trimmedFilePath?: string;
  error?: string;
}

/**
 * Audio trimming service using expo-av for playback-based trimming
 * Note: For production-grade trimming, consider using a backend service with FFmpeg
 */
export class AudioTrimmer {
  /**
   * Trim an audio file between start and end times
   * This calls the Supabase Edge Function which uses FFmpeg for actual audio trimming
   */
  static async trimAudio(options: TrimOptions): Promise<TrimResult> {
    const { audioFileId, sourceFilePath, startMs, endMs, projectId, userId } = options;

    try {
      console.log('Starting audio trim via Edge Function:', { audioFileId, startMs, endMs });

      // Validate inputs
      if (startMs < 0 || endMs <= startMs) {
        return { success: false, error: 'Invalid trim times' };
      }

      const durationMs = endMs - startMs;
      if (durationMs < 1000) {
        return { success: false, error: 'Trimmed audio must be at least 1 second long' };
      }

      // Get the current session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        return { success: false, error: 'No active session' };
      }

      // Call the Edge Function to trim the audio
      const requestBody = {
        audioFileId,
        sourceFilePath,
        startMs,
        endMs,
        projectId,
        userId,
      };
      console.log('Calling Edge Function with:', requestBody);

      const { data, error } = await supabase.functions.invoke('trimAudio', {
        body: requestBody,
      });

      if (error) {
        console.error('Edge Function error:', error);
        console.error('Edge Function error details:', JSON.stringify(error, null, 2));
        return { success: false, error: error.message };
      }

      if (!data || !data.success) {
        console.error('Edge Function returned error:', data?.error);
        return { success: false, error: data?.error || 'Trim failed' };
      }

      console.log('Audio trimmed successfully:', data.trimmedFilePath);

      return {
        success: true,
        trimmedFilePath: data.trimmedFilePath,
      };
    } catch (error) {
      console.error('Error trimming audio:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Load a trimmed audio file with start/end constraints
   * This is used by the player to respect trim boundaries
   */
  static async loadTrimmedAudio(
    filePath: string,
    startMs: number,
    endMs: number
  ): Promise<{ sound: Audio.Sound; status: any }> {
    try {
      const { sound } = await Audio.Sound.createAsync(
        { uri: filePath } as AVPlaybackSource,
        {
          shouldPlay: false,
          positionMillis: startMs,
        }
      );

      // Set up playback to stop at end time
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.positionMillis >= endMs) {
          sound.stopAsync();
        }
      });

      const status = await sound.getStatusAsync();
      return { sound, status };
    } catch (error) {
      console.error('Error loading trimmed audio:', error);
      throw error;
    }
  }

  /**
   * Convert base64 string to Blob
   */
  private static base64ToBlob(base64: string, mimeType: string): Blob {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);

    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }

    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: mimeType });
  }

  /**
   * Parse time string (mm:ss) to milliseconds
   */
  static parseTimeToMs(timeString: string): number {
    const parts = timeString.split(':');
    if (parts.length !== 2) return 0;

    const minutes = parseInt(parts[0], 10) || 0;
    const seconds = parseInt(parts[1], 10) || 0;

    return (minutes * 60 + seconds) * 1000;
  }

  /**
   * Format milliseconds to time string (mm:ss)
   */
  static formatMsToTime(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }
}
