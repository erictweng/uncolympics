import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import type { User } from '@supabase/supabase-js'
import type { Profile } from '../types'

interface AuthStore {
  user: User | null
  profile: Profile | null
  isLoading: boolean
  signIn: () => Promise<void>
  signOut: () => Promise<void>
  fetchProfile: () => Promise<void>
  initialize: () => Promise<void>
}

const useAuthStore = create<AuthStore>((set, get) => ({
  user: null,
  profile: null,
  isLoading: true,

  signIn: async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin + '/auth/callback',
      },
    })
  },

  signOut: async () => {
    await supabase.auth.signOut()
    set({ user: null, profile: null })
  },

  fetchProfile: async () => {
    const { user } = get()
    if (!user) return

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (error && error.code === 'PGRST116') {
      // Profile doesn't exist — create from Google data
      const meta = user.user_metadata
      const newProfile = {
        id: user.id,
        name: meta?.full_name || meta?.name || user.email?.split('@')[0] || 'Player',
        avatar_url: meta?.avatar_url || meta?.picture || null,
        email: user.email || null,
      }

      const { data: created, error: createError } = await supabase
        .from('profiles')
        .upsert(newProfile)
        .select()
        .single()

      if (!createError && created) {
        set({ profile: created as Profile })
      }
    } else if (!error && data) {
      set({ profile: data as Profile })
    }
  },

  initialize: async () => {
    set({ isLoading: true })

    const { data: { session } } = await supabase.auth.getSession()

    if (session?.user) {
      set({ user: session.user })
      await get().fetchProfile()
    }

    set({ isLoading: false })

    // Listen for auth changes
    supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        set({ user: session.user })
        await get().fetchProfile()
      } else {
        set({ user: null, profile: null })
      }
    })
  },
}))

export default useAuthStore
