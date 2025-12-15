# Kollab Music App - Complete Context Document

> **Purpose**: This document provides complete context for AI assistants to understand the Kollab Music collaboration app codebase. Upload this file at the start of any Claude Code session.

---

## Quick Reference

| Property | Value |
|----------|-------|
| **App Name** | Kollab Music |
| **Bundle ID (iOS)** | com.creategood.kollabMusic |
| **Package (Android)** | com.creategood.kollabmusic |
| **Deep Link Scheme** | kollabmusic:// |
| **Version** | 1.0.0 |
| **Current Branch** | feature/new-navigation-pill-system |
| **Framework** | React Native + Expo (~54.0.25) |
| **Backend** | Supabase (PostgreSQL + Auth + Storage) |
| **Language** | TypeScript |

---

## What This App Does

Kollab Music is a **music collaboration platform** that allows musicians to:
- Create projects with metadata (title, genre, BPM, key, time signature)
- Upload multiple audio stems (vocals, drums, bass, guitar, keys, synth)
- Mix tracks with volume, pan, mute, and solo controls
- Add timestamped comments on the audio timeline
- Chat in real-time with collaborators
- Invite collaborators with role-based permissions
- Follow other users and see their activity
- Detect BPM automatically from audio files

---

## Directory Structure

```
kollabMusicApp/
├── src/
│   ├── components/          # 26 reusable UI components
│   ├── screens/             # 34 application screens
│   │   └── auth/            # Authentication screens
│   ├── services/            # 16 business logic & API services
│   ├── contexts/            # 3 React contexts (Auth, Navigation, Preferences)
│   ├── navigation/          # 4 navigation configuration files
│   ├── constants/           # Theme, colors, typography
│   ├── types/               # TypeScript type definitions
│   ├── utils/               # Utility functions & helpers
│   ├── lib/                 # External library config (Supabase client)
│   └── config/              # App configuration (beta.config.ts)
├── supabase/
│   ├── migrations/          # 23 database migration files
│   └── functions/           # Edge functions (trimAudio)
├── web-daw/                 # Web-based DAW (separate React app)
├── ios/                     # iOS native project
├── assets/                  # Logo, icons, images
├── App.tsx                  # Root application component
├── app.json                 # Expo configuration
└── package.json             # Dependencies
```

---

## Navigation Architecture

### App.tsx (Root)
Wraps the app with providers:
```
GestureHandlerRootView
  └── ErrorBoundary
        └── AuthProvider
              └── PreferencesProvider
                    └── NavigationProvider
                          └── NavigationContainer
                                └── AppNavigator
```

### AppNavigator.tsx
- Checks auth state from AuthContext
- **Authenticated**: Shows MainTabs + all feature screens as stack
- **Unauthenticated**: Shows Login/Signup screens

### MainNavigator.tsx (New Pill Navigation System)
Tab-based navigation with 5 main screens:
1. **Home** - Dashboard, recent projects, activity overview
2. **Projects** - User's project list
3. **Activity** - Activity feed from self and connections
4. **Search** - Search projects, users, audio
5. **Profile** - User profile and settings

Each screen wrapped with:
- `ThinHeader` - Minimal header with screen name
- `NavigationPill` - Animated corner navigation (supports left/right handedness)
- `BackButton` - Context-aware back navigation

---

## All Screens (34 Total)

### Main Tabs
| Screen | File | Description |
|--------|------|-------------|
| Home | `HomeScreen.tsx` | Dashboard with recent projects, pending invitations, activity |
| Projects | `ProjectsListScreen.tsx` | List of user's projects (owned + collaborating) |
| Activity | `ActivityScreen.tsx` | Activity feed from self and followed users |
| Search | `SearchScreen.tsx` | Search projects, users, audio files |
| Profile | `ProfileScreen.tsx` | Current user profile, stats, settings access |

