import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
  Alert,
  TextInput,
  ScrollView,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { Colors, Typography, Spacing, BorderRadius } from '../constants/theme'
import ProjectIcon from '../components/ProjectIcon'
import Header from '../components/Header'
import { getAllBlockedUserIds } from '../utils/blockingHelpers'

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

      // Get user's own projects
      const { data: myProjects, error: myError } = await supabase
        .from('projects')
        .select('*')
        .eq('creator_id', user.id)
        .order('updated_at', { ascending: false })

      if (myError) {
        console.error('Error loading my projects:', myError)
        throw myError
      }

      // Get projects where user is a collaborator
      const { data: collaborations, error: collabError } = await supabase
        .from('collaborators')
        .select('project_id')
        .eq('user_id', user.id)
        .eq('invitation_status', 'accepted')
        .neq('role', 'owner')

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

      console.log('Projects loaded:', allProjects.length)
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

  // Filter projects
  const filteredProjects = projects.filter(p => {
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

  const myProjectsCount = projects.filter(p => p.creator_id === user?.id && p.status !== 'deleted').length
  const collaboratingCount = projects.filter(p => p.creator_id !== user?.id && p.status !== 'deleted').length
  const totalActive = myProjectsCount + collaboratingCount

  const renderProject = ({ item }: any) => {
    const isMyProject = item.creator_id === user?.id
    const isArchived = item.status === 'archived'
    const isCompleted = item.status === 'completed'

    return (
      <View style={styles.projectCardWrapper}>
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
                  <Text style={styles.collaboratorText}>Collaborating</Text>
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

        {isMyProject && (
          <TouchableOpacity
            style={styles.editButton}
            onPress={() => navigation.navigate('EditProject', { projectId: item.id })}
          >
            <Ionicons name="create-outline" size={20} color={Colors.primary} />
          </TouchableOpacity>
        )}
      </View>
    )
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <Header
          title="My Projects"
          subtitle="Project List"
          variant="compact"
          showBack={true}
          onBack={() => navigation.goBack()}
          showProfile={true}
          onProfilePress={() => navigation.navigate('Profile')}
          profilePhotoUrl={userProfile?.avatar_url}
        />
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <Header
        title="My Projects"
        subtitle="Project List"
        variant="compact"
        showBack={true}
        onBack={() => navigation.goBack()}
        showProfile={true}
        onProfilePress={() => navigation.navigate('Profile')}
        profilePhotoUrl={userProfile?.avatar_url}
      />

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
              Collaborating
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
                ? 'No Collaborations Yet'
                : 'No Projects Yet'
              }
            </Text>

            <Text style={styles.emptyText}>
              {searchQuery.length > 0
                ? `No projects match "${searchQuery}"`
                : activeFilter === 'mine'
                ? 'Create your first project to start collaborating'
                : activeFilter === 'collaborating'
                ? 'Join a project to start collaborating with others'
                : 'Create a project or join collaborations'
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

      {filteredProjects.length > 0 && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => navigation.navigate('CreateProject')}
        >
          <Text style={styles.fabText}>+</Text>
        </TouchableOpacity>
      )}
    </SafeAreaView>
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
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  projectCard: {
    flex: 1,
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
  editButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: `${Colors.primary}08`,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: Spacing.sm,
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
  fab: {
    position: 'absolute',
    bottom: Spacing.xl,
    right: Spacing.xl,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  fabText: {
    color: Colors.text,
    fontSize: 32,
    fontWeight: '300',
  },
})