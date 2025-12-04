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
  SafeAreaView,
  TextInput,
  Modal,
  PanResponder,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Colors, Typography, Spacing, BorderRadius } from '../constants/theme';
import Header from '../components/Header';
import NearbyCollaborators from '../components/NearbyCollaborators';

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
  bpm?: number;
  key?: string;
  created_at: string;
}

interface Comment {
  id: string;
  content: string;
  timestamp_ms?: number;
  created_at: string;
  user_id: string;
  users: {
    username: string;
    display_name: string;
  };
}

type TabType = 'track' | 'chat' | 'nearby';

export default function ProjectStudioScreen({ route, navigation }: any) {
  const { projectId, projectTitle } = route.params;
  const { user } = useAuth();

  // Project & Track State
  const [loading, setLoading] = useState(true);
  const [tracks, setTracks] = useState<AudioTrack[]>([]);
  const [selectedTrack, setSelectedTrack] = useState<AudioTrack | null>(null);
  const [project, setProject] = useState<any>(null);

  // Audio Player State
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentPosition, setCurrentPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const playbackInterval = useRef<NodeJS.Timeout | null>(null);

  // UI State
  const [activeTab, setActiveTab] = useState<TabType>('track');
  const [chatMessages, setChatMessages] = useState<Comment[]>([]);
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [newComment, setNewComment] = useState('');

  // Playback Window State
  const [playerState, setPlayerState] = useState<'closed' | 'minimized' | 'maximized'>('closed');
  const [showEditModal, setShowEditModal] = useState(false);
  const [showTimelineCommentModal, setShowTimelineCommentModal] = useState(false);
  const [showViewCommentModal, setShowViewCommentModal] = useState(false);
  const [commentTimestamp, setCommentTimestamp] = useState(0);
  const [timelineComments, setTimelineComments] = useState<Comment[]>([]);
  const [selectedComment, setSelectedComment] = useState<Comment | null>(null);
  const [editingComment, setEditingComment] = useState(false);
  const [editCommentText, setEditCommentText] = useState('');

  // Edit Audio State
  const [editedFileName, setEditedFileName] = useState('');
  const [editedAudioType, setEditedAudioType] = useState('');
  const [trimStart, setTrimStart] = useState('0:00');
  const [trimEnd, setTrimEnd] = useState('');

  // Track playback positions - remember where each track was paused
  const [trackPositions, setTrackPositions] = useState<{ [key: string]: number }>({});

  // Timeline scrubbing state
  const [isScrubbing, setIsScrubbing] = useState(false);
  const progressBarWidth = useRef(0);
  const progressBarX = useRef(0);

  useEffect(() => {
    loadProjectData();
    return cleanup;
  }, [projectId]);

  // Add focus listener to stop audio when navigating away
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', async () => {
      // Stop and cleanup audio when leaving screen
      if (sound) {
        try {
          await sound.stopAsync();
          await sound.unloadAsync();
        } catch (error) {
          console.error('Error cleaning up audio:', error);
        }
      }
    });

    return unsubscribe;
  }, [navigation, sound]);

  const cleanup = async () => {
    if (sound) {
      await sound.unloadAsync();
    }
    if (playbackInterval.current) {
      clearInterval(playbackInterval.current);
    }
  };

  const loadProjectData = async () => {
    try {
      setLoading(true);

      // Load project details
      const { data: projectData, error: projectError } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single();

      if (projectError) throw projectError;
      setProject(projectData);

      // Load audio tracks
      const { data: audioData, error: audioError } = await supabase
        .from('audio_files')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: true });

      if (audioError) throw audioError;

      const formattedTracks: AudioTrack[] = (audioData || []).map(file => ({
        id: file.id || '',
        file_name: file.file_name || '',
        file_path: file.file_path || '',
        stem_type: file.stem_type || '',
        stem_name: file.stem_name || '',
        volume: Number(file.volume) || 1.0,
        pan: Number(file.pan) || 0.0,
        is_muted: file.is_muted || false,
        is_soloed: file.is_soloed || false,
        color: getStemColor(file.stem_type),
        duration_ms: Number(file.duration_ms) || 0,
        bpm: file.bpm ? Number(file.bpm) : undefined,
        key: file.key || undefined,
        created_at: file.created_at || '',
      }));

      setTracks(formattedTracks);

      // Load chat messages (project-level comments)
      const { data: commentsData, error: commentsError } = await supabase
        .from('comments')
        .select(`
          id,
          content,
          created_at,
          user_id,
          users!comments_user_id_fkey(username, display_name)
        `)
        .eq('project_id', projectId)
        .is('audio_file_id', null) // Only project-level comments, not track-specific
        .order('created_at', { ascending: false });

      if (commentsError) {
        console.warn('Chat comments error:', commentsError);
      } else {
        const typedComments: Comment[] = (commentsData || []).map(comment => ({
          id: comment.id || '',
          content: comment.content || '',
          created_at: comment.created_at || '',
          users: {
            username: comment.users?.username || '',
            display_name: comment.users?.display_name || ''
          }
        }));
        setChatMessages(typedComments);
      }

    } catch (error) {
      console.error('Error loading project:', error);
      Alert.alert('Error', 'Failed to load project');
    } finally {
      setLoading(false);
    }
  };

  const getStemColor = (stemType: string | null): string => {
    const stemColors: { [key: string]: string } = {
      vocals: Colors.vocals,
      drums: Colors.drums,
      bass: Colors.bass,
      guitar: Colors.guitar,
      keys: Colors.keys,
      synth: Colors.synth,
    };
    return stemColors[stemType?.toLowerCase() || 'other'] || Colors.primary;
  };

  const selectTrack = async (track: AudioTrack) => {
    try {
      // Save current track's position before switching
      if (selectedTrack && sound) {
        const status = await sound.getStatusAsync();
        if (status.isLoaded) {
          setTrackPositions(prev => ({
            ...prev,
            [selectedTrack.id]: status.positionMillis || 0
          }));
        }
      }

      // Stop and unload current sound when switching tracks
      if (sound) {
        await sound.stopAsync();
        await sound.unloadAsync();
        setSound(null);
      }

      setSelectedTrack(track);
      setIsPlaying(false);

      // Restore saved position for this track, or start from beginning
      const savedPosition = trackPositions[track.id] || 0;
      setCurrentPosition(savedPosition);
      setDuration(track.duration_ms || 0);

      // Open player in minimized state (or keep current state if already open)
      if (playerState === 'closed') {
        setPlayerState('minimized');
      }

      // Load the new track and restore position
      await loadTrack(track, savedPosition);

      // Load timeline comments for this track
      loadTimelineComments(track.id);
    } catch (error) {
      console.error('Error selecting track:', error);
    }
  };

  const loadTrack = async (track: AudioTrack, startPosition: number = 0) => {
    try {
      setIsLoading(true);

      // Get signed URL for the track
      const { data, error } = await supabase.storage
        .from('audio-files')
        .createSignedUrl(track.file_path, 3600);

      if (error) throw error;

      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: data.signedUrl },
        {
          shouldPlay: false,
          volume: track.volume,
          isLooping: false,
          positionMillis: startPosition, // Start at saved position
        },
        onPlaybackStatusUpdate
      );

      setSound(newSound);
      console.log('Track loaded successfully:', track.stem_name || track.file_name, `at ${startPosition}ms`);
    } catch (error) {
      console.error('Error loading track:', error);
      // Use fallback duration if loading fails
      setDuration(track.duration_ms || 0);
    } finally {
      setIsLoading(false);
    }
  };

  const onPlaybackStatusUpdate = (status: any) => {
    if (status.isLoaded) {
      setCurrentPosition(status.positionMillis || 0);
      setDuration(status.durationMillis || duration);
      setIsPlaying(status.isPlaying || false);

      if (status.didJustFinish) {
        setIsPlaying(false);
        setCurrentPosition(0);
      }
    }
  };

  const togglePlayback = async () => {
    if (!selectedTrack) {
      Alert.alert('No Track Selected', 'Please select a track to play');
      return;
    }

    try {
      if (sound) {
        if (isPlaying) {
          await sound.pauseAsync();
        } else {
          await sound.playAsync();
        }
      } else {
        // If no sound loaded, try loading the selected track first
        await loadTrack(selectedTrack);
      }
    } catch (error) {
      console.error('Error toggling playback:', error);
      Alert.alert('Playback Error', 'Failed to play audio');
    }
  };

  const stopPlayback = async () => {
    try {
      if (sound) {
        await sound.stopAsync();
        setCurrentPosition(0);
      }
    } catch (error) {
      console.error('Error stopping playback:', error);
    }
  };

  const seekTo = async (positionMs: number) => {
    try {
      if (sound) {
        const clampedPosition = Math.max(0, Math.min(duration, positionMs));
        await sound.setPositionAsync(clampedPosition);
        setCurrentPosition(clampedPosition);
      }
    } catch (error) {
      console.error('Error seeking:', error);
    }
  };

  const skipTime = async (seconds: number) => {
    const newPosition = currentPosition + (seconds * 1000);
    await seekTo(newPosition);
  };

  // Handle timeline scrubbing with touch
  const handleTimelineScrub = (touchX: number) => {
    if (!duration || progressBarWidth.current === 0) return;

    // Calculate position relative to progress bar
    const relativeX = touchX - progressBarX.current;
    const percentage = Math.max(0, Math.min(1, relativeX / progressBarWidth.current));
    const newPosition = percentage * duration;

    // Update position immediately for visual feedback
    setCurrentPosition(newPosition);

    // Seek in audio
    if (sound && !isScrubbing) {
      seekTo(newPosition);
    }
  };

  // Create PanResponder for timeline
  const timelinePanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        setIsScrubbing(true);
        handleTimelineScrub(evt.nativeEvent.pageX);
      },
      onPanResponderMove: (evt) => {
        handleTimelineScrub(evt.nativeEvent.pageX);
      },
      onPanResponderRelease: (evt) => {
        handleTimelineScrub(evt.nativeEvent.pageX);
        setIsScrubbing(false);
      },
    })
  ).current;

  const formatTime = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const addChatMessage = async () => {
    if (!newComment.trim()) return;

    try {
      const { error } = await supabase
        .from('comments')
        .insert({
          project_id: projectId,
          user_id: user?.id,
          content: newComment.trim(),
          audio_file_id: null, // Project-level comment
        });

      if (error) throw error;

      setNewComment('');
      setShowCommentModal(false);
      loadProjectData(); // Refresh comments
    } catch (error) {
      console.error('Error adding chat message:', error);
      Alert.alert('Error', 'Failed to send message');
    }
  };

  // Load timeline comments for a specific audio file
  const loadTimelineComments = async (audioFileId: string) => {
    try {
      const { data, error } = await supabase
        .from('comments')
        .select(`
          id,
          content,
          timestamp_ms,
          created_at,
          user_id,
          users!comments_user_id_fkey(username, display_name)
        `)
        .eq('audio_file_id', audioFileId)
        .order('timestamp_ms', { ascending: true });

      if (error) {
        console.warn('Timeline comments error:', error);
        setTimelineComments([]);
      } else {
        const typedComments: Comment[] = (data || []).map(comment => ({
          id: comment.id || '',
          content: comment.content || '',
          timestamp_ms: comment.timestamp_ms || 0,
          created_at: comment.created_at || '',
          user_id: comment.user_id || '',
          users: {
            username: comment.users?.username || '',
            display_name: comment.users?.display_name || ''
          }
        }));
        setTimelineComments(typedComments);
      }
    } catch (error) {
      console.error('Error loading timeline comments:', error);
      setTimelineComments([]);
    }
  };

  // Add a timeline comment at current timestamp
  const addTimelineComment = async (content: string) => {
    if (!selectedTrack || !content.trim()) return;

    try {
      const { error } = await supabase
        .from('comments')
        .insert({
          project_id: projectId,
          audio_file_id: selectedTrack.id,
          user_id: user?.id,
          content: content.trim(),
          timestamp_ms: commentTimestamp,
        });

      if (error) throw error;

      // Reload timeline comments
      loadTimelineComments(selectedTrack.id);
      setShowTimelineCommentModal(false);
      setNewComment('');
    } catch (error) {
      console.error('Error adding timeline comment:', error);
      Alert.alert('Error', 'Failed to add comment');
    }
  };

  // View existing comment (don't seek, just highlight and show modal)
  const handleCommentTap = (comment: Comment) => {
    setSelectedComment(comment);
    setEditingComment(false);
    setEditCommentText(comment.content);
    setShowViewCommentModal(true);
  };

  // Play from comment timestamp
  const playFromComment = async () => {
    if (selectedComment && selectedComment.timestamp_ms !== undefined) {
      await seekTo(selectedComment.timestamp_ms);
      setShowViewCommentModal(false);
      setSelectedComment(null);
    }
  };

  // Edit comment
  const updateComment = async () => {
    if (!selectedComment || !editCommentText.trim()) return;

    try {
      const { error } = await supabase
        .from('comments')
        .update({ content: editCommentText.trim() })
        .eq('id', selectedComment.id);

      if (error) throw error;

      // Reload timeline comments
      if (selectedTrack) {
        loadTimelineComments(selectedTrack.id);
      }
      setShowViewCommentModal(false);
      setSelectedComment(null);
      setEditingComment(false);
    } catch (error) {
      console.error('Error updating comment:', error);
      Alert.alert('Error', 'Failed to update comment');
    }
  };

  // Delete comment
  const deleteComment = async () => {
    if (!selectedComment) return;

    try {
      const { error } = await supabase
        .from('comments')
        .delete()
        .eq('id', selectedComment.id);

      if (error) throw error;

      // Reload timeline comments
      if (selectedTrack) {
        loadTimelineComments(selectedTrack.id);
      }
      setShowViewCommentModal(false);
      setSelectedComment(null);
    } catch (error) {
      console.error('Error deleting comment:', error);
      Alert.alert('Error', 'Failed to delete comment');
    }
  };

  // Open timeline comment modal at current position (create new comment)
  const openTimelineCommentModal = () => {
    setCommentTimestamp(currentPosition);
    setShowTimelineCommentModal(true);
  };

  // Open edit modal with current track data
  const openEditModal = () => {
    if (!selectedTrack) return;
    setEditedFileName(selectedTrack.file_name);
    setEditedAudioType(selectedTrack.stem_type || '');
    setTrimStart('0:00');
    setTrimEnd(formatTime(selectedTrack.duration_ms || 0));
    setShowEditModal(true);
  };

  // Save audio file edits
  const saveAudioEdits = async () => {
    if (!selectedTrack) return;

    try {
      const trackId = selectedTrack.id;

      const { error } = await supabase
        .from('audio_files')
        .update({
          file_name: editedFileName,
          stem_type: editedAudioType,
        })
        .eq('id', trackId);

      if (error) throw error;

      // Update local state directly instead of reloading
      const updatedTrack = {
        ...selectedTrack,
        file_name: editedFileName,
        stem_type: editedAudioType,
      };

      // Update the tracks array
      setTracks(prevTracks =>
        prevTracks.map(track =>
          track.id === trackId ? updatedTrack : track
        )
      );

      // Update the selected track
      setSelectedTrack(updatedTrack);

      setShowEditModal(false);

      Alert.alert('Success', 'Audio file updated successfully');
    } catch (error) {
      console.error('Error updating audio file:', error);
      Alert.alert('Error', 'Failed to update audio file');
    }
  };

  // Delete audio file
  const deleteAudioFile = async () => {
    if (!selectedTrack) return;

    try {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('audio-files')
        .remove([selectedTrack.file_path]);

      if (storageError) console.warn('Storage delete error:', storageError);

      // Delete from database
      const { error: dbError } = await supabase
        .from('audio_files')
        .delete()
        .eq('id', selectedTrack.id);

      if (dbError) throw dbError;

      // Clean up player
      if (sound) {
        await sound.unloadAsync();
        setSound(null);
      }

      setSelectedTrack(null);
      setPlayerState('closed');
      setShowEditModal(false);

      // Reload project data
      await loadProjectData();

      Alert.alert('Success', 'Audio file deleted successfully');
    } catch (error) {
      console.error('Error deleting audio file:', error);
      Alert.alert('Error', 'Failed to delete audio file');
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading project...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Header
        title={project?.title || projectTitle}
        subtitle="Project Studio"
        variant="compact"
        showBack
        onBack={() => navigation.goBack()}
        rightButton={{
          icon: "settings-outline",
          onPress: () => {}
        }}
      />

      {/* Main Content - Audio Files List */}
      <ScrollView style={styles.mainTracksList} showsVerticalScrollIndicator={false}>
        {tracks.length === 0 ? (
          <View style={styles.emptyTracksState}>
            <Ionicons name="musical-notes-outline" size={48} color={Colors.textSecondary} />
            <Text style={styles.emptyStateText}>No tracks yet</Text>
            <Text style={styles.emptyStateSubtext}>Add audio files to get started</Text>
            <TouchableOpacity
              style={styles.addTrackButton}
              onPress={() => navigation.navigate('AudioUpload', { projectId })}
            >
              <Text style={styles.addTrackButtonText}>Add Track</Text>
            </TouchableOpacity>
          </View>
        ) : (
          tracks.map((track) => (
            <TouchableOpacity
              key={track.id}
              style={[
                styles.trackItem,
                selectedTrack?.id === track.id && styles.trackItemSelected
              ]}
              onPress={() => selectTrack(track)}
            >
              <View
                style={[
                  styles.trackColorIndicator,
                  { backgroundColor: getStemColor(track.stem_type) }
                ]}
              />
              <View style={styles.trackInfo}>
                <Text style={styles.trackName} numberOfLines={1}>
                  {track.file_name}
                </Text>
                <View style={styles.trackMeta}>
                  <Text style={styles.trackType}>{track.stem_type}</Text>
                  <Text style={styles.trackDuration}>{formatTime(track.duration_ms || 0)}</Text>
                </View>
              </View>

              {selectedTrack?.id === track.id && (
                <View style={styles.playingIndicator}>
                  <Ionicons
                    name={isPlaying ? "volume-high" : "play"}
                    size={14}
                    color={Colors.primary}
                  />
                </View>
              )}
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {/* Minimized Player - Spotify-style bar */}
      {selectedTrack && playerState === 'minimized' && (
        <View style={styles.minimizedPlayer}>
          {/* Maximize Handle */}
          <TouchableOpacity
            style={styles.minimizedHandle}
            onPress={() => setPlayerState('maximized')}
            activeOpacity={0.6}
          >
            <View style={styles.minimizedHandleBar} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.minimizedContentWrapper}
            onPress={() => setPlayerState('maximized')}
            activeOpacity={0.8}
          >
            <View style={styles.minimizedContent}>
              <View
                style={[
                  styles.minimizedColorBar,
                  { backgroundColor: getStemColor(selectedTrack.stem_type) }
                ]}
              />
              <View style={styles.minimizedInfo}>
                <Text style={styles.minimizedTrackName} numberOfLines={1}>
                  {selectedTrack.file_name}
                </Text>
                <Text style={styles.minimizedStemType}>
                  {selectedTrack.stem_type || 'Audio'}
                </Text>
              </View>
              <TouchableOpacity
                onPress={(e) => {
                  e.stopPropagation();
                  togglePlayback();
                }}
                style={styles.minimizedPlayButton}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color={Colors.text} />
                ) : (
                  <Ionicons name={isPlaying ? 'pause' : 'play'} size={20} color={Colors.text} />
                )}
              </TouchableOpacity>
            </View>
          </TouchableOpacity>

          {/* Tiny progress indicator */}
          <View style={styles.minimizedProgressBar}>
            <View
              style={[
                styles.minimizedProgressFill,
                { width: `${duration > 0 ? (currentPosition / duration) * 100 : 0}%` },
              ]}
            />
          </View>
        </View>
      )}

      {/* Maximized Player - Full controls with timeline */}
      {selectedTrack && playerState === 'maximized' && (
        <View style={styles.maximizedPlayer}>
          {/* Minimize Handle */}
          <TouchableOpacity
            style={styles.minimizeHandle}
            onPress={() => setPlayerState('minimized')}
            activeOpacity={0.6}
          >
            <View style={styles.minimizeBar} />
          </TouchableOpacity>

          {/* Track Info */}
          <View style={styles.maximizedTrackInfo}>
            <View
              style={[
                styles.maximizedColorBar,
                { backgroundColor: getStemColor(selectedTrack.stem_type) }
              ]}
            />
            <View style={styles.maximizedTrackText}>
              <Text style={styles.maximizedTrackName} numberOfLines={1}>
                {selectedTrack.file_name}
              </Text>
              <Text style={styles.maximizedStemType}>
                {selectedTrack.stem_type || 'Audio'}
              </Text>
            </View>
          </View>

          {/* Timeline - Progress bar with comment indicators */}
          <View style={styles.timelineContainer}>
            <View
              style={styles.progressContainer}
              onLayout={(event) => {
                const { width, x } = event.nativeEvent.layout;
                progressBarWidth.current = width;
                progressBarX.current = x;
              }}
              {...timelinePanResponder.panHandlers}
            >
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${duration > 0 ? (currentPosition / duration) * 100 : 0}%` },
                  ]}
                />
              </View>
              {/* Comment position indicators on timeline */}
              {timelineComments.map((comment) => {
                const position = duration > 0 ? ((comment.timestamp_ms || 0) / duration) * 100 : 0;
                return (
                  <View
                    key={`indicator-${comment.id}`}
                    style={[
                      styles.commentTimelineIndicator,
                      { left: `${position}%` }
                    ]}
                  />
                );
              })}
            </View>

            {/* Comment markers below with connecting lines */}
            {timelineComments.length > 0 && (
              <View style={styles.commentSection}>
                {/* Connecting lines from timeline to comments */}
                <View style={styles.commentLinesContainer}>
                  {timelineComments.map((comment, index) => {
                    const position = duration > 0 ? ((comment.timestamp_ms || 0) / duration) * 100 : 0;
                    // Calculate horizontal position for the comment bubble (evenly spaced)
                    const bubblePosition = (index / Math.max(timelineComments.length - 1, 1)) * 100;
                    return (
                      <View
                        key={`line-${comment.id}`}
                        style={[
                          styles.commentLine,
                          {
                            left: `${position}%`,
                            width: Math.abs(position - bubblePosition) + '%',
                            transform: [
                              { translateX: position > bubblePosition ? -Math.abs(position - bubblePosition) : 0 }
                            ]
                          }
                        ]}
                      />
                    );
                  })}
                </View>

                {/* Comment bubbles in scrollable row */}
                <ScrollView
                  horizontal
                  style={styles.commentMarkersScroll}
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.commentMarkersContent}
                >
                  {timelineComments.map((comment, index) => {
                    const isSelected = selectedComment?.id === comment.id;
                    return (
                      <TouchableOpacity
                        key={comment.id}
                        style={[
                          styles.commentMarker,
                          isSelected && styles.commentMarkerSelected
                        ]}
                        onPress={() => handleCommentTap(comment)}
                      >
                        <Ionicons
                          name="chatbubble"
                          size={16}
                          color={isSelected ? '#8B5CF6' : Colors.primary}
                        />
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            )}
          </View>

          {/* Time Display */}
          <View style={styles.timeDisplay}>
            <Text style={styles.timeText}>{formatTime(currentPosition)}</Text>
            <Text style={styles.timeText}>{formatTime(duration)}</Text>
          </View>

          {/* Transport Controls with Comment and Edit buttons */}
          <View style={styles.transportButtons}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={openTimelineCommentModal}
            >
              <Ionicons name="chatbubble-outline" size={22} color={Colors.primary} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.seekButton}
              onPress={() => skipTime(-10)}
              disabled={!selectedTrack}
            >
              <Ionicons name="play-back" size={16} color={selectedTrack ? Colors.text : Colors.textSecondary} />
              <Text style={[styles.seekButtonText, { color: selectedTrack ? Colors.text : Colors.textSecondary }]}>10</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.playButton, !selectedTrack && styles.playButtonDisabled]}
              onPress={togglePlayback}
              disabled={!selectedTrack || isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color={Colors.text} />
              ) : (
                <Ionicons name={isPlaying ? 'pause' : 'play'} size={20} color={Colors.text} />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.seekButton}
              onPress={() => skipTime(10)}
              disabled={!selectedTrack}
            >
              <Ionicons name="play-forward" size={16} color={selectedTrack ? Colors.text : Colors.textSecondary} />
              <Text style={[styles.seekButtonText, { color: selectedTrack ? Colors.text : Colors.textSecondary }]}>10</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={openEditModal}
            >
              <Ionicons name="create-outline" size={22} color={Colors.primary} />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Footer - Tab Navigation Only */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'track' && styles.tabButtonActive]}
          onPress={() => setActiveTab('track')}
        >
          <Ionicons
            name="musical-notes"
            size={20}
            color={activeTab === 'track' ? Colors.primary : Colors.textSecondary}
          />
          <Text style={[
            styles.tabButtonText,
            activeTab === 'track' && styles.tabButtonTextActive
          ]}>
            Tracks
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'nearby' && styles.tabButtonActive]}
          onPress={() => setActiveTab('nearby')}
        >
          <Ionicons
            name="radio"
            size={20}
            color={activeTab === 'nearby' ? Colors.primary : Colors.textSecondary}
          />
          <Text style={[
            styles.tabButtonText,
            activeTab === 'nearby' && styles.tabButtonTextActive
          ]}>
            Nearby
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'chat' && styles.tabButtonActive]}
          onPress={() => setActiveTab('chat')}
        >
          <Ionicons
            name="chatbubbles"
            size={20}
            color={activeTab === 'chat' ? Colors.primary : Colors.textSecondary}
          />
          <Text style={[
            styles.tabButtonText,
            activeTab === 'chat' && styles.tabButtonTextActive
          ]}>
            Chat
          </Text>
        </TouchableOpacity>
      </View>

      {/* Chat Modal */}
      <Modal
        visible={showCommentModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowCommentModal(false)}>
              <Text style={styles.modalCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>New Message</Text>
            <TouchableOpacity
              onPress={addChatMessage}
              disabled={!newComment.trim()}
            >
              <Text style={[
                styles.modalDone,
                !newComment.trim() && styles.modalDoneDisabled
              ]}>
                Send
              </Text>
            </TouchableOpacity>
          </View>
          <View style={styles.modalContent}>
            <TextInput
              style={styles.messageInput}
              placeholder="Type your message..."
              placeholderTextColor={Colors.textSecondary}
              value={newComment}
              onChangeText={setNewComment}
              multiline
              autoFocus
            />
          </View>
        </SafeAreaView>
      </Modal>

      {/* Timeline Comment Modal - Create new comment */}
      <Modal
        visible={showTimelineCommentModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => {
              setShowTimelineCommentModal(false);
              setNewComment('');
            }}>
              <Text style={styles.modalCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Add Comment</Text>
            <TouchableOpacity
              onPress={() => addTimelineComment(newComment)}
              disabled={!newComment.trim()}
            >
              <Text style={[
                styles.modalDone,
                !newComment.trim() && styles.modalDoneDisabled
              ]}>
                Save
              </Text>
            </TouchableOpacity>
          </View>
          <View style={styles.modalContent}>
            <Text style={styles.timestampText}>
              At {formatTime(commentTimestamp)}
            </Text>
            <TextInput
              style={styles.messageInput}
              placeholder="Add your comment..."
              placeholderTextColor={Colors.textSecondary}
              value={newComment}
              onChangeText={setNewComment}
              multiline
              autoFocus
            />
          </View>
        </SafeAreaView>
      </Modal>

      {/* View Comment Modal - View/Edit/Delete existing comment */}
      <Modal
        visible={showViewCommentModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => {
              setShowViewCommentModal(false);
              setSelectedComment(null);
              setEditingComment(false);
            }}>
              <Text style={styles.modalCancel}>Close</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Comment</Text>
            {editingComment && (
              <TouchableOpacity
                onPress={updateComment}
                disabled={!editCommentText.trim()}
              >
                <Text style={[
                  styles.modalDone,
                  !editCommentText.trim() && styles.modalDoneDisabled
                ]}>
                  Save
                </Text>
              </TouchableOpacity>
            )}
          </View>
          <View style={styles.modalContent}>
            {selectedComment && (
              <>
                <Text style={styles.timestampText}>
                  At {formatTime(selectedComment.timestamp_ms || 0)}
                </Text>
                <Text style={styles.commentAuthorText}>
                  By {selectedComment.users.display_name || selectedComment.users.username}
                </Text>

                {editingComment ? (
                  <TextInput
                    style={styles.messageInput}
                    placeholder="Edit comment..."
                    placeholderTextColor={Colors.textSecondary}
                    value={editCommentText}
                    onChangeText={setEditCommentText}
                    multiline
                    autoFocus
                  />
                ) : (
                  <View style={styles.commentContentBox}>
                    <Text style={styles.commentContentText}>{selectedComment.content}</Text>
                  </View>
                )}

                <View style={styles.commentActions}>
                  <TouchableOpacity
                    style={styles.commentActionButton}
                    onPress={playFromComment}
                  >
                    <Ionicons name="play-circle-outline" size={20} color={Colors.primary} />
                    <Text style={styles.commentActionText}>Play from here</Text>
                  </TouchableOpacity>

                  {selectedComment.user_id === user?.id && !editingComment && (
                    <>
                      <TouchableOpacity
                        style={styles.commentActionButton}
                        onPress={() => setEditingComment(true)}
                      >
                        <Ionicons name="create-outline" size={20} color={Colors.primary} />
                        <Text style={styles.commentActionText}>Edit</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.commentActionButton, styles.deleteActionButton]}
                        onPress={() => {
                          Alert.alert(
                            'Delete Comment',
                            'Are you sure you want to delete this comment?',
                            [
                              { text: 'Cancel', style: 'cancel' },
                              {
                                text: 'Delete',
                                style: 'destructive',
                                onPress: deleteComment
                              }
                            ]
                          );
                        }}
                      >
                        <Ionicons name="trash-outline" size={20} color="#EF4444" />
                        <Text style={[styles.commentActionText, { color: '#EF4444' }]}>Delete</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              </>
            )}
          </View>
        </SafeAreaView>
      </Modal>

      {/* Edit Audio Modal */}
      <Modal
        visible={showEditModal}
        animationType="slide"
        presentationStyle="fullScreen"
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowEditModal(false)}>
              <Text style={styles.modalCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Edit Audio</Text>
            <TouchableOpacity onPress={saveAudioEdits}>
              <Text style={styles.modalDone}>Save</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalContent}>
            <Text style={styles.editSectionTitle}>Audio File Details</Text>

            {/* File Name */}
            <View style={styles.editField}>
              <Text style={styles.editLabel}>File Name</Text>
              <TextInput
                style={styles.editInput}
                value={editedFileName}
                onChangeText={setEditedFileName}
                placeholder="Enter file name"
                placeholderTextColor={Colors.textSecondary}
              />
            </View>

            {/* Audio Type */}
            <View style={styles.editField}>
              <Text style={styles.editLabel}>Audio Type</Text>
              <Text style={styles.editHint}>Tap to select audio type</Text>
              <View style={styles.audioTypeGrid}>
                {['vocals', 'drums', 'bass', 'guitar', 'keys', 'synth', 'fx', 'full_mix'].map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.audioTypeButton,
                      editedAudioType === type && styles.audioTypeButtonActive
                    ]}
                    onPress={() => setEditedAudioType(type)}
                  >
                    <Text style={[
                      styles.audioTypeText,
                      editedAudioType === type && styles.audioTypeTextActive
                    ]}>
                      {type.replace('_', ' ')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Trim Section */}
            <View style={styles.editField}>
              <Text style={styles.editLabel}>Trim Audio</Text>
              <Text style={styles.editHint}>Set start and end times (mm:ss)</Text>
              <View style={styles.trimInputs}>
                <View style={styles.trimInputGroup}>
                  <Text style={styles.trimInputLabel}>Start</Text>
                  <TextInput
                    style={styles.trimInput}
                    value={trimStart}
                    onChangeText={setTrimStart}
                    placeholder="0:00"
                    placeholderTextColor={Colors.textSecondary}
                  />
                </View>
                <Text style={styles.trimSeparator}>—</Text>
                <View style={styles.trimInputGroup}>
                  <Text style={styles.trimInputLabel}>End</Text>
                  <TextInput
                    style={styles.trimInput}
                    value={trimEnd}
                    onChangeText={setTrimEnd}
                    placeholder={formatTime(selectedTrack?.duration_ms || 0)}
                    placeholderTextColor={Colors.textSecondary}
                  />
                </View>
              </View>
            </View>

            {/* Delete Button */}
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={() => {
                Alert.alert(
                  'Delete Audio File',
                  'Are you sure you want to delete this audio file? This action cannot be undone.',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Delete',
                      style: 'destructive',
                      onPress: deleteAudioFile
                    }
                  ]
                );
              }}
            >
              <Ionicons name="trash-outline" size={20} color="#EF4444" />
              <Text style={styles.deleteButtonText}>Delete Audio File</Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.backgroundDark,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    ...Typography.body,
    color: Colors.text,
    marginTop: Spacing.md,
  },

  // Main Content - Scrollable tracks list
  mainTracksList: {
    flex: 1,
  },

  // Minimized Player - Spotify-style bar
  minimizedPlayer: {
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
  },
  minimizedHandle: {
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    paddingTop: Spacing.md,
  },
  minimizedHandleBar: {
    width: 40,
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 2,
  },
  minimizedContentWrapper: {
    paddingBottom: Spacing.sm,
  },
  minimizedContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    gap: Spacing.md,
  },
  minimizedColorBar: {
    width: 3,
    height: 44,
    borderRadius: 1.5,
  },
  minimizedInfo: {
    flex: 1,
  },
  minimizedTrackName: {
    ...Typography.body,
    color: Colors.text,
    fontWeight: '600',
    fontSize: 15,
    marginBottom: 3,
  },
  minimizedStemType: {
    ...Typography.caption,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    fontSize: 11,
    letterSpacing: 0.6,
  },
  minimizedPlayButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  minimizedProgressBar: {
    height: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  minimizedProgressFill: {
    height: '100%',
    backgroundColor: Colors.primary,
  },

  // Maximized Player - Full controls
  maximizedPlayer: {
    backgroundColor: Colors.surface,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
    minHeight: 280,
  },
  minimizeHandle: {
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.md,
    marginTop: -Spacing.md,
  },
  minimizeBar: {
    width: 40,
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 2,
  },
  actionButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  maximizedTrackInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  maximizedColorBar: {
    width: 4,
    height: 48,
    borderRadius: 2,
    marginRight: Spacing.lg,
  },
  maximizedTrackText: {
    flex: 1,
  },
  maximizedTrackName: {
    ...Typography.h3,
    color: Colors.text,
    fontWeight: '700',
    marginBottom: 4,
    fontSize: 18,
  },
  maximizedStemType: {
    ...Typography.body,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    fontSize: 11,
    letterSpacing: 0.8,
    fontWeight: '600',
  },

  // Timeline with comments
  timelineContainer: {
    marginBottom: Spacing.sm,
  },
  commentTimelineIndicator: {
    position: 'absolute',
    top: -4,
    width: 3,
    height: 11,
    backgroundColor: Colors.primary,
    borderRadius: 1.5,
    marginLeft: -1.5,
  },
  commentSection: {
    marginTop: Spacing.md,
  },
  commentLinesContainer: {
    position: 'relative',
    height: 24,
    marginBottom: Spacing.xs,
  },
  commentLine: {
    position: 'absolute',
    top: 0,
    height: 24,
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(99, 102, 241, 0.4)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(99, 102, 241, 0.4)',
    borderBottomLeftRadius: 8,
  },
  commentMarkersScroll: {
    maxHeight: 48,
  },
  commentMarkersContent: {
    flexDirection: 'row',
    gap: Spacing.md,
    paddingHorizontal: Spacing.xs,
  },
  commentMarker: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 3,
  },
  commentMarkerSelected: {
    borderColor: '#8B5CF6',
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
    shadowColor: '#8B5CF6',
    transform: [{ scale: 1.15 }],
  },

  // Footer - Tab Navigation Only
  footer: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
    paddingBottom: 20, // Safe area padding
    paddingTop: Spacing.xs,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabButtonActive: {
    borderBottomColor: Colors.primary,
  },
  tabButtonText: {
    ...Typography.body,
    color: Colors.textSecondary,
    fontWeight: '600',
    fontSize: 13,
    letterSpacing: 0.3,
  },
  tabButtonTextActive: {
    color: Colors.primary,
  },

  trackPreview: {
    marginBottom: Spacing.lg,
  },
  nowPlayingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  nowPlayingIndicator: {
    width: 3,
    height: 40,
    borderRadius: 1.5,
    marginRight: Spacing.lg,
  },
  nowPlayingText: {
    flex: 1,
  },
  nowPlayingTitle: {
    ...Typography.h3,
    color: Colors.text,
    fontWeight: '700',
    marginBottom: 2,
  },
  nowPlayingSubtitle: {
    ...Typography.body,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    fontSize: 11,
    letterSpacing: 0.8,
    fontWeight: '600',
  },
  noTrackText: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    paddingVertical: Spacing.md,
    fontStyle: 'italic',
  },
  timeDisplay: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.xs,
  },
  timeText: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontFamily: 'monospace',
    fontWeight: '500',
    fontSize: 11,
  },
  timeSeparator: {
    display: 'none',
  },
  transportButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.xl,
    marginTop: Spacing.lg,
    marginBottom: Spacing.md,
  },
  seekButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  seekButtonText: {
    ...Typography.tiny,
    position: 'absolute',
    bottom: 2,
    fontWeight: '700',
    fontSize: 9,
    color: Colors.textSecondary,
  },
  transportButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  playButtonDisabled: {
    backgroundColor: Colors.border,
    shadowOpacity: 0,
  },
  progressContainer: {
    paddingHorizontal: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  progressBar: {
    height: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 1.5,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.primary,
  },

  emptyTracksState: {
    alignItems: 'center',
    paddingVertical: Spacing.xxxl,
    paddingHorizontal: Spacing.xl,
  },
  emptyStateText: {
    ...Typography.h3,
    color: Colors.textSecondary,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
    fontWeight: '600',
  },
  emptyStateSubtext: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    opacity: 0.7,
  },
  addTrackButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.xxl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginTop: Spacing.xl,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  addTrackButtonText: {
    ...Typography.bodyLarge,
    color: Colors.text,
    fontWeight: '700',
  },
  trackItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    backgroundColor: 'transparent',
    marginHorizontal: Spacing.md,
    marginBottom: 1,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.03)',
  },
  trackItemSelected: {
    backgroundColor: 'rgba(99, 102, 241, 0.08)',
    borderBottomColor: 'rgba(99, 102, 241, 0.2)',
  },
  trackColorIndicator: {
    width: 3,
    height: 44,
    borderRadius: 1.5,
    marginRight: Spacing.lg,
  },
  trackInfo: {
    flex: 1,
  },
  trackName: {
    ...Typography.bodyLarge,
    color: Colors.text,
    fontWeight: '600',
    marginBottom: 3,
    fontSize: 15,
  },
  trackMeta: {
    flexDirection: 'row',
    gap: Spacing.sm,
    alignItems: 'center',
  },
  trackType: {
    ...Typography.caption,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    fontSize: 11,
    letterSpacing: 0.5,
    fontWeight: '600',
  },
  trackDuration: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontSize: 12,
    fontFamily: 'monospace',
  },
  playingIndicator: {
    marginLeft: Spacing.md,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Bottom Tabs
  bottomTabs: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    gap: Spacing.xs,
  },
  tabActive: {
    borderTopWidth: 2,
    borderTopColor: Colors.primary,
  },
  tabText: {
    ...Typography.body,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  tabTextActive: {
    color: Colors.primary,
  },

  // Tab Content
  tabContentContainer: {
    height: 200,
    backgroundColor: Colors.backgroundDark,
  },
  tabContent: {
    flex: 1,
    padding: Spacing.lg,
  },

  // Track Details Tab
  emptyTrackState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xl,
  },
  trackDetails: {
    flex: 1,
  },
  trackHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  trackColorBar: {
    width: 4,
    height: 40,
    borderRadius: 2,
    marginRight: Spacing.md,
  },
  trackHeaderInfo: {
    flex: 1,
  },
  trackTitle: {
    ...Typography.h3,
    color: Colors.text,
    marginBottom: Spacing.xxs,
  },
  trackSubtitle: {
    ...Typography.caption,
    color: Colors.textSecondary,
    textTransform: 'capitalize',
  },
  trackMetadata: {
    gap: Spacing.sm,
  },
  metadataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.xs,
  },
  metadataLabel: {
    ...Typography.body,
    color: Colors.textSecondary,
  },
  metadataValue: {
    ...Typography.body,
    color: Colors.text,
    fontWeight: '500',
  },

  // Chat Tab - Clean messaging UI
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  chatTitle: {
    ...Typography.h3,
    color: Colors.text,
    fontWeight: '700',
  },
  addChatButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },
  chatMessages: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
  },
  messageCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: Colors.primary,
  },
  messageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  messageAuthor: {
    ...Typography.bodyLarge,
    color: Colors.text,
    fontWeight: '700',
  },
  messageDate: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontSize: 11,
  },
  messageContent: {
    ...Typography.body,
    color: Colors.text,
    lineHeight: 20,
  },
  emptyChat: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xxxl,
    paddingHorizontal: Spacing.xl,
  },
  startChatButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginTop: Spacing.lg,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  startChatButtonText: {
    ...Typography.body,
    color: Colors.text,
    fontWeight: '700',
  },

  // Modal
  modalContainer: {
    flex: 1,
    backgroundColor: Colors.backgroundDark,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalCancel: {
    ...Typography.body,
    color: Colors.textSecondary,
  },
  modalTitle: {
    ...Typography.h3,
    color: Colors.text,
  },
  modalDone: {
    ...Typography.body,
    color: Colors.primary,
    fontWeight: '600',
  },
  modalDoneDisabled: {
    color: Colors.textSecondary,
  },
  modalContent: {
    flex: 1,
    padding: Spacing.lg,
  },
  messageInput: {
    ...Typography.body,
    color: Colors.text,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    minHeight: 120,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: Colors.border,
  },

  // Timeline Comment Modal
  timestampText: {
    ...Typography.bodyLarge,
    color: Colors.primary,
    fontWeight: '600',
    marginBottom: Spacing.md,
    textAlign: 'center',
  },
  commentAuthorText: {
    ...Typography.body,
    color: Colors.textSecondary,
    marginBottom: Spacing.lg,
    textAlign: 'center',
  },
  commentContentBox: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    marginBottom: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  commentContentText: {
    ...Typography.body,
    color: Colors.text,
    lineHeight: 22,
  },
  commentActions: {
    gap: Spacing.md,
  },
  commentActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
  },
  commentActionText: {
    ...Typography.body,
    color: Colors.primary,
    fontWeight: '600',
  },
  deleteActionButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },

  // Edit Audio Modal
  editSectionTitle: {
    ...Typography.h3,
    color: Colors.text,
    fontWeight: '700',
    marginBottom: Spacing.lg,
  },
  editField: {
    marginBottom: Spacing.xl,
  },
  editLabel: {
    ...Typography.bodyLarge,
    color: Colors.text,
    fontWeight: '600',
    marginBottom: Spacing.xs,
  },
  editHint: {
    ...Typography.caption,
    color: Colors.textSecondary,
    marginBottom: Spacing.md,
  },
  editInput: {
    ...Typography.body,
    color: Colors.text,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  audioTypeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  audioTypeButton: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  audioTypeButtonActive: {
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    borderColor: Colors.primary,
  },
  audioTypeText: {
    ...Typography.body,
    color: Colors.textSecondary,
    fontWeight: '500',
    textTransform: 'capitalize',
    fontSize: 13,
  },
  audioTypeTextActive: {
    color: Colors.primary,
    fontWeight: '600',
  },
  trimInputs: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.lg,
  },
  trimInputGroup: {
    flex: 1,
    alignItems: 'center',
  },
  trimInputLabel: {
    ...Typography.caption,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: '600',
  },
  trimInput: {
    ...Typography.body,
    color: Colors.text,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    textAlign: 'center',
    fontFamily: 'monospace',
    fontSize: 16,
    width: '100%',
  },
  trimSeparator: {
    ...Typography.h3,
    color: Colors.textSecondary,
    marginTop: 20,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    marginTop: Spacing.xxl,
  },
  deleteButtonText: {
    ...Typography.bodyLarge,
    color: '#EF4444',
    fontWeight: '600',
  },
});