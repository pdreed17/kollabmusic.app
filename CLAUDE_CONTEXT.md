# Kollab Music Collaboration App - Claude Code Context

## 🎯 Project Overview

**Mission:** Build the most user-friendly, elegant music collaboration app for asynchronous music creation across different DAWs.

**Target Users:** Semi-professional to professional musicians ($50k-$500k annual revenue), music educators, serious hobbyists

**Value Proposition:** DAW-agnostic async collaboration platform with professional-grade features, transparent pricing, and automated rights management at accessible price points ($25-50/month).

**Key Differentiators:**
- Cross-DAW compatibility (export from any DAW, collaborate without forcing tool changes)
- Async-first design (embrace async as feature, not limitation)
- Transparent rights management with automated split tracking
- Apple-caliber user experience and polish

## 🎨 Design System (MANDATORY - USE THESE EXACTLY)

### Colors
```typescript
export const Colors = {
  // Primary
  primary: '#6366F1',
  primaryDark: '#4F46E5',
  primaryLight: '#818CF8',
  
  // Backgrounds
  backgroundDark: '#0F0F0F',
  background: '#1A1A1A',
  surface: '#262626',
  surfaceElevated: '#303030',
  border: '#404040',
  
  // Text
  text: '#FFFFFF',
  textSecondary: '#9CA3AF',
  textTertiary: '#6B7280',
  
  // Stem Colors (for audio track types)
  vocals: '#F59E0B',
  drums: '#EF4444',
  bass: '#8B5CF6',
  guitar: '#10B981',
  keys: '#3B82F6',
  synth: '#EC4899',
  
  // Semantic
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
  info: '#3B82F6',
}
```

### Typography
```typescript
export const Typography = {
  hero: {
    fontSize: 32,
    fontWeight: '700' as const,
  },
  h1: {
    fontSize: 24,
    fontWeight: '600' as const,
  },
  h2: {
    fontSize: 20,
    fontWeight: '600' as const,
  },
  h3: {
    fontSize: 18,
    fontWeight: '500' as const,
  },
  bodyLarge: {
    fontSize: 16,
    fontWeight: '400' as const,
  },
  body: {
    fontSize: 14,
    fontWeight: '400' as const,
  },
  caption: {
    fontSize: 12,
    fontWeight: '500' as const,
  },
  tiny: {
    fontSize: 10,
    fontWeight: '500' as const,
  },
}
```

### Spacing (8pt Grid System)
```typescript
export const Spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
}
```

### Border Radius
```typescript
export const BorderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 999,
}
```

## 📐 Standard Header Format (CRITICAL - USE CONSISTENTLY)

**Every screen MUST have this exact header structure:**
```typescript
<View style={styles.header}>
  {/* Left Side - Back Button or Home */}
  <TouchableOpacity onPress={() => navigation.goBack()}>
    <Ionicons name="arrow-back" size={24} color={Colors.text} />
  </TouchableOpacity>
  
  {/* Center - Screen Title */}
  <Text style={styles.headerTitle}>Screen Name</Text>
  
  {/* Right Side - Action Button (optional) */}
  <TouchableOpacity onPress={handleAction}>
    <Ionicons name="action-icon" size={24} color={Colors.primary} />
  </TouchableOpacity>
</View>

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingTop: 60,
    paddingBottom: Spacing.md,
    backgroundColor: Colors.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    ...Typography.h2,
    color: Colors.text,
  },
});
```

**Header Variants:**
- **With Back Button:** Left side has arrow-back icon
- **Main Tabs (Home, Search, Activity, Profile):** Left side has home icon linking to HomeScreen
- **Action Screens:** Right side has action icon (add, settings, more-options, etc.)

## 🗂️ Tech Stack

### Frontend
- **React Native** with Expo (TypeScript MANDATORY)
- **Expo Router** for navigation
- **React Native Track Player** for multi-track audio playback
- **Expo AV** for simple playback scenarios
- **Ionicons** for all icons

### Backend
- **Supabase**
  - PostgreSQL database with Row Level Security (RLS)
  - Supabase Auth (email/password + social providers)
  - Supabase Storage (audio files)
  - Supabase Realtime (live updates)
  - Edge Functions (server-side processing)

