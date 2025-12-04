// @ts-nocheck
import { supabase } from '../lib/supabase'
import { Comment, CommentWithUser } from '../types/database.types'

export interface CreateCommentData {
  projectId: string
  audioFileId?: string
  userId: string
  content: string
  timestampMs?: number
  endTimestampMs?: number
  parentCommentId?: string
}

class CommentService {
  async createComment(data: CreateCommentData): Promise<{
    comment: CommentWithUser | null
    error: Error | null
  }> {
    try {
      const { data: comment, error } = await supabase
        .from('comments')
        .insert({
          project_id: data.projectId,
          audio_file_id: data.audioFileId,
          user_id: data.userId,
          content: data.content,
          timestamp_ms: data.timestampMs,
          end_timestamp_ms: data.endTimestampMs,
          parent_comment_id: data.parentCommentId,
        })
        .select(`
          *,
          user:users!comments_user_id_fkey(
            id,
            username,
            display_name,
            avatar_url
          )
        `)
        .single()

      if (error) throw error

      return { comment: comment as CommentWithUser, error: null }
    } catch (error) {
      return { comment: null, error: error as Error }
    }
  }

  async getProjectComments(projectId: string): Promise<{
    comments: CommentWithUser[]
    error: Error | null
  }> {
    try {
      const { data, error } = await supabase
        .from('comments')
        .select(`
          *,
          user:users!comments_user_id_fkey(
            id,
            username,
            display_name,
            avatar_url
          )
        `)
        .eq('project_id', projectId)
        .is('audio_file_id', null)
        .is('parent_comment_id', null)
        .order('created_at', { ascending: false })

      if (error) throw error

      return { comments: data as CommentWithUser[], error: null }
    } catch (error) {
      return { comments: [], error: error as Error }
    }
  }

  async getAudioFileComments(audioFileId: string): Promise<{
    comments: CommentWithUser[]
    error: Error | null
  }> {
    try {
      const { data, error } = await supabase
        .from('comments')
        .select(`
          *,
          user:users!comments_user_id_fkey(
            id,
            username,
            display_name,
            avatar_url
          )
        `)
        .eq('audio_file_id', audioFileId)
        .is('parent_comment_id', null)
        .order('timestamp_ms', { ascending: true, nullsFirst: false })

      if (error) throw error

      return { comments: data as CommentWithUser[], error: null }
    } catch (error) {
      return { comments: [], error: error as Error }
    }
  }

  async getCommentReplies(parentCommentId: string): Promise<{
    replies: CommentWithUser[]
    error: Error | null
  }> {
    try {
      const { data, error } = await supabase
        .from('comments')
        .select(`
          *,
          user:users!comments_user_id_fkey(
            id,
            username,
            display_name,
            avatar_url
          )
        `)
        .eq('parent_comment_id', parentCommentId)
        .order('created_at', { ascending: true })

      if (error) throw error

      return { replies: data as CommentWithUser[], error: null }
    } catch (error) {
      return { replies: [], error: error as Error }
    }
  }

  async getTimeStampedComments(audioFileId: string): Promise<{
    comments: CommentWithUser[]
    error: Error | null
  }> {
    try {
      const { data, error } = await supabase
        .from('comments')
        .select(`
          *,
          user:users!comments_user_id_fkey(
            id,
            username,
            display_name,
            avatar_url
          )
        `)
        .eq('audio_file_id', audioFileId)
        .not('timestamp_ms', 'is', null)
        .is('parent_comment_id', null)
        .order('timestamp_ms', { ascending: true })

      if (error) throw error

      return { comments: data as CommentWithUser[], error: null }
    } catch (error) {
      return { comments: [], error: error as Error }
    }
  }

  async updateComment(
    commentId: string,
    content: string
  ): Promise<{ comment: Comment | null; error: Error | null }> {
    try {
      const { data, error } = await supabase
        .from('comments')
        .update({ content })
        .eq('id', commentId)
        .select()
        .single()

      if (error) throw error

      return { comment: data, error: null }
    } catch (error) {
      return { comment: null, error: error as Error }
    }
  }

  async resolveComment(
    commentId: string,
    resolvedBy: string
  ): Promise<{ error: Error | null }> {
    try {
      const { error } = await supabase
        .from('comments')
        .update({
          resolved: true,
          resolved_by: resolvedBy,
          resolved_at: new Date().toISOString(),
        })
        .eq('id', commentId)

      if (error) throw error

      return { error: null }
    } catch (error) {
      return { error: error as Error }
    }
  }

  async deleteComment(commentId: string): Promise<{ error: Error | null }> {
    try {
      const { error } = await supabase
        .from('comments')
        .delete()
        .eq('id', commentId)

      if (error) throw error

      return { error: null }
    } catch (error) {
      return { error: error as Error }
    }
  }

  subscribeToAudioFileComments(
    audioFileId: string,
    onNewComment: (comment: CommentWithUser) => void
  ) {
    const subscription = supabase
      .channel(`comments:${audioFileId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'comments',
          filter: `audio_file_id=eq.${audioFileId}`,
        },
        async (payload) => {
          const { data: user } = await supabase
            .from('users')
            .select('id, username, display_name, avatar_url')
            .eq('id', (payload.new as Comment).user_id)
            .single()

          if (user) {
            onNewComment({
              ...(payload.new as Comment),
              user,
            })
          }
        }
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }

  subscribeToProjectComments(
    projectId: string,
    onNewComment: (comment: CommentWithUser) => void
  ) {
    const subscription = supabase
      .channel(`project-comments:${projectId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'comments',
          filter: `project_id=eq.${projectId}`,
        },
        async (payload) => {
          const { data: user } = await supabase
            .from('users')
            .select('id, username, display_name, avatar_url')
            .eq('id', (payload.new as Comment).user_id)
            .single()

          if (user) {
            onNewComment({
              ...(payload.new as Comment),
              user,
            })
          }
        }
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }

  formatTimestamp(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  getCommentPosition(timestampMs: number, durationMs: number): number {
    if (durationMs === 0) return 0
    return (timestampMs / durationMs) * 100
  }
}

export const commentService = new CommentService()