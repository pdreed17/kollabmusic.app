import React, { useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ScrollView,
} from 'react-native'
import Slider from '@react-native-community/slider'
import { Ionicons } from '@expo/vector-icons'
import { Colors, Typography, Spacing, BorderRadius } from '../constants/theme'

type Comment = {
  id: string
  content: string
  timestamp_ms: number
  users: {
    username: string
    display_name: string
  }
}

type TrackBarProps = {
  id: string
  name: string
  stemType: string
  duration: number
  position: number
  color: string
  isMuted: boolean
  isSoloed: boolean
  isPlaying: boolean
  comments: Comment[]
  onToggleMute: () => void
  onToggleSolo: () => void
  onDuplicate: () => void
  onDelete: () => void
  onPlay: () => void
  onSeek: (position: number) => void
  onAddComment: (text: string, timestamp: number) => void
  onSeekToComment: (timestamp: number) => void
  onEditName: (name: string) => void
  onEditType: (type: string) => void
  onExpandedChange?: (isExpanded: boolean) => void
}

export default function TrackBar({
  id,
  name,
  stemType,
  duration,
  position,
  color,
  isMuted,
  isSoloed,
  isPlaying,
  comments,
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
  onExpandedChange,
}: TrackBarProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [showComments, setShowComments] = useState(false)
  const [commentText, setCommentText] = useState('')

  const toggleExpanded = () => {
    const newExpandedState = !isExpanded
    setIsExpanded(newExpandedState)
    if (onExpandedChange) {
      onExpandedChange(newExpandedState)
    }
  }

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  const handleAddComment = () => {
    if (commentText.trim()) {
      onAddComment(commentText, position)
      setCommentText('')
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: color }]}>
      {/* Collapsed Header - Always Visible */}
      <View style={[styles.header, { backgroundColor: 'rgba(0,0,0,0.25)' }]}>
        <TouchableOpacity
          style={styles.expandButton}
          onPress={toggleExpanded}
          activeOpacity={0.8}
        >
          <Ionicons
            name={isExpanded ? 'chevron-down' : 'chevron-forward'}
            size={24}
            color="rgba(255,255,255,0.9)"
          />
        </TouchableOpacity>

        <View style={styles.headerContent}>
          <View style={styles.trackInfo}>
            <Text style={styles.trackName} numberOfLines={1}>
              {name}
            </Text>
            <Text style={styles.stemType}>{stemType.toUpperCase()}</Text>
          </View>
        </View>

        {/* Always Visible Controls */}
        <View style={styles.alwaysVisibleControls}>
          <TouchableOpacity
            style={styles.controlIconButton}
            onPress={(e) => {
              e.stopPropagation()
              onPlay()
            }}
          >
            <Ionicons
              name={isPlaying ? 'pause' : 'play'}
              size={20}
              color="rgba(255,255,255,0.95)"
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.controlIconButton, isSoloed && styles.controlIconButtonActive]}
            onPress={(e) => {
              e.stopPropagation()
              onToggleSolo()
            }}
          >
            <Text style={[styles.soloButtonText, isSoloed && styles.soloButtonTextActive]}>S</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.controlIconButton, isMuted && styles.controlIconButtonActive]}
            onPress={(e) => {
              e.stopPropagation()
              onToggleMute()
            }}
          >
            <Ionicons
              name={isMuted ? 'volume-mute' : 'volume-medium'}
              size={20}
              color={isMuted ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.95)'}
            />
          </TouchableOpacity>

          <Text style={styles.duration}>{formatTime(duration)}</Text>
        </View>
      </View>

      {/* Expanded Content */}
      {isExpanded && (
        <View style={styles.expandedContent}>
          {/* Mini Timeline */}
          <View style={styles.miniTimeline}>
            <View style={styles.timelineHeader}>
              <Text style={styles.currentTime}>{formatTime(position)}</Text>
              <TouchableOpacity style={styles.playButton} onPress={onPlay}>
                <Ionicons
                  name={isPlaying ? 'pause' : 'play'}
                  size={20}
                  color={Colors.primary}
                />
              </TouchableOpacity>
            </View>

            {/* Timeline Slider */}
            <Slider
              style={styles.slider}
              minimumValue={0}
              maximumValue={duration}
              value={position}
              onValueChange={onSeek}
              minimumTrackTintColor={color}
              maximumTrackTintColor={Colors.border}
              thumbTintColor={color}
            />

            {/* Comment Markers */}
            <View style={styles.commentMarkers}>
              {comments.map((comment) => (
                <TouchableOpacity
                  key={comment.id}
                  style={[
                    styles.commentMarker,
                    { left: `${(comment.timestamp_ms / duration) * 100}%` },
                  ]}
                  onPress={() => onSeekToComment(comment.timestamp_ms)}
                >
                  <Ionicons name="chatbox" size={12} color={Colors.primary} />
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Control Buttons Row - Only in Expanded */}
          <View style={styles.controlsRow}>
            <TouchableOpacity style={styles.controlButton} onPress={onDuplicate}>
              <Ionicons name="copy-outline" size={20} color={Colors.text} />
              <Text style={styles.controlButtonText}>Duplicate</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.controlButton} onPress={onDelete}>
              <Ionicons name="trash-outline" size={20} color={Colors.error} />
              <Text style={[styles.controlButtonText, { color: Colors.error }]}>Delete</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.controlButton, showComments && styles.controlButtonActive]}
              onPress={() => setShowComments(!showComments)}
            >
              <Ionicons name="chatbox-outline" size={20} color={showComments ? '#FFF' : Colors.text} />
              <Text style={[styles.controlButtonText, showComments && styles.controlButtonTextActive]}>
                Comments {comments.length > 0 ? `(${comments.length})` : ''}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Comments Section */}
          {showComments && (
            <View style={styles.commentsSection}>
              <Text style={styles.commentsSectionTitle}>Track Comments</Text>

              {/* Add Comment */}
              <View style={styles.addCommentContainer}>
                <TextInput
                  style={styles.commentInput}
                  placeholder={`Comment at ${formatTime(position)}`}
                  placeholderTextColor={Colors.textSecondary}
                  value={commentText}
                  onChangeText={setCommentText}
                  multiline
                />
                <TouchableOpacity style={styles.addCommentButton} onPress={handleAddComment}>
                  <Ionicons name="send" size={20} color="#FFF" />
                </TouchableOpacity>
              </View>

              {/* Comments List */}
              <ScrollView style={styles.commentsList} nestedScrollEnabled>
                {comments.map((comment) => (
                  <TouchableOpacity
                    key={comment.id}
                    style={styles.commentItem}
                    onPress={() => onSeekToComment(comment.timestamp_ms)}
                  >
                    <View style={styles.commentHeader}>
                      <Text style={styles.commentUser}>{comment.users.display_name}</Text>
                      <Text style={styles.commentTimestamp}>{formatTime(comment.timestamp_ms)}</Text>
                    </View>
                    <Text style={styles.commentText}>{comment.content}</Text>
                  </TouchableOpacity>
                ))}
                {comments.length === 0 && (
                  <Text style={styles.noComments}>No comments yet</Text>
                )}
              </ScrollView>
            </View>
          )}
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    borderRadius: BorderRadius.lg,
    marginHorizontal: Spacing.md,
    marginVertical: Spacing.sm,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
    borderWidth: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    backgroundColor: 'rgba(0,0,0,0.05)',
    minHeight: 60,
  },
  expandButton: {
    padding: Spacing.sm,
    marginRight: Spacing.sm,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: Spacing.md,
  },
  colorIndicator: {
    width: 6,
    height: 40,
    borderRadius: 3,
  },
  trackInfo: {
    flex: 1,
  },
  trackName: {
    ...Typography.h4,
    color: 'rgba(255,255,255,0.98)',
    fontWeight: '700',
    marginBottom: 4,
    fontSize: 16,
  },
  stemType: {
    ...Typography.caption,
    fontWeight: '600',
    fontSize: 11,
    color: 'rgba(255,255,255,0.75)',
    letterSpacing: 0.5,
  },
  alwaysVisibleControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  controlIconButton: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.md,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  controlIconButtonActive: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderColor: 'rgba(255,255,255,0.6)',
  },
  soloButtonText: {
    ...Typography.body,
    fontSize: 14,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.85)',
  },
  soloButtonTextActive: {
    color: 'rgba(255,255,255,0.98)',
  },
  duration: {
    ...Typography.caption,
    color: 'rgba(255,255,255,0.85)',
    fontVariant: ['tabular-nums'],
    marginLeft: Spacing.xs,
    fontSize: 12,
    fontWeight: '600',
  },
  expandedContent: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  miniTimeline: {
    marginBottom: Spacing.md,
  },
  timelineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.xs,
  },
  currentTime: {
    ...Typography.bodyLarge,
    color: Colors.text,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  playButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
  },
  slider: {
    width: '100%',
    height: 40,
  },
  commentMarkers: {
    position: 'relative',
    height: 20,
    marginTop: -10,
  },
  commentMarker: {
    position: 'absolute',
    top: 0,
  },
  controlsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  controlButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  controlButtonActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  controlButtonText: {
    ...Typography.body,
    color: Colors.text,
    fontWeight: '600',
  },
  controlButtonTextActive: {
    color: '#FFF',
  },
  commentBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: Colors.error,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  commentBadgeText: {
    ...Typography.caption,
    fontSize: 10,
    color: '#FFF',
    fontWeight: '700',
  },
  commentsSection: {
    backgroundColor: Colors.backgroundDark,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
  },
  commentsSectionTitle: {
    ...Typography.h4,
    color: Colors.text,
    fontWeight: '600',
    marginBottom: Spacing.sm,
  },
  addCommentContainer: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  commentInput: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    color: Colors.text,
    ...Typography.body,
    maxHeight: 80,
  },
  addCommentButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  commentsList: {
    maxHeight: 200,
  },
  commentItem: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.sm,
    padding: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.xs,
  },
  commentUser: {
    ...Typography.caption,
    color: Colors.primary,
    fontWeight: '600',
  },
  commentTimestamp: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  commentText: {
    ...Typography.body,
    color: Colors.text,
  },
  noComments: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    paddingVertical: Spacing.lg,
  },
})
