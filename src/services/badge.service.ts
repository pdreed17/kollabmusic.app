import { supabase } from '../lib/supabase'

/**
 * Badge Service
 * Manages app icon badge count based on unread notifications
 *
 * NOTE: Badge functionality is disabled in development builds that don't have
 * the expo-notifications native module. Badge will work in production builds.
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
    const { count, error } = await (supabase as any)
      .from('user_connections')
      .select('*', { count: 'exact', head: true })
      .eq('following_id', userId)
      .eq('seen', false)
      .eq('status', 'active')

    if (error) {
      if (error.code === '42703') {
        console.log('[Badge] seen column not found - run migration')
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
 * NOTE: Badge updates disabled - native module not available in dev build
 */
export async function updateBadgeCount(userId: string): Promise<number> {
  try {
    const counts = await getNotificationCounts(userId)
    // Badge updates disabled - expo-notifications native module not available
    // In production builds with native module, uncomment:
    // await Notifications.setBadgeCountAsync(counts.total)
    if (__DEV__) {
      console.log('[Badge] Count (badge update disabled):', counts.total)
    }
    return counts.total
  } catch (error) {
    console.error('[Badge] Error updating badge count:', error)
    return 0
  }
}

/**
 * Clear the app icon badge
 * NOTE: Badge clearing disabled - native module not available in dev build
 */
export async function clearBadge(): Promise<void> {
  // Badge updates disabled - expo-notifications native module not available
  if (__DEV__) {
    console.log('[Badge] Clear badge (disabled)')
  }
}

/**
 * Get current badge count from the system
 */
export async function getCurrentBadgeCount(): Promise<number> {
  // Badge reading disabled - expo-notifications native module not available
  return 0
}

/**
 * Mark all Konnections as seen for a user
 */
export async function markKonnectionsAsSeen(userId: string): Promise<void> {
  try {
    const { error } = await (supabase as any)
      .from('user_connections')
      .update({ seen: true })
      .eq('following_id', userId)
      .eq('seen', false)

    if (error) {
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
