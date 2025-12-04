import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  FlatList,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { Colors, Typography, Spacing, BorderRadius } from '../constants/theme'
import Header from '../components/Header'

interface Collaborator {
  id: string
  user_id: string
  role: string
  invitation_status: string
  can_edit: boolean
  can_delete: boolean
  can_invite: boolean
  can_upload: boolean
  can_comment: boolean
  can_download: boolean
  created_at: string
  invitation_accepted_at: string | null
  user: {
    id: string
    username: string
    display_name: string
    avatar_url: string | null
    specialties: string[]
  }
}

export default function CollaboratorsScreen({ route, navigation }: any) {
  const { projectId } = route.params
  const { user } = useAuth()
  const [collaborators, setCollaborators] = useState<Collaborator[]>([])
  const [projectTitle, setProjectTitle] = useState('')
  const [isOwner, setIsOwner] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadProjectAndCollaborators()
  }, [projectId])

  const loadProjectAndCollaborators = async () => {
    try {
      // Load project details
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .select('title, creator_id')
        .eq('id', projectId)
        .single()

      if (projectError) throw projectError

      setProjectTitle(project.title)
      setIsOwner(project.creator_id === user?.id)

      // Load collaborators
      const { data: collabData, error: collabError } = await supabase
        .from('collaborators')
        .select(`
          id,
          user_id,
          role,
          invitation_status,
          can_edit,
          can_delete,
          can_invite,
          can_upload,
          can_comment,
          can_download,
          created_at
        `)
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })

      if (collabError) throw collabError

      // Get user details for each collaborator
      // Get user details for each collaborator
      if (collabData && Array.isArray(collabData) && collabData.length > 0) {
        // cast to any[] to satisfy TypeScript now that the select matches the DB schema
        const userIds = Array.from(new Set((collabData as any[]).map((c: any) => c.user_id)))
        const { data: usersData, error: usersError } = await supabase
          .from('users')
          .select('id, username, display_name, avatar_url, specialties')
          .in('id', userIds)

        if (usersError) throw usersError

        // Combine collaborator data with user data
        const enrichedCollaborators = (collabData as any[]).map((collab: any) => ({
          ...collab,
          user: usersData?.find((u: any) => u.id === collab.user_id) || {
            id: collab.user_id,
            username: 'Unknown',
            display_name: 'Unknown User',
            avatar_url: null,
            specialties: []
          }
        }))

        setCollaborators(enrichedCollaborators)
      }
      console.error('Error loading collaborators:', 'Error')
      Alert.alert('Error', 'Failed to load collaborators')
    } finally {
      setLoading(false)
    }
  }

  const handleRemoveCollaborator = (collaborator: Collaborator) => {
    Alert.alert(
      'Remove Collaborator',
      `Are you sure you want to remove ${collaborator.user.display_name || collaborator.user.username} from this project?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('collaborators')
                .delete()
                .eq('id', collaborator.id)

              if (error) throw error

              setCollaborators(prev => prev.filter(c => c.id !== collaborator.id))
              Alert.alert('Success', 'Collaborator removed')
            } catch (error) {
              console.error('Error removing collaborator:', error)
              Alert.alert('Error', 'Failed to remove collaborator')
            }
          }
        }
      ]
    )
  }

  const handleChangeRole = (collaborator: Collaborator) => {
    Alert.alert(
      'Change Role',
      `Change role for ${collaborator.user.display_name || collaborator.user.username}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Admin',
          onPress: () => updateRole(collaborator.id, 'admin')
        },
        {
          text: 'Editor',
          onPress: () => updateRole(collaborator.id, 'editor')
        },
        {
          text: 'Viewer',
          onPress: () => updateRole(collaborator.id, 'viewer')
        }
      ]
    )
  }

  const updateRole = async (collaboratorId: string, newRole: string) => {
    try {
      const permissions = {
        admin: {
          can_edit: true,
          can_delete: true,
          can_invite: true,
          can_upload: true,
          can_comment: true,
          can_download: true
        },
        editor: {
          can_edit: true,
          can_delete: false,
          can_invite: false,
          can_upload: true,
          can_comment: true,
          can_download: true
        },
        viewer: {
          can_edit: false,
          can_delete: false,
          can_invite: false,
          can_upload: false,
          can_comment: true,
          can_download: false
        }
      }

      const { error } = await supabase
        .from('collaborators')
        .update({
          role: newRole,
          ...permissions[newRole as keyof typeof permissions]
        })
        .eq('id', collaboratorId)

      if (error) throw error

      // Refresh collaborators
      loadProjectAndCollaborators()
      Alert.alert('Success', 'Role updated')
    } catch (error) {
      console.error('Error updating role:', error)
      Alert.alert('Error', 'Failed to update role')
    }
  }

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'owner': return Colors.primary
      case 'admin': return Colors.success
      case 'editor': return Colors.info
      case 'commenter': return Colors.warning
      case 'viewer': return Colors.textSecondary
      default: return Colors.textSecondary
    }
  }

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'owner': return 'shield'
      case 'admin': return 'shield-checkmark'
      case 'editor': return 'create'
      case 'commenter': return 'chatbubble'
      case 'viewer': return 'eye'
      default: return 'person'
    }
  }

  const renderCollaborator = ({ item }: { item: Collaborator }) => {
    const isPending = item.invitation_status === 'pending'
    const isAccepted = item.invitation_status === 'accepted'

    return (
      <View style={styles.collaboratorCard}>
        <View style={styles.collaboratorMain}>
          {/* Avatar */}
          {item.user.avatar_url ? (
            <Image source={{ uri: item.user.avatar_url }} style={styles.avatar} />
          ) : (
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {(item.user.display_name || item.user.username).charAt(0).toUpperCase()}
              </Text>
            </View>
          )}

          {/* Info */}
          <View style={styles.collaboratorInfo}>
            <Text style={styles.collaboratorName}>
              {item.user.display_name || item.user.username}
            </Text>
            <Text style={styles.collaboratorUsername}>@{item.user.username}</Text>

            {/* Role Badge */}
            <View style={styles.badges}>
              <View style={[styles.roleBadge, { backgroundColor: `${getRoleColor(item.role)}20` }]}>
                <Ionicons name={getRoleIcon(item.role) as any} size={12} color={getRoleColor(item.role)} />
                <Text style={[styles.roleText, { color: getRoleColor(item.role) }]}>
                  {item.role.charAt(0).toUpperCase() + item.role.slice(1)}
                </Text>
              </View>

              {isPending && (
                <View style={styles.pendingBadge}>
                  <Ionicons name="time-outline" size={12} color={Colors.warning} />
                  <Text style={styles.pendingText}>Pending</Text>
                </View>
              )}
            </View>

            {/* Permissions (for accepted collaborators) */}
            {isAccepted && (
              <View style={styles.permissions}>
                {item.can_upload && (
                  <Ionicons name="cloud-upload" size={14} color={Colors.textSecondary} />
                )}
                {item.can_edit && (
                  <Ionicons name="create" size={14} color={Colors.textSecondary} />
                )}
                {item.can_download && (
                  <Ionicons name="download" size={14} color={Colors.textSecondary} />
                )}
                {item.can_invite && (
                  <Ionicons name="person-add" size={14} color={Colors.textSecondary} />
                )}
              </View>
            )}
          </View>

          {/* Actions (only for owner) */}
          {isOwner && item.role !== 'owner' && (
            <View style={styles.actions}>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => handleChangeRole(item)}
              >
                <Ionicons name="swap-horizontal" size={20} color={Colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => handleRemoveCollaborator(item)}
              >
                <Ionicons name="close-circle" size={20} color={Colors.error} />
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Specialties */}
        {item.user.specialties && item.user.specialties.length > 0 && (
          <View style={styles.specialties}>
            {item.user.specialties.slice(0, 4).map((spec: string) => (
              <View key={spec} style={styles.specialtyChip}>
                <Text style={styles.specialtyText}>{spec}</Text>
              </View>
            ))}
            {item.user.specialties.length > 4 && (
              <Text style={styles.moreText}>+{item.user.specialties.length - 4}</Text>
            )}
          </View>
        )}
      </View>
    )
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <Header
          title="Collaborators"
          variant="compact"
          showBack={true}
          onBack={() => navigation.goBack()}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <Header
        title="Collaborators"
        variant="compact"
        showBack={true}
        onBack={() => navigation.goBack()}
        rightButton={isOwner ? {
          icon: 'person-add',
          onPress: () => navigation.navigate('InviteCollaborator', { projectId })
        } : undefined}
      />

      {/* Project Title */}
      <View style={styles.projectHeader}>
        <Text style={styles.projectTitle} numberOfLines={1}>{projectTitle}</Text>
        <Text style={styles.projectSubtitle}>
          {collaborators.filter(c => c.invitation_status === 'accepted').length} active collaborators
        </Text>
      </View>

      <FlatList
        data={collaborators}
        renderItem={renderCollaborator}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={64} color={Colors.textSecondary} />
            <Text style={styles.emptyText}>No collaborators yet</Text>
            {isOwner && (
              <TouchableOpacity
                style={styles.inviteButton}
                onPress={() => navigation.navigate('InviteCollaborator', { projectId })}
              >
                <Text style={styles.inviteButtonText}>+ Invite Collaborators</Text>
              </TouchableOpacity>
            )}
          </View>
        }
      />
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
  projectHeader: {
    padding: Spacing.lg,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  projectTitle: {
    ...Typography.h2,
    color: Colors.text,
    marginBottom: Spacing.xxs,
  },
  projectSubtitle: {
    ...Typography.body,
    color: Colors.textSecondary,
  },
  list: {
    padding: Spacing.md,
  },
  collaboratorCard: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  collaboratorMain: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: Spacing.sm,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  avatarText: {
    fontSize: 20,
    color: Colors.text,
    fontWeight: '600',
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
  collaboratorUsername: {
    ...Typography.body,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  badges: {
    flexDirection: 'row',
    gap: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.xs,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },
  roleText: {
    ...Typography.caption,
    fontWeight: '600',
  },
  pendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.xs,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
    backgroundColor: `${Colors.warning}20`,
  },
  pendingText: {
    ...Typography.caption,
    color: Colors.warning,
    fontWeight: '600',
  },
  permissions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
  },
  specialties: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  specialtyChip: {
    backgroundColor: `${Colors.primary}20`,
    paddingHorizontal: Spacing.xs,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },
  specialtyText: {
    ...Typography.caption,
    color: Colors.primary,
    fontWeight: '600',
  },
  moreText: {
    ...Typography.caption,
    color: Colors.textSecondary,
    alignSelf: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: Spacing.xxxl,
    paddingHorizontal: Spacing.lg,
  },
  emptyText: {
    ...Typography.h3,
    color: Colors.textSecondary,
    marginTop: Spacing.md,
    marginBottom: Spacing.lg,
  },
  inviteButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  inviteButtonText: {
    ...Typography.bodyLarge,
    color: Colors.text,
    fontWeight: '600',
  },
})