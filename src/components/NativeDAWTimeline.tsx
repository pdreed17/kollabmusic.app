/**
 * Native DAW Timeline Component
 *
 * A fully native React Native DAW timeline with:
 * - Multi-track editing and playback
 * - Drag & drop clips with snapping
 * - Native waveform visualization
 * - Advanced audio controls
 * - Undo/redo system
 * - Export/import functionality
 */

import React, { useState, useRef, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Dimensions,
  TouchableOpacity,
  PanResponder,
  Animated,
  Alert,
  Modal,
  TextInput,
  Switch,
  VirtualizedList,
} from 'react-native'
import Slider from '@react-native-community/slider'
import { Ionicons } from '@expo/vector-icons'
import { Audio, AVPlaybackStatus } from 'expo-av'
import { Colors, Typography, Spacing, BorderRadius } from '../constants/theme'
import {
  beatsToMs,
  msToBeats,
  snapToGrid,
  getBarDuration,
  getBeatDuration,
  DEFAULT_BPM,
  formatBeatsAsBars,
} from '../utils/bpmUtils'
import NativeWaveform from './NativeWaveform'

// =================== TYPES ===================

export interface DAWTrack {
  id: string
  name: string
  stemType: string
  duration: number
  startTime: number
  color: string
  volume: number // 0-1
  pan: number // -1 to 1
  isMuted: boolean
  isSoloed: boolean
  isPlaying: boolean
  audioFile?: string // file path
  waveformData?: number[] // for visualization
  effects?: TrackEffect[]
}

interface TrackEffect {
  id: string
  type: 'reverb' | 'delay' | 'eq' | 'compression'
  enabled: boolean
  parameters: { [key: string]: number }
}

interface DAWTimelineProps {
  tracks: DAWTrack[]
  currentPosition: number
  isPlaying: boolean
  bpm: number
  timeSignature: [number, number] // [beats per bar, note value]
  projectDuration: number
  loop: boolean
  metronome: boolean
  onTrackMove: (trackId: string, newStartTime: number) => void
  onTrackResize: (trackId: string, newDuration: number) => void
  onTrackVolumeChange: (trackId: string, volume: number) => void
  onTrackPanChange: (trackId: string, pan: number) => void
  onToggleMute: (trackId: string) => void
  onToggleSolo: (trackId: string) => void
  onTrackPlay: (trackId: string) => void
  onGlobalPlay: () => void
  onGlobalStop: () => void
  onSeekTo: (position: number) => void
  onBPMChange: (newBPM: number) => void
  onLoopToggle: () => void
  onMetronomeToggle: () => void
  onDuplicate: (trackId: string) => void
  onDelete: (trackId: string) => void
  onExportProject: () => void
  onImportProject: (projectData: any) => void
  onAddTrack: () => void
}

interface HistoryAction {
  type: 'MOVE' | 'RESIZE' | 'VOLUME' | 'PAN' | 'DUPLICATE' | 'DELETE' | 'ADD'
  trackId: string
  oldValue: any
  newValue: any
  timestamp: number
}

// =================== CONSTANTS ===================

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window')
const TRACK_HEIGHT = 120 // Increased for waveform display
const TRACK_SPACING = 8
const HEADER_HEIGHT = 60
const TRANSPORT_HEIGHT = 80
const PIXELS_PER_SECOND_BASE = 40
const MIN_ZOOM = 0.25
const MAX_ZOOM = 8
const SNAP_THRESHOLD = 10 // pixels

// =================== MAIN COMPONENT ===================

