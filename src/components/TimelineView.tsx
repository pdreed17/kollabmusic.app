import React, { useState, useRef } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Dimensions,
  TouchableOpacity,
  PanResponder,
  Animated,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Colors, Typography, Spacing, BorderRadius } from '../constants/theme'
import TrackBar from './TrackBar'

type Track = {
  id: string
  name: string
  stemType: string
  duration: number
  startTime: number
  position: number
  color: string
  isMuted: boolean
  isSoloed: boolean
  isPlaying: boolean
  comments: any[]
}

type TimelineViewProps = {
  tracks: Track[]
  projectDuration: number
  currentPosition: number
  isPlaying: boolean
  onTrackMove: (trackId: string, newStartTime: number) => void
  onToggleMute: (trackId: string) => void
  onToggleSolo: (trackId: string) => void
  onDuplicate: (trackId: string) => void
  onDelete: (trackId: string) => void
  onPlay: (trackId: string) => void
  onSeek: (trackId: string, position: number) => void
  onAddComment: (trackId: string, text: string, timestamp: number) => void
  onSeekToComment: (trackId: string, timestamp: number) => void
  onEditName: (trackId: string, name: string) => void
  onEditType: (trackId: string, type: string) => void
}

const { width: SCREEN_WIDTH } = Dimensions.get('window')
const TRACK_HEIGHT = 100
const TRACK_SPACING = 12
const TIMELINE_HEADER_HEIGHT = 60
const MIN_ZOOM = 0.5
const MAX_ZOOM = 4
const ZOOM_STEP = 0.5

