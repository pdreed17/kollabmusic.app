import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import '../styles/ProjectSelector.css'

interface Project {
  id: string
  name: string
  description: string | null
  created_at: string
}

interface ProjectSelectorProps {
  onProjectSelect: (projectId: string, projectName: string) => void
  onSignOut: () => void
}

export const ProjectSelector: React.FC<ProjectSelectorProps> = ({ 
  onProjectSelect,
  onSignOut 
}) => {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState('')

  useEffect(() => {
    loadProjects()
  }, [])

  const loadProjects = async () => {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      setUserEmail(user.email || '')

      // Fetch projects where user is creator
      const { data: ownedProjects, error: ownedError } = await supabase
        .from('projects')
        .select('id, name, description, created_at')
        .eq('creator_id', user.id)

      if (ownedError) throw ownedError

      // Fetch projects where user is a collaborator
      const { data: collaboratorData, error: collabError } = await supabase
        .from('project_collaborators')
        .select('projects(id, name, description, created_at)')
        .eq('user_id', user.id)

      if (collabError) throw collabError

      // Combine owned and collaborated projects
      const collaboratedProjects = collaboratorData
        ?.map(item => item.projects)
        .filter(Boolean) || []

      const allProjects = [...(ownedProjects || []), ...collaboratedProjects]

      // Remove duplicates and sort by created_at
      const uniqueProjects = Array.from(
        new Map(allProjects.map(p => [p.id, p])).values()
      ).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

      setProjects(uniqueProjects)
    } catch (err: any) {
      setError(err.message || 'Failed to load projects')
    } finally {
      setLoading(false)
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    onSignOut()
  }

  if (loading) {
    return (
      <div className="project-selector-container">
        <div className="loading">Loading your projects...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="project-selector-container">
        <div className="error-state">
          <h2>Error</h2>
          <p>{error}</p>
          <button onClick={loadProjects}>Try Again</button>
        </div>
      </div>
    )
  }

  return (
    <div className="project-selector-container">
      <div className="project-selector-header">
        <div>
          <h1>Kollab Music</h1>
          <p className="user-email">{userEmail}</p>
        </div>
        <button onClick={handleSignOut} className="sign-out-btn">
          Sign Out
        </button>
      </div>

      <div className="project-selector-content">
        <div className="section-header">
          <h2>Select a Project</h2>
          <p>Choose which project to upload files to</p>
        </div>

        {projects.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🎵</div>
            <h3>No Projects Yet</h3>
            <p>Create a project in the mobile app first, then come back here to upload files.</p>
          </div>
        ) : (
          <div className="projects-grid">
            {projects.map((project) => (
              <div 
                key={project.id}
                className="project-card"
                onClick={() => onProjectSelect(project.id, project.name)}
              >
                <div className="project-icon">🎵</div>
                <div className="project-info">
                  <h3>{project.name}</h3>
                  {project.description && (
                    <p className="project-description">{project.description}</p>
                  )}
                  <p className="project-date">
                    Created {new Date(project.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="project-arrow">→</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
