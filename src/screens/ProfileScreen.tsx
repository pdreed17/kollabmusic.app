import React, { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,

  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useFocusEffect } from '@react-navigation/native'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { Colors, Typography, Spacing, BorderRadius } from '../constants/theme'
import HighlightPlayer from '../components/HighlightPlayer'
import { SUBSCRIPTION_LIMITS, getUserUsageStats, getUserStorageStats, formatStorage, SubscriptionTier } from '../utils/subscriptionLimits'

const SPECIALTY_ICONS: { [key: string]: string } = {
  vocals: 'mic',
  guitar: 'musical-note',
  bass: 'albums',
  piano: 'keypad',
  keys: 'keypad',
  drums: 'musical-notes',
  percussion: 'hand-right',
  strings: 'musical-note',
  brass: 'musical-note',
  woodwinds: 'musical-note',
  producing: 'options',
  mixing: 'options-outline',
  mastering: 'analytics',
  'sound-design': 'color-wand',
  'beat-making': 'pulse',
  lyrics: 'create',
  melody: 'musical-notes',
  composition: 'document-text',
  arrangement: 'git-branch',
  dj: 'disc',
  'live-performance': 'microphone',
  engineering: 'settings',
  other: 'ellipsis-horizontal',
}

const SPECIALTY_LABELS: { [key: string]: string } = {
  vocals: 'Vocals',
  guitar: 'Guitar',
  bass: 'Bass',
  piano: 'Piano',
  keys: 'Keys',
  drums: 'Drums',
  percussion: 'Percussion',
  strings: 'Strings',
  brass: 'Brass',
  woodwinds: 'Woodwinds',
  producing: 'Producing',
  mixing: 'Mixing',
  mastering: 'Mastering',
  'sound-design': 'Sound Design',
  'beat-making': 'Beat Making',
  lyrics: 'Lyrics',
  melody: 'Melody',
  composition: 'Composition',
  arrangement: 'Arrangement',
  dj: 'DJ',
  'live-performance': 'Live Performance',
  engineering: 'Engineering',
  other: 'Other',
}

interface UserStats {
  projectsCreated: number
  collaborations: number
  filesUploaded: number
  totalCollaborators: number
}

