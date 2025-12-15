import React, { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  RefreshControl,
  FlatList,
  Alert,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useFocusEffect } from '@react-navigation/native'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { Colors, Typography, Spacing, BorderRadius } from '../constants/theme'
import { SkeletonList } from '../components/LoadingSkeleton'
import { hasSkillMatch } from '../utils/skillMatching'
import { scale } from '../utils/responsive'
import { canAcceptCollaboration, showUpgradeAlert } from '../utils/subscriptionLimits'

interface ActivityItem {
  id: string
  type: 'project_created' | 'file_uploaded'
  content?: string
  created_at: string
  timestamp_ms?: number
  projects: {
    id: string
    title: string
    is_public: boolean
    collaboration_needs?: string[]
    genre?: string
  }
  users: {
    username: string
    display_name: string
  }
  audio_files?: {
    id: string
    stem_name: string
    file_name: string
    stem_type?: string
  }
  project_data?: any
}

interface Invitation {
  id: string
  project_id: string
  projects: {
    title: string
  }
  inviter: {
    username: string
    display_name: string
  }
}

interface Notification {
  id: string
  content: string
  created_at: string
  project_id?: string
  audio_file_id?: string
  sender_id?: string
  type: 'comment' | 'message'
  projects?: {
    title: string
  }
  users: {
    username: string
    display_name: string
  }
}

