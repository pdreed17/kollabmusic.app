/**
 * ProjectChat Component
 *
 * iMessage/Messenger-style chat interface for project-level discussions
 * Separate from audio timeline comments
 */

import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Colors, Typography, Spacing, BorderRadius } from '../constants/theme'
import { supabase } from '../lib/supabase'

interface ProjectMessage {
  id: string
  project_id: string
  user_id: string
  content: string
  created_at: string
  updated_at: string
  is_edited: boolean
  users: {
    id: string
    username: string
    display_name: string | null
  }
}

interface ProjectChatProps {
  projectId: string
  currentUserId: string
  currentUserName: string
}

export default function ProjectChat({
  projectId,
  currentUserId,
  currentUserName,
}: ProjectChatProps) {
  const [messages, setMessages] = useState<ProjectMessage[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const scrollViewRef = useRef<ScrollView>(null)

  /**
   * Load all messages for this project
   */
  const loadMessages = useCallback(async () => {
    try {
      setLoading(true)

      // Fetch messages without user join to avoid FK issues
      const { data: messagesData, error } = await supabase
        .from('project_messages')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: true })

      if (error) throw error

      if (!messagesData || messagesData.length === 0) {
        setMessages([])
        return
      }

      // Get unique user IDs from messages
      const userIds = [...new Set(messagesData.map(msg => msg.user_id))]

      // Fetch user details for all message senders
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('id, username, display_name, avatar_url')
        .in('id', userIds)

      if (usersError && __DEV__) {
        console.error('Error fetching users:', usersError)
      }

      // Create a map of user_id to user data
      const usersMap = new Map(
        (usersData || []).map(user => [user.id, user])
      )

      // Merge user data with messages
      const messagesWithUsers = messagesData.map(msg => ({
        ...msg,
        users: usersMap.get(msg.user_id) || null
      }))

      setMessages(messagesWithUsers)
    } catch (error) {
      if (__DEV__) console.error('Error loading messages:', error)
      Alert.alert('Error', 'Failed to load messages')
    } finally {
      setLoading(false)
    }
  }, [projectId])

  /**
   * Subscribe to real-time message updates
   */
  const subscribeToMessages = useCallback(() => {
    const channel = supabase
      .channel(`project-chat:${projectId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'project_messages',
          filter: `project_id=eq.${projectId}`,
        },
        async (payload) => {
          // Fetch user data for the new message
          const { data: userData } = await supabase
            .from('users')
            .select('id, username, display_name')
            .eq('id', payload.new.user_id)
            .single()

          const newMsg: ProjectMessage = {
            ...payload.new as any,
            users: userData || {
              id: payload.new.user_id,
              username: 'Unknown',
              display_name: null,
            },
          }

          setMessages((prev) => [...prev, newMsg])
        }
      )
      .subscribe()

    return () => {
      channel.unsubscribe()
    }
  }, [projectId])

  // Load messages on mount
  useEffect(() => {
    loadMessages()
    const unsubscribe = subscribeToMessages()
    return unsubscribe
  }, [loadMessages, subscribeToMessages])

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true })
      }, 100)
    }
  }, [messages])

  /**
   * Send a new message
   */
  const sendMessage = useCallback(async () => {
    if (!newMessage.trim()) return

    try {
      setSending(true)

      const { error } = await supabase.from('project_messages').insert({
        project_id: projectId,
        user_id: currentUserId,
        content: newMessage.trim(),
      })

      if (error) throw error

      setNewMessage('')

      // Reload messages to ensure the new message appears
      await loadMessages()
    } catch (error) {
      if (__DEV__) console.error('Error sending message:', error)
      Alert.alert('Error', 'Failed to send message')
    } finally {
      setSending(false)
    }
  }, [newMessage, projectId, currentUserId, loadMessages])

  /**
   * Delete a message (only own messages)
   */
  const deleteMessage = useCallback(async (messageId: string) => {
    try {
      const { error } = await supabase
        .from('project_messages')
        .delete()
        .eq('id', messageId)

      if (error) throw error

      setMessages((prev) => prev.filter((msg) => msg.id !== messageId))
    } catch (error) {
      if (__DEV__) console.error('Error deleting message:', error)
      Alert.alert('Error', 'Failed to delete message')
    }
  }, [])

  /**
   * Format timestamp for display
   */
  const formatTimestamp = useCallback((timestamp: string): string => {
    const date = new Date(timestamp)
    const now = new Date()
    const diff = now.getTime() - date.getTime()

    // Less than 1 minute
    if (diff < 60000) return 'Just now'

    // Less than 1 hour
    if (diff < 3600000) {
      const mins = Math.floor(diff / 60000)
      return `${mins}m ago`
    }

    // Today
    if (date.toDateString() === now.toDateString()) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }

    // This week
    if (diff < 604800000) {
      const days = Math.floor(diff / 86400000)
      return `${days}d ago`
    }

    // Older
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
  }, [])

  /**
   * Group messages by date
   */
  const groupMessagesByDate = useCallback((messages: ProjectMessage[]) => {
    const groups: { [key: string]: ProjectMessage[] } = {}

    messages.forEach((msg) => {
      const date = new Date(msg.created_at).toDateString()
      if (!groups[date]) groups[date] = []
      groups[date].push(msg)
    })

    return groups
  }, [])

  const messageGroups = useMemo(() => groupMessagesByDate(messages), [messages, groupMessagesByDate])

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading chat...</Text>
      </View>
    )
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {/* Messages List */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.messagesContainer}
        contentContainerStyle={styles.messagesContent}
        showsVerticalScrollIndicator={false}
      >
        {messages.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="chatbubbles-outline" size={64} color={Colors.textSecondary} />
            <Text style={styles.emptyStateText}>No messages yet</Text>
            <Text style={styles.emptyStateSubtext}>
              Start the conversation with your collaborators
            </Text>
          </View>
        ) : (
          Object.entries(messageGroups).map(([date, msgs]) => (
            <View key={date}>
              {/* Date Separator */}
              <View style={styles.dateSeparator}>
                <View style={styles.dateSeparatorLine} />
                <Text style={styles.dateSeparatorText}>
                  {new Date(date).toDateString() === new Date().toDateString()
                    ? 'Today'
                    : new Date(date).toLocaleDateString([], {
                        month: 'short',
                        day: 'numeric',
                      })}
                </Text>
                <View style={styles.dateSeparatorLine} />
              </View>

              {/* Messages for this date */}
              {msgs.map((msg, index) => {
                const isOwnMessage = msg.user_id === currentUserId
                const showAvatar =
                  index === msgs.length - 1 ||
                  msgs[index + 1]?.user_id !== msg.user_id

                return (
                  <View
                    key={msg.id}
                    style={[
                      styles.messageRow,
                      isOwnMessage && styles.messageRowOwn,
                    ]}
                  >
                    {/* Avatar (for others' messages) */}
                    {!isOwnMessage && (
                      <View style={styles.avatarContainer}>
                        {showAvatar ? (
                          <View style={styles.avatar}>
                            <Text style={styles.avatarText}>
                              {(msg.users?.display_name || msg.users?.username || 'User')
                                .charAt(0)
                                .toUpperCase()}
                            </Text>
                          </View>
                        ) : (
                          <View style={styles.avatarPlaceholder} />
                        )}
                      </View>
                    )}

                    {/* Message Bubble */}
                    <TouchableOpacity
                      style={[
                        styles.messageBubble,
                        isOwnMessage
                          ? styles.messageBubbleOwn
                          : styles.messageBubbleOther,
                      ]}
                      onLongPress={() => {
                        if (isOwnMessage) {
                          Alert.alert(
                            'Delete Message',
                            'Are you sure you want to delete this message?',
                            [
                              { text: 'Cancel', style: 'cancel' },
                              {
                                text: 'Delete',
                                style: 'destructive',
                                onPress: () => deleteMessage(msg.id),
                              },
                            ]
                          )
                        }
                      }}
                      activeOpacity={0.8}
                    >
                      {/* Sender name (for others' messages only) */}
                      {!isOwnMessage && showAvatar && (
                        <Text style={styles.senderName}>
                          {msg.users?.display_name || msg.users?.username || 'User'}
                        </Text>
                      )}

                      {/* Message content */}
                      <Text
                        style={[
                          styles.messageText,
                          isOwnMessage && styles.messageTextOwn,
                        ]}
                      >
                        {msg.content}
                      </Text>

                      {/* Timestamp */}
                      <Text
                        style={[
                          styles.messageTime,
                          isOwnMessage && styles.messageTimeOwn,
                        ]}
                      >
                        {formatTimestamp(msg.created_at)}
                        {msg.is_edited && ' (edited)'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )
              })}
            </View>
          ))
        )}
      </ScrollView>

      {/* Input Area */}
      <View style={styles.inputContainer}>
        <View style={styles.inputWrapper}>
          <TextInput
            style={styles.input}
            placeholder="Message"
            placeholderTextColor={Colors.textSecondary}
            value={newMessage}
            onChangeText={setNewMessage}
            multiline
            maxLength={1000}
            editable={!sending}
          />

          <TouchableOpacity
            style={[
              styles.sendButton,
              (!newMessage.trim() || sending) && styles.sendButtonDisabled,
            ]}
            onPress={sendMessage}
            disabled={!newMessage.trim() || sending}
          >
            {sending ? (
              <ActivityIndicator size="small" color={Colors.text} />
            ) : (
              <Ionicons
                name="send"
                size={20}
                color={newMessage.trim() ? Colors.text : Colors.textSecondary}
              />
            )}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  )
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
    backgroundColor: Colors.backgroundDark,
  },
  loadingText: {
    ...Typography.body,
    color: Colors.textSecondary,
    marginTop: Spacing.md,
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: Spacing.xxxl * 2,
  },
  emptyStateText: {
    ...Typography.h2,
    color: Colors.text,
    marginTop: Spacing.lg,
  },
  emptyStateSubtext: {
    ...Typography.body,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
    textAlign: 'center',
    maxWidth: 250,
  },
  dateSeparator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: Spacing.lg,
  },
  dateSeparatorLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },
  dateSeparatorText: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontWeight: '600',
    marginHorizontal: Spacing.md,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: Spacing.xs,
    paddingHorizontal: Spacing.xs,
  },
  messageRowOwn: {
    justifyContent: 'flex-end',
  },
  avatarContainer: {
    width: 32,
    marginRight: Spacing.sm,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    ...Typography.body,
    color: Colors.text,
    fontWeight: '700',
  },
  avatarPlaceholder: {
    width: 32,
    height: 32,
  },
  messageBubble: {
    maxWidth: '75%',
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.sm,
  },
  messageBubbleOwn: {
    backgroundColor: Colors.primary,
    borderBottomRightRadius: 4,
  },
  messageBubbleOther: {
    backgroundColor: Colors.surface,
    borderBottomLeftRadius: 4,
  },
  senderName: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontWeight: '600',
    marginBottom: Spacing.xxs,
  },
  messageText: {
    ...Typography.body,
    color: Colors.text,
    lineHeight: 20,
  },
  messageTextOwn: {
    color: Colors.text,
  },
  messageTime: {
    ...Typography.tiny,
    color: Colors.textSecondary,
    marginTop: Spacing.xxs,
  },
  messageTimeOwn: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  inputContainer: {
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    paddingBottom: Platform.OS === 'ios' ? Spacing.md : Spacing.sm,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.lg,
    paddingLeft: Spacing.md,
    paddingRight: Spacing.xs,
    paddingVertical: Spacing.xs,
  },
  input: {
    flex: 1,
    ...Typography.body,
    color: Colors.text,
    maxHeight: 100,
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.xs,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: Spacing.sm,
  },
  sendButtonDisabled: {
    backgroundColor: 'transparent',
  },
})
