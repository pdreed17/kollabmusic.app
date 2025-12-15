/**
 * Subscription Limits Utility
 *
 * Defines and checks subscription tier limits
 */

import { supabase } from '../lib/supabase'
import { Alert } from 'react-native'

export type SubscriptionTier = 'free' | 'pro'

export interface SubscriptionLimits {
  ownedProjectsLimit: number
  activeCollabsLimit: number
  tracksPerProjectLimit: number
  storageLimit: number // in bytes, -1 = unlimited
  hasAdvancedTools: boolean
}

// Storage limits in bytes
const MB = 1024 * 1024
const GB = 1024 * MB

export const SUBSCRIPTION_LIMITS: Record<SubscriptionTier, SubscriptionLimits> = {
  free: {
    ownedProjectsLimit: 3,
    activeCollabsLimit: 3,
    tracksPerProjectLimit: 8,
    storageLimit: 200 * MB, // 200 MB
    hasAdvancedTools: false,
  },
  pro: {
    ownedProjectsLimit: -1, // -1 = unlimited
    activeCollabsLimit: -1,
    tracksPerProjectLimit: -1,
    storageLimit: 5 * GB, // 5 GB
    hasAdvancedTools: true,
  },
}

/**
 * Get limits for a subscription tier
 */
export function getLimits(tier: SubscriptionTier): SubscriptionLimits {
  return SUBSCRIPTION_LIMITS[tier]
}

/**
 * Check if user can create a new owned project
 */
export async function canCreateProject(userId: string): Promise<{ allowed: boolean; reason?: string }> {
  try {
    // Use the database function to check limits
    const { data: canCreate, error } = await supabase.rpc('can_create_project', {
      p_user_id: userId,
    })

    if (error) {
      console.error('Error calling can_create_project:', error)
      // Fall back to manual check
      return await canCreateProjectFallback(userId)
    }

    if (!canCreate) {
      return {
        allowed: false,
        reason: 'Free tier allows 3 owned projects. Upgrade to Pro for unlimited.',
      }
    }

    return { allowed: true }
  } catch (error) {
    console.error('Error checking project limit:', error)
    return { allowed: true } // Fail open to not block users on errors
  }
}

/**
 * Fallback method if database function doesn't exist
 */
async function canCreateProjectFallback(userId: string): Promise<{ allowed: boolean; reason?: string }> {
  const { data: user } = await supabase
    .from('users')
    .select('subscription_tier')
    .eq('id', userId)
    .single()

  const tier = (user?.subscription_tier || 'free') as SubscriptionTier
  const limits = getLimits(tier)

  // Pro users have unlimited projects
  if (limits.ownedProjectsLimit === -1) {
    return { allowed: true }
  }

  // Count owned projects
  const { count } = await supabase
    .from('projects')
    .select('*', { count: 'exact', head: true })
    .eq('creator_id', userId)

  if ((count || 0) >= limits.ownedProjectsLimit) {
    return {
      allowed: false,
      reason: `Free tier allows ${limits.ownedProjectsLimit} owned projects. Upgrade to Pro for unlimited.`,
    }
  }

  return { allowed: true }
}

/**
 * Check if user can upload to a project
 */
export async function canUploadToProject(
  userId: string,
  projectId: string,
  isOwner: boolean
): Promise<{ allowed: boolean; reason?: string }> {
  try {
    // Get user's subscription tier
    const { data: user } = await supabase
      .from('users')
      .select('subscription_tier')
      .eq('id', userId)
      .single()

    const tier = (user?.subscription_tier || 'free') as SubscriptionTier
    const limits = getLimits(tier)

    // Pro users have unlimited uploads
    if (limits.tracksPerProjectLimit === -1) {
      return { allowed: true }
    }

    // Check 1: Tracks per project limit
    const { data: project } = await supabase
      .from('projects')
      .select('track_count')
      .eq('id', projectId)
      .single()

    if (project && project.track_count >= limits.tracksPerProjectLimit) {
      return {
        allowed: false,
        reason: `Free tier allows ${limits.tracksPerProjectLimit} tracks per project. Upgrade to Pro for unlimited.`,
      }
    }

    // Check 2: Active collaborations limit (only if not owner)
    if (!isOwner) {
      const { data: activeCollabsCount } = await supabase.rpc('get_user_active_collabs_count', {
        p_user_id: userId,
      })

      // Check if user has already uploaded to this project
      const { data: existingUploads } = await supabase
        .from('audio_files')
        .select('id')
        .eq('project_id', projectId)
        .eq('created_by', userId)
        .limit(1)

      // If user hasn't uploaded to this project yet, check active collab limit
      if (!existingUploads || existingUploads.length === 0) {
        if (activeCollabsCount >= limits.activeCollabsLimit) {
          return {
            allowed: false,
            reason: `Free tier allows uploading to ${limits.activeCollabsLimit} collaborative projects. Upgrade to Pro for unlimited.`,
          }
        }
      }
    }

    return { allowed: true }
  } catch (error) {
    console.error('Error checking upload limit:', error)
    return { allowed: true } // Fail open
  }
}

/**
 * Get user's current usage stats
 */
