'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function SessionPage() {
  const params = useParams()
  const router = useRouter()
  const token = params.token as string

  const [status, setStatus] = useState<'validating' | 'success' | 'error' | 'expired'>('validating')
  const [errorMessage, setErrorMessage] = useState('')
  const [projectId, setProjectId] = useState<string | null>(null)

  useEffect(() => {
    async function validateSession() {
      if (!token) {
        setStatus('error')
        setErrorMessage('No session token provided')
        return
      }

      try {
        // Validate the session token
        const { data, error } = await supabase
          .rpc('validate_upload_session', { p_token: token })

        if (error) {
          console.error('Error validating session:', error)
          setStatus('error')
          setErrorMessage('Failed to validate session')
          return
        }

        if (!data || data.length === 0) {
          setStatus('error')
          setErrorMessage('Invalid session link')
          return
        }

        const session = data[0]

        if (!session.is_valid) {
          setStatus('expired')
          setErrorMessage('This link has expired or has already been used')
          return
        }

        // Mark the session as used
        await supabase.rpc('mark_upload_session_used', { p_token: token })

        // Store the session info for the upload page
        if (typeof window !== 'undefined') {
          localStorage.setItem('kollab_session_user_id', session.user_id)
          if (session.project_id) {
            localStorage.setItem('kollab_session_project_id', session.project_id)
            setProjectId(session.project_id)
          }
        }

        setStatus('success')

        // Redirect to upload page after a brief success message
        setTimeout(() => {
          const uploadUrl = session.project_id
            ? `/upload?project=${session.project_id}&from=session`
            : '/upload?from=session'
          router.push(uploadUrl)
        }, 1500)

      } catch (err) {
        console.error('Session validation error:', err)
        setStatus('error')
        setErrorMessage('An unexpected error occurred')
      }
    }

    validateSession()
  }, [token, router])

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        {/* Logo */}
        <div className="mb-8">
          <img
            src="/favicon.png"
            alt="Kollab"
            className="h-16 w-auto mx-auto"
          />
        </div>

        {status === 'validating' && (
          <div className="space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500 mx-auto"></div>
            <h1 className="text-xl font-semibold text-white">
              Verifying your session...
            </h1>
            <p className="text-gray-400">
              Please wait while we connect you to the uploader
            </p>
          </div>
        )}

        {status === 'success' && (
          <div className="space-y-4">
            <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-xl font-semibold text-white">
              Connected!
            </h1>
            <p className="text-gray-400">
              Redirecting to the uploader...
            </p>
          </div>
        )}

        {status === 'expired' && (
          <div className="space-y-4">
            <div className="w-16 h-16 bg-yellow-500/20 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-8 h-8 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h1 className="text-xl font-semibold text-white">
              Link Expired
            </h1>
            <p className="text-gray-400 mb-4">
              {errorMessage}
            </p>
            <p className="text-gray-500 text-sm">
              Generate a new link from the Kollab app on your phone, or login directly below.
            </p>
            <button
              onClick={() => router.push('/upload')}
              className="mt-4 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors"
            >
              Go to Login
            </button>
          </div>
        )}

        {status === 'error' && (
          <div className="space-y-4">
            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h1 className="text-xl font-semibold text-white">
              Invalid Link
            </h1>
            <p className="text-gray-400 mb-4">
              {errorMessage}
            </p>
            <button
              onClick={() => router.push('/upload')}
              className="mt-4 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors"
            >
              Go to Login
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
