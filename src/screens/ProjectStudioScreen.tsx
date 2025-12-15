// screens/ProjectStudioScreen.tsx
// Single-track playback with tabs for track info and project chat

import React, { useEffect, useState, useRef, useCallback, useMemo, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  TouchableOpacity,
  Dimensions,
  Alert,
  ActivityIndicator,
  TextInput,
  Modal,
  PanResponder,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Colors, Typography, Spacing, BorderRadius } from '../constants/theme';
import { scale } from '../utils/responsive';
import CompactHeader from '../components/CompactHeader';
import ProjectChat from '../components/ProjectChat';
import { AudioTrimmer } from '../services/audioTrimmer';
import { getAudioURL } from '../services/webAudioBpmDetector';
import { BPMDetectorWebView } from '../components/BPMDetectorWebView';

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
  project_id?: string;
  created_by?: string;
  uploader_name?: string;
  // Organization fields
  priority: 'high' | 'medium' | 'low';
  order_index: number;
  is_hidden: boolean;
  // Trim tracking fields
  original_file_path?: string | null;
  is_trimmed?: boolean;
  trim_start_ms?: number | null;
  trim_end_ms?: number | null;
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

type TabType = 'track' | 'chat';

// Memoized Comment Item Component for Performance
const CommentItem = memo(({
  comment,
  isSelected,
  onPress,
  onLongPress,
  formatTime,
  styles,
  Colors
}: any) => (
  <TouchableOpacity
    style={[
      styles.commentBubble,
      isSelected && styles.commentBubbleSelected
    ]}
    onPress={onPress}
    onLongPress={onLongPress}
    activeOpacity={0.7}
  >
    <View style={styles.commentBubbleHeader}>
      <Text style={styles.commentBubbleUsername}>
        {comment.users?.display_name || comment.users?.username || 'Unknown'}
      </Text>
      <View style={styles.commentBubbleTimestamp}>
        <Ionicons name="time-outline" size={12} color={Colors.textTertiary} />
        <Text style={styles.commentBubbleTimestampText}>
          {formatTime(comment.timestamp_ms || 0)}
        </Text>
      </View>
    </View>
    <Text style={styles.commentBubbleContent}>
      {comment.content}
    </Text>
  </TouchableOpacity>
));

