import React, { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { Colors, Typography, Spacing, BorderRadius } from '../constants/theme'
import CompactHeader from '../components/CompactHeader'
import ProjectIcon from '../components/ProjectIcon'

// Collaboration skills labels for display
const COLLABORATION_SKILLS_MAP: { [key: string]: { label: string; icon: string } } = {
  'vocals': { label: 'Vocals', icon: 'mic' },
  'guitar': { label: 'Guitar', icon: 'musical-note' },
  'bass': { label: 'Bass', icon: 'albums' },
  'drums': { label: 'Drums', icon: 'musical-notes' },
  'piano': { label: 'Piano/Keys', icon: 'keypad' },
  'producing': { label: 'Producing', icon: 'options' },
  'mixing': { label: 'Mixing', icon: 'options-outline' },
  'mastering': { label: 'Mastering', icon: 'analytics' },
  'sound-design': { label: 'Sound Design', icon: 'color-wand' },
  'beat-making': { label: 'Beat Making', icon: 'pulse' },
  'lyrics': { label: 'Lyrics', icon: 'create' },
  'composition': { label: 'Composition', icon: 'document-text' },
}

interface NavigationProps {
  route: {
    params: {
      projectId: string
    }
  }
  navigation: {
    goBack: () => void
    navigate: (screen: string, params?: any) => void
  }
}

export default function ProjectDetailScreen({ route, navigation }: NavigationProps) {
  const { projectId } = route.params
  const { user, userProfile } = useAuth()

  const [project, setProject] = useState<any>(null)
  const [collaborators, setCollaborators] = useState<any[]>([])
  const [audioFiles, setAudioFiles] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isCollaborator, setIsCollaborator] = useState(false)
  const [canUpload, setCanUpload] = useState(false)

  useEffect(() => {
    if (projectId && user?.id) {
      loadProjectData()

      // Set up real-time subscription for project updates
      const projectChannel = supabase
        .channel(`project-detail-${projectId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'projects',
            filter: `id=eq.${projectId}`
          },
          () => {
            loadProjectData()
          }
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'project_collaborators',
            filter: `project_id=eq.${projectId}`
          },
          () => {
            loadProjectData()
          }
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'audio_files',
            filter: `project_id=eq.${projectId}`
          },
          () => {
            loadProjectData()
          }
        )
        .subscribe()

      return () => {
        projectChannel.unsubscribe()
      }
    }
  }, [projectId, user?.id])

  // Reload data when screen comes into focus (handles navigation param changes)
  useFocusEffect(
    useCallback(() => {
      if (projectId && user?.id) {
        loadProjectData()
      }
    }, [projectId, user?.id])
  )

  const loadProjectData = useCallback(async () => {
    try {
      setLoading(true)

      const { data: projectData, error: projectError} = await supabase
        .from('projects')
        .select('*, users!projects_creator_id_fkey(username, display_name)')
        .eq('id', projectId)
        .single()

      if (projectError) {
        console.error('Project error:', projectError)
        throw new Error('Failed to load project')
      }

      // Check if user is the owner
      const isOwner = projectData.creator_id === user?.id

      // Check if user is a collaborator
      let userIsCollaborator = isOwner
      let userCanUpload = isOwner

      if (!isOwner && user?.id) {
        const { data: collabStatus } = await supabase
          .from('project_collaborators')
          .select('can_upload')
          .eq('project_id', projectId)
          .eq('user_id', user.id)
          .eq('invitation_status', 'accepted')
          .single()

        if (collabStatus) {
          userIsCollaborator = true
          userCanUpload = collabStatus.can_upload
        }
      }

      // If not public and not a collaborator, deny access
      if (!projectData.is_public && !userIsCollaborator) {
        Alert.alert('Access Denied', 'This project is private', [
          { text: 'OK', onPress: () => navigation.goBack() }
        ])
        return
      }

      setIsCollaborator(userIsCollaborator)
      setCanUpload(userCanUpload)

      const { data: collabData, error: collabError } = await supabase
        .from('project_collaborators')
        .select('*')
        .eq('project_id', projectId)
        .eq('invitation_status', 'accepted')
        .neq('user_id', projectData.creator_id)

      if (collabError) {
        console.error('Collaborators error:', collabError)
      }

      // Fetch user data for each collaborator
      if (collabData && collabData.length > 0) {
        const userIds = collabData.map(c => c.user_id)
        const { data: usersData } = await supabase
          .from('users')
          .select('id, username, display_name, avatar_url')
          .in('id', userIds)

        // Merge user data with collaborator data
        if (usersData) {
          collabData.forEach(collab => {
            const user = usersData.find(u => u.id === collab.user_id)
            if (user) {
              collab.users = user
            }
          })
        }
      }

      const { data: audioData, error: audioError } = await supabase
        .from('audio_files')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })

      if (audioError) {
        console.error('Audio files error:', audioError)
      }

      setProject(projectData)
      setCollaborators(collabData || [])
      setAudioFiles(audioData || [])
    } catch (error: any) {
      console.error('Error loading project:', error)
      Alert.alert('Error', 'Failed to load project details')
      setTimeout(() => navigation.goBack(), 2000)
    } finally {
      setLoading(false)
    }
  }, [projectId, user?.id, navigation])

  const formatDuration = useCallback((ms: number | null): string => {
    if (!ms) return '--:--'
    const seconds = Math.floor(ms / 1000)
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }, [])

  const getStemColor = useCallback((stemType: string | null): string => {
    if (!stemType) return Colors.textSecondary

    const stemTypeLower = stemType.toLowerCase()
    const colors: { [key: string]: string } = {
      vocals: Colors.vocals,
      drums: Colors.drums,
      bass: Colors.bass,
      guitar: Colors.guitar,
      keys: Colors.keys,
      synth: Colors.synth,
    }
    return colors[stemTypeLower] || Colors.textSecondary
  }, [])

  const getDisplayName = useCallback((userObj: any): string => {
    if (!userObj) return 'Unknown User'
    return userObj.display_name || userObj.username || 'Unknown User'
  }, [])

  const getInitial = useCallback((userObj: any): string => {
    const name = getDisplayName(userObj)
    return name.charAt(0).toUpperCase()
  }, [getDisplayName])

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <CompactHeader
          title="Project"
          subtitle="Project Detail"
          onBack={() => navigation.goBack()}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </SafeAreaView>
    )
  }

  if (!project) {
    return (
      <SafeAreaView style={styles.container}>
        <CompactHeader
          title="Project"
          subtitle="Project Detail"
          onBack={() => navigation.goBack()}
        />
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={64} color={Colors.error} />
          <Text style={styles.errorText}>Project not found</Text>
          <TouchableOpacity
            style={styles.errorButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.errorButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  const isOwner = project.creator_id === user?.id

  return (
    <SafeAreaView style={styles.container}>
      <CompactHeader
        title={project.title}
        subtitle="Project Detail"
        onBack={() => navigation.goBack()}
      />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.projectHeader}>
          <View style={styles.titleRow}>
            <ProjectIcon size="small" genre={project.genre || undefined} />
            <Text style={styles.projectTitle} numberOfLines={1}>
              {project.title}
            </Text>
            {project.genre && (
              <View style={styles.genreBadge}>
                <Text style={styles.genreText}>{project.genre}</Text>
              </View>
            )}
          </View>

            <Text style={styles.projectCreator}>
              by {getDisplayName(project.users)}
            </Text>

            <View style={styles.statusRow}>
              {project.status === 'archived' && (
                <View style={styles.archivedBadge}>
                  <Ionicons name="archive-outline" size={12} color={Colors.warning} />
                  <Text style={styles.archivedText} numberOfLines={1}>Archived</Text>
                </View>
              )}
              {project.status === 'completed' && (
                <View style={styles.completedBadge}>
                  <Ionicons name="checkmark-circle-outline" size={12} color={Colors.success} />
                  <Text style={styles.completedText} numberOfLines={1}>Completed</Text>
                </View>
              )}
              {project.looking_for_collaborators && (
                <View style={styles.lookingBadge}>
                  <Ionicons name="people-outline" size={12} color={Colors.info} />
                  <Text style={styles.lookingText} numberOfLines={1}>Looking for Collabs</Text>
                </View>
              )}
            </View>

            {project.description && (
              <Text style={styles.projectDescription}>{project.description}</Text>
            )}
            
            {(project.bpm || project.key) && (
              <View style={styles.projectMeta}>
                {project.bpm && (
                  <View style={styles.metaItem}>
                    <Ionicons name="speedometer-outline" size={14} color={Colors.textSecondary} />
                    <Text style={styles.metaText}>{project.bpm} BPM</Text>
                  </View>
                )}
                {project.key && (
                  <View style={styles.metaItem}>
                    <Ionicons name="musical-note-outline" size={14} color={Colors.textSecondary} />
                    <Text style={styles.metaText}>{project.key}</Text>
                  </View>
                )}
              </View>
            )}
        </View>

        {/* Collaboration Needs - Full width section */}
        {(project.is_public || project.looking_for_collaborators) &&
         project.collaboration_needs &&
         project.collaboration_needs.length > 0 && (
          <View style={styles.collaborationNeedsSection}>
            <Text style={styles.collaborationNeedsTitle}>
              Looking for:
            </Text>
            <View style={styles.collaborationNeedsChips}>
              {project.collaboration_needs.map((skillId: string) => {
                const skill = COLLABORATION_SKILLS_MAP[skillId]
                if (!skill) return null
                return (
                  <View key={skillId} style={styles.needChip}>
                    <Ionicons
                      name={skill.icon as any}
                      size={14}
                      color={Colors.primary}
                    />
                    <Text style={styles.needChipText}>{skill.label}</Text>
                  </View>
                )
              })}
            </View>
          </View>
        )}

        <View style={styles.actionsSection}>
          <TouchableOpacity
            style={styles.primaryActionButton}
            onPress={() => navigation.navigate('ProjectStudio', {
              projectId: project.id,
              projectTitle: project.title
            })}
          >
            <Ionicons name="play-circle" size={24} color={Colors.text} />
            <Text style={styles.primaryActionText}>Open in Studio</Text>
          </TouchableOpacity>

          {/* Show action buttons only for collaborators */}
          {isCollaborator && (
            <View style={styles.secondaryActions}>
              {canUpload && (
                <TouchableOpacity
                  style={styles.secondaryActionButton}
                  onPress={() => navigation.navigate('AudioUpload', { projectId: project.id })}
                >
                  <Ionicons name="cloud-upload-outline" size={20} color={Colors.primary} />
                  <Text style={styles.secondaryActionText}>Upload</Text>
                </TouchableOpacity>
              )}

              {isOwner && (
                <>
                  <TouchableOpacity
                    style={styles.secondaryActionButton}
                    onPress={() => navigation.navigate('EditProject', { projectId: project.id })}
                  >
                    <Ionicons name="create-outline" size={20} color={Colors.primary} />
                    <Text style={styles.secondaryActionText}>Edit</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.secondaryActionButton}
                    onPress={() => navigation.navigate('InviteCollaborator', { projectId: project.id })}
                  >
                    <Ionicons name="person-add-outline" size={20} color={Colors.primary} />
                    <Text style={styles.secondaryActionText}>Invite</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          )}

          {/* Show helpful message for public viewers */}
          {!isCollaborator && project.is_public && project.looking_for_collaborators && (
            <View style={styles.publicViewerHint}>
              <Ionicons name="information-circle-outline" size={16} color={Colors.info} />
              <Text style={styles.publicViewerHintText}>
                This is a public project. Interested in collaborating? Reach out to the owner!
              </Text>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Kollaborators</Text>
            {project.is_public && (
              <View style={styles.publicBadgeInline}>
                <Ionicons name="globe-outline" size={10} color={Colors.textSecondary} />
                <Text style={styles.publicTextInline}>Public</Text>
              </View>
            )}
            <Text style={styles.sectionCount}>{collaborators.length + 1}</Text>
          </View>

          <View style={styles.collaboratorsList}>
            <TouchableOpacity
              style={styles.collaboratorCard}
              onPress={() => navigation.navigate('UserProfile', { userId: project.creator_id })}
            >
              <View style={styles.collaboratorAvatar}>
                <Text style={styles.collaboratorAvatarText}>
                  {getInitial(project.users)}
                </Text>
              </View>
              <View style={styles.collaboratorInfo}>
                <Text style={styles.collaboratorName}>
                  {getDisplayName(project.users)}
                </Text>
                <Text style={styles.collaboratorRole}>Owner</Text>
              </View>
              <View style={styles.ownerBadge}>
                <Ionicons name="star" size={14} color={Colors.warning} />
              </View>
            </TouchableOpacity>

            {collaborators.map((collab) => (
              <TouchableOpacity
                key={collab.id}
                style={styles.collaboratorCard}
                onPress={() => navigation.navigate('UserProfile', { userId: collab.user_id })}
              >
                <View style={styles.collaboratorAvatar}>
                  <Text style={styles.collaboratorAvatarText}>
                    {getInitial(collab.users)}
                  </Text>
                </View>
                <View style={styles.collaboratorInfo}>
                  <Text style={styles.collaboratorName}>
                    {getDisplayName(collab.users)}
                  </Text>
                  <Text style={styles.collaboratorRole}>{collab.role}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={{ height: Spacing.xxl }} />
      </ScrollView>
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  errorText: {
    ...Typography.h3,
    color: Colors.error,
    textAlign: 'center',
    marginTop: Spacing.md,
  },
  errorButton: {
    marginTop: Spacing.lg,
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  errorButtonText: {
    ...Typography.bodyLarge,
    color: Colors.text,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  projectHeader: {
    padding: Spacing.lg,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  projectTitle: {
    ...Typography.h2,
    color: Colors.text,
    flex: 1,
  },
  genreBadge: {
    backgroundColor: `${Colors.primary}30`,
    paddingHorizontal: Spacing.xs,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },
  genreText: {
    ...Typography.caption,
    color: Colors.primary,
    fontWeight: '600',
  },
  projectCreator: {
    ...Typography.body,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
    marginLeft: 36 + Spacing.xs, // Icon width (36) + gap
  },
  statusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  archivedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${Colors.warning}20`,
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
    gap: 4,
  },
  archivedText: {
    ...Typography.caption,
    color: Colors.warning,
    fontWeight: '600',
    flexShrink: 1,
  },
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${Colors.success}20`,
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
    gap: 4,
  },
  completedText: {
    ...Typography.caption,
    color: Colors.success,
    fontWeight: '600',
    flexShrink: 1,
  },
  publicBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceElevated,
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
    gap: 4,
  },
  publicText: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontWeight: '600',
    flexShrink: 1,
  },
  lookingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${Colors.info}20`,
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
    gap: 4,
  },
  lookingText: {
    ...Typography.caption,
    color: Colors.info,
    fontWeight: '600',
    flexShrink: 1,
  },
  projectDescription: {
    ...Typography.body,
    color: Colors.text,
    marginBottom: Spacing.sm,
    lineHeight: 20,
  },
  projectMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    flexWrap: 'wrap',
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    ...Typography.caption,
    color: Colors.textSecondary,
  },
  collaborationNeedsSection: {
    padding: Spacing.lg,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: Colors.border,
  },
  collaborationNeedsTitle: {
    ...Typography.bodyLarge,
    color: Colors.primary,
    fontWeight: '600',
    marginBottom: Spacing.sm,
  },
  collaborationNeedsChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  needChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: Spacing.sm,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: BorderRadius.full,
  },
  needChipText: {
    ...Typography.caption,
    color: Colors.primary,
    fontWeight: '600',
    fontSize: 12,
  },
  actionsSection: {
    padding: Spacing.lg,
    backgroundColor: Colors.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  primaryActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  primaryActionText: {
    ...Typography.bodyLarge,
    color: Colors.text,
    fontWeight: '700',
  },
  secondaryActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  secondaryActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    gap: 4,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  secondaryActionText: {
    ...Typography.body,
    color: Colors.text,
    fontWeight: '600',
  },
  section: {
    padding: Spacing.lg,
    backgroundColor: Colors.background,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    ...Typography.h3,
    color: Colors.text,
  },
  publicBadgeInline: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceElevated,
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
    gap: 3,
  },
  publicTextInline: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontWeight: '600',
    fontSize: 10,
  },
  sectionCount: {
    ...Typography.body,
    color: Colors.textSecondary,
    fontWeight: '600',
    marginLeft: 'auto',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
  },
  emptyText: {
    ...Typography.bodyLarge,
    color: Colors.textSecondary,
    marginTop: Spacing.sm,
    fontWeight: '600',
  },
  emptySubtext: {
    ...Typography.body,
    color: Colors.textTertiary,
    marginTop: Spacing.xs,
  },
  audioFilesList: {
    gap: Spacing.sm,
  },
  audioFileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  stemIndicator: {
    width: 4,
    height: 40,
    borderRadius: 2,
    marginRight: Spacing.sm,
  },
  audioFileInfo: {
    flex: 1,
  },
  audioFileName: {
    ...Typography.bodyLarge,
    color: Colors.text,
    fontWeight: '600',
    marginBottom: 4,
  },
  audioFileMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  audioFileMetaText: {
    ...Typography.caption,
    color: Colors.textSecondary,
    flexShrink: 1,
  },
  playButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: `${Colors.primary}20`,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: Spacing.sm,
  },
  collaboratorsList: {
    gap: Spacing.sm,
  },
  collaboratorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  collaboratorAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.sm,
  },
  collaboratorAvatarText: {
    ...Typography.bodyLarge,
    color: Colors.text,
    fontWeight: '700',
  },
  collaboratorInfo: {
    flex: 1,
  },
  collaboratorName: {
    ...Typography.bodyLarge,
    color: Colors.text,
    fontWeight: '600',
  },
  collaboratorRole: {
    ...Typography.caption,
    color: Colors.textSecondary,
    textTransform: 'capitalize',
  },
  ownerBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: `${Colors.warning}20`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  publicViewerHint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: `${Colors.info}15`,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.sm,
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: `${Colors.info}30`,
  },
  publicViewerHintText: {
    ...Typography.body,
    color: Colors.textSecondary,
    flex: 1,
    lineHeight: 20,
  },
})