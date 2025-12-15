# Public Project Access Implementation Plan

## Overview
Implement social media-style public/private project system with proper access controls.

## Role Changes (December 2025)

**Removed Roles**: Commenter and Viewer roles have been removed from the system.

**Remaining Roles**:
- **Owner**: Full access + chat access
- **Admin**: Can edit, delete, upload, download, invite + chat access
- **Editor**: Can edit, upload, download + chat access (cannot delete or invite)

**Chat Access**: Only Owner, Admin, and Editor can access project chat. Public viewers cannot see or access chat.

---

## ✅ COMPLETED

### 1. HomeScreen Activity Feed
- Updated `loadActivityFeed()` to query `projects` and `audio_files` tables instead of `comments`
- Only shows public projects (`is_public = true`)
- Shows two activity types:
  - `project_created`: When someone creates a new project
  - `file_uploaded`: When someone uploads audio to a project
- Added navigation: clicking activity navigates to ProjectDetail
- Activity displays user name, project title, genre, and time ago

##🚧 TODO

### 2. ActivityScreen Updates (NEXT STEP)
**File**: `src/screens/ActivityScreen.tsx`

Update `loadActivities()` function (lines 226-260) similar to HomeScreen:
```typescript
// Replace comment-based query with project + audio file queries
// Same structure as HomeScreen loadActivityFeed()
```

### 3. ProjectDetailScreen - Public Access
**File**: `src/screens/ProjectDetailScreen.tsx`

**Current**: Only loads if user is a collaborator
**Needed**: Allow viewing public projects even if not a collaborator

Changes needed (line 60-105 `loadProjectData`):
```typescript
// Check if project is public
if (projectData.is_public) {
  // Allow viewing
  setIsPublicViewer(true)  // New state variable
} else {
  // Check if user is collaborator
  const isCollaborator = await checkUserIsCollaborator(user.id, projectId)
  if (!isCollaborator) {
    Alert.alert('Access Denied', 'This project is private')
    navigation.goBack()
    return
  }
}
```

Add state:
```typescript
const [isPublicViewer, setIsPublicViewer] = useState(false)
const [isCollaborator, setIsCollaborator] = useState(false)
```

Hide edit buttons if `isPublicViewer`:
- Edit Project button
- Delete Project button
- Add Collaborator button
- Upload Audio button

### 4. StudioScreen - Public Playback
**File**: Need to find StudioScreen location

**Current**: Probably restricted to collaborators only
**Needed**: Allow playback for public projects, restrict editing

Changes needed:
```typescript
// In loadProject or similar:
if (project.is_public) {
  setIsPublicViewer(true)
  // Allow playback only
} else {
  // Check collaborator status
}

// Disable these actions if isPublicViewer:
- Upload audio
- Delete audio
- Edit audio metadata
- Mixer controls (volume, pan, mute, solo)
- Editing project settings
```

Allow these actions for public viewers:
- Play/pause audio
- View waveforms
- View project info
- Add comments (if we re-enable comments later)

### 5. Permission Checks Throughout App

**Files to update**:
- `src/components/AudioTrackPopup.tsx` - Check permissions before allowing edits
- `src/screens/EditProjectScreen.tsx` - Already has some permission checks, verify they work
- `src/screens/AudioUploadScreen.tsx` - Check if user can upload

**Add permission helper**:
```typescript
// src/utils/permissions.ts
export const checkProjectPermissions = async (userId: string, projectId: string) => {
  // Check if user is creator
  const { data: project } = await supabase
    .from('projects')
    .select('creator_id, is_public')
    .eq('id', projectId)
    .single()

  if (project.creator_id === userId) {
    return { canView: true, canEdit: true, canDelete: true, canUpload: true }
  }

  // Check if collaborator
  const { data: collab } = await supabase
    .from('project_collaborators')
    .select('can_edit, can_delete, can_upload')
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .eq('invitation_status', 'accepted')
    .single()

  if (collab) {
    return {
      canView: true,
      canEdit: collab.can_edit,
      canDelete: collab.can_delete,
      canUpload: collab.can_upload
    }
  }

  // Check if public project (view-only)
  if (project.is_public) {
    return { canView: true, canEdit: false, canDelete: false, canUpload: false }
  }

  // No access
  return { canView: false, canEdit: false, canDelete: false, canUpload: false }
}
```

### 6. Comment Permissions (Future)

When re-enabling comments:
- Public project viewers CAN add comments
- Users can delete their OWN comments only
- Project owners/admins can delete any comment

### 7. Database RLS Policies

Update Supabase RLS policies:

**projects table**:
```sql
-- Allow reading public projects
CREATE POLICY "Anyone can view public projects"
ON projects FOR SELECT
USING (is_public = true OR creator_id = auth.uid());
```

**audio_files table**:
```sql
-- Allow reading audio files from public projects
CREATE POLICY "Anyone can view audio files from public projects"
ON audio_files FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = audio_files.project_id
    AND (projects.is_public = true OR projects.creator_id = auth.uid())
  )
);
```

### 8. Testing Checklist

- [ ] Public project appears in activity feed
- [ ] Private project does NOT appear in activity feed
- [ ] Clicking activity navigates to ProjectDetail
- [ ] Public project can be viewed by non-collaborators
- [ ] Public project playback works for non-collaborators
- [ ] Non-collaborators cannot edit/upload/delete in public projects
- [ ] Private projects are not accessible to non-collaborators
- [ ] Collaborators maintain all their existing permissions
- [ ] Project owners maintain full control

## Implementation Order

1. ✅ Update HomeScreen activity feed
2. Update ActivityScreen (same pattern as HomeScreen)
3. Update ProjectDetailScreen for public viewing
4. Find and update StudioScreen for public playback
5. Add permission checks throughout
6. Update RLS policies
7. Test all scenarios

## Current File Status

### Modified Files:
- ✅ `src/screens/HomeScreen.tsx` - Activity feed updated

### Files to Modify:
- `src/screens/ActivityScreen.tsx`
- `src/screens/ProjectDetailScreen.tsx`
- `src/screens/StudioScreen.tsx` (need to locate)
- `src/components/AudioTrackPopup.tsx`
- `src/screens/AudioUploadScreen.tsx`
- Create: `src/utils/permissions.ts`

### SQL Files to Create:
- `supabase_migration_public_project_access.sql`