export default function NativeDAWTimeline({
  tracks,
  currentPosition,
  isPlaying,
  bpm,
  timeSignature,
  projectDuration,
  loop,
  metronome,
  onTrackMove,
  onTrackResize,
  onTrackVolumeChange,
  onTrackPanChange,
  onToggleMute,
  onToggleSolo,
  onTrackPlay,
  onGlobalPlay,
  onGlobalStop,
  onSeekTo,
  onBPMChange,
  onLoopToggle,
  onMetronomeToggle,
  onDuplicate,
  onDelete,
  onExportProject,
  onImportProject,
  onAddTrack,
}: DAWTimelineProps) {

  // =================== STATE ===================

  const [zoom, setZoom] = useState(1)
  const [selectedTrackIds, setSelectedTrackIds] = useState<string[]>([])
  const [dragState, setDragState] = useState<{
    trackId: string | null
    type: 'move' | 'resize-left' | 'resize-right' | null
    startX: number
    startValue: number
    isDragging: boolean
  }>({
    trackId: null,
    type: null,
    startX: 0,
    startValue: 0,
    isDragging: false,
  })

  const [history, setHistory] = useState<HistoryAction[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [showMixer, setShowMixer] = useState(false)
  const [showExportModal, setShowExportModal] = useState(false)

  // =================== REFS ===================

  const scrollViewRef = useRef<ScrollView>(null)
  const timelineScrollRef = useRef<ScrollView>(null)
  const playheadAnimationRef = useRef<Animated.Value>(new Animated.Value(0))

  // =================== CALCULATED VALUES ===================

  const pixelsPerSecond = PIXELS_PER_SECOND_BASE * zoom
  const timelineWidth = Math.max(SCREEN_WIDTH, projectDuration * pixelsPerSecond)
  const beatWidth = (60 / bpm) * pixelsPerSecond
  const barWidth = beatWidth * timeSignature[0]

  // =================== UTILITY FUNCTIONS ===================

  const pixelsToSeconds = useCallback((pixels: number) => {
    return pixels / pixelsPerSecond
  }, [pixelsPerSecond])

  const secondsToPixels = useCallback((seconds: number) => {
    return seconds * pixelsPerSecond
  }, [pixelsPerSecond])

  const snapTimeToGrid = useCallback((seconds: number) => {
    return snapToGrid(seconds, bpm, 0.25) // Snap to 16th notes
  }, [bpm])

  // =================== PLAYHEAD ANIMATION ===================

  useEffect(() => {
    if (isPlaying) {
      Animated.timing(playheadAnimationRef.current, {
        toValue: secondsToPixels(projectDuration),
        duration: (projectDuration - currentPosition) * 1000,
        useNativeDriver: false,
      }).start()
    } else {
      playheadAnimationRef.current.stopAnimation()
      playheadAnimationRef.current.setValue(secondsToPixels(currentPosition))
    }
  }, [isPlaying, currentPosition, projectDuration, secondsToPixels])

  // =================== DRAG & DROP ===================

  const createPanResponder = (trackId: string, type: 'move' | 'resize-left' | 'resize-right', initialValue: number) => {
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dx) > 5,

      onPanResponderGrant: (evt) => {
        setDragState({
          trackId,
          type,
          startX: evt.nativeEvent.pageX,
          startValue: initialValue,
          isDragging: true,
        })
        setSelectedTrackIds([trackId])
      },

      onPanResponderMove: (_, gestureState) => {
        if (!dragState.isDragging) return

        const deltaPixels = gestureState.dx
        const deltaSeconds = pixelsToSeconds(deltaPixels)

        const track = tracks.find(t => t.id === trackId)
        if (!track) return

        switch (type) {
          case 'move':
            const newStartTime = Math.max(0, snapTimeToGrid(dragState.startValue + deltaSeconds))
            onTrackMove(trackId, newStartTime)
            break

          case 'resize-right':
            const newDuration = Math.max(0.1, snapTimeToGrid(dragState.startValue + deltaSeconds))
            onTrackResize(trackId, newDuration)
            break

          case 'resize-left':
            // Resize from left (change start time and duration)
            const newLeft = Math.max(0, snapTimeToGrid(dragState.startValue + deltaSeconds))
            const deltaTime = newLeft - track.startTime
            onTrackMove(trackId, newLeft)
            onTrackResize(trackId, Math.max(0.1, track.duration - deltaTime))
            break
        }
      },

      onPanResponderRelease: () => {
        if (dragState.isDragging) {
          // Add to history
          const track = tracks.find(t => t.id === trackId)
          if (track) {
            addToHistory({
              type: type === 'move' ? 'MOVE' : 'RESIZE',
              trackId,
              oldValue: dragState.startValue,
              newValue: type === 'move' ? track.startTime : track.duration,
              timestamp: Date.now(),
            })
          }
        }

        setDragState({
          trackId: null,
          type: null,
          startX: 0,
          startValue: 0,
          isDragging: false,
        })
      },
    })
  }

  // =================== HISTORY MANAGEMENT ===================

  const addToHistory = useCallback((action: HistoryAction) => {
    setHistory(prev => [...prev.slice(0, historyIndex + 1), action])
    setHistoryIndex(prev => prev + 1)
  }, [historyIndex])

  const undo = useCallback(() => {
    if (historyIndex < 0) return

    const action = history[historyIndex]
    const track = tracks.find(t => t.id === action.trackId)
    if (!track) return

    switch (action.type) {
      case 'MOVE':
        onTrackMove(action.trackId, action.oldValue)
        break
      case 'RESIZE':
        onTrackResize(action.trackId, action.oldValue)
        break
      case 'VOLUME':
        onTrackVolumeChange(action.trackId, action.oldValue)
        break
      case 'PAN':
        onTrackPanChange(action.trackId, action.oldValue)
        break
    }

    setHistoryIndex(prev => prev - 1)
  }, [history, historyIndex, tracks, onTrackMove, onTrackResize, onTrackVolumeChange, onTrackPanChange])

  const redo = useCallback(() => {
    if (historyIndex >= history.length - 1) return

    const nextIndex = historyIndex + 1
    const action = history[nextIndex]

    switch (action.type) {
      case 'MOVE':
        onTrackMove(action.trackId, action.newValue)
        break
      case 'RESIZE':
        onTrackResize(action.trackId, action.newValue)
        break
      case 'VOLUME':
        onTrackVolumeChange(action.trackId, action.newValue)
        break
      case 'PAN':
        onTrackPanChange(action.trackId, action.newValue)
        break
    }

    setHistoryIndex(nextIndex)
  }, [history, historyIndex, onTrackMove, onTrackResize, onTrackVolumeChange, onTrackPanChange])

  // =================== RENDER FUNCTIONS ===================

  const renderTimeRuler = () => {
    const ticks = []
    const barCount = Math.ceil(projectDuration / (60 / bpm * timeSignature[0]))

    for (let bar = 0; bar <= barCount; bar++) {
      const barTimeSeconds = bar * (60 / bpm * timeSignature[0])
      const x = secondsToPixels(barTimeSeconds)

      // Major tick (bar)
      ticks.push(
        <View key={`bar-${bar}`} style={[styles.timeTick, { left: x }]}>
          <View style={styles.majorTick} />
          <Text style={styles.timeLabel}>
            {formatBeatsAsBars(bar * timeSignature[0], timeSignature)}
          </Text>
        </View>
      )

      // Minor ticks (beats)
      for (let beat = 1; beat < timeSignature[0]; beat++) {
        const beatTimeSeconds = barTimeSeconds + beat * (60 / bpm)
        const beatX = secondsToPixels(beatTimeSeconds)

        ticks.push(
          <View key={`beat-${bar}-${beat}`} style={[styles.timeTick, { left: beatX }]}>
            <View style={styles.minorTick} />
          </View>
        )
      }
    }

    return (
      <View style={[styles.timeRuler, { width: timelineWidth }]}>
        {ticks}
      </View>
    )
  }

  const renderTrack = (track: DAWTrack, index: number) => {
    const trackLeft = secondsToPixels(track.startTime)
    const trackWidth = secondsToPixels(track.duration)
    const isSelected = selectedTrackIds.includes(track.id)
    const isDragging = dragState.trackId === track.id && dragState.isDragging

    const movePanResponder = createPanResponder(track.id, 'move', track.startTime)
    const resizeLeftPanResponder = createPanResponder(track.id, 'resize-left', track.startTime)
    const resizeRightPanResponder = createPanResponder(track.id, 'resize-right', track.duration)

    return (
      <View
        key={track.id}
        style={[
          styles.trackContainer,
          {
            top: index * (TRACK_HEIGHT + TRACK_SPACING),
            height: TRACK_HEIGHT,
          },
        ]}
      >
        {/* Track Header */}
        <View style={styles.trackHeader}>
          <Text style={styles.trackName} numberOfLines={1}>
            {track.name}
          </Text>
          <Text style={styles.trackType}>{track.stemType}</Text>

          {/* Track Controls */}
          <View style={styles.trackControls}>
            <TouchableOpacity
              style={[styles.controlButton, track.isMuted && styles.controlButtonActive]}
              onPress={() => onToggleMute(track.id)}
            >
              <Text style={styles.controlButtonText}>M</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.controlButton, track.isSoloed && styles.controlButtonActive]}
              onPress={() => onToggleSolo(track.id)}
            >
              <Text style={styles.controlButtonText}>S</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.playButton}
              onPress={() => onTrackPlay(track.id)}
            >
              <Ionicons
                name={track.isPlaying ? 'pause' : 'play'}
                size={16}
                color={Colors.primary}
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Track Lane */}
        <View style={styles.trackLane}>
          {/* Audio Clip */}
          <View
            style={[
              styles.audioClip,
              {
                left: trackLeft,
                width: Math.max(trackWidth, 60),
                backgroundColor: track.color,
                opacity: isDragging ? 0.7 : 1,
                borderColor: isSelected ? Colors.primary : track.color,
                borderWidth: isSelected ? 2 : 1,
              },
            ]}
          >
            {/* Main clip area - draggable */}
            <View
              {...movePanResponder.panHandlers}
              style={styles.clipContent}
            >
              <Text style={styles.clipName} numberOfLines={1}>
                {track.name}
              </Text>

              {/* Native Waveform */}
              <NativeWaveform
                data={track.waveformData || []}
                width={trackWidth - 20}
                height={40}
                color="#FFF"
                opacity={0.7}
              />
            </View>

            {/* Resize handles */}
            <View
              {...resizeLeftPanResponder.panHandlers}
              style={[styles.resizeHandle, styles.resizeHandleLeft]}
            />
            <View
              {...resizeRightPanResponder.panHandlers}
              style={[styles.resizeHandle, styles.resizeHandleRight]}
            />
          </View>
        </View>
      </View>
    )
  }

  const renderTransportControls = () => (
    <View style={styles.transportControls}>
      <View style={styles.transportLeft}>
        <TouchableOpacity style={styles.transportButton} onPress={onGlobalStop}>
          <Ionicons name="stop" size={24} color={Colors.text} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.transportButton} onPress={onGlobalPlay}>
          <Ionicons name={isPlaying ? 'pause' : 'play'} size={24} color={Colors.primary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.transportButton, loop && styles.transportButtonActive]}
          onPress={onLoopToggle}
        >
          <Ionicons name="repeat" size={20} color={loop ? Colors.primary : Colors.text} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.transportButton, metronome && styles.transportButtonActive]}
          onPress={onMetronomeToggle}
        >
          <Ionicons name="timer" size={20} color={metronome ? Colors.primary : Colors.text} />
        </TouchableOpacity>
      </View>

      <View style={styles.transportCenter}>
        <Text style={styles.timeDisplay}>
          {formatTime(currentPosition)} / {formatTime(projectDuration)}
        </Text>
      </View>

      <View style={styles.transportRight}>
        <TouchableOpacity style={styles.transportButton} onPress={undo}>
          <Ionicons name="arrow-undo" size={20} color={historyIndex >= 0 ? Colors.text : Colors.textSecondary} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.transportButton} onPress={redo}>
          <Ionicons name="arrow-redo" size={20} color={historyIndex < history.length - 1 ? Colors.text : Colors.textSecondary} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.transportButton} onPress={() => setShowMixer(!showMixer)}>
          <Ionicons name="options" size={20} color={showMixer ? Colors.primary : Colors.text} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.transportButton} onPress={() => setShowExportModal(true)}>
          <Ionicons name="download" size={20} color={Colors.text} />
        </TouchableOpacity>
      </View>
    </View>
  )

  const renderMixer = () => (
    <View style={styles.mixer}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {tracks.map((track) => (
          <View key={track.id} style={styles.mixerChannel}>
            <Text style={styles.mixerLabel}>{track.name}</Text>

            {/* Volume */}
            <View style={styles.mixerControl}>
              <Text style={styles.mixerControlLabel}>Vol</Text>
              <Slider
                style={styles.verticalSlider}
                minimumValue={0}
                maximumValue={1}
                value={track.volume}
                onValueChange={(value) => onTrackVolumeChange(track.id, value)}
                minimumTrackTintColor={Colors.primary}
                maximumTrackTintColor={Colors.border}
                thumbStyle={{ backgroundColor: Colors.primary }}
              />
              <Text style={styles.mixerValue}>{Math.round(track.volume * 100)}</Text>
            </View>

            {/* Pan */}
            <View style={styles.mixerControl}>
              <Text style={styles.mixerControlLabel}>Pan</Text>
              <Slider
                style={styles.verticalSlider}
                minimumValue={-1}
                maximumValue={1}
                value={track.pan}
                onValueChange={(value) => onTrackPanChange(track.id, value)}
                minimumTrackTintColor={Colors.primary}
                maximumTrackTintColor={Colors.border}
                thumbStyle={{ backgroundColor: Colors.primary }}
              />
              <Text style={styles.mixerValue}>{track.pan > 0 ? 'R' : track.pan < 0 ? 'L' : 'C'}</Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  )

  // =================== UTILITY FUNCTIONS ===================

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    const ms = Math.floor((seconds % 1) * 100)
    return `${minutes}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`
  }

  // =================== MAIN RENDER ===================

  return (
    <View style={styles.container}>
      {/* Header with BPM and Zoom */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerLabel}>BPM:</Text>
          <TextInput
            style={styles.bpmInput}
            value={bpm.toString()}
            onChangeText={(text) => {
              const newBPM = parseInt(text) || 120
              if (newBPM >= 60 && newBPM <= 200) {
                onBPMChange(newBPM)
              }
            }}
            keyboardType="number-pad"
          />
        </View>

        <View style={styles.headerCenter}>
          <TouchableOpacity style={styles.addButton} onPress={onAddTrack}>
            <Ionicons name="add" size={24} color={Colors.primary} />
            <Text style={styles.addButtonText}>Add Track</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.headerRight}>
          <Text style={styles.headerLabel}>Zoom:</Text>
          <TouchableOpacity
            style={styles.zoomButton}
            onPress={() => setZoom(Math.max(MIN_ZOOM, zoom - 0.25))}
          >
            <Ionicons name="remove" size={16} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.zoomText}>{Math.round(zoom * 100)}%</Text>
          <TouchableOpacity
            style={styles.zoomButton}
            onPress={() => setZoom(Math.min(MAX_ZOOM, zoom + 0.25))}
          >
            <Ionicons name="add" size={16} color={Colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Time Ruler */}
      <ScrollView
        ref={timelineScrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
      >
        {renderTimeRuler()}
      </ScrollView>

      {/* Main Timeline */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.timelineScrollView}
        contentContainerStyle={{ paddingBottom: TRANSPORT_HEIGHT + (showMixer ? 120 : 0) }}
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={true}
          scrollEventThrottle={16}
          onScroll={(event) => {
            // Sync with time ruler
            timelineScrollRef.current?.scrollTo({
              x: event.nativeEvent.contentOffset.x,
              animated: false,
            })
          }}
        >
          <View style={[styles.timeline, { width: timelineWidth, height: tracks.length * (TRACK_HEIGHT + TRACK_SPACING) + 100 }]}>
            {/* Grid lines */}
            {Array.from({ length: Math.floor(projectDuration / (60 / bpm)) }, (_, i) => (
              <View
                key={i}
                style={[
                  styles.gridLine,
                  {
                    left: secondsToPixels(i * (60 / bpm)),
                    height: tracks.length * (TRACK_HEIGHT + TRACK_SPACING),
                  },
                ]}
              />
            ))}

            {/* Tracks */}
            {tracks.map((track, index) => renderTrack(track, index))}

            {/* Playhead */}
            <Animated.View
              style={[
                styles.playhead,
                {
                  left: playheadAnimationRef.current,
                  height: tracks.length * (TRACK_HEIGHT + TRACK_SPACING),
                },
              ]}
            />
          </View>
        </ScrollView>
      </ScrollView>

      {/* Transport Controls */}
      {renderTransportControls()}

      {/* Mixer */}
      {showMixer && renderMixer()}

      {/* Export Modal */}
      <Modal visible={showExportModal} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Export Project</Text>
            <TouchableOpacity onPress={() => setShowExportModal(false)}>
              <Ionicons name="close" size={24} color={Colors.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.modalContent}>
            <TouchableOpacity style={styles.exportButton} onPress={onExportProject}>
              <Ionicons name="download" size={20} color={Colors.primary} />
              <Text style={styles.exportButtonText}>Export as JSON</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  )
}