export default function TimelineView({
  tracks,
  projectDuration,
  currentPosition,
  isPlaying,
  onTrackMove,
  onToggleMute,
  onToggleSolo,
  onDuplicate,
  onDelete,
  onPlay,
  onSeek,
  onAddComment,
  onSeekToComment,
  onEditName,
  onEditType,
}: TimelineViewProps) {
  const [zoom, setZoom] = useState(1)
  const [expandedTrackId, setExpandedTrackId] = useState<string | null>(null)
  const [draggingTrackId, setDraggingTrackId] = useState<string | null>(null)

  // Calculate pixels per second based on zoom - fit timeline to screen width when zoom is 1
  const basePixelsPerSecond = projectDuration > 0
    ? (SCREEN_WIDTH - Spacing.lg * 2) / (projectDuration / 1000)
    : 50
  const pixelsPerSecond = basePixelsPerSecond * zoom

  const timelineWidth = Math.max(
    SCREEN_WIDTH - Spacing.lg * 2,
    (projectDuration / 1000) * pixelsPerSecond
  )

  // Convert milliseconds to pixels
  const msToPixels = (ms: number) => {
    return (ms / 1000) * pixelsPerSecond
  }

  // Convert pixels to milliseconds
  const pixelsToMs = (pixels: number) => {
    return (pixels / pixelsPerSecond) * 1000
  }

  // Format time for timeline markers
  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  // Zoom controls
  const handleZoomIn = () => {
    setZoom((prev) => Math.min(prev + ZOOM_STEP, MAX_ZOOM))
  }

  const handleZoomOut = () => {
    setZoom((prev) => Math.max(prev - ZOOM_STEP, MIN_ZOOM))
  }

  const handleZoomReset = () => {
    setZoom(1)
  }

  // Generate time markers (adjust interval based on zoom)
  const generateTimeMarkers = () => {
    const markers = []
    // Adjust marker interval based on zoom level
    let markerInterval = 5000 // 5 seconds default
    if (zoom < 0.75) {
      markerInterval = 10000 // 10 seconds when zoomed out
    } else if (zoom > 2) {
      markerInterval = 2000 // 2 seconds when zoomed in
    }

    for (let time = 0; time <= projectDuration; time += markerInterval) {
      markers.push(
        <View
          key={time}
          style={[styles.timeMarker, { left: msToPixels(time) }]}
        >
          <View style={styles.timeMarkerLine} />
          <Text style={styles.timeMarkerText}>{formatTime(time)}</Text>
        </View>
      )
    }
    return markers
  }

  // Create pan responder for simple drag and drop
  const createPanResponder = (trackId: string, initialStartTime: number) => {
    let startX = 0

    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 5
      },
      onPanResponderGrant: (evt) => {
        startX = initialStartTime
        setDraggingTrackId(trackId)
      },
      onPanResponderMove: (_, gestureState) => {
        // Calculate new position based on drag distance
        const newStartTimeMs = Math.max(0, startX + pixelsToMs(gestureState.dx))
        // Update position in real-time (visual feedback)
        onTrackMove(trackId, newStartTimeMs)
      },
      onPanResponderRelease: () => {
        setDraggingTrackId(null)
      },
    })
  }

  return (
    <View style={styles.container}>
      {/* Timeline Header with Time Markers and Zoom Controls */}
      <View style={styles.timelineHeader}>
        {/* Zoom Controls */}
        <View style={styles.zoomControls}>
          <TouchableOpacity
            style={[styles.zoomButton, zoom <= MIN_ZOOM && styles.zoomButtonDisabled]}
            onPress={handleZoomOut}
            disabled={zoom <= MIN_ZOOM}
          >
            <Ionicons name="remove" size={20} color={zoom <= MIN_ZOOM ? Colors.textSecondary : Colors.text} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.zoomResetButton} onPress={handleZoomReset}>
            <Text style={styles.zoomText}>{Math.round(zoom * 100)}%</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.zoomButton, zoom >= MAX_ZOOM && styles.zoomButtonDisabled]}
            onPress={handleZoomIn}
            disabled={zoom >= MAX_ZOOM}
          >
            <Ionicons name="add" size={20} color={zoom >= MAX_ZOOM ? Colors.textSecondary : Colors.text} />
          </TouchableOpacity>
        </View>

        {/* Time Markers */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.timelineHeaderScroll}
        >
          <View style={[styles.timelineHeaderContent, { width: timelineWidth }]}>
            {generateTimeMarkers()}
          </View>
        </ScrollView>
      </View>

      {/* Scrollable Tracks Area */}
      <ScrollView style={styles.tracksScrollView}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={true}
        >
          <View
            style={[
              styles.tracksContainer,
              {
                width: timelineWidth,
                height: Math.max(400, tracks.length * (TRACK_HEIGHT + TRACK_SPACING) + Spacing.lg),
              },
            ]}
          >
            {/* Playhead Line */}
            <View
              style={[
                styles.playhead,
                {
                  left: msToPixels(currentPosition),
                  height: tracks.length * (TRACK_HEIGHT + TRACK_SPACING),
                },
              ]}
            >
              <View style={styles.playheadHandle} />
            </View>

            {tracks.map((track, index) => {
              const trackWidthPx = msToPixels(track.duration)
              const trackLeftPx = msToPixels(track.startTime)
              const isExpanded = expandedTrackId === track.id
              const isDragging = draggingTrackId === track.id

              const panResponder = createPanResponder(track.id, track.startTime)

              return (
                <View
                  key={track.id}
                  {...panResponder.panHandlers}
                  style={[
                    styles.trackWrapper,
                    {
                      left: trackLeftPx,
                      top: index * (TRACK_HEIGHT + TRACK_SPACING),
                      width: Math.max(trackWidthPx, 200), // Minimum width for usability
                      zIndex: isExpanded ? 1000 : isDragging ? 999 : index,
                      opacity: isDragging ? 0.7 : 1,
                    },
                  ]}
                >
                  <TrackBar
                    id={track.id}
                    name={track.name}
                    stemType={track.stemType}
                    duration={track.duration}
                    position={track.position}
                    color={track.color}
                    isMuted={track.isMuted}
                    isSoloed={track.isSoloed}
                    isPlaying={track.isPlaying}
                    comments={track.comments}
                    onToggleMute={() => onToggleMute(track.id)}
                    onToggleSolo={() => onToggleSolo(track.id)}
                    onDuplicate={() => onDuplicate(track.id)}
                    onDelete={() => onDelete(track.id)}
                    onPlay={() => onPlay(track.id)}
                    onSeek={(position) => onSeek(track.id, position)}
                    onAddComment={(text, timestamp) => onAddComment(track.id, text, timestamp)}
                    onSeekToComment={(timestamp) => onSeekToComment(track.id, timestamp)}
                    onEditName={(name) => onEditName(track.id, name)}
                    onEditType={(type) => onEditType(track.id, type)}
                    onExpandedChange={(expanded) => {
                      setExpandedTrackId(expanded ? track.id : null)
                    }}
                  />
                </View>
              )
            })}
          </View>
        </ScrollView>
      </ScrollView>

      {/* Instructions */}
      {tracks.length === 0 && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>No tracks on timeline</Text>
          <Text style={styles.emptyStateSubtext}>Add tracks to get started</Text>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.backgroundDark,
  },
  timelineHeader: {
    height: TIMELINE_HEADER_HEIGHT,
    backgroundColor: Colors.surface,
    borderBottomWidth: 2,
    borderBottomColor: Colors.border,
  },
  zoomControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xs,
    gap: Spacing.sm,
  },
  zoomButton: {
    width: 38,
    height: 38,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  zoomButtonDisabled: {
    opacity: 0.35,
  },
  zoomResetButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1.5,
    borderColor: Colors.border,
    minWidth: 65,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  zoomText: {
    ...Typography.caption,
    color: Colors.text,
    fontWeight: '700',
    fontSize: 12,
  },
  timelineHeaderScroll: {
    flex: 1,
  },
  timelineHeaderContent: {
    height: 30,
    position: 'relative',
  },
  timeMarker: {
    position: 'absolute',
    top: 0,
    height: 30,
    alignItems: 'center',
  },
  timeMarkerLine: {
    width: 1.5,
    height: 10,
    backgroundColor: Colors.border,
    marginBottom: 4,
    opacity: 0.6,
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
  },
  trackWrapper: {
    position: 'absolute',
    top: 0,
    marginBottom: Spacing.sm,
  },
  playhead: {
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
  emptyState: {
    position: 'absolute',
    top: TIMELINE_HEADER_HEIGHT + 100,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyStateText: {
    ...Typography.h4,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  emptyStateSubtext: {
    ...Typography.body,
    color: Colors.textSecondary,
  },
})