export async function getUserUsageStats(userId: string) {
  try {
    const [user, ownedCount, activeCollabsCount] = await Promise.all([
      supabase.from('users').select('subscription_tier').eq('id', userId).single(),
      supabase.rpc('get_user_owned_projects_count', { p_user_id: userId }),
      supabase.rpc('get_user_active_collabs_count', { p_user_id: userId }),
    ])

    const tier = (user.data?.subscription_tier || 'free') as SubscriptionTier
    const limits = getLimits(tier)

    return {
      tier,
      limits,
      usage: {
        ownedProjects: ownedCount.data || 0,
        activeCollabs: activeCollabsCount.data || 0,
      },
    }
  } catch (error) {
    console.error('Error getting usage stats:', error)
    return null
  }
}

/**
 * Check if user can accept a new collaboration invitation
 */
export async function canAcceptCollaboration(userId: string): Promise<{ allowed: boolean; reason?: string }> {
  try {
    // Get user's subscription tier
    const { data: user } = await supabase
      .from('users')
      .select('subscription_tier')
      .eq('id', userId)
      .single()

    const tier = (user?.subscription_tier || 'free') as SubscriptionTier
    const limits = getLimits(tier)

    // Pro users have unlimited collaborations
    if (limits.activeCollabsLimit === -1) {
      return { allowed: true }
    }

    // Count accepted collaborations where user is not the owner
    const { data: collabs, error } = await supabase
      .from('project_collaborators')
      .select('id, project:projects!inner(creator_id)')
      .eq('user_id', userId)
      .eq('invitation_status', 'accepted')
      .neq('role', 'owner')

    if (error) {
      console.error('Error counting collaborations:', error)
      return { allowed: true } // Fail open
    }

    // Filter out projects where user is the creator (extra safety)
    const activeCollabs = collabs?.filter(c => {
      const project = c.project as unknown as { creator_id: string }
      return project.creator_id !== userId
    }) || []

    if (activeCollabs.length >= limits.activeCollabsLimit) {
      return {
        allowed: false,
        reason: `Free tier allows collaborating on ${limits.activeCollabsLimit} projects. Upgrade to Pro for unlimited collaborations.`,
      }
    }

    return { allowed: true }
  } catch (error) {
    console.error('Error checking collaboration limit:', error)
    return { allowed: true } // Fail open
  }
}

/**
 * Show upgrade alert with subscription screen navigation
 */
export function showUpgradeAlert(message: string, navigation: any) {
  Alert.alert('Upgrade to Pro', message, [
    {
      text: 'Upgrade Now',
      onPress: () => navigation.navigate('Subscription'),
    },
    {
      text: 'Maybe Later',
      style: 'cancel',
    },
  ])
}

/**
 * Format bytes to human-readable string
 */
export function formatStorage(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < MB) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < GB) return `${(bytes / MB).toFixed(1)} MB`
  return `${(bytes / GB).toFixed(2)} GB`
}

/**
 * Get user's total storage used (sum of all their uploaded audio files)
 */
export async function getUserStorageUsed(userId: string): Promise<number> {
  try {
    const { data, error } = await supabase
      .from('audio_files')
      .select('file_size')
      .eq('created_by', userId)

    if (error) {
      console.error('Error getting storage usage:', error)
      return 0
    }

    // Sum all file sizes
    const totalBytes = data?.reduce((sum, file) => sum + (file.file_size || 0), 0) || 0
    return totalBytes
  } catch (error) {
    console.error('Error calculating storage:', error)
    return 0
  }
}

/**
 * Get user's storage stats (used, limit, percentage)
 */
export async function getUserStorageStats(userId: string) {
  try {
    const [user, storageUsed] = await Promise.all([
      supabase.from('users').select('subscription_tier').eq('id', userId).single(),
      getUserStorageUsed(userId),
    ])

    const tier = (user.data?.subscription_tier || 'free') as SubscriptionTier
    const limits = getLimits(tier)
    const storageLimit = limits.storageLimit

    return {
      tier,
      storageUsed,
      storageLimit,
      storageUsedFormatted: formatStorage(storageUsed),
      storageLimitFormatted: storageLimit === -1 ? 'Unlimited' : formatStorage(storageLimit),
      percentageUsed: storageLimit === -1 ? 0 : Math.round((storageUsed / storageLimit) * 100),
      isNearLimit: storageLimit !== -1 && storageUsed >= storageLimit * 0.8,
      isOverLimit: storageLimit !== -1 && storageUsed >= storageLimit,
    }
  } catch (error) {
    console.error('Error getting storage stats:', error)
    return null
  }
}

/**
 * Check if user can upload a file of given size
 */
export async function canUploadFile(
  userId: string,
  fileSizeBytes: number
): Promise<{ allowed: boolean; reason?: string }> {
  try {
    const stats = await getUserStorageStats(userId)
    if (!stats) return { allowed: true } // Fail open

    // Unlimited storage
    if (stats.storageLimit === -1) {
      return { allowed: true }
    }

    const newTotal = stats.storageUsed + fileSizeBytes

    if (newTotal > stats.storageLimit) {
      const spaceNeeded = formatStorage(fileSizeBytes)
      const spaceAvailable = formatStorage(stats.storageLimit - stats.storageUsed)
      return {
        allowed: false,
        reason: `This file (${spaceNeeded}) exceeds your available storage (${spaceAvailable} remaining). Delete some files or upgrade to Pro for 3 GB of storage.`,
      }
    }

    return { allowed: true }
  } catch (error) {
    console.error('Error checking upload limit:', error)
    return { allowed: true } // Fail open
  }
}
