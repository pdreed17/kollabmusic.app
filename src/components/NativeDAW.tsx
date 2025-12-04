/**
 * Native DAW - Main Component
 *
 * Comprehensive native DAW system that integrates all native components:
 * - Timeline with drag-and-drop
 * - Waveform visualization
 * - Audio engine with expo-av
 * - Advanced mixer controls
 * - Export/import functionality
 * - Undo/redo system
 * - Integration with existing project data
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react'
import {
  View,
  StyleSheet,
  Alert,
  SafeAreaView,
  TouchableOpacity,
  Text,
  Platform,
  StatusBar,
} from 'react-native'
import { Audio } from 'expo-av'
import Icon from 'react-native-vector-icons/MaterialIcons'
import { Colors, Typography, Spacing } from '../constants/theme'
import { supabase } from '../lib/supabase'

// Native DAW Components
import NativeDAWTimeline from './NativeDAWTimeline'
import NativeAudioEngine, { AudioTrack, useNativeAudioEngine } from './NativeAudioEngine'
import NativeMixerControls from './NativeMixerControls'
import NativeExportImport, { ProjectData } from './NativeExportImport'
import DAWHistoryProvider, { useDAWHistory, useDAWActions } from './NativeDAWHistory'

// Header
import Header from './Header'

// =================== TYPES ===================

// Convert existing AudioFile type to our AudioTrack format
type AudioFile = {
  id: string
  file_name: string
  file_path: string
  stem_type: string
  stem_name: string
  duration_ms: number
  start_time_ms: number
  color: string
  volume: number
  pan: number
  is_muted: boolean
  is_soloed: boolean
  user_id: string
}

interface NativeDAWProps {
  projectId: string
  projectData: any
  audioFiles: AudioFile[]
  onProjectUpdate?: (updates: any) => void
  onAudioFilesUpdate?: (audioFiles: AudioFile[]) => void
  onBack?: () => void
  navigation?: any
}

// =================== DATA CONVERSION UTILITIES ===================

const convertAudioFileToTrack = (audioFile: AudioFile): AudioTrack => ({
  id: audioFile.id,
  uri: '', // Will be populated by loading signed URL
  name: audioFile.stem_name || audioFile.file_name,
  volume: audioFile.volume,
  muted: audioFile.is_muted,
  solo: audioFile.is_soloed,
  startTime: audioFile.start_time_ms / 1000, // Convert to seconds
  duration: audioFile.duration_ms / 1000, // Convert to seconds
  effects: [],
  waveformData: [], // Will be generated/loaded
})

const convertTrackToAudioFile = (track: AudioTrack, originalFile: AudioFile): AudioFile => ({
  ...originalFile,
  stem_name: track.name,
  volume: track.volume,
  is_muted: track.muted,
  is_soloed: track.solo,
  start_time_ms: track.startTime * 1000, // Convert to milliseconds
  duration_ms: track.duration * 1000, // Convert to milliseconds
})

// =================== MAIN DAW COMPONENT ===================

function NativeDAWInner({
  projectId,
  projectData,
  audioFiles,
  onProjectUpdate,
  onAudioFilesUpdate,
  onBack,
  navigation,
}: NativeDAWProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [showMixer, setShowMixer] = useState(false)
  const [showExportImport, setShowExportImport] = useState(false)
  const [masterMuted, setMasterMuted] = useState(false)

  // DAW History Integration
  const { dawState, canUndo, canRedo, undo, redo } = useDAWHistory()
  const dawActions = useDAWActions()

  // Convert audio files to tracks
  const tracks = useMemo(() =>
    audioFiles.map(convertAudioFileToTrack),
    [audioFiles]
  )

  // Project data for export/import
  const currentProjectData: ProjectData = useMemo(() => ({
    id: projectData?.id || projectId,
    name: projectData?.title || 'Untitled Project',
    description: projectData?.description || '',
    createdAt: projectData?.created_at || new Date().toISOString(),
    updatedAt: projectData?.updated_at || new Date().toISOString(),
    bpm: projectData?.bpm || 120,
    duration: Math.max(...tracks.map(t => t.startTime + t.duration), 0),
    tracks,
    masterVolume: dawState.masterVolume,
    version: '1.0.0',
  }), [projectData, projectId, tracks, dawState.masterVolume])

  // Audio engine integration
  const audioEngine = useNativeAudioEngine({
    tracks: dawState.tracks.length > 0 ? dawState.tracks : tracks,
    onPlaybackStateChange: useCallback((state) => {
      console.log('Playback state changed:', state)
    }, []),
    onPositionUpdate: useCallback((position) => {
      console.log('Position updated:', position)
    }, []),
    onTrackUpdate: useCallback((trackId: string, updates: Partial<AudioTrack>) => {
      console.log('Track updated:', trackId, updates)
      // Update local audio files through parent
      updateAudioFileFromTrack(trackId, updates)
    }, []),
    onError: useCallback((error) => {
      Alert.alert('Audio Error', error)
    }, []),
    bpm: currentProjectData.bpm,
    masterVolume: dawState.masterVolume,
  })

  // =================== SUPABASE INTEGRATION ===================

  const updateAudioFileFromTrack = useCallback(async (trackId: string, updates: Partial<AudioTrack>) => {
    try {
      const audioFile = audioFiles.find(f => f.id === trackId)
      if (!audioFile) return

      // Convert track updates to audio file format
      const audioFileUpdates: Partial<AudioFile> = {}

      if (updates.name !== undefined) audioFileUpdates.stem_name = updates.name
      if (updates.volume !== undefined) audioFileUpdates.volume = updates.volume
      if (updates.muted !== undefined) audioFileUpdates.is_muted = updates.muted
      if (updates.solo !== undefined) audioFileUpdates.is_soloed = updates.solo
      if (updates.startTime !== undefined) audioFileUpdates.start_time_ms = updates.startTime * 1000
      if (updates.duration !== undefined) audioFileUpdates.duration_ms = updates.duration * 1000

      // Update in Supabase
      const { error } = await supabase
        .from('audio_files')
        .update(audioFileUpdates)
        .eq('id', trackId)

      if (error) throw error

      // Update local state through parent
      const updatedAudioFiles = audioFiles.map(f =>
        f.id === trackId ? { ...f, ...audioFileUpdates } : f
      )
      onAudioFilesUpdate?.(updatedAudioFiles)

    } catch (error) {
      console.error('Error updating audio file:', error)
      Alert.alert('Error', 'Failed to update track')
    }
  }, [audioFiles, onAudioFilesUpdate])

  const updateProjectBPM = useCallback(async (newBpm: number) => {
    try {
      const { error } = await supabase
        .from('projects')
        .update({ bpm: newBpm })
        .eq('id', projectId)

      if (error) throw error

      onProjectUpdate?.({ bpm: newBpm })

    } catch (error) {
      console.error('Error updating BPM:', error)
      Alert.alert('Error', 'Failed to update BPM')
    }
  }, [projectId, onProjectUpdate])

  // =================== TRACK OPERATIONS ===================

  const handleTrackUpdate = useCallback((trackId: string, updates: Partial<AudioTrack>) => {
    // Record in history
    const track = tracks.find(t => t.id === trackId)
    if (!track) return

    if (updates.volume !== undefined && updates.volume !== track.volume) {
      dawActions.changeTrackVolume(trackId, track.volume, updates.volume)
    }
    if (updates.muted !== undefined && updates.muted !== track.muted) {
      dawActions.toggleTrackMute(trackId, updates.muted)
    }
    if (updates.solo !== undefined && updates.solo !== track.solo) {
      dawActions.toggleTrackSolo(trackId, updates.solo)
    }
    if (updates.startTime !== undefined && updates.startTime !== track.startTime) {
      dawActions.moveTrack(trackId, track.startTime, updates.startTime)
    }

    // Update through Supabase
    updateAudioFileFromTrack(trackId, updates)
  }, [tracks, dawActions, updateAudioFileFromTrack])

  const handleTrackMove = useCallback((trackId: string, newStartTime: number) => {
    const track = tracks.find(t => t.id === trackId)
    if (!track) return

    handleTrackUpdate(trackId, { startTime: newStartTime })
  }, [tracks, handleTrackUpdate])

  const handleTrackResize = useCallback((
    trackId: string,
    newStartTime: number,
    newDuration: number
  ) => {
    const track = tracks.find(t => t.id === trackId)
    if (!track) return

    dawActions.resizeTrack(
      trackId,
      track.startTime,
      track.duration,
      newStartTime,
      newDuration
    )

    handleTrackUpdate(trackId, {
      startTime: newStartTime,
      duration: newDuration
    })
  }, [tracks, dawActions, handleTrackUpdate])

  // =================== MIXER INTEGRATION ===================

  const handleSolo = useCallback((trackId: string, solo: boolean) => {
    handleTrackUpdate(trackId, { solo })
  }, [handleTrackUpdate])

  const handleMute = useCallback((trackId: string, muted: boolean) => {
    handleTrackUpdate(trackId, { muted })
  }, [handleTrackUpdate])

  const handleVolumeChange = useCallback((trackId: string, volume: number) => {
    handleTrackUpdate(trackId, { volume })
  }, [handleTrackUpdate])

  const handleMasterVolumeChange = useCallback((volume: number) => {
    dawActions.changeMasterVolume(dawState.masterVolume, volume)
  }, [dawActions, dawState.masterVolume])

  const handleMasterMuteToggle = useCallback(() => {
    setMasterMuted(prev => !prev)
  }, [])

  // =================== BPM CONTROL ===================

  const handleBPMChange = useCallback((oldBpm: number, newBpm: number) => {
    dawActions.changeBPM(oldBpm, newBpm)
    updateProjectBPM(newBpm)
  }, [dawActions, updateProjectBPM])

  // =================== EXPORT/IMPORT INTEGRATION ===================

  const handleProjectImport = useCallback((importedProject: ProjectData) => {
    dawActions.loadProject(currentProjectData, importedProject)
  }, [dawActions, currentProjectData])

  const handleTracksImport = useCallback((importedTracks: AudioTrack[]) => {
    importedTracks.forEach(track => {
      dawActions.addTrack(track)
    })
  }, [dawActions])

  const handleExportComplete = useCallback((result: any) => {
    if (result.success) {
      Alert.alert('Export Complete', 'Project exported successfully')
    }
  }, [])

  // =================== AUDIO ENGINE SETUP ===================

  useEffect(() => {
    // Initialize audio session
    const initializeAudio = async () => {
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
        })
      } catch (error) {
        console.error('Error setting up audio:', error)
      }
    }

    initializeAudio()
  }, [])

  // =================== RENDER HELPERS ===================

  const getSoloedTracks = useCallback(() => {
    return tracks.filter(t => t.solo).map(t => t.id)
  }, [tracks])

  const renderHeader = () => (
    <Header
      title={currentProjectData.name}
      variant="compact"
      showBack={true}
      onBack={onBack}
      rightComponent={
        <View style={styles.headerActions}>
          {/* Undo/Redo */}
          <TouchableOpacity
            style={[styles.headerButton, !canUndo && styles.headerButtonDisabled]}
            onPress={undo}
            disabled={!canUndo}
          >
            <Icon name="undo" size={20} color={canUndo ? Colors.text : Colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.headerButton, !canRedo && styles.headerButtonDisabled]}
            onPress={redo}
            disabled={!canRedo}
          >
            <Icon name="redo" size={20} color={canRedo ? Colors.text : Colors.textSecondary} />
          </TouchableOpacity>

          {/* Mixer Toggle */}
          <TouchableOpacity
            style={[styles.headerButton, showMixer && styles.headerButtonActive]}
            onPress={() => setShowMixer(!showMixer)}
          >
            <Icon name="tune" size={20} color={showMixer ? Colors.primary : Colors.text} />
          </TouchableOpacity>

          {/* Export/Import */}
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => setShowExportImport(!showExportImport)}
          >
            <Icon name="import-export" size={20} color={Colors.text} />
          </TouchableOpacity>
        </View>
      }
    />
  )

  const renderTimeline = () => (
    <View style={styles.timelineContainer}>
      <NativeDAWTimeline
        tracks={dawState.tracks.length > 0 ? dawState.tracks : tracks}
        bpm={currentProjectData.bpm}
        isPlaying={audioEngine.playbackState.isPlaying}
        position={audioEngine.playbackState.position}
        onTrackMove={handleTrackMove}
        onTrackResize={handleTrackResize}
        onTrackUpdate={handleTrackUpdate}
        onPlay={() => audioEngine.play()}
        onPause={() => audioEngine.pause()}
        onStop={() => audioEngine.stop()}
        onSeek={(position) => audioEngine.seekTo(position)}
        onBPMChange={handleBPMChange}
        showWaveforms={true}
        showGrid={true}
        showComments={false}
        allowEditing={true}
      />
    </View>
  )

  const renderMixer = () => {
    if (!showMixer) return null

    return (
      <View style={styles.mixerContainer}>
        <NativeMixerControls
          tracks={dawState.tracks.length > 0 ? dawState.tracks : tracks}
          onTrackUpdate={handleTrackUpdate}
          masterVolume={dawState.masterVolume}
          onMasterVolumeChange={handleMasterVolumeChange}
          masterMuted={masterMuted}
          onMasterMuteToggle={handleMasterMuteToggle}
          soloedTracks={getSoloedTracks()}
          isPlaying={audioEngine.playbackState.isPlaying}
        />
      </View>
    )
  }

  const renderExportImport = () => {
    if (!showExportImport) return null

    return (
      <View style={styles.exportContainer}>
        <NativeExportImport
          projectData={currentProjectData}
          onProjectImport={handleProjectImport}
          onTracksImport={handleTracksImport}
          onExportComplete={handleExportComplete}
          onError={(error) => Alert.alert('Error', error)}
        />
      </View>
    )
  }

  // =================== MAIN RENDER ===================

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.backgroundDark} />

      {renderHeader()}

      <View style={styles.content}>
        {renderTimeline()}
        {renderMixer()}
        {renderExportImport()}
      </View>

      {/* Transport Controls */}
      <View style={styles.transportContainer}>
        <View style={styles.transportControls}>
          <TouchableOpacity
            style={styles.transportButton}
            onPress={() => audioEngine.seekTo(0)}
          >
            <Icon name="skip-previous" size={24} color={Colors.text} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.playButton, audioEngine.playbackState.isPlaying && styles.playButtonActive]}
            onPress={() => audioEngine.playbackState.isPlaying ? audioEngine.pause() : audioEngine.play()}
          >
            <Icon
              name={audioEngine.playbackState.isPlaying ? 'pause' : 'play-arrow'}
              size={32}
              color={Colors.surface}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.transportButton}
            onPress={() => audioEngine.stop()}
          >
            <Icon name="stop" size={24} color={Colors.text} />
          </TouchableOpacity>
        </View>

        <View style={styles.positionDisplay}>
          <Text style={styles.positionText}>
            {formatTime(audioEngine.playbackState.position)}
          </Text>
          <Text style={styles.durationText}>
            / {formatTime(currentProjectData.duration)}
          </Text>
          <Text style={styles.bpmText}>
            {currentProjectData.bpm} BPM
          </Text>
        </View>
      </View>

      {/* Loading overlay */}
      {isLoading && (
        <View style={styles.loadingOverlay}>
          <Text style={styles.loadingText}>Processing...</Text>
        </View>
      )}
    </SafeAreaView>
  )
}

