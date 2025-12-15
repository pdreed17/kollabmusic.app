// screens/ProjectStudioScreen.tsx
// Single-track playback with tabs for track info and project chat

import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Alert,
  ActivityIndicator,
  TextInput,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Colors, Typography, Spacing, BorderRadius } from '../constants/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

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

export default function ProjectStudioScreen({ route, navigation }: any) {
  const { projectId, projectTitle } = route.params;

  const [tracks, setTracks] = useState<AudioTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentPosition, setCurrentPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [loadingTracks, setLoadingTracks] = useState(false);

  const progressInterval = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadProjectTracks();
    return () => {
      cleanup();
    };
  }, [projectId]);

  // Cleanup on unmount
  const cleanup = async () => {
    if (progressInterval.current) {
      clearInterval(progressInterval.current);
    }
    await audioPlayer.unloadAll();
  };

  // Load all tracks for the project
  const loadProjectTracks = async () => {
    try {
      setLoading(true);
      const audioFiles = await audioService.getProjectAudioFiles(projectId);
      setTracks(audioFiles);

      if (audioFiles.length > 0) {
        await loadTracksIntoPlayer(audioFiles);
      }
    } catch (error) {
      console.error('Error loading tracks:', error);
      Alert.alert('Error', 'Failed to load project tracks');
    } finally {
      setLoading(false);
    }
  };

  // Load tracks into the audio player
  const loadTracksIntoPlayer = async (audioFiles: AudioTrack[]) => {
    try {
      setLoadingTracks(true);

      // Get signed URLs for all tracks
      const trackInfos = await Promise.all(
        audioFiles.map(async (file) => {
          const uri = await audioService.getAudioUrl(file.file_path);
          return {
            id: file.id,
            uri,
            title: file.stem_name || file.file_name,
            volume: file.volume,
            isMuted: file.is_muted,
            isSoloed: file.is_soloed,
          };
        })
      );

      // Load all tracks
      await audioPlayer.loadTracks(trackInfos);

      // Get duration from first track
      if (trackInfos.length > 0) {
        const firstTrackDuration = await audioPlayer.getTrackDuration(trackInfos[0].id);
        setDuration(firstTrackDuration);
      }

      console.log('All tracks loaded successfully');
    } catch (error) {
      console.error('Error loading tracks into player:', error);
      Alert.alert('Error', 'Failed to load audio tracks');
    } finally {
      setLoadingTracks(false);
    }
  };

  // Play/Pause toggle
  const togglePlayback = async () => {
    try {
      if (isPlaying) {
        await audioPlayer.pause();
        setIsPlaying(false);
        if (progressInterval.current) {
          clearInterval(progressInterval.current);
        }
      } else {
        await audioPlayer.play();
        setIsPlaying(true);
        startProgressTracking();
      }
    } catch (error) {
      console.error('Error toggling playback:', error);
      Alert.alert('Error', 'Playback failed');
    }
  };

  // Stop playback
  const stopPlayback = async () => {
    try {
      await audioPlayer.stop();
      setIsPlaying(false);
      setCurrentPosition(0);
      if (progressInterval.current) {
        clearInterval(progressInterval.current);
      }
    } catch (error) {
      console.error('Error stopping playback:', error);
    }
  };

  // Start tracking playback progress
  const startProgressTracking = () => {
    if (progressInterval.current) {
      clearInterval(progressInterval.current);
    }

    progressInterval.current = setInterval(async () => {
      const position = await audioPlayer.getCurrentPosition();
      setCurrentPosition(position);
    }, 100); // Update every 100ms
  };

  // Adjust track volume
  const adjustVolume = async (trackId: string, volume: number) => {
    try {
      await audioPlayer.setTrackVolume(trackId, volume);

      // Update local state
      setTracks(prev =>
        prev.map(track =>
          track.id === trackId ? { ...track, volume } : track
        )
      );

      // Update database
      await audioService.updateMixerSettings(trackId, { volume });
    } catch (error) {
      console.error('Error adjusting volume:', error);
    }
  };

  // Toggle mute for a track
  const toggleMute = async (trackId: string) => {
    try {
      const track = tracks.find(t => t.id === trackId);
      if (!track) return;

      const newMutedState = !track.is_muted;
      await audioPlayer.setTrackMuted(trackId, newMutedState);

      // Update local state
      setTracks(prev =>
        prev.map(t =>
          t.id === trackId ? { ...t, is_muted: newMutedState } : t
        )
      );

      // Update database
      await audioService.updateMixerSettings(trackId, { is_muted: newMutedState });
    } catch (error) {
      console.error('Error toggling mute:', error);
    }
  };

  // Solo a track
  const toggleSolo = async (trackId: string) => {
    try {
      const track = tracks.find(t => t.id === trackId);
      if (!track) return;

      const newSoloState = !track.is_soloed;

      if (newSoloState) {
        // Solo this track (mute all others)
        await audioPlayer.soloTrack(trackId);

        setTracks(prev =>
          prev.map(t => ({
            ...t,
            is_soloed: t.id === trackId,
            is_muted: t.id !== trackId,
          }))
        );
      } else {
        // Unsolo (unmute all)
        await audioPlayer.unsoloAll();

        setTracks(prev =>
          prev.map(t => ({
            ...t,
            is_soloed: false,
            is_muted: false,
          }))
        );
      }

      // Update all tracks in database
      for (const t of tracks) {
        await audioService.updateMixerSettings(t.id, {
          is_soloed: t.id === trackId ? newSoloState : false,
          is_muted: t.id !== trackId ? newSoloState : false,
        });
      }
    } catch (error) {
      console.error('Error toggling solo:', error);
    }
  };

  // Get stem color based on type
  const getStemColor = (stemType: string | null): string => {
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
  };

  // Format time (milliseconds to MM:SS)
  const formatTime = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#fff" />
        <Text style={styles.loadingText}>Loading project...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{projectTitle}</Text>
        <TouchableOpacity style={styles.menuButton}>
          <Ionicons name="ellipsis-vertical" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Transport Controls */}
      <View style={styles.transportContainer}>
        <View style={styles.timeDisplay}>
          <Text style={styles.timeText}>{formatTime(currentPosition)}</Text>
          <Text style={styles.timeSeparator}>/</Text>
          <Text style={styles.timeText}>{formatTime(duration)}</Text>
        </View>

        <View style={styles.transportButtons}>
          <TouchableOpacity
            style={styles.transportButton}
            onPress={stopPlayback}
            disabled={!isPlaying && currentPosition === 0}
          >
            <Ionicons name="stop" size={24} color="#fff" />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.transportButton, styles.playButton]}
            onPress={togglePlayback}
            disabled={loadingTracks || tracks.length === 0}
          >
            <Ionicons name={isPlaying ? 'pause' : 'play'} size={32} color="#fff" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.transportButton}
            onPress={() => audioPlayer.seekTo(0)}
          >
            <Ionicons name="refresh" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Progress Bar */}
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                { width: `${duration > 0 ? (currentPosition / duration) * 100 : 0}%` },
              ]}
            />
          </View>
        </View>
      </View>

      {/* Tracks List */}
      <ScrollView style={styles.tracksList}>
        {loadingTracks ? (
          <View style={styles.loadingTracksContainer}>
            <ActivityIndicator size="small" color="#fff" />
            <Text style={styles.loadingTracksText}>Loading audio tracks...</Text>
          </View>
        ) : tracks.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="musical-notes-outline" size={64} color="#666" />
            <Text style={styles.emptyText}>No tracks yet</Text>
            <Text style={styles.emptySubtext}>Upload audio files to get started</Text>
          </View>
        ) : (
          tracks.map((track) => (
            <View key={track.id} style={styles.trackRow}>
              {/* Track Color Indicator */}
              <View
                style={[
                  styles.trackColorIndicator,
                  { backgroundColor: track.color || getStemColor(track.stem_type) },
                ]}
              />

              {/* Track Info */}
              <View style={styles.trackInfo}>
                <Text style={styles.trackName}>
                  {track.stem_name || track.file_name}
                </Text>
                <Text style={styles.trackType}>
                  {track.stem_type || 'other'}
                </Text>
              </View>

              {/* Track Controls */}
              <View style={styles.trackControls}>
                {/* Solo Button */}
                <TouchableOpacity
                  style={[
                    styles.controlButton,
                    track.is_soloed && styles.controlButtonActive,
                  ]}
                  onPress={() => toggleSolo(track.id)}
                >
                  <Text style={styles.controlButtonText}>S</Text>
                </TouchableOpacity>

                {/* Mute Button */}
                <TouchableOpacity
                  style={[
                    styles.controlButton,
                    track.is_muted && styles.controlButtonActive,
                  ]}
                  onPress={() => toggleMute(track.id)}
                >
                  <Text style={styles.controlButtonText}>M</Text>
                </TouchableOpacity>

                {/* Volume Indicator */}
                <View style={styles.volumeIndicator}>
                  <Text style={styles.volumeText}>
                    {Math.round(track.volume * 100)}%
                  </Text>
                </View>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* Bottom Actions */}
      <View style={styles.bottomActions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => navigation.navigate('AudioUpload', { projectId })}
        >
          <Ionicons name="add-circle-outline" size={24} color="#fff" />
          <Text style={styles.actionButtonText}>Add Track</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 50,
    backgroundColor: '#000',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 16,
  },
  menuButton: {
    padding: 8,
  },
  transportContainer: {
    backgroundColor: '#0a0a0a',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  timeDisplay: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  timeText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'monospace',
  },
  timeSeparator: {
    color: '#666',
    fontSize: 16,
    marginHorizontal: 8,
  },
  transportButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
    marginBottom: 16,
  },
  transportButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#007AFF',
  },
  progressContainer: {
    paddingHorizontal: 4,
  },
  progressBar: {
    height: 4,
    backgroundColor: '#333',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#007AFF',
  },
  tracksList: {
    flex: 1,
  },
  loadingTracksContainer: {
    padding: 32,
    alignItems: 'center',
  },
  loadingTracksText: {
    color: '#999',
    fontSize: 14,
    marginTop: 12,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 64,
  },
  emptyText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
    marginTop: 16,
  },
  emptySubtext: {
    color: '#999',
    fontSize: 14,
    marginTop: 8,
  },
  trackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  trackColorIndicator: {
    width: 4,
    height: 40,
    borderRadius: 2,
    marginRight: 12,
  },
  trackInfo: {
    flex: 1,
  },
  trackName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  trackType: {
    color: '#999',
    fontSize: 12,
    marginTop: 4,
    textTransform: 'capitalize',
  },
  trackControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  controlButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  controlButtonActive: {
    backgroundColor: '#007AFF',
  },
  controlButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  volumeIndicator: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#333',
    borderRadius: 4,
  },
  volumeText: {
    color: '#fff',
    fontSize: 12,
    fontFamily: 'monospace',
  },
  bottomActions: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#000',
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    backgroundColor: '#007AFF',
    borderRadius: 8,
    gap: 8,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});