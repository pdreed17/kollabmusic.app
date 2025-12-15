import { supabase } from '../lib/supabase'

/**
 * Check if two users have blocked each other (either direction)
 */
export const checkIfBlocked = async (userId1: string, userId2: string): Promise<boolean> => {
  try {
    const { data, error } = await supabase
      .from('blocked_users' as any)
      .select('id')
      .or(`and(blocker_id.eq.${userId1},blocked_id.eq.${userId2}),and(blocker_id.eq.${userId2},blocked_id.eq.${userId1})`) as any

    if (error) throw error
    return (data && data.length > 0)
  } catch (error) {
    if (__DEV__) console.error('Error checking blocked status:', error)
    return false
  }
}

/**
 * Get list of user IDs that the current user has blocked
 */
export const getBlockedUserIds = async (userId: string): Promise<string[]> => {
  try {
    const { data, error } = await supabase
      .from('blocked_users' as any)
      .select('blocked_id')
      .eq('blocker_id', userId) as any

    if (error) throw error
    return data?.map((b: any) => b.blocked_id) || []
  } catch (error) {
    if (__DEV__) console.error('Error getting blocked users:', error)
    return []
  }
}

/**
 * Get list of user IDs who have blocked the current user
 */
export const getUsersWhoBlockedMe = async (userId: string): Promise<string[]> => {
  try {
    const { data, error } = await supabase
      .from('blocked_users' as any)
      .select('blocker_id')
      .eq('blocked_id', userId) as any

    if (error) throw error
    return data?.map((b: any) => b.blocker_id) || []
  } catch (error) {
    if (__DEV__) console.error('Error getting users who blocked me:', error)
    return []
  }
}

/**
 * Get all user IDs that should be hidden from current user (blocked in either direction)
 */
export const getAllBlockedUserIds = async (userId: string): Promise<string[]> => {
  const [iBlocked, blockedMe] = await Promise.all([
    getBlockedUserIds(userId),
    getUsersWhoBlockedMe(userId)
  ])
  
  // Combine and deduplicate
  return [...new Set([...iBlocked, ...blockedMe])]
}

/**
 * Block a user
 */
export const blockUser = async (userId: string, userToBlockId: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('blocked_users' as any)
      .insert({
        blocker_id: userId,
        blocked_id: userToBlockId,
      }) as any

    if (error) throw error
    return true
  } catch (error) {
    if (__DEV__) console.error('Error blocking user:', error)
    return false
  }
}

/**
 * Unblock a user
 */
export const unblockUser = async (userId: string, userToUnblockId: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('blocked_users' as any)
      .delete()
      .eq('blocker_id', userId)
      .eq('blocked_id', userToUnblockId) as any

    if (error) throw error
    return true
  } catch (error) {
    if (__DEV__) console.error('Error unblocking user:', error)
    return false
  }
}