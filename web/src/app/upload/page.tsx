'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, Project, AudioFileRecord, STEM_COLORS } from '@/lib/supabase'
import FileDropzone from '@/components/FileDropzone'
import CreateProjectModal from '@/components/CreateProjectModal'

// Avatar component with error handling
function UserAvatar({ avatarUrl }: { avatarUrl: string | null | undefined }) {
  const [imgError, setImgError] = useState(false)

  if (!avatarUrl || imgError) {
    return (
      <div className="w-7 h-7 rounded-full bg-[#262626] border border-[#404040] flex items-center justify-center">
        <svg className="w-3.5 h-3.5 text-[#8B8B8B]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      </div>
    )
  }

  return (
    <img
      src={avatarUrl}
      alt=""
      className="w-7 h-7 rounded-full object-cover border border-[#404040]"
      onError={() => setImgError(true)}
    />
  )
}

type StemType = 'vocals' | 'drums' | 'bass' | 'guitar' | 'keys' | 'synth' | 'fx' | 'multiple' | 'other'

const STEM_TYPES: { value: StemType; label: string; color: string }[] = [
  { value: 'vocals', label: 'Vocals', color: '#F59E0B' },
  { value: 'drums', label: 'Drums', color: '#EF4444' },
  { value: 'bass', label: 'Bass', color: '#8B5CF6' },
  { value: 'guitar', label: 'Guitar', color: '#10B981' },
  { value: 'keys', label: 'Keys/Piano', color: '#3B82F6' },
  { value: 'synth', label: 'Synth', color: '#EC4899' },
  { value: 'multiple', label: 'Multiple', color: '#6366F1' },
  { value: 'fx', label: 'FX', color: '#14B8A6' },
  { value: 'other', label: 'Other', color: '#9CA3AF' },
]

interface ProjectWithMeta extends Project {
  isOwner: boolean
  fileCount: number
}

interface QueuedFile {
  file: File
  stemName: string
  stemType: StemType
  progress: number
  status: 'pending' | 'uploading' | 'done' | 'error'
  error?: string
}

interface UserProfile {
  id: string
  username: string | null
  display_name: string | null
  avatar_url: string | null
}