### Authentication
| Screen | File | Description |
|--------|------|-------------|
| Login | `auth/LoginScreen.tsx` | Email/password login |
| SignUp | `auth/SignUpScreen.tsx` | Registration with auto-Pro for beta |
| ForgotPassword | `auth/ForgotPasswordScreen.tsx` | Password reset via email |

### Project Management
| Screen | File | Description |
|--------|------|-------------|
| CreateProject | `CreateProjectScreen.tsx` | Create new project with metadata |
| ProjectDetail | `ProjectDetailScreen.tsx` | Project overview, collaborators, files |
| EditProject | `EditProjectScreen.tsx` | Edit project metadata |
| **ProjectStudio** | `ProjectStudioScreen.tsx` | **Core screen** (3,981 lines) - Playback, mixer, comments, chat |

### Collaboration
| Screen | File | Description |
|--------|------|-------------|
| InviteCollaborator | `InviteCollaboratorScreen.tsx` | Search and invite users with roles |
| Collaborators | `CollaboratorsScreen.tsx` | Manage project collaborators |
| PendingInvitations | `PendingInvitationsScreen.tsx` | Accept/decline invitations |

### Audio
| Screen | File | Description |
|--------|------|-------------|
| AudioUpload | `AudioUploadScreen.tsx` | Upload audio with stem type selection |
| HighlightUpload | `HighlightUploadScreen.tsx` | Upload promotional audio clips |
| ExportToDAW | `ExportToDAWScreen.tsx` | Export project stems |
| SimilarTracks | `SimilarTracksScreen.tsx` | Find similar tracks via Spotify |

### User Management
| Screen | File | Description |
|--------|------|-------------|
| EditProfile | `EditProfileScreen.tsx` | Update username, name, bio, avatar |
| UserProfile | `UserProfileScreen.tsx` | View other user's profile |
| BlockedUsers | `BlockedUsersScreen.tsx` | Manage blocked users |

### Settings & Account
| Screen | File | Description |
|--------|------|-------------|
| Settings | `SettingsScreen.tsx` | App settings, account, help |
| ChangePassword | `ChangePasswordScreen.tsx` | Change password |
| Subscription | `SubscriptionScreen.tsx` | Tier info (Free/Pro/Studio) - **Stripe not wired** |
| BillingHistory | `BillingHistoryScreen.tsx` | Transaction history - **Mock data only** |
| PrivacyPolicy | `PrivacyPolicyScreen.tsx` | Legal privacy docs |
| TermsOfService | `TermsOfServiceScreen.tsx` | Legal terms |

### DAW
| Screen | File | Description |
|--------|------|-------------|
| NativeDAW | `NativeDAWScreen.tsx` | Native multi-track mixing |
| WebDAW | `WebDAWScreen.tsx` | Web-based DAW via WebView |

---

## Key Components

### Navigation Components
| Component | Purpose |
|-----------|---------|
| `NavigationPill.tsx` | Animated corner navigation with spring physics, handedness support |
| `ThinHeader.tsx` | Minimal header showing screen name |
| `CompactHeader.tsx` | Compact header for project info |
| `BackButton.tsx` | Context-aware back navigation |

### Audio Components
| Component | Purpose |
|-----------|---------|
| `AudioTrackPopup.tsx` | Track details, trim controls, BPM/key info |
| `HighlightPlayer.tsx` | Play highlight clips with timeline |
| `SimpleTimeline.tsx` | Waveform display, scrubbing, comment markers |
| `NativeMixerControls.tsx` | Volume sliders, pan, solo/mute toggles |

### Chat & Comments
| Component | Purpose |
|-----------|---------|
| `ProjectChat.tsx` | iMessage-style real-time chat |
| `CommentModal.tsx` | Create timestamped comments |

### Utilities
| Component | Purpose |
|-----------|---------|
| `ErrorBoundary.tsx` | Catches React errors, shows fallback UI |
| `LoadingSkeleton.tsx` | Skeleton loading states |
| `InvitationsBadge.tsx` | Unread invitation count badge |

---

## Services

