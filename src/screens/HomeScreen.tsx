import React, { useState, useEffect, useCallback, useMemo, memo } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Image,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useFocusEffect } from '@react-navigation/native'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../constants/theme'
import ProjectIcon from '../components/ProjectIcon'
import { SkeletonList, ProjectCardSkeleton } from '../components/LoadingSkeleton'
import { hasSkillMatch } from '../utils/skillMatching'
import { scale } from '../utils/responsive'

export default function HomeScreen({ navigation }: any) {
  const { user, userProfile } = useAuth()
  
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [feedFilter, setFeedFilter] = useState<'all' | 'collabs'>('all')
  
  // Command Center Data
  const [recentProjects, setRecentProjects] = useState<any[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [pendingInvites, setPendingInvites] = useState(0)
  
  // Activity Feed Data
  const [activityFeed, setActivityFeed] = useState<any[]>([])
  const [collabIds, setCollabIds] = useState<string[]>([])

  useEffect(() => {
    if (user?.id) {
      loadHomeData()

      // Set up real-time subscription for invitations count
      const invitationsSubscription = supabase
        .channel('home-invitations')
        .on(
          'postgres_changes',
          {
            event: '*',  // Listen for all changes (INSERT, UPDATE, DELETE)
            schema: 'public',
            table: 'project_collaborators',
            filter: `user_id=eq.${user.id}`
          },
          () => {
            loadInvitationsCount()
          }
        )
        .subscribe()

      // Set up real-time subscription for activity feed updates
      const activitySubscription = supabase
        .channel('home-activity')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'projects'
          },
          () => {
            loadActivityFeed()
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
            loadActivityFeed()
          }
        )
        .subscribe()

      return () => {
        invitationsSubscription.unsubscribe()
        activitySubscription.unsubscribe()
      }
    }
  }, [user?.id])

  useEffect(() => {
    if (!loading && user?.id) {
      loadActivityFeed()
    }
  }, [feedFilter, loading, user?.id, collabIds])

  const loadInvitationsCount = useCallback(async () => {
    try {
      if (!user?.id) return

      const { count: inviteCount } = await supabase
        .from('project_collaborators')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('invitation_status', 'pending')

      setPendingInvites(inviteCount || 0)
    } catch (error) {
    }
  }, [user?.id])

  // Reload invitation count when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      if (!loading && user?.id) {
        loadInvitationsCount()
      }
    }, [loading, user?.id, loadInvitationsCount])
  )

  const loadHomeData = useCallback(async () => {
    try {
      if (!user?.id) return

      const { data: projects } = await supabase
        .from('projects')
        .select('*')
        .eq('creator_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(2)

      setRecentProjects(projects || [])

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
        const { data: projectCollaborators } = await supabase
          .from('project_collaborators')
          .select('user_id')
          .in('project_id', allProjectIds)
          .eq('invitation_status', 'accepted')
          .neq('user_id', user.id)

        const uniqueCollabIds = [...new Set(projectCollaborators?.map(c => c.user_id))] as string[]
        setCollabIds(uniqueCollabIds)
      } else {
        setCollabIds([])
      }

      const { count: unreadMessages } = await supabase
        .from('comments')
        .select('*', { count: 'exact', head: true })
        .in('project_id', (projects || []).map(p => p.id))
        .neq('user_id', user.id) // Exclude own comments
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())

      setUnreadCount(unreadMessages || 0)

      await loadInvitationsCount()
      await loadActivityFeed()

    } catch (error) {
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [user?.id, loadInvitationsCount])

  const loadActivityFeed = useCallback(async () => {
    try {
      if (!user?.id) return

      const activities: any[] = []

      // Load blocked user IDs to filter them out
      const { data: blockedUsers } = await supabase
        .from('blocked_users')
        .select('blocked_id')
        .eq('blocker_id', user.id)

      const blockedUserIds = blockedUsers?.map(b => b.blocked_id) || []

      if (feedFilter === 'all') {
        // Load recent public projects
        const { data: projects } = await supabase
          .from('projects')
          .select('*, users!projects_creator_id_fkey(username, display_name)')
          .eq('is_public', true)
          .neq('creator_id', user.id) // Exclude current user's projects
          .order('created_at', { ascending: false })
          .limit(15)

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
                collaboration_needs: project.collaboration_needs,
                genre: project.genre
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
          .neq('created_by', user.id) // Exclude current user's uploads
          .order('created_at', { ascending: false })
          .limit(15)

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
            .limit(10)

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
                  collaboration_needs: project.collaboration_needs,
                  genre: project.genre
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
            .limit(10)

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
          setActivityFeed([])
          return
        }
      }

      // Sort all activities by created_at
      activities.sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )

      setActivityFeed(activities.slice(0, 30))

    } catch (error) {
      console.error('Error loading activity feed:', error)
    }
  }, [user?.id, feedFilter, collabIds])

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    loadHomeData()
  }, [loadHomeData])

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

  const handleActivityPress = useCallback((activity: any) => {
    if (!activity.projects?.id) return

    // Navigate to ProjectDetail for both project creation and file uploads
    navigation.navigate('ProjectDetail', { projectId: activity.projects.id })
  }, [navigation])

  const formatTimeAgo = useCallback((date: string) => {
    const seconds = Math.floor((new Date().getTime() - new Date(date).getTime()) / 1000)

    if (seconds < 60) return 'just now'
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`
    return new Date(date).toLocaleDateString()
  }, [])

  if (loading) {
    return (
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.commandZone}>
          <View style={styles.welcomeSection}>
            <Text style={styles.greeting}>Loading...</Text>
          </View>
        </View>
        <View style={styles.feedZone}>
          <View style={styles.feedHeader}>
            <Text style={styles.feedTitle}>What's Happening</Text>
          </View>
          <SkeletonList count={4} type="project" />
        </View>
      </ScrollView>
    )
  }

  return (
    <ScrollView 
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
        }
      >
        {/* ZONE 1: COMMAND CENTER */}
        <View style={styles.commandZone}>
          {/* Alerts Banner (includes invitations + messages) */}
          {(unreadCount > 0 || pendingInvites > 0) && (
            <TouchableOpacity 
              style={styles.alertsBanner}
              onPress={() => {
                if (pendingInvites > 0) {
                  navigation.navigate('PendingInvitations')
                } else {
                  navigation.navigate('Activity')
                }
              }}
            >
              <View style={styles.alertIcon}>
                <Ionicons name="notifications" size={20} color={Colors.text} />
                <View style={styles.alertBadge}>
                  <Text style={styles.alertBadgeText}>
                    {unreadCount + pendingInvites}
                  </Text>
                </View>
              </View>
              <View style={styles.alertContent}>
                <Text style={styles.alertText}>
                  {pendingInvites > 0 && `${pendingInvites} pending invite${pendingInvites > 1 ? 's' : ''}`}
                  {pendingInvites > 0 && unreadCount > 0 && ' • '}
                  {unreadCount > 0 && `${unreadCount} new message${unreadCount > 1 ? 's' : ''}`}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={Colors.text} />
            </TouchableOpacity>
          )}

          {/* Welcome */}
          <View style={styles.welcomeSection}>
            <Text style={styles.greeting}>
              Hey, {userProfile?.first_name || userProfile?.display_name || userProfile?.username || 'there'}!
            </Text>
          </View>

          {/* Continue Working */}
          {recentProjects.length > 0 && (
            <View style={styles.continueSection}>
              <Text style={styles.sectionTitle}>Continue Working</Text>
              <View style={styles.continueCards}>
                {recentProjects.map((project) => (
                  <TouchableOpacity
                    key={project.id}
                    style={styles.continueCard}
                    onPress={() => navigation.navigate('ProjectDetail', { projectId: project.id })}
                  >
                    <ProjectIcon size="medium" genre={project.genre} />
                    <Text style={styles.continueCardTitle} numberOfLines={1}>
                      {project.title}
                    </Text>
                    <Text style={styles.continueCardTime}>
                      {formatTimeAgo(project.updated_at)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Quick Actions */}
          <View style={styles.quickActionsSection}>
            <View style={styles.quickActions}>
              <TouchableOpacity 
                style={[styles.quickAction, styles.primaryAction]}
                onPress={() => navigation.navigate('CreateProject')}
              >
                <Ionicons name="add-circle" size={28} color={Colors.text} />
                <Text style={styles.quickActionText}>New Project</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.quickAction}
                onPress={() => navigation.navigate('Projects')}
              >
                <Ionicons name="folder-open-outline" size={28} color={Colors.primary} />
                <Text style={styles.quickActionText}>My Projects</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.quickAction}
                onPress={() => navigation.navigate('Search')}
              >
                <Ionicons name="search-outline" size={28} color={Colors.primary} />
                <Text style={styles.quickActionText}>Discover</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* ZONE 2: ACTIVITY FEED */}
        <View style={styles.feedZone}>
          <View style={styles.feedHeader}>
            <Text style={styles.feedTitle}>What's Happening</Text>
            <Text style={styles.feedSubtitle}>Latest activity from others</Text>
            
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
                <Text
                  style={[
                    styles.filterButtonText,
                    feedFilter === 'all' && styles.filterButtonTextActive
                  ]}
                  numberOfLines={1}
                >
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
                <Text
                  style={[
                    styles.filterButtonText,
                    feedFilter === 'collabs' && styles.filterButtonTextActive
                  ]}
                  numberOfLines={1}
                >
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

          {/* Activity Feed */}
          {activityFeed.length === 0 ? (
            <View style={styles.emptyFeed}>
              <Ionicons name="chatbubbles-outline" size={48} color={Colors.textSecondary} />
              <Text style={styles.emptyFeedTitle}>
                {feedFilter === 'all' ? 'No Activity Yet' : 'No Kollaborator Activity'}
              </Text>
              <Text style={styles.emptyFeedText}>
                {feedFilter === 'all'
                  ? 'Start kollaborating to see updates here'
                  : 'Activity from your kollaborators will appear here'
                }
              </Text>
              <TouchableOpacity
                style={styles.emptyFeedButton}
                onPress={() => navigation.navigate('Search')}
              >
                <Text style={styles.emptyFeedButtonText}>Find Kollaborators</Text>
              </TouchableOpacity>
            </View>
          ) : (
            activityFeed.map((activity) => {
              // Check if this project's collaboration needs match user's skills
              const matchesSkills = hasSkillMatch(
                userProfile?.specialties,
                activity.projects?.collaboration_needs
              )

              return (
                <TouchableOpacity
                  key={activity.id}
                  style={[
                    styles.activityCard,
                    matchesSkills && styles.activityCardMatched
                  ]}
                  onPress={() => handleActivityPress(activity)}
                >
                  <View style={[
                    styles.activityIcon,
                    { backgroundColor: `${getActivityColor(activity)}20` }
                  ]}>
                    <Ionicons
                      name={getActivityIcon(activity) as any}
                      size={20}
                      color={getActivityColor(activity)}
                    />
                  </View>

                  <View style={styles.activityContent}>
                    <View style={styles.activityHeader}>
                      <Text style={styles.activityText} numberOfLines={2}>
                        {getActivityText(activity)}
                      </Text>
                      {matchesSkills && (
                        <View style={styles.skillsMatchBadgeSmall}>
                          <Ionicons name="checkmark-circle" size={12} color={Colors.success} />
                          <Text style={styles.skillsMatchTextSmall}>Match</Text>
                        </View>
                      )}
                    </View>

                    {(activity.project_data?.genre || activity.project_data?.bpm || activity.project_data?.key) && (
                      <View style={styles.genreBadge}>
                        <Text style={styles.genreText}>
                          {[
                            activity.project_data?.genre,
                            activity.project_data?.bpm ? `${activity.project_data.bpm} BPM` : null,
                            activity.project_data?.key
                          ].filter(Boolean).join(' • ')}
                        </Text>
                      </View>
                    )}

                    <View style={styles.activityMeta}>
                      <Ionicons name="time-outline" size={12} color={Colors.textTertiary} />
                      <Text style={styles.activityTime}>
                        {formatTimeAgo(activity.created_at)}
                      </Text>
                    </View>
                  </View>

                  <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
                </TouchableOpacity>
              )
            })
          )}

          <View style={styles.feedBottomSpacer} />
        </View>
      </ScrollView>
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
  scrollView: {
    flex: 1,
  },
  customHeader: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.lg,
    backgroundColor: '#000000',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
    minHeight: scale(88),
  },
  headerLeft: {
    position: 'absolute',
    left: Spacing.xl,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  headerCenter: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerRight: {
    position: 'absolute',
    right: Spacing.xl,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    width: scale(56),
    alignItems: 'flex-end',
  },
  logoImage: {
    width: scale(180),
    height: scale(48),
    marginBottom: 2,
  },
  kollabText: {
    fontSize: scale(13),
    fontWeight: '600',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  profileButton: {
    padding: Spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profilePhoto: {
    width: scale(40),
    height: scale(40),
    borderRadius: scale(20),
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  invitationsButton: {
    position: 'relative',
    padding: Spacing.xs,
  },
  invitationsBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: Colors.error,
    borderRadius: scale(10),
    minWidth: scale(20),
    height: scale(20),
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.surface,
  },
  invitationsBadgeText: {
    ...Typography.tiny,
    color: Colors.text,
    fontWeight: '700',
  },
  commandZone: {
    backgroundColor: Colors.surface,
    paddingBottom: Spacing.lg,
    borderBottomWidth: 2,
    borderBottomColor: Colors.border,
  },
  alertsBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    ...Shadows.glow(Colors.primary),
  },
  alertIcon: {
    width: scale(36),
    height: scale(36),
    borderRadius: scale(18),
    backgroundColor: `${Colors.text}20`,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  alertBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: Colors.error,
    borderRadius: scale(10),
    minWidth: scale(20),
    height: scale(20),
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  alertBadgeText: {
    ...Typography.tiny,
    color: Colors.text,
    fontWeight: '700',
  },
  alertContent: {
    flex: 1,
  },
  alertText: {
    ...Typography.body,
    color: Colors.text,
    fontWeight: '600',
  },
  welcomeSection: {
    padding: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  greeting: {
    ...Typography.hero,
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  continueSection: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    ...Typography.h3,
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  continueCards: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  continueCard: {
    flex: 1,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    // Subtle top highlight for depth
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
    ...Shadows.md,
  },
  continueCardTitle: {
    ...Typography.bodyLarge,
    fontWeight: '600',
    color: Colors.text,
    marginTop: Spacing.sm,
    marginBottom: Spacing.xxs,
  },
  continueCardTime: {
    ...Typography.caption,
    color: Colors.textSecondary,
  },
  quickActionsSection: {
    paddingHorizontal: Spacing.lg,
  },
  quickActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  quickAction: {
    flex: 1,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    alignItems: 'center',
    gap: Spacing.xs,
    ...Shadows.sm,
  },
  primaryAction: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
    ...Shadows.glow(Colors.primary),
  },
  quickActionText: {
    ...Typography.caption,
    color: Colors.text,
    fontWeight: '600',
  },
  feedZone: {
    backgroundColor: Colors.backgroundDark,
    paddingTop: Spacing.lg,
  },
  feedHeader: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  feedTitle: {
    ...Typography.h2,
    color: Colors.text,
    marginBottom: Spacing.xs,
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
  emptyFeed: {
    alignItems: 'center',
    paddingVertical: Spacing.xxxl,
    paddingHorizontal: Spacing.lg,
  },
  emptyFeedTitle: {
    ...Typography.h3,
    color: Colors.text,
    marginTop: Spacing.lg,
    marginBottom: Spacing.xs,
  },
  emptyFeedText: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  emptyFeedButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  emptyFeedButtonText: {
    ...Typography.bodyLarge,
    color: Colors.text,
    fontWeight: '600',
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
    ...Shadows.sm,
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
    width: scale(40),
    height: scale(40),
    borderRadius: scale(20),
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  activityContent: {
    flex: 1,
  },
  activityHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: Spacing.xs,
    gap: Spacing.xs,
  },
  activityText: {
    ...Typography.body,
    color: Colors.text,
    flex: 1,
  },
  activityUser: {
    fontWeight: '600',
    color: Colors.text,
  },
  activityProject: {
    fontWeight: '600',
    color: Colors.primary,
  },
  activityComment: {
    ...Typography.body,
    color: Colors.textSecondary,
    fontStyle: 'italic',
    marginBottom: Spacing.sm,
  },
  activityMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  activityTime: {
    ...Typography.caption,
    color: Colors.textTertiary,
  },
  activityDot: {
    ...Typography.caption,
    color: Colors.textTertiary,
  },
  activityTimestamp: {
    ...Typography.caption,
    color: Colors.textTertiary,
  },
  feedBottomSpacer: {
    height: Spacing.xxxl,
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
    fontSize: scale(10),
  },
  genreBadge: {
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xxs,
    borderRadius: BorderRadius.sm,
    alignSelf: 'flex-start',
    marginBottom: Spacing.xs,
  },
  genreText: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
})