### Payment Processing
- **Stripe** for subscription management

### State Management
- **React Context** for global app state
- **React Query (TanStack Query)** for server state caching
- **AsyncStorage** for local persistence (NOT localStorage)

## 🗄️ Database Schema Overview

### Core Tables

**users**
- id (UUID, references auth.users)
- username, display_name, bio, avatar_url
- role (array: 'musician', 'vocalist', 'producer', etc.)
- skills (JSONB: instruments, genres, software)
- subscription_status, subscription_tier, subscription_expires_at
- stripe_customer_id, stripe_subscription_id

**projects**
- id, creator_id
- title, description, genre
- bpm, key, time_signature
- is_public, looking_for_collaborators, needed_roles
- status ('active', 'archived', 'completed', 'deleted')

**audio_files**
- id, project_id
- file_path, file_name, file_size
- file_type ('audio', 'midi'), format ('wav', 'mp3', 'flac', 'midi')
- sample_rate, bit_depth, duration_ms
- stem_type ('drums', 'bass', 'vocals', 'synth', 'guitar', 'keys', 'fx', 'full_mix', 'other')
- stem_name, color
- volume, pan, is_muted, is_soloed
- waveform_data (JSONB array of peak values)
- version, parent_file_id (for version history)
- midi_data (JSONB for MIDI-specific metadata)
- created_by

**comments**
- id, project_id, audio_file_id, user_id
- content
- timestamp_ms, end_timestamp_ms (for time-stamped or range comments)
- parent_comment_id (for threading)
- resolved, resolved_by, resolved_at

**collaborators**
- id, project_id, user_id
- role ('owner', 'admin', 'editor', 'commenter', 'viewer')
- can_edit, can_delete, can_invite, can_upload, can_comment, can_download
- invited_by, invitation_status ('pending', 'accepted', 'declined')

**project_versions**
- id, project_id
- version_number, version_name, description
- snapshot_data (JSONB project state)
- created_by

**revenue_splits**
- id, project_id, user_id
- percentage, role
- agreed, agreed_at, signature_data
- status ('pending', 'active', 'disputed', 'resolved')

## 📱 Navigation Structure

### Bottom Tab Navigator (Main App Flow)
1. **Home Tab** (`/home`) - Project list and feed
2. **Search Tab** (`/search`) - User discovery
3. **Activity Tab** (`/activity`) - Recent activity feed
4. **Profile Tab** (`/profile`) - User profile and settings

### Key Screens (Stack Navigation)
- **AuthScreen** - Login/signup (outside main navigation)
- **ProjectStudioScreen** - Multi-track audio workspace with mixer
- **ProjectDetailScreen** - Project overview and metadata
- **UserProfileScreen** - View other users' profiles
- **EditProfileScreen** - Edit own profile
- **CreateProjectScreen** - New project creation
- **UploadAudioScreen** - Add stems to project
- **SettingsScreen** - App settings
- **SubscriptionScreen** - Manage subscription

## 💻 Code Standards (CRITICAL)

### TypeScript Usage (MANDATORY)
```typescript
// Always use TypeScript, never plain JavaScript
// Import types from Supabase
import { Database } from './types/database.types'

type Project = Database['public']['Tables']['projects']['Row']
type AudioFile = Database['public']['Tables']['audio_files']['Row']

// Type all function parameters and returns
const uploadAudio = async (
  projectId: string,
  file: File
): Promise<AudioFile | null> => {
  // Implementation
}
```

### Error Handling (ALWAYS)
```typescript
try {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .single()
  
  if (error) throw error
  
  return data
} catch (error) {
  console.error('Error loading project:', error)
  Alert.alert('Error', 'Failed to load project. Please try again.')
  // Log to monitoring service (Sentry, etc.)
  return null
}
```