export default function ProfileScreen({ navigation }: any) {
  const { user, userProfile, signOut, refreshUserProfile } = useAuth()
  const [stats, setStats] = useState<UserStats>({
    projectsCreated: 0,
    collaborations: 0,
    filesUploaded: 0,
    totalCollaborators: 0,
  })
  const [recentProjects, setRecentProjects] = useState<any[]>([])
  const [highlights, setHighlights] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [subscriptionUsage, setSubscriptionUsage] = useState<{
    tier: SubscriptionTier
    ownedProjects: number
    activeCollabs: number
  } | null>(null)
  const [storageStats, setStorageStats] = useState<{
    storageUsed: number
    storageLimit: number
    storageUsedFormatted: string
    storageLimitFormatted: string
    percentageUsed: number
    isNearLimit: boolean
  } | null>(null)

  useEffect(() => {
    if (user) {
      loadUserData()
      loadHighlights()
      loadSubscriptionUsage()
    }
  }, [user])

  const loadSubscriptionUsage = async () => {
    if (!user) return
    try {
      const [usage, storage] = await Promise.all([
        getUserUsageStats(user.id),
        getUserStorageStats(user.id),
      ])
      if (usage) {
        setSubscriptionUsage({
          tier: usage.tier,
          ownedProjects: usage.usage.ownedProjects,
          activeCollabs: usage.usage.activeCollabs,
        })
      }
      if (storage) {
        setStorageStats({
          storageUsed: storage.storageUsed,
          storageLimit: storage.storageLimit,
          storageUsedFormatted: storage.storageUsedFormatted,
          storageLimitFormatted: storage.storageLimitFormatted,
          percentageUsed: storage.percentageUsed,
          isNearLimit: storage.isNearLimit,
        })
      }
    } catch (error) {
      console.error('Error loading subscription usage:', error)
    }
  }

  // Reload profile data when screen comes into focus (after editing profile or uploading highlight)
  useFocusEffect(
    useCallback(() => {
      if (user) {
        refreshUserProfile() // Refresh userProfile context (includes isOpenToKollab)
        loadUserData() // Refresh stats and projects
        loadSubscriptionUsage() // Refresh subscription usage
        loadHighlights() // Refresh highlights (for new uploads)
      }
    }, [user, refreshUserProfile])
  )

  const loadUserData = async () => {
    if (!user) return

    try {
      // First, get user's project IDs for the collaborators query
      const { data: userProjects } = await supabase
        .from('projects')
        .select('id')
        .eq('creator_id', user.id)
        .neq('status', 'deleted')

      const projectIds = userProjects?.map(p => p.id) || []

      // Load stats in parallel
      const [projectsCount, collabsCount, filesCount, collaboratorsData] = await Promise.all([
        supabase
          .from('projects')
          .select('*', { count: 'exact', head: true })
          .eq('creator_id', user.id)
          .neq('status', 'deleted'),

        supabase
          .from('project_collaborators')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('invitation_status', 'accepted')
          .neq('role', 'owner'),

        supabase
          .from('audio_files')
          .select('*', { count: 'exact', head: true })
          .eq('creator_id', user.id),

        projectIds.length > 0
          ? supabase
              .from('project_collaborators')
              .select('user_id')
              .in('project_id', projectIds)
              .eq('invitation_status', 'accepted')
          : { data: [] }
      ])

      const uniqueCollaborators = new Set(collaboratorsData.data?.map((c: any) => c.user_id) || [])

      setStats({
        projectsCreated: projectsCount.count || 0,
        collaborations: collabsCount.count || 0,
        filesUploaded: filesCount.count || 0,
        totalCollaborators: uniqueCollaborators.size,
      })

      // Load recent projects
      const { data: projects } = await supabase
        .from('projects')
        .select('*')
        .eq('creator_id', user.id)
        .neq('status', 'deleted')
        .order('updated_at', { ascending: false })
        .limit(3)

      setRecentProjects(projects || [])
    } catch (error) {
      console.error('Error loading user data:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadHighlights = async () => {
    if (!user) return

    try {
      const { data, error } = await supabase
        .from('highlights')
        .select('*')
        .eq('user_id', user.id)
        .order('order_index', { ascending: true })

      if (error) throw error
      setHighlights(data || [])
    } catch (error) {
      console.error('Error loading highlights:', error)
    }
  }

  const handleDeleteHighlight = async (highlightId: string) => {
    Alert.alert(
      'Delete Highlight',
      'Are you sure you want to delete this highlight?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              // Get the highlight to delete its file from storage
              const highlight = highlights.find(h => h.id === highlightId)
              if (highlight) {
                // Extract file path from URL
                const url = new URL(highlight.file_url)
                const pathParts = url.pathname.split('/')
                const filePath = pathParts.slice(pathParts.indexOf('highlights') + 1).join('/')

                // Delete from storage
                await supabase.storage
                  .from('highlights')
                  .remove([filePath])
              }

              // Delete from database
              const { error } = await supabase
                .from('highlights')
                .delete()
                .eq('id', highlightId)

              if (error) throw error

              // Reload highlights
              await loadHighlights()
            } catch (error) {
              console.error('Error deleting highlight:', error)
              Alert.alert('Error', 'Failed to delete highlight')
            }
          },
        },
      ]
    )
  }

  const handleMoveHighlight = async (currentIndex: number, direction: 'up' | 'down') => {
    if (direction === 'up' && currentIndex === 0) return
    if (direction === 'down' && currentIndex === highlights.length - 1) return

    try {
      const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
      const currentHighlight = highlights[currentIndex]
      const swapHighlight = highlights[newIndex]

      // Update order indices in database
      await Promise.all([
        supabase
          .from('highlights')
          .update({ order_index: newIndex })
          .eq('id', currentHighlight.id),
        supabase
          .from('highlights')
          .update({ order_index: currentIndex })
          .eq('id', swapHighlight.id),
      ])

      // Reload highlights
      await loadHighlights()
    } catch (error) {
      console.error('Error reordering highlights:', error)
      Alert.alert('Error', 'Failed to reorder highlights')
    }
  }

  const specialties = userProfile?.specialties || []
  const isOpenToKollab = userProfile?.open_to_kollab ?? true

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000)

    if (seconds < 60) return 'Just now'
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`
    return date.toLocaleDateString()
  }

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut()
            } catch (error) {
              console.error('Sign out error:', error)
              Alert.alert('Error', 'Failed to sign out. Please try again.')
            }
          },
        },
      ]
    )
  }

  return (
    <>
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          {userProfile?.avatar_url ? (
            <Image
              source={{ uri: userProfile.avatar_url }}
              style={styles.avatarImage}
            />
          ) : (
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {(userProfile?.display_name || userProfile?.username || 'U').charAt(0).toUpperCase()}
              </Text>
            </View>
          )}

          <Text style={styles.displayName}>
            {userProfile?.display_name || userProfile?.username || 'User'}
          </Text>

          {userProfile?.username && (
            <Text style={styles.username}>@{userProfile.username}</Text>
          )}

          <Text style={styles.email}>{user?.email}</Text>

          {/* Open to Kollab Badge */}
          <View style={[styles.kollabBadge, isOpenToKollab ? styles.kollabBadgeActive : styles.kollabBadgeInactive]}>
            <Ionicons
              name={isOpenToKollab ? "musical-notes" : "musical-notes-outline"}
              size={16}
              color={isOpenToKollab ? Colors.success : Colors.textSecondary}
            />
            <Text style={[styles.kollabBadgeText, isOpenToKollab && styles.kollabBadgeTextActive]}>
              {isOpenToKollab ? 'Open to Kollab' : 'Not Available'}
            </Text>
          </View>

          {/* Edit Profile Button */}
          <TouchableOpacity
            style={styles.editButton}
            onPress={() => navigation.navigate('EditProfile')}
            activeOpacity={0.8}
          >
            <Ionicons name="create-outline" size={16} color={Colors.text} />
            <Text style={styles.editButtonText}>Edit Profile</Text>
          </TouchableOpacity>
        </View>

        {/* Stats Cards */}
        <View style={styles.statsSection}>
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Ionicons name="musical-notes" size={24} color={Colors.primary} />
              <Text style={styles.statNumber}>{stats.projectsCreated}</Text>
              <Text style={styles.statLabel} numberOfLines={2}>My Projects</Text>
            </View>
            <View style={styles.statCard}>
              <Ionicons name="git-network" size={24} color={Colors.primary} />
              <Text style={styles.statNumber}>{stats.collaborations}</Text>
              <Text style={styles.statLabel} numberOfLines={2}>Kollabs</Text>
            </View>
            <View style={styles.statCard}>
              <Ionicons name="cloud-upload" size={24} color={Colors.primary} />
              <Text style={styles.statNumber}>{stats.filesUploaded}</Text>
              <Text style={styles.statLabel} numberOfLines={2}>Files</Text>
            </View>
            <View style={styles.statCard}>
              <Ionicons name="people" size={24} color={Colors.primary} />
              <Text style={styles.statNumber}>{userProfile?.followers_count || 0}</Text>
              <Text style={styles.statLabel} numberOfLines={2}>Konnects</Text>
            </View>
          </View>
        </View>

        {/* Subscription Usage Card */}
        {subscriptionUsage && (
          <View style={styles.subscriptionCard}>
            <View style={styles.subscriptionHeader}>
              <View style={styles.subscriptionTierBadge}>
                <Ionicons
                  name={subscriptionUsage.tier === 'pro' ? 'star' : 'person'}
                  size={16}
                  color={subscriptionUsage.tier === 'pro' ? Colors.warning : Colors.textSecondary}
                />
                <Text style={[
                  styles.subscriptionTierText,
                  subscriptionUsage.tier === 'pro' && styles.subscriptionTierTextPro
                ]}>
                  {subscriptionUsage.tier === 'pro' ? 'Pro' : 'Free'} Plan
                </Text>
              </View>
              {subscriptionUsage.tier === 'free' && (
                <TouchableOpacity
                  style={styles.upgradeButton}
                  onPress={() => navigation.navigate('Subscription')}
                >
                  <Text style={styles.upgradeButtonText}>Upgrade</Text>
                </TouchableOpacity>
              )}
            </View>

            {subscriptionUsage.tier === 'free' ? (
              <View style={styles.usageBars}>
                {/* Owned Projects */}
                <View style={styles.usageRow}>
                  <View style={styles.usageInfo}>
                    <Text style={styles.usageLabel}>Owned Projects</Text>
                    <Text style={styles.usageCount}>
                      {subscriptionUsage.ownedProjects} / {SUBSCRIPTION_LIMITS.free.ownedProjectsLimit}
                    </Text>
                  </View>
                  <View style={styles.usageBarContainer}>
                    <View
                      style={[
                        styles.usageBarFill,
                        {
                          width: `${Math.min(100, (subscriptionUsage.ownedProjects / SUBSCRIPTION_LIMITS.free.ownedProjectsLimit) * 100)}%`,
                          backgroundColor: subscriptionUsage.ownedProjects >= SUBSCRIPTION_LIMITS.free.ownedProjectsLimit
                            ? Colors.error
                            : Colors.primary
                        }
                      ]}
                    />
                  </View>
                </View>

                {/* Active Collaborations */}
                <View style={styles.usageRow}>
                  <View style={styles.usageInfo}>
                    <Text style={styles.usageLabel}>Kollab Projects</Text>
                    <Text style={styles.usageCount}>
                      {subscriptionUsage.activeCollabs} / {SUBSCRIPTION_LIMITS.free.activeCollabsLimit}
                    </Text>
                  </View>
                  <View style={styles.usageBarContainer}>
                    <View
                      style={[
                        styles.usageBarFill,
                        {
                          width: `${Math.min(100, (subscriptionUsage.activeCollabs / SUBSCRIPTION_LIMITS.free.activeCollabsLimit) * 100)}%`,
                          backgroundColor: subscriptionUsage.activeCollabs >= SUBSCRIPTION_LIMITS.free.activeCollabsLimit
                            ? Colors.error
                            : Colors.primary
                        }
                      ]}
                    />
                  </View>
                </View>

                {/* Track Limit Info */}
                <View style={styles.trackLimitInfo}>
                  <Ionicons name="information-circle-outline" size={16} color={Colors.textSecondary} />
                  <Text style={styles.trackLimitText}>
                    {SUBSCRIPTION_LIMITS.free.tracksPerProjectLimit} tracks per project
                  </Text>
                </View>

                {/* Storage Usage */}
                {storageStats && (
                  <View style={styles.usageRow}>
                    <View style={styles.usageInfo}>
                      <Text style={styles.usageLabel}>Storage</Text>
                      <Text style={[styles.usageCount, storageStats.isNearLimit && styles.usageCountWarning]}>
                        {storageStats.storageUsedFormatted} / {storageStats.storageLimitFormatted}
                      </Text>
                    </View>
                    <View style={styles.usageBarContainer}>
                      <View
                        style={[
                          styles.usageBarFill,
                          {
                            width: `${Math.min(100, storageStats.percentageUsed)}%`,
                            backgroundColor: storageStats.isNearLimit
                              ? Colors.warning
                              : storageStats.percentageUsed >= 100
                                ? Colors.error
                                : Colors.primary
                          }
                        ]}
                      />
                    </View>
                  </View>
                )}
              </View>
            ) : (
              <View style={styles.proFeatures}>
                <View style={styles.proFeatureRow}>
                  <Ionicons name="checkmark-circle" size={18} color={Colors.success} />
                  <Text style={styles.proFeatureText}>Unlimited projects</Text>
                </View>
                <View style={styles.proFeatureRow}>
                  <Ionicons name="checkmark-circle" size={18} color={Colors.success} />
                  <Text style={styles.proFeatureText}>Unlimited tracks</Text>
                </View>
                {/* Storage Usage for Pro */}
                {storageStats && (
                  <View style={[styles.usageRow, { marginTop: Spacing.sm }]}>
                    <View style={styles.usageInfo}>
                      <Text style={styles.usageLabel}>Storage ({storageStats.storageLimitFormatted})</Text>
                      <Text style={styles.usageCount}>
                        {storageStats.storageUsedFormatted} used
                      </Text>
                    </View>
                    <View style={styles.usageBarContainer}>
                      <View
                        style={[
                          styles.usageBarFill,
                          {
                            width: `${Math.min(100, storageStats.percentageUsed)}%`,
                            backgroundColor: storageStats.isNearLimit
                              ? Colors.warning
                              : Colors.success
                          }
                        ]}
                      />
                    </View>
                  </View>
                )}
              </View>
            )}
          </View>
        )}

        {/* Bio */}
        {userProfile?.bio ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>About</Text>
            <Text style={styles.bioText}>{userProfile.bio}</Text>
          </View>
        ) : (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>About</Text>
            <Text style={styles.emptyText}>No bio yet. Tap "Edit Profile" to add one.</Text>
          </View>
        )}

        {/* Specialties */}
        {specialties.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Specialties</Text>
            <View style={styles.specialtiesGrid}>
              {specialties.map((specialty: string) => (
                <View key={specialty} style={styles.specialtyBadge}>
                  <Ionicons
                    name={SPECIALTY_ICONS[specialty] as any || 'musical-note'}
                    size={16}
                    color={Colors.primary}
                  />
                  <Text style={styles.specialtyText}>
                    {SPECIALTY_LABELS[specialty] || specialty}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ) : (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Specialties</Text>
            <Text style={styles.emptyText}>
              No specialties added yet. Add your skills in "Edit Profile".
            </Text>
          </View>
        )}

        {/* Highlights */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Highlights</Text>
            {highlights.length < 5 && (
              <TouchableOpacity onPress={() => navigation.navigate('HighlightUpload')}>
                <Ionicons name="add-circle" size={24} color={Colors.primary} />
              </TouchableOpacity>
            )}
          </View>

          {highlights.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>
                No highlights yet. Showcase your best work!
              </Text>
              <TouchableOpacity
                style={styles.addHighlightButton}
                onPress={() => navigation.navigate('HighlightUpload')}
              >
                <Ionicons name="add-circle-outline" size={20} color={Colors.primary} />
                <Text style={styles.addHighlightText}>Add Highlight</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.highlightsList}>
              {highlights.map((highlight) => (
                <HighlightPlayer
                  key={highlight.id}
                  highlightId={highlight.id}
                  profileUserId={user?.id || ''}
                  fileUrl={highlight.file_url}
                  fileName={highlight.file_name}
                  duration={highlight.duration}
                  bpm={highlight.bpm}
                  keySignature={highlight.key}
                  isOwner={true}
                  isPro={subscriptionUsage?.tier === 'pro'}
                  onDelete={() => handleDeleteHighlight(highlight.id)}
                />
              ))}
            </View>
          )}
        </View>

        {/* Recent Projects */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>My Recent Projects</Text>
            {recentProjects.length > 0 && (
              <TouchableOpacity onPress={() => navigation.push('MainTabs', { screen: 'Projects' })}>
                <Text style={styles.seeAllText}>See All</Text>
              </TouchableOpacity>
            )}
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={Colors.primary} />
            </View>
          ) : recentProjects.length > 0 ? (
            <View style={styles.projectsList}>
              {recentProjects.map((project) => (
                <TouchableOpacity
                  key={project.id}
                  style={styles.projectCard}
                  onPress={() => navigation.navigate('ProjectDetail', { projectId: project.id })}
                  activeOpacity={0.7}
                >
                  <View style={styles.projectIconContainer}>
                    <Ionicons name="musical-notes" size={24} color={Colors.primary} />
                  </View>
                  <View style={styles.projectInfo}>
                    <Text style={styles.projectTitle} numberOfLines={1}>
                      {project.title}
                    </Text>
                    <View style={styles.projectMeta}>
                      <Text style={styles.projectMetaText} numberOfLines={1}>
                        {project.bpm} BPM • {project.key || 'No Key'}
                      </Text>
                      <Text style={styles.projectMetaText}>•</Text>
                      <Text style={styles.projectMetaText} numberOfLines={1}>
                        {formatTimeAgo(project.updated_at)}
                      </Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <View style={styles.emptyStateCard}>
              <Ionicons name="musical-notes-outline" size={48} color={Colors.textSecondary} />
              <Text style={styles.emptyStateTitle}>No Projects Yet</Text>
              <Text style={styles.emptyStateText}>
                Create your first project to start kollaborating
              </Text>
              <TouchableOpacity
                style={styles.createProjectButton}
                onPress={() => navigation.navigate('CreateProject')}
                activeOpacity={0.8}
              >
                <Ionicons name="add-circle" size={20} color={Colors.text} />
                <Text style={styles.createProjectButtonText}>Create Project</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.quickActions}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => navigation.push('MainTabs', { screen: 'Projects' })}
              activeOpacity={0.7}
            >
              <Ionicons name="folder-outline" size={24} color={Colors.primary} />
              <Text style={styles.actionButtonText}>My Projects</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => navigation.push('MainTabs', { screen: 'Activity' })}
              activeOpacity={0.7}
            >
              <Ionicons name="time-outline" size={24} color={Colors.primary} />
              <Text style={styles.actionButtonText}>Activity</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => navigation.navigate('PendingInvitations')}
              activeOpacity={0.7}
            >
              <Ionicons name="mail-outline" size={24} color={Colors.primary} />
              <Text style={styles.actionButtonText}>Invitations</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => navigation.navigate('BlockedUsers')}
              activeOpacity={0.7}
            >
              <Ionicons name="ban-outline" size={24} color={Colors.primary} />
              <Text style={styles.actionButtonText}>Blocked Users</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => navigation.navigate('Settings')}
              activeOpacity={0.7}
            >
              <Ionicons name="settings-outline" size={24} color={Colors.primary} />
              <Text style={styles.actionButtonText}>Settings</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Sign Out Button */}
        <View style={styles.signOutSection}>
          <TouchableOpacity
            style={styles.signOutButton}
            onPress={handleSignOut}
            activeOpacity={0.8}
          >
            <Ionicons name="log-out-outline" size={24} color={Colors.error} />
            <Text style={styles.signOutButtonText}>Sign Out</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>
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
  profileHeader: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.lg,
    backgroundColor: Colors.background,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
    borderWidth: 3,
    borderColor: Colors.border,
  },
  avatarImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: Spacing.md,
    borderWidth: 3,
    borderColor: Colors.border,
  },
  avatarText: {
    fontSize: 40,
    color: Colors.text,
    fontWeight: '700',
  },
  displayName: {
    ...Typography.h1,
    color: Colors.text,
    marginBottom: Spacing.xxs,
    fontWeight: '700',
  },
  username: {
    ...Typography.bodyLarge,
    color: Colors.textSecondary,
    marginBottom: Spacing.xxs,
  },
  email: {
    ...Typography.body,
    color: Colors.textSecondary,
    marginBottom: Spacing.md,
  },
  kollabBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    marginBottom: Spacing.md,
    borderWidth: 2,
  },
  kollabBadgeActive: {
    backgroundColor: `${Colors.success}15`,
    borderColor: Colors.success,
  },
  kollabBadgeInactive: {
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
  },
  kollabBadgeText: {
    ...Typography.body,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  kollabBadgeTextActive: {
    color: Colors.success,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  editButtonText: {
    ...Typography.bodyLarge,
    color: Colors.text,
    fontWeight: '600',
  },
  statsSection: {
    padding: Spacing.md,
    backgroundColor: Colors.backgroundDark,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    alignItems: 'center',
  },
  statNumber: {
    ...Typography.h2,
    color: Colors.text,
    fontWeight: '700',
    marginTop: Spacing.xs,
  },
  statLabel: {
    ...Typography.caption,
    color: Colors.textSecondary,
    marginTop: Spacing.xxs,
    textAlign: 'center',
    fontSize: 10,
  },
  section: {
    padding: Spacing.md,
    backgroundColor: Colors.surface,
    marginTop: Spacing.sm,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: Colors.border,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    ...Typography.h3,
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  seeAllText: {
    ...Typography.body,
    color: Colors.primary,
    fontWeight: '600',
  },
  bioText: {
    ...Typography.bodyLarge,
    color: Colors.text,
    lineHeight: 24,
  },
  emptyText: {
    ...Typography.body,
    color: Colors.textSecondary,
    fontStyle: 'italic',
  },
  specialtiesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  specialtyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: `${Colors.primary}15`,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  specialtyText: {
    ...Typography.body,
    color: Colors.text,
    fontWeight: '600',
  },
  loadingContainer: {
    paddingVertical: Spacing.xl,
    alignItems: 'center',
  },
  projectsList: {
    gap: Spacing.sm,
  },
  projectCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceElevated,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.md,
  },
  projectIconContainer: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.md,
    backgroundColor: `${Colors.primary}20`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  projectInfo: {
    flex: 1,
  },
  projectTitle: {
    ...Typography.bodyLarge,
    color: Colors.text,
    fontWeight: '600',
    marginBottom: Spacing.xxs,
  },
  projectMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  projectMetaText: {
    ...Typography.caption,
    color: Colors.textSecondary,
    flexShrink: 1,
  },
  emptyStateCard: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
  },
  emptyStateTitle: {
    ...Typography.h3,
    color: Colors.text,
    marginTop: Spacing.md,
    marginBottom: Spacing.xs,
  },
  emptyStateText: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  createProjectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  createProjectButtonText: {
    ...Typography.bodyLarge,
    color: Colors.text,
    fontWeight: '600',
  },
  quickActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  actionButton: {
    width: '48%',
    backgroundColor: Colors.surfaceElevated,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    gap: Spacing.xs,
  },
  actionButtonText: {
    ...Typography.body,
    color: Colors.text,
    fontWeight: '600',
  },
  bottomSpacer: {
    height: Spacing.xxxl,
  },

  // Highlights Section
  highlightsList: {
    gap: Spacing.md,
  },
  addHighlightButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.sm,
  },
  addHighlightText: {
    ...Typography.bodyLarge,
    color: Colors.primary,
    fontWeight: '600',
  },
  signOutSection: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.backgroundDark,
    marginTop: Spacing.md,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.surface,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.lg,
    borderWidth: 2,
    borderColor: 'rgba(220, 53, 69, 0.4)',
    marginHorizontal: 86, // 70px nav pill + 16px gap
  },
  signOutButtonText: {
    ...Typography.h3,
    color: Colors.error,
    fontWeight: '700',
  },

  // Subscription Usage Card Styles
  subscriptionCard: {
    margin: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  subscriptionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  subscriptionTierBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  subscriptionTierText: {
    ...Typography.bodyLarge,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  subscriptionTierTextPro: {
    color: Colors.warning,
  },
  upgradeButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  upgradeButtonText: {
    ...Typography.body,
    color: Colors.text,
    fontWeight: '600',
  },
  usageBars: {
    gap: Spacing.md,
  },
  usageRow: {
    gap: Spacing.xs,
  },
  usageInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  usageLabel: {
    ...Typography.body,
    color: Colors.text,
  },
  usageCount: {
    ...Typography.body,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  usageCountWarning: {
    color: Colors.warning,
  },
  usageBarContainer: {
    height: 6,
    backgroundColor: Colors.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  usageBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  trackLimitInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  trackLimitText: {
    ...Typography.caption,
    color: Colors.textSecondary,
  },
  proFeatures: {
    gap: Spacing.sm,
  },
  proFeatureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  proFeatureText: {
    ...Typography.body,
    color: Colors.text,
  },
})
