import React, { useRef } from 'react'
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

type AudioTrack = {
  id: string
  name: string
  stem_type: string
  duration_ms: number
  start_time_ms: number
  color: string
  is_muted: boolean
  is_soloed: boolean
}

type MultiTrackTimelineProps = {
  tracks: AudioTrack[]
  currentPosition: number // Current playhead position in ms
  projectDuration: number // Total project length in ms
  isPlaying: boolean // Master playback state
  selectedTrackId: string | null // Track expanded in timeline
  onTrackPress: (trackId: string) => void
  onTrackMove: (trackId: string, newStartTime: number) => void
  onDuplicateTrack: (trackId: string) => void
  onSoloTrack: (trackId: string) => void
  onMuteTrack: (trackId: string) => void
  onDeleteTrack: (trackId: string) => void
  onPlayPause: () => void // Master play/pause
  onStop: () => void // Master stop
  onSeek: (position: number) => void // Seek to position
  onSkipForward: () => void // Skip +10 seconds
  onSkipBackward: () => void // Skip -10 seconds
  pixelsPerSecond?: number // Zoom level
}

const TIMELINE_HEIGHT = 350
const TRACK_HEIGHT = 56 // Collapsed height
const TRACK_HEIGHT_EXPANDED = 96 // Expanded height with controls
const TRACK_SPACING = 10
const { width: SCREEN_WIDTH } = Dimensions.get('window')

