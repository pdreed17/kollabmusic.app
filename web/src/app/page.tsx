'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [checkingSession, setCheckingSession] = useState(true)

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        router.push('/upload')
      }
      setCheckingSession(false)
    }
    checkSession()
  }, [router])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) throw error
      router.push('/upload')
    } catch (err: any) {
      setError(err.message || 'Failed to sign in')
    } finally {
      setLoading(false)
    }
  }

  if (checkingSession) {
    return (
      <div className="min-h-screen bg-[#0F0F0F] flex items-center justify-center">
        <div className="w-10 h-10 spinner" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0F0F0F] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md animate-fade-in">
        {/* Logo & Header */}
        <div className="text-center mb-8">
          <img
            src="/logo-full.png"
            alt="Kollab"
            className="h-14 w-auto mx-auto mb-4"
          />
          <p className="text-[#8B8B8B] text-base">Web Uploader</p>
        </div>

        {/* Login Card */}
        <div className="card p-6">
          <h2 className="text-xl font-semibold text-white mb-1">Welcome back</h2>
          <p className="text-[#8B8B8B] mb-6 text-sm">Sign in to upload audio to your projects</p>

          {error && (
            <div className="bg-[#EF4444]/10 border border-[#EF4444]/30 text-[#F87171] rounded-lg p-3 mb-4 text-sm flex items-center gap-2 animate-slide-up">
              <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-[#9CA3AF] mb-1.5">
                Email address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 bg-[#1A1A1A] border border-[#404040] rounded-lg text-white placeholder-[#8B8B8B] input-focus"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-[#9CA3AF] mb-1.5">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-3 bg-[#1A1A1A] border border-[#404040] rounded-lg text-white placeholder-[#8B8B8B] input-focus"
                placeholder="Enter your password"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-6 btn-primary rounded-lg font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed mt-2"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 spinner" />
                  Signing in...
                </span>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-[#404040]">
            <p className="text-center text-xs text-[#8B8B8B]">
              Use the same login as your Kollab mobile app
            </p>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-[#8B8B8B] text-xs mt-6">
          Upload audio files from your desktop to kollab on the go
        </p>
      </div>
    </div>
  )
}
