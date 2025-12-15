import React, { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  ScrollView,
  ActivityIndicator,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useFocusEffect } from '@react-navigation/native'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { Colors, Typography, Spacing, BorderRadius } from '../constants/theme'
import { scale } from '../utils/responsive'
import ProjectIcon from '../components/ProjectIcon'
import { getAllBlockedUserIds } from '../utils/blockingHelpers'
import { hasSkillMatch } from '../utils/skillMatching'

interface SearchResult {
  type: 'project' | 'person'
  data: any
}

export default function SearchScreen({ navigation }: any) {
  const { user, userProfile, refreshUserProfile } = useAuth()
  const [searchQuery, setSearchQuery] = useState('')
  const [activeFilter, setActiveFilter] = useState<'all' | 'projects' | 'people' | 'genres'>('all')
  const [results, setResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [blockedUserIds, setBlockedUserIds] = useState<string[]>([])
  const [connectionStatus, setConnectionStatus] = useState<{ [userId: string]: boolean }>({})
  const [connectingUsers, setConnectingUsers] = useState<{ [userId: string]: boolean }>({})

  // Load blocked users on mount
  useEffect(() => {
    loadBlockedUsers()
  }, [user?.id])

  // Reload blocked users and connection status when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadBlockedUsers()
      if (results.length > 0) {
        loadConnectionStatus(results)
      }
    }, [results, user?.id])
  )

  // Live search with debouncing - search as user types
  useEffect(() => {
    // Clear results if search query is empty
    if (!searchQuery.trim()) {
      setResults([])
      setHasSearched(false)
      return
    }

    // Debounce search by 400ms to avoid too many requests
    const timeoutId = setTimeout(() => {
      performSearch()
    }, 400)

    // Cleanup timeout on query change
    return () => clearTimeout(timeoutId)
  }, [searchQuery, activeFilter])

  const loadBlockedUsers = async () => {
    if (!user?.id) return
    const blocked = await getAllBlockedUserIds(user.id)
    setBlockedUserIds(blocked)
  }

  const performSearch = async () => {
    if (!searchQuery.trim()) return

    setSearching(true)
    setHasSearched(true)

    try {
      const searchResults: SearchResult[] = []

      // Handle different filter types
      if (activeFilter === 'all') {
        // Search projects (exclude projects from blocked users)
        let projectQuery = supabase
          .from('projects')
          .select('*, users!projects_creator_id_fkey(username, display_name)')
          .eq('is_public', true)
          .or(`title.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%,genre.ilike.%${searchQuery}%`)

        // Only add blocked filter if there are blocked users
        if (blockedUserIds.length > 0) {
          projectQuery = projectQuery.not('creator_id', 'in', `(${blockedUserIds.join(',')})`)
        }

        const { data: projects } = await projectQuery
          .order('updated_at', { ascending: false })
          .limit(10)

        if (projects) {
          projects.forEach(project => {
            searchResults.push({ type: 'project', data: project })
          })
        }

        // Search people (exclude blocked users and self)
        let userQuery = supabase
          .from('users')
          .select('id, username, display_name, first_name, last_name, bio, specialties, open_to_kollab, avatar_url')
          .or(`username.ilike.%${searchQuery}%,display_name.ilike.%${searchQuery}%,first_name.ilike.%${searchQuery}%,last_name.ilike.%${searchQuery}%,bio.ilike.%${searchQuery}%`)

        // Exclude current user (can't search for self)
        if (user?.id) {
          userQuery = userQuery.neq('id', user.id)
        }

        if (blockedUserIds.length > 0) {
          userQuery = userQuery.not('id', 'in', `(${blockedUserIds.join(',')})`)
        }

        const { data: users } = await userQuery.limit(10)

        if (users) {
          users.forEach(user => {
            searchResults.push({ type: 'person', data: user })
          })
        }
      } else if (activeFilter === 'projects') {
        let projectQuery = supabase
          .from('projects')
          .select('*, users!projects_creator_id_fkey(username, display_name)')
          .eq('is_public', true)
          .or(`title.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%,genre.ilike.%${searchQuery}%`)

        if (blockedUserIds.length > 0) {
          projectQuery = projectQuery.not('creator_id', 'in', `(${blockedUserIds.join(',')})`)
        }

        const { data: projects } = await projectQuery
          .order('updated_at', { ascending: false })
          .limit(10)

        if (projects) {
          projects.forEach(project => {
            searchResults.push({ type: 'project', data: project })
          })
        }
      } else if (activeFilter === 'people') {
        let userQuery = supabase
          .from('users')
          .select('id, username, display_name, first_name, last_name, bio, specialties, open_to_kollab, avatar_url')
          .or(`username.ilike.%${searchQuery}%,display_name.ilike.%${searchQuery}%,first_name.ilike.%${searchQuery}%,last_name.ilike.%${searchQuery}%,bio.ilike.%${searchQuery}%`)

        // Exclude current user (can't search for self)
        if (user?.id) {
          userQuery = userQuery.neq('id', user.id)
        }

        if (blockedUserIds.length > 0) {
          userQuery = userQuery.not('id', 'in', `(${blockedUserIds.join(',')})`)
        }

        const { data: users } = await userQuery.limit(10)

        if (users) {
          users.forEach(user => {
            searchResults.push({ type: 'person', data: user })
          })
        }
      } else if (activeFilter === 'genres') {
        let genreQuery = supabase
          .from('projects')
          .select('*, users!projects_creator_id_fkey(username, display_name)')
          .eq('is_public', true)
          .ilike('genre', `%${searchQuery}%`)

        if (blockedUserIds.length > 0) {
          genreQuery = genreQuery.not('creator_id', 'in', `(${blockedUserIds.join(',')})`)
        }

        const { data: projects } = await genreQuery
          .order('updated_at', { ascending: false })
          .limit(20)

        if (projects) {
          projects.forEach(project => {
            searchResults.push({ type: 'project', data: project })
          })
        }
      }

      setResults(searchResults)

      // Load connection status for user results
      await loadConnectionStatus(searchResults)
    } catch (error) {
      if (__DEV__) console.error('Search error:', error)
    } finally {
      setSearching(false)
    }
  }

  const loadConnectionStatus = async (searchResults: SearchResult[]) => {
    if (!user?.id) return

    const userResults = searchResults.filter(r => r.type === 'person')
    if (userResults.length === 0) return

    const userIds = userResults.map(r => r.data.id)

    if (__DEV__) console.log('Loading connection status for user IDs:', userIds)

    try {
      const { data, error } = await supabase
        .from('user_connections')
        .select('following_id')
        .eq('user_id', user.id)
        .in('following_id', userIds)

      if (__DEV__) console.log('Connection status query result:', { data, error })

      if (!error && data) {
        const statusMap: { [userId: string]: boolean } = {}
        data.forEach(connection => {
          statusMap[connection.following_id] = true
        })
        if (__DEV__) console.log('Setting connection status map:', statusMap)
        setConnectionStatus(statusMap)
      }
    } catch (error) {
      if (__DEV__) console.error('Error loading connection status:', error)
    }
  }

  const handleConnect = async (userId: string) => {
    if (!user?.id || connectingUsers[userId]) return

    setConnectingUsers(prev => ({ ...prev, [userId]: true }))

    try {
      const isConnected = connectionStatus[userId]

      // Debug logging
      if (__DEV__) console.log('Connect attempt:', {
        currentUserId: user.id,
        targetUserId: userId,
        isConnected
      })

      if (isConnected) {
        // Disconnect
        const { error } = await supabase
          .from('user_connections')
          .delete()
          .eq('user_id', user.id)
          .eq('following_id', userId)

        if (error) {
          if (__DEV__) console.error('Disconnect error details:', error)
          throw error
        }
        setConnectionStatus(prev => ({ ...prev, [userId]: false }))
      } else {
        // Connect
        const { data, error } = await supabase
          .from('user_connections')
          .insert({
            user_id: user.id,
            following_id: userId,
          })
          .select()

        if (error) {
          if (__DEV__) console.error('Connect error details:', error)
          throw error
        }

        if (__DEV__) console.log('Connection insert successful:', data)
        setConnectionStatus(prev => ({ ...prev, [userId]: true }))
      }

      // Refresh current user's profile to update following_count
      await refreshUserProfile()

      // Verify the connection was saved by re-querying
      const { data: verifyData, error: verifyError } = await supabase
        .from('user_connections')
        .select('id')
        .eq('user_id', user.id)
        .eq('following_id', userId)
        .maybeSingle()

      if (__DEV__) console.log('Connection verification:', {
        userId,
        exists: !!verifyData,
        verifyError
      })

      // Update the status based on verification
      if (!verifyError) {
        setConnectionStatus(prev => ({ ...prev, [userId]: !!verifyData }))
      }
    } catch (error) {
      if (__DEV__) console.error('Error connecting/disconnecting:', error)
    } finally {
      setConnectingUsers(prev => ({ ...prev, [userId]: false }))
    }
  }

  const handleSearchSubmit = () => {
    performSearch()
  }

  const clearSearch = () => {
    setSearchQuery('')
    setResults([])
    setHasSearched(false)
  }

  return (
    <>
      {/* Search Bar */}
      <View style={styles.searchSection}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color={Colors.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder={
              activeFilter === 'genres'
                ? 'Search genres (Hip Hop, Rock, Jazz...)'
                : activeFilter === 'people'
                ? 'Search by first/last name, artist name, or specialty...'
                : activeFilter === 'projects'
                ? 'Search project titles, descriptions, or genres...'
                : 'Search projects, people by any name...'
            }
            placeholderTextColor={Colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSearchSubmit}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={clearSearch}>
              <Ionicons name="close-circle" size={20} color={Colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Filters */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filters}
        >
          <TouchableOpacity
            style={[styles.filterButton, activeFilter === 'all' && styles.filterButtonActive]}
            onPress={() => setActiveFilter('all')}
          >
            <Text style={[styles.filterText, activeFilter === 'all' && styles.filterTextActive]}>
              All
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterButton, activeFilter === 'projects' && styles.filterButtonActive]}
            onPress={() => setActiveFilter('projects')}
          >
            <Text style={[styles.filterText, activeFilter === 'projects' && styles.filterTextActive]}>
              Projects
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterButton, activeFilter === 'genres' && styles.filterButtonActive]}
            onPress={() => setActiveFilter('genres')}
          >
            <Text style={[styles.filterText, activeFilter === 'genres' && styles.filterTextActive]}>
              Genres
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterButton, activeFilter === 'people' && styles.filterButtonActive]}
            onPress={() => setActiveFilter('people')}
          >
            <Text style={[styles.filterText, activeFilter === 'people' && styles.filterTextActive]}>
              People
            </Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Search Button */}
        <TouchableOpacity 
          style={styles.searchButton}
          onPress={handleSearchSubmit}
          disabled={!searchQuery.trim() || searching}
        >
          {searching ? (
            <ActivityIndicator color={Colors.text} size="small" />
          ) : (
            <Text style={styles.searchButtonText}>Search</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Results */}
      <ScrollView style={styles.content}>
        {!hasSearched ? (
          <View style={styles.emptyState}>
            <Ionicons name="search" size={64} color={Colors.textSecondary} />
            <Text style={styles.emptyTitle}>Start Searching</Text>
            <Text style={styles.emptyText}>
              {activeFilter === 'genres' 
                ? 'Find projects by genre (Hip Hop, Rock, Jazz, Electronic...)'
                : 'Find projects, collaborators, and inspiration'
              }
            </Text>
          </View>
        ) : results.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="sad-outline" size={64} color={Colors.textSecondary} />
            <Text style={styles.emptyTitle}>No Results Found</Text>
            <Text style={styles.emptyText}>
              Try different keywords or filters
            </Text>
          </View>
        ) : (
          <View style={styles.resultsContainer}>
            {results.map((result, index) => (
              <View key={`${result.type}-${result.data.id}-${index}`}>
                {result.type === 'project' ? (() => {
                  const matchesSkills = hasSkillMatch(
                    userProfile?.specialties,
                    result.data.collaboration_needs
                  )
                  return (
                    <TouchableOpacity
                      style={[
                        styles.resultCard,
                        matchesSkills && styles.resultCardMatched
                      ]}
                      onPress={() => navigation.navigate('ProjectDetail', {
                        projectId: result.data.id
                      })}
                    >
                      <ProjectIcon size="medium" genre={result.data.genre} />
                      <View style={styles.resultContent}>
                        <Text style={styles.resultTitle} numberOfLines={1}>
                          {result.data.title}
                        </Text>
                        <Text style={styles.resultSubtitle} numberOfLines={1}>
                          by {result.data.users?.display_name || result.data.users?.username}
                        </Text>
                        {result.data.description && (
                          <Text style={styles.resultDescription} numberOfLines={2}>
                            {result.data.description}
                          </Text>
                        )}
                        <View style={styles.resultMeta}>
                          {matchesSkills && (
                            <View style={styles.skillsMatchBadge}>
                              <Ionicons name="checkmark-circle" size={12} color={Colors.success} />
                              <Text style={styles.skillsMatchText}>Skills Match</Text>
                            </View>
                          )}
                          {result.data.genre && (
                            <View style={styles.metaBadge}>
                              <Text style={styles.metaBadgeText}>{result.data.genre}</Text>
                            </View>
                          )}
                          {result.data.bpm && (
                            <Text style={styles.metaText}>🎵 {result.data.bpm} BPM</Text>
                          )}
                        </View>
                      </View>
                      <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
                    </TouchableOpacity>
                  )
                })() : (
                  <TouchableOpacity
                    style={styles.resultCard}
                    onPress={() => navigation.navigate('UserProfile', {
                      userId: result.data.id
                    })}
                  >
                    <View style={styles.userAvatar}>
                      {result.data.avatar_url ? (
                        <Image
                          source={{ uri: result.data.avatar_url }}
                          style={styles.userAvatarImage}
                          resizeMode="cover"
                        />
                      ) : (
                        <Text style={styles.userAvatarText}>
                          {(result.data.display_name || result.data.username).charAt(0).toUpperCase()}
                        </Text>
                      )}
                    </View>
                    <View style={styles.resultContent}>
                      <View style={styles.userHeader}>
                        <Text style={styles.resultTitle} numberOfLines={1}>
                          {result.data.display_name || result.data.username}
                        </Text>
                        {result.data.open_to_kollab && (
                          <View style={styles.kollabBadge}>
                            <Ionicons name="musical-notes" size={12} color={Colors.success} />
                          </View>
                        )}
                      </View>
                      <Text style={styles.resultSubtitle} numberOfLines={1}>
                        @{result.data.username}
                      </Text>
                      {result.data.bio && (
                        <Text style={styles.resultDescription} numberOfLines={2}>
                          {result.data.bio}
                        </Text>
                      )}
                      {result.data.specialties && result.data.specialties.length > 0 && (
                        <View style={styles.specialtiesRow}>
                          {result.data.specialties.slice(0, 3).map((spec: string) => (
                            <View key={spec} style={styles.specialtyMini}>
                              <Text style={styles.specialtyMiniText}>{spec}</Text>
                            </View>
                          ))}
                          {result.data.specialties.length > 3 && (
                            <Text style={styles.moreText}>+{result.data.specialties.length - 3}</Text>
                          )}
                        </View>
                      )}
                    </View>
                    <TouchableOpacity
                      style={[
                        styles.connectButton,
                        connectionStatus[result.data.id] && styles.connectedButton
                      ]}
                      onPress={(e) => {
                        e.stopPropagation()
                        handleConnect(result.data.id)
                      }}
                      disabled={connectingUsers[result.data.id]}
                    >
                      {connectingUsers[result.data.id] ? (
                        <ActivityIndicator
                          size="small"
                          color={connectionStatus[result.data.id] ? Colors.primary : Colors.text}
                        />
                      ) : (
                        <Ionicons
                          name={connectionStatus[result.data.id] ? "checkmark-circle" : "person-add"}
                          size={20}
                          color={connectionStatus[result.data.id] ? Colors.primary : Colors.text}
                        />
                      )}
                    </TouchableOpacity>
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.backgroundDark,
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
    marginBottom: Spacing.md,
  },
  filterButton: {
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
  searchButton: {
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  searchButtonText: {
    ...Typography.bodyLarge,
    color: Colors.text,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: Spacing.xxxl,
    paddingHorizontal: Spacing.lg,
  },
  emptyTitle: {
    ...Typography.h2,
    color: Colors.text,
    marginTop: Spacing.lg,
    marginBottom: Spacing.xs,
  },
  emptyText: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  resultsContainer: {
    padding: Spacing.lg,
  },
  resultCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    gap: Spacing.md,
  },
  resultCardMatched: {
    borderWidth: 2,
    borderColor: Colors.success,
    backgroundColor: `${Colors.success}08`,
    shadowColor: Colors.success,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  skillsMatchBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(4),
    backgroundColor: `${Colors.success}20`,
    paddingHorizontal: Spacing.sm,
    paddingVertical: scale(4),
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.success,
  },
  skillsMatchText: {
    ...Typography.caption,
    color: Colors.success,
    fontWeight: '700',
    fontSize: scale(11),
  },
  resultContent: {
    flex: 1,
  },
  userHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  resultTitle: {
    ...Typography.h3,
    color: Colors.text,
    marginBottom: Spacing.xxs,
  },
  resultSubtitle: {
    ...Typography.body,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  resultDescription: {
    ...Typography.body,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  resultMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flexWrap: 'wrap',
  },
  metaBadge: {
    backgroundColor: `${Colors.primary}30`,
    paddingHorizontal: Spacing.sm,
    paddingVertical: scale(4),
    borderRadius: BorderRadius.sm,
  },
  metaBadgeText: {
    ...Typography.caption,
    color: Colors.primary,
    fontWeight: '600',
  },
  metaText: {
    ...Typography.caption,
    color: Colors.textSecondary,
  },
  userAvatar: {
    width: scale(48),
    height: scale(48),
    borderRadius: scale(24),
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  userAvatarImage: {
    width: scale(48),
    height: scale(48),
    borderRadius: scale(24),
  },
  userAvatarText: {
    ...Typography.h3,
    color: Colors.text,
    fontWeight: '600',
  },
  kollabBadge: {
    width: scale(20),
    height: scale(20),
    borderRadius: scale(10),
    backgroundColor: `${Colors.success}20`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  specialtiesRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
    flexWrap: 'wrap',
    marginTop: Spacing.xs,
  },
  specialtyMini: {
    backgroundColor: `${Colors.primary}20`,
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  specialtyMiniText: {
    ...Typography.tiny,
    color: Colors.primary,
    fontWeight: '600',
  },
  moreText: {
    ...Typography.tiny,
    color: Colors.textSecondary,
  },
  connectButton: {
    padding: Spacing.sm,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 40,
    minHeight: 40,
  },
  connectedButton: {
    backgroundColor: Colors.surface,
    borderWidth: 2,
    borderColor: Colors.primary,
  },
})