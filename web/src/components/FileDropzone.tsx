'use client'

import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'

interface FileDropzoneProps {
  onFilesSelected: (files: File[]) => void
  disabled?: boolean
}

const ALLOWED_EXTENSIONS = ['.wav', '.mp3', '.flac', '.aiff', '.aif', '.m4a', '.mp4', '.aac', '.ogg', '.opus']

export default function FileDropzone({ onFilesSelected, disabled }: FileDropzoneProps) {
  const [dragError, setDragError] = useState<string | null>(null)

  const onDrop = useCallback((acceptedFiles: File[], rejectedFiles: any[]) => {
    setDragError(null)

    if (rejectedFiles.length > 0) {
      setDragError('Some files were rejected. Please use supported audio formats.')
      return
    }

    if (acceptedFiles.length > 0) {
      onFilesSelected(acceptedFiles)
    }
  }, [onFilesSelected])

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    accept: {
      'audio/*': ALLOWED_EXTENSIONS,
    },
    disabled,
    maxSize: 500 * 1024 * 1024, // 500 MB
  })

  return (
    <div
      {...getRootProps()}
      className={`
        card p-8 text-center cursor-pointer transition-all
        ${isDragActive && !isDragReject ? 'border-[#6366F1] bg-[#6366F1]/5' : ''}
        ${isDragReject ? 'border-[#EF4444] bg-[#EF4444]/5' : ''}
        ${!isDragActive && !isDragReject ? 'hover:border-[#6366F1]/50' : ''}
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
      `}
    >
      <input {...getInputProps()} />

      <div className="flex flex-col items-center">
        {/* Logo Wordmark */}
        <div className={`
          w-20 h-20 rounded-xl flex items-center justify-center mb-5 transition-all
          ${isDragActive
            ? 'bg-[#6366F1] scale-110'
            : 'bg-[#1A1A1A] border border-[#404040]'
          }
        `}>
          <img
            src="/logo-wordmark.png"
            alt=""
            className={`h-12 w-auto transition-all ${isDragActive ? 'brightness-0 invert' : ''}`}
          />
        </div>

        {/* Text */}
        {isDragActive ? (
          <div>
            <p className="text-lg font-semibold text-[#6366F1]">Drop to add files</p>
            <p className="text-sm text-[#8B8B8B] mt-1">Release to upload</p>
          </div>
        ) : isDragReject ? (
          <div>
            <p className="text-lg font-semibold text-[#EF4444]">Invalid file type</p>
            <p className="text-sm text-[#F87171] mt-1">Please use supported audio formats</p>
          </div>
        ) : (
          <>
            <p className="text-lg font-semibold text-white mb-1">
              Drop audio files here
            </p>
            <p className="text-[#8B8B8B] text-sm mb-5">
              or <span className="text-[#6366F1]">browse from your computer</span>
            </p>

            {/* Supported formats badges */}
            <div className="flex flex-wrap justify-center gap-2 max-w-md">
              {['WAV', 'MP3', 'FLAC', 'AIFF', 'AAC', 'M4A', 'OGG'].map(format => (
                <span
                  key={format}
                  className="px-2 py-1 bg-[#1A1A1A] border border-[#404040] rounded text-xs text-[#8B8B8B]"
                >
                  {format}
                </span>
              ))}
            </div>

            <p className="text-xs text-[#8B8B8B] mt-4">
              Maximum file size: 500 MB
            </p>
          </>
        )}

        {dragError && (
          <div className="mt-5 flex items-center gap-2 px-3 py-2 bg-[#EF4444]/10 border border-[#EF4444]/20 rounded-lg animate-slide-up">
            <svg className="w-4 h-4 text-[#F87171] flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <p className="text-sm text-[#F87171]">{dragError}</p>
          </div>
        )}
      </div>
    </div>
  )
}
