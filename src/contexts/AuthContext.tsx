import React, { createContext, useState, useEffect, useContext, useRef } from 'react'
import { AppState, AppStateStatus } from 'react-native'
import { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { badgeService } from '../services/badge.service'

type AuthContextType = {
  session: Session | null
  user: User | null
  userProfile: any | null
  loading: boolean
  isPasswordRecovery: boolean
  clearPasswordRecovery: () => void
  signUp: (
    email: string,
    password: string,
    username: string,
    firstName?: string,
    lastName?: string
  ) => Promise<{ error: any }>
  signIn: (email: string, password: string) => Promise<{ error: any }>
  signOut: () => Promise<void>
  refreshUserProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [userProfile, setUserProfile] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false)
  const appState = useRef(AppState.currentState)

  const clearPasswordRecovery = () => {
    setIsPasswordRecovery(false)
  }

  const fetchUserProfile = async (userId: string) => {
    try {
      const { data } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single()
      
      if (data) {
        setUserProfile(data)
      }
    } catch (error) {
      if (__DEV__) console.error('Error fetching user profile:', error)
    }
  }

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession()
      .then(({ data: { session }, error }) => {
        if (error) {
          // Check for invalid refresh token specifically
          if (error.message?.includes('Refresh Token') || error.message?.includes('refresh')) {
            if (__DEV__) console.error('[Auth] Invalid refresh token - clearing session')
            // Force sign out to clear bad tokens
            supabase.auth.signOut().catch(() => {})
          } else {
            if (__DEV__) console.log('[Auth] Session restore error (expected for new users):', error.message)
          }

          // Clear invalid session
          setSession(null)
          setUser(null)
          setUserProfile(null)
          setLoading(false)
          return
        }

        setSession(session)
        setUser(session?.user ?? null)

        // Fetch user profile
        if (session?.user) {
          fetchUserProfile(session.user.id)
        }

        setLoading(false)
      })
      .catch((error) => {
        if (__DEV__) console.error('[Auth] Session restore exception:', error)
        // Clear session on any error and force sign out
        supabase.auth.signOut().catch(() => {})
        setSession(null)
        setUser(null)
        setUserProfile(null)
        setLoading(false)
      })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (__DEV__) console.log('[Auth] State change:', event)

      // Handle password recovery event - user clicked reset link in email
      if (event === 'PASSWORD_RECOVERY') {
        if (__DEV__) console.log('[Auth] Password recovery mode activated')
        setIsPasswordRecovery(true)
        // Set session so user can update their password
        setSession(session)
        setUser(session?.user ?? null)
        return
      }

      // Auto-logout on token refresh errors
      if (event === 'TOKEN_REFRESHED') {
        if (__DEV__) console.log('[Auth] Token refreshed successfully')
      } else if (event === 'SIGNED_OUT') {
        if (__DEV__) console.log('[Auth] User signed out')
        setSession(null)
        setUser(null)
        setUserProfile(null)
        setIsPasswordRecovery(false)
        return
      }

      // Clear password recovery on successful sign in
      if (event === 'SIGNED_IN') {
        setIsPasswordRecovery(false)
      }

      setSession(session)
      setUser(session?.user ?? null)

      // Fetch user profile
      if (session?.user) {
        fetchUserProfile(session.user.id)
      } else {
        setUserProfile(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  // Real-time subscription for profile updates
  useEffect(() => {
    if (!user?.id) return

    const profileChannel = supabase
      .channel(`user-profile:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'users',
          filter: `id=eq.${user.id}`,
        },
        (payload) => {
          if (__DEV__) console.log('Profile updated in real-time:', payload.new)
          setUserProfile(payload.new)
        }
      )
      .subscribe()

    return () => {
      profileChannel.unsubscribe()
    }
  }, [user?.id])

  // Badge management - update when app opens or comes to foreground
  useEffect(() => {
    if (!user?.id) return

    // Update badge immediately when user is logged in
    badgeService.updateBadgeCount(user.id)

    // Listen for app state changes to update badge when app comes to foreground
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        // App has come to foreground - update badge
        if (__DEV__) console.log('[Auth] App came to foreground, updating badge')
        badgeService.updateBadgeCount(user.id)
      }
      appState.current = nextAppState
    }

    const subscription = AppState.addEventListener('change', handleAppStateChange)

    return () => {
      subscription.remove()
    }
  }, [user?.id])

  const signUp = async (
    email: string, 
    password: string, 
    username: string,
    firstName?: string,
    lastName?: string
  ) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username,
          first_name: firstName,
          last_name: lastName,
        }
      }
    })

    return { error }
  }

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    return { error }
  }

  const signOut = async () => {
    await badgeService.clearBadge()
    await supabase.auth.signOut()
    setUserProfile(null)
  }

  const refreshUserProfile = async () => {
    if (user?.id) {
      await fetchUserProfile(user.id)
    }
  }

  return (
    <AuthContext.Provider value={{ session, user, userProfile, loading, isPasswordRecovery, clearPasswordRecovery, signUp, signIn, signOut, refreshUserProfile }}>
      {children}
    </AuthContext.Provider>
  )
}