### Core Services
| Service | File | Responsibilities |
|---------|------|------------------|
| Auth | `auth.service.ts` | Signup (with beta Pro auto-grant), signin, password reset, account deletion |
| Project | `project.service.ts` | CRUD projects, invite collaborators, role permissions |

### Audio Services
| Service | File | Responsibilities |
|---------|------|------------------|
| Audio | `audio.service.ts` | Upload/download audio, signed URLs, mixer settings, format validation |
| AudioPlayer | `audioPlayer.service.ts` | Playback control, seek |
| AudioAnalyzer | `audioAnalyzer.ts` | Frequency analysis via Meyda.js |

### BPM Detection (4 implementations)
| Service | File | Method |
|---------|------|--------|
| bpmDetector | `bpmDetector.ts` | FFT-based |
| cloudBpmDetector | `cloudBpmDetector.ts` | Cloud API |
| simpleBpmDetector | `simpleBpmDetector.ts` | Quick estimation |
| webAudioBpmDetector | `webAudioBpmDetector.ts` | Web Audio API |

### Other Services
| Service | File | Responsibilities |
|---------|------|------------------|
| Activity | `activity.service.ts` | Activity feed, user stats |
| Comment | `comment.service.ts` | CRUD comments, real-time subscriptions |
| SpotifyRecommender | `spotifyRecommender.ts` | Track recommendations |
| SimilarityApi | `similarityApi.ts` | Audio similarity matching |

---

## React Contexts

### AuthContext (`contexts/AuthContext.tsx`)
```typescript
interface AuthContextType {
  session: Session | null
  user: User | null
  userProfile: UserProfile | null
  loading: boolean
  signUp: (email, password, username, displayName) => Promise<{error}>
  signIn: (email, password) => Promise<{error}>
  signOut: () => Promise<void>
  refreshUserProfile: () => Promise<void>
}
```

### NavigationContext (`contexts/NavigationContext.tsx`)
```typescript
interface NavigationContextType {
  isNavExpanded: boolean
  toggleNav: () => void
}
```

### PreferencesContext (`contexts/PreferencesContext.tsx`)
```typescript
interface PreferencesContextType {
  handedness: 'left' | 'right'
  setHandedness: (value) => void
}
```

---

## Database Schema (Supabase PostgreSQL)

### users
```sql
id UUID PRIMARY KEY (references auth.users)
username TEXT UNIQUE
display_name TEXT
avatar_url TEXT
bio TEXT
subscription_tier VARCHAR ('free', 'pro', 'studio')
followers_count INTEGER
created_at TIMESTAMP
updated_at TIMESTAMP
```

### projects
```sql
id UUID PRIMARY KEY
title TEXT
description TEXT
genre TEXT
bpm INTEGER
key TEXT
time_signature VARCHAR (default '4/4')
creator_id UUID REFERENCES users ON DELETE CASCADE
is_public BOOLEAN (default false)
status VARCHAR ('active', 'archived', 'deleted')
created_at TIMESTAMP
updated_at TIMESTAMP
```

### project_collaborators
```sql
id UUID PRIMARY KEY
project_id UUID REFERENCES projects ON DELETE CASCADE
user_id UUID REFERENCES users ON DELETE CASCADE
role VARCHAR ('owner', 'admin', 'editor', 'commenter', 'viewer')
invitation_status VARCHAR ('pending', 'accepted', 'declined')
invited_by UUID
accepted_at TIMESTAMP
-- Permissions
can_edit BOOLEAN
can_delete BOOLEAN
can_invite BOOLEAN
can_upload BOOLEAN
can_comment BOOLEAN
can_download BOOLEAN
created_at TIMESTAMP
UNIQUE(project_id, user_id)
```