export default function MultiTrackTimeline({
  tracks,
  currentPosition,
  projectDuration,
  isPlaying,
  selectedTrackId,
  onTrackPress,
  onTrackMove,
  onDuplicateTrack,
  onSoloTrack,
  onMuteTrack,
  onDeleteTrack,
  onPlayPause,
  onStop,
  onSeek,
  onSkipForward,
  onSkipBackward,
  pixelsPerSecond, // Will be calculated automatically
}: MultiTrackTimelineProps) {

  // Calculate timeline width to fit screen - no horizontal scrolling needed
  const availableWidth = SCREEN_WIDTH - (Spacing.lg * 2)
  const timelineWidth = availableWidth

  // Calculate pixels per second to fit project in available width
  const calculatedPixelsPerSecond = projectDuration > 0
    ? (availableWidth / (projectDuration / 1000))
    : 50

  // Convert milliseconds to pixels
  const msToPixels = (ms: number) => {
    return (ms / 1000) * calculatedPixelsPerSecond
  }

  // Convert pixels to milliseconds
  const pixelsToMs = (pixels: number) => {
    return (pixels / calculatedPixelsPerSecond) * 1000
  }

  // Calculate playhead position
  const playheadPosition = msToPixels(currentPosition)

  // Format time for timeline markers
  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  // Generate time markers every 5 seconds
  const generateTimeMarkers = () => {
    const markers = []
    const intervalMs = 5000 // 5 seconds
    for (let time = 0; time <= projectDuration; time += intervalMs) {
      markers.push({
        time,
        position: msToPixels(time),
        label: formatTime(time),
      })
    }
    return markers
  }

  const timeMarkers = generateTimeMarkers()

  // Create pan responder for dragging tracks
  const createTrackPanResponder = (track: AudioTrack) => {
    const pan = useRef(new Animated.Value(msToPixels(track.start_time_ms))).current
    let isDragging = false

    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => isDragging,
      onPanResponderGrant: () => {
        isDragging = false
      },
      onPanResponderMove: (_, gestureState) => {
        if (!isDragging && (Math.abs(gestureState.dx) > 5 || Math.abs(gestureState.dy) > 5)) {
          isDragging = true
        }
        if (isDragging) {
          const newPosition = msToPixels(track.start_time_ms) + gestureState.dx
          pan.setValue(Math.max(0, newPosition))
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (!isDragging) {
          // If no dragging occurred, treat as tap
          onTrackPress(track.id)
        } else {
          // Dragging occurred, update position
          const newPosition = Math.max(0, msToPixels(track.start_time_ms) + gestureState.dx)
          const newStartTime = Math.round(pixelsToMs(newPosition))
          onTrackMove(track.id, newStartTime)
          pan.setValue(msToPixels(newStartTime))
        }
        isDragging = false
      },
    })
  }

  return (
    <>
      {/* Timeline Audio Bars - Middle Section */}
      <View style={styles.container}>
        {/* Section Header */}
        <View style={styles.sectionHeader}>
          <Ionicons name="albums-outline" size={20} color={Colors.primary} />
          <Text style={styles.sectionTitle}>Timeline</Text>
          <View style={styles.headerDivider} />
        </View>

        {/* Time Ruler */}
        <View style={styles.timeRuler}>
          <View style={{ width: timelineWidth }}>
            {timeMarkers.map((marker, index) => (
              <View
                key={index}
                style={[styles.timeMarker, { left: marker.position }]}
              >
                <View style={styles.timeTick} />
                <Text style={styles.timeLabel}>{marker.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Timeline Tracks */}
        <ScrollView
          horizontal={false}
          showsHorizontalScrollIndicator={false}
          style={styles.tracksScroll}
          contentContainerStyle={{ width: timelineWidth, minHeight: TIMELINE_HEIGHT }}
        >
        <View style={styles.tracksContainer}>
          {/* Playhead */}
          <View style={[styles.playhead, { left: playheadPosition }]} />

          {/* Render Track Bars */}
          {tracks.map((track, index) => {
            const trackStartPos = msToPixels(track.start_time_ms)
            const trackWidth = msToPixels(track.duration_ms)
            const isExpanded = selectedTrackId === track.id
            const trackHeight = isExpanded ? TRACK_HEIGHT_EXPANDED : TRACK_HEIGHT
            const trackTop = index * (TRACK_HEIGHT + TRACK_SPACING)

            return (
              <TouchableOpacity
                key={track.id}
                style={[
                  styles.track,
                  {
                    left: trackStartPos,
                    width: trackWidth,
                    top: trackTop,
                    height: trackHeight,
                    backgroundColor: track.color,
                    opacity: track.is_muted ? 0.5 : 1,
                  },
                ]}
                onPress={() => onTrackPress(track.id)}
                activeOpacity={0.8}
              >
                <View style={styles.trackContent}>
                  {/* Track Info Section - Always Visible */}
                  <View style={styles.trackInfo}>
                    <Text style={styles.trackName} numberOfLines={1}>
                      {track.name}
                    </Text>
                    <View style={styles.trackMeta}>
                      <Text style={styles.trackStemType}>
                        {track.stem_type}
                      </Text>
                      {!isExpanded && (
                        <Text style={styles.trackDuration}>
                          {formatTime(track.duration_ms)}
                        </Text>
                      )}
                    </View>
                  </View>

                  {/* Control Buttons Section - Only When Expanded */}
                  {isExpanded && (
                    <View style={styles.trackControls}>
                      {/* Solo Button */}
                      <TouchableOpacity
                        style={[
                          styles.controlButton,
                          track.is_soloed && styles.controlButtonActive,
                        ]}
                        onPress={(e) => {
                          e.stopPropagation()
                          onSoloTrack(track.id)
                        }}
                      >
                        <Text
                          style={[
                            styles.controlButtonText,
                            track.is_soloed && styles.controlButtonTextActive,
                          ]}
                        >
                          S
                        </Text>
                      </TouchableOpacity>

                      {/* Mute Button */}
                      <TouchableOpacity
                        style={[
                          styles.controlButton,
                          track.is_muted && styles.controlButtonActive,
                        ]}
                        onPress={(e) => {
                          e.stopPropagation()
                          onMuteTrack(track.id)
                        }}
                      >
                        <Ionicons
                          name={track.is_muted ? "volume-mute" : "volume-medium"}
                          size={18}
                          color="#FFF"
                        />
                      </TouchableOpacity>

                      {/* Duplicate Button */}
                      <TouchableOpacity
                        style={styles.controlButton}
                        onPress={(e) => {
                          e.stopPropagation()
                          onDuplicateTrack(track.id)
                        }}
                      >
                        <Ionicons name="copy-outline" size={18} color="#FFF" />
                      </TouchableOpacity>

                      {/* Delete Button */}
                      <TouchableOpacity
                        style={styles.controlButton}
                        onPress={(e) => {
                          e.stopPropagation()
                          onDeleteTrack(track.id)
                        }}
                      >
                        <Ionicons name="trash-outline" size={18} color="#FFF" />
                      </TouchableOpacity>
                    </View>
                  )}

                  {/* Muted Indicator - Only When Not Expanded */}
                  {track.is_muted && !isExpanded && (
                    <View style={styles.mutedIndicator}>
                      <Ionicons name="volume-mute" size={16} color="#FFF" />
                    </View>
                  )}

                  {/* Solo Indicator - Only When Not Expanded */}
                  {track.is_soloed && !isExpanded && (
                    <View style={styles.soloIndicator}>
                      <Text style={styles.soloText}>S</Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            )
          })}

          {/* Empty state hint */}
          {tracks.length === 0 && (
            <View style={styles.emptyState}>
              <Ionicons name="musical-notes-outline" size={48} color={Colors.textSecondary} />
              <Text style={styles.emptyStateText}>
                Drag tracks here to arrange them
              </Text>
            </View>
          )}
          </View>
        </ScrollView>
      </View>

      {/* Master Playback Controls - Fixed Bottom */}
      <View style={styles.playbackControls}>
        {/* Transport Buttons */}
        <View style={styles.transportButtons}>
          <TouchableOpacity
            style={styles.skipButton}
            onPress={onSkipBackward}
          >
            <Ionicons name="play-back" size={20} color={Colors.text} />
            <Text style={styles.skipText}>10</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.transportButton}
            onPress={onStop}
          >
            <Ionicons name="stop" size={22} color={Colors.text} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.playPauseButton}
            onPress={onPlayPause}
          >
            <Ionicons
              name={isPlaying ? "pause" : "play"}
              size={28}
              color="#FFF"
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.skipButton}
            onPress={onSkipForward}
          >
            <Text style={styles.skipText}>10</Text>
            <Ionicons name="play-forward" size={20} color={Colors.text} />
          </TouchableOpacity>
        </View>

        {/* Time Display */}
        <View style={styles.timeDisplay}>
          <Text style={styles.currentTime}>{formatTime(currentPosition)}</Text>
          <Text style={styles.timeSeparator}>/</Text>
          <Text style={styles.totalTime}>{formatTime(projectDuration)}</Text>
        </View>

        {/* Track Count */}
        <Text style={styles.trackCount}>
          {tracks.length} {tracks.length === 1 ? 'track' : 'tracks'}
        </Text>
      </View>
    </>
  )
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.surfaceElevated,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: Spacing.sm,
  },
  sectionTitle: {
    ...Typography.h3,
    color: Colors.text,
    fontWeight: '700',
  },
  headerDivider: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
    marginLeft: Spacing.sm,
  },
  timeRuler: {
    height: 40,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.surfaceElevated,
  },
  timeMarker: {
    position: 'absolute',
    top: 0,
    height: '100%',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: Spacing.xs,
  },
  timeTick: {
    width: 1,
    height: 8,
    backgroundColor: Colors.textSecondary,
    marginBottom: Spacing.xxs,
  },
  timeLabel: {
    ...Typography.caption,
    fontSize: 10,
    color: Colors.textSecondary,
  },
  tracksScroll: {
    maxHeight: TIMELINE_HEIGHT,
    backgroundColor: Colors.backgroundDark,
  },
  tracksContainer: {
    position: 'relative',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  playhead: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: Colors.primary,
    zIndex: 100,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 10,
  },
  track: {
    position: 'absolute',
    height: TRACK_HEIGHT,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  trackContent: {
    flex: 1,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
    flexDirection: 'column',
    justifyContent: 'space-between',
  },
  trackInfo: {
    marginBottom: Spacing.xs,
  },
  trackName: {
    ...Typography.body,
    fontSize: 14,
    color: '#FFF',
    fontWeight: '600',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
    marginBottom: 2,
  },
  trackMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  trackStemType: {
    ...Typography.caption,
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.9)',
    textTransform: 'uppercase',
    fontWeight: '600',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  trackDuration: {
    ...Typography.caption,
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.8)',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  trackControls: {
    flexDirection: 'row',
    gap: Spacing.xs,
    alignItems: 'center',
  },
  controlButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: BorderRadius.sm,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  controlButtonActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  controlButtonText: {
    ...Typography.caption,
    fontSize: 14,
    color: '#FFF',
    fontWeight: '700',
  },
  controlButtonTextActive: {
    color: '#FFF',
  },
  mutedIndicator: {
    position: 'absolute',
    top: Spacing.xs,
    right: Spacing.xs,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 12,
    padding: 4,
  },
  soloIndicator: {
    position: 'absolute',
    top: Spacing.xs,
    right: Spacing.xs + 32,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  soloText: {
    ...Typography.caption,
    fontSize: 12,
    color: '#FFF',
    fontWeight: '700',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: Spacing.xxxl,
  },
  emptyStateText: {
    ...Typography.body,
    color: Colors.textSecondary,
    marginTop: Spacing.md,
  },
  playbackControls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.surface,
    borderTopWidth: 2,
    borderTopColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  transportButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  transportButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  skipButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  skipText: {
    ...Typography.caption,
    fontSize: 10,
    color: Colors.text,
    fontWeight: '600',
  },
  playPauseButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 4,
  },
  timeDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  currentTime: {
    ...Typography.bodyLarge,
    color: Colors.text,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  timeSeparator: {
    ...Typography.body,
    color: Colors.textSecondary,
  },
  totalTime: {
    ...Typography.body,
    color: Colors.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  trackCount: {
    ...Typography.caption,
    color: Colors.textSecondary,
  },
})
