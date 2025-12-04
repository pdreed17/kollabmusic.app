import React, { useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import '../styles/FileUpload.css'

interface FileUploadProps {
  projectId: string
  projectName: string
  onBack: () => void
}

interface UploadFile {
  file: File
  progress: number
  status: 'pending' | 'uploading' | 'success' | 'error'
  error?: string
  filePath?: string
  publicUrl?: string
}

export const FileUpload: React.FC<FileUploadProps> = ({
  projectId,
  projectName,
  onBack
}) => {
  const [files, setFiles] = useState<UploadFile[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const droppedFiles = Array.from(e.dataTransfer.files).filter(file =>
      file.type.startsWith('audio/')
    )

    if (droppedFiles.length > 0) {
      addFiles(droppedFiles)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files)
      addFiles(selectedFiles)
    }
  }

  const addFiles = (newFiles: File[]) => {
    const uploadFiles: UploadFile[] = newFiles.map(file => ({
      file,
      progress: 0,
      status: 'pending' as const
    }))

    setFiles(prev => [...prev, ...uploadFiles])

    // Start uploading each file
    uploadFiles.forEach((uploadFile, index) => {
      uploadFile_(uploadFile.file, files.length + index)
    })
  }

  const uploadFile_ = async (file: File, index: number) => {
    try {
      // Update status to uploading
      setFiles(prev => {
        const newFiles = [...prev]
        newFiles[index] = { ...newFiles[index], status: 'uploading', progress: 0 }
        return newFiles
      })

      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // Generate unique file path
      const timestamp = Date.now()
      const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const filePath = `${user.id}/${projectId}/${timestamp}_${sanitizedName}`

      // Upload to Supabase Storage with progress tracking
      const { error: uploadError } = await supabase.storage
        .from('audio-files')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        })

      if (uploadError) throw uploadError

      // Simulate progress (Supabase doesn't provide upload progress yet)
      for (let i = 0; i <= 100; i += 20) {
        setFiles(prev => {
          const newFiles = [...prev]
          if (newFiles[index]) {
            newFiles[index] = { ...newFiles[index], progress: i }
          }
          return newFiles
        })
        await new Promise(resolve => setTimeout(resolve, 200))
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('audio-files')
        .getPublicUrl(filePath)

      // Create audio_files record
      const { error: dbError } = await supabase
        .from('audio_files')
        .insert({
          project_id: projectId,
          file_name: file.name,
          file_path: filePath,
          file_url: publicUrl,
          file_size: file.size,
          mime_type: file.type,
          uploaded_by: user.id,
          stem_type: 'full_mix'
        })

      if (dbError) throw dbError

      // Update status to success and store file info
      setFiles(prev => {
        const newFiles = [...prev]
        if (newFiles[index]) {
          newFiles[index] = {
            ...newFiles[index],
            status: 'success',
            progress: 100,
            filePath,
            publicUrl
          }
        }
        return newFiles
      })
    } catch (err: any) {
      console.error('Upload error:', err)
      setFiles(prev => {
        const newFiles = [...prev]
        if (newFiles[index]) {
          newFiles[index] = {
            ...newFiles[index],
            status: 'error',
            error: err.message || 'Upload failed'
          }
        }
        return newFiles
      })
    }
  }

  const clearCompleted = () => {
    setFiles(prev => prev.filter(f => f.status !== 'success'))
  }

  const downloadFile = (uploadFile: UploadFile) => {
    if (!uploadFile.publicUrl || !uploadFile.filePath) return

    // Create a temporary anchor element and trigger download
    const link = document.createElement('a')
    link.href = uploadFile.publicUrl
    link.download = uploadFile.file.name
    link.target = '_blank'
    link.rel = 'noopener noreferrer'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const successCount = files.filter(f => f.status === 'success').length
  const errorCount = files.filter(f => f.status === 'error').length

  return (
    <div className="file-upload-container">
      <div className="file-upload-header">
        <button onClick={onBack} className="back-btn">← Back</button>
        <div>
          <h1>{projectName}</h1>
          <p>Upload audio files to this project</p>
        </div>
      </div>

      <div className="file-upload-content">
        <div
          className={`drop-zone ${isDragging ? 'dragging' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="drop-zone-icon">📁</div>
          <h3>Drag & Drop Audio Files</h3>
          <p>or click to browse</p>
          <p className="drop-zone-hint">Supports MP3, WAV, M4A, OGG, FLAC</p>
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            multiple
            style={{ display: 'none' }}
            onChange={handleFileSelect}
          />
        </div>

        {files.length > 0 && (
          <div className="files-section">
            <div className="files-header">
              <h2>Uploads ({files.length})</h2>
              {successCount > 0 && (
                <button onClick={clearCompleted} className="clear-btn">
                  Clear Completed
                </button>
              )}
            </div>

            {successCount > 0 && (
              <div className="stats">
                <span className="stat-success">✓ {successCount} uploaded</span>
                {errorCount > 0 && (
                  <span className="stat-error">✗ {errorCount} failed</span>
                )}
              </div>
            )}

            <div className="files-list">
              {files.map((uploadFile, index) => (
                <div key={index} className={`file-item ${uploadFile.status}`}>
                  <div className="file-info">
                    <div className="file-name">{uploadFile.file.name}</div>
                    <div className="file-size">
                      {(uploadFile.file.size / 1024 / 1024).toFixed(2)} MB
                    </div>
                  </div>

                  {uploadFile.status === 'uploading' && (
                    <div className="file-progress">
                      <div
                        className="file-progress-bar"
                        style={{ width: `${uploadFile.progress}%` }}
                      />
                      <span className="file-progress-text">{uploadFile.progress}%</span>
                    </div>
                  )}

                  {uploadFile.status === 'success' && (
                    <div className="file-actions">
                      <div className="file-status success">✓ Uploaded</div>
                      <button
                        onClick={() => downloadFile(uploadFile)}
                        className="download-file-btn"
                        title="Download file"
                      >
                        ⬇ Download
                      </button>
                    </div>
                  )}

                  {uploadFile.status === 'error' && (
                    <div className="file-status error">
                      ✗ {uploadFile.error || 'Failed'}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
