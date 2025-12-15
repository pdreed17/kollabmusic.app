/**
 * similarityApi.ts
 *
 * API client for audio similarity functions
 * Communicates with Supabase Edge Functions
 */

import { supabase } from '../lib/supabase';
import { AudioEmbedding } from './audioAnalyzer';

// ============================================================================
// TYPES
// ============================================================================

export interface SimilarAudioResult {
  audio_file_id: string;
  file_name: string;
  similarity_score: number;
  bpm: number;
  key: string;
  energy: number;
  user: {
    username: string;
    display_name: string | null;
  };
  project_title: string | null;
  created_at: string;
}

export interface SearchFilters {
  bpm_range?: [number, number];
  key?: string;
  energy_range?: [number, number];
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Store audio embedding in database
 */
export async function storeAudioEmbedding(
  audioFileId: string,
  userId: string,
  embedding: AudioEmbedding,
  projectId?: string
): Promise<{ success: boolean; embedding_id?: string; error?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke('similarityEngine/embedAudio', {
      body: {
        audio_file_id: audioFileId,
        user_id: userId,
        project_id: projectId,
        embedding: embedding.embedding,
        features: embedding.features,
        duration: embedding.duration,
        sample_rate: embedding.sampleRate,
      },
    });

    if (error) {
      if (__DEV__) console.error('Error storing embedding:', error);
      return { success: false, error: error.message };
    }

    return {
      success: true,
      embedding_id: data.embedding_id,
    };
  } catch (error: any) {
    if (__DEV__) console.error('storeAudioEmbedding error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Search for similar audio files
 */
export async function searchSimilarAudio(
  embedding: number[],
  userId: string,
  options?: {
    limit?: number;
    min_similarity?: number;
    filters?: SearchFilters;
  }
): Promise<{ success: boolean; results?: SimilarAudioResult[]; error?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke('similarityEngine/searchSimilar', {
      body: {
        embedding,
        user_id: userId,
        limit: options?.limit || 10,
        min_similarity: options?.min_similarity || 0.5,
        filters: options?.filters,
      },
    });

    if (error) {
      if (__DEV__) console.error('Error searching similar audio:', error);
      return { success: false, error: error.message };
    }

    return {
      success: true,
      results: data.results,
    };
  } catch (error: any) {
    if (__DEV__) console.error('searchSimilarAudio error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get embedding by ID
 */
export async function getEmbeddingById(
  embeddingId: string
): Promise<{ success: boolean; embedding?: any; error?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke(`similarityEngine/getAudioById?id=${embeddingId}`, {
      method: 'GET',
    });

    if (error) {
      if (__DEV__) console.error('Error fetching embedding:', error);
      return { success: false, error: error.message };
    }

    return {
      success: true,
      embedding: data.embedding,
    };
  } catch (error: any) {
    if (__DEV__) console.error('getEmbeddingById error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Complete workflow: Analyze audio, store embedding, and search for similar
 */
export async function analyzeAndFindSimilar(
  audioFileId: string,
  audioFileUri: string,
  userId: string,
  projectId?: string,
  onProgress?: (stage: string, progress: number, message: string) => void
): Promise<{ success: boolean; results?: SimilarAudioResult[]; error?: string }> {
  try {
    // Import here to avoid circular dependencies
    const { analyzeAudio } = await import('./audioAnalyzer');

    onProgress?.('analyzing', 10, 'Analyzing audio features...');

    // Step 1: Analyze audio
    const embedding = await analyzeAudio(audioFileUri, (progress) => {
      onProgress?.(progress.stage, progress.progress, progress.message);
    });

    onProgress?.('storing', 80, 'Storing embedding...');

    // Step 2: Store embedding
    const storeResult = await storeAudioEmbedding(audioFileId, userId, embedding, projectId);

    if (!storeResult.success) {
      return { success: false, error: storeResult.error };
    }

    onProgress?.('searching', 90, 'Finding similar tracks...');

    // Step 3: Search for similar
    const searchResult = await searchSimilarAudio(embedding.embedding, userId, {
      limit: 10,
      min_similarity: 0.6,
    });

    if (!searchResult.success) {
      return { success: false, error: searchResult.error };
    }

    onProgress?.('complete', 100, 'Complete!');

    return {
      success: true,
      results: searchResult.results,
    };
  } catch (error: any) {
    if (__DEV__) console.error('analyzeAndFindSimilar error:', error);
    return { success: false, error: error.message };
  }
}