export default function UploadPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [projects, setProjects] = useState<ProjectWithMeta[]>([])
  const [selectedProject, setSelectedProject] = useState<string>('')
  const [queuedFiles, setQueuedFiles] = useState<QueuedFile[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/')
        return
      }
      setUser(session.user)
      await Promise.all([
        loadProjects(session.user.id),
        loadUserProfile(session.user.id)
      ])
      setLoading(false)
    }
    checkAuth()
  }, [router])

  const loadUserProfile = async (userId: string) => {
    const { data } = await supabase
      .from('users')
      .select('id, username, display_name, avatar_url')
      .eq('id', userId)
      .single()

    if (data) {
      setUserProfile(data)
    }
  }

  const loadProjects = async (userId: string) => {
    // Get projects where user is creator
    const { data: ownProjects } = await supabase
      .from('projects')
      .select('id, title, description, creator_id')
      .eq('creator_id', userId)

    // Get projects where user is collaborator
    const { data: collabProjects } = await supabase
      .from('project_collaborators')
      .select('project_id, projects(id, title, description, creator_id)')
      .eq('user_id', userId)
      .eq('status', 'accepted')

    const collabProjectsList: Project[] = (collabProjects || [])
      .map(c => c.projects as unknown as Project)
      .filter((p): p is Project => p !== null && p !== undefined)

    // Combine and mark ownership
    const ownProjectsWithMeta: ProjectWithMeta[] = (ownProjects || []).map(p => ({
      ...p,
      isOwner: true,
      fileCount: 0
    }))

    const collabProjectsWithMeta: ProjectWithMeta[] = collabProjectsList.map(p => ({
      ...p,
      isOwner: false,
      fileCount: 0
    }))

    // Remove duplicates (in case user is both owner and collaborator somehow)
    const allProjects = [...ownProjectsWithMeta, ...collabProjectsWithMeta]
    const uniqueProjects = allProjects.filter((project, index, self) =>
      index === self.findIndex(p => p.id === project.id)
    )

    // Get file counts for each project
    const projectIds = uniqueProjects.map(p => p.id)
    if (projectIds.length > 0) {
      const { data: fileCounts } = await supabase
        .from('audio_files')
        .select('project_id')
        .in('project_id', projectIds)

      if (fileCounts) {
        const countMap: Record<string, number> = {}
        fileCounts.forEach(f => {
          countMap[f.project_id] = (countMap[f.project_id] || 0) + 1
        })

        uniqueProjects.forEach(p => {
          p.fileCount = countMap[p.id] || 0
        })
      }
    }

    // Sort: owned projects first, then by title
    uniqueProjects.sort((a, b) => {
      if (a.isOwner && !b.isOwner) return -1
      if (!a.isOwner && b.isOwner) return 1
      return a.title.localeCompare(b.title)
    })

    setProjects(uniqueProjects)
    if (uniqueProjects.length > 0) {
      setSelectedProject(uniqueProjects[0].id)
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  const handleProjectCreated = async (projectId: string) => {
    // Reload projects to include the new one
    if (user) {
      await loadProjects(user.id)
      // Select the newly created project
      setSelectedProject(projectId)
    }
  }

  const handleFilesSelected = (files: File[]) => {
    const newFiles: QueuedFile[] = files.map(file => ({
      file,
      stemName: file.name.replace(/\.[^/.]+$/, ''), // Remove extension
      stemType: 'other' as StemType,
      progress: 0,
      status: 'pending',
    }))
    setQueuedFiles(prev => [...prev, ...newFiles])
  }

  const updateQueuedFile = (index: number, updates: Partial<QueuedFile>) => {
    setQueuedFiles(prev => prev.map((f, i) => i === index ? { ...f, ...updates } : f))
  }

  const removeQueuedFile = (index: number) => {
    setQueuedFiles(prev => prev.filter((_, i) => i !== index))
  }

  const uploadFile = async (queuedFile: QueuedFile, index: number) => {
    const { file, stemName, stemType } = queuedFile

    try {
      updateQueuedFile(index, { status: 'uploading', progress: 10 })

      // Generate unique filename
      const fileExt = file.name.split('.').pop()
      const timestamp = Date.now()
      const fileName = `${timestamp}_${stemName.replace(/[^a-zA-Z0-9]/g, '_')}.${fileExt}`
      const filePath = `${selectedProject}/stems/${fileName}`

      updateQueuedFile(index, { progress: 30 })

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('audio-files')
        .upload(filePath, file, {
          contentType: file.type || 'audio/mpeg',
          upsert: false,
        })

      if (uploadError) throw uploadError

      updateQueuedFile(index, { progress: 70 })

      // Insert into database
      const record: AudioFileRecord = {
        project_id: selectedProject,
        file_path: filePath,
        file_name: file.name,
        file_size: file.size,
        file_type: 'audio',
        format: fileExt || 'unknown',
        stem_type: stemType,
        stem_name: stemName,
        duration_ms: null,
        color: STEM_COLORS[stemType] || STEM_COLORS.other,
        volume: 1.0,
        pan: 0.0,
        is_muted: false,
        is_soloed: false,
        created_by: user.id,
      }

      const { error: dbError } = await supabase
        .from('audio_files')
        .insert(record)

      if (dbError) {
        await supabase.storage.from('audio-files').remove([filePath])
        throw dbError
      }

      updateQueuedFile(index, { status: 'done', progress: 100 })

      // Update local file count
      setProjects(prev => prev.map(p =>
        p.id === selectedProject ? { ...p, fileCount: p.fileCount + 1 } : p
      ))
    } catch (error: any) {
      updateQueuedFile(index, {
        status: 'error',
        error: error.message || 'Upload failed'
      })
    }
  }

  const handleUploadAll = async () => {
    if (!selectedProject || queuedFiles.length === 0) return

    setUploading(true)

    for (let i = 0; i < queuedFiles.length; i++) {
      if (queuedFiles[i].status === 'pending') {
        await uploadFile(queuedFiles[i], i)
      }
    }

    setUploading(false)
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const pendingCount = queuedFiles.filter(f => f.status === 'pending').length
  const doneCount = queuedFiles.filter(f => f.status === 'done').length

  const getStemColor = (stemType: StemType) => {
    return STEM_TYPES.find(t => t.value === stemType)?.color || '#6B7280'
  }

  const selectedProjectData = projects.find(p => p.id === selectedProject)

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0F0F0F] flex items-center justify-center">
        <div className="w-10 h-10 spinner" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0F0F0F]">
      {/* Header */}
      <header className="bg-[#1A1A1A] border-b border-[#404040] sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src="/logo-icon.png"
              alt="Kollab"
              className="h-7 w-auto"
            />
            <span className="text-sm text-[#8B8B8B] font-medium">Web Uploader</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <UserAvatar avatarUrl={userProfile?.avatar_url} />
              <span className="text-sm text-[#8B8B8B]">
                {userProfile?.display_name || userProfile?.username || user?.email}
              </span>
            </div>
            <button
              onClick={handleSignOut}
              className="text-sm text-[#8B8B8B] hover:text-white transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-6 py-8">
        <div className="animate-fade-in">
          {/* Page Title */}
          <div className="mb-6">
            <h2 className="text-2xl font-semibold text-white mb-1">Upload Audio</h2>
            <p className="text-[#8B8B8B] text-sm">Drag & drop files from your DAW or computer to kollab on the go</p>
          </div>

          {/* Project Selector */}
          <div className="card p-5 mb-5">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-[#9CA3AF]">
                Select Project
              </label>
              <button
                onClick={() => setShowCreateModal(true)}
                disabled={uploading}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#6366F1] bg-[#6366F1]/10 border border-[#6366F1]/30 rounded-lg hover:bg-[#6366F1]/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                New Project
              </button>
            </div>
            <div className="relative">
              <select
                value={selectedProject}
                onChange={(e) => setSelectedProject(e.target.value)}
                disabled={uploading}
                className="w-full px-4 py-3 bg-[#1A1A1A] border border-[#404040] rounded-lg text-white appearance-none cursor-pointer input-focus disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {projects.length === 0 ? (
                  <option value="">No projects available</option>
                ) : (
                  projects.map(project => (
                    <option key={project.id} value={project.id} className="bg-[#1a1a1a]">
                      {project.title} ({project.isOwner ? 'Owner' : 'Kollab'})
                    </option>
                  ))
                )}
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                <svg className="w-4 h-4 text-[#8B8B8B]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
            {selectedProjectData && (
              <div className="mt-3 flex items-center gap-3">
                <span className={`badge ${selectedProjectData.isOwner ? 'badge-primary' : 'badge-success'}`}>
                  {selectedProjectData.isOwner ? 'Owner' : 'Kollab'}
                </span>
                <span className="text-xs text-[#8B8B8B]">
                  {selectedProjectData.fileCount} audio track{selectedProjectData.fileCount !== 1 ? 's' : ''} in this project
                </span>
              </div>
            )}
          </div>

          {/* Dropzone */}
          <div className="mb-5">
            <FileDropzone
              onFilesSelected={handleFilesSelected}
              disabled={uploading || !selectedProject}
            />
          </div>

          {/* File Queue */}
          {queuedFiles.length > 0 && (
            <div className="card p-5 mb-5 animate-slide-up">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-white">
                    Ready to Upload
                  </h2>
                  <p className="text-sm text-[#8B8B8B] mt-0.5">
                    {queuedFiles.length} file{queuedFiles.length > 1 ? 's' : ''} queued
                  </p>
                </div>
                {doneCount > 0 && (
                  <div className="badge badge-success flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>{doneCount} uploaded</span>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                {queuedFiles.map((qf, index) => (
                  <div
                    key={index}
                    className={`bg-[#1A1A1A] border border-[#404040] rounded-lg p-3 transition-opacity ${
                      qf.status === 'done' ? 'opacity-60' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {/* Stem Color Indicator */}
                      <div
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: getStemColor(qf.stemType) }}
                      />

                      {/* File Info */}
                      <div className="flex-1 min-w-0">
                        <input
                          type="text"
                          value={qf.stemName}
                          onChange={(e) => updateQueuedFile(index, { stemName: e.target.value })}
                          disabled={qf.status !== 'pending'}
                          className="w-full bg-transparent text-white font-medium focus:outline-none disabled:text-[#8B8B8B] text-sm"
                          placeholder="Stem name"
                        />
                        <p className="text-xs text-[#8B8B8B] mt-0.5">
                          {qf.file.name} • {formatFileSize(qf.file.size)}
                        </p>
                      </div>

                      {/* Stem Type */}
                      <select
                        value={qf.stemType}
                        onChange={(e) => updateQueuedFile(index, { stemType: e.target.value as StemType })}
                        disabled={qf.status !== 'pending'}
                        className="px-3 py-2 bg-[#262626] border border-[#404040] rounded-lg text-sm text-white input-focus disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{ borderLeftColor: getStemColor(qf.stemType), borderLeftWidth: '3px' }}
                      >
                        {STEM_TYPES.map(type => (
                          <option key={type.value} value={type.value} className="bg-[#1a1a1a]">
                            {type.label}
                          </option>
                        ))}
                      </select>

                      {/* Status/Remove */}
                      {qf.status === 'pending' && (
                        <button
                          onClick={() => removeQueuedFile(index)}
                          className="p-1.5 text-[#8B8B8B] hover:text-[#EF4444] transition-colors rounded-lg hover:bg-[#EF4444]/10"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                      {qf.status === 'uploading' && (
                        <div className="w-4 h-4 spinner" />
                      )}
                      {qf.status === 'done' && (
                        <div className="w-6 h-6 rounded-full bg-[#10B981]/20 flex items-center justify-center">
                          <svg className="w-3.5 h-3.5 text-[#34D399]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      )}
                    </div>

                    {/* Progress Bar */}
                    {qf.status === 'uploading' && (
                      <div className="mt-3 ml-6">
                        <div className="h-1 bg-[#262626] rounded-full overflow-hidden">
                          <div
                            className="h-full progress-bar rounded-full"
                            style={{ width: `${qf.progress}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Error */}
                    {qf.status === 'error' && (
                      <div className="mt-2 ml-6 flex items-center gap-2 text-[#F87171]">
                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                        <p className="text-xs">{qf.error}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Upload Button */}
              {pendingCount > 0 && (
                <button
                  onClick={handleUploadAll}
                  disabled={uploading || !selectedProject}
                  className="mt-4 w-full py-3 px-6 btn-primary rounded-lg font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {uploading ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 spinner" />
                      Uploading...
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      Upload {pendingCount} File{pendingCount > 1 ? 's' : ''}
                    </span>
                  )}
                </button>
              )}
            </div>
          )}

          {/* How it works */}
          <div className="card p-5">
            <h3 className="font-semibold text-white text-base mb-4">How it works</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[
                { num: '1', text: 'Select your project from the dropdown' },
                { num: '2', text: 'Drag & drop audio files from your DAW or computer' },
                { num: '3', text: 'Set stem names and types for organization' },
                { num: '4', text: 'Click Upload - files sync to your mobile app instantly' },
              ].map((step, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-[#6366F1]/20 text-[#818CF8] text-xs font-medium flex items-center justify-center flex-shrink-0">
                    {step.num}
                  </span>
                  <p className="text-xs text-[#8B8B8B] leading-relaxed">{step.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      {/* Create Project Modal */}
      <CreateProjectModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onProjectCreated={handleProjectCreated}
        userId={user?.id || ''}
      />
    </div>
  )
}
