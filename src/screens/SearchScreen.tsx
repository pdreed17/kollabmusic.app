import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { Colors, Typography, Spacing, BorderRadius } from '../constants/theme'
import { scale } from '../utils/responsive'
import ProjectIcon from '../components/ProjectIcon'
import Header from '../components/Header'
import { getAllBlockedUserIds } from '../utils/blockingHelpers'
import { hasSkillMatch } from '../utils/skillMatching'

interface SearchResult {
  type: 'project' | 'person'
  data: any
}

export default function SearchScreen({ navigation }: any) {
  const { user, userProfile } = useAuth()
  const [searchQuery, setSearchQuery] = useState('')
  const [activeFilter, setActiveFilter] = useState<'all' | 'projects' | 'people' | 'genres'>('all')
  const [results, setResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [blockedUserIds, setBlockedUserIds] = useState<string[]>([])

  // Load blocked users on mount
  useEffect(() => {
    loadBlockedUsers()
  }, [user?.id])

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
        const { data: projects } = await supabase
          .from('projects')
          .select('*, users!projects_creator_id_fkey(username, display_name)')
          .eq('is_public', true)
          .or(`title.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%,genre.ilike.%${searchQuery}%`)
          .not('creator_id', 'in', `(${blockedUserIds.join(',')})`)
          .order('updated_at', { ascending: false })
          .limit(10)

        if (projects) {
          projects.forEach(project => {
            searchResults.push({ type: 'project', data: project })
          })
        }

        // Search people (exclude blocked users)
        const { data: users } = await supabase
          .from('users')
          .select('id, username, display_name, bio, specialties, open_to_kollab')
          .or(`username.ilike.%${searchQuery}%,display_name.ilike.%${searchQuery}%,bio.ilike.%${searchQuery}%`)
          .not('id', 'in', `(${blockedUserIds.join(',')})`)
          .limit(10)

        if (users) {
          users.forEach(user => {
            searchResults.push({ type: 'person', data: user })
          })
        }
      } else if (activeFilter === 'projects') {
        const { data: projects } = await supabase
          .from('projects')
          .select('*, users!projects_creator_id_fkey(username, display_name)')
          .eq('is_public', true)
          .or(`title.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%,genre.ilike.%${searchQuery}%`)
          .not('creator_id', 'in', `(${blockedUserIds.join(',')})`)
          .order('updated_at', { ascending: false })
          .limit(10)

        if (projects) {
          projects.forEach(project => {
            searchResults.push({ type: 'project', data: project })
          })
        }
      } else if (activeFilter === 'people') {
        const { data: users } = await supabase
          .from('users')
          .select('id, username, display_name, bio, specialties, open_to_kollab')
          .or(`username.ilike.%${searchQuery}%,display_name.ilike.%${searchQuery}%,bio.ilike.%${searchQuery}%`)
          .not('id', 'in', `(${blockedUserIds.join(',')})`)
          .limit(10)

        if (users) {
          users.forEach(user => {
            searchResults.push({ type: 'person', data: user })
          })
        }
      } else if (activeFilter === 'genres') {
        const { data: projects } = await supabase
          .from('projects')
          .select('*, users!projects_creator_id_fkey(username, display_name)')
          .eq('is_public', true)
          .ilike('genre', `%${searchQuery}%`)
          .not('creator_id', 'in', `(${blockedUserIds.join(',')})`)
          .order('updated_at', { ascending: false })
          .limit(20)

        if (projects) {
          projects.forEach(project => {
            searchResults.push({ type: 'project', data: project })
          })
        }
      }

      setResults(searchResults)
    } catch (error) {
      console.error('Search error:', error)
    } finally {
      setSearching(false)
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
    <SafeAreaView style={styles.container}>
      <Header
        title="Search"
        variant="compact"
        showBack={true}
        onBack={() => navigation.goBack()}
        showProfile={true}
        onProfilePress={() => navigation.navigate('Profile')}
        profilePhotoUrl={userProfile?.avatar_url}
      />

      {/* Search Bar */}
      <View style={styles.searchSection}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color={Colors.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder={
              activeFilter === 'genres' 
                ? 'Search genres (Hip Hop, Rock, Jazz...)' 
                : 'Search projects, people, genres...'
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
            onPress={() => {
              setActiveFilter('all')
              if (hasSearched) performSearch()
            }}
          >
            <Text style={[styles.filterText, activeFilter === 'all' && styles.filterTextActive]}>
              All
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterButton, activeFilter === 'projects' && styles.filterButtonActive]}
            onPress={() => {
              setActiveFilter('projects')
              if (hasSearched) performSearch()
            }}
          >
            <Text style={[styles.filterText, activeFilter === 'projects' && styles.filterTextActive]}>
              Projects
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterButton, activeFilter === 'genres' && styles.filterButtonActive]}
            onPress={() => {
              setActiveFilter('genres')
              if (hasSearched) performSearch()
            }}
          >
            <Text style={[styles.filterText, activeFilter === 'genres' && styles.filterTextActive]}>
              Genres
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterButton, activeFilter === 'people' && styles.filterButtonActive]}
            onPress={() => {
              setActiveFilter('people')
              if (hasSearched) performSearch()
            }}
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
                    onPress={() => {
                      console.log('Navigate to user profile:', result.data.id)
                    }}
                  >
                    <View style={styles.userAvatar}>
                      <Text style={styles.userAvatarText}>
                        {(result.data.display_name || result.data.username).charAt(0).toUpperCase()}
                      </Text>
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
                    <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
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
})