export default function ProjectStudioScreen({ route, navigation }: any) {
  const { projectId, projectTitle } = route.params;
  const { user, userProfile } = useAuth();

  // Project & Track State
  const [loading, setLoading] = useState(true);
  const [tracks, setTracks] = useState<AudioTrack[]>([]);
  const [showHiddenTracks, setShowHiddenTracks] = useState(false);
  const [isOrganizeMode, setIsOrganizeMode] = useState(false);
  const [selectedTrack, setSelectedTrack] = useState<AudioTrack | null>(null);
  const [project, setProject] = useState<any>(null);
  const [isCollaborator, setIsCollaborator] = useState(false);

  // Permission state for granular access control
  const [userPermissions, setUserPermissions] = useState({
    canEdit: false,
    canDelete: false,
    canUpload: false,
    canDownload: false,
    canComment: true, // Default true for public viewers
  });

  // Audio Player State
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentPosition, setCurrentPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const playbackInterval = useRef<NodeJS.Timeout | null>(null);
  const bpmDetectorRef = useRef<any>(null);

  // UI State
  const [activeTab, setActiveTab] = useState<TabType>('track');

  // Playback Window State
  const [playerState, setPlayerState] = useState<'closed' | 'minimized' | 'maximized'>('closed');
  const [showEditModal, setShowEditModal] = useState(false);
  const [showTimelineCommentModal, setShowTimelineCommentModal] = useState(false);
  const [showViewCommentModal, setShowViewCommentModal] = useState(false);
  const [commentTimestamp, setCommentTimestamp] = useState(0);
  const [newComment, setNewComment] = useState('');
  const [timelineComments, setTimelineComments] = useState<Comment[]>([]);
  const [selectedComment, setSelectedComment] = useState<Comment | null>(null);
  const [editingComment, setEditingComment] = useState(false);
  const [editCommentText, setEditCommentText] = useState('');
  const [isCommentsPanelExpanded, setIsCommentsPanelExpanded] = useState(true);

  // Edit Audio State
  const [editedFileName, setEditedFileName] = useState('');
  const [editedAudioType, setEditedAudioType] = useState('');
  const [trimStart, setTrimStart] = useState('0:00');
  const [trimEnd, setTrimEnd] = useState('');

  // BPM Detection State
  const [detectedBPM, setDetectedBPM] = useState<number | null>(null);
  const [isDetectingBPM, setIsDetectingBPM] = useState(false);
  const [manualBPM, setManualBPM] = useState('');
  const [tapTimes, setTapTimes] = useState<number[]>([]);
  const [tapBPM, setTapBPM] = useState<number | null>(null);

  // Track playback positions - remember where each track was paused
  const [trackPositions, setTrackPositions] = useState<{ [key: string]: number }>({});

  // Timeline scrubbing state
  const [isScrubbing, setIsScrubbing] = useState(false);
  const progressBarWidth = useRef(0);
  const progressBarX = useRef(0);
  const minimizedProgressBarWidth = useRef(0);

  // Refs to avoid stale closures in audio callbacks
  const selectedTrackRef = useRef<AudioTrack | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);

  // Keep refs in sync with state
  useEffect(() => {
    selectedTrackRef.current = selectedTrack;
  }, [selectedTrack]);

  useEffect(() => {
    soundRef.current = sound;
  }, [sound]);

  // Configure audio mode for iOS
  useEffect(() => {
    const setupAudioMode = async () => {
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
          staysActiveInBackground: true,
          shouldDuckAndroid: true,
        });
        console.log('Audio mode configured for ProjectStudioScreen');
      } catch (error) {
        console.error('Error setting audio mode:', error);
      }
    };
    setupAudioMode();
  }, []);

  useEffect(() => {
    if (projectId && user?.id) {
      loadProjectData();

      // Set up real-time subscriptions for tracks and comments
      const tracksChannel = supabase
        .channel(`studio-tracks-${projectId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'audio_files',
            filter: `project_id=eq.${projectId}`
          },
          () => {
            loadProjectData();
          }
        )
        .subscribe();

      const commentsChannel = supabase
        .channel(`studio-comments-${projectId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'comments',
            filter: `project_id=eq.${projectId}`
          },
          (payload) => {
            // Only reload comments from OTHER users (skip own changes - we already have optimistic updates)
            const commentUserId = (payload.new as any)?.user_id;
            const isOwnComment = commentUserId === user?.id;

            if (selectedTrack && payload.new && (payload.new as any).audio_file_id === selectedTrack.id && !isOwnComment) {
              loadTimelineComments(selectedTrack.id);
            }
          }
        )
        .subscribe();

      return () => {
        cleanup();
        tracksChannel.unsubscribe();
        commentsChannel.unsubscribe();
      };
    }
  }, [projectId, user?.id, selectedTrack?.id]);

  // Add focus listener to stop audio when navigating away
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', async () => {
      // Stop and cleanup audio when leaving screen
      if (sound) {
        try {
          const status = await sound.getStatusAsync();
          if (status.isLoaded) {
            await sound.stopAsync();
            await sound.unloadAsync();
          }
        } catch (error) {
          // Silently handle cleanup errors
        }
      }
    });

    return unsubscribe;
  }, [navigation, sound]);

  // Reset BPM state when track changes
  useEffect(() => {
    if (selectedTrack) {
      // Load existing BPM from track
      setDetectedBPM(selectedTrack.bpm || null);
      setManualBPM(selectedTrack.bpm?.toString() || '');
      setTapBPM(null);
      setTapTimes([]);
    } else {
      // Reset when modal closes
      setDetectedBPM(null);
      setManualBPM('');
      setTapBPM(null);
      setTapTimes([]);
    }
  }, [selectedTrack]);

  // Auto-minimize comments panel when maximizing playback window
  useEffect(() => {
    if (playerState === 'maximized') {
      setIsCommentsPanelExpanded(false);
    }
  }, [playerState]);

  const cleanup = async () => {
    if (sound) {
      await sound.unloadAsync();
    }
    if (playbackInterval.current) {
      clearInterval(playbackInterval.current);
    }
  };

  const loadProjectData = useCallback(async () => {
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

      // Determine user permissions
      const isOwner = projectData.creator_id === user?.id;

      if (isOwner) {
        // Owner has all permissions
        setIsCollaborator(true);
        setUserPermissions({
          canEdit: true,
          canDelete: true,
          canUpload: true,
          canDownload: true,
          canComment: true,
        });
      } else if (user?.id) {
        // Check if user is a collaborator
        const { data: collaboratorData } = await supabase
          .from('project_collaborators')
          .select('can_edit, can_delete, can_upload, can_download, can_comment')
          .eq('project_id', projectId)
          .eq('user_id', user.id)
          .eq('invitation_status', 'accepted')
          .single();

        if (collaboratorData) {
          // User is a collaborator - use their permissions
          setIsCollaborator(true);
          setUserPermissions({
            canEdit: collaboratorData.can_edit || false,
            canDelete: collaboratorData.can_delete || false,
            canUpload: collaboratorData.can_upload || false,
            canDownload: collaboratorData.can_download || false,
            canComment: collaboratorData.can_comment || false,
          });
        } else if (projectData.is_public) {
          // User is not a collaborator but project is public - view-only with comments
          setIsCollaborator(false);
          setUserPermissions({
            canEdit: false,
            canDelete: false,
            canUpload: false,
            canDownload: false,
            canComment: true,
          });
        } else {
          // User is not a collaborator and project is private - deny access
          Alert.alert(
            'Access Denied',
            'This project is private. You need to be invited to view it.',
            [{ text: 'OK', onPress: () => navigation.goBack() }]
          );
          return;
        }
      } else if (projectData.is_public) {
        // Not logged in but project is public
        setIsCollaborator(false);
        setUserPermissions({
          canEdit: false,
          canDelete: false,
          canUpload: false,
          canDownload: false,
          canComment: true,
        });
      } else {
        // Not logged in and project is private
        Alert.alert(
          'Access Denied',
          'This project is private. You need to be invited to view it.',
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
        return;
      }

      // Load audio tracks with uploader info
      const { data: audioData, error: audioError } = await supabase
        .from('audio_files')
        .select('*, users!audio_files_created_by_fkey(username, display_name)')
        .eq('project_id', projectId)
        .order('updated_at', { ascending: false });

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
        project_id: file.project_id || undefined,
        created_by: file.creator_id || undefined,
        uploader_name: file.users?.display_name || file.users?.username || 'Unknown',
        priority: file.priority || 'medium',
        order_index: file.order_index || 0,
        is_hidden: file.is_hidden || false,
        original_file_path: file.original_file_path || null,
        is_trimmed: file.is_trimmed || false,
        trim_start_ms: file.trim_start_ms || null,
        trim_end_ms: file.trim_end_ms || null,
      }));

      setTracks(formattedTracks);

    } catch (error) {
      Alert.alert('Error', 'Failed to load project');
    } finally {
      setLoading(false);
    }
  }, [projectId, user?.id, navigation]);

  const getStemColor = useCallback((stemType: string | null): string => {
    const stemColors: { [key: string]: string } = {
      vocals: Colors.vocals,
      drums: Colors.drums,
      bass: Colors.bass,
      guitar: Colors.guitar,
      keys: Colors.keys,
      synth: Colors.synth,
      fx: '#00BCD4', // Cyan
      multiple: '#9C27B0', // Purple
      other: '#FFC107', // Amber
    };
    return stemColors[stemType?.toLowerCase() || 'other'] || Colors.primary;
  }, []);

  // Check if current user is project owner
  const isProjectOwner = project?.creator_id === user?.id;

  // Use granular permissions from state
  const canEdit = userPermissions.canEdit;
  const canDelete = userPermissions.canDelete;
  const canUpload = userPermissions.canUpload;
  const canDownload = userPermissions.canDownload;

  // Get visible tracks (filtered and sorted by order_index)
  const visibleTracks = useMemo(() => {
    let filtered = tracks;

    // Filter hidden tracks unless showHiddenTracks is true
    if (!showHiddenTracks) {
      filtered = filtered.filter(track => !track.is_hidden);
    }

    // Sort by order_index only
    return filtered.sort((a, b) => a.order_index - b.order_index);
  }, [tracks, showHiddenTracks]);

  // Get hidden tracks
  const hiddenTracks = useMemo(() => {
    return tracks.filter(track => track.is_hidden);
  }, [tracks]);

  // Calculate progress percentage
  const progressPercentage = useMemo(() => {
    return duration > 0 ? (currentPosition / duration) * 100 : 0;
  }, [currentPosition, duration]);

  // Move track up (swap with track above)
  const moveTrackUp = useCallback(async (trackId: string) => {
    try {
      const currentIndex = visibleTracks.findIndex(t => t.id === trackId);

      if (currentIndex <= 0) return; // Already at top

      const currentTrack = visibleTracks[currentIndex];
      const aboveTrack = visibleTracks[currentIndex - 1];

      // Use visual position as the new order_index (ensures unique values)
      const newCurrentIndex = currentIndex - 1;
      const newAboveIndex = currentIndex;

      // Update database with new position-based order_index values
      await supabase
        .from('audio_files')
        .update({ order_index: newCurrentIndex })
        .eq('id', currentTrack.id);

      await supabase
        .from('audio_files')
        .update({ order_index: newAboveIndex })
        .eq('id', aboveTrack.id);

      // Update local state with new order_index values
      setTracks(prev => prev.map(track => {
        if (track.id === currentTrack.id) return { ...track, order_index: newCurrentIndex };
        if (track.id === aboveTrack.id) return { ...track, order_index: newAboveIndex };
        return track;
      }));
    } catch (error) {
      Alert.alert('Error', 'Failed to move track');
    }
  }, [visibleTracks]);

  // Move track down (swap with track below)
  const moveTrackDown = useCallback(async (trackId: string) => {
    try {
      const currentIndex = visibleTracks.findIndex(t => t.id === trackId);

      if (currentIndex >= visibleTracks.length - 1) return; // Already at bottom

      const currentTrack = visibleTracks[currentIndex];
      const belowTrack = visibleTracks[currentIndex + 1];

      // Use visual position as the new order_index (ensures unique values)
      const newCurrentIndex = currentIndex + 1;
      const newBelowIndex = currentIndex;

      // Update database with new position-based order_index values
      await supabase
        .from('audio_files')
        .update({ order_index: newCurrentIndex })
        .eq('id', currentTrack.id);

      await supabase
        .from('audio_files')
        .update({ order_index: newBelowIndex })
        .eq('id', belowTrack.id);

      // Update local state with new order_index values
      setTracks(prev => prev.map(track => {
        if (track.id === currentTrack.id) return { ...track, order_index: newCurrentIndex };
        if (track.id === belowTrack.id) return { ...track, order_index: newBelowIndex };
        return track;
      }));
    } catch (error) {
      Alert.alert('Error', 'Failed to move track');
    }
  }, [visibleTracks]);

  // Toggle track hidden status
  const toggleTrackHidden = useCallback(async (trackId: string) => {
    try {
      const track = tracks.find(t => t.id === trackId);
      if (!track) return;

      // Check permissions: owner can hide any, others can only hide their own
      if (!isProjectOwner && track.created_by !== user?.id) {
        Alert.alert('Permission Denied', 'You can only hide your own tracks');
        return;
      }

      const newHiddenStatus = !track.is_hidden;

      const { error } = await supabase
        .from('audio_files')
        .update({ is_hidden: newHiddenStatus })
        .eq('id', trackId);

      if (error) throw error;

      // Update local state
      setTracks(prev => prev.map(t =>
        t.id === trackId ? { ...t, is_hidden: newHiddenStatus } : t
      ));
    } catch (error) {
      Alert.alert('Error', 'Failed to update track visibility');
    }
  }, [tracks, isProjectOwner, user?.id]);

  // Use useCallback with refs to avoid stale closures that cause freezing
  const onPlaybackStatusUpdate = useCallback((status: any) => {
    if (status.isLoaded) {
      setCurrentPosition(status.positionMillis || 0);
      setDuration((prevDuration) => status.durationMillis || prevDuration);
      setIsPlaying(status.isPlaying || false);

      // Use refs to get latest values (avoid stale closures)
      const track = selectedTrackRef.current;
      const currentSound = soundRef.current;

      // If track is explicitly trimmed, stop playback at trim end boundary
      // Only apply trim logic if is_trimmed is explicitly true and trim_end_ms is a valid number
      if (track?.is_trimmed === true && typeof track?.trim_end_ms === 'number' && track.trim_end_ms > 0) {
        if (status.positionMillis >= track.trim_end_ms && status.isPlaying) {
          currentSound?.pauseAsync();
          setIsPlaying(false);
          // Reset to trim start
          const trimStart = typeof track.trim_start_ms === 'number' ? track.trim_start_ms : 0;
          currentSound?.setPositionAsync(trimStart);
          setCurrentPosition(trimStart);
        }
      }

      if (status.didJustFinish) {
        // Just stop playback - don't reset position
        // Position will reset when user presses play (handled in togglePlayback)
        setIsPlaying(false);
      }
    }
  }, []);

  const selectTrack = useCallback(async (track: AudioTrack) => {
    try {
      // Check if we're selecting the same track
      const isSameTrack = selectedTrack?.id === track.id;

      // If same track is tapped, do nothing (use play/pause button to control playback)
      if (isSameTrack) {
        return;
      }

      // Save current track's position before switching
      if (selectedTrack && sound) {
        try {
          const status = await sound.getStatusAsync();
          if (status.isLoaded) {
            setTrackPositions(prev => ({
              ...prev,
              [selectedTrack.id]: status.positionMillis || 0
            }));
          }
        } catch (err) {
        }
      }

      // Stop and unload current sound when switching tracks
      if (sound) {
        try {
          const status = await sound.getStatusAsync();
          if (status.isLoaded) {
            await sound.stopAsync();
          }
          await sound.unloadAsync();
        } catch (err) {
        }
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

      // Load the new track (without auto-play - user must press play button)
      await loadTrack(track, savedPosition, false);

      // Load timeline comments for this track
      loadTimelineComments(track.id);
    } catch (error) {
      console.error('Error selecting track:', error);
    }
  }, [selectedTrack, sound, trackPositions, playerState, loadTimelineComments, loadTrack]);

  const loadTrack = useCallback(async (track: AudioTrack, startPosition: number = 0, autoPlay: boolean = false) => {
    try {
      setIsLoading(true);

      // Get signed URL for the track
      const { data, error} = await supabase.storage
        .from('audio-files')
        .createSignedUrl(track.file_path, 3600);

      if (error) throw error;

      // If track is trimmed, adjust start position to respect trim boundaries
      const effectiveStartPosition = track.is_trimmed && track.trim_start_ms
        ? Math.max(track.trim_start_ms, startPosition)
        : startPosition;

      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: data.signedUrl },
        {
          shouldPlay: autoPlay,
          volume: track.volume,
          isLooping: false,
          positionMillis: effectiveStartPosition,
        },
        onPlaybackStatusUpdate
      );

      setSound(newSound);

      // Update playing state if auto-playing
      if (autoPlay) {
        setIsPlaying(true);
      }
    } catch (error: any) {
      console.error('Error loading track:', error);
      // Use fallback duration if loading fails
      setDuration(track.duration_ms || 0);
      Alert.alert(
        'Audio Load Error',
        `Could not load track: ${error.message || 'Unknown error'}. You can still view track info.`
      );
    } finally {
      setIsLoading(false);
    }
  }, [onPlaybackStatusUpdate]);

  const togglePlayback = useCallback(async () => {
    if (!selectedTrack) {
      Alert.alert('No Track Selected', 'Please select a track to play');
      return;
    }

    try {
      if (sound) {
        const status = await sound.getStatusAsync();
        if (status.isLoaded) {
          if (isPlaying) {
            await sound.pauseAsync();
          } else {
            // Check if we're at or near the end of the track - if so, restart from beginning
            const trackDuration = status.durationMillis || 0;
            const currentPos = status.positionMillis || 0;
            const startPosition = selectedTrack.trim_start_ms || 0;

            // Consider "at the end" if within 500ms of the end
            const isAtEnd = trackDuration > 0 && (trackDuration - currentPos) < 500;

            if (isAtEnd) {
              // Reset to beginning (or trim start) before playing
              await sound.setPositionAsync(startPosition);
              setCurrentPosition(startPosition);
            }

            await sound.playAsync();
          }
        } else {
          // Sound exists but not loaded, reload and auto-play
          await loadTrack(selectedTrack, 0, true);
        }
      } else {
        // If no sound loaded, load and auto-play
        await loadTrack(selectedTrack, 0, true);
      }
    } catch (error) {
      Alert.alert('Playback Error', 'Failed to play audio');
    }
  }, [selectedTrack, sound, isPlaying, loadTrack]);

  const stopPlayback = useCallback(async () => {
    try {
      if (sound) {
        await sound.stopAsync();
        setCurrentPosition(0);
      }
    } catch (error) {
    }
  }, [sound]);

  const seekTo = useCallback(async (positionMs: number) => {
    try {
      if (sound) {
        const clampedPosition = Math.max(0, Math.min(duration, positionMs));
        await sound.setPositionAsync(clampedPosition);
        setCurrentPosition(clampedPosition);
      }
    } catch (error) {
    }
  }, [sound, duration]);

  const skipTime = useCallback(async (seconds: number) => {
    const newPosition = currentPosition + (seconds * 1000);
    await seekTo(newPosition);
  }, [currentPosition, seekTo]);

  // Handle timeline scrubbing with touch
  const handleTimelineScrub = useCallback((pageX: number) => {
    if (!duration || progressBarWidth.current === 0) return;

    // Calculate position relative to progress bar
    // pageX is absolute position on screen, we need relative position
    const relativeX = Math.max(0, pageX - progressBarX.current);
    const percentage = Math.max(0, Math.min(1, relativeX / progressBarWidth.current));
    const newPosition = percentage * duration;


    // Update position immediately for visual feedback
    setCurrentPosition(newPosition);

    // Seek in audio
    if (sound) {
      seekTo(newPosition);
    }
  }, [duration, sound, seekTo]);

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

  const formatTime = useCallback((ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }, []);

  const formatDate = useCallback((dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }, []);


  // Load timeline comments for a specific audio file
  const loadTimelineComments = useCallback(async (audioFileId: string) => {
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
      setTimelineComments([]);
    }
  }, []);

  // Add a timeline comment at current timestamp - SIMPLIFIED to prevent freezing
  const addTimelineComment = useCallback(async (content: string) => {
    if (!selectedTrack || !content.trim()) return;

    // Close UI immediately
    setShowTimelineCommentModal(false);
    setNewComment('');

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

      // Reload comments from database
      loadTimelineComments(selectedTrack.id);
    } catch (error) {
      Alert.alert('Error', 'Failed to add comment');
    }
  }, [selectedTrack, projectId, user, commentTimestamp, loadTimelineComments]);

  // View existing comment (don't seek, just highlight and show modal)
  const handleCommentTap = useCallback((comment: Comment) => {
    setSelectedComment(comment);
    setEditingComment(false);
    setEditCommentText(comment.content);
    setShowViewCommentModal(true);
  }, []);

  // Play from comment timestamp
  const playFromComment = useCallback(async () => {
    if (selectedComment && selectedComment.timestamp_ms !== undefined) {
      await seekTo(selectedComment.timestamp_ms);

      // Start playing if not already playing
      if (!isPlaying && sound) {
        try {
          await sound.playAsync();
          setIsPlaying(true);
        } catch (error) {
        }
      }

      setShowViewCommentModal(false);
      setSelectedComment(null);
    }
  }, [selectedComment, seekTo, isPlaying, sound]);

  // Edit comment
  const updateComment = useCallback(async () => {
    if (!selectedComment || !editCommentText.trim()) return;

    try {
      const { error } = await supabase
        .from('comments')
        .update({ content: editCommentText.trim() })
        .eq('id', selectedComment.id);

      if (error) throw error;

      // Update project's updated_at timestamp
      if (project) {
        await supabase
          .from('projects')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', project.id);
      }

      // Reload timeline comments
      if (selectedTrack) {
        loadTimelineComments(selectedTrack.id);
      }
      setShowViewCommentModal(false);
      setSelectedComment(null);
      setEditingComment(false);
    } catch (error) {
      Alert.alert('Error', 'Failed to update comment');
    }
  }, [selectedComment, editCommentText, project, selectedTrack, loadTimelineComments]);

  // Delete comment
  const deleteComment = useCallback(async () => {
    if (!selectedComment) return;

    try {

      const { data, error } = await supabase
        .from('comments')
        .delete()
        .eq('id', selectedComment.id)
        .select();

      if (error) {
        throw error;
      }


      // Update project's updated_at timestamp
      if (project) {
        await supabase
          .from('projects')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', project.id);
      }

      // Update local state immediately
      setTimelineComments(prev => prev.filter(c => c.id !== selectedComment.id));

      setShowViewCommentModal(false);
      setSelectedComment(null);
      Alert.alert('Success', 'Comment deleted successfully');
    } catch (error: any) {
      Alert.alert(
        'Error',
        `Failed to delete comment: ${error.message || 'Unknown error'}. You may not have permission to delete this comment.`
      );
    }
  }, [selectedComment, project]);

  // Open timeline comment modal at current position (create new comment)
  const openTimelineCommentModal = useCallback(() => {
    setNewComment(''); // Clear any previous comment text
    setCommentTimestamp(currentPosition);
    setShowTimelineCommentModal(true);
  }, [currentPosition]);

  // Open edit modal with current track data
  const openEditModal = useCallback(() => {
    if (!selectedTrack) return;
    setEditedFileName(selectedTrack.file_name);
    setEditedAudioType(selectedTrack.stem_type || '');
    setTrimStart('0:00');
    setTrimEnd(formatTime(selectedTrack.duration_ms || 0));
    setShowEditModal(true);
  }, [selectedTrack]);

  // Ref to track which audio file is being analyzed (survives state changes)
  const detectingTrackIdRef = useRef<string | null>(null);

  // Detect BPM for selected track
  const handleDetectBPM = useCallback(async () => {
    if (!selectedTrack) return;

    try {
      setIsDetectingBPM(true);
      // Store the track ID so we can reference it when detection completes
      detectingTrackIdRef.current = selectedTrack.id;

      // Get audio URL (offline-first)
      const { url, method } = await getAudioURL(selectedTrack.id, selectedTrack.file_path);

      // Trigger WebView BPM detection
      bpmDetectorRef.current?.detectBPM(url);

    } catch (error) {
      Alert.alert('Error', 'Failed to detect BPM');
      setIsDetectingBPM(false);
      detectingTrackIdRef.current = null;
    }
  }, [selectedTrack]);

  // Handle BPM detection completion
  const handleBPMDetected = useCallback(async (bpm: number) => {
    const trackId = detectingTrackIdRef.current;

    // Always reset detecting state first
    setIsDetectingBPM(false);
    detectingTrackIdRef.current = null;

    if (!trackId) {
      console.warn('BPM detected but no track ID stored');
      return;
    }

    try {
      setDetectedBPM(bpm);

      // Update database using the stored track ID
      const { error } = await supabase
        .from('audio_files')
        .update({
          bpm,
          updated_at: new Date().toISOString()
        })
        .eq('id', trackId);

      if (error) throw error;

      // Also update project's updated_at timestamp
      if (project) {
        await supabase
          .from('projects')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', project.id);
      }

      // Update local tracks array
      setTracks(prevTracks =>
        prevTracks.map(track =>
          track.id === trackId ? { ...track, bpm } : track
        )
      );

      // Update selected track if it's still the same one
      setSelectedTrack(prev => prev?.id === trackId ? { ...prev, bpm } : prev);

      Alert.alert('BPM Detected', `${bpm} BPM`);
    } catch (error) {
      console.error('Error saving BPM:', error);
      Alert.alert('Error', 'BPM detected but failed to save');
    }
  }, [project]);

  // Handle BPM detection error
  const handleBPMError = useCallback((error: string) => {
    console.error('BPM detection error:', error);
    setIsDetectingBPM(false);
    detectingTrackIdRef.current = null;
    Alert.alert('Error', 'Failed to detect BPM: ' + error);
  }, []);

  // Handle manual BPM input
  const handleManualBPMSave = useCallback(async () => {
    if (!selectedTrack || !manualBPM.trim()) return;

    const bpmValue = parseInt(manualBPM, 10);
    if (isNaN(bpmValue) || bpmValue < 20 || bpmValue > 300) {
      Alert.alert('Invalid BPM', 'Please enter a BPM between 20 and 300');
      return;
    }

    try {
      const { error } = await supabase
        .from('audio_files')
        .update({
          bpm: bpmValue,
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedTrack.id);

      if (error) throw error;

      // Also update project's updated_at timestamp
      if (project) {
        await supabase
          .from('projects')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', project.id);
      }

      setTracks(prevTracks =>
        prevTracks.map(track =>
          track.id === selectedTrack.id ? { ...track, bpm: bpmValue } : track
        )
      );

      setSelectedTrack(prev => prev ? { ...prev, bpm: bpmValue } : prev);
      setDetectedBPM(bpmValue);

      Alert.alert('Success', `BPM set to ${bpmValue}`);
    } catch (error) {
      Alert.alert('Error', 'Failed to save BPM');
    }
  }, [selectedTrack, manualBPM, project]);

  // Handle tap tempo
  const handleTapTempo = useCallback(() => {
    const now = Date.now();
    const newTaps = [...tapTimes, now].slice(-8); // Keep last 8 taps
    setTapTimes(newTaps);

    if (newTaps.length >= 2) {
      // Calculate average interval between taps
      const intervals: number[] = [];
      for (let i = 1; i < newTaps.length; i++) {
        intervals.push(newTaps[i] - newTaps[i - 1]);
      }

      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const bpm = Math.round(60000 / avgInterval);

      if (bpm >= 20 && bpm <= 300) {
        setTapBPM(bpm);
        setManualBPM(bpm.toString());
      }
    }

    // Reset taps after 3 seconds of inactivity
    setTimeout(() => {
      setTapTimes(prev => {
        const filtered = prev.filter(t => Date.now() - t < 3000);
        if (filtered.length < 2) {
          setTapBPM(null);
        }
        return filtered;
      });
    }, 3000);
  }, [tapTimes]);

  // Save audio file edits
  const saveAudioEdits = useCallback(async () => {
    if (!selectedTrack || !user) return;

    try {
      const trackId = selectedTrack.id;

      // Parse trim times
      const trimStartMs = AudioTrimmer.parseTimeToMs(trimStart);
      const trimEndMs = AudioTrimmer.parseTimeToMs(trimEnd);
      const originalDurationMs = selectedTrack.duration_ms || 0;

      // Check if user wants to trim by comparing against original duration
      // Trim if: start is not 0:00 OR end is not at the original duration
      const hasStartTrim = trimStartMs > 100; // Allow 100ms tolerance
      const hasEndTrim = trimEndMs > 0 && Math.abs(trimEndMs - originalDurationMs) > 100; // Allow 100ms tolerance
      const wantsToTrim = hasStartTrim || hasEndTrim;

      // Prepare update data
      const updateData: any = {
        file_name: editedFileName,
        stem_type: editedAudioType,
        updated_at: new Date().toISOString(),
      };

      // If trimming is requested, save trim metadata (non-destructive editing)
      // The audio player will respect these trim boundaries during playback
      if (wantsToTrim && projectId) {

        // Store the original file path if this is the first trim
        updateData.original_file_path = selectedTrack.is_trimmed
          ? selectedTrack.original_file_path  // Keep original if already trimmed
          : selectedTrack.file_path;          // Store current as original
        updateData.is_trimmed = true;
        updateData.trim_start_ms = trimStartMs;
        updateData.trim_end_ms = trimEndMs;

      } else {
      }

      // Update database
      const { data, error } = await supabase
        .from('audio_files')
        .update(updateData)
        .eq('id', trackId)
        .select();


      if (error) {
        throw error;
      }

      // Check if update actually affected any rows
      if (!data || data.length === 0) {

        // Debug: Check if user is a collaborator
        const { data: collabCheck } = await supabase
          .from('project_collaborators')
          .select('*')
          .eq('project_id', selectedTrack.project_id)
          .eq('user_id', user.id);


        throw new Error('Update failed - no rows affected. You may not have permission to edit this file.');
      }


      // Update project's updated_at timestamp
      if (project) {
        await supabase
          .from('projects')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', project.id);
      }

      // Update local state
      const updatedTrack = {
        ...selectedTrack,
        ...updateData,
      };

      setTracks(prevTracks =>
        prevTracks.map(track =>
          track.id === trackId ? updatedTrack : track
        )
      );

      setSelectedTrack(updatedTrack);

      // If we trimmed the audio, reload the player to apply trim boundaries
      if (wantsToTrim && sound) {
        await sound.unloadAsync();
        await loadTrack(updatedTrack);
      }

      setShowEditModal(false);

      Alert.alert('Success', 'Audio file updated successfully');
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to update audio file');
    }
  }, [selectedTrack, user, trimStart, trimEnd, editedFileName, editedAudioType, projectId, project, sound, loadTrack]);

  // Revert to original audio file
  const revertToOriginal = async () => {
    if (!selectedTrack || !selectedTrack.is_trimmed || !selectedTrack.original_file_path) {
      Alert.alert('Error', 'No original file to revert to');
      return;
    }

    Alert.alert(
      'Revert to Original',
      'Are you sure you want to revert to the original audio file? This will discard all trim edits.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Revert',
          style: 'destructive',
          onPress: async () => {
            try {

              // Update database to point back to original file
              const { data, error } = await supabase
                .from('audio_files')
                .update({
                  file_path: selectedTrack.original_file_path,
                  is_trimmed: false,
                  trim_start_ms: null,
                  trim_end_ms: null,
                  original_file_path: null,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', selectedTrack.id)
                .select();

              if (error) throw error;

              // Update project's updated_at timestamp
              if (project) {
                await supabase
                  .from('projects')
                  .update({ updated_at: new Date().toISOString() })
                  .eq('id', project.id);
              }

              if (!data || data.length === 0) {
                throw new Error('Failed to revert - no rows affected');
              }


              // Update local state
              const updatedTrack = {
                ...selectedTrack,
                file_path: selectedTrack.original_file_path,
                is_trimmed: false,
                trim_start_ms: null,
                trim_end_ms: null,
                original_file_path: null,
              };

              setTracks(prevTracks =>
                prevTracks.map(track =>
                  track.id === selectedTrack.id ? updatedTrack : track
                )
              );

              setSelectedTrack(updatedTrack);

              // Reload the audio player with original file
              if (sound) {
                await sound.unloadAsync();
                const { sound: newSound } = await Audio.Sound.createAsync(
                  { uri: selectedTrack.original_file_path },
                  { shouldPlay: false }
                );
                setSound(newSound);
              }

              setShowEditModal(false);

              Alert.alert('Success', 'Reverted to original audio file');
            } catch (error) {
              Alert.alert('Error', error instanceof Error ? error.message : 'Failed to revert to original');
            }
          },
        },
      ]
    );
  };

  // Delete audio file
  const downloadAudioFile = async () => {
    if (!selectedTrack) return;

    try {
      // Check if user has download permission
      if (!canDownload) {
        Alert.alert(
          'Access Denied',
          'You do not have permission to download audio files from this project.'
        );
        return;
      }

      Alert.alert('Downloading', 'Preparing your audio file...');

      // Get the signed URL with download option
      const { data, error: urlError } = await supabase.storage
        .from('audio-files')
        .createSignedUrl(selectedTrack.file_path, 60); // 60 second expiry

      if (urlError || !data?.signedUrl) {
        throw new Error('Failed to generate download URL');
      }

      // Create a local file path
      const fileName = selectedTrack.file_name || 'audio-file.mp3';
      const fileUri = FileSystem.documentDirectory + fileName;


      // Download the file
      const downloadResult = await FileSystem.downloadAsync(data.signedUrl, fileUri);


      if (downloadResult.status === 200) {
        // Check if sharing is available
        const canShare = await Sharing.isAvailableAsync();

        if (canShare) {
          // Share the file (which allows user to save it)
          await Sharing.shareAsync(downloadResult.uri, {
            mimeType: selectedTrack.stem_type?.includes('audio') ? 'audio/*' : 'audio/mpeg',
            dialogTitle: 'Save Audio File',
            UTI: 'public.audio'
          });

          Alert.alert('Success', 'Audio file ready to save!');
        } else {
          Alert.alert('Downloaded', `File saved to: ${downloadResult.uri}`);
        }
      } else {
        throw new Error(`Download failed with status: ${downloadResult.status}`);
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to download audio file. Please try again.');
    }
  };

  const deleteAudioFile = async () => {
    if (!selectedTrack) return;

    try {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('audio-files')
        .remove([selectedTrack.file_path]);


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
      {/* Hidden WebView for BPM Detection */}
      <BPMDetectorWebView
        ref={bpmDetectorRef}
        onDetectionComplete={handleBPMDetected}
        onError={handleBPMError}
      />

      <CompactHeader
        title={project?.title || projectTitle}
        subtitle="Project Studio"
        onBack={() => navigation.goBack()}
      />

      {/* Public Viewer Hint */}
      {!isCollaborator && project?.is_public && (
        <View style={styles.publicViewerHint}>
          <Ionicons name="eye-outline" size={16} color={Colors.textSecondary} />
          <Text style={styles.publicViewerHintText}>
            You're viewing a public project. Play and listen only.
          </Text>
        </View>
      )}

      {/* Split Action Bar - Owner Only */}
      {activeTab === 'track' && isProjectOwner && (
        <View style={styles.splitActionSection}>
          <View style={styles.splitActionBar}>
            <TouchableOpacity
              style={styles.splitActionLeft}
              onPress={() => {
                if (isOrganizeMode) {
                  setIsOrganizeMode(false);
                } else {
                  setIsOrganizeMode(true);
                }
              }}
              activeOpacity={0.7}
            >
              <Ionicons
                name={isOrganizeMode ? "checkmark-circle" : "grid-outline"}
                size={20}
                color={isOrganizeMode ? Colors.success : Colors.primary}
              />
              <Text style={[
                styles.splitActionText,
                isOrganizeMode && styles.splitActionTextActive
              ]}>
                {isOrganizeMode ? 'Done' : 'Organize'}
              </Text>
            </TouchableOpacity>
            {canUpload && (
              <>
                <View style={styles.splitActionDivider} />
                <TouchableOpacity
                  style={styles.splitActionRight}
                  onPress={() => navigation.navigate('AudioUpload', { projectId })}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name="add-circle-outline"
                    size={20}
                    color={Colors.primary}
                  />
                  <Text style={styles.splitActionText}>
                    Add Track
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      )}

      {/* Main Content - Tabbed Views */}
      {activeTab === 'track' && (
        <ScrollView
          style={styles.mainTracksList}
          contentContainerStyle={styles.tracksListContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {tracks.length === 0 ? (
            <View style={styles.emptyTracksState}>
              <Ionicons name="musical-notes-outline" size={48} color={Colors.textSecondary} />
              <Text style={styles.emptyStateText}>No tracks yet</Text>
              <Text style={styles.emptyStateSubtext}>
                {canUpload ? 'Add audio files to get started' : 'No audio files have been added to this project'}
              </Text>
              {canUpload && (
                <TouchableOpacity
                  style={styles.addTrackButton}
                  onPress={() => navigation.navigate('AudioUpload', { projectId })}
                >
                  <Text style={styles.addTrackButtonText}>Add Track</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <>
              {/* All Tracks - Flat List */}
              {visibleTracks.map((track, index) => (
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
                    <Text style={[
                      styles.trackUploader,
                      track.created_by === user?.id && styles.trackUploaderYou
                    ]}>
                      {track.created_by === user?.id ? 'You' : track.uploader_name}
                    </Text>
                    <Text style={styles.trackMetaSeparator}>•</Text>
                    <Text style={styles.trackType}>{track.stem_type}</Text>
                    <Text style={styles.trackMetaSeparator}>•</Text>
                    <Text style={styles.trackDuration}>{formatTime(track.duration_ms || 0)}</Text>
                    {track.bpm && (
                      <>
                        <Text style={styles.trackMetaSeparator}>•</Text>
                        <Text style={styles.trackBPM}>{track.bpm} BPM</Text>
                      </>
                    )}
                  </View>
                </View>

                {/* Playing Indicator - Top Right */}
                {!isOrganizeMode && selectedTrack?.id === track.id && (
                  <View style={styles.playingIndicator}>
                    <Ionicons
                      name={isPlaying ? "volume-high" : "pause"}
                      size={14}
                      color={Colors.primary}
                    />
                  </View>
                )}

                {/* Organize Mode Controls */}
                {isOrganizeMode && isProjectOwner && (
                  <View style={styles.organizeControls}>
                    {/* Up Button */}
                    {index > 0 && (
                      <TouchableOpacity
                        style={styles.moveButton}
                        onPress={() => moveTrackUp(track.id)}
                      >
                        <Ionicons name="chevron-up" size={20} color={Colors.primary} />
                      </TouchableOpacity>
                    )}

                    {/* Down Button */}
                    {index < visibleTracks.length - 1 && (
                      <TouchableOpacity
                        style={styles.moveButton}
                        onPress={() => moveTrackDown(track.id)}
                      >
                        <Ionicons name="chevron-down" size={20} color={Colors.primary} />
                      </TouchableOpacity>
                    )}

                    {/* Hide Button */}
                    <TouchableOpacity
                      style={styles.hideButton}
                      onPress={() => toggleTrackHidden(track.id)}
                    >
                      <Ionicons
                        name={track.is_hidden ? "eye-off" : "eye"}
                        size={18}
                        color={Colors.textSecondary}
                      />
                    </TouchableOpacity>
                  </View>
                )}
              </TouchableOpacity>
              ))}

              {/* Hidden Tracks Section */}
              {hiddenTracks.length > 0 && (
                <View style={styles.hiddenTracksSection}>
                  <TouchableOpacity
                    style={styles.showHiddenButton}
                    onPress={() => setShowHiddenTracks(!showHiddenTracks)}
                  >
                    <Ionicons
                      name={showHiddenTracks ? "chevron-up" : "chevron-down"}
                      size={16}
                      color={Colors.textSecondary}
                    />
                    <Text style={styles.showHiddenButtonText}>
                      {showHiddenTracks ? 'Hide' : 'Show'} Hidden Files ({hiddenTracks.length})
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </>
          )}
        </ScrollView>
      )}

      {/* Chat Tab Content - iMessage-style Project Chat - Only for collaborators */}
      {activeTab === 'chat' && user && isCollaborator && (
        <ProjectChat
          projectId={projectId}
          currentUserId={user.id}
          currentUserName={user.email || 'Unknown'}
        />
      )}

      {/* Minimized Player - Spotify-style bar */}
      {selectedTrack && playerState === 'minimized' && activeTab === 'track' && (
        <View style={styles.minimizedPlayer}>
          {/* Maximize Handle */}
          <TouchableOpacity
            style={styles.minimizedHandle}
            onPress={() => setPlayerState('maximized')}
            activeOpacity={0.6}
          >
            <Ionicons name="chevron-up" size={16} color="rgba(255, 255, 255, 0.25)" />
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
          <View
            style={styles.minimizedProgressBar}
            onLayout={(event) => {
              const { width } = event.nativeEvent.layout;
              minimizedProgressBarWidth.current = width;
            }}
          >
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={(e) => {
                e.stopPropagation();
                const locationX = e.nativeEvent.locationX;

                if (minimizedProgressBarWidth.current > 0 && duration > 0) {
                  const percentage = Math.max(0, Math.min(1, locationX / minimizedProgressBarWidth.current));
                  const newPosition = percentage * duration;

                  seekTo(newPosition);
                }
              }}
              style={styles.minimizedProgressBarTouchable}
            >
              <View
                style={[
                  styles.minimizedProgressFill,
                  { width: `${progressPercentage}%` },
                ]}
              />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Maximized Player - Full Screen Modal */}
      <Modal
        visible={selectedTrack !== null && playerState === 'maximized' && activeTab === 'track'}
        animationType="slide"
        presentationStyle="fullScreen"
      >
        <SafeAreaView style={styles.maximizedPlayerModal}>
          <ScrollView style={styles.maximizedPlayerScroll} contentContainerStyle={styles.maximizedPlayerContent}>
          {selectedTrack && (
            <>
          {/* Minimize Handle */}
          <View style={styles.minimizeHandleContainer}>
            <TouchableOpacity
              style={styles.minimizeHandle}
              onPress={() => {
                // Dismiss keyboard first to prevent touch issues after modal closes
                Keyboard.dismiss();
                // Reset all modal/overlay states when minimizing
                setShowTimelineCommentModal(false);
                setNewComment('');
                setShowViewCommentModal(false);
                setSelectedComment(null);
                setEditingComment(false);
                setShowEditModal(false);
                setPlayerState('minimized');
              }}
              activeOpacity={0.6}
            >
              <Ionicons name="chevron-down" size={18} color="rgba(255, 255, 255, 0.25)" />
            </TouchableOpacity>
          </View>

          {/* Track Info with Edit Button */}
          <View style={styles.maximizedTrackInfoContainer}>
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
                <View style={styles.maximizedMetaRow}>
                  <Text style={styles.maximizedStemType}>
                    {selectedTrack.stem_type || 'Audio'}
                  </Text>
                  {selectedTrack.bpm && (
                    <>
                      <Text style={styles.maximizedMetaSeparator}>•</Text>
                      <Text style={styles.maximizedBPM}>{selectedTrack.bpm} BPM</Text>
                    </>
                  )}
                </View>
              </View>
            </View>
            <TouchableOpacity
              style={styles.topEditButton}
              onPress={() => {
                setEditedFileName(selectedTrack.file_name);
                setEditedAudioType(selectedTrack.stem_type || '');
                setTrimStart('0:00');
                setTrimEnd(formatTime(selectedTrack.duration_ms || 0));
                setDetectedBPM(selectedTrack.bpm || null);
                setManualBPM(selectedTrack.bpm?.toString() || '');
                setShowEditModal(true);
              }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              activeOpacity={0.6}
            >
              <Ionicons name="settings-outline" size={22} color={Colors.primary} />
            </TouchableOpacity>
          </View>

          {/* Timeline - Progress bar with comment indicators */}
          <View style={styles.timelineContainer}>
            <View style={styles.progressContainer}>
              <TouchableOpacity
                activeOpacity={1}
                onLayout={(event) => {
                  const { width, x } = event.nativeEvent.layout;
                  progressBarWidth.current = width;
                  progressBarX.current = x;
                }}
                onPress={(e) => {
                  const locationX = e.nativeEvent.locationX;

                  if (progressBarWidth.current > 0 && duration > 0) {
                    const percentage = Math.max(0, Math.min(1, locationX / progressBarWidth.current));
                    const newPosition = percentage * duration;

                    seekTo(newPosition);
                  }
                }}
                style={styles.progressBarTouchable}
              >
                <View style={styles.progressBar}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${progressPercentage}%` },
                    ]}
                  />
                </View>
                {/* Comment position indicators on timeline */}
                {timelineComments.map((comment) => {
                  const position = duration > 0 ? ((comment.timestamp_ms || 0) / duration) * 100 : 0;
                  const isSelected = selectedComment?.id === comment.id;
                  return (
                    <TouchableOpacity
                      key={`indicator-${comment.id}`}
                      style={[
                        styles.commentTimelineIndicator,
                        { left: `${position}%` },
                        isSelected && styles.commentTimelineIndicatorSelected
                      ]}
                      onPress={(e) => {
                        e.stopPropagation();
                        if (sound && selectedTrack) {
                          seekTo(comment.timestamp_ms || 0);
                        }
                        setSelectedComment(comment);
                      }}
                    >
                      <View style={styles.commentTimelineIndicatorDot} />
                    </TouchableOpacity>
                  );
                })}
              </TouchableOpacity>
            </View>

            {/* Time Display */}
            <View style={styles.timeDisplay}>
              <Text style={styles.timeText}>{formatTime(currentPosition)}</Text>
              <Text style={styles.timeText}>{formatTime(duration)}</Text>
            </View>
          </View>

          {/* Transport Controls - Playback Only */}
          <View style={styles.transportButtons}>
            <TouchableOpacity
              style={styles.seekButton}
              onPress={() => skipTime(-10)}
              disabled={!selectedTrack}
            >
              <Ionicons name="play-back" size={28} color={selectedTrack ? Colors.text : Colors.textSecondary} />
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
                <Ionicons name={isPlaying ? 'pause' : 'play'} size={36} color={Colors.text} />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.seekButton}
              onPress={() => skipTime(10)}
              disabled={!selectedTrack}
            >
              <Ionicons name="play-forward" size={28} color={selectedTrack ? Colors.text : Colors.textSecondary} />
              <Text style={[styles.seekButtonText, { color: selectedTrack ? Colors.text : Colors.textSecondary }]}>10</Text>
            </TouchableOpacity>
          </View>

          {/* Comments Section - Modern Chat Style */}
          <View style={styles.commentsSection}>
            {/* Inline Comment Input - replaces modal for better UX */}
            {showTimelineCommentModal ? (
              <View style={styles.inlineCommentContainer}>
                <Text style={styles.inlineCommentTimestamp}>
                  At {formatTime(commentTimestamp)}
                </Text>
                <View style={styles.inlineCommentInputRow}>
                  <TextInput
                    style={styles.inlineCommentInput}
                    placeholder="Add your comment..."
                    placeholderTextColor={Colors.textSecondary}
                    value={newComment}
                    onChangeText={setNewComment}
                    multiline
                    autoFocus={false}
                  />
                  <View style={styles.inlineCommentButtons}>
                    <TouchableOpacity
                      onPress={() => {
                        setShowTimelineCommentModal(false);
                        setNewComment('');
                      }}
                      style={styles.inlineCommentCancelButton}
                    >
                      <Ionicons name="close" size={20} color={Colors.textSecondary} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => addTimelineComment(newComment)}
                      disabled={!newComment.trim()}
                      style={[
                        styles.inlineCommentSaveButton,
                        !newComment.trim() && styles.inlineCommentSaveButtonDisabled
                      ]}
                    >
                      <Ionicons name="send" size={18} color={newComment.trim() ? Colors.text : Colors.textSecondary} />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.addCommentButtonNew}
                onPress={openTimelineCommentModal}
                activeOpacity={0.7}
              >
                <Ionicons name="add-circle" size={20} color={Colors.primary} />
                <Text style={styles.addCommentButtonTextNew}>Comment</Text>
              </TouchableOpacity>
            )}

            {/* Collapsible Comments List */}
            {timelineComments.length > 0 && (
              <View style={styles.commentsCollapsibleContainer}>
                {/* Comments Header - Tap to Expand/Collapse */}
                <TouchableOpacity
                  style={styles.commentsHeader}
                  onPress={() => setIsCommentsPanelExpanded(!isCommentsPanelExpanded)}
                  activeOpacity={0.7}
                >
                  <View style={styles.commentsHeaderLeft}>
                    <Ionicons name="chatbubbles" size={18} color={Colors.primary} />
                    <Text style={styles.commentsHeaderTitle}>
                      Comments
                    </Text>
                    <View style={styles.commentsCountBadge}>
                      <Text style={styles.commentsCountText}>{timelineComments.length}</Text>
                    </View>
                  </View>
                  <Ionicons
                    name={isCommentsPanelExpanded ? "chevron-up" : "chevron-down"}
                    size={20}
                    color={Colors.textSecondary}
                  />
                </TouchableOpacity>

                {/* Comments List - Expandable */}
                {isCommentsPanelExpanded && (
                  <ScrollView
                    style={styles.commentsListContainer}
                    contentContainerStyle={styles.commentsListContent}
                    showsVerticalScrollIndicator={false}
                  >
                    {timelineComments.map((comment) => (
                      <CommentItem
                        key={comment.id}
                        comment={comment}
                        isSelected={selectedComment?.id === comment.id}
                        onPress={() => {
                          if (sound && selectedTrack && comment.timestamp_ms != null) {
                            seekTo(comment.timestamp_ms);
                          }
                          setSelectedComment(comment);
                        }}
                        onLongPress={() => handleCommentTap(comment)}
                        formatTime={formatTime}
                        styles={styles}
                        Colors={Colors}
                      />
                    ))}
                  </ScrollView>
                )}
              </View>
            )}
          </View>
            </>
          )}
          </ScrollView>

          {/* Edit Audio Overlay - Renders inside playback modal */}
          {showEditModal && selectedTrack && (
            <View style={styles.editOverlay}>
              <SafeAreaView style={styles.editOverlayContent}>
                <View style={styles.modalHeader}>
                  <TouchableOpacity onPress={() => setShowEditModal(false)}>
                    <Text style={styles.modalCancel}>{canEdit ? 'Cancel' : 'Close'}</Text>
                  </TouchableOpacity>
                  <Text style={styles.modalTitle}>{canEdit ? 'Edit Audio' : 'View Audio Details'}</Text>
                  {canEdit && (
                    <TouchableOpacity onPress={saveAudioEdits}>
                      <Text style={styles.modalDone}>Save</Text>
                    </TouchableOpacity>
                  )}
                  {!canEdit && <View style={{ width: scale(50) }} />}
                </View>
                <ScrollView style={styles.modalContent}>
                  <Text style={styles.editSectionTitle}>Audio File Details</Text>

                  {/* File Name */}
                  <View style={styles.editField}>
                    <Text style={styles.editLabel}>File Name</Text>
                    <TextInput
                      style={[styles.editInput, !canEdit && styles.editInputDisabled]}
                      value={editedFileName}
                      onChangeText={setEditedFileName}
                      placeholder="Enter file name"
                      placeholderTextColor={Colors.textSecondary}
                      editable={canEdit}
                    />
                  </View>

                  {/* Audio Type */}
                  <View style={styles.editField}>
                    <Text style={styles.editLabel}>Audio Type</Text>
                    <Text style={styles.editHint}>{canEdit ? 'Tap to select audio type' : 'View only'}</Text>
                    <View style={styles.audioTypeGrid}>
                      {['vocals', 'drums', 'bass', 'guitar', 'keys', 'synth', 'fx', 'multiple', 'other'].map((type) => (
                        <TouchableOpacity
                          key={type}
                          style={[
                            styles.audioTypeButton,
                            editedAudioType === type && styles.audioTypeButtonActive,
                            { borderColor: getStemColor(type) },
                            !canEdit && styles.audioTypeButtonDisabled
                          ]}
                          onPress={() => canEdit && setEditedAudioType(type)}
                          disabled={!canEdit}
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
                    <Text style={styles.editHint}>{canEdit ? 'Set start and end times (mm:ss)' : 'View only'}</Text>
                    <View style={styles.trimInputs}>
                      <View style={styles.trimInputGroup}>
                        <Text style={styles.trimInputLabel}>Start</Text>
                        <TextInput
                          style={[styles.trimInput, !canEdit && styles.editInputDisabled]}
                          value={trimStart}
                          onChangeText={setTrimStart}
                          placeholder="0:00"
                          placeholderTextColor={Colors.textSecondary}
                          editable={canEdit}
                        />
                      </View>
                      <Text style={styles.trimSeparator}>—</Text>
                      <View style={styles.trimInputGroup}>
                        <Text style={styles.trimInputLabel}>End</Text>
                        <TextInput
                          style={[styles.trimInput, !canEdit && styles.editInputDisabled]}
                          value={trimEnd}
                          onChangeText={setTrimEnd}
                          placeholder={formatTime(selectedTrack?.duration_ms || 0)}
                          placeholderTextColor={Colors.textSecondary}
                          editable={canEdit}
                        />
                      </View>
                    </View>
                  </View>

                  {/* BPM Detection Section - Only for owners and collaborators */}
                  {canEdit && (
                    <View style={styles.editField}>
                      <Text style={styles.editLabel}>Tempo (BPM)</Text>
                      <Text style={styles.editHint}>Auto-detect, tap tempo, or enter manually</Text>

                    {/* Auto Detect Button */}
                    <TouchableOpacity
                      style={styles.detectBPMButton}
                      onPress={handleDetectBPM}
                      disabled={isDetectingBPM}
                    >
                      {isDetectingBPM ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <>
                          <Ionicons name="analytics-outline" size={20} color="#fff" />
                          <Text style={styles.detectBPMText}>
                            Auto-Detect BPM
                          </Text>
                        </>
                      )}
                    </TouchableOpacity>

                    {/* Manual Input & Tap Tempo */}
                    <View style={styles.manualBPMRow}>
                      <View style={styles.manualBPMInputGroup}>
                        <TextInput
                          style={styles.manualBPMInput}
                          value={manualBPM}
                          onChangeText={setManualBPM}
                          placeholder="Enter BPM"
                          placeholderTextColor={Colors.textSecondary}
                          keyboardType="number-pad"
                          maxLength={3}
                        />
                        <TouchableOpacity
                          style={styles.setBPMButton}
                          onPress={handleManualBPMSave}
                          disabled={!manualBPM.trim()}
                        >
                          <Text style={[
                            styles.setBPMButtonText,
                            !manualBPM.trim() && styles.setBPMButtonTextDisabled
                          ]}>
                            Set
                          </Text>
                        </TouchableOpacity>
                      </View>

                      <TouchableOpacity
                        style={[styles.tapTempoButton, tapTimes.length > 0 && styles.tapTempoButtonActive]}
                        onPress={handleTapTempo}
                      >
                        <Ionicons
                          name="hand-left"
                          size={18}
                          color={tapTimes.length > 0 ? Colors.primary : Colors.text}
                        />
                        <Text style={styles.tapTempoText}>
                          {tapBPM ? `${tapBPM}` : 'Tap'}
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {/* Current BPM Display */}
                    {(detectedBPM || selectedTrack?.bpm) && (
                      <View style={styles.bpmResultBox}>
                        <Ionicons name="musical-note" size={24} color={Colors.primary} />
                        <Text style={styles.bpmResultText}>
                          {detectedBPM || selectedTrack.bpm} BPM
                        </Text>
                        <Text style={styles.bpmMethodText}>Auto-detected</Text>
                      </View>
                    )}
                  </View>
                  )}

                  {/* Download Button - Only for users with download permission */}
                  {canDownload && (
                    <TouchableOpacity
                      style={styles.downloadButton}
                      onPress={downloadAudioFile}
                    >
                      <Ionicons name="download-outline" size={20} color={Colors.primary} />
                      <Text style={styles.downloadButtonText}>Download Audio File</Text>
                    </TouchableOpacity>
                  )}

                  {/* Delete Button - Only for users with delete permission */}
                  {canDelete && (
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
                  )}
                </ScrollView>
              </SafeAreaView>
            </View>
          )}

          {/* View Comment Overlay - Renders inside playback modal */}
          {showViewCommentModal && selectedComment && (
            <View style={styles.editOverlay}>
              <SafeAreaView style={styles.editOverlayContent}>
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
                </View>
              </SafeAreaView>
            </View>
          )}
        </SafeAreaView>
      </Modal>

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

        {/* Chat Tab - Only visible to collaborators (Owner, Admin, Editor) */}
        {isCollaborator && (
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
        )}
      </View>

      {/* Edit Audio Modal - Only show when NOT in maximized state (overlay handles it there) */}
      <Modal
        visible={showEditModal && playerState !== 'maximized'}
        animationType="slide"
        presentationStyle="overFullScreen"
        transparent={false}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowEditModal(false)}>
              <Text style={styles.modalCancel}>{canEdit ? 'Cancel' : 'Close'}</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{canEdit ? 'Edit Audio' : 'View Audio Details'}</Text>
            {canEdit && (
              <TouchableOpacity onPress={saveAudioEdits}>
                <Text style={styles.modalDone}>Save</Text>
              </TouchableOpacity>
            )}
            {!canEdit && <View style={{ width: scale(50) }} />}
          </View>
          <ScrollView style={styles.modalContent}>
            <Text style={styles.editSectionTitle}>Audio File Details</Text>

            {/* File Name */}
            <View style={styles.editField}>
              <Text style={styles.editLabel}>File Name</Text>
              <TextInput
                style={[styles.editInput, !canEdit && styles.editInputDisabled]}
                value={editedFileName}
                onChangeText={setEditedFileName}
                placeholder="Enter file name"
                placeholderTextColor={Colors.textSecondary}
                editable={canEdit}
              />
            </View>

            {/* Audio Type */}
            <View style={styles.editField}>
              <Text style={styles.editLabel}>Audio Type</Text>
              <Text style={styles.editHint}>{canEdit ? 'Tap to select audio type' : 'View only'}</Text>
              <View style={styles.audioTypeGrid}>
                {['vocals', 'drums', 'bass', 'guitar', 'keys', 'synth', 'fx', 'multiple', 'other'].map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.audioTypeButton,
                      editedAudioType === type && styles.audioTypeButtonActive,
                      { borderColor: getStemColor(type) },
                      !canEdit && styles.audioTypeButtonDisabled
                    ]}
                    onPress={() => canEdit && setEditedAudioType(type)}
                    disabled={!canEdit}
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
              <Text style={styles.editHint}>{canEdit ? 'Set start and end times (mm:ss)' : 'View only'}</Text>
              <View style={styles.trimInputs}>
                <View style={styles.trimInputGroup}>
                  <Text style={styles.trimInputLabel}>Start</Text>
                  <TextInput
                    style={[styles.trimInput, !canEdit && styles.editInputDisabled]}
                    value={trimStart}
                    onChangeText={setTrimStart}
                    placeholder="0:00"
                    placeholderTextColor={Colors.textSecondary}
                    editable={canEdit}
                  />
                </View>
                <Text style={styles.trimSeparator}>—</Text>
                <View style={styles.trimInputGroup}>
                  <Text style={styles.trimInputLabel}>End</Text>
                  <TextInput
                    style={[styles.trimInput, !canEdit && styles.editInputDisabled]}
                    value={trimEnd}
                    onChangeText={setTrimEnd}
                    placeholder={formatTime(selectedTrack?.duration_ms || 0)}
                    placeholderTextColor={Colors.textSecondary}
                    editable={canEdit}
                  />
                </View>
              </View>
            </View>

            {/* BPM Detection Section - Only for owners and collaborators */}
            {canEdit && (
              <View style={styles.editField}>
                <Text style={styles.editLabel}>Tempo (BPM)</Text>
                <Text style={styles.editHint}>Auto-detect, tap tempo, or enter manually</Text>

              {/* Auto Detect Button */}
              <TouchableOpacity
                style={styles.detectBPMButton}
                onPress={handleDetectBPM}
                disabled={isDetectingBPM}
              >
                {isDetectingBPM ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="analytics-outline" size={20} color="#fff" />
                    <Text style={styles.detectBPMText}>
                      Auto-Detect BPM
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              {/* Manual Input & Tap Tempo */}
              <View style={styles.manualBPMRow}>
                <View style={styles.manualBPMInputGroup}>
                  <TextInput
                    style={styles.manualBPMInput}
                    value={manualBPM}
                    onChangeText={setManualBPM}
                    placeholder="Enter BPM"
                    placeholderTextColor={Colors.textSecondary}
                    keyboardType="number-pad"
                    maxLength={3}
                  />
                  <TouchableOpacity
                    style={styles.setBPMButton}
                    onPress={handleManualBPMSave}
                    disabled={!manualBPM.trim()}
                  >
                    <Text style={[
                      styles.setBPMButtonText,
                      !manualBPM.trim() && styles.setBPMButtonTextDisabled
                    ]}>
                      Set
                    </Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  style={[styles.tapTempoButton, tapTimes.length > 0 && styles.tapTempoButtonActive]}
                  onPress={handleTapTempo}
                >
                  <Ionicons
                    name="hand-left"
                    size={18}
                    color={tapTimes.length > 0 ? Colors.primary : Colors.text}
                  />
                  <Text style={styles.tapTempoText}>
                    {tapBPM ? `${tapBPM}` : 'Tap'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Current BPM Display */}
              {(detectedBPM || selectedTrack?.bpm) && (
                <View style={styles.bpmResultBox}>
                  <Ionicons name="musical-note" size={24} color={Colors.primary} />
                  <Text style={styles.bpmResultText}>
                    {detectedBPM || selectedTrack.bpm} BPM
                  </Text>
                  <Text style={styles.bpmMethodText}>Auto-detected</Text>
                </View>
              )}
            </View>
            )}

            {/* Download Button - Only for users with download permission */}
            {canDownload && (
              <TouchableOpacity
                style={styles.downloadButton}
                onPress={downloadAudioFile}
              >
                <Ionicons name="download-outline" size={20} color={Colors.primary} />
                <Text style={styles.downloadButtonText}>Download Audio File</Text>
              </TouchableOpacity>
            )}

            {/* Revert to Original Button - Only show if file has been trimmed and user can edit */}
            {canEdit && selectedTrack?.is_trimmed && selectedTrack?.original_file_path && (
              <TouchableOpacity
                style={styles.revertButton}
                onPress={revertToOriginal}
              >
                <Ionicons name="refresh-outline" size={20} color={Colors.primary} />
                <Text style={styles.revertButtonText}>Revert to Original</Text>
              </TouchableOpacity>
            )}

            {/* Delete Button - Only for owners and collaborators */}
            {canEdit && (
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
            )}
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

  // Public Viewer Hint
  publicViewerHint: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(147, 51, 234, 0.1)',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    marginHorizontal: Spacing.md,
    marginTop: Spacing.sm,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },
  publicViewerHintText: {
    ...Typography.caption,
    color: Colors.textSecondary,
    flex: 1,
  },

  // Main Content - Scrollable tracks list
  mainTracksList: {
    flex: 1,
  },
  tracksListContent: {
    paddingBottom: Spacing.md,
  },

  // Minimized Player - Spotify-style bar
  minimizedPlayer: {
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
  },
  minimizedHandle: {
    alignItems: 'center',
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.xxs,
  },
  handlePill: {
    width: scale(36),
    height: scale(4),
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: scale(2),
  },
  minimizedContentWrapper: {
    paddingBottom: Spacing.xs,
  },
  minimizedContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xxs,
    paddingBottom: Spacing.sm,
    gap: Spacing.md,
  },
  minimizedColorBar: {
    width: scale(3),
    height: scale(44),
    borderRadius: scale(1.5),
  },
  minimizedInfo: {
    flex: 1,
  },
  minimizedTrackName: {
    ...Typography.body,
    color: Colors.text,
    fontWeight: '600',
    fontSize: scale(15),
    marginBottom: scale(3),
  },
  minimizedStemType: {
    ...Typography.caption,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    fontSize: scale(11),
    letterSpacing: scale(0.6),
  },
  minimizedPlayButton: {
    width: scale(44),
    height: scale(44),
    borderRadius: scale(22),
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  minimizedProgressBar: {
    height: scale(2),
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  minimizedProgressBarTouchable: {
    width: '100%',
    paddingVertical: Spacing.sm, // Larger tap target
  },
  minimizedProgressFill: {
    height: '100%',
    backgroundColor: Colors.primary,
  },

  // Maximized Player - Full Screen Modal
  maximizedPlayerModal: {
    flex: 1,
    backgroundColor: Colors.backgroundDark,
  },
  maximizedPlayerScroll: {
    flex: 1,
  },
  maximizedPlayerContent: {
    backgroundColor: '#2A2A2A',
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xxxl,
    minHeight: '100%',
  },
  // Legacy style (kept for compatibility)
  maximizedPlayer: {
    backgroundColor: '#2A2A2A',
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    minHeight: scale(280),
  },
  minimizeHandleContainer: {
    alignItems: 'center',
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.xxs,
    marginTop: -Spacing.md,
  },
  minimizeHandle: {
    paddingVertical: scale(4),
    paddingHorizontal: scale(20),
  },
  minimizeBar: {
    width: scale(40),
    height: scale(4),
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: scale(2),
  },
  actionButton: {
    width: scale(44),
    height: scale(44),
    borderRadius: scale(22),
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  maximizedTrackInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.lg,
  },
  topEditButton: {
    padding: scale(8),
    borderRadius: scale(8),
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
  },
  maximizedTrackInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  maximizedColorBar: {
    width: scale(4),
    height: scale(48),
    borderRadius: scale(2),
    marginRight: Spacing.lg,
  },
  maximizedTrackText: {
    flex: 1,
  },
  maximizedTrackName: {
    ...Typography.h3,
    color: Colors.text,
    fontWeight: '700',
    marginBottom: scale(4),
    fontSize: scale(18),
  },
  maximizedMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  maximizedStemType: {
    ...Typography.body,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    fontSize: scale(11),
    letterSpacing: scale(0.8),
    fontWeight: '600',
  },
  maximizedMetaSeparator: {
    ...Typography.body,
    color: Colors.textSecondary,
    fontSize: scale(11),
    opacity: 0.4,
  },
  maximizedBPM: {
    ...Typography.body,
    color: Colors.primary,
    fontSize: scale(11),
    fontWeight: '700',
    letterSpacing: scale(0.5),
  },

  // Timeline with comments
  timelineContainer: {
    marginBottom: Spacing.sm,
  },
  commentTimelineIndicator: {
    position: 'absolute',
    top: scale(-4),
    width: scale(12),
    height: scale(12),
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: scale(-6),
  },
  commentTimelineIndicatorDot: {
    width: scale(10),
    height: scale(10),
    backgroundColor: Colors.primary,
    borderRadius: scale(5),
    borderWidth: scale(2),
    borderColor: Colors.backgroundDark,
  },
  commentTimelineIndicatorSelected: {
    transform: [{ scale: 1.3 }],
  },

  // Comments Panel - Premium Design
  // Comments Section - Modern Chat Style
  commentsSection: {
    marginTop: scale(24),
    paddingBottom: scale(16),
  },
  addCommentButtonNew: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: scale(8),
    paddingVertical: scale(14),
    paddingHorizontal: scale(20),
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    borderRadius: scale(12),
    borderWidth: 1.5,
    borderColor: 'rgba(99, 102, 241, 0.3)',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: scale(2) },
    shadowOpacity: 0.15,
    shadowRadius: scale(6),
    elevation: 3,
  },
  addCommentButtonTextNew: {
    ...Typography.bodyLarge,
    color: Colors.primary,
    fontWeight: '700',
    fontSize: scale(16),
    letterSpacing: scale(0.3),
  },
  // Inline comment input styles (no modal needed)
  inlineCommentContainer: {
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    borderRadius: scale(12),
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
    padding: scale(12),
  },
  inlineCommentTimestamp: {
    ...Typography.caption,
    color: Colors.primary,
    fontWeight: '600',
    marginBottom: scale(8),
  },
  inlineCommentInputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: scale(8),
  },
  inlineCommentInput: {
    flex: 1,
    ...Typography.body,
    color: Colors.text,
    backgroundColor: Colors.surface,
    borderRadius: scale(8),
    paddingHorizontal: scale(12),
    paddingVertical: scale(10),
    minHeight: scale(40),
    maxHeight: scale(100),
    borderWidth: 1,
    borderColor: Colors.border,
  },
  inlineCommentButtons: {
    flexDirection: 'row',
    gap: scale(4),
  },
  inlineCommentCancelButton: {
    width: scale(36),
    height: scale(36),
    borderRadius: scale(18),
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inlineCommentSaveButton: {
    width: scale(36),
    height: scale(36),
    borderRadius: scale(18),
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inlineCommentSaveButtonDisabled: {
    backgroundColor: Colors.surface,
  },
  commentsCollapsibleContainer: {
    marginTop: scale(16),
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: scale(12),
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
  },
  commentsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: scale(16),
    paddingVertical: scale(14),
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
  },
  commentsHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
  },
  commentsHeaderTitle: {
    ...Typography.body,
    color: Colors.text,
    fontWeight: '600',
    fontSize: scale(15),
    letterSpacing: scale(-0.2),
  },
  commentsCountBadge: {
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    paddingHorizontal: scale(8),
    paddingVertical: scale(3),
    borderRadius: scale(10),
    minWidth: scale(24),
    alignItems: 'center',
    justifyContent: 'center',
  },
  commentsCountText: {
    color: Colors.primary,
    fontSize: scale(12),
    fontWeight: '700',
  },
  commentsListContainer: {
    maxHeight: scale(400),
  },
  commentsListContent: {
    paddingHorizontal: scale(12),
    paddingVertical: scale(12),
    paddingBottom: scale(8),
  },
  commentBubble: {
    backgroundColor: '#2D2D2D',
    borderRadius: scale(14),
    padding: scale(14),
    marginBottom: scale(12),
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: scale(2) },
    shadowOpacity: 0.1,
    shadowRadius: scale(4),
    elevation: 2,
  },
  commentBubbleSelected: {
    backgroundColor: 'rgba(99, 102, 241, 0.18)',
    borderWidth: 2,
    borderColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: scale(4) },
    shadowOpacity: 0.35,
    shadowRadius: scale(8),
    elevation: 6,
    transform: [{ scale: 1.02 }],
  },
  commentBubbleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: scale(10),
  },
  commentBubbleUsername: {
    ...Typography.body,
    color: Colors.text,
    fontWeight: '700',
    fontSize: scale(14),
    letterSpacing: scale(0.1),
    flex: 1,
  },
  commentBubbleTimestamp: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(4),
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    paddingHorizontal: scale(8),
    paddingVertical: scale(4),
    borderRadius: scale(8),
  },
  commentBubbleTimestampText: {
    color: Colors.primary,
    fontSize: scale(11),
    fontWeight: '700',
    letterSpacing: scale(0.3),
  },
  commentBubbleContent: {
    ...Typography.body,
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: scale(14),
    lineHeight: scale(20),
    letterSpacing: scale(-0.1),
  },

  // Footer - Tab Navigation Only
  footer: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
    paddingBottom: scale(20), // Safe area padding
    paddingTop: Spacing.xs,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
    borderBottomWidth: scale(2),
    borderBottomColor: 'transparent',
  },
  tabButtonActive: {
    borderBottomColor: Colors.primary,
  },
  tabButtonText: {
    ...Typography.body,
    color: Colors.textSecondary,
    fontWeight: '600',
    fontSize: scale(13),
    letterSpacing: scale(0.3),
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
    width: scale(3),
    height: scale(40),
    borderRadius: scale(1.5),
    marginRight: Spacing.lg,
  },
  nowPlayingText: {
    flex: 1,
  },
  nowPlayingTitle: {
    ...Typography.h3,
    color: Colors.text,
    fontWeight: '700',
    marginBottom: scale(2),
  },
  nowPlayingSubtitle: {
    ...Typography.body,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    fontSize: scale(11),
    letterSpacing: scale(0.8),
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
    fontSize: scale(11),
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
    width: scale(64),
    height: scale(64),
    borderRadius: scale(32),
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  seekButtonText: {
    ...Typography.tiny,
    position: 'absolute',
    bottom: scale(8),
    fontWeight: '700',
    fontSize: scale(11),
    color: Colors.textSecondary,
  },
  transportButton: {
    width: scale(48),
    height: scale(48),
    borderRadius: scale(24),
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playButton: {
    width: scale(72),
    height: scale(72),
    borderRadius: scale(36),
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: scale(4) },
    shadowOpacity: 0.3,
    shadowRadius: scale(8),
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
    height: scale(3),
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: scale(1.5),
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.primary,
  },
  progressBarTouchable: {
    width: '100%',
    paddingVertical: Spacing.md, // Larger tap target
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
    shadowOffset: { width: 0, height: scale(2) },
    shadowOpacity: 0.2,
    shadowRadius: scale(4),
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
    width: scale(3),
    height: scale(44),
    borderRadius: scale(1.5),
    marginRight: Spacing.lg,
  },
  trackInfo: {
    flex: 1,
  },
  trackName: {
    ...Typography.bodyLarge,
    color: Colors.text,
    fontWeight: '600',
    marginBottom: scale(3),
    fontSize: scale(15),
  },
  trackMeta: {
    flexDirection: 'row',
    gap: Spacing.sm,
    alignItems: 'center',
  },
  trackUploader: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontSize: scale(11),
    fontWeight: '600',
  },
  trackUploaderYou: {
    color: Colors.primary,
  },
  trackType: {
    ...Typography.caption,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    fontSize: scale(11),
    letterSpacing: scale(0.5),
    fontWeight: '600',
  },
  trackDuration: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontSize: scale(12),
    fontFamily: 'monospace',
  },
  trackMetaSeparator: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontSize: scale(12),
    opacity: 0.5,
  },
  trackBPM: {
    ...Typography.caption,
    color: Colors.primary,
    fontSize: scale(11),
    fontWeight: '600',
    letterSpacing: scale(0.3),
  },
  playingIndicator: {
    position: 'absolute',
    top: Spacing.sm,
    right: Spacing.sm,
    width: scale(24),
    height: scale(24),
    borderRadius: scale(12),
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
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
    height: scale(200),
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
    width: scale(4),
    height: scale(40),
    borderRadius: scale(2),
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
    width: scale(36),
    height: scale(36),
    borderRadius: scale(18),
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: scale(2) },
    shadowOpacity: 0.2,
    shadowRadius: scale(3),
    elevation: 2,
  },
  // Modal Styles
  // Edit Audio Overlay (inside playback modal)
  editOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: Colors.backgroundDark,
    zIndex: 1000,
  },
  editOverlayContent: {
    flex: 1,
    backgroundColor: Colors.backgroundDark,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: Colors.backgroundDark,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.lg,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
    minHeight: scale(88),
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
    minHeight: scale(120),
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
    lineHeight: scale(22),
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
  editInputDisabled: {
    backgroundColor: Colors.backgroundDark,
    opacity: 0.5,
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
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  audioTypeButtonActive: {
    backgroundColor: Colors.primary,
  },
  audioTypeButtonDisabled: {
    opacity: 0.5,
  },
  audioTypeText: {
    ...Typography.body,
    color: Colors.textSecondary,
    fontWeight: '500',
    textTransform: 'capitalize',
    fontSize: scale(13),
  },
  audioTypeTextActive: {
    color: Colors.text,
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
    letterSpacing: scale(0.5),
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
    fontSize: scale(16),
    width: '100%',
  },
  trimSeparator: {
    ...Typography.h3,
    color: Colors.textSecondary,
    marginTop: scale(20),
  },
  downloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.lg,
    marginTop: Spacing.xxl,
  },
  downloadButtonText: {
    ...Typography.bodyLarge,
    color: '#fff',
    fontWeight: '600',
  },
  revertButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: `${Colors.primary}20`,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.primary,
    marginTop: Spacing.xxl,
  },
  revertButtonText: {
    ...Typography.bodyLarge,
    color: Colors.primary,
    fontWeight: '600',
  },
  detectBPMButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.lg,
    marginTop: Spacing.md,
  },
  detectBPMText: {
    ...Typography.bodyLarge,
    color: '#fff',
    fontWeight: '600',
  },
  manualBPMRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.md,
  },
  manualBPMInputGroup: {
    flex: 1,
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  manualBPMInput: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    ...Typography.body,
    color: Colors.text,
    fontSize: scale(16),
  },
  setBPMButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  setBPMButtonText: {
    ...Typography.body,
    color: '#fff',
    fontWeight: '600',
  },
  setBPMButtonTextDisabled: {
    opacity: 0.5,
  },
  tapTempoButton: {
    width: scale(80),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.surface,
    borderWidth: scale(2),
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
  },
  tapTempoButtonActive: {
    borderColor: Colors.primary,
    backgroundColor: `${Colors.primary}10`,
  },
  tapTempoText: {
    ...Typography.caption,
    color: Colors.text,
    fontWeight: '600',
    fontSize: scale(14),
  },
  bpmResultBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    backgroundColor: `${Colors.primary}10`,
    padding: Spacing.xl,
    borderRadius: BorderRadius.lg,
    marginTop: Spacing.lg,
    borderWidth: scale(2),
    borderColor: Colors.primary,
  },
  bpmResultText: {
    ...Typography.h2,
    color: Colors.primary,
    fontWeight: 'bold',
  },
  bpmMethodText: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontSize: scale(11),
    marginLeft: Spacing.xs,
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

  // Organize Mode Styles
  splitActionSection: {
    padding: Spacing.md,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  splitActionBar: {
    flexDirection: 'row',
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
  },
  splitActionLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
  },
  splitActionRight: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
  },
  splitActionDivider: {
    width: 1,
    backgroundColor: Colors.border,
  },
  splitActionText: {
    ...Typography.bodyLarge,
    color: Colors.primary,
    fontWeight: '600',
    fontSize: scale(15),
  },
  splitActionTextActive: {
    color: Colors.success,
  },

  // Organize Mode Controls
  organizeControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  moveButton: {
    width: scale(32),
    height: scale(32),
    borderRadius: scale(16),
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  hideButton: {
    width: scale(32),
    height: scale(32),
    borderRadius: scale(16),
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },

  // Hidden Tracks Section
  hiddenTracksSection: {
    marginTop: Spacing.xl,
    paddingHorizontal: Spacing.lg,
  },
  showHiddenButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  showHiddenButtonText: {
    ...Typography.body,
    color: Colors.textSecondary,
    fontWeight: '600',
  },

});