### Component Structure Pattern
```typescript
import React, { useState, useEffect } from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Colors, Typography, Spacing, BorderRadius } from '../constants/theme'

interface ComponentProps {
  // Type all props
  title: string
  onPress: () => void
}

export const ComponentName: React.FC<ComponentProps> = ({ title, onPress }) => {
  const [state, setState] = useState<string>('')
  
  useEffect(() => {
    // Side effects
  }, [])
  
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <TouchableOpacity onPress={onPress} style={styles.button}>
        <Ionicons name="add" size={24} color={Colors.primary} />
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  title: {
    ...Typography.h3,
    color: Colors.text,
  },
  button: {
    padding: Spacing.sm,
  },
})
```

### Supabase Query Pattern
```typescript
import { supabase } from '../services/supabase'

// SELECT with filters and joins
const { data, error } = await supabase
  .from('projects')
  .select(`
    *,
    creator:users(username, display_name, avatar_url),
    audio_files(count),
    collaborators(count)
  `)
  .eq('creator_id', userId)
  .order('created_at', { ascending: false })

// INSERT
const { data, error } = await supabase
  .from('projects')
  .insert({
    title: 'New Project',
    creator_id: user.id,
    genre: 'Electronic',
  })
  .select()
  .single()

// UPDATE
const { error } = await supabase
  .from('projects')
  .update({ title: 'Updated Title' })
  .eq('id', projectId)

// DELETE
const { error } = await supabase
  .from('projects')
  .delete()
  .eq('id', projectId)

// Real-time subscription
const subscription = supabase
  .channel(`project:${projectId}`)
  .on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'comments',
      filter: `project_id=eq.${projectId}`
    },
    (payload) => {
      console.log('New comment:', payload.new)
      setComments(prev => [...prev, payload.new])
    }
  )
  .subscribe()

// Cleanup
return () => subscription.unsubscribe()
```

## 🎵 Audio File Handling Patterns

### Upload Audio File
```typescript
const uploadAudioFile = async (
  projectId: string,
  uri: string,
  fileName: string,
  stemType: string
) => {
  try {
    // Read file as blob
    const response = await fetch(uri)
    const blob = await response.blob()
    
    // Generate unique file path
    const fileId = crypto.randomUUID()
    const fileExtension = fileName.split('.').pop()
    const storagePath = `${projectId}/stems/${fileId}.${fileExtension}`
    
    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('audio-files')
      .upload(storagePath, blob, {
        contentType: `audio/${fileExtension}`,
        upsert: false,
      })
    
    if (uploadError) throw uploadError
    
    // Get file info
    const fileInfo = await FileSystem.getInfoAsync(uri)
    
    // Insert metadata into database
    const { data: audioFile, error: dbError } = await supabase
      .from('audio_files')
      .insert({
        project_id: projectId,
        file_path: storagePath,
        file_name: fileName,
        file_size: fileInfo.size,
        file_type: 'audio',
        format: fileExtension,
        stem_type: stemType,
        stem_name: fileName.replace(`.${fileExtension}`, ''),
        color: getStemColor(stemType),
        created_by: user.id,
      })
      .select()
      .single()
    
    if (dbError) throw dbError
    
    return audioFile
  } catch (error) {
    console.error('Upload error:', error)
    throw error
  }
}

// Get color for stem type
const getStemColor = (stemType: string): string => {
  const colorMap: Record<string, string> = {
    vocals: Colors.vocals,
    drums: Colors.drums,
    bass: Colors.bass,
    guitar: Colors.guitar,
    keys: Colors.keys,
    synth: Colors.synth,
  }
  return colorMap[stemType] || Colors.primary
}
```

### Download Audio File URL
```typescript
const getAudioFileUrl = async (filePath: string): Promise<string> => {
  const { data } = await supabase.storage
    .from('audio-files')
    .createSignedUrl(filePath, 3600) // 1 hour expiry
  
  return data?.signedUrl || ''
}
```

## 🎯 Key Design Principles

### 1. Consistency is Non-Negotiable
- **Headers:** Same format across all screens
- **Colors:** Use design system colors exactly (no hardcoded hex values in components)
- **Spacing:** Always use Spacing constants (never raw numbers)
- **Typography:** Use Typography constants for all text
- **Icons:** Always use Ionicons, size 24 for headers, size 20 for inline

