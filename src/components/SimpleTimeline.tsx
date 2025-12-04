import React, { useState, useRef } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Dimensions,
  TouchableOpacity,
  PanResponder,
  Modal,
  TextInput,
  Alert,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Colors, Typography, Spacing, BorderRadius } from '../constants/theme'
import { beatsToMs, getBarDuration, getBeatDuration, DEFAULT_BPM } from '../utils/bpmUtils'

type Track = {
  id: string
  name: string
  stemType: string
  duration: number
  startTime: number
  color: string
  isMuted: boolean
  isSoloed: boolean
  isPlaying: boolean
}

type SimpleTimelineProps = {
  tracks: Track[]
  currentPosition: number
  isPlaying: boolean
  bpm?: number
  onTrackMove: (trackId: string, newStartTime: number) => void
  onTrackPress: (trackId: string) => void
  onToggleMute: (trackId: string) => void
  onToggleSolo: (trackId: string) => void
  onTrackPlay: (trackId: string) => void
  onDuplicate: (trackId: string) => void
  onDelete: (trackId: string) => void
  onEditTrack: (trackId: string, name: string, stemType: string, color: string) => void
  onGlobalPlay: () => void
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window')
const TRACK_HEIGHT = 80
const TRACK_SPACING = 12
const TIMELINE_HEIGHT = 100
const BASE_PIXELS_PER_SECOND = 60
const MIN_ZOOM = 0.5
const MAX_ZOOM = 4
const ZOOM_STEP = 0.5

// Stem type color options
const STEM_COLORS = [
  { name: 'Vocals', color: '#FF6B6B' },
  { name: 'Drums', color: '#4ECDC4' },
  { name: 'Bass', color: '#45B7D1' },
  { name: 'Guitar', color: '#FFA07A' },
  { name: 'Piano', color: '#98D8C8' },
  { name: 'Synth', color: '#C7A3D9' },
  { name: 'Other', color: '#95A5A6' },
]

const STEM_TYPES = ['vocals', 'drums', 'bass', 'guitar', 'piano', 'synth', 'other']

export default function SimpleTimeline({
  tracks,
  currentPosition,
  isPlaying,
  bpm = DEFAULT_BPM,
  onTrackMove,
  onTrackPress,
  onToggleMute,
  onToggleSolo,
  onTrackPlay,
  onDuplicate,
  onDelete,
  onEditTrack,
  onGlobalPlay,
}: SimpleTimelineProps) {
  const [draggingTrackId, setDraggingTrackId] = useState<string | null>(null)
  const [editingTrack, setEditingTrack] = useState<Track | null>(null)
  const [editName, setEditName] = useState('')
  const [editStemType, setEditStemType] = useState('')
  const [editColor, setEditColor] = useState('')
  const [isModalMinimized, setIsModalMinimized] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [scrollX, setScrollX] = useState(0)
  const scrollViewRef = useRef<ScrollView>(null)
  const horizontalScrollRef = useRef<ScrollView>(null)

  // Pinch zoom handling
  const baseZoom = useRef(zoom)
  const pinchGesture = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: () => false,
    })
  ).current

  // Calculate timeline width based on longest track and zoom
  const PIXELS_PER_SECOND = BASE_PIXELS_PER_SECOND * zoom
  const maxEndTime = Math.max(...tracks.map(t => t.startTime + t.duration), 120000) // Min 2 minutes
  const timelineWidth = (maxEndTime / 1000) * PIXELS_PER_SECOND

  // Convert milliseconds to pixels
  const msToPixels = (ms: number) => {
    return (ms / 1000) * PIXELS_PER_SECOND
  }

  // Convert pixels to milliseconds
  const pixelsToMs = (pixels: number) => {
    return (pixels / PIXELS_PER_SECOND) * 1000
  }

  // Format time for ruler
  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  // Generate time markers - 10 second intervals
  const generateTimeMarkers = () => {
    const markers = []
    const interval = 10000 // 10 seconds

    for (let time = 0; time <= maxEndTime; time += interval) {
      markers.push({
        time,
        interval,
        leftPx: msToPixels(time)
      })
    }
    return markers
  }

  // Generate beat/bar grid markers
  const generateBeatMarkers = () => {
    const markers = []
    const beatDuration = getBeatDuration(bpm) // ms per beat
    const barDuration = getBarDuration(bpm) // ms per bar (4 beats)

    // Generate beat markers up to maxEndTime
    for (let time = 0; time <= maxEndTime; time += beatDuration) {
      const isBarStart = Math.abs(time % barDuration) < 1 // Check if this is a bar boundary
      markers.push({
        time,
        isBarStart,
        leftPx: msToPixels(time),
      })
    }
    return markers
  }

  // Handle edit track modal
  const openEditModal = (track: Track) => {
    setEditingTrack(track)
    setEditName(track.name)
    setEditStemType(track.stemType)
    setEditColor(track.color)
    setIsModalMinimized(false)
  }

  const closeEditModal = () => {
    setEditingTrack(null)
    setIsModalMinimized(false)
  }

  const saveEdit = () => {
    if (editingTrack && editName.trim()) {
      onEditTrack(editingTrack.id, editName.trim(), editStemType, editColor)
      closeEditModal()
    }
  }

  const handleDelete = () => {
    if (editingTrack) {
      Alert.alert(
        'Delete Track',
        `Are you sure you want to delete "${editingTrack.name}"?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => {
              onDelete(editingTrack.id)
              closeEditModal()
            },
          },
        ]
      )
    }
  }

  // Create pan responder for dragging
  const createPanResponder = (track: Track) => {
    let initialStartTime = track.startTime
    let hasMoved = false

    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Start dragging after 3px movement to allow taps
        return Math.abs(gestureState.dx) > 3
      },
      onPanResponderGrant: () => {
        initialStartTime = track.startTime
        hasMoved = false
        setDraggingTrackId(track.id)
      },
      onPanResponderMove: (_, gestureState) => {
        if (Math.abs(gestureState.dx) > 3) {
          hasMoved = true
          const newStartTime = Math.max(0, initialStartTime + pixelsToMs(gestureState.dx))
          onTrackMove(track.id, newStartTime)
        }
      },
      onPanResponderRelease: () => {
        setDraggingTrackId(null)
      },
    })
  }

  const timeMarkers = generateTimeMarkers()
  const beatMarkers = generateBeatMarkers()

  return (
    <View style={styles.container}>
      {/* Unified Timeline Area - All tracks on same grid */}
      <ScrollView style={styles.tracksScrollView} showsVerticalScrollIndicator={true}>
        <ScrollView
          ref={horizontalScrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          scrollEnabled={true}
          onScroll={(e) => setScrollX(e.nativeEvent.contentOffset.x)}
          scrollEventThrottle={16}
          pinchGestureEnabled={true}
          maximumZoomScale={MAX_ZOOM}
          minimumZoomScale={MIN_ZOOM}
        >
          <View
            style={[
              styles.tracksContainer,
              {
                width: Math.max(timelineWidth, SCREEN_WIDTH),
                height: Math.max(400, tracks.length * (TRACK_HEIGHT + TRACK_SPACING) + Spacing.lg),
              },
            ]}
          >
            {/* Beat/Bar Grid Background */}
            {beatMarkers.map((marker, i) => (
              <View
                key={`beat-${i}`}
                style={[
                  styles.beatMarker,
                  { left: marker.leftPx },
                  marker.isBarStart && styles.barMarker,
                ]}
              />
            ))}

            {/* Time Grid Lines - 10 sec intervals */}
            {timeMarkers.map((marker, i) => (
              <View
                key={`grid-${i}`}
                style={[styles.gridLine, { left: marker.leftPx }]}
              />
            ))}

            {/* Global Playhead */}
            {isPlaying && (
              <View
                style={[
                  styles.globalPlayhead,
                  {
                    left: msToPixels(currentPosition),
                    height: tracks.length * (TRACK_HEIGHT + TRACK_SPACING),
                  },
                ]}
              >
                <View style={styles.playheadHandle} />
              </View>
            )}

            {/* All Tracks Overlaid on Timeline */}
            {tracks.map((track, index) => {
              const clipWidth = msToPixels(track.duration)
              const clipLeft = msToPixels(track.startTime)
              const trackTop = index * (TRACK_HEIGHT + TRACK_SPACING)
              const isDragging = draggingTrackId === track.id
              const panResponder = createPanResponder(track)

              return (
                <View
                  key={track.id}
                  {...panResponder.panHandlers}
                  style={[
                    styles.trackBar,
                    {
                      backgroundColor: track.color,
                      left: clipLeft,
                      top: trackTop,
                      width: Math.max(clipWidth, 180),
                      opacity: isDragging ? 0.7 : 1,
                      borderWidth: isDragging ? 3 : 1,
                      borderColor: isDragging ? '#FFF' : 'rgba(0,0,0,0.2)',
                      zIndex: isDragging ? 1000 : index,
                    },
                  ]}
                >
                  <View style={styles.trackBarContent}>
                    {/* Track Info - always visible */}
                    <View style={styles.trackInfo}>
                      <Text style={styles.trackBarName} numberOfLines={1}>
                        {track.name}
                      </Text>
                      <Text style={styles.trackBarType}>
                        {track.stemType.toUpperCase()} • {formatTime(track.duration)}
                      </Text>
                    </View>
                  </View>

                  {/* Sticky Control Buttons - follow scroll */}
                  <View style={[styles.stickyControls, { left: scrollX + 8 }]}>
                    <TouchableOpacity
                      style={[styles.barButton, track.isPlaying && styles.barButtonActive]}
                      onPress={() => onTrackPlay(track.id)}
                    >
                      <Ionicons
                        name={track.isPlaying ? 'pause' : 'play'}
                        size={14}
                        color="#FFF"
                      />
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.barButton, track.isMuted && styles.barButtonActive]}
                      onPress={() => onToggleMute(track.id)}
                    >
                      <Ionicons
                        name={track.isMuted ? 'volume-mute' : 'volume-medium'}
                        size={14}
                        color="#FFF"
                      />
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.barButton, track.isSoloed && styles.barButtonActive]}
                      onPress={() => onToggleSolo(track.id)}
                    >
                      <Text style={styles.soloText}>S</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.barButton}
                      onPress={() => onDuplicate(track.id)}
                    >
                      <Ionicons name="copy-outline" size={14} color="#FFF" />
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.barButton}
                      onPress={() => openEditModal(track)}
                    >
                      <Ionicons name="create-outline" size={14} color="#FFF" />
                    </TouchableOpacity>
                  </View>
                </View>
              )
            })}

            {/* Empty state */}
            {tracks.length === 0 && (
              <View style={styles.emptyState}>
                <Ionicons name="musical-notes-outline" size={48} color={Colors.textSecondary} />
                <Text style={styles.emptyStateText}>No tracks on timeline</Text>
                <Text style={styles.emptyStateSubtext}>Upload audio files to get started</Text>
              </View>
            )}
          </View>
        </ScrollView>
      </ScrollView>

      {/* Timeline Footer - Fixed at bottom */}
      <View style={styles.timelineFooter}>
        {/* Global Play Button */}
        <TouchableOpacity style={styles.globalPlayButton} onPress={onGlobalPlay}>
          <Ionicons
            name={isPlaying ? 'pause' : 'play'}
            size={24}
            color="#FFF"
          />
        </TouchableOpacity>

        {/* Zoom Controls */}
        <View style={styles.zoomControls}>
          <TouchableOpacity
            style={[styles.zoomButton, zoom <= MIN_ZOOM && styles.zoomButtonDisabled]}
            onPress={() => setZoom(Math.max(MIN_ZOOM, zoom - ZOOM_STEP))}
            disabled={zoom <= MIN_ZOOM}
          >
            <Ionicons name="remove" size={16} color={zoom <= MIN_ZOOM ? Colors.textSecondary : Colors.text} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.zoomResetButton} onPress={() => setZoom(1)}>
            <Text style={styles.zoomText}>{Math.round(zoom * 100)}%</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.zoomButton, zoom >= MAX_ZOOM && styles.zoomButtonDisabled]}
            onPress={() => setZoom(Math.min(MAX_ZOOM, zoom + ZOOM_STEP))}
            disabled={zoom >= MAX_ZOOM}
          >
            <Ionicons name="add" size={16} color={zoom >= MAX_ZOOM ? Colors.textSecondary : Colors.text} />
          </TouchableOpacity>
        </View>

        {/* Time Ruler */}
        <ScrollView
          ref={scrollViewRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.rulerScroll}
        >
          <View style={[styles.ruler, { width: Math.max(timelineWidth, SCREEN_WIDTH - 100) }]}>
            {timeMarkers.map((marker, i) => (
              <View
                key={`time-${i}`}
                style={[styles.timeMarker, { left: msToPixels(marker.time) }]}
              >
                <Text style={styles.timeMarkerText}>{formatTime(marker.time)}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      </View>

      {/* Edit Track Modal */}
      {editingTrack && (
        <Modal
          visible={true}
          transparent={true}
          animationType="slide"
          onRequestClose={closeEditModal}
        >
          <View style={styles.modalOverlay}>
            <View style={[
              styles.modalContent,
              isModalMinimized && styles.modalMinimized
            ]}>
              {/* Modal Header */}
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {isModalMinimized ? editingTrack.name : 'Edit Track'}
                </Text>
                <View style={styles.modalHeaderButtons}>
                  <TouchableOpacity
                    onPress={() => setIsModalMinimized(!isModalMinimized)}
                    style={styles.modalHeaderButton}
                  >
                    <Ionicons
                      name={isModalMinimized ? 'chevron-up' : 'chevron-down'}
                      size={24}
                      color={Colors.text}
                    />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={closeEditModal} style={styles.modalHeaderButton}>
                    <Ionicons name="close" size={24} color={Colors.text} />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Modal Body - Hidden when minimized */}
              {!isModalMinimized && (
                <ScrollView
                  style={styles.modalBodyScroll}
                  contentContainerStyle={styles.modalBody}
                >
                  {/* Track Name */}
                  <Text style={styles.fieldLabel}>Track Name</Text>
                  <TextInput
                    style={styles.input}
                    value={editName}
                    onChangeText={setEditName}
                    placeholder="Enter track name"
                    placeholderTextColor={Colors.textSecondary}
                  />

                  {/* Stem Type */}
                  <Text style={styles.fieldLabel}>Audio Type</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.stemTypeScroll}>
                    {STEM_TYPES.map((type) => (
                      <TouchableOpacity
                        key={type}
                        style={[
                          styles.stemTypeButton,
                          editStemType === type && styles.stemTypeButtonActive
                        ]}
                        onPress={() => setEditStemType(type)}
                      >
                        <Text style={[
                          styles.stemTypeText,
                          editStemType === type && styles.stemTypeTextActive
                        ]}>
                          {type.charAt(0).toUpperCase() + type.slice(1)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>

                  {/* Color Picker */}
                  <Text style={styles.fieldLabel}>Track Color</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.colorScroll}>
                    {STEM_COLORS.map((item) => (
                      <TouchableOpacity
                        key={item.color}
                        style={[
                          styles.colorButton,
                          { backgroundColor: item.color },
                          editColor === item.color && styles.colorButtonActive
                        ]}
                        onPress={() => setEditColor(item.color)}
                      >
                        {editColor === item.color && (
                          <Ionicons name="checkmark" size={20} color="#FFF" />
                        )}
                      </TouchableOpacity>
                    ))}
                  </ScrollView>

                  {/* Action Buttons */}
                  <View style={styles.modalActions}>
                    <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
                      <Ionicons name="trash-outline" size={20} color="#FFF" />
                      <Text style={styles.deleteButtonText}>Delete</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.saveButton} onPress={saveEdit}>
                      <Ionicons name="checkmark" size={20} color="#FFF" />
                      <Text style={styles.saveButtonText}>Save</Text>
                    </TouchableOpacity>
                  </View>
                </ScrollView>
              )}
            </View>
          </View>
        </Modal>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.backgroundDark,
  },
  timelineFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: TIMELINE_HEIGHT,
    backgroundColor: Colors.surface,
    borderTopWidth: 2,
    borderTopColor: Colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  globalPlayButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.sm,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  zoomControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginRight: Spacing.sm,
  },
  zoomButton: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  zoomButtonDisabled: {
    opacity: 0.3,
  },
  zoomResetButton: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.border,
    minWidth: 50,
    alignItems: 'center',
  },
  zoomText: {
    ...Typography.caption,
    color: Colors.text,
    fontWeight: '600',
    fontSize: 11,
  },
  rulerScroll: {
    flex: 1,
  },
  ruler: {
    height: 40,
    position: 'relative',
    paddingTop: Spacing.xs,
  },
  timeMarker: {
    position: 'absolute',
    top: 0,
    alignItems: 'center',
  },
  timeMarkerText: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontSize: 10,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  tracksScrollView: {
    flex: 1,
  },
  tracksContainer: {
    position: 'relative',
    paddingVertical: Spacing.md,
    paddingBottom: TIMELINE_HEIGHT + Spacing.md,
  },
  gridLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: Colors.textSecondary,
    opacity: 0.4,
  },
  beatMarker: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: Colors.border,
    opacity: 0.3,
  },
  barMarker: {
    width: 2,
    backgroundColor: Colors.textSecondary,
    opacity: 0.5,
  },
  globalPlayhead: {
    position: 'absolute',
    top: 0,
    width: 3,
    backgroundColor: Colors.primary,
    zIndex: 10000,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
  },
  playheadHandle: {
    width: 14,
    height: 14,
    backgroundColor: Colors.primary,
    borderRadius: 7,
    position: 'absolute',
    top: -7,
    left: -5.5,
    borderWidth: 3,
    borderColor: '#FFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  trackBar: {
    position: 'absolute',
    height: TRACK_HEIGHT,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  trackBarContent: {
    flex: 1,
    padding: Spacing.sm,
    justifyContent: 'space-between',
  },
  trackInfo: {
    marginBottom: Spacing.xs,
  },
  trackBarName: {
    ...Typography.bodyLarge,
    color: '#FFF',
    fontWeight: '700',
    fontSize: 14,
    marginBottom: 2,
  },
  trackBarType: {
    ...Typography.caption,
    color: 'rgba(255,255,255,0.8)',
    fontSize: 10,
    fontWeight: '600',
  },
  stickyControls: {
    position: 'absolute',
    bottom: 8,
    flexDirection: 'row',
    gap: 6,
    zIndex: 100,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },
  trackBarControls: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  barButton: {
    width: 28,
    height: 28,
    borderRadius: BorderRadius.sm,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  barButtonActive: {
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderColor: 'rgba(255,255,255,0.5)',
  },
  soloText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 11,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xxxl * 3,
  },
  emptyStateText: {
    ...Typography.h4,
    color: Colors.textSecondary,
    marginTop: Spacing.md,
  },
  emptyStateSubtext: {
    ...Typography.body,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },

  // Edit Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    maxHeight: SCREEN_HEIGHT * 0.7,
  },
  modalMinimized: {
    maxHeight: 60,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: {
    ...Typography.h3,
    color: Colors.text,
    fontWeight: '700',
  },
  modalHeaderButtons: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  modalHeaderButton: {
    padding: Spacing.xs,
  },
  modalBodyScroll: {
    flex: 1,
  },
  modalBody: {
    padding: Spacing.lg,
  },
  fieldLabel: {
    ...Typography.bodyLarge,
    color: Colors.text,
    fontWeight: '600',
    marginBottom: Spacing.sm,
    marginTop: Spacing.md,
  },
  input: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    color: Colors.text,
    ...Typography.body,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  stemTypeScroll: {
    marginBottom: Spacing.sm,
  },
  stemTypeButton: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surfaceElevated,
    marginRight: Spacing.sm,
    borderWidth: 2,
    borderColor: Colors.border,
  },
  stemTypeButtonActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  stemTypeText: {
    ...Typography.body,
    color: Colors.text,
    fontWeight: '600',
  },
  stemTypeTextActive: {
    color: '#FFF',
  },
  colorScroll: {
    marginBottom: Spacing.sm,
  },
  colorButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: Spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'transparent',
  },
  colorButtonActive: {
    borderColor: '#FFF',
  },
  modalActions: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.xl,
  },
  deleteButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.error,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },
  deleteButtonText: {
    ...Typography.bodyLarge,
    color: '#FFF',
    fontWeight: '700',
  },
  saveButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },
  saveButtonText: {
    ...Typography.bodyLarge,
    color: '#FFF',
    fontWeight: '700',
  },
})
