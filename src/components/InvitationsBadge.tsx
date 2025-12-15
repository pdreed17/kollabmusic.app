import React, { useState, useEffect } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { Colors, Typography, Spacing, BorderRadius } from '../constants/theme'

interface InvitationsBadgeProps {
  onPress: () => void
  variant?: 'large' | 'small'
}

export default function InvitationsBadge({ onPress, variant = 'large' }: InvitationsBadgeProps) {
  const { user } = useAuth()
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadCount()
    
    // Set up real-time subscription for updates
    const subscription = supabase
      .channel('invitations-count')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'collaborators',
          filter: `user_id=eq.${user?.id}`
        },
        () => {
          loadCount()
        }
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [user?.id])

  const loadCount = async () => {
    try {
      if (!user?.id) return

      const { count: inviteCount, error } = await supabase
        .from('project_collaborators')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('invitation_status', 'pending')

      if (error) throw error

      setCount(inviteCount || 0)
    } catch (error) {
      console.error('Error loading invitations count:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return null
  }

  if (variant === 'small') {
    // Small icon version (for top-right corner)
    return (
      <TouchableOpacity style={styles.smallButton} onPress={onPress}>
        <Ionicons name="mail" size={24} color={Colors.text} />
        {count > 0 && (
          <View style={styles.smallBadge}>
            <Text style={styles.smallBadgeText}>{count > 9 ? '9+' : count}</Text>
          </View>
        )}
      </TouchableOpacity>
    )
  }

  // Large card version (for in-content)
  return (
    <TouchableOpacity 
      style={[styles.card, count === 0 && styles.cardEmpty]} 
      onPress={onPress}
      disabled={count === 0}
    >
      <View style={styles.iconContainer}>
        <Ionicons 
          name={count > 0 ? "mail" : "mail-open-outline"} 
          size={32} 
          color={count > 0 ? Colors.primary : Colors.textSecondary} 
        />
        {count > 0 && (
          <View style={styles.largeBadge}>
            <Text style={styles.largeBadgeText}>{count}</Text>
          </View>
        )}
      </View>
      <View style={styles.content}>
        <Text style={[styles.title, count === 0 && styles.titleEmpty]}>
          {count === 0 ? 'No Pending Invitations' : 'Pending Invitations'}
        </Text>
        <Text style={styles.subtitle}>
          {count === 0 
            ? 'You have no new collaboration invites' 
            : `You have ${count} ${count === 1 ? 'invitation' : 'invitations'} waiting`
          }
        </Text>
      </View>
      {count > 0 && (
        <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
      )}
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  // Small variant (icon with badge)
  smallButton: {
    position: 'relative',
    padding: Spacing.xs,
  },
  smallBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: Colors.error,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.backgroundDark,
  },
  smallBadgeText: {
    ...Typography.tiny,
    color: Colors.text,
    fontWeight: '700',
  },

  // Large variant (card)
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    gap: Spacing.md,
  },
  cardEmpty: {
    opacity: 0.6,
  },
  iconContainer: {
    position: 'relative',
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
  },
  largeBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: Colors.error,
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.surface,
  },
  largeBadgeText: {
    ...Typography.caption,
    color: Colors.text,
    fontWeight: '700',
  },
  content: {
    flex: 1,
  },
  title: {
    ...Typography.bodyLarge,
    color: Colors.text,
    fontWeight: '600',
    marginBottom: Spacing.xxs,
  },
  titleEmpty: {
    color: Colors.textSecondary,
  },
  subtitle: {
    ...Typography.body,
    color: Colors.textSecondary,
  },
})