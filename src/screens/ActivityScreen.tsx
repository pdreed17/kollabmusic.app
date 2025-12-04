import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  RefreshControl,
  FlatList,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { Colors, Typography, Spacing, BorderRadius } from '../constants/theme'
import Header from '../components/Header'
import { SkeletonList } from '../components/LoadingSkeleton'
import { hasSkillMatch } from '../utils/skillMatching'

interface ActivityItem {
  id: string
  content: string
  created_at: string
  timestamp_ms?: number
  projects: {
    id: string
    title: string
    is_public: boolean
    collaboration_needs?: string[]
  }
  users: {
    username: string
    display_name: string
  }
  audio_files?: {
    stem_name: string
    file_name: string
  }
}

interface Invitation {
  id: string
  project_id: string
  created_at: string
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
  project_id: string
  audio_file_id?: string
  projects: {
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

  useEffect(() => {
    if (user) {
      loadCollaboratorIds()
      loadInvitations()
      loadNotifications()
      loadActivities()
    }
  }, [user])

  useEffect(() => {
    if (!loading) {
      loadActivities()
    }
  }, [feedFilter])

  const loadCollaboratorIds = async () => {
    if (!user) return

    try {
      // Get all unique user IDs from projects where current user is a collaborator
      const { data: collabs } = await supabase
        .from('collaborators')
        .select('project_id')
        .eq('user_id', user.id)
        .eq('invitation_status', 'accepted')

      if (collabs && collabs.length > 0) {
        const projectIds = collabs.map(c => c.project_id)

        // Get all collaborators from those projects
        const { data: allCollaborators } = await supabase
          .from('collaborators')
          .select('user_id')
          .in('project_id', projectIds)
          .eq('invitation_status', 'accepted')
          .neq('user_id', user.id) // Exclude current user

        const uniqueUserIds = [...new Set(allCollaborators?.map(c => c.user_id) || [])]
        setCollabIds(uniqueUserIds as string[])
      }
    } catch (error) {
      console.error('Error loading collaborator IDs:', error)
    }
  }

  const loadInvitations = async () => {
    if (!user) return

    try {
      const { data, error } = await supabase
        .from('collaborators')
        .select(`
          id,
          project_id,
          created_at,
          projects(title),
          inviter:users!invited_by(username, display_name)
        `)
        .eq('user_id', user.id)
        .eq('invitation_status', 'pending')
        .order('created_at', { ascending: false })

      if (error) throw error
      setInvitations((data || []) as any)
    } catch (error) {
      console.error('Error loading invitations:', error)
    }
  }

  const loadNotifications = async () => {
    if (!user) return

    try {
      // Get user's own projects
      const { data: myProjects } = await supabase
        .from('projects')
        .select('id')
        .eq('creator_id', user.id)

      if (!myProjects || myProjects.length === 0) {
        setNotifications([])
        return
      }

      const projectIds = myProjects.map(p => p.id)

      // Get comments on user's projects from others
      const { data, error } = await supabase
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

      if (error) throw error
      setNotifications((data || []) as any)
    } catch (error) {
      console.error('Error loading notifications:', error)
    }
  }

  const handleAcceptInvitation = async (invitationId: string) => {
    try {
      const { error } = await supabase
        .from('collaborators')
        .update({ invitation_status: 'accepted' })
        .eq('id', invitationId)

      if (error) throw error

      // Reload invitations
      await loadInvitations()
    } catch (error) {
      console.error('Error accepting invitation:', error)
    }
  }

  const handleDeclineInvitation = async (invitationId: string) => {
    try {
      const { error } = await supabase
        .from('collaborators')
        .update({ invitation_status: 'declined' })
        .eq('id', invitationId)

      if (error) throw error

      // Reload invitations
      await loadInvitations()
    } catch (error) {
      console.error('Error declining invitation:', error)
    }
  }

  const handleDismissNotification = (notificationId: string) => {
    setNotifications(prev => prev.filter(n => n.id !== notificationId))
  }

  const loadActivities = async () => {
    if (!user) return

    try {
      let query = supabase
        .from('comments')
        .select(`
          *,
          projects(id, title, is_public, collaboration_needs),
          users!comments_user_id_fkey(username, display_name),
          audio_files(stem_name, file_name)
        `)
        .neq('user_id', user.id) // Exclude current user's own activity
        .order('created_at', { ascending: false })

      if (feedFilter === 'all') {
        // Show activity from all public projects (excluding current user)
        query = query.eq('projects.is_public', true).limit(50)
      } else {
        // Show activity only from collaborators (excluding current user)
        if (collabIds.length > 0) {
          query = query.in('user_id', collabIds).limit(50)
        } else {
          setActivities([])
          setLoading(false)
          setRefreshing(false)
          return
        }
      }

      const { data, error } = await query

      if (error) throw error

      setActivities((data || []) as any)
    } catch (error) {
      console.error('Error loading activities:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const onRefresh = () => {
    setRefreshing(true)
    loadInvitations()
    loadNotifications()
    loadActivities()
  }

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000)

    if (seconds < 60) return 'just now'
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`
    return date.toLocaleDateString()
  }

  const getActivityDescription = (item: ActivityItem) => {
    if (item.timestamp_ms) {
      const minutes = Math.floor(item.timestamp_ms / 60000)
      const seconds = Math.floor((item.timestamp_ms % 60000) / 1000)
      return `Commented at ${minutes}:${seconds.toString().padStart(2, '0')}`
    }
    return item.audio_files
      ? `Commented on ${item.audio_files.stem_name || item.audio_files.file_name}`
      : 'Commented on project'
  }

  const handleActivityPress = (item: ActivityItem) => {
    if (item.projects?.id) {
      navigation.navigate('ProjectDetail', { projectId: item.projects.id })
    }
  }

  const renderActivityItem = ({ item }: { item: ActivityItem }) => {
    // Check if this project's collaboration needs match user's skills
    const matchesSkills = hasSkillMatch(
      userProfile?.specialties,
      item.projects?.collaboration_needs
    )

    return (
      <TouchableOpacity
        style={[
          styles.activityCard,
          matchesSkills && styles.activityCardMatched
        ]}
        onPress={() => handleActivityPress(item)}
        activeOpacity={0.7}
      >
        <View style={styles.activityIcon}>
          <Ionicons name="chatbubble" size={24} color={Colors.primary} />
        </View>
        <View style={styles.activityContent}>
          <View style={styles.activityHeaderRow}>
            <View style={styles.activityHeader}>
              <Text style={styles.activityUser}>
                {item.users?.display_name || item.users?.username || 'Unknown User'}
              </Text>
              <Text style={styles.activityTime}>{formatTimeAgo(item.created_at)}</Text>
            </View>
            {matchesSkills && (
              <View style={styles.skillsMatchBadgeSmall}>
                <Ionicons name="checkmark-circle" size={12} color={Colors.success} />
                <Text style={styles.skillsMatchTextSmall}>Match</Text>
              </View>
            )}
          </View>
          <Text style={styles.activityProject}>{item.projects?.title || 'Unknown Project'}</Text>
          <Text style={styles.activityDescription}>{getActivityDescription(item)}</Text>
          {item.content && (
            <Text style={styles.activityComment} numberOfLines={2}>
              "{item.content}"
            </Text>
          )}
        </View>
        <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
      </TouchableOpacity>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <Header
        title="Activity"
        variant="compact"
        showBack={true}
        onBack={() => navigation.goBack()}
        showProfile={true}
        onProfilePress={() => navigation.navigate('Profile')}
        profilePhotoUrl={userProfile?.avatar_url}
      />

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.primary}
          />
        }
      >
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
                        <Text style={styles.invitationTime}>
                          {formatTimeAgo(invitation.created_at)}
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
                      onPress={() => navigation.navigate('ProjectDetail', { projectId: notification.project_id })}
                      activeOpacity={0.7}
                    >
                      <View style={styles.notificationIcon}>
                        <Ionicons name="chatbubble" size={16} color={Colors.primary} />
                      </View>
                      <View style={styles.notificationInfo}>
                        <Text style={styles.notificationText} numberOfLines={2}>
                          <Text style={styles.notificationUser}>
                            {notification.users?.display_name || notification.users?.username}
                          </Text>
                          {' commented on '}
                          <Text style={styles.notificationProject}>
                            {notification.projects?.title}
                          </Text>
                        </Text>
                        {notification.content && (
                          <Text style={styles.notificationContent} numberOfLines={1}>
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
                My Collabs
              </Text>
              {collabIds.length > 0 && (
                <View style={styles.filterBadge}>
                  <Text style={styles.filterBadgeText}>{collabIds.length}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Activity Feed */}
        <View style={styles.section}>
          {loading ? (
            <SkeletonList count={8} type="activity" />
          ) : activities.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="chatbubbles-outline" size={64} color={Colors.textSecondary} />
              <Text style={styles.emptyTitle}>
                {feedFilter === 'all' ? 'No Activity Yet' : 'No Collaborator Activity'}
              </Text>
              <Text style={styles.emptyText}>
                {feedFilter === 'all'
                  ? 'Be the first to start creating and collaborating'
                  : 'Activity from your collaborators will appear here'
                }
              </Text>
              <TouchableOpacity
                style={styles.exploreButton}
                onPress={() => navigation.navigate('Search')}
              >
                <Text style={styles.exploreButtonText}>Find Collaborators</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {activities.map((item) => (
                <View key={item.id}>
                  {renderActivityItem({ item })}
                </View>
              ))}
            </>
          )}
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
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
    padding: Spacing.md,
    paddingBottom: 0,
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
    marginTop: Spacing.sm,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterButtonActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterButtonText: {
    ...Typography.body,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  filterButtonTextActive: {
    color: Colors.text,
  },
  filterBadge: {
    backgroundColor: Colors.error,
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    minWidth: 20,
    alignItems: 'center',
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
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    gap: Spacing.md,
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
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: `${Colors.primary}20`,
    justifyContent: 'center',
    alignItems: 'center',
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
    color: Colors.textSecondary,
  },
  activityProject: {
    ...Typography.body,
    color: Colors.primary,
    marginBottom: Spacing.xxs,
  },
  activityDescription: {
    ...Typography.body,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  activityComment: {
    ...Typography.body,
    color: Colors.text,
    fontStyle: 'italic',
    backgroundColor: Colors.backgroundDark,
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    borderLeftWidth: 3,
    borderLeftColor: Colors.primary,
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
})
