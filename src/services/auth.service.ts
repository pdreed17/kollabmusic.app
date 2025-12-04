import { supabase } from '../lib/supabase'

class AuthService {
  async signUp(
    email: string, 
    password: string, 
    username: string,
    firstName?: string,
    lastName?: string
  ) {
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
}

export const authService = new AuthService()