// =================== MAIN WRAPPER WITH HISTORY PROVIDER ===================

export default function NativeDAW(props: NativeDAWProps) {
  const initialDAWState = useMemo(() => ({
    tracks: props.audioFiles.map(convertAudioFileToTrack),
    masterVolume: 1.0,
    bpm: props.projectData?.bpm || 120,
  }), [props.audioFiles, props.projectData])

  const handleStateChange = useCallback((state: any) => {
    console.log('DAW state changed:', state)
  }, [])

  return (
    <DAWHistoryProvider
      initialState={initialDAWState}
      maxHistorySize={100}
      onStateChange={handleStateChange}
    >
      <NativeDAWInner {...props} />
    </DAWHistoryProvider>
  )
}

// =================== UTILITY FUNCTIONS ===================

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

// =================== STYLES ===================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.backgroundDark,
  },
  content: {
    flex: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  headerButtonActive: {
    backgroundColor: Colors.primary + '20',
    borderColor: Colors.primary,
  },
  headerButtonDisabled: {
    backgroundColor: Colors.surfaceElevated,
    borderColor: Colors.border,
  },
  timelineContainer: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  mixerContainer: {
    backgroundColor: Colors.surfaceElevated,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  exportContainer: {
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    padding: Spacing.md,
  },
  transportContainer: {
    backgroundColor: Colors.surface,
    borderTopWidth: 2,
    borderTopColor: Colors.border,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  transportControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  transportButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  playButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  playButtonActive: {
    backgroundColor: Colors.warning,
    shadowColor: Colors.warning,
  },
  positionDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  positionText: {
    ...Typography.body,
    color: Colors.text,
    fontWeight: 'bold',
    fontVariant: ['tabular-nums'],
  },
  durationText: {
    ...Typography.body,
    color: Colors.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  bpmText: {
    ...Typography.body,
    color: Colors.primary,
    fontWeight: 'bold',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    ...Typography.h3,
    color: Colors.text,
  },
})