// screens/ProjectStudioScreen.tsx
// Expo Go Compatible - Uses expo-av instead of react-native-track-player

import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import audioPlayer from '../services/audioPlayer.service';
import { audioService } from '../services/audioService';

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
}

export default function ProjectStudioScreen({ route, navigation }: any) {
  const { projectId, projectTitle } = route.params;

  // Project & Data State
  const [loading, setLoading] = useState(true)
  const [project, setProject] = useState<any>(null)
  const [audioFiles, setAudioFiles] = useState<AudioFile[]>([])
  const [comments, setComments] = useState<Comment[]>([])
  const [collaborators, setCollaborators] = useState<Collaborator[]>([])

  // UI State
  const [activeTab, setActiveTab] = useState<TabType>('tracks')
  const [showCommentModal, setShowCommentModal] = useState(false)
  const [newComment, setNewComment] = useState('')
  const [commentTimestamp, setCommentTimestamp] = useState(0)

  // Audio Popup State
  const [selectedAudioFile, setSelectedAudioFile] = useState<AudioFile | null>(null)
  const [showAudioPopup, setShowAudioPopup] = useState(false)

  // Chat State (separate from track comments)
  const [chatMessages, setChatMessages] = useState<Comment[]>([])
  const [trackComments, setTrackComments] = useState<{[key: string]: Comment[]}>({}) // Track ID -> Comments

  useEffect(() => {
    loadProjectData()
  }, [])

  const loadProjectData = async () => {
    try {
      // Load project details
      const { data: projectData, error: projectError } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single()

      if (projectError) throw projectError
      setProject(projectData)

      // Load audio files
      const { data: audioData, error: audioError } = await supabase
        .from('audio_files')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: true })

      if (audioError) throw audioError

      const formattedAudio: AudioFile[] = (audioData || []).map(file => ({
        id: file.id || '',
        file_name: file.file_name || '',
        file_path: file.file_path || '',
        stem_type: file.stem_type || '',
        stem_name: file.stem_name || '',
        duration_ms: Number(file.duration_ms) || 0,
        color: getStemColor(file.stem_type),
        created_at: file.created_at || '',
        bpm: file.bpm ? Number(file.bpm) : undefined,
        key: file.key || undefined,
      }))

      setAudioFiles(formattedAudio)

      // Load comments - separate chat from track comments
      const { data: commentsData, error: commentsError } = await supabase
        .from('comments')
        .select(`
          id,
          content,
          timestamp_ms,
          created_at,
          user_id,
          audio_file_id,
          users!comments_user_id_fkey(username, display_name)
        `)
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })

      if (commentsError) {
        console.warn('Comments error:', commentsError)
      }

      const typedComments: Comment[] = (commentsData || []).map(comment => ({
        id: comment.id || '',
        content: comment.content || '',
        timestamp_ms: Number(comment.timestamp_ms) || 0,
        created_at: comment.created_at || '',
        users: {
          username: comment.users?.username || '',
          display_name: comment.users?.display_name || ''
        }
      }))

      // Separate chat messages (no audio_file_id) from track comments (has audio_file_id)
      const chatOnly = typedComments.filter(comment => !commentsData?.find(c => c.id === comment.id)?.audio_file_id)
      const trackCommentsMap: {[key: string]: Comment[]} = {}

      typedComments.forEach(comment => {
        const audioFileId = commentsData?.find(c => c.id === comment.id)?.audio_file_id
        if (audioFileId) {
          if (!trackCommentsMap[audioFileId]) {
            trackCommentsMap[audioFileId] = []
          }
          trackCommentsMap[audioFileId].push(comment)
        }
      })

      setComments(chatOnly) // Only chat messages for the Chat tab
      setChatMessages(chatOnly)
      setTrackComments(trackCommentsMap)

      // Load collaborators
      const { data: collaboratorsData, error: collaboratorsError } = await supabase
        .from('collaborators')
        .select(`
          id,
          role,
          joined_at,
          user_id,
          users!collaborators_user_id_fkey(username, display_name, avatar_url)
        `)
        .eq('project_id', projectId)
        .order('joined_at', { ascending: true })

      if (collaboratorsError) throw collaboratorsError

      const typedCollaborators: Collaborator[] = (collaboratorsData || []).map(collab => ({
        id: collab.id || '',
        role: collab.role || 'collaborator',
        joined_at: collab.joined_at || '',
        users: {
          username: collab.users?.username || '',
          display_name: collab.users?.display_name || '',
          avatar_url: collab.users?.avatar_url || undefined
        }
      }))

      setCollaborators(typedCollaborators)

    } catch (error) {
      console.error('Error loading project:', error)
      Alert.alert('Error', 'Failed to load project')
    } finally {
      setLoading(false)
    }
  }

  const getStemColor = (stemType: string) => {
    const colors: { [key: string]: string } = {
      vocals: Colors.vocals,
      drums: Colors.drums,
      bass: Colors.bass,
      guitar: Colors.guitar,
      keys: Colors.keys,
      synth: Colors.synth,
    }
    return colors[stemType] || Colors.primary
  }

  const formatDuration = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const handleTrackPress = (track: AudioFile) => {
    setSelectedAudioFile(track)
    setShowAudioPopup(true)
  }

  const closeAudioPopup = () => {
    setShowAudioPopup(false)
    setSelectedAudioFile(null)
  }

  const handleAddComment = async () => {
    if (!newComment.trim()) return

    try {
      const { error } = await supabase
        .from('comments')
        .insert({
          project_id: projectId,
          user_id: user?.id,
          content: newComment.trim(),
          timestamp_ms: commentTimestamp
        })

      if (error) throw error

      setNewComment('')
      setShowCommentModal(false)
      loadProjectData() // Refresh comments
    } catch (error) {
      console.error('Error adding comment:', error)
      Alert.alert('Error', 'Failed to add comment')
    }
  }


  const renderTabContent = () => {
    switch (activeTab) {
      case 'tracks':
        return renderTracksTab()
      case 'chat':
        return renderChatTab()
      case 'collaborators':
        return renderCollaboratorsTab()
      default:
        return renderTracksTab()
    }
  }

  const renderTracksTab = () => (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      <View style={styles.tabHeader}>
        <Text style={styles.tabTitle}>Audio Tracks ({audioFiles.length})</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => navigation.navigate('AudioUpload', { projectId })}
        >
          <Ionicons name="add" size={24} color={Colors.text} />
        </TouchableOpacity>
      </View>

      {audioFiles.map((track) => (
        <TouchableOpacity
          key={track.id}
          style={styles.trackCard}
          onPress={() => handleTrackPress(track)}
          activeOpacity={0.7}
        >
          <View style={styles.trackHeader}>
            <View style={[styles.trackIndicator, { backgroundColor: track.color }]} />
            <View style={styles.trackInfo}>
              <Text style={styles.trackName} numberOfLines={1}>
                {track.stem_name || track.file_name}
              </Text>
              <View style={styles.trackMeta}>
                <Text style={styles.trackType}>{track.stem_type}</Text>
                <Text style={styles.trackDuration}>{formatDuration(track.duration_ms)}</Text>
                <Text style={styles.trackDate}>{formatDate(track.created_at)}</Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.editButton}
              onPress={(e) => {
                e.stopPropagation()
                // Navigate to edit track screen or open edit modal
                setSelectedAudioFile(track)
                setShowAudioPopup(true)
              }}
            >
              <Ionicons name="create-outline" size={20} color={Colors.primary} />
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      ))}

      {audioFiles.length === 0 && (
        <View style={styles.emptyState}>
          <Ionicons name="musical-notes-outline" size={48} color={Colors.textSecondary} />
          <Text style={styles.emptyStateText}>No tracks yet</Text>
          <TouchableOpacity
            style={styles.emptyStateButton}
            onPress={() => navigation.navigate('AudioUpload', { projectId })}
          >
            <Text style={styles.emptyStateButtonText}>Upload Audio</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  )

  const renderChatTab = () => (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      <View style={styles.tabHeader}>
        <Text style={styles.tabTitle}>Project Chat ({chatMessages.length})</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setShowCommentModal(true)}
        >
          <Ionicons name="add" size={24} color={Colors.text} />
        </TouchableOpacity>
      </View>

      {chatMessages.map((message) => (
        <View key={message.id} style={styles.commentCard}>
          <View style={styles.commentHeader}>
            <Text style={styles.commentAuthor}>
              {message.users.display_name || message.users.username}
            </Text>
            <Text style={styles.commentDate}>
              {formatDate(message.created_at)}
            </Text>
          </View>
          <Text style={styles.commentContent}>{message.content}</Text>
        </View>
      ))}

      {chatMessages.length === 0 && (
        <View style={styles.emptyState}>
          <Ionicons name="chatbubbles-outline" size={48} color={Colors.textSecondary} />
          <Text style={styles.emptyStateText}>No messages yet</Text>
          <TouchableOpacity
            style={styles.emptyStateButton}
            onPress={() => setShowCommentModal(true)}
          >
            <Text style={styles.emptyStateButtonText}>Send Message</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  )

  const renderCollaboratorsTab = () => (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      <View style={styles.tabHeader}>
        <Text style={styles.tabTitle}>Collaborators ({collaborators.length})</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => navigation.navigate('InviteCollaborator', { projectId })}
        >
          <Ionicons name="add" size={24} color={Colors.text} />
        </TouchableOpacity>
      </View>

      {collaborators.map((collaborator) => (
        <View key={collaborator.id} style={styles.collaboratorCard}>
          <View style={styles.collaboratorAvatar}>
            <Ionicons name="person" size={24} color={Colors.textSecondary} />
          </View>
          <View style={styles.collaboratorInfo}>
            <Text style={styles.collaboratorName}>
              {collaborator.users.display_name || collaborator.users.username}
            </Text>
            <View style={styles.collaboratorMeta}>
              <Text style={styles.collaboratorRole}>{collaborator.role}</Text>
              <Text style={styles.collaboratorDate}>
                Joined {formatDate(collaborator.joined_at)}
              </Text>
            </View>
          </View>
        </View>
      ))}

      {collaborators.length === 0 && (
        <View style={styles.emptyState}>
          <Ionicons name="people-outline" size={48} color={Colors.textSecondary} />
          <Text style={styles.emptyStateText}>No collaborators yet</Text>
          <TouchableOpacity
            style={styles.emptyStateButton}
            onPress={() => navigation.navigate('InviteCollaborator', { projectId })}
          >
            <Text style={styles.emptyStateButtonText}>Invite Collaborator</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  )

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {project?.title}
          </Text>
          <Text style={styles.headerSubtitle}>Project Studio</Text>
        </View>
        <TouchableOpacity onPress={() => navigation.navigate('EditProject', { projectId })}>
          <Ionicons name="settings-outline" size={24} color={Colors.textSecondary} />
        </TouchableOpacity>
      </View>


      {/* Tab Content */}
      <View style={styles.content}>
        {renderTabContent()}
      </View>

      {/* Comment Modal */}
      <Modal
        visible={showCommentModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowCommentModal(false)}>
              <Text style={styles.modalCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Add Comment</Text>
            <TouchableOpacity
              onPress={handleAddComment}
              disabled={!newComment.trim()}
            >
              <Text style={[
                styles.modalDone,
                !newComment.trim() && styles.modalDoneDisabled
              ]}>
                Done
              </Text>
            </TouchableOpacity>
          </View>
          <View style={styles.modalContent}>
            <TextInput
              style={styles.commentInput}
              placeholder="Enter your comment..."
              placeholderTextColor={Colors.textSecondary}
              value={newComment}
              onChangeText={setNewComment}
              multiline
              autoFocus
            />
          </View>
        </SafeAreaView>
      </Modal>

      {/* Tab Navigation - Moved to Bottom */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'tracks' && styles.tabButtonActive]}
          onPress={() => setActiveTab('tracks')}
        >
          <Ionicons
            name="musical-notes"
            size={20}
            color={activeTab === 'tracks' ? Colors.primary : Colors.textSecondary}
          />
          <Text style={[
            styles.tabButtonText,
            activeTab === 'tracks' && styles.tabButtonTextActive
          ]}>
            Tracks
          </Text>
        </TouchableOpacity>

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

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'collaborators' && styles.tabButtonActive]}
          onPress={() => setActiveTab('collaborators')}
        >
          <Ionicons
            name="people"
            size={20}
            color={activeTab === 'collaborators' ? Colors.primary : Colors.textSecondary}
          />
          <Text style={[
            styles.tabButtonText,
            activeTab === 'collaborators' && styles.tabButtonTextActive
          ]}>
            Collaborators
          </Text>
        </TouchableOpacity>
      </View>

      {/* Audio Track Popup - Only show in Tracks tab */}
      {activeTab === 'tracks' && (
        <AudioTrackPopup
          audioFile={selectedAudioFile}
          isVisible={showAudioPopup}
          onClose={closeAudioPopup}
          projectId={projectId}
          userId={user?.id || ''}
          trackComments={selectedAudioFile ? trackComments[selectedAudioFile.id] || [] : []}
        />
      )}
    </SafeAreaView>
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
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: Spacing.md,
  },
  headerTitle: {
    ...Typography.h2,
    color: Colors.text,
  },
  headerSubtitle: {
    ...Typography.caption,
    color: Colors.textSecondary,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingBottom: 20, // Add space for safe area
  },
  tabButton: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm,
    gap: Spacing.xxs,
  },
  tabButtonActive: {
    borderTopWidth: 2,
    borderTopColor: Colors.primary,
  },
  tabButtonText: {
    ...Typography.body,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  tabButtonTextActive: {
    color: Colors.primary,
  },
  content: {
    flex: 1,
  },
  tabContent: {
    flex: 1,
    backgroundColor: Colors.backgroundDark,
  },
  tabHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
  },
  tabTitle: {
    ...Typography.h3,
    color: Colors.text,
  },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Track Styles
  trackCard: {
    backgroundColor: Colors.surface,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
  },
  trackHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
  },
  trackIndicator: {
    width: 4,
    height: 40,
    borderRadius: 2,
    marginRight: Spacing.md,
  },
  trackInfo: {
    flex: 1,
  },
  trackName: {
    ...Typography.bodyLarge,
    color: Colors.text,
    fontWeight: '600',
    marginBottom: Spacing.xxs,
  },
  trackMeta: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  trackType: {
    ...Typography.caption,
    color: Colors.textSecondary,
    textTransform: 'capitalize',
  },
  trackDuration: {
    ...Typography.caption,
    color: Colors.textSecondary,
  },
  trackDate: {
    ...Typography.caption,
    color: Colors.textSecondary,
  },
  editButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Comment Styles
  commentCard: {
    backgroundColor: Colors.surface,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  commentAuthor: {
    ...Typography.body,
    color: Colors.text,
    fontWeight: '600',
  },
  commentDate: {
    ...Typography.caption,
    color: Colors.textSecondary,
  },
  commentContent: {
    ...Typography.body,
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  commentTimestamp: {
    ...Typography.caption,
    color: Colors.primary,
  },
  // Collaborator Styles
  collaboratorCard: {
    backgroundColor: Colors.surface,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    flexDirection: 'row',
    alignItems: 'center',
  },
  collaboratorAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  collaboratorInfo: {
    flex: 1,
  },
  collaboratorName: {
    ...Typography.bodyLarge,
    color: Colors.text,
    fontWeight: '600',
    marginBottom: Spacing.xxs,
  },
  collaboratorMeta: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  collaboratorRole: {
    ...Typography.caption,
    color: Colors.primary,
    textTransform: 'capitalize',
  },
  collaboratorDate: {
    ...Typography.caption,
    color: Colors.textSecondary,
  },
  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing.xxxl,
    paddingHorizontal: Spacing.lg,
  },
  emptyStateText: {
    ...Typography.h3,
    color: Colors.textSecondary,
    marginTop: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  emptyStateButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  emptyStateButtonText: {
    ...Typography.bodyLarge,
    color: Colors.text,
    fontWeight: '600',
  },
  // Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: Colors.backgroundDark,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
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
  commentInput: {
    ...Typography.body,
    color: Colors.text,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    minHeight: 120,
    textAlignVertical: 'top',
  },
  // Error Styles
  errorText: {
    ...Typography.h3,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.xl,
  },
  errorButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  errorButtonText: {
    ...Typography.bodyLarge,
    color: Colors.text,
    fontWeight: '600',
  },
})