// =================== STYLES ===================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    height: HEADER_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  headerLabel: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  bpmInput: {
    ...Typography.body,
    color: Colors.text,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    minWidth: 50,
    textAlign: 'center',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  addButtonText: {
    ...Typography.body,
    color: Colors.primary,
    fontWeight: '600',
  },
  zoomButton: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  zoomText: {
    ...Typography.caption,
    color: Colors.text,
    fontWeight: '600',
    minWidth: 40,
    textAlign: 'center',
  },
  timeRuler: {
    height: 40,
    backgroundColor: Colors.surfaceElevated,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    position: 'relative',
  },
  timeTick: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  majorTick: {
    width: 2,
    height: 20,
    backgroundColor: Colors.text,
  },
  minorTick: {
    width: 1,
    height: 10,
    backgroundColor: Colors.textSecondary,
  },
  timeLabel: {
    ...Typography.caption,
    color: Colors.text,
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },
  timelineScrollView: {
    flex: 1,
  },
  timeline: {
    position: 'relative',
    backgroundColor: Colors.backgroundDark,
  },
  gridLine: {
    position: 'absolute',
    top: 0,
    width: 1,
    backgroundColor: Colors.border,
    opacity: 0.3,
  },
  trackContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
  },
  trackHeader: {
    width: 200,
    backgroundColor: Colors.surface,
    borderRightWidth: 1,
    borderRightColor: Colors.border,
    padding: Spacing.sm,
    justifyContent: 'space-between',
  },
  trackName: {
    ...Typography.bodyLarge,
    color: Colors.text,
    fontWeight: '600',
  },
  trackType: {
    ...Typography.caption,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
  },
  trackControls: {
    flexDirection: 'row',
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  controlButton: {
    width: 24,
    height: 24,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  controlButtonActive: {
    backgroundColor: Colors.primary,
  },
  controlButtonText: {
    ...Typography.caption,
    color: Colors.text,
    fontWeight: '700',
    fontSize: 10,
  },
  playButton: {
    width: 24,
    height: 24,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  trackLane: {
    flex: 1,
    position: 'relative',
    marginLeft: 200,
  },
  audioClip: {
    position: 'absolute',
    top: 8,
    height: TRACK_HEIGHT - 16,
    borderRadius: BorderRadius.sm,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  clipContent: {
    flex: 1,
    padding: Spacing.sm,
  },
  clipName: {
    ...Typography.bodySmall,
    color: '#FFF',
    fontWeight: '600',
    marginBottom: Spacing.xs,
  },
  resizeHandle: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 8,
    backgroundColor: 'transparent',
  },
  resizeHandleLeft: {
    left: 0,
    borderLeftWidth: 2,
    borderLeftColor: '#FFF',
  },
  resizeHandleRight: {
    right: 0,
    borderRightWidth: 2,
    borderRightColor: '#FFF',
  },
  playhead: {
    position: 'absolute',
    top: 0,
    width: 2,
    backgroundColor: Colors.error,
    zIndex: 1000,
  },
  transportControls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: TRANSPORT_HEIGHT,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    justifyContent: 'space-between',
  },
  transportLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  transportCenter: {
    flex: 1,
    alignItems: 'center',
  },
  transportRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  transportButton: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  transportButtonActive: {
    backgroundColor: Colors.primaryLight,
  },
  timeDisplay: {
    ...Typography.bodyLarge,
    color: Colors.text,
    fontFamily: 'monospace',
    fontWeight: '600',
  },
  mixer: {
    position: 'absolute',
    bottom: TRANSPORT_HEIGHT,
    left: 0,
    right: 0,
    height: 120,
    backgroundColor: Colors.surfaceElevated,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingVertical: Spacing.sm,
  },
  mixerChannel: {
    width: 80,
    alignItems: 'center',
    padding: Spacing.sm,
  },
  mixerLabel: {
    ...Typography.caption,
    color: Colors.text,
    fontWeight: '600',
    marginBottom: Spacing.xs,
  },
  mixerControl: {
    alignItems: 'center',
    marginVertical: Spacing.xs,
  },
  mixerControlLabel: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontSize: 10,
  },
  verticalSlider: {
    width: 20,
    height: 60,
    transform: [{ rotate: '-90deg' }],
  },
  mixerValue: {
    ...Typography.caption,
    color: Colors.text,
    fontSize: 10,
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  modalHeader: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: {
    ...Typography.h3,
    color: Colors.text,
  },
  modalContent: {
    flex: 1,
    padding: Spacing.lg,
  },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  exportButtonText: {
    ...Typography.bodyLarge,
    color: Colors.primary,
    fontWeight: '600',
  },
})