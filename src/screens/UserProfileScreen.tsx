import React, { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useFocusEffect } from '@react-navigation/native'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { Colors, Typography, Spacing, BorderRadius } from '../constants/theme'
import CompactHeader from '../components/CompactHeader'
import HighlightPlayer from '../components/HighlightPlayer'
import SendMessageModal from '../components/SendMessageModal'
import { getUserUsageStats, SubscriptionTier } from '../utils/subscriptionLimits'

interface UserStats {
  projectsCreated: number
  collaborations: number
  totalTracks: number
}

interface UserProfile {
  id: string
  username: string
  display_name: string | null
  first_name: string | null
  last_name: string | null
  bio: string | null
  specialties: string[] | null
  open_to_kollab: boolean
  avatar_url: string | null
  show_highlights: boolean
  show_projects: boolean
  show_collaborators: boolean
  followers_count: number
}

interface Highlight {
  id: string
  file_url: string
  file_name: string
  duration: number
  bpm: number | null
  key: string | null
  created_at: string
}

interface Project {
  id: string
  title: string
  description: string | null
  genre: string | null
  bpm: number | null
  key: string | null
  updated_at: string
}

interface Collaborator {
  id: string
  user_id: string
  users: {
    username: string
    display_name: string | null
    avatar_url: string | null
  } | null
}

