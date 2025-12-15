import React, { useState } from 'react'
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Colors, Typography, Spacing, BorderRadius } from '../constants/theme'
import { supabase } from '../lib/supabase'

interface SendMessageModalProps {
  visible: boolean
  onClose: () => void
  recipientId: string
  recipientName: string
  senderId: string
}

export default function SendMessageModal({
  visible,
  onClose,
  recipientId,
  recipientName,
  senderId,
}: SendMessageModalProps) {
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)

  const handleSend = async () => {
    if (!message.trim()) {
      Alert.alert('Empty Message', 'Please enter a message to send.')
      return
    }

    setSending(true)

    try {
      const { error } = await supabase
        .from('user_messages')
        .insert({
          sender_id: senderId,
          recipient_id: recipientId,
          message: message.trim(),
        })

      if (error) throw error

      Alert.alert(
        'Message Sent',
        `Your message has been sent to ${recipientName}. They'll see it in their notifications.`,
        [{ text: 'OK', onPress: onClose }]
      )
      setMessage('')
    } catch (error: any) {
      console.error('Error sending message:', error)
      Alert.alert('Error', 'Failed to send message. Please try again.')
    } finally {
      setSending(false)
    }
  }

  const handleClose = () => {
    setMessage('')
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
        style={styles.overlay}
      >
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={handleClose}
        />
        <View style={styles.container}>
          <View style={styles.header}>
            <View style={styles.headerContent}>
              <View style={styles.iconContainer}>
                <Ionicons name="mail" size={24} color={Colors.primary} />
              </View>
              <View>
                <Text style={styles.title}>Send Message</Text>
                <Text style={styles.subtitle}>to {recipientName}</Text>
              </View>
            </View>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.body}>
            <Text style={styles.hint}>
              Introduce yourself and share why you'd like to collaborate!
            </Text>

            <TextInput
              style={styles.input}
              placeholder="Write your message..."
              placeholderTextColor={Colors.textSecondary}
              value={message}
              onChangeText={setMessage}
              multiline
              maxLength={500}
              textAlignVertical="top"
              autoFocus
            />

            <Text style={styles.charCount}>
              {message.length}/500
            </Text>
          </View>

          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={handleClose}
              disabled={sending}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.sendButton,
                (!message.trim() || sending) && styles.sendButtonDisabled
              ]}
              onPress={handleSend}
              disabled={!message.trim() || sending}
            >
              {sending ? (
                <ActivityIndicator color={Colors.text} size="small" />
              ) : (
                <>
                  <Ionicons name="send" size={18} color={Colors.text} />
                  <Text style={styles.sendButtonText}>Send</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  container: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    paddingBottom: Platform.OS === 'ios' ? 34 : Spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: `${Colors.primary}20`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    ...Typography.h3,
    color: Colors.text,
  },
  subtitle: {
    ...Typography.body,
    color: Colors.textSecondary,
  },
  closeButton: {
    padding: Spacing.xs,
  },
  body: {
    padding: Spacing.lg,
  },
  hint: {
    ...Typography.body,
    color: Colors.textSecondary,
    marginBottom: Spacing.md,
    fontStyle: 'italic',
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
  },
  footer: {
    flexDirection: 'row',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cancelButtonText: {
    ...Typography.body,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  sendButton: {
    flex: 1,
    flexDirection: 'row',
    gap: Spacing.xs,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendButtonText: {
    ...Typography.body,
    color: Colors.text,
    fontWeight: '600',
  },
})
