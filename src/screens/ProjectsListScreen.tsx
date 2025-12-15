import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Animated,
  Alert,
  TextInput,
  ScrollView,
} from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import Swipeable from 'react-native-gesture-handler/Swipeable'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { Colors, Typography, Spacing, BorderRadius } from '../constants/theme'
import ProjectIcon from '../components/ProjectIcon'
import { getAllBlockedUserIds } from '../utils/blockingHelpers'
import { scale } from '../utils/responsive'

export default function ProjectsListScreen({ navigation }: any) {
  const { user, userProfile } = useAuth()
  const [projects, setProjects] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [blockedUserIds, setBlockedUserIds] = useState<string[]>([])
  
  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('')
  const [activeFilter, setActiveFilter] = useState<'all' | 'mine' | 'collaborating'>('all')

  useEffect(() => {
    loadBlockedUsers()
  }, [user?.id])

  useEffect(() => {
    if (blockedUserIds.length >= 0) {
      loadProjects()
    }
  }, [blockedUserIds])

  // Reload projects when screen comes into focus (e.g., after editing a project)
  useFocusEffect(
    useCallback(() => {
      if (user?.id && blockedUserIds.length >= 0) {
        loadProjects()
      }
    }, [user?.id, blockedUserIds])
  )

  const loadBlockedUsers = async () => {
    if (!user?.id) return
    const blocked = await getAllBlockedUserIds(user.id)
    setBlockedUserIds(blocked)
  }

  const loadProjects = async () => {
    try {
      if (!user?.id) {
        console.log('No user ID found')
        return
      }

      // DIAGNOSTIC: Log user ID
      console.log('===== PROJECT LOADING DIAGNOSTICS =====')
      console.log('User ID from context:', user.id)
      console.log('User email:', user.email)

      // Get user's own projects
      const { data: myProjects, error: myError } = await supabase
        .from('projects')
        .select('*')
        .eq('creator_id', user.id)
        .order('updated_at', { ascending: false })

      // DIAGNOSTIC: Log query results
      console.log('My projects query result:', {
        count: myProjects?.length || 0,
        error: myError?.message || null,
        projects: myProjects?.map(p => ({
          id: p.id,
          title: p.title,
          creator_id: p.creator_id
        })) || []
      })

      if (myError) {
        console.error('Error loading my projects:', myError)
        throw myError
      }

      // Get projects where user is a collaborator
      const { data: collaborations, error: collabError } = await supabase
        .from('project_collaborators')
        .select('project_id')
        .eq('user_id', user.id)
        .eq('invitation_status', 'accepted')
        .neq('role', 'owner')

      // DIAGNOSTIC: Log collaborator query results
      console.log('Collaborations query result:', {
        count: collaborations?.length || 0,
        error: collabError?.message || null,
        projectIds: collaborations?.map(c => c.project_id) || []
      })

      let joinedProjects: any[] = []
      if (!collabError && collaborations && collaborations.length > 0) {
        const projectIds = collaborations.map(c => c.project_id)

        // Filter out blocked users
        let query = supabase
          .from('projects')
          .select('*')
          .in('id', projectIds)
          .order('updated_at', { ascending: false })

        if (blockedUserIds.length > 0) {
          query = query.not('creator_id', 'in', `(${blockedUserIds.join(',')})`)
        }

        const { data: joinedProjectsData, error: joinedError } = await query

        if (joinedError) {
          console.error('Error loading joined projects:', joinedError)
        } else {
          joinedProjects = joinedProjectsData || []
        }
      }

      // Combine and sort all projects by updated_at
      const allProjects = [...(myProjects || []), ...joinedProjects]
      allProjects.sort((a, b) => {
        const timeA = a.updated_at ? new Date(a.updated_at).getTime() : 0
        const timeB = b.updated_at ? new Date(b.updated_at).getTime() : 0
        return timeB - timeA
      })

      // DIAGNOSTIC: Log final results
      console.log('FINAL: Total projects loaded:', allProjects.length)
      console.log('FINAL: Projects summary:', allProjects.map(p => ({
        id: p.id.substring(0, 8),
        title: p.title,
        creator_id: p.creator_id?.substring(0, 8) || 'null'
      })))
      console.log('======================================')

      setProjects(allProjects)
    } catch (error: any) {
      console.error('Error loading projects:', error)
      Alert.alert('Error', 'Failed to load projects')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const onRefresh = () => {
    setRefreshing(true)
    loadBlockedUsers()
  }

  // Filter projects (memoized for performance)
  const filteredProjects = useMemo(() => {
    return projects.filter(p => {
      // Search filter
      const matchesSearch = searchQuery.length === 0 ||
        p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.genre?.toLowerCase().includes(searchQuery.toLowerCase())

      // Ownership filter
      const isMyProject = p.creator_id === user?.id
      const matchesOwnership =
        activeFilter === 'all' ||
        (activeFilter === 'mine' && isMyProject) ||
        (activeFilter === 'collaborating' && !isMyProject)

      // Exclude deleted/archived from main view
      const isActive = p.status !== 'deleted' && p.status !== 'archived'

      return matchesSearch && matchesOwnership && isActive
    })
  }, [projects, searchQuery, activeFilter, user?.id])

  const { myProjectsCount, collaboratingCount, totalActive } = useMemo(() => {
    const myCount = projects.filter(p => p.creator_id === user?.id && p.status !== 'deleted').length
    const collabCount = projects.filter(p => p.creator_id !== user?.id && p.status !== 'deleted').length
    return {
      myProjectsCount: myCount,
      collaboratingCount: collabCount,
      totalActive: myCount + collabCount
    }
  }, [projects, user?.id])

  const renderRightActions = useCallback((progress: Animated.AnimatedInterpolation<number>, dragX: Animated.AnimatedInterpolation<number>, projectId: string) => {
    const trans = dragX.interpolate({
      inputRange: [-80, 0],
      outputRange: [0, 80],
      extrapolate: 'clamp',
    })

    return (
      <Animated.View style={[styles.swipeActions, { transform: [{ translateX: trans }] }]}>
        <TouchableOpacity
          style={styles.swipeEditButton}
          onPress={() => navigation.navigate('EditProject', { projectId })}
        >
          <Ionicons name="create-outline" size={24} color={Colors.text} />
          <Text style={styles.swipeActionText}>Edit</Text>
        </TouchableOpacity>
      </Animated.View>
    )
  }, [navigation])

  const renderProject = useCallback(({ item }: any) => {
    const isMyProject = item.creator_id === user?.id
    const isArchived = item.status === 'archived'
    const isCompleted = item.status === 'completed'

    const projectCard = (
      <TouchableOpacity
        style={[
          styles.projectCard,
          isArchived && styles.projectCardArchived
        ]}
        onPress={() => navigation.navigate('ProjectDetail', {
          projectId: item.id
        })}
      >
        <ProjectIcon size="medium" genre={item.genre} />

        <View style={styles.projectContent}>
          <View style={styles.projectHeader}>
            <Text style={styles.projectTitle} numberOfLines={1}>
              {item.title}
            </Text>
            {isArchived && (
              <View style={styles.archivedBadge}>
                <Ionicons name="archive" size={12} color={Colors.warning} />
                <Text style={styles.archivedText}>Archived</Text>
              </View>
            )}
            {isCompleted && (
              <View style={styles.completedBadge}>
                <Ionicons name="checkmark-circle" size={12} color={Colors.success} />
                <Text style={styles.completedText}>Done</Text>
              </View>
            )}
            {item.genre && !isArchived && !isCompleted && (
              <View style={styles.genreBadge}>
                <Text style={styles.genreText}>{item.genre}</Text>
              </View>
            )}
          </View>



          {/* Meta Info */}
          <View style={styles.projectMeta}>
            {!isMyProject && (
              <View style={styles.collaboratorBadge}>
                <Ionicons name="people-outline" size={12} color={Colors.primary} />
                <Text style={styles.collaboratorText}>Kollabs</Text>
              </View>
            )}
            {item.bpm && (
              <Text style={styles.metaText}>🎵 {item.bpm} BPM</Text>
            )}
            {item.key && (
              <Text style={styles.metaText}>🎹 {item.key}</Text>
            )}
            <Text style={styles.metaText}>
              {new Date(item.updated_at).toLocaleDateString()}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    )

    // Only wrap in Swipeable if it's the user's project
    if (isMyProject) {
      return (
        <View style={styles.projectCardWrapper}>
          <Swipeable
            renderRightActions={(progress, dragX) => renderRightActions(progress, dragX, item.id)}
            overshootRight={false}
            friction={2}
          >
            {projectCard}
          </Swipeable>
        </View>
      )
    }

    return (
      <View style={styles.projectCardWrapper}>
        {projectCard}
      </View>
    )
  }, [navigation, user?.id, renderRightActions])

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    )
  }

  return (
    <>
      {/* Search Section */}
      <View style={styles.searchSection}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color={Colors.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search projects..."
            placeholderTextColor={Colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color={Colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Filter Pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filters}
        >
          <TouchableOpacity
            style={[styles.filterButton, activeFilter === 'all' && styles.filterButtonActive]}
            onPress={() => setActiveFilter('all')}
            activeOpacity={0.7}
          >
            <Text style={[styles.filterText, activeFilter === 'all' && styles.filterTextActive]}>
              All
            </Text>
            <Text style={[styles.filterCount, activeFilter === 'all' && styles.filterCountActive]}>
              {totalActive}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterButton, activeFilter === 'mine' && styles.filterButtonActive]}
            onPress={() => setActiveFilter('mine')}
            activeOpacity={0.7}
          >
            <Text style={[styles.filterText, activeFilter === 'mine' && styles.filterTextActive]}>
              My Projects
            </Text>
            <Text style={[styles.filterCount, activeFilter === 'mine' && styles.filterCountActive]}>
              {myProjectsCount}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterButton, activeFilter === 'collaborating' && styles.filterButtonActive]}
            onPress={() => setActiveFilter('collaborating')}
            activeOpacity={0.7}
          >
            <Text style={[styles.filterText, activeFilter === 'collaborating' && styles.filterTextActive]}>
              Kollabs
            </Text>
            <Text style={[styles.filterCount, activeFilter === 'collaborating' && styles.filterCountActive]}>
              {collaboratingCount}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>


      <FlatList
        data={filteredProjects}
        renderItem={renderProject}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
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
        initialNumToRender={10}
        ListFooterComponent={
          filteredProjects.length > 0 ? (
            <TouchableOpacity
              style={styles.addProjectButton}
              onPress={() => navigation.navigate('CreateProject')}
            >
              <Ionicons name="add-circle-outline" size={24} color={Colors.primary} />
              <Text style={styles.addProjectButtonText}>Create New Project</Text>
            </TouchableOpacity>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIcon}>
              <ProjectIcon size="large" />
            </View>
            
            <Text style={styles.emptyTitle}>
              {searchQuery.length > 0
                ? 'No Projects Found'
                : activeFilter === 'mine'
                ? 'No Projects Yet'
                : activeFilter === 'collaborating'
                ? 'No Kollabs Yet'
                : 'No Projects Yet'
              }
            </Text>

            <Text style={styles.emptyText}>
              {searchQuery.length > 0
                ? `No projects match "${searchQuery}"`
                : activeFilter === 'mine'
                ? 'Create your first project to start kollaborating'
                : activeFilter === 'collaborating'
                ? 'Join a project to start kollaborating with others'
                : 'Create a project or join kollabs'
              }
            </Text>

            {searchQuery.length === 0 && activeFilter !== 'collaborating' && (
              <TouchableOpacity
                style={styles.createButton}
                onPress={() => navigation.navigate('CreateProject')}
              >
                <Text style={styles.createButtonText}>+ Create Project</Text>
              </TouchableOpacity>
            )}

            {activeFilter === 'collaborating' && (
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => navigation.navigate('Search')}
              >
                <Text style={styles.secondaryButtonText}>Find Projects</Text>
              </TouchableOpacity>
            )}
          </View>
        }
      />
    </>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.backgroundDark,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchSection: {
    padding: Spacing.lg,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.md,
  },
  searchInput: {
    flex: 1,
    marginLeft: Spacing.sm,
    ...Typography.body,
    color: Colors.text,
  },
  filters: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surfaceElevated,
  },
  filterButtonActive: {
    backgroundColor: Colors.primary,
  },
  filterText: {
    ...Typography.body,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  filterTextActive: {
    color: Colors.text,
  },
  filterCount: {
    ...Typography.caption,
    color: Colors.textTertiary,
    fontWeight: '700',
    fontSize: 12,
  },
  filterCountActive: {
    color: Colors.text,
    opacity: 0.8,
  },
  listContent: {
    padding: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: 100,
  },
  projectCardWrapper: {
    marginBottom: Spacing.md,
  },
  projectCard: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    gap: Spacing.md,
  },
  projectCardArchived: {
    opacity: 0.5,
  },
  projectContent: {
    flex: 1,
  },
  projectHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  projectTitle: {
    ...Typography.bodyLarge,
    color: Colors.text,
    fontWeight: '600',
    fontSize: 16,
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
  archivedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${Colors.warning}20`,
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  archivedText: {
    ...Typography.caption,
    color: Colors.warning,
    fontWeight: '600',
    marginLeft: 4,
  },
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${Colors.success}20`,
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  completedText: {
    ...Typography.caption,
    color: Colors.success,
    fontWeight: '600',
    marginLeft: 4,
  },
  projectDescription: {
    ...Typography.body,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
  },
  projectMeta: {
    flexDirection: 'row',
    gap: Spacing.sm,
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  collaboratorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: `${Colors.primary}20`,
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  collaboratorText: {
    ...Typography.caption,
    color: Colors.primary,
    fontWeight: '600',
  },
  metaText: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontSize: 12,
  },
  swipeActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: Spacing.sm,
  },
  swipeEditButton: {
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    height: '100%',
    borderRadius: BorderRadius.lg,
    gap: 4,
  },
  swipeActionText: {
    ...Typography.caption,
    color: Colors.text,
    fontWeight: '600',
    fontSize: 12,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
    paddingHorizontal: Spacing.xl,
  },
  emptyIcon: {
    marginBottom: Spacing.lg,
  },
  emptyTitle: {
    ...Typography.h1,
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  emptyText: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.xl,
  },
  createButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  createButtonText: {
    ...Typography.bodyLarge,
    fontWeight: '600',
    color: Colors.text,
  },
  secondaryButton: {
    backgroundColor: Colors.surfaceElevated,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginTop: Spacing.md,
  },
  secondaryButtonText: {
    ...Typography.bodyLarge,
    fontWeight: '600',
    color: Colors.text,
  },
  addProjectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.surface,
    borderWidth: 2,
    borderColor: Colors.primary,
    borderStyle: 'dashed',
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginTop: Spacing.sm,
    marginHorizontal: scale(64),
  },
  addProjectButtonText: {
    ...Typography.bodyLarge,
    color: Colors.primary,
    fontWeight: '600',
  },
})