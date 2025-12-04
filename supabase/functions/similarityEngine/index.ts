/**
 * similarityEngine.ts
 *
 * Backend similarity search engine using cosine similarity
 * Runs in Supabase Edge Functions (Deno runtime)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ============================================================================
// TYPES
// ============================================================================

export interface AudioEmbeddingDB {
  id: string;
  audio_file_id: string;
  user_id: string;
  project_id: string | null;
  embedding: number[]; // 64-dimensional vector
  features: {
    bpm: number;
    key: string;
    mfcc: number[];
    chroma: number[];
    spectralCentroid: number;
    energy: number;
  };
  duration: number;
  sample_rate: number;
  created_at: string;
}

export interface SimilarityResult {
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

export interface EmbedAudioRequest {
  audio_file_id: string;
  user_id: string;
  project_id?: string;
  embedding: number[];
  features: any;
  duration: number;
  sample_rate: number;
}

export interface SearchSimilarRequest {
  embedding: number[];
  user_id: string;
  limit?: number;
  min_similarity?: number;
  filters?: {
    bpm_range?: [number, number];
    key?: string;
    energy_range?: [number, number];
  };
}

// ============================================================================
// COSINE SIMILARITY
// ============================================================================

/**
 * Compute cosine similarity between two vectors
 * Returns value between -1 (opposite) and 1 (identical)
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`Vector length mismatch: ${a.length} vs ${b.length}`);
  }

  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    magnitudeA += a[i] * a[i];
    magnitudeB += b[i] * b[i];
  }

  magnitudeA = Math.sqrt(magnitudeA);
  magnitudeB = Math.sqrt(magnitudeB);

  if (magnitudeA === 0 || magnitudeB === 0) {
    return 0; // Avoid division by zero
  }

  return dotProduct / (magnitudeA * magnitudeB);
}

/**
 * Weighted similarity that combines embedding similarity with feature matching
 */
export function weightedSimilarity(
  embedding1: number[],
  embedding2: number[],
  features1: any,
  features2: any
): number {
  // Cosine similarity of embeddings (70% weight)
  const embeddingSim = cosineSimilarity(embedding1, embedding2);

  // BPM similarity (10% weight)
  const bpmDiff = Math.abs(features1.bpm - features2.bpm);
  const bpmSim = Math.max(0, 1 - bpmDiff / 60); // Normalize to 0-1

  // Key similarity (10% weight)
  const keySim = features1.key === features2.key ? 1 : 0.3; // Exact match or related

  // Energy similarity (10% weight)
  const energyDiff = Math.abs(features1.energy - features2.energy);
  const energySim = Math.max(0, 1 - energyDiff);

  // Weighted combination
  return (
    embeddingSim * 0.7 +
    bpmSim * 0.1 +
    keySim * 0.1 +
    energySim * 0.1
  );
}

// ============================================================================
// DATABASE OPERATIONS
// ============================================================================

/**
 * Store audio embedding in database
 */
export async function storeEmbedding(
  supabase: any,
  data: EmbedAudioRequest
): Promise<string> {
  const { data: result, error } = await supabase
    .from('audio_embeddings')
    .insert({
      audio_file_id: data.audio_file_id,
      user_id: data.user_id,
      project_id: data.project_id || null,
      embedding: data.embedding,
      features: data.features,
      duration: data.duration,
      sample_rate: data.sample_rate,
    })
    .select('id')
    .single();

  if (error) {
    console.error('Error storing embedding:', error);
    throw new Error('Failed to store audio embedding');
  }

  return result.id;
}

/**
 * Search for similar audio by comparing embeddings
 */