### audio_files
```sql
id UUID PRIMARY KEY
project_id UUID REFERENCES projects ON DELETE CASCADE
file_path TEXT
file_name TEXT
file_size BIGINT
file_type VARCHAR
format VARCHAR
stem_type VARCHAR ('vocals', 'drums', 'bass', 'guitar', 'keys', 'synth', 'multiple', 'other')
stem_name TEXT
duration_ms INTEGER
-- Mixer settings
volume REAL (default 1.0, range 0-2)
pan REAL (default 0.0, range -1 to 1)
is_muted BOOLEAN
is_soloed BOOLEAN
color TEXT
-- Organization
priority VARCHAR ('high', 'medium', 'low')
order_index INTEGER
is_hidden BOOLEAN
-- Trimming
is_trimmed BOOLEAN
trim_start_ms INTEGER
trim_end_ms INTEGER
original_file_path TEXT
waveform_data JSON
created_by UUID REFERENCES users
created_at TIMESTAMP
updated_at TIMESTAMP
```

### comments
```sql
id UUID PRIMARY KEY
project_id UUID REFERENCES projects
audio_file_id UUID REFERENCES audio_files
user_id UUID REFERENCES users
content TEXT
timestamp_ms INTEGER (position on timeline)
end_timestamp_ms INTEGER (for range comments)
parent_comment_id UUID (for threading)
resolved BOOLEAN
resolved_by UUID
resolved_at TIMESTAMP
is_edited BOOLEAN
created_at TIMESTAMP
updated_at TIMESTAMP
```

### project_messages (Chat)
```sql
id UUID PRIMARY KEY
project_id UUID REFERENCES projects
user_id UUID REFERENCES users
content TEXT
is_edited BOOLEAN
created_at TIMESTAMP
updated_at TIMESTAMP
```

### user_connections
```sql
id UUID PRIMARY KEY
user_id UUID REFERENCES users (the follower)
following_id UUID REFERENCES users (being followed)
created_at TIMESTAMP
UNIQUE(user_id, following_id)
```

### user_blocks
```sql
id UUID PRIMARY KEY
user_id UUID REFERENCES users
blocked_user_id UUID REFERENCES users
created_at TIMESTAMP
```

---

## Role Permissions Matrix

| Permission | Owner | Admin | Editor | Commenter | Viewer |
|------------|-------|-------|--------|-----------|--------|
| can_edit | Yes | Yes | Yes | No | No |
| can_delete | Yes | Yes | No | No | No |
| can_invite | Yes | Yes | No | No | No |
| can_upload | Yes | Yes | Yes | No | No |
| can_comment | Yes | Yes | Yes | Yes | No |
| can_download | Yes | Yes | Yes | Yes | Yes |

---

## Supabase Storage Buckets

| Bucket | Purpose | Access |
|--------|---------|--------|
| `audio-files` | Project audio stems | Private (signed URLs) |
| `highlights` | User highlight clips | Private (signed URLs) |
| `avatars` | User profile pictures | Public |

---

## Feature Status

### Complete Features
| Feature | Notes |
|---------|-------|
| User auth (signup/login/logout) | With beta Pro auto-grant for first 50 users |
| Project CRUD | Create, read, update, soft-delete |
| Multi-stem audio upload | Supports WAV, MP3, FLAC, AAC, OGG, OPUS, AIFF, ALAC, MIDI |
| Mixer controls | Volume (0-200%), pan (-100 to +100), mute, solo |
| Timeline comments | Timestamped, range-based, threaded replies |
| Project chat | Real-time iMessage-style |
| Role-based collaboration | 5 roles, 6 granular permissions |
| Invitation system | Invite by search, pending/accepted/declined |
| Activity feed | Own activities + followed users |
| Follow/unfollow | With followers_count sync |
| Block users | Prevents interactions |
| BPM detection | 4 different implementations |
| Audio trimming | Set start/end points |
| Password reset | Via email deep link |
| Profile editing | Username, display name, bio, avatar |

