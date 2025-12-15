import { supabase } from '../lib/supabase'
import { BetaConfig } from '../config/beta.config'

class AuthService {
  async signUp(
    email: string,
    password: string,
    username: string,
    firstName?: string,
    lastName?: string
  ) {
    const { data, error } = await supabase.auth.signUp({
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

    // Auto-grant Pro access to first N users during beta testing
    if (!error && data.user && BetaConfig.BETA_MODE_ENABLED && BetaConfig.AUTO_PRO_USER_LIMIT > 0) {
      try {
        // Count total users in the database
        const { count } = await supabase
          .from('users')
          .select('*', { count: 'exact', head: true })

        // If this user is within the beta limit, grant Pro access
        if (count !== null && count <= BetaConfig.AUTO_PRO_USER_LIMIT) {
          await supabase
            .from('users')
            .update({ subscription_tier: 'pro' })
            .eq('id', data.user.id)

          if (__DEV__) console.log(`[Beta] Auto-granted Pro access to user ${count}/${BetaConfig.AUTO_PRO_USER_LIMIT}`)
        }
      } catch (betaError) {
        if (__DEV__) console.error('[Beta] Failed to auto-grant Pro access:', betaError)
        // Don't fail signup if beta features fail
      }
    }

    return { error }
  }

  async signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    return { error }
  }

  async signOut() {
    const { error } = await supabase.auth.signOut()
    return { error }
  }

  async resetPassword(email: string) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'kollabmusic://reset-password', // Deep link for the app
    })
    return { error }
  }

  async deleteAccount() {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        return { error: new Error('No authenticated user found') }
      }

      // Delete user from Supabase Auth
      // This will cascade delete all related data due to ON DELETE CASCADE constraints:
      // - public.users profile
      // - projects they created
      // - their collaborations
      // - audio files they uploaded
      // - comments they made
      // - proximity sessions
      // - P2P transfers
      const { error } = await supabase.rpc('delete_user')

      if (error) {
        if (__DEV__) console.error('[Auth] Delete account error:', error)
        return { error }
      }

      // Sign out after successful deletion
      await this.signOut()

      return { error: null }
    } catch (error: any) {
      if (__DEV__) console.error('[Auth] Delete account exception:', error)
      return { error }
    }
  }
}

export const authService = new AuthService()