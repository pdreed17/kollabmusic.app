import { supabase } from '../lib/supabase'
import { Project, ProjectWithCreator, Collaborator } from '../types/database.types'

export interface CreateProjectData {
  title: string
  description?: string
  genre?: string
  bpm?: number
  key?: string
  timeSignature?: string
  isPublic?: boolean
}

class ProjectService {
  async createProject(data: CreateProjectData, creatorId: string): Promise<{
    project: Project | null
    error: Error | null
  }> {
    try {
      const { data: project, error } = await supabase
        .from('projects')
        .insert({
          creator_id: creatorId,
          title: data.title,
          description: data.description,
          genre: data.genre,
          bpm: data.bpm,
          key: data.key,
          time_signature: data.timeSignature || '4/4',
          is_public: data.isPublic || false,
        })
        .select()
        .single()

      if (error) throw error

      await supabase.from('collaborators').insert({
        project_id: project.id,
        user_id: creatorId,
        role: 'owner',
        can_edit: true,
        can_delete: true,
        can_invite: true,
        can_upload: true,
        can_comment: true,
        can_download: true,
      })

      return { project, error: null }
    } catch (error) {
      return { project: null, error: error as Error }
    }
  }

  async getUserProjects(userId: string): Promise<{
    projects: ProjectWithCreator[]
    error: Error | null
  }> {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select(`
          *,
          creator:users!projects_creator_id_fkey(
            id,
            username,
            display_name,
            avatar_url
          )
        `)
        .or(`creator_id.eq.${userId},collaborators.user_id.eq.${userId}`)
        .eq('status', 'active')
        .order('updated_at', { ascending: false })

      if (error) throw error

      return { projects: data as ProjectWithCreator[], error: null }
    } catch (error) {
      return { projects: [], error: error as Error }
    }
  }

  async getProject(projectId: string): Promise<{
    project: ProjectWithCreator | null
    error: Error | null
  }> {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select(`
          *,
          creator:users!projects_creator_id_fkey(
            id,
            username,
            display_name,
            avatar_url
          )
        `)
        .eq('id', projectId)
        .single()

      if (error) throw error

      return { project: data as ProjectWithCreator, error: null }
    } catch (error) {
      return { project: null, error: error as Error }
    }
  }

  async updateProject(
    projectId: string,
    updates: Partial<Project>
  ): Promise<{ project: Project | null; error: Error | null }> {
    try {
      const { data, error } = await supabase
        .from('projects')
        .update(updates)
        .eq('id', projectId)
        .select()
        .single()

      if (error) throw error

      return { project: data, error: null }
    } catch (error) {
      return { project: null, error: error as Error }
    }
  }

  async deleteProject(projectId: string): Promise<{ error: Error | null }> {
    try {
      const { error } = await supabase
        .from('projects')
        .update({ status: 'deleted' })
        .eq('id', projectId)

      if (error) throw error

      return { error: null }
    } catch (error) {
      return { error: error as Error }
    }
  }

  async inviteCollaborator(
    projectId: string,
    userId: string,
    role: Collaborator['role'],
    invitedBy: string
  ): Promise<{ error: Error | null }> {
    try {
      const permissions = this.getRolePermissions(role)

      const { error } = await supabase.from('collaborators').insert({
        project_id: projectId,
        user_id: userId,
        role,
        ...permissions,
        invited_by: invitedBy,
        invitation_status: 'pending',
      })

      if (error) throw error

      return { error: null }
    } catch (error) {
      return { error: error as Error }
    }
  }

  private getRolePermissions(role: Collaborator['role']) {
    const permissions = {
      owner: {
        can_edit: true,
        can_delete: true,
        can_invite: true,
        can_upload: true,
        can_comment: true,
        can_download: true,
      },
      admin: {
        can_edit: true,
        can_delete: false,
        can_invite: true,
        can_upload: true,
        can_comment: true,
        can_download: true,
      },
      editor: {
        can_edit: true,
        can_delete: false,
        can_invite: false,
        can_upload: true,
        can_comment: true,
        can_download: true,
      },
      commenter: {
        can_edit: false,
        can_delete: false,
        can_invite: false,
        can_upload: false,
        can_comment: true,
        can_download: false,
      },
      viewer: {
        can_edit: false,
        can_delete: false,
        can_invite: false,
        can_upload: false,
        can_comment: false,
        can_download: false,
      },
    }

    return permissions[role as keyof typeof permissions]
  }
}

export const projectService = new ProjectService()