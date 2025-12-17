import { createClient } from '@supabase/supabase-js'

// Same credentials as mobile app
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://qsszofomkpgmlntljvkk.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFzc3pvZm9ta3BnbWxudGxqdmtrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA0NTI2OTQsImV4cCI6MjA3NjAyODY5NH0.ogqnxgjZOd1UfRarexMMBlver0ZVtDJEPccPSC51NQg'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Project = {
  id: string
  title: string
  description: string | null
  creator_id: string
}

export type AudioFileRecord = {
  project_id: string
  file_path: string
  file_name: string
  file_size: number
  file_type: string
  format: string
  stem_type: string
  stem_name: string
  duration_ms: number | null
  color: string
  volume: number
  pan: number
  is_muted: boolean
  is_soloed: boolean
  created_by: string
}

// Stem colors matching mobile app
export const STEM_COLORS: Record<string, string> = {
  vocals: '#FF6B6B',
  drums: '#4ECDC4',
  bass: '#45B7D1',
  guitar: '#96CEB4',
  keys: '#FFEAA7',
  synth: '#DDA0DD',
  fx: '#00BCD4',
  multiple: '#9C27B0',
  other: '#FFC107',
}
