import { supabase } from '../lib/supabase'

export interface ActivityItem {
  id: string
  user_id: string
  activity_type: 'project_created' | 'collaborator_joined' | 'file_uploaded' | 'comment_added' | 'project_updated' | 'invitation_sent' | 'invitation_accepted'
  project_id?: string
  audio_file_id?: string
  target_user_id?: string
  metadata: {
    project_title?: string
    file_name?: string
    comment_preview?: string
    collaborator_name?: string
  }
  created_at: string
}

export interface ActivityFeedItem {
  id: string
  type: 'project_created' | 'collaborator_joined' | 'file_uploaded' | 'comment_added' | 'project_updated' | 'invitation_sent' | 'invitation_accepted'
  title: string
  description: string
  timestamp: string
  icon: string
  color: string
  project_id?: string
  from_connection?: boolean
  user_id?: string
  username?: string
}

export interface UserStats {
  projectsCreated: number
  collaborations: number
  filesUploaded: number
  totalCollaborators: number
}

/**
 * Get activity feed for the current user
 * Aggregates activities from projects they own or collaborate on
 */
export const getUserActivityFeed = async (userId: string, limit: number = 20): Promise<ActivityFeedItem[]> => {
  try {
    const activities: ActivityFeedItem[] = []

    // Get projects created
    const { data: projects, error: projectsError } = await supabase
      .from('projects')
      .select('id, title, created_at')
      .eq('creator_id', userId)
      .order('created_at', { ascending: false })
      .limit(5)

    if (!projectsError && projects) {
      projects.forEach((project) => {
        activities.push({
          id: `project-${project.id}`,
          type: 'project_created',
          title: 'Project Created',
          description: `You created "${project.title}"`,
          timestamp: formatTimestamp(project.created_at || new Date().toISOString()),
          icon: 'musical-notes',
          color: '#6366F1',
          project_id: project.id,
        })
      })
    }

    // Get collaborations joined
    const { data: collaborations, error: collabError } = await supabase
      .from('project_collaborators')
      .select(`
        id,
        created_at,
        projects:project_id (
          id,
          title
        )
      `)
      .eq('user_id', userId)
      .neq('role', 'owner')
      .order('created_at', { ascending: false })
      .limit(5)

    if (!collabError && collaborations) {
      collaborations.forEach((collab: any) => {
        if (collab.projects) {
          activities.push({
            id: `collab-${collab.id}`,
            type: 'collaborator_joined',
            title: 'Joined Project',
            description: `You joined "${collab.projects.title}"`,
            timestamp: formatTimestamp(collab.created_at),
            icon: 'person-add',
            color: '#10B981',
            project_id: collab.projects.id,
          })
        }
      })
    }

    // Get files uploaded
    const { data: files, error: filesError } = await supabase
      .from('audio_files')
      .select(`
        id,
        file_name,
        stem_type,
        created_at,
        projects:project_id (
          id,
          title
        )
      `)
      .eq('creator_id', userId)
      .order('created_at', { ascending: false })
      .limit(5)

    if (!filesError && files) {
      files.forEach((file: any) => {
        if (file.projects) {
          activities.push({
            id: `file-${file.id}`,
            type: 'file_uploaded',
            title: 'File Uploaded',
            description: `Added "${file.file_name}" to "${file.projects.title}"`,
            timestamp: formatTimestamp(file.created_at),
            icon: 'cloud-upload',
            color: '#3B82F6',
            project_id: file.projects.id,
          })
        }
      })
    }

    // Get comments added
    const { data: comments, error: commentsError } = await supabase
      .from('comments')
      .select(`
        id,
        content,
        created_at,
        projects:project_id (
          id,
          title
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(5)

    if (!commentsError && comments) {
      comments.forEach((comment: any) => {
        if (comment.projects) {
          const preview = comment.content.substring(0, 50) + (comment.content.length > 50 ? '...' : '')
          activities.push({
            id: `comment-${comment.id}`,
            type: 'comment_added',
            title: 'Comment Added',
            description: `Commented on "${comment.projects.title}": ${preview}`,
            timestamp: formatTimestamp(comment.created_at),
            icon: 'chatbubble',
            color: '#F59E0B',
            project_id: comment.projects.id,
          })
        }
      })
    }

    // Get activities from connected users
    const { data: connections, error: connectionsError } = await supabase
      .from('user_connections')
      .select('following_id')
      .eq('user_id', userId)

    if (!connectionsError && connections && connections.length > 0) {
      const connectedUserIds = connections.map(c => c.following_id)

      // Get connected users' projects
      const { data: connectedProjects, error: connectedProjectsError } = await supabase
        .from('projects')
        .select('id, title, created_at, creator_id, users:creator_id(username)')
        .in('creator_id', connectedUserIds)
        .order('created_at', { ascending: false })
        .limit(10)

      if (!connectedProjectsError && connectedProjects) {
        connectedProjects.forEach((project: any) => {
          activities.push({
            id: `connected-project-${project.id}`,
            type: 'project_created',
            title: 'Project Created',
            description: `${project.users?.username || 'A connection'} created "${project.title}"`,
            timestamp: formatTimestamp(project.created_at || new Date().toISOString()),
            icon: 'musical-notes',
            color: '#6366F1',
            project_id: project.id,
            from_connection: true,
            user_id: project.creator_id,
            username: project.users?.username,
          })
        })
      }

      // Get connected users' file uploads
      const { data: connectedFiles, error: connectedFilesError } = await supabase
        .from('audio_files')
        .select(`
          id,
          file_name,
          created_at,
          created_by,
          users:created_by(username),
          projects:project_id (
            id,
            title
          )
        `)
        .in('created_by', connectedUserIds)
        .order('created_at', { ascending: false })
        .limit(10)

      if (!connectedFilesError && connectedFiles) {
        connectedFiles.forEach((file: any) => {
          if (file.projects) {
            activities.push({
              id: `connected-file-${file.id}`,
              type: 'file_uploaded',
              title: 'File Uploaded',
              description: `${file.users?.username || 'A connection'} added "${file.file_name}" to "${file.projects.title}"`,
              timestamp: formatTimestamp(file.created_at),
              icon: 'cloud-upload',
              color: '#3B82F6',
              project_id: file.projects.id,
              from_connection: true,
              user_id: file.created_by,
              username: file.users?.username,
            })
          }
        })
      }
    }

    // Sort all activities with priority for connections
    const sortedActivities = activities
      .sort((a, b) => {
        const dateA = new Date(a.timestamp).getTime()
        const dateB = new Date(b.timestamp).getTime()

        // If timestamps are within 1 hour of each other, prioritize connections
        if (Math.abs(dateA - dateB) < 3600000) {
          if (a.from_connection && !b.from_connection) return -1
          if (!a.from_connection && b.from_connection) return 1
        }

        // Otherwise sort by timestamp
        return dateB - dateA
      })
      .slice(0, limit)

    return sortedActivities
  } catch (error) {
    if (__DEV__) console.error('Error loading activity feed:', error)
    throw error
  }
}

/**
 * Get user statistics for dashboard
 */
export const getUserStats = async (userId: string): Promise<UserStats> => {
  try {
    // First, get user's project IDs for the collaborators query
    const { data: userProjects } = await supabase
      .from('projects')
      .select('id')
      .eq('creator_id', userId)
      .neq('status', 'deleted')

    const projectIds = userProjects?.map(p => p.id) || []

    // Load all stats in parallel
    const [projectsCount, collabsCount, filesCount, collaboratorsData] = await Promise.all([
      // Count projects created by user
      supabase
        .from('projects')
        .select('*', { count: 'exact', head: true })
        .eq('creator_id', userId)
        .neq('status', 'deleted'),

      // Count projects where user is a collaborator (not owner)
      supabase
        .from('project_collaborators')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('invitation_status', 'accepted')
        .neq('role', 'owner'),

      // Count files uploaded by user
      supabase
        .from('audio_files')
        .select('*', { count: 'exact', head: true })
        .eq('creator_id', userId),

      // Get unique collaborators on user's projects
      projectIds.length > 0
        ? supabase
            .from('project_collaborators')
            .select('user_id')
            .in('project_id', projectIds)
            .eq('invitation_status', 'accepted')
        : { data: [] }
    ])

    const uniqueCollaborators = new Set(collaboratorsData.data?.map((c: any) => c.user_id) || [])

    return {
      projectsCreated: projectsCount.count || 0,
      collaborations: collabsCount.count || 0,
      filesUploaded: filesCount.count || 0,
      totalCollaborators: uniqueCollaborators.size,
    }
  } catch (error) {
    if (__DEV__) console.error('Error loading user stats:', error)
    return {
      projectsCreated: 0,
      collaborations: 0,
      filesUploaded: 0,
      totalCollaborators: 0,
    }
  }
}

/**
 * Format timestamp to relative time (e.g., "2 hours ago")
 */
function formatTimestamp(timestamp: string): string {
  const now = new Date()
  const then = new Date(timestamp)
  const diffMs = now.getTime() - then.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins} ${diffMins === 1 ? 'minute' : 'minutes'} ago`
  if (diffHours < 24) return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`
  if (diffDays < 7) return `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} ${Math.floor(diffDays / 7) === 1 ? 'week' : 'weeks'} ago`

  return then.toLocaleDateString()
}

/**
 * Log activity (for future use if you want to create an activities table)
 */
export const logActivity = async (
  userId: string,
  activityType: ActivityItem['activity_type'],
  metadata: ActivityItem['metadata'],
  projectId?: string,
  audioFileId?: string,
  targetUserId?: string
): Promise<void> => {
  // This is a stub for future implementation
  // You could create an 'activities' table in Supabase to track all activities
  // For now, we derive activities from existing tables
  if (__DEV__) console.log('Activity logged:', { userId, activityType, metadata })
}