### 2. Professional Polish
- All interactive elements need visual feedback (opacity changes, subtle animations)
- Loading states for all async operations
- Empty states with helpful messages
- Error states with retry options
- Success feedback (toasts, animations)

### 3. Async-First Philosophy
- Never promise real-time global collaboration (physics limitation)
- Embrace async as a feature: "Work in your own time zone"
- Visual indicators of when collaborators last worked
- Notification system for updates

### 4. Thumb-Friendly Navigation
- Bottom tab navigation for primary actions
- Important buttons in lower third of screen
- Avoid top-corner buttons for critical actions

### 5. Dark Mode First
- Design in dark mode, ensure high contrast
- Use Colors.background and Colors.surface appropriately
- Text should always be readable (Colors.text, Colors.textSecondary)

## 🚫 What NOT to Do

### Never:
- ❌ Hardcode colors (use Colors.primary instead of '#6366F1')
- ❌ Use localStorage or sessionStorage (use AsyncStorage)
- ❌ Skip error handling
- ❌ Leave TypeScript as `any` type
- ❌ Create inconsistent headers
- ❌ Use different spacing values than the system
- ❌ Promise real-time collaboration without WebRTC
- ❌ Skip loading states
- ❌ Forget to unsubscribe from Supabase realtime

## 📝 Common Patterns

### Button Component
```typescript
<TouchableOpacity
  style={[
    styles.button,
    disabled && styles.buttonDisabled
  ]}
  onPress={handlePress}
  activeOpacity={0.7}
  disabled={disabled}
>
  <Text style={styles.buttonText}>Button Text</Text>
</TouchableOpacity>

const styles = StyleSheet.create({
  button: {
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: Colors.border,
  },
  buttonText: {
    ...Typography.body,
    color: Colors.text,
    fontWeight: '600',
  },
})
```

### Card Component
```typescript
<View style={styles.card}>
  {/* Card content */}
</View>

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
})
```

### Loading State
```typescript
{loading ? (
  <ActivityIndicator size="large" color={Colors.primary} />
) : (
  <ContentComponent />
)}
```

### Empty State
```typescript
<View style={styles.emptyState}>
  <Ionicons name="musical-notes-outline" size={64} color={Colors.textSecondary} />
  <Text style={styles.emptyTitle}>No projects yet</Text>
  <Text style={styles.emptySubtitle}>Create your first project to get started</Text>
  <TouchableOpacity onPress={createProject} style={styles.emptyButton}>
    <Text style={styles.emptyButtonText}>Create Project</Text>
  </TouchableOpacity>
</View>
```

## 🎯 Current App State

### Completed Features ✅
- User authentication (email/password, social providers)
- User profiles with bio, avatar, roles, skills
- Project creation and editing
- Audio file upload (WAV, MP3, FLAC, MIDI)
- Multi-track playback with transport controls
- Project Studio screen with timeline visualization
- Volume and pan controls per track
- Activity feed with real-time updates
- User search and discovery
- Collaboration invitations
- Role-based permissions
- Bottom tab navigation
- DAW export system (Ableton, Logic, FL Studio, Pro Tools)

### In Progress / Needs Enhancement 🚧
- Time-stamped comments on audio timeline
- Waveform visualization for stems
- Stem color coding by instrument type
- Solo/mute functionality
- Real-time collaboration features (WebRTC)
- Version history UI
- Advanced search filters
- Social features (followers, likes)
- In-app notifications
- Subscription management UI

### Not Started 📋
- MIDI playback and editing
- AI-powered features (stem separation, mixing suggestions)
- Sample library
- Revenue splits management
- Blockchain/NFT features (requires legal review)
- Direct messaging between users
- Project templates
- Educational content

## 🚀 Ready to Build

When using Claude Code, always reference this document for:
- Color values and design tokens
- Component patterns and structure
- Database schema and queries
- Error handling patterns
- TypeScript types
- Navigation structure

**Key Reminders:**
1. Consistency in headers, colors, and themes is NON-NEGOTIABLE
2. Always use TypeScript with proper types
3. Follow the design system exactly
4. Include error handling, loading states, and empty states
5. Test on both iOS and Android
6. Keep user experience Apple-caliber

**Let's build something amazing! 🎵**