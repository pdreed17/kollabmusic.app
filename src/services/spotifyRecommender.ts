/**
 * spotifyRecommender.ts
 *
 * Spotify API integration for finding similar commercial tracks
 * Based on extracted audio features (BPM, key, energy)
 */

import { AudioFeatures } from './audioAnalyzer';

// ============================================================================
// TYPES
// ============================================================================

export interface SpotifyTrack {
  id: string;
  name: string;
  artists: string[];
  album: string;
  preview_url: string | null;
  external_url: string;
  image_url: string;
  duration_ms: number;
  popularity: number;
}

export interface SpotifyAudioFeatures {
  tempo: number; // BPM
  key: number; // 0-11 (C, C#, D, etc.)
  mode: number; // 0 = minor, 1 = major
  energy: number; // 0-1
  danceability: number; // 0-1
  valence: number; // 0-1 (mood)
  acousticness: number; // 0-1
  instrumentalness: number; // 0-1
}

export interface SpotifyRecommendation {
  track: SpotifyTrack;
  similarity_score: number;
  match_reasons: string[];
}

// ============================================================================
// KEY MAPPING
// ============================================================================

const KEY_MAP: { [key: string]: number } = {
  'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5,
  'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'B': 11,
};

function audioKeyToSpotifyKey(key: string): { key: number; mode: number } {
  const isMajor = !key.includes('m');
  const root = key.replace('m', '');

  return {
    key: KEY_MAP[root] || 0,
    mode: isMajor ? 1 : 0,
  };
}

// ============================================================================
// SPOTIFY API CLIENT
// ============================================================================

/**
 * Get Spotify access token using Client Credentials flow
 * In production, cache this token and refresh when expired
 */
async function getSpotifyToken(
  clientId: string,
  clientSecret: string
): Promise<string> {
  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': 'Basic ' + btoa(`${clientId}:${clientSecret}`),
    },
    body: 'grant_type=client_credentials',
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(`Spotify auth failed: ${data.error_description}`);
  }

  return data.access_token;
}

/**
 * Search for seed tracks based on genre or general query
 */
async function searchSeedTracks(
  token: string,
  query: string,
  limit: number = 5
): Promise<string[]> {
  const response = await fetch(
    `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=${limit}`,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(`Spotify search failed: ${data.error?.message}`);
  }

  return data.tracks.items.map((track: any) => track.id);
}

/**
 * Get recommendations based on seed tracks and target audio features
 */
async function getRecommendations(
  token: string,
  seedTracks: string[],
  targetFeatures: {
    tempo: number;
    key: number;
    mode: number;
    energy: number;
  },
  limit: number = 10
): Promise<SpotifyTrack[]> {
  // Build query parameters
  const params = new URLSearchParams({
    seed_tracks: seedTracks.join(','),
    limit: limit.toString(),
    target_tempo: targetFeatures.tempo.toString(),
    target_key: targetFeatures.key.toString(),
    target_mode: targetFeatures.mode.toString(),
    target_energy: targetFeatures.energy.toString(),
  });

  const response = await fetch(
    `https://api.spotify.com/v1/recommendations?${params.toString()}`,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(`Spotify recommendations failed: ${data.error?.message}`);
  }

  return data.tracks.map((track: any) => ({
    id: track.id,
    name: track.name,
    artists: track.artists.map((artist: any) => artist.name),
    album: track.album.name,
    preview_url: track.preview_url,
    external_url: track.external_urls.spotify,
    image_url: track.album.images[0]?.url || '',
    duration_ms: track.duration_ms,
    popularity: track.popularity,
  }));
}

/**
 * Get audio features for multiple tracks
 */
async function getAudioFeatures(
  token: string,
  trackIds: string[]
): Promise<Map<string, SpotifyAudioFeatures>> {
  const response = await fetch(
    `https://api.spotify.com/v1/audio-features?ids=${trackIds.join(',')}`,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(`Spotify audio features failed: ${data.error?.message}`);
  }

  const featuresMap = new Map<string, SpotifyAudioFeatures>();

  for (const features of data.audio_features) {
    if (features) {
      featuresMap.set(features.id, {
        tempo: features.tempo,
        key: features.key,
        mode: features.mode,
        energy: features.energy,
        danceability: features.danceability,
        valence: features.valence,
        acousticness: features.acousticness,
        instrumentalness: features.instrumentalness,
      });
    }
  }

  return featuresMap;
}

// ============================================================================
// SIMILARITY SCORING
// ============================================================================

/**
 * Calculate similarity between user's audio features and Spotify track features
 */
