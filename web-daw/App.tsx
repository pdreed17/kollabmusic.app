/**
 * Kollab Music Desktop Companion
 *
 * Web application for easily uploading audio files from desktop to mobile app.
 */

import React, { useState, useEffect } from 'react'
import { supabase } from './src/lib/supabase'
import { Auth } from './src/components/Auth'
import { ProjectSelector } from './src/components/ProjectSelector'
import { FileUpload } from './src/components/FileUpload'
import './App.css'

type Screen = 'auth' | 'projects' | 'upload'

const App: React.FC = () => {
  const [currentScreen, setCurrentScreen] = useState<Screen>('auth')
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [loading, setLoading] = useState(true)
  const [selectedProject, setSelectedProject] = useState<{id: string, name: string} | null>(null)

  useEffect(() => {
    // Check if user is already logged in
    checkAuth()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(!!session)
      if (session) {
        setCurrentScreen('projects')
      } else {
        setCurrentScreen('auth')
        setSelectedProject(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const checkAuth = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      setIsAuthenticated(!!session)
      if (session) {
        setCurrentScreen('projects')
      }
    } catch (error) {
      console.error('Auth check error:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAuthSuccess = () => {
    setIsAuthenticated(true)
    setCurrentScreen('projects')
  }

  const handleProjectSelect = (projectId: string, projectName: string) => {
    setSelectedProject({ id: projectId, name: projectName })
    setCurrentScreen('upload')
  }

  const handleBack = () => {
    setSelectedProject(null)
    setCurrentScreen('projects')
  }

  const handleSignOut = () => {
    setIsAuthenticated(false)
    setCurrentScreen('auth')
    setSelectedProject(null)
  }

  if (loading) {
    return (
      <div className="app-container">
        <div className="loading-screen">
          <h2>Loading...</h2>
        </div>
      </div>
    )
  }

  return (
    <div className="app-container">
      {currentScreen === 'auth' && (
        <Auth onAuthSuccess={handleAuthSuccess} />
      )}

      {currentScreen === 'projects' && (
        <ProjectSelector
          onProjectSelect={handleProjectSelect}
          onSignOut={handleSignOut}
        />
      )}

      {currentScreen === 'upload' && selectedProject && (
        <FileUpload
          projectId={selectedProject.id}
          projectName={selectedProject.name}
          onBack={handleBack}
        />
      )}
    </div>
  )
}

export default App