export default function UserProfileScreen({ navigation, route }: any) {
  const { userId } = route.params
  const { user: currentUser, refreshUserProfile } = useAuth()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [stats, setStats] = useState<UserStats>({
    projectsCreated: 0,
    collaborations: 0,
    totalTracks: 0,
  })
  const [highlights, setHighlights] = useState<Highlight[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [collaborators, setCollaborators] = useState<Collaborator[]>([])
  const [loading, setLoading] = useState(true)
  const [isBlocked, setIsBlocked] = useState(false)
  const [isConnected, setIsConnected] = useState(false)
  const [connectLoading, setConnectLoading] = useState(false)
  const [currentUserTier, setCurrentUserTier] = useState<SubscriptionTier>('free')
  const [messageModalVisible, setMessageModalVisible] = useState(false)

  useEffect(() => {
    if (userId) {
      loadUserProfile()
      loadUserStats()
      checkIfBlocked()
      checkIfConnected()
    }
    // Load current user's subscription tier
    if (currentUser?.id) {
      loadCurrentUserTier()
    }
  }, [userId, currentUser?.id])

  const loadCurrentUserTier = async () => {
    if (!currentUser?.id) return
    const stats = await getUserUsageStats(currentUser.id)
    if (stats) {
      setCurrentUserTier(stats.tier)
    }
  }

  useEffect(() => {
    // Don't load content if user is blocked
    if (profile && !isBlocked) {
      if (profile.show_highlights) loadHighlights()
      if (profile.show_projects) loadProjects()
      if (profile.show_collaborators) loadCollaborators()
    }
  }, [profile, isBlocked])

  // Reload connection status when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      if (userId) {
        checkIfConnected()
      }
    }, [userId])
  )

  // Real-time subscription for profile updates
  useEffect(() => {
    if (!userId) return

    const profileChannel = supabase
      .channel(`user-profile-view:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'users',
          filter: `id=eq.${userId}`,
        },
        (payload) => {
          console.log('User profile updated in real-time:', payload.new)
          setProfile(payload.new as UserProfile)
        }
      )
      .subscribe()

    return () => {
      profileChannel.unsubscribe()
    }
  }, [userId])

  const loadUserProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, username, display_name, first_name, last_name, bio, specialties, open_to_kollab, avatar_url, show_highlights, show_projects, show_collaborators, followers_count')
        .eq('id', userId)
        .single()

      if (error) throw error
      console.log('Loaded profile with followers_count:', data?.followers_count)
      setProfile(data)
    } catch (error) {
      console.error('Error loading user profile:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadHighlights = async () => {
    try {
      const { data, error } = await supabase
        .from('highlights')
        .select('id, file_url, file_name, duration, bpm, key, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(6)

      if (error) throw error
      setHighlights(data || [])
    } catch (error) {
      console.error('Error loading highlights:', error)
    }
  }

  const loadProjects = async () => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('id, title, description, genre, bpm, key, updated_at')
        .eq('creator_id', userId)
        .order('updated_at', { ascending: false })
        .limit(5)

      if (error) throw error
      setProjects(data || [])
    } catch (error) {
      console.error('Error loading projects:', error)
    }
  }

  const loadCollaborators = async () => {
    try {
      // First, get projects created by this user
      const { data: userProjects, error: projectsError } = await supabase
        .from('projects')
        .select('id')
        .eq('creator_id', userId)

      if (projectsError) throw projectsError

      if (!userProjects || userProjects.length === 0) {
        setCollaborators([])
        return
      }

      const projectIds = userProjects.map(p => p.id)

      // Get collaborator user_ids from those projects (excluding the profile owner)
      // Note: We don't use the users join because the foreign key relationship is misconfigured
      const { data: collabData, error: collabError } = await supabase
        .from('project_collaborators')
        .select('id, user_id')
        .in('project_id', projectIds)
        .neq('user_id', userId)
        .limit(8)

      if (collabError) throw collabError

      if (!collabData || collabData.length === 0) {
        setCollaborators([])
        return
      }

      // Get unique user IDs
      const uniqueUserIds = [...new Set(collabData.map(c => c.user_id))]

      // Fetch user details separately to avoid the broken join
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('id, username, display_name, avatar_url')
        .in('id', uniqueUserIds)

      if (usersError) throw usersError

      // Create a map of user_id to user data
      const userMap = new Map((usersData || []).map(u => [u.id, u]))

      // Combine collaborator records with correct user data
      const collaboratorsWithUsers = collabData.map(collab => ({
        id: collab.id,
        user_id: collab.user_id,
        users: userMap.get(collab.user_id) || null
      }))

      console.log('[Collaborators] Profile userId (owner to exclude):', userId)
      console.log('[Collaborators] Final data:', JSON.stringify(collaboratorsWithUsers, null, 2))

      setCollaborators(collaboratorsWithUsers)
    } catch (error) {
      console.error('Error loading collaborators:', error)
    }
  }

  const loadUserStats = async () => {
    try {
      // Projects created
      const { count: projectsCount } = await supabase
        .from('projects')
        .select('*', { count: 'exact', head: true })
        .eq('creator_id', userId)

      // Collaborations
      const { count: collabsCount } = await supabase
        .from('project_collaborators')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)

      // Total tracks uploaded
      const { count: tracksCount } = await supabase
        .from('audio_files')
        .select('*', { count: 'exact', head: true })
        .eq('created_by', userId)

      setStats({
        projectsCreated: projectsCount || 0,
        collaborations: collabsCount || 0,
        totalTracks: tracksCount || 0,
      })
    } catch (error) {
      console.error('Error loading user stats:', error)
    }
  }

  const checkIfBlocked = async () => {
    if (!currentUser?.id) return

    try {
      const { data, error } = await supabase
        .from('blocked_users')
        .select('id')
        .eq('blocker_id', currentUser.id)
        .eq('blocked_id', userId)
        .single()

      setIsBlocked(!!data)
    } catch (error) {
      // Not blocked
      setIsBlocked(false)
    }
  }

  const checkIfConnected = async () => {
    if (!currentUser?.id) return

    try {
      const { data, error } = await supabase
        .from('user_connections')
        .select('id')
        .eq('user_id', currentUser.id)
        .eq('following_id', userId)
        .single()

      setIsConnected(!!data)
    } catch (error) {
      // Not connected
      setIsConnected(false)
    }
  }

  const handleConnect = async () => {
    if (!currentUser?.id || connectLoading) return

    setConnectLoading(true)

    try {
      if (isConnected) {
        // Disconnect
        const { error } = await supabase
          .from('user_connections')
          .delete()
          .eq('user_id', currentUser.id)
          .eq('following_id', userId)

        if (error) throw error

        // Optimistically update UI
        setIsConnected(false)
        if (profile) {
          const newCount = Math.max(0, (profile.followers_count || 0) - 1)
          console.log('Disconnecting - Current count:', profile.followers_count, 'New count:', newCount)
          setProfile({
            ...profile,
            followers_count: newCount
          })
        }
      } else {
        // Connect
        const { data, error } = await supabase
          .from('user_connections')
          .insert({
            user_id: currentUser.id,
            following_id: userId,
          })
          .select()

        if (error) {
          console.error('Insert error:', error)
          throw error
        }

        console.log('Connection insert successful:', data)

        // Optimistically update UI
        setIsConnected(true)
        if (profile) {
          const newCount = (profile.followers_count || 0) + 1
          console.log('Connecting - Current count:', profile.followers_count, 'New count:', newCount)
          setProfile({
            ...profile,
            followers_count: newCount
          })
        }
      }

      // Refresh current user's profile to update their following_count
      await refreshUserProfile()

      // Get actual connection count from database and update the profile
      const { count } = await supabase
        .from('user_connections')
        .select('*', { count: 'exact', head: true })
        .eq('following_id', userId)

      console.log('Actual followers count from database:', count)

      // Update profile with real count
      if (profile && count !== null) {
        setProfile({
          ...profile,
          followers_count: count
        })
      }
    } catch (error: any) {
      console.error('Error connecting/disconnecting:', error)
      console.error('Error details:', JSON.stringify(error, null, 2))

      // Revert optimistic update on error
      setIsConnected(!isConnected)
      await loadUserProfile()

      // Show error to user
      alert(`Failed to ${isConnected ? 'disconnect from' : 'connect with'} user. Please make sure you've run the database migration.`)
    } finally {
      setConnectLoading(false)
    }
  }

  const handleBlockUser = async () => {
    if (!currentUser?.id) return

    try {
      if (isBlocked) {
        // Unblock
        const { error } = await supabase
          .from('blocked_users')
          .delete()
          .eq('blocker_id', currentUser.id)
          .eq('blocked_id', userId)

        if (error) throw error

        setIsBlocked(false)
        console.log('User unblocked successfully')
      } else {
        // Block - also disconnect if connected
        if (isConnected) {
          await supabase
            .from('user_connections')
            .delete()
            .eq('user_id', currentUser.id)
            .eq('following_id', userId)
          setIsConnected(false)
        }

        const { error } = await supabase
          .from('blocked_users')
          .insert({
            blocker_id: currentUser.id,
            blocked_id: userId,
          })

        if (error) throw error

        setIsBlocked(true)
        console.log('User blocked successfully')

        // Update followers count after disconnecting
        const { count } = await supabase
          .from('user_connections')
          .select('*', { count: 'exact', head: true })
          .eq('following_id', userId)

        if (profile && count !== null) {
          setProfile({
            ...profile,
            followers_count: count
          })
        }
      }
    } catch (error) {
      console.error('Error blocking/unblocking user:', error)
      alert('Failed to block/unblock user. Please try again.')
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <CompactHeader title="Profile" onBack={() => navigation.goBack()} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </SafeAreaView>
    )
  }

  if (!profile) {
    return (
      <SafeAreaView style={styles.container}>
        <CompactHeader title="Profile" onBack={() => navigation.goBack()} />
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={64} color={Colors.textSecondary} />
          <Text style={styles.errorText}>User not found</Text>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <CompactHeader
        title={profile.display_name || profile.username}
        subtitle={`@${profile.username}`}
        onBack={() => navigation.goBack()}
      />
      <ScrollView style={styles.content}>
        {/* Profile Header */}
        <View style={styles.headerSection}>
          <View style={styles.avatarContainer}>
            {profile.avatar_url ? (
              <Image
                source={{ uri: profile.avatar_url }}
                style={styles.avatar}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {(profile.display_name || profile.username).charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
          </View>

          {profile.bio && (
            <Text style={styles.bio}>{profile.bio}</Text>
          )}

          {profile.open_to_kollab && (
            <View style={styles.statusBadge}>
              <Ionicons name="musical-notes" size={16} color={Colors.success} />
              <Text style={styles.statusText}>Open to Kollab</Text>
            </View>
          )}

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[
                styles.connectButton,
                isConnected && styles.connectedButton
              ]}
              onPress={handleConnect}
              disabled={connectLoading}
            >
              {connectLoading ? (
                <ActivityIndicator color={isConnected ? Colors.primary : Colors.text} size="small" />
              ) : (
                <>
                  <Ionicons
                    name={isConnected ? "checkmark-circle" : "person-add"}
                    size={20}
                    color={isConnected ? Colors.primary : Colors.text}
                  />
                  <Text style={[
                    styles.connectButtonText,
                    isConnected && styles.connectedButtonText
                  ]}>
                    {isConnected ? 'Konnected' : '+ Konnect'}
                  </Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.messageButton}
              onPress={() => setMessageModalVisible(true)}
            >
              <Ionicons name="mail-outline" size={20} color={Colors.primary} />
              <Text style={styles.messageButtonText}>Message</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Show blocked message if user is blocked */}
        {isBlocked ? (
          <View style={styles.blockedMessageContainer}>
            <Ionicons name="ban" size={48} color={Colors.textSecondary} />
            <Text style={styles.blockedMessageTitle}>User Blocked</Text>
            <Text style={styles.blockedMessageText}>
              You have blocked this user. Unblock them to see their profile.
            </Text>
          </View>
        ) : (
          <>
            {/* Stats */}
            <View style={styles.statsSection}>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{stats.projectsCreated}</Text>
                <Text style={styles.statLabel} numberOfLines={1} adjustsFontSizeToFit>Projects</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{stats.collaborations}</Text>
                <Text style={styles.statLabel} numberOfLines={1} adjustsFontSizeToFit>Kollabs</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{stats.totalTracks}</Text>
                <Text style={styles.statLabel} numberOfLines={1} adjustsFontSizeToFit>Tracks</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{profile?.followers_count || 0}</Text>
                <Text style={styles.statLabel} numberOfLines={1} adjustsFontSizeToFit>Konnects</Text>
              </View>
            </View>

            {/* Specialties */}
            {profile.specialties && profile.specialties.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Specialties</Text>
            <View style={styles.specialtiesContainer}>
              {profile.specialties.map((specialty, index) => (
                <View key={index} style={styles.specialtyBadge}>
                  <Text style={styles.specialtyText}>{specialty}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Highlights */}
        {profile.show_highlights && highlights.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Highlights</Text>
            <View style={styles.highlightsList}>
              {highlights.map((highlight) => (
                <HighlightPlayer
                  key={highlight.id}
                  highlightId={highlight.id}
                  profileUserId={userId}
                  fileUrl={highlight.file_url}
                  fileName={highlight.file_name}
                  duration={highlight.duration || 30000}
                  bpm={highlight.bpm || undefined}
                  keySignature={highlight.key || undefined}
                  isOwner={false}
                  isPro={currentUserTier === 'pro'}
                  onUpgradePrompt={() => navigation.navigate('Subscription')}
                />
              ))}
            </View>
          </View>
        )}

        {/* Recent Projects */}
        {profile.show_projects && projects.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recent Projects</Text>
            {projects.map((project) => (
              <TouchableOpacity
                key={project.id}
                style={styles.projectCard}
                onPress={() => navigation.navigate('ProjectDetail', { projectId: project.id })}
              >
                <View style={styles.projectInfo}>
                  <Text style={styles.projectTitle} numberOfLines={1}>
                    {project.title}
                  </Text>
                  {project.description && (
                    <Text style={styles.projectDescription} numberOfLines={2}>
                      {project.description}
                    </Text>
                  )}
                  <View style={styles.projectMeta}>
                    {project.genre && (
                      <View style={styles.projectMetaBadge}>
                        <Text style={styles.projectMetaText}>{project.genre}</Text>
                      </View>
                    )}
                    {project.bpm && (
                      <Text style={styles.projectMetaText}>🎵 {project.bpm} BPM</Text>
                    )}
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Collaborators */}
        {profile.show_collaborators && collaborators.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Collaborators</Text>
            <View style={styles.collaboratorsGrid}>
              {collaborators.filter(collab => collab.users && collab.user_id !== userId).map((collab) => (
                <TouchableOpacity
                  key={collab.id}
                  style={styles.collaboratorCard}
                  onPress={() => navigation.navigate('UserProfile', { userId: collab.user_id })}
                >
                  {collab.users?.avatar_url ? (
                    <Image
                      source={{ uri: collab.users.avatar_url }}
                      style={styles.collaboratorAvatar}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={styles.collaboratorAvatar}>
                      <Text style={styles.collaboratorAvatarText}>
                        {(collab.users?.display_name || collab.users?.username || '?').charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <Text style={styles.collaboratorName} numberOfLines={1}>
                    {collab.users?.display_name || collab.users?.username || 'Unknown'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
          </>
        )}

        {/* Block/Unblock Button */}
        <View style={styles.blockSection}>
          <TouchableOpacity
            style={[styles.blockButton, isBlocked && styles.blockedButton]}
            onPress={handleBlockUser}
          >
            <Ionicons
              name={isBlocked ? "checkmark-circle" : "ban"}
              size={18}
              color={isBlocked ? Colors.success : Colors.error}
            />
            <Text style={[styles.blockButtonText, isBlocked && styles.blockedButtonText]}>
              {isBlocked ? 'Unblock User' : 'Block User'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Send Message Modal */}
      {currentUser?.id && profile && (
        <SendMessageModal
          visible={messageModalVisible}
          onClose={() => setMessageModalVisible(false)}
          recipientId={userId}
          recipientName={profile.display_name || profile.username}
          senderId={currentUser.id}
        />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    flex: 1,
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
    paddingHorizontal: Spacing.xl,
  },
  errorText: {
    ...Typography.h3,
    color: Colors.textSecondary,
    marginTop: Spacing.md,
  },
  headerSection: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.lg,
    backgroundColor: Colors.background,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: Spacing.lg,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  avatarText: {
    ...Typography.h1,
    color: Colors.text,
    fontSize: 48,
  },
  kollabBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: Colors.success,
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: Colors.background,
  },
  bio: {
    ...Typography.body,
    color: Colors.text,
    textAlign: 'center',
    marginBottom: Spacing.md,
    paddingHorizontal: Spacing.md,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: `${Colors.success}20`,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.success,
    marginBottom: Spacing.md,
  },
  statusText: {
    ...Typography.body,
    color: Colors.success,
    fontWeight: '600',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.md,
    width: '100%',
  },
  connectButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.primary,
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  connectedButton: {
    backgroundColor: Colors.surface,
    borderColor: Colors.primary,
  },
  connectButtonText: {
    ...Typography.body,
    color: Colors.text,
    fontWeight: '600',
  },
  connectedButtonText: {
    color: Colors.primary,
  },
  messageButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.surface,
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  messageButtonText: {
    ...Typography.body,
    color: Colors.primary,
    fontWeight: '600',
  },
  blockSection: {
    padding: Spacing.lg,
    alignItems: 'center',
    marginTop: Spacing.lg,
  },
  blockButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.lg,
    borderWidth: 2,
    borderColor: Colors.error,
    backgroundColor: `${Colors.error}10`,
  },
  blockedButton: {
    borderColor: Colors.success,
    backgroundColor: `${Colors.success}10`,
  },
  blockButtonText: {
    ...Typography.body,
    color: Colors.error,
    fontWeight: '600',
  },
  blockedButtonText: {
    color: Colors.success,
  },
  bottomSpacer: {
    height: 40,
  },
  statsSection: {
    flexDirection: 'row',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
    backgroundColor: Colors.background,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statValue: {
    ...Typography.h2,
    color: Colors.primary,
    marginBottom: Spacing.xxs,
  },
  statLabel: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontSize: 11,
    textAlign: 'center',
  },
  section: {
    padding: Spacing.lg,
    backgroundColor: Colors.background,
    marginTop: Spacing.md,
  },
  sectionTitle: {
    ...Typography.h3,
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  specialtiesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  specialtyBadge: {
    backgroundColor: `${Colors.primary}20`,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  specialtyText: {
    ...Typography.body,
    color: Colors.primary,
    fontWeight: '600',
  },
  horizontalScroll: {
    paddingLeft: Spacing.lg,
  },
  highlightsList: {
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  highlightCard: {
    width: 120,
    marginRight: Spacing.md,
  },
  highlightImage: {
    width: 120,
    height: 160,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surface,
  },
  highlightPlaceholder: {
    width: 120,
    height: 160,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  highlightTitle: {
    ...Typography.caption,
    color: Colors.text,
    marginTop: Spacing.xs,
  },
  projectCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  projectInfo: {
    flex: 1,
  },
  projectTitle: {
    ...Typography.body,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.xxs,
  },
  projectDescription: {
    ...Typography.caption,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  projectMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  projectMetaBadge: {
    backgroundColor: `${Colors.primary}20`,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  projectMetaText: {
    ...Typography.caption,
    color: Colors.textSecondary,
  },
  collaboratorsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  collaboratorCard: {
    alignItems: 'center',
    width: 70,
  },
  collaboratorAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.border,
    overflow: 'hidden',
    marginBottom: Spacing.xs,
  },
  collaboratorAvatarText: {
    ...Typography.body,
    color: Colors.text,
    fontWeight: '600',
    fontSize: 20,
  },
  collaboratorName: {
    ...Typography.caption,
    color: Colors.text,
    textAlign: 'center',
  },
  blockedMessageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
    marginTop: Spacing.xxl,
  },
  blockedMessageTitle: {
    ...Typography.h2,
    color: Colors.text,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  blockedMessageText: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
})