export async function searchSimilar(
  supabase: any,
  request: SearchSimilarRequest
): Promise<SimilarityResult[]> {
  const limit = request.limit || 10;
  const minSimilarity = request.min_similarity || 0.5;

  // Fetch all embeddings (in production, use vector database like pgvector)
  const { data: embeddings, error } = await supabase
    .from('audio_embeddings')
    .select(`
      id,
      audio_file_id,
      user_id,
      project_id,
      embedding,
      features,
      duration,
      created_at,
      audio_files!audio_embeddings_audio_file_id_fkey (
        file_name,
        stem_type,
        project_id,
        projects (
          title
        )
      )
    `)
    .neq('user_id', request.user_id); // Exclude user's own recordings

  if (error) {
    console.error('Error fetching embeddings:', error);
    throw new Error('Failed to fetch embeddings for comparison');
  }

  // Compute similarity scores
  const results: Array<AudioEmbeddingDB & { similarity_score: number }> = embeddings.map((emb: any) => ({
    ...emb,
    similarity_score: weightedSimilarity(
      request.embedding,
      emb.embedding,
      request.filters || {},
      emb.features
    ),
  }));

  // Filter by minimum similarity and optional filters
  let filtered = results.filter(r => r.similarity_score >= minSimilarity);

  // Apply BPM filter
  if (request.filters?.bpm_range) {
    const [minBPM, maxBPM] = request.filters.bpm_range;
    filtered = filtered.filter(
      r => r.features.bpm >= minBPM && r.features.bpm <= maxBPM
    );
  }

  // Apply key filter
  if (request.filters?.key) {
    filtered = filtered.filter(r => r.features.key === request.filters!.key);
  }

  // Apply energy filter
  if (request.filters?.energy_range) {
    const [minEnergy, maxEnergy] = request.filters.energy_range;
    filtered = filtered.filter(
      r => r.features.energy >= minEnergy && r.features.energy <= maxEnergy
    );
  }

  // Sort by similarity score (descending)
  filtered.sort((a, b) => b.similarity_score - a.similarity_score);

  // Take top N results
  const topResults = filtered.slice(0, limit);

  // Fetch user data for results
  const userIds = [...new Set(topResults.map(r => r.user_id))];
  const { data: users } = await supabase
    .from('users')
    .select('id, username, display_name')
    .in('id', userIds);

  const userMap = new Map(users?.map((u: any) => [u.id, u]) || []);

  // Format results
  return topResults.map(result => ({
    audio_file_id: result.audio_file_id,
    file_name: result.audio_files?.file_name || 'Unknown',
    similarity_score: result.similarity_score,
    bpm: result.features.bpm,
    key: result.features.key,
    energy: result.features.energy,
    user: userMap.get(result.user_id) || {
      username: 'Unknown',
      display_name: null,
    },
    project_title: result.audio_files?.projects?.title || null,
    created_at: result.created_at,
  }));
}

/**
 * Get audio embedding by ID
 */
export async function getEmbeddingById(
  supabase: any,
  embeddingId: string
): Promise<AudioEmbeddingDB | null> {
  const { data, error } = await supabase
    .from('audio_embeddings')
    .select('*')
    .eq('id', embeddingId)
    .single();

  if (error) {
    console.error('Error fetching embedding:', error);
    return null;
  }

  return data;
}

/**
 * Get audio embedding by audio file ID
 */
export async function getEmbeddingByAudioFileId(
  supabase: any,
  audioFileId: string
): Promise<AudioEmbeddingDB | null> {
  const { data, error } = await supabase
    .from('audio_embeddings')
    .select('*')
    .eq('audio_file_id', audioFileId)
    .single();

  if (error) {
    console.error('Error fetching embedding by audio file ID:', error);
    return null;
  }

  return data;
}

// ============================================================================
// EDGE FUNCTION HANDLERS
// ============================================================================

/**
 * POST /embedAudio - Store new audio embedding
 */
export async function handleEmbedAudio(req: Request): Promise<Response> {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body: EmbedAudioRequest = await req.json();

    // Validate request
    if (!body.audio_file_id || !body.user_id || !body.embedding) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Store embedding
    const embeddingId = await storeEmbedding(supabase, body);

    return new Response(
      JSON.stringify({
        success: true,
        embedding_id: embeddingId,
        message: 'Audio embedding stored successfully',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('embedAudio error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * POST /searchSimilar - Find similar audio files
 */
export async function handleSearchSimilar(req: Request): Promise<Response> {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body: SearchSimilarRequest = await req.json();

    // Validate request
    if (!body.embedding || !body.user_id) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Search for similar audio
    const results = await searchSimilar(supabase, body);

    return new Response(
      JSON.stringify({
        success: true,
        count: results.length,
        results,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('searchSimilar error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * GET /getAudioById?id=xxx - Get audio embedding by ID
 */
export async function handleGetAudioById(req: Request): Promise<Response> {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const url = new URL(req.url);
    const id = url.searchParams.get('id');

    if (!id) {
      return new Response(
        JSON.stringify({ error: 'Missing id parameter' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const embedding = await getEmbeddingById(supabase, id);

    if (!embedding) {
      return new Response(
        JSON.stringify({ error: 'Embedding not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        embedding,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('getAudioById error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// ============================================================================
// MAIN EDGE FUNCTION ENTRY POINT
// ============================================================================

Deno.serve(async (req) => {
  // CORS headers
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  const url = new URL(req.url);
  const path = url.pathname;

  // Route requests
  let response: Response;

  if (path.endsWith('/embedAudio') && req.method === 'POST') {
    response = await handleEmbedAudio(req);
  } else if (path.endsWith('/searchSimilar') && req.method === 'POST') {
    response = await handleSearchSimilar(req);
  } else if (path.endsWith('/getAudioById') && req.method === 'GET') {
    response = await handleGetAudioById(req);
  } else {
    response = new Response(
      JSON.stringify({ error: 'Not found' }),
      { status: 404, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Add CORS headers to response
  const headers = new Headers(response.headers);
  headers.set('Access-Control-Allow-Origin', '*');

  return new Response(response.body, {
    status: response.status,
    headers,
  });
});
