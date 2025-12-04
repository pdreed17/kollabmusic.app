/**
 * SimilarTracksScreen.tsx
 *
 * Screen for finding similar audio tracks based on musical characteristics
 * Uses audio analysis to find similar user recordings and Spotify recommendations
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { useAuth } from '../contexts/AuthContext';
import { analyzeAndFindSimilar, SimilarAudioResult } from '../services/similarityApi';
import { getSpotifyRecommendationsSimple, SpotifyRecommendation } from '../services/spotifyRecommender';
import { Colors, Typography, Spacing, BorderRadius } from '../constants/theme';

// ============================================================================
// TYPES
// ============================================================================

interface AnalysisProgress {
  stage: string;
  progress: number;
  message: string;
}

type ScreenState = 'idle' | 'analyzing' | 'results' | 'error';

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function SimilarTracksScreen({ route, navigation }: any) {
  const { user } = useAuth();
  const [screenState, setScreenState] = useState<ScreenState>('idle');
  const [progress, setProgress] = useState<AnalysisProgress>({
    stage: '',
    progress: 0,
    message: '',
  });
  const [similarRecordings, setSimilarRecordings] = useState<SimilarAudioResult[]>([]);
  const [spotifyRecs, setSpotifyRecs] = useState<SpotifyRecommendation[]>([]);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [playingTrackId, setPlayingTrackId] = useState<string | null>(null);

  // Get audio file info from navigation params
  const audioFileId = route.params?.audioFileId;
  const audioFileUri = route.params?.audioFileUri;
  const projectId = route.params?.projectId;

  // ============================================================================
  // LIFECYCLE
  // ============================================================================

  useEffect(() => {
    if (audioFileId && audioFileUri) {
      startAnalysis();
    }
  }, [audioFileId, audioFileUri]);

  useEffect(() => {
    return () => {
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, [sound]);

  // ============================================================================
  // ANALYSIS LOGIC
  // ============================================================================

  const startAnalysis = async () => {
    if (!user) {
      Alert.alert('Error', 'You must be logged in to use this feature');
      return;
    }

    setScreenState('analyzing');
    setProgress({ stage: 'starting', progress: 0, message: 'Starting analysis...' });

    try {
      // Step 1: Analyze and find similar recordings
      const result = await analyzeAndFindSimilar(
        audioFileId,
        audioFileUri,
        user.id,
        projectId,
        (stage, progress, message) => {
          setProgress({ stage, progress, message });
        }
      );

      if (!result.success) {
        throw new Error(result.error || 'Analysis failed');
      }

      setSimilarRecordings(result.results || []);

      // Step 2: Get Spotify recommendations (optional, runs in background)
      // Only if we successfully analyzed the audio
      if (result.results && result.results.length > 0) {
        try {
          setProgress({ stage: 'spotify', progress: 95, message: 'Finding Spotify tracks...' });

          // Extract features from the first similar result to get our audio features
          // In production, you'd want to store the analyzed features
          const firstResult = result.results[0];

          // For now, skip Spotify if credentials aren't configured
          const clientId = process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_ID;
          if (clientId) {
            // We'd need to re-analyze to get features for Spotify
            // This is a simplified version - in production, cache the analysis result
            setSpotifyRecs([]);
          }
        } catch (spotifyError) {
          console.warn('Spotify recommendations failed:', spotifyError);
          // Don't fail the whole screen if Spotify fails
        }
      }

      setScreenState('results');
    } catch (error: any) {
      console.error('Analysis error:', error);
      setErrorMessage(error.message || 'Failed to analyze audio');
      setScreenState('error');
    }
  };

  // ============================================================================
  // AUDIO PLAYBACK
  // ============================================================================

  const playPreview = async (previewUrl: string, trackId: string) => {
    try {
      // Stop current sound if playing
      if (sound) {
        await sound.unloadAsync();
        setSound(null);
        if (playingTrackId === trackId) {
          setPlayingTrackId(null);
          return;
        }
      }

      // Play new sound
      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: previewUrl },
        { shouldPlay: true }
      );

      setSound(newSound);
      setPlayingTrackId(trackId);

      newSound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          setPlayingTrackId(null);
        }
      });
    } catch (error) {
      console.error('Playback error:', error);
      Alert.alert('Playback Error', 'Could not play preview');
    }
  };

  // ============================================================================
  // RENDER HELPERS
  // ============================================================================

  const renderAnalyzingState = () => (
    <View style={styles.centerContainer}>
      <ActivityIndicator size="large" color={Colors.primary} />
      <Text style={styles.progressStage}>{progress.message}</Text>
      <View style={styles.progressBarContainer}>
        <View style={[styles.progressBar, { width: `${progress.progress}%` }]} />
      </View>
      <Text style={styles.progressPercent}>{progress.progress}%</Text>
    </View>
  );

  const renderErrorState = () => (
    <View style={styles.centerContainer}>
      <Ionicons name="alert-circle-outline" size={64} color={Colors.error} />
      <Text style={styles.errorTitle}>Analysis Failed</Text>
      <Text style={styles.errorMessage}>{errorMessage}</Text>
      <TouchableOpacity style={styles.retryButton} onPress={startAnalysis}>
        <Text style={styles.retryButtonText}>Retry</Text>
      </TouchableOpacity>
    </View>
  );

  const renderSimilarRecordingItem = ({ item }: { item: SimilarAudioResult }) => (
    <TouchableOpacity style={styles.recordingItem}>
      <View style={styles.recordingIconContainer}>
        <Ionicons name="musical-notes" size={24} color={Colors.primary} />
      </View>

      <View style={styles.recordingInfo}>
        <Text style={styles.recordingName} numberOfLines={1}>
          {item.file_name}
        </Text>
        <Text style={styles.recordingUser}>
          by {item.user.display_name || item.user.username}
        </Text>
        <View style={styles.recordingFeatures}>
          <Text style={styles.featureText}>{Math.round(item.bpm)} BPM</Text>
          <Text style={styles.featureSeparator}>•</Text>
          <Text style={styles.featureText}>{item.key}</Text>
          <Text style={styles.featureSeparator}>•</Text>
          <Text style={styles.featureText}>
            {Math.round(item.energy * 100)}% energy
          </Text>
        </View>
      </View>

      <View style={styles.similarityBadge}>
        <Text style={styles.similarityText}>
          {Math.round(item.similarity_score * 100)}%
        </Text>
        <Text style={styles.similarityLabel}>match</Text>
      </View>
    </TouchableOpacity>
  );

  const renderSpotifyItem = ({ item }: { item: SpotifyRecommendation }) => {
    const isPlaying = playingTrackId === item.track.id;

    return (
      <TouchableOpacity
        style={styles.spotifyItem}
        onPress={() => {
          if (item.track.preview_url) {
            playPreview(item.track.preview_url, item.track.id);
          } else {
            Alert.alert('No Preview', 'This track does not have a preview available');
          }
        }}
      >
        {item.track.image_url ? (
          <Image source={{ uri: item.track.image_url }} style={styles.albumArt} />
        ) : (
          <View style={[styles.albumArt, styles.albumArtPlaceholder]}>
            <Ionicons name="musical-note" size={24} color={Colors.textSecondary} />
          </View>
        )}

        <View style={styles.spotifyInfo}>
          <Text style={styles.spotifyTrack} numberOfLines={1}>
            {item.track.name}
          </Text>
          <Text style={styles.spotifyArtist} numberOfLines={1}>
            {item.track.artists.join(', ')}
          </Text>
          <Text style={styles.spotifyReasons} numberOfLines={1}>
            {item.match_reasons.join(' • ')}
          </Text>
        </View>

        <View style={styles.spotifyRight}>
          <View style={styles.similarityBadge}>
            <Text style={styles.similarityText}>
              {Math.round(item.similarity_score * 100)}%
            </Text>
          </View>
          {item.track.preview_url && (
            <Ionicons
              name={isPlaying ? 'pause-circle' : 'play-circle'}
              size={32}
              color={Colors.primary}
              style={styles.playIcon}
            />
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderResultsState = () => (
    <ScrollView style={styles.resultsContainer} showsVerticalScrollIndicator={false}>
      {/* Similar Recordings Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="people-outline" size={24} color={Colors.text} />
          <Text style={styles.sectionTitle}>Similar Recordings</Text>
        </View>

        {similarRecordings.length > 0 ? (
          <FlatList
            data={similarRecordings}
            keyExtractor={(item) => item.audio_file_id}
            renderItem={renderSimilarRecordingItem}
            scrollEnabled={false}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
          />
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="musical-notes-outline" size={48} color={Colors.textSecondary} />
            <Text style={styles.emptyStateText}>
              No similar recordings found yet
            </Text>
            <Text style={styles.emptyStateSubtext}>
              Be the first to upload tracks like this!
            </Text>
          </View>
        )}
      </View>

      {/* Spotify Recommendations Section */}
      {spotifyRecs.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="logo-spotify" size={24} color="#1DB954" />
            <Text style={styles.sectionTitle}>You Might Like</Text>
          </View>

          <FlatList
            data={spotifyRecs}
            keyExtractor={(item) => item.track.id}
            renderItem={renderSpotifyItem}
            scrollEnabled={false}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
          />
        </View>
      )}

      {/* Info Footer */}
      <View style={styles.infoFooter}>
        <Ionicons name="information-circle-outline" size={20} color={Colors.textSecondary} />
        <Text style={styles.infoText}>
          Similarity is based on BPM, key, energy, and audio characteristics
        </Text>
      </View>
    </ScrollView>
  );

  const renderIdleState = () => (
    <View style={styles.centerContainer}>
      <Ionicons name="analytics-outline" size={64} color={Colors.textSecondary} />
      <Text style={styles.idleTitle}>Find Similar Tracks</Text>
      <Text style={styles.idleMessage}>
        Upload or select an audio file to find similar recordings
      </Text>
    </View>
  );

  // ============================================================================
  // MAIN RENDER
  // ============================================================================

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={28} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Similar Tracks</Text>
        <View style={styles.headerRight} />
      </View>

      {/* Content */}
      {screenState === 'idle' && renderIdleState()}
      {screenState === 'analyzing' && renderAnalyzingState()}
      {screenState === 'error' && renderErrorState()}
      {screenState === 'results' && renderResultsState()}
    </SafeAreaView>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.backgroundDark,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backButton: {
    padding: Spacing.xs,
    marginLeft: -Spacing.xs,
  },
  headerTitle: {
    ...Typography.h2,
    color: Colors.text,
  },
  headerRight: {
    width: 28,
  },

  // Center container for idle/analyzing/error states
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
  },

  // Idle state
  idleTitle: {
    ...Typography.h2,
    color: Colors.text,
    marginTop: Spacing.lg,
    textAlign: 'center',
  },
  idleMessage: {
    ...Typography.body,
    color: Colors.textSecondary,
    marginTop: Spacing.sm,
    textAlign: 'center',
  },

  // Analyzing state
  progressStage: {
    ...Typography.h3,
    color: Colors.text,
    marginTop: Spacing.lg,
    marginBottom: Spacing.md,
  },
  progressBarContainer: {
    width: '100%',
    height: 8,
    backgroundColor: Colors.border,
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
    marginVertical: Spacing.md,
  },
  progressBar: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.full,
  },
  progressPercent: {
    ...Typography.h3,
    color: Colors.primary,
    marginTop: Spacing.sm,
  },

  // Error state
  errorTitle: {
    ...Typography.h2,
    color: Colors.error,
    marginTop: Spacing.lg,
  },
  errorMessage: {
    ...Typography.body,
    color: Colors.textSecondary,
    marginTop: Spacing.sm,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginTop: Spacing.xl,
  },
  retryButtonText: {
    ...Typography.button,
    color: Colors.text,
  },

  // Results state
  resultsContainer: {
    flex: 1,
  },
  section: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    ...Typography.h3,
    color: Colors.text,
    marginLeft: Spacing.sm,
  },

  // Similar recordings
  recordingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
  recordingIconContainer: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.backgroundLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  recordingInfo: {
    flex: 1,
    marginRight: Spacing.md,
  },
  recordingName: {
    ...Typography.body,
    color: Colors.text,
    fontWeight: '600',
    marginBottom: 4,
  },
  recordingUser: {
    ...Typography.caption,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  recordingFeatures: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  featureText: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontSize: 11,
  },
  featureSeparator: {
    ...Typography.caption,
    color: Colors.textSecondary,
    marginHorizontal: 4,
  },
  similarityBadge: {
    backgroundColor: Colors.primary + '20',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
  },
  similarityText: {
    ...Typography.caption,
    color: Colors.primary,
    fontWeight: '700',
    fontSize: 13,
  },
  similarityLabel: {
    ...Typography.caption,
    color: Colors.primary,
    fontSize: 9,
    marginTop: -2,
  },

  // Spotify recommendations
  spotifyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
  albumArt: {
    width: 56,
    height: 56,
    borderRadius: BorderRadius.md,
    marginRight: Spacing.md,
  },
  albumArtPlaceholder: {
    backgroundColor: Colors.backgroundLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  spotifyInfo: {
    flex: 1,
    marginRight: Spacing.md,
  },
  spotifyTrack: {
    ...Typography.body,
    color: Colors.text,
    fontWeight: '600',
    marginBottom: 4,
  },
  spotifyArtist: {
    ...Typography.caption,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  spotifyReasons: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontSize: 11,
    fontStyle: 'italic',
  },
  spotifyRight: {
    alignItems: 'center',
  },
  playIcon: {
    marginTop: Spacing.xs,
  },

  // Common
  separator: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: Spacing.xs,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing.xl * 2,
  },
  emptyStateText: {
    ...Typography.body,
    color: Colors.textSecondary,
    marginTop: Spacing.md,
    textAlign: 'center',
  },
  emptyStateSubtext: {
    ...Typography.caption,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
    textAlign: 'center',
  },
  infoFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
    backgroundColor: Colors.backgroundLight,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.xl,
    borderRadius: BorderRadius.md,
  },
  infoText: {
    ...Typography.caption,
    color: Colors.textSecondary,
    marginLeft: Spacing.sm,
    flex: 1,
  },
});
