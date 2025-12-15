// services/audioService.ts
// Compatible audio service for DAW implementation

import { supabase } from '../lib/supabase';

interface AudioTrack {
  id: string;
  file_path: string;
  file_name: string;
  stem_type: string | null;
  stem_name: string | null;
  volume: number;
  pan: number;
  is_muted: boolean;
  is_soloed: boolean;
  color: string;
  duration_ms: number | null;
}

class AudioServiceCompat {
  /**
   * Get all audio files for a project
   */
  async getProjectAudioFiles(projectId: string): Promise<AudioTrack[]> {
    try {
      const { data, error } = await supabase
        .from('audio_files')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      return (data || []).map(file => ({
        id: file.id,
        file_path: file.file_path,
        file_name: file.file_name,
        stem_type: file.stem_type,
        stem_name: file.stem_name,
        volume: file.volume ?? 1.0,
        pan: file.pan ?? 0.0,
        is_muted: file.is_muted ?? false,
        is_soloed: file.is_soloed ?? false,
        color: this.getStemColor(file.stem_type),
        duration_ms: file.duration_ms,
      }));
    } catch (error) {
      if (__DEV__) console.error('Error fetching audio files:', error);
      throw error;
    }
  }

  /**
   * Get a signed URL for accessing an audio file
   */
  async getAudioUrl(filePath: string): Promise<string> {
    try {
      // Check if it's already a full URL
      if (filePath.startsWith('http')) {
        return filePath;
      }

      // Get signed URL from Supabase storage
      const { data, error } = await supabase.storage
        .from('audio-files')
        .createSignedUrl(filePath, 60 * 60); // 1 hour expiry

      if (error) {
        if (__DEV__) console.warn('Error creating signed URL:', error);
        // Return the original path as fallback
        return filePath;
      }

      return data.signedUrl;
    } catch (error) {
      if (__DEV__) console.error('Error getting audio URL:', error);
      return filePath; // Fallback to original path
    }
  }

  /**
   * Update mixer settings for a specific audio file
   */
  async updateMixerSettings(
    audioFileId: string,
    settings: {
      volume?: number;
      pan?: number;
      is_muted?: boolean;
      is_soloed?: boolean;
    }
  ): Promise<void> {
    try {
      const { error } = await supabase
        .from('audio_files')
        .update(settings)
        .eq('id', audioFileId);

      if (error) throw error;

      if (__DEV__) console.log(`Updated mixer settings for ${audioFileId}:`, settings);
    } catch (error) {
      if (__DEV__) console.error('Error updating mixer settings:', error);
      throw error;
    }
  }

  /**
   * Get color for stem type
   */
  private getStemColor(stemType: string | null): string {
    const colors: { [key: string]: string } = {
      drums: '#E74C3C',
      bass: '#3498DB',
      vocals: '#9B59B6',
      guitar: '#E67E22',
      keys: '#F39C12',
      synth: '#1ABC9C',
      fx: '#95A5A6',
      full_mix: '#34495E',
    };
    return colors[stemType || 'other'] || '#7F8C8D';
  }
}

export const audioService = new AudioServiceCompat();
export default audioService;