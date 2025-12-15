# Kollab Music App

> A React Native/Expo music collaboration app that enables musicians to create projects, upload stems, invite collaborators, and provide timestamped feedback.

## Project Overview

**Name:** kollab Music
**Version:** 1.0.0
**Platform:** iOS & Android (React Native with Expo)
**Bundle ID:** com.creategood.kollabMusic
**Backend:** Supabase (PostgreSQL, Auth, Storage, Realtime)

### Core Purpose

Kollab is a "collaborative DAW companion" focused on **creation and feedback**, not distribution. Musicians can:
- Create music projects with metadata (BPM, key, genre)
- Upload audio stems/tracks
- Invite collaborators with granular permissions
- Leave timestamped comments on specific audio moments
- Track contributions and activity
- Export projects to external DAWs

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | React Native 0.81.5 + Expo SDK 54 |
| Language | TypeScript 5.9.2 |
| Navigation | React Navigation 7.x |
| State | Zustand + React Query |
| Backend | Supabase (Postgres, Auth, Storage) |
| Audio | expo-av, Meyda, essentia.js |

---

## Project Structure

```
src/
├── components/       # Reusable UI components
├── config/           # App configuration (beta settings)
├── constants/        # Design tokens (theme.ts)
├── contexts/         # React contexts (Auth, Navigation, Preferences)
├── lib/              # Supabase client & generated types
├── navigation/       # React Navigation setup
├── screens/          # Screen components
├── services/         # Business logic & API calls
├── types/            # TypeScript definitions
└── utils/            # Helper utilities (responsive, caching)
```

---

## Design System

### Colors (Dark Theme)

```
Primary:     #6366F1 (Indigo)
Background:  #0F0F0F → #1A1A1A → #262626 (depth layers)
Text:        #FFFFFF / #9CA3AF / #6B7280
Border:      #404040

Stem Colors:
  Vocals: #F59E0B   Drums: #EF4444   Bass: #8B5CF6
  Guitar: #10B981   Keys: #3B82F6    Synth: #EC4899

Semantic:
  Success: #10B981  Warning: #F59E0B  Error: #EF4444
```

### Typography (Responsive)

```
hero: 32    h1: 24    h2: 20    h3: 18
bodyLarge: 16    body: 14    caption: 12    tiny: 10
```

### Spacing

```
xxs: 4    xs: 8    sm: 12    md: 16    lg: 24    xl: 32
```

### Responsive Scaling

All sizes scale based on device width (iPhone Pro Max = 1.0x baseline):
- Use `scale()` for width-based scaling
- Use `verticalScale()` for height-based
- Use `moderateScale()` for padding/margins
- Check `isTablet()` for tablet-specific layouts

---

## Key Components

### NavigationPill
Custom corner navigation that expands to show all tabs. Supports left/right handedness preference.

**Files:**
- `src/components/NavigationPill.tsx`
- `src/contexts/NavigationContext.tsx`
- `src/contexts/PreferencesContext.tsx`

### Project Studio
Audio workspace with multi-track timeline, waveforms, track controls, and timestamped comments.

---

## Database Tables

| Table | Purpose |
|-------|---------|
| `users` | Profiles, subscription info |
| `projects` | Music projects with metadata |
| `audio_files` | Tracks/stems |
| `project_collaborators` | Role-based permissions |
| `comments` | Timestamped audio feedback |
| `project_messages` | Real-time chat |
| `activities` | Contribution logging |
| `highlights` | Profile audio samples |
| `notifications` | Push notifications |

### Permission Roles

```
Owner  → Full control, can delete project
Admin  → Manage collaborators, edit settings
Editor → Upload, edit tracks, comment
Viewer → Read-only, can comment
```

---

## Subscription Tiers

| Feature | Free | Pro |
|---------|------|-----|
| Owned Projects | 3 | Unlimited |
| Collaborations | 5 | Unlimited |
| Tracks/Project | 8 | 50 |
| Storage | 500MB | 10GB |

---

## Code Patterns

### Services
All API calls go through `src/services/*.ts`:
```typescript
export const getProjects = async (userId: string) => {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('creator_id', userId)
  if (error) throw error
  return data
}
```

### Component Style
```typescript
import { Colors, Typography, Spacing } from '../constants/theme'

const styles = StyleSheet.create({
  container: {
    padding: Spacing.md,
    backgroundColor: Colors.surface,
  },
  title: {
    ...Typography.h2,
    color: Colors.text,
  },
})
```

---

## Navigation Structure

```
AppNavigator
├── Auth (logged out): Login, Signup, ForgotPassword
└── MainTabs (logged in): Home, Projects, Activity, Search, Profile
    + Modals: CreateProject, ProjectDetail, ProjectStudio, Settings...
```

---

## Commands

```bash
npm start          # Start Expo dev server
npm run ios        # Run on iOS simulator
npm run android    # Run on Android emulator
eas build          # Production build
```

---

## Key Differentiators

1. **Timestamped Comments** - Feedback at specific audio moments
2. **Granular Permissions** - Fine-grained collaborator control
3. **Contribution Tracking** - Activity log of all changes
4. **Handedness Navigation** - Left or right-handed UI
5. **DAW Companion** - Complements existing DAWs, doesn't replace

---

## Environment

Required `.env` variables:
```
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
```