function calculateSpotifySimilarity(
  userFeatures: AudioFeatures,
  spotifyFeatures: SpotifyAudioFeatures
): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let totalScore = 0;
  let weights = 0;

  // BPM similarity (30% weight)
  const bpmDiff = Math.abs(userFeatures.bpm - spotifyFeatures.tempo);
  const bpmScore = Math.max(0, 1 - bpmDiff / 60);
  totalScore += bpmScore * 0.3;
  weights += 0.3;

  if (bpmScore > 0.8) {
    reasons.push(`Similar tempo (${Math.round(spotifyFeatures.tempo)} BPM)`);
  }

  // Key similarity (20% weight)
  const userSpotifyKey = audioKeyToSpotifyKey(userFeatures.key);
  const keyMatch = userSpotifyKey.key === spotifyFeatures.key && userSpotifyKey.mode === spotifyFeatures.mode;
  const keyScore = keyMatch ? 1 : 0.3;
  totalScore += keyScore * 0.2;
  weights += 0.2;

  if (keyMatch) {
    reasons.push(`Same key (${userFeatures.key})`);
  }

  // Energy similarity (30% weight)
  const energyDiff = Math.abs(userFeatures.energy - spotifyFeatures.energy);
  const energyScore = Math.max(0, 1 - energyDiff);
  totalScore += energyScore * 0.3;
  weights += 0.3;

  if (energyScore > 0.7) {
    reasons.push(`Similar energy level`);
  }

  // Spectral centroid vs brightness correlation (20% weight)
  // High spectral centroid = high brightness = high energy
  const brightnessScore = 1 - Math.abs((userFeatures.spectralCentroid / 8000) - spotifyFeatures.energy);
  totalScore += Math.max(0, brightnessScore) * 0.2;
  weights += 0.2;

  const finalScore = totalScore / weights;

  return {
    score: finalScore,
    reasons: reasons.length > 0 ? reasons : ['Musical characteristics match'],
  };
}

// ============================================================================
// MAIN RECOMMENDATION FUNCTION
// ============================================================================

/**
 * Get Spotify track recommendations based on user's audio features
 */
export async function getSpotifyRecommendations(
  userFeatures: AudioFeatures,
  spotifyClientId: string,
  spotifyClientSecret: string,
  options: {
    limit?: number;
    seedGenre?: string;
    seedQuery?: string;
  } = {}
): Promise<SpotifyRecommendation[]> {
  try {
    const limit = options.limit || 10;

    // Step 1: Get Spotify access token
    const token = await getSpotifyToken(spotifyClientId, spotifyClientSecret);

    // Step 2: Find seed tracks
    // Use genre if provided, otherwise use a general music search
    const searchQuery = options.seedQuery || options.seedGenre || 'popular music';
    const seedTracks = await searchSeedTracks(token, searchQuery, 5);

    if (seedTracks.length === 0) {
      throw new Error('No seed tracks found');
    }

    // Step 3: Convert user features to Spotify format
    const spotifyKey = audioKeyToSpotifyKey(userFeatures.key);
    const targetFeatures = {
      tempo: userFeatures.bpm,
      key: spotifyKey.key,
      mode: spotifyKey.mode,
      energy: userFeatures.energy,
    };

    // Step 4: Get recommendations
    const recommendations = await getRecommendations(
      token,
      seedTracks,
      targetFeatures,
      limit
    );

    if (recommendations.length === 0) {
      throw new Error('No recommendations found');
    }

    // Step 5: Get audio features for recommended tracks
    const trackIds = recommendations.map(track => track.id);
    const audioFeaturesMap = await getAudioFeatures(token, trackIds);

    // Step 6: Calculate similarity scores and rank
    const scoredRecommendations: SpotifyRecommendation[] = recommendations
      .map(track => {
        const features = audioFeaturesMap.get(track.id);

        if (!features) {
          return null;
        }

        const { score, reasons } = calculateSpotifySimilarity(userFeatures, features);

        return {
          track,
          similarity_score: score,
          match_reasons: reasons,
        };
      })
      .filter(Boolean) as SpotifyRecommendation[];

    // Sort by similarity score (descending)
    scoredRecommendations.sort((a, b) => b.similarity_score - a.similarity_score);

    return scoredRecommendations;
  } catch (error) {
    console.error('Spotify recommendations error:', error);
    throw error;
  }
}

/**
 * Simplified function that uses environment variables for credentials
 */
export async function getSpotifyRecommendationsSimple(
  userFeatures: AudioFeatures,
  options?: {
    limit?: number;
    seedGenre?: string;
  }
): Promise<SpotifyRecommendation[]> {
  // In React Native, use expo-constants to load env vars
  // Or pass these from your backend
  const clientId = process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_ID || '';
  const clientSecret = process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_SECRET || '';

  if (!clientId || !clientSecret) {
    throw new Error('Spotify credentials not configured');
  }

  return getSpotifyRecommendations(userFeatures, clientId, clientSecret, options);
}

// ============================================================================
// EXAMPLE USAGE
// ============================================================================

/*
Example usage in your React Native component:

import { analyzeAudio } from './audioAnalyzer';
import { getSpotifyRecommendationsSimple } from './spotifyRecommender';

async function findSimilarTracks(audioFileUri: string) {
  // 1. Analyze user's audio
  const analysis = await analyzeAudio(audioFileUri);

  // 2. Get Spotify recommendations
  const recommendations = await getSpotifyRecommendationsSimple(
    analysis.features,
    {
      limit: 10,
      seedGenre: 'pop rock', // Optional: specify genre
    }
  );

  // 3. Display results
  console.log('Found similar tracks:');
  recommendations.forEach((rec, i) => {
    console.log(`${i + 1}. ${rec.track.name} by ${rec.track.artists.join(', ')}`);
    console.log(`   Similarity: ${(rec.similarity_score * 100).toFixed(1)}%`);
    console.log(`   Reasons: ${rec.match_reasons.join(', ')}`);
  });
}
*/