export default function ActivityScreen({ navigation }: any) {
  const { user, userProfile } = useAuth()
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [feedFilter, setFeedFilter] = useState<'all' | 'collabs'>('all')
  const [collabIds, setCollabIds] = useState<string[]>([])
  const [invitationsExpanded, setInvitationsExpanded] = useState(false)
  const [notificationsExpanded, setNotificationsExpanded] = useState(false)
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null)

  useEffect(() => {
    if (user?.id) {
      loadCollaboratorIds()
      loadInvitations()
      loadNotifications()
      loadActivities()

      // Set up real-time subscriptions
      const invitationsChannel = supabase
        .channel('activity-invitations')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',  // Only listen for new invitations, not updates
            schema: 'public',
            table: 'project_collaborators',
            filter: `user_id=eq.${user.id}`
          },
          () => {
            loadInvitations()
          }
        )
        .subscribe()

      const notificationsChannel = supabase
        .channel('activity-notifications')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'comments'
          },
          () => {
            loadNotifications()
          }
        )
        .subscribe()

      const activityChannel = supabase
        .channel('activity-feed')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'projects'
          },
          () => {
            loadActivities()
          }
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'audio_files'
          },
          () => {
            loadActivities()
          }
        )
        .subscribe()

      return () => {
        invitationsChannel.unsubscribe()
        notificationsChannel.unsubscribe()
        activityChannel.unsubscribe()
      }
    }
  }, [user?.id])

  useEffect(() => {
    if (!loading && user?.id) {
      loadActivities()
    }
  }, [feedFilter, loading, user?.id, collabIds])

  // Reload activities when screen comes into focus (to pick up new blocks)
  useFocusEffect(
    useCallback(() => {
      if (!loading && user?.id) {
        loadActivities()
        loadInvitations()  // Also reload invitations to sync across screens
      }
    }, [loading, user?.id, feedFilter, collabIds, loadInvitations])
  )

  const loadCollaboratorIds = useCallback(async () => {
    if (!user) return

    try {
      // Get projects user OWNS
      const { data: ownedProjects } = await supabase
        .from('projects')
        .select('id')
        .eq('creator_id', user.id)

      // Get projects user is INVITED to as collaborator
      const { data: invitedProjects } = await supabase
        .from('project_collaborators')
        .select('project_id')
        .eq('user_id', user.id)
        .eq('invitation_status', 'accepted')

      // Combine both sets of project IDs
      const ownedIds = ownedProjects?.map(p => p.id) || []
      const invitedIds = invitedProjects?.map(c => c.project_id) || []
      const allProjectIds = [...new Set([...ownedIds, ...invitedIds])]

      if (allProjectIds.length > 0) {
        // Get all collaborators from these projects (excluding current user)
        const { data: allCollaborators } = await supabase
          .from('project_collaborators')
          .select('user_id')
          .in('project_id', allProjectIds)
          .eq('invitation_status', 'accepted')
          .neq('user_id', user.id)

        const uniqueUserIds = [...new Set(allCollaborators?.map(c => c.user_id) || [])]
        setCollabIds(uniqueUserIds as string[])
      } else {
        setCollabIds([])
      }
    } catch (error) {
      console.error('Error loading collaborator IDs:', error)
    }
  }, [user])

  const loadInvitations = useCallback(async () => {
    if (!user) return

    try {
      const { data: inviteData, error } = await supabase
        .from('project_collaborators')
        .select('id, project_id, invited_by')
        .eq('user_id', user.id)
        .eq('invitation_status', 'pending')

      if (error) throw error

      if (!inviteData || inviteData.length === 0) {
        setInvitations([])
        return
      }

      // Get project details
      const projectIds = inviteData.map(i => i.project_id)
      const { data: projects } = await supabase
        .from('projects')
        .select('id, title')
        .in('id', projectIds)

      // Get inviter details
      const inviterIds = inviteData
        .map(i => i.invited_by)
        .filter((id): id is string => id !== null && id !== undefined)
      const { data: inviters } = await supabase
        .from('users')
        .select('id, username, display_name')
        .in('id', inviterIds)

      // Combine data
      const enriched = inviteData.map(invite => ({
        id: invite.id,
        project_id: invite.project_id,
        projects: projects?.find(p => p.id === invite.project_id) || { title: 'Unknown Project' },
        inviter: inviters?.find(u => u.id === invite.invited_by) || { username: 'Unknown', display_name: 'Unknown User' }
      }))

      setInvitations(enriched as any)
    } catch (error) {
      console.error('Error loading invitations:', error)
    }
  }, [user])

  const loadNotifications = useCallback(async () => {
    if (!user) return

    try {
      const allNotifications: Notification[] = []

      // Get user's own projects for comment notifications
      const { data: myProjects } = await supabase
        .from('projects')
        .select('id')
        .eq('creator_id', user.id)

      if (myProjects && myProjects.length > 0) {
        const projectIds = myProjects.map(p => p.id)

        // Get comments on user's projects from others
        const { data: comments, error: commentsError } = await supabase
          .from('comments')
          .select(`
            id,
            content,
            created_at,
            project_id,
            audio_file_id,
            projects(title),
            users!comments_user_id_fkey(username, display_name)
          `)
          .in('project_id', projectIds)
          .neq('user_id', user.id) // Exclude own comments
          .order('created_at', { ascending: false })
          .limit(10)

        if (!commentsError && comments) {
          comments.forEach((comment: any) => {
            allNotifications.push({
              ...comment,
              type: 'comment',
            })
          })
        }
      }

      // Get direct messages sent to this user
      const { data: messages, error: messagesError } = await supabase
        .from('user_messages')
        .select(`
          id,
          message,
          created_at,
          sender_id,
          users!user_messages_sender_id_fkey(username, display_name)
        `)
        .eq('recipient_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10)

      if (!messagesError && messages) {
        messages.forEach((msg: any) => {
          allNotifications.push({
            id: msg.id,
            content: msg.message,
            created_at: msg.created_at,
            sender_id: msg.sender_id,
            type: 'message',
            users: msg.users,
          })
        })
      }

      // Sort all notifications by created_at and take top 15
      allNotifications.sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )

      setNotifications(allNotifications.slice(0, 15))
    } catch (error) {
      console.error('Error loading notifications:', error)
    }
  }, [user])

  const handleAcceptInvitation = useCallback(async (invitationId: string) => {
    if (!user?.id) return

    try {
      // Check subscription limits before accepting
      const limitCheck = await canAcceptCollaboration(user.id)
      if (!limitCheck.allowed) {
        showUpgradeAlert(limitCheck.reason || 'Unable to accept invitation', navigation)
        return
      }

      // Update the database first
      const { error } = await supabase
        .from('project_collaborators')
        .update({ invitation_status: 'accepted' })
        .eq('id', invitationId)

      if (error) throw error

      // Remove from state after successful database update
      setInvitations(prev => prev.filter(inv => inv.id !== invitationId))

      Alert.alert('Success', 'Invitation accepted!')
    } catch (error) {
      console.error('Error accepting invitation:', error)
      Alert.alert('Error', 'Failed to accept invitation')
    }
  }, [user?.id, navigation])

  const handleDeclineInvitation = useCallback(async (invitationId: string) => {
    try {
      // Update the database first
      const { error } = await supabase
        .from('project_collaborators')
        .update({ invitation_status: 'declined' })
        .eq('id', invitationId)

      if (error) throw error

      // Remove from state after successful database update
      setInvitations(prev => prev.filter(inv => inv.id !== invitationId))

      Alert.alert('Declined', 'Invitation declined')
    } catch (error) {
      console.error('Error declining invitation:', error)
      Alert.alert('Error', 'Failed to decline invitation')
    }
  }, [])

  const handleDismissNotification = useCallback((notificationId: string) => {
    setNotifications(prev => prev.filter(n => n.id !== notificationId))
  }, [])

  const loadActivities = useCallback(async () => {
    if (!user) return

    try {
      const activities: any[] = []

      // Load blocked user IDs to filter them out
      const { data: blockedUsers } = await supabase
        .from('blocked_users')
        .select('blocked_id')
        .eq('blocker_id', user.id)

      const blockedUserIds = blockedUsers?.map(b => b.blocked_id) || []
      console.log('Filtering out blocked users:', blockedUserIds)

      if (feedFilter === 'all') {
        // Load recent public projects
        const { data: projects } = await supabase
          .from('projects')
          .select('*, users!projects_creator_id_fkey(username, display_name)')
          .eq('is_public', true)
          .neq('creator_id', user.id)
          .order('created_at', { ascending: false })
          .limit(25)

        if (projects) {
          projects.forEach(project => {
            // Skip if creator is blocked
            if (blockedUserIds.includes(project.creator_id)) {
              return
            }

            activities.push({
              id: `project-${project.id}`,
              type: 'project_created',
              created_at: project.created_at,
              projects: {
                id: project.id,
                title: project.title,
                is_public: project.is_public,
                collaboration_needs: project.collaboration_needs
              },
              users: project.users,
              project_data: project
            })
          })
        }

        // Load recent audio uploads from public projects
        const { data: audioFiles } = await supabase
          .from('audio_files')
          .select(`
            *,
            projects!audio_files_project_id_fkey(id, title, is_public, collaboration_needs, creator_id, genre),
            users!audio_files_created_by_fkey(username, display_name)
          `)
          .eq('projects.is_public', true)
          .neq('created_by', user.id)
          .order('created_at', { ascending: false })
          .limit(25)

        if (audioFiles) {
          audioFiles.forEach(file => {
            // Skip if uploader is blocked
            if (blockedUserIds.includes(file.created_by)) {
              return
            }

            activities.push({
              id: `audio-${file.id}`,
              type: 'file_uploaded',
              created_at: file.created_at,
              projects: file.projects,
              users: file.users,
              audio_files: {
                id: file.id,
                stem_name: file.stem_name,
                file_name: file.file_name,
                stem_type: file.stem_type
              }
            })
          })
        }
      } else {
        // Show activity only from collaborators
        if (collabIds.length > 0) {
          // Load projects from collaborators
          const { data: projects } = await supabase
            .from('projects')
            .select('*, users!projects_creator_id_fkey(username, display_name)')
            .in('creator_id', collabIds)
            .order('created_at', { ascending: false })
            .limit(20)

          if (projects) {
            projects.forEach(project => {
              // Skip if creator is blocked
              if (blockedUserIds.includes(project.creator_id)) {
                return
              }

              activities.push({
                id: `project-${project.id}`,
                type: 'project_created',
                created_at: project.created_at,
                projects: {
                  id: project.id,
                  title: project.title,
                  is_public: project.is_public,
                  collaboration_needs: project.collaboration_needs
                },
                users: project.users,
                project_data: project
              })
            })
          }

          // Load audio files from collaborators
          const { data: audioFiles } = await supabase
            .from('audio_files')
            .select(`
              *,
              projects!audio_files_project_id_fkey(id, title, is_public, collaboration_needs, genre),
              users!audio_files_created_by_fkey(username, display_name)
            `)
            .in('created_by', collabIds)
            .order('created_at', { ascending: false })
            .limit(20)

          if (audioFiles) {
            audioFiles.forEach(file => {
              // Skip if uploader is blocked
              if (blockedUserIds.includes(file.created_by)) {
                return
              }

              activities.push({
                id: `audio-${file.id}`,
                type: 'file_uploaded',
                created_at: file.created_at,
                projects: file.projects,
                users: file.users,
                audio_files: {
                  id: file.id,
                  stem_name: file.stem_name,
                  file_name: file.file_name,
                  stem_type: file.stem_type
                }
              })
            })
          }
        } else {
          setActivities([])
          setLoading(false)
          setRefreshing(false)
          return
        }
      }

      // Sort all activities by created_at
      activities.sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )

      setActivities(activities.slice(0, 50))
    } catch (error) {
      console.error('Error loading activities:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [user, feedFilter, collabIds])

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    loadInvitations()
    loadNotifications()
    loadActivities()
  }, [loadInvitations, loadNotifications, loadActivities])

  const formatTimeAgo = useCallback((dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000)

    if (seconds < 60) return 'just now'
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`
    return date.toLocaleDateString()
  }, [])

  const getActivityIcon = useCallback((activity: any) => {
    if (activity.type === 'project_created') return 'folder-open'
    if (activity.type === 'file_uploaded') return 'musical-note'
    return 'chatbubble'
  }, [])

  const getActivityColor = useCallback((activity: any) => {
    if (activity.type === 'project_created') return Colors.primary
    if (activity.type === 'file_uploaded') return Colors.success
    return Colors.info
  }, [])

  const getActivityText = useCallback((activity: any) => {
    const userName = activity.users?.display_name || activity.users?.username || 'Someone'

    if (activity.type === 'project_created') {
      return `${userName} created "${activity.projects?.title}"`
    }
    if (activity.type === 'file_uploaded') {
      return `${userName} uploaded "${activity.audio_files?.stem_name}" to ${activity.projects?.title}`
    }
    return activity.content || 'New activity'
  }, [])

  const getActivityDescription = useCallback((item: ActivityItem) => {
    // Additional details for ActivityScreen (more space than HomeScreen)
    if (item.type === 'project_created' && item.project_data) {
      const details = []
      if (item.project_data.genre) details.push(item.project_data.genre)
      if (item.project_data.bpm) details.push(`${item.project_data.bpm} BPM`)
      if (item.project_data.key) details.push(item.project_data.key)
      return details.length > 0 ? details.join(' • ') : null
    }
    if (item.type === 'file_uploaded' && item.audio_files) {
      return item.audio_files.stem_type ? `${item.audio_files.stem_type} track` : null
    }
    return null
  }, [])

  const handleActivityPress = useCallback((item: ActivityItem) => {
    if (item.projects?.id) {
      navigation.navigate('ProjectDetail', { projectId: item.projects.id })
    }
  }, [navigation])

  const renderActivityItem = useCallback(({ item }: { item: ActivityItem }) => {
    // Check if this project's collaboration needs match user's skills
    const matchesSkills = hasSkillMatch(
      userProfile?.specialties,
      item.projects?.collaboration_needs
    )

    const additionalDetails = getActivityDescription(item)

    return (
      <TouchableOpacity
        style={[
          styles.activityCard,
          matchesSkills && styles.activityCardMatched
        ]}
        onPress={() => handleActivityPress(item)}
        activeOpacity={0.7}
      >
        <View style={[
          styles.activityIcon,
          { backgroundColor: `${getActivityColor(item)}20` }
        ]}>
          <Ionicons
            name={getActivityIcon(item) as any}
            size={20}
            color={getActivityColor(item)}
          />
        </View>

        <View style={styles.activityContent}>
          <View style={styles.activityHeaderRow}>
            <Text style={styles.activityText} numberOfLines={2}>
              {getActivityText(item)}
            </Text>
            {matchesSkills && (
              <View style={styles.skillsMatchBadgeSmall}>
                <Ionicons name="checkmark-circle" size={12} color={Colors.success} />
                <Text style={styles.skillsMatchTextSmall}>Match</Text>
              </View>
            )}
          </View>

          {additionalDetails && (
            <Text style={styles.activityDetails}>{additionalDetails}</Text>
          )}

          <View style={styles.activityMeta}>
            <Ionicons name="time-outline" size={12} color={Colors.textTertiary} />
            <Text style={styles.activityTime}>
              {formatTimeAgo(item.created_at)}
            </Text>
          </View>
        </View>

        <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
      </TouchableOpacity>
    )
  }, [userProfile?.specialties, getActivityDescription, handleActivityPress, getActivityColor, getActivityIcon, getActivityText, formatTimeAgo])

  const renderListHeader = () => (
    <>
      {/* Action Items Section */}
      <View style={styles.actionItemsSection}>
        {/* Invitations Card */}
        <View style={styles.actionCard}>
          <TouchableOpacity
            style={styles.actionCardHeader}
            onPress={() => setInvitationsExpanded(!invitationsExpanded)}
            activeOpacity={0.7}
          >
            <View style={styles.actionCardHeaderLeft}>
              <Ionicons name="people" size={20} color={Colors.primary} />
              <Text style={styles.actionCardTitle}>Invitations</Text>
              {invitations.length > 0 && (
                <View style={styles.actionCardBadge}>
                  <Text style={styles.actionCardBadgeText}>{invitations.length}</Text>
                </View>
              )}
            </View>
            <Ionicons
              name={invitationsExpanded ? "chevron-up" : "chevron-down"}
              size={20}
              color={Colors.textSecondary}
            />
          </TouchableOpacity>

          {invitationsExpanded && (
            <View style={styles.actionCardContent}>
              {invitations.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyCardText}>No pending invitations</Text>
                </View>
              ) : (
                invitations.map((invitation) => (
                  <View key={invitation.id} style={styles.invitationItem}>
                    <View style={styles.invitationInfo}>
                      <Text style={styles.invitationText} numberOfLines={1}>
                        <Text style={styles.invitationUser}>
                          {invitation.inviter?.display_name || invitation.inviter?.username}
                        </Text>
                        {' invited you to '}
                        <Text style={styles.invitationProject}>
                          {invitation.projects?.title}
                        </Text>
                      </Text>
                    </View>
                    <View style={styles.invitationActions}>
                      <TouchableOpacity
                        style={styles.acceptButton}
                        onPress={() => handleAcceptInvitation(invitation.id)}
                      >
                        <Ionicons name="checkmark" size={18} color={Colors.text} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.declineButton}
                        onPress={() => handleDeclineInvitation(invitation.id)}
                      >
                        <Ionicons name="close" size={18} color={Colors.text} />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              )}
            </View>
          )}
        </View>

        {/* Notifications Card */}
        <View style={styles.actionCard}>
          <TouchableOpacity
            style={styles.actionCardHeader}
            onPress={() => setNotificationsExpanded(!notificationsExpanded)}
            activeOpacity={0.7}
          >
            <View style={styles.actionCardHeaderLeft}>
              <Ionicons name="notifications" size={20} color={Colors.primary} />
              <Text style={styles.actionCardTitle}>Notifications</Text>
              {notifications.length > 0 && (
                <View style={styles.actionCardBadge}>
                  <Text style={styles.actionCardBadgeText}>{notifications.length}</Text>
                </View>
              )}
            </View>
            <Ionicons
              name={notificationsExpanded ? "chevron-up" : "chevron-down"}
              size={20}
              color={Colors.textSecondary}
            />
          </TouchableOpacity>

          {notificationsExpanded && (
            <View style={styles.actionCardContent}>
              {notifications.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyCardText}>No new notifications</Text>
                </View>
              ) : (
                notifications.map((notification) => (
                  <TouchableOpacity
                    key={notification.id}
                    style={styles.notificationItem}
                    onPress={() => setSelectedNotification(notification)}
                    activeOpacity={0.7}
                  >
                    <View style={[
                      styles.notificationIcon,
                      notification.type === 'message' && { backgroundColor: `${Colors.info}20` }
                    ]}>
                      <Ionicons
                        name={notification.type === 'message' ? "mail" : "chatbubble"}
                        size={16}
                        color={notification.type === 'message' ? Colors.info : Colors.primary}
                      />
                    </View>
                    <View style={styles.notificationInfo}>
                      <Text style={styles.notificationText} numberOfLines={2}>
                        <Text style={styles.notificationUser}>
                          {notification.users?.display_name || notification.users?.username}
                        </Text>
                        {notification.type === 'message' ? (
                          ' sent you a message'
                        ) : (
                          <>
                            {' commented on '}
                            <Text style={styles.notificationProject}>
                              {notification.projects?.title}
                            </Text>
                          </>
                        )}
                      </Text>
                      {notification.content && (
                        <Text style={styles.notificationContent} numberOfLines={2}>
                          "{notification.content}"
                        </Text>
                      )}
                      <Text style={styles.notificationTime}>
                        {formatTimeAgo(notification.created_at)}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.dismissButton}
                      onPress={(e) => {
                        e.stopPropagation()
                        handleDismissNotification(notification.id)
                      }}
                    >
                      <Ionicons name="close-circle" size={20} color={Colors.textSecondary} />
                    </TouchableOpacity>
                  </TouchableOpacity>
                ))
              )}
            </View>
          )}
        </View>
      </View>

      {/* Feed Header with Filters */}
      <View style={styles.feedHeader}>
        <Text style={styles.feedTitle}>What's Happening</Text>
        <Text style={styles.feedSubtitle}>See what others are creating</Text>

        <View style={styles.feedFilters}>
          <TouchableOpacity
            style={[
              styles.filterButton,
              feedFilter === 'all' && styles.filterButtonActive
            ]}
            onPress={() => setFeedFilter('all')}
          >
            <Ionicons
              name="globe-outline"
              size={16}
              color={feedFilter === 'all' ? Colors.text : Colors.textSecondary}
            />
            <Text style={[
              styles.filterButtonText,
              feedFilter === 'all' && styles.filterButtonTextActive
            ]}>
              All Activity
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterButton,
              feedFilter === 'collabs' && styles.filterButtonActive
            ]}
            onPress={() => setFeedFilter('collabs')}
          >
            <Ionicons
              name="people-outline"
              size={16}
              color={feedFilter === 'collabs' ? Colors.text : Colors.textSecondary}
            />
            <Text style={[
              styles.filterButtonText,
              feedFilter === 'collabs' && styles.filterButtonTextActive
            ]}>
              My Kollabs
            </Text>
            {collabIds.length > 0 && (
              <View style={styles.filterBadge}>
                <Text style={styles.filterBadgeText}>{collabIds.length}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </>
  )

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="chatbubbles-outline" size={64} color={Colors.textSecondary} />
      <Text style={styles.emptyTitle}>
        {feedFilter === 'all' ? 'No Activity Yet' : 'No Kollaborator Activity'}
      </Text>
      <Text style={styles.emptyText}>
        {feedFilter === 'all'
          ? 'Be the first to start creating and kollaborating'
          : 'Activity from your kollaborators will appear here'
        }
      </Text>
      <TouchableOpacity
        style={styles.exploreButton}
        onPress={() => navigation.navigate('Search')}
      >
        <Text style={styles.exploreButtonText}>Find Kollaborators</Text>
      </TouchableOpacity>
    </View>
  )

  return (
    <>
      {/* Message Detail Modal */}
      <Modal
        visible={selectedNotification !== null}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setSelectedNotification(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderLeft}>
                <View style={[
                  styles.modalHeaderIcon,
                  selectedNotification?.type === 'message' && { backgroundColor: `${Colors.info}20` }
                ]}>
                  <Ionicons
                    name={selectedNotification?.type === 'message' ? 'mail' : 'chatbubble'}
                    size={24}
                    color={selectedNotification?.type === 'message' ? Colors.info : Colors.primary}
                  />
                </View>
                <View>
                  <Text style={styles.modalHeaderTitle}>
                    {selectedNotification?.type === 'message' ? 'Message' : 'Comment'}
                  </Text>
                  <Text style={styles.modalHeaderSubtitle}>
                    from {selectedNotification?.users?.display_name || selectedNotification?.users?.username}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setSelectedNotification(null)}
              >
                <Ionicons name="close" size={24} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Modal Content */}
            <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
              {selectedNotification?.projects?.title && (
                <View style={styles.modalProjectInfo}>
                  <Ionicons name="folder" size={16} color={Colors.textSecondary} />
                  <Text style={styles.modalProjectText}>{selectedNotification.projects.title}</Text>
                </View>
              )}
              <Text style={styles.modalMessageText}>
                {selectedNotification?.content || 'No content'}
              </Text>
              <Text style={styles.modalTimeText}>
                {selectedNotification && formatTimeAgo(selectedNotification.created_at)}
              </Text>
            </ScrollView>

            {/* Modal Actions */}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalActionButton}
                onPress={() => {
                  if (selectedNotification?.type === 'message' && selectedNotification.sender_id) {
                    setSelectedNotification(null)
                    navigation.navigate('UserProfile', { userId: selectedNotification.sender_id })
                  } else if (selectedNotification?.project_id) {
                    setSelectedNotification(null)
                    navigation.navigate('ProjectDetail', { projectId: selectedNotification.project_id })
                  }
                }}
              >
                <Ionicons
                  name={selectedNotification?.type === 'message' ? 'person' : 'folder-open'}
                  size={20}
                  color={Colors.text}
                />
                <Text style={styles.modalActionText}>
                  {selectedNotification?.type === 'message' ? 'View Profile' : 'View Project'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalActionButton, styles.modalActionButtonPrimary]}
                onPress={() => {
                  setSelectedNotification(null)
                  if (selectedNotification?.type === 'message' && selectedNotification.sender_id) {
                    navigation.navigate('UserProfile', { userId: selectedNotification.sender_id })
                  } else if (selectedNotification?.project_id) {
                    navigation.navigate('ProjectDetail', { projectId: selectedNotification.project_id })
                  }
                }}
              >
                <Ionicons name="chatbubble-outline" size={20} color={Colors.text} />
                <Text style={styles.modalActionText}>Reply</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <FlatList
        style={styles.content}
        data={activities}
        renderItem={renderActivityItem}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderListHeader}
        ListEmptyComponent={loading ? <SkeletonList count={8} type="activity" /> : renderEmptyState()}
        contentContainerStyle={loading || activities.length === 0 ? styles.section : undefined}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.primary}
          />
        }
        removeClippedSubviews={true}
        maxToRenderPerBatch={10}
        windowSize={5}
        initialNumToRender={15}
        ListFooterComponent={<View style={styles.bottomSpacer} />}
      />
    </>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.backgroundDark,
  },
  content: {
    flex: 1,
  },
  section: {
    padding: Spacing.md,
  },
  feedHeader: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  feedTitle: {
    ...Typography.h2,
    color: Colors.text,
    marginBottom: Spacing.xxs,
  },
  feedSubtitle: {
    ...Typography.body,
    color: Colors.textSecondary,
    marginBottom: Spacing.md,
  },
  feedFilters: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.xs,
  },
  filterButtonActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterButtonText: {
    ...Typography.body,
    color: Colors.textSecondary,
    fontWeight: '600',
    fontSize: scale(13),
    flexShrink: 1,
  },
  filterButtonTextActive: {
    color: Colors.text,
  },
  filterBadge: {
    backgroundColor: `${Colors.text}30`,
    borderRadius: scale(10),
    minWidth: scale(20),
    height: scale(20),
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
    marginLeft: 2,
  },
  filterBadgeText: {
    ...Typography.tiny,
    color: Colors.text,
    fontWeight: '700',
  },
  activityCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: Colors.surface,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  activityCardMatched: {
    borderWidth: 2,
    borderColor: Colors.success,
    backgroundColor: `${Colors.success}08`,
    shadowColor: Colors.success,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  activityIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: `${Colors.primary}20`,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  activityContent: {
    flex: 1,
  },
  activityHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: Spacing.xxs,
    gap: Spacing.xs,
  },
  activityHeader: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  activityUser: {
    ...Typography.bodyLarge,
    color: Colors.text,
    fontWeight: '600',
  },
  activityTime: {
    ...Typography.caption,
    color: Colors.textTertiary,
  },
  activityProject: {
    ...Typography.body,
    fontWeight: '600',
    color: Colors.primary,
  },
  activityText: {
    ...Typography.body,
    color: Colors.text,
    flex: 1,
  },
  activityDetails: {
    ...Typography.caption,
    color: Colors.textSecondary,
    marginTop: Spacing.xxs,
    marginBottom: Spacing.xs,
  },
  activityMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  activityDescription: {
    ...Typography.body,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  activityComment: {
    ...Typography.body,
    color: Colors.textSecondary,
    fontStyle: 'italic',
    marginBottom: Spacing.sm,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing.xxxl,
    paddingHorizontal: Spacing.xl,
  },
  emptyTitle: {
    ...Typography.h3,
    color: Colors.text,
    marginTop: Spacing.md,
    marginBottom: Spacing.xs,
  },
  emptyText: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.xl,
  },
  exploreButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  exploreButtonText: {
    ...Typography.bodyLarge,
    color: Colors.text,
    fontWeight: '600',
  },
  bottomSpacer: {
    height: Spacing.xxxl,
  },

  // Action Items Section
  actionItemsSection: {
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  actionCard: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
  },
  actionCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
    backgroundColor: Colors.surfaceElevated,
  },
  actionCardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  actionCardTitle: {
    ...Typography.bodyLarge,
    color: Colors.text,
    fontWeight: '600',
  },
  actionCardBadge: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    minWidth: 20,
    alignItems: 'center',
  },
  actionCardBadgeText: {
    ...Typography.tiny,
    color: Colors.text,
    fontWeight: '700',
    fontSize: 11,
  },
  actionCardContent: {
    padding: Spacing.sm,
  },

  // Invitation Items
  invitationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  invitationInfo: {
    flex: 1,
  },
  invitationText: {
    ...Typography.body,
    color: Colors.text,
    marginBottom: Spacing.xxs,
  },
  invitationUser: {
    fontWeight: '600',
    color: Colors.primary,
  },
  invitationProject: {
    fontWeight: '600',
    color: Colors.text,
  },
  invitationTime: {
    ...Typography.caption,
    color: Colors.textSecondary,
  },
  invitationActions: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  acceptButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.success,
    justifyContent: 'center',
    alignItems: 'center',
  },
  declineButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.error,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Notification Items
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  notificationIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: `${Colors.primary}20`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationInfo: {
    flex: 1,
  },
  notificationText: {
    ...Typography.body,
    color: Colors.text,
    marginBottom: Spacing.xxs,
  },
  notificationUser: {
    fontWeight: '600',
    color: Colors.primary,
  },
  notificationProject: {
    fontWeight: '600',
    color: Colors.text,
  },
  notificationContent: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontStyle: 'italic',
    marginBottom: Spacing.xxs,
  },
  notificationTime: {
    ...Typography.caption,
    color: Colors.textSecondary,
  },
  dismissButton: {
    padding: Spacing.xxs,
  },
  emptyCard: {
    padding: Spacing.md,
    alignItems: 'center',
  },
  emptyCardText: {
    ...Typography.body,
    color: Colors.textSecondary,
    fontStyle: 'italic',
  },
  skillsMatchBadgeSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: `${Colors.success}20`,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.success,
  },
  skillsMatchTextSmall: {
    ...Typography.caption,
    color: Colors.success,
    fontWeight: '700',
    fontSize: 10,
  },

  // Message Detail Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    maxHeight: '80%',
    paddingBottom: Spacing.xl,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
  },
  modalHeaderIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: `${Colors.primary}20`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalHeaderTitle: {
    ...Typography.bodyLarge,
    color: Colors.text,
    fontWeight: '600',
  },
  modalHeaderSubtitle: {
    ...Typography.caption,
    color: Colors.textSecondary,
  },
  modalCloseButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
    backgroundColor: Colors.surfaceElevated,
  },
  modalContent: {
    padding: Spacing.lg,
    maxHeight: 300,
  },
  modalProjectInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.md,
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalProjectText: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  modalMessageText: {
    ...Typography.body,
    color: Colors.text,
    lineHeight: 24,
  },
  modalTimeText: {
    ...Typography.caption,
    color: Colors.textTertiary,
    marginTop: Spacing.md,
  },
  modalActions: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
  },
  modalActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalActionButtonPrimary: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  modalActionText: {
    ...Typography.body,
    color: Colors.text,
    fontWeight: '600',
  },
})