### Partial/Incomplete Features
| Feature | Status | Location |
|---------|--------|----------|
| Subscription/billing | UI done, **Stripe not integrated** | `SubscriptionScreen.tsx` |
| Billing history | **Mock data only** | `BillingHistoryScreen.tsx` |
| Notifications | **TODO - not implemented** | `InviteCollaboratorScreen.tsx:180` |
| Data export | **TODO - not implemented** | `SettingsScreen.tsx:151` |
| Invoice download | **TODO - not implemented** | `BillingHistoryScreen.tsx:89` |
| Multipart upload | **TODO** for files >100MB | `fileUpload.util.ts:99` |
| Error monitoring | **TODO - Sentry not wired** | `ErrorBoundary.tsx:48` |
| Spotify features | Requires env vars | Works if credentials provided |

### Deleted/Removed Features
| Feature | Files Deleted | Notes |
|---------|---------------|-------|
| Nearby Collaborators | `NearbyCollaborators.tsx`, `nearbyCollaborators.service.ts` | P2P proximity feature removed |
| P2P Transfer | `p2pTransfer.service.ts` | Direct file transfer removed |

---

## Configuration

### Beta Config (`src/config/beta.config.ts`)
```typescript
export const BETA_CONFIG = {
  AUTO_PRO_USER_LIMIT: 50,    // First 50 users get Pro tier free
  BETA_MODE_ENABLED: true,    // Enable beta features
}
```
**Important**: Set `BETA_MODE_ENABLED: false` and `AUTO_PRO_USER_LIMIT: 0` for production.

### Environment Variables Required
```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Optional - for Spotify features
EXPO_PUBLIC_SPOTIFY_CLIENT_ID=your-spotify-client-id
EXPO_PUBLIC_SPOTIFY_CLIENT_SECRET=your-spotify-client-secret
```

