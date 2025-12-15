import * as Notifications from 'expo-notifications'
import { supabase } from '../lib/supabase'

/**
 * Badge Service
 * Manages app icon badge count based on unread notifications
 * Phase 1: Updates badge when app opens (no push notifications required)
 */

export interface NotificationCounts {
  pendingInvitations: number
  unreadMessages: number
  newKonnections: number
  total: number
}

/**
 * Get count of pending project invitations for a user
 */
async function getPendingInvitationsCount(userId: string): Promise<number> {
  try {
    // Note: project_collaborators table exists but isn't in auto-generated types
    const { count, error } = await (supabase as any)
      .from('project_collaborators')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('invitation_status', 'pending')

    if (error) {
      console.error('[Badge] Error fetching pending invitations:', error)
      return 0
    }

    return count || 0
  } catch (error) {
    console.error('[Badge] Exception fetching pending invitations:', error)
    return 0
  }
}

/**
 * Get count of unread direct messages for a user
 */
async function getUnreadMessagesCount(userId: string): Promise<number> {
  try {
    // Note: user_messages table exists but isn't in auto-generated types
    const { count, error } = await (supabase as any)
      .from('user_messages')
      .select('*', { count: 'exact', head: true })
      .eq('recipient_id', userId)
      .eq('read', false)

    if (error) {
      console.error('[Badge] Error fetching unread messages:', error)
      return 0
    }

    return count || 0
  } catch (error) {
    console.error('[Badge] Exception fetching unread messages:', error)
    return 0
  }
}

/**
 * Get count of new/unseen Konnections (people who followed you)
 */
async function getNewKonnectionsCount(userId: string): Promise<number> {
  try {
    // Note: user_connections table exists but isn't in auto-generated types
    // following_id = you (someone Konnected with you)
    // seen = false (you haven't seen this connection yet)
    const { count, error } = await (supabase as any)
      .from('user_connections')
      .select('*', { count: 'exact', head: true })
      .eq('following_id', userId)
      .eq('seen', false)
      .eq('status', 'active')

    if (error) {
      // If 'seen' column doesn't exist yet, return 0 (migration not run)
      if (error.code === '42703') {
        console.log('[Badge] seen column not found - run migration 20240116_connection_notifications.sql')
        return 0
      }
      console.error('[Badge] Error fetching new konnections:', error)
      return 0
    }

    return count || 0
  } catch (error) {
    console.error('[Badge] Exception fetching new konnections:', error)
    return 0
  }
}

/**
 * Get all notification counts for a user
 */
export async function getNotificationCounts(userId: string): Promise<NotificationCounts> {
  const [pendingInvitations, unreadMessages, newKonnections] = await Promise.all([
    getPendingInvitationsCount(userId),
    getUnreadMessagesCount(userId),
    getNewKonnectionsCount(userId),
  ])

  return {
    pendingInvitations,
    unreadMessages,
    newKonnections,
    total: pendingInvitations + unreadMessages + newKonnections,
  }
}

/**
 * Update the app icon badge with the current notification count
 */
export async function updateBadgeCount(userId: string): Promise<number> {
  try {
    const counts = await getNotificationCounts(userId)
    await Notifications.setBadgeCountAsync(counts.total)

    if (__DEV__) {
      console.log('[Badge] Updated badge count:', counts)
    }

    return counts.total
  } catch (error) {
    console.error('[Badge] Error updating badge count:', error)
    return 0
  }
}

/**
 * Clear the app icon badge
 */
export async function clearBadge(): Promise<void> {
  try {
    await Notifications.setBadgeCountAsync(0)
    if (__DEV__) {
      console.log('[Badge] Cleared badge')
    }
  } catch (error) {
    console.error('[Badge] Error clearing badge:', error)
  }
}

/**
 * Get current badge count from the system
 */
export async function getCurrentBadgeCount(): Promise<number> {
  try {
    return await Notifications.getBadgeCountAsync()
  } catch (error) {
    console.error('[Badge] Error getting badge count:', error)
    return 0
  }
}

/**
 * Mark all Konnections as seen for a user
 * Call this when user views their connections/activity
 */
export async function markKonnectionsAsSeen(userId: string): Promise<void> {
  try {
    const { error } = await (supabase as any)
      .from('user_connections')
      .update({ seen: true })
      .eq('following_id', userId)
      .eq('seen', false)

    if (error) {
      // Ignore if column doesn't exist yet
      if (error.code !== '42703') {
        console.error('[Badge] Error marking konnections as seen:', error)
      }
    } else if (__DEV__) {
      console.log('[Badge] Marked konnections as seen')
    }
  } catch (error) {
    console.error('[Badge] Exception marking konnections as seen:', error)
  }
}

export const badgeService = {
  getNotificationCounts,
  updateBadgeCount,
  clearBadge,
  getCurrentBadgeCount,
  markKonnectionsAsSeen,
}
