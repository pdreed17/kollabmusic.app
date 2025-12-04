import React, { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Colors, Typography, Spacing, BorderRadius } from '../constants/theme'

interface CommentModalProps {
  visible: boolean
  onClose: () => void
  projectId: string
  audioFileId?: string
  timestampMs?: number
  parentCommentId?: string
  onCommentAdded?: () => void
}

export default function CommentModal({
  visible,
  onClose,
  projectId,
  audioFileId,
  timestampMs,
  parentCommentId,
  onCommentAdded,
}: CommentModalProps) {
  const { user } = useAuth()
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const formatTime = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  const handleSubmit = async () => {
    if (!comment.trim()) {
      Alert.alert('Error', 'Please enter a comment')
      return
    }

    if (!user?.id) {
      Alert.alert('Error', 'You must be logged in to comment')
      return
    }

    setSubmitting(true)

    try {
      const { error } = await supabase.from('comments').insert({
        project_id: projectId,
        audio_file_id: audioFileId || null,
        user_id: user.id,
        content: comment.trim(),
        timestamp_ms: timestampMs || null,
        parent_comment_id: parentCommentId || null,
      })

      if (error) throw error

      Alert.alert('Success', 'Comment added!')
      setComment('')
      onClose()
      
      // Refresh comments list
      if (onCommentAdded) {
        onCommentAdded()
      }
    } catch (error: any) {
      console.error('Error adding comment:', error)
      Alert.alert('Error', 'Failed to add comment')
    } finally {
      setSubmitting(false)
    }
  }

  const handleClose = () => {
    setComment('')
    onClose()
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalOverlay}
      >
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={handleClose}
        />

        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {parentCommentId ? 'Reply to Comment' : 'Add Comment'}
            </Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={Colors.text} />
            </TouchableOpacity>
          </View>

          {/* Timestamp Badge */}
          {timestampMs !== undefined && timestampMs !== null && (
            <View style={styles.timestampBadge}>
              <Ionicons name="time-outline" size={16} color={Colors.primary} />
              <Text style={styles.timestampText}>
                At {formatTime(timestampMs)}
              </Text>
            </View>
          )}

          {/* Comment Input */}
          <TextInput
            style={styles.input}
            placeholder="Write your comment..."
            placeholderTextColor={Colors.textSecondary}
            value={comment}
            onChangeText={setComment}
            multiline
            numberOfLines={6}
            textAlignVertical="top"
            autoFocus
          />

          {/* Character Count */}
          <Text style={styles.charCount}>{comment.length} characters</Text>

          {/* Actions */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={handleClose}
              disabled={submitting}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.submitButton, submitting && styles.buttonDisabled]}
              onPress={handleSubmit}
              disabled={submitting || !comment.trim()}
            >
              {submitting ? (
                <ActivityIndicator color={Colors.text} size="small" />
              ) : (
                <Text style={styles.submitButtonText}>Post Comment</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  modalContent: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.lg,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.lg,
  },
  modalTitle: {
    ...Typography.h2,
    color: Colors.text,
  },
  closeButton: {
    padding: Spacing.sm,
  },
  timestampBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${Colors.primary}20`,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    alignSelf: 'flex-start',
    marginBottom: Spacing.md,
    gap: Spacing.xs,
  },
  timestampText: {
    ...Typography.body,
    color: Colors.primary,
    fontWeight: '600',
  },
  input: {
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    ...Typography.body,
    color: Colors.text,
    minHeight: 120,
    maxHeight: 200,
  },
  charCount: {
    ...Typography.caption,
    color: Colors.textSecondary,
    textAlign: 'right',
    marginTop: Spacing.xs,
    marginBottom: Spacing.lg,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  cancelButton: {
    flex: 1,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  cancelButtonText: {
    ...Typography.bodyLarge,
    color: Colors.text,
    fontWeight: '600',
  },
  submitButton: {
    flex: 1,
    backgroundColor: Colors.primary,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  submitButtonText: {
    ...Typography.bodyLarge,
    color: Colors.text,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
})