### Theme Constants (`src/constants/theme.ts`)
- **Primary Color**: #6366F1 (Indigo)
- **Stem Colors**: Vocals (#F59E0B), Drums (#EF4444), Bass (#8B5CF6), Guitar (#10B981), Keys (#3B82F6), Synth (#EC4899)
- **Dark mode** is the default and only theme

---

## Known Issues & Technical Debt

### Critical (Fix before TestFlight)
1. **Stripe not integrated** - Subscription buttons do nothing
2. **Mock billing data** - Shows fake invoices
3. **60+ console.log statements** - Performance/security concern
4. **Notification system missing** - Users won't know about invitations

### High Priority
1. **Null safety issues** in AudioUploadScreen, ProjectChat - possible crashes
2. **Type safety** - Multiple `as any` casts in blockingHelpers.ts
3. **Missing env validation** - App crashes if env vars missing
4. **Deleted service imports** - Verify no broken imports

### Medium Priority
1. **Race conditions** in auth session restoration
2. **Unhandled promises** in subscription setup
3. **Route param validation** missing

### TODOs in Code
```
src/screens/SubscriptionScreen.tsx:106    // TODO: Implement Stripe checkout
src/screens/SubscriptionScreen.tsx:118    // TODO: Open Stripe customer portal
src/screens/InviteCollaboratorScreen.tsx:180  // TODO: Create notification for invited user
src/screens/SettingsScreen.tsx:151        // TODO: Implement data export
src/screens/BillingHistoryScreen.tsx:89   // TODO: Implement invoice download from Stripe
src/components/ErrorBoundary.tsx:48       // TODO: Send error to monitoring service
src/utils/fileUpload.util.ts:99           // TODO: Implement multipart upload
```

---

## Audio File Support

### Supported Formats
| Format | Extensions | Type | Notes |
|--------|------------|------|-------|
| WAV | .wav | Lossless | Best quality |
| FLAC | .flac | Lossless | Compressed lossless |
| AIFF | .aiff, .aif | Lossless | Apple format |
| ALAC | .m4a | Lossless | Apple lossless |
| MP3 | .mp3 | Lossy | Most compatible |
| AAC | .aac, .m4a | Lossy | Good quality/size |
| OGG | .ogg | Lossy | Open format |
| OPUS | .opus | Lossy | Modern, efficient |
| MIDI | .mid, .midi | Data | Note data only |

### Limits
- **Max file size**: 500 MB (configurable)
- **Supabase free tier**: 50 MB per upload
- **Max duration warning**: 30 minutes

---

## Key Technical Patterns

### Audio URL Generation
Audio files use **signed URLs** for secure access:
```typescript
// In audio.service.ts
const { data } = await supabase.storage
  .from('audio-files')
  .createSignedUrl(filePath, 3600) // 1 hour expiry
```

### Real-time Subscriptions
Comments and chat use Supabase real-time:
```typescript
const subscription = supabase
  .channel(`project-${projectId}`)
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'comments'
  }, handleNewComment)
  .subscribe()
```

### Role Permission Check
```typescript
// In project.service.ts
const rolePermissions = {
  owner: { can_edit: true, can_delete: true, can_invite: true, can_upload: true, can_comment: true, can_download: true },
  admin: { can_edit: true, can_delete: true, can_invite: true, can_upload: true, can_comment: true, can_download: true },
  editor: { can_edit: true, can_delete: false, can_invite: false, can_upload: true, can_comment: true, can_download: true },
  commenter: { can_edit: false, can_delete: false, can_invite: false, can_upload: false, can_comment: true, can_download: true },
  viewer: { can_edit: false, can_delete: false, can_invite: false, can_upload: false, can_comment: false, can_download: true },
}
```

---

## Development Commands

```bash
# Start development
npx expo start --clear

# Run on iOS simulator
npx expo run:ios

# Run on physical device
npx expo run:ios --device

# Build for TestFlight
eas build --platform ios --profile production

# TypeScript check
npx tsc --noEmit

# Check Supabase types
npx supabase gen types typescript --local > src/types/supabase.ts
```

---

## File Size Reference

| File | Lines | Notes |
|------|-------|-------|
| `ProjectStudioScreen.tsx` | 3,981 | Core mixing/playback screen |
| `AudioTrackPopup.tsx` | ~800 | Track details component |
| `audio.service.ts` | 412 | Audio service |
| `activity.service.ts` | 372 | Activity feed service |

---

## Recent Development (Current Branch)

**Branch**: `feature/new-navigation-pill-system`

### New Components Added
- `NavigationPill.tsx` - Animated corner navigation
- `ThinHeader.tsx` - Minimal header
- `CompactHeader.tsx` - Compact project header
- `BackButton.tsx` - Context-aware back button

### New Contexts Added
- `NavigationContext.tsx` - Pill expansion state
- `PreferencesContext.tsx` - User preferences (handedness)

### Navigation Changes
- Replaced bottom tab bar with corner pill navigation
- Zero-animation tab transitions
- Handedness support (left/right-handed users)
- Spring physics animations

---

## Deployment Checklist

### Before TestFlight
- [ ] Remove/wrap console.log statements in `__DEV__`
- [ ] Set `BETA_MODE_ENABLED` appropriately
- [ ] Verify all env vars are set in EAS secrets
- [ ] Test all critical flows (signup, project creation, audio upload)
- [ ] Hide or disable non-functional features (Stripe, billing)
- [ ] Verify no imports of deleted services

### Before Production
- [ ] Integrate Stripe for subscriptions
- [ ] Implement notification system
- [ ] Add Sentry error monitoring
- [ ] Remove mock billing data
- [ ] Disable beta auto-Pro-grant
- [ ] Security audit of RLS policies

---

## Quick Links to Key Files

| Purpose | File Path |
|---------|-----------|
| Root component | `App.tsx` |
| Main navigation | `src/navigation/AppNavigator.tsx` |
| Tab navigation | `src/navigation/MainNavigator.tsx` |
| Auth context | `src/contexts/AuthContext.tsx` |
| Supabase client | `src/lib/supabase.ts` |
| Theme/colors | `src/constants/theme.ts` |
| Beta config | `src/config/beta.config.ts` |
| Audio service | `src/services/audio.service.ts` |
| Project service | `src/services/project.service.ts` |
| Core studio screen | `src/screens/ProjectStudioScreen.tsx` |

---

*Last updated: December 2024*
*Document version: 1.0*
