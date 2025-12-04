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
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { Colors, Typography, Spacing, BorderRadius } from '../constants/theme'
import Header from '../components/Header'

interface BlockedUser {
  id: string
  blocked_user_id: string
  blocked_username: string
  blocked_display_name: string
}

export default function BlockedUsersScreen({ navigation }: any) {
  const { user } = useAuth()
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadBlockedUsers()
  }, [])

  const loadBlockedUsers = async () => {
    try {
      if (!user?.id) return
      
      // Get blocked user IDs (with type assertion to fix TypeScript error)
      const { data: blockedData, error: blockedError } = await supabase
        .from('blocked_users' as any)
        .select('id, blocked_user_id')
        .eq('user_id', user.id) as any
      
      if (blockedError) throw blockedError
      
      if (!blockedData || blockedData.length === 0) {
        setBlockedUsers([])
        setLoading(false)
        return
      }

      // Get user details for blocked users
      const blockedUserIds = blockedData.map((b: any) => b.blocked_user_id)
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('id, username, display_name')
        .in('id', blockedUserIds)
      
      if (usersError) throw usersError

      // Combine the data
      const combined = blockedData.map((blocked: any) => {
        const userInfo = usersData?.find((u: any) => u.id === blocked.blocked_user_id)
        return {
          id: blocked.id,
          blocked_user_id: blocked.blocked_user_id,
          blocked_username: userInfo?.username || 'Unknown',
          blocked_display_name: userInfo?.display_name || userInfo?.username || 'Unknown User',
        }
      })

      setBlockedUsers(combined)
    } catch (error) {
      console.error('Error loading blocked users:', error)
      Alert.alert('Error', 'Failed to load blocked users')
    } finally {
      setLoading(false)
    }
  }

  const handleUnblock = async (blockedUserId: string) => {
    Alert.alert(
      'Unblock User',
      'Are you sure you want to unblock this user?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unblock',
          onPress: async () => {
            try {
              if (!user?.id) {
                Alert.alert('Error', 'User not authenticated')
                return
              }

              const { error } = await supabase
                .from('blocked_users' as any)
                .delete()
                .eq('user_id', user.id)
                .eq('blocked_user_id', blockedUserId) as any
              
              if (error) throw error
              
              setBlockedUsers(prev => prev.filter(b => b.blocked_user_id !== blockedUserId))
              Alert.alert('Success', 'User unblocked')
            } catch (error) {
              console.error('Unblock error:', error)
              Alert.alert('Error', 'Failed to unblock user')
            }
          }
        }
      ]
    )
  }

  const renderItem = ({ item }: { item: BlockedUser }) => (
    <View style={styles.userItem}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>
          {item.blocked_display_name.charAt(0).toUpperCase()}
        </Text>
      </View>
      <View style={styles.userInfo}>
        <Text style={styles.displayName}>
          {item.blocked_display_name}
        </Text>
        <Text style={styles.username}>@{item.blocked_username}</Text>
      </View>
      <TouchableOpacity
        style={styles.unblockButton}
        onPress={() => handleUnblock(item.blocked_user_id)}
      >
        <Text style={styles.unblockText}>Unblock</Text>
      </TouchableOpacity>
    </View>
  )

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <Header title="Blocked Users" variant="compact" showBack={true} onBack={() => navigation.goBack()} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <Header title="Blocked Users" variant="compact" showBack={true} onBack={() => navigation.goBack()} />
      {blockedUsers.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="ban-outline" size={64} color={Colors.textSecondary} />
          <Text style={styles.emptyText}>No blocked users</Text>
          <Text style={styles.emptySubtext}>
            Users you block won't be able to collaborate with you
          </Text>
        </View>
      ) : (
        <FlatList
          data={blockedUsers}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
        />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.backgroundDark },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.xl },
  emptyText: { ...Typography.h3, color: Colors.text, marginTop: Spacing.md },
  emptySubtext: { ...Typography.body, color: Colors.textSecondary, textAlign: 'center', marginTop: Spacing.xs },
  list: { padding: Spacing.md },
  userItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, padding: Spacing.md, borderRadius: BorderRadius.md, marginBottom: Spacing.sm, borderWidth: 1, borderColor: Colors.border },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center', marginRight: Spacing.md },
  avatarText: { fontSize: 20, color: Colors.text, fontWeight: '600' },
  userInfo: { flex: 1 },
  displayName: { ...Typography.bodyLarge, color: Colors.text, fontWeight: '600' },
  username: { ...Typography.body, color: Colors.textSecondary },
  unblockButton: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.md, backgroundColor: Colors.surfaceElevated, borderWidth: 1, borderColor: Colors.border },
  unblockText: { ...Typography.body, color: Colors.primary, fontWeight: '600' },
})