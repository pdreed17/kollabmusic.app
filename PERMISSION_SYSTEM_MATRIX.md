# Permission System Matrix - Kollab Music App

## Overview
The app has a comprehensive permission system for collaborators, plus special handling for public project viewers.

---

## Collaborator Roles (InviteCollaboratorScreen)

### 1. Owner (Project Creator)
```typescript
{
  can_edit: true,
  can_delete: true,
  can_invite: true,
  can_upload: true,
  can_comment: true,
  can_download: true
}
```
**Full control** over the project. Can access project chat.

### 2. Admin
```typescript
{
  can_edit: true,
  can_delete: true,
  can_invite: true,
  can_upload: true,
  can_comment: true,
  can_download: true
}
```
**Almost like owner** - can do everything except transfer ownership. Can access project chat.

### 3. Editor
```typescript
{
  can_edit: true,
  can_delete: false,
  can_invite: false,
  can_upload: true,
  can_comment: true,
  can_download: true
}
```
**Can create and modify** content but not delete or invite. Can access project chat.

---

## Public Project Viewers (Non-Collaborators)

When someone views a **public project** without being a collaborator, they get:

```typescript
{
  can_view: true,         // Can see project details
  can_play: true,         // Can play/listen to audio
  can_comment: true,      // Can leave comments (social media style)
  can_edit: false,        // Cannot edit audio or project
  can_delete: false,      // Cannot delete anything
  can_invite: false,      // Cannot invite collaborators
  can_upload: false,      // Cannot upload audio files
  can_download: false     // Cannot download audio files
}
```

### Social Media Style Access
- ✅ View public project details
- ✅ Open project in studio (playback mode only)
- ✅ Listen to all audio files
- ✅ View waveforms and timeline
- ✅ Leave comments (when enabled)
- ❌ Upload new audio
- ❌ Edit existing audio (mixer controls disabled)
- ❌ Delete audio files
- ❌ Edit project settings
- ❌ Invite others
- ❌ Download audio files

---

## Private Projects

Private projects are **only accessible to collaborators**:
- Non-collaborators get "Access Denied" message
- Project does NOT appear in activity feeds
- Cannot be viewed at all without being invited

---

## Permission Matrix by Screen

### ProjectDetailScreen
| Action | Owner | Admin | Editor | Public Viewer |
|--------|-------|-------|--------|---------------|
| View Details | ✅ | ✅ | ✅ | ✅ (if public) |
| Open Studio | ✅ | ✅ | ✅ | ✅ (if public) |
| Upload Audio | ✅ | ✅ | ✅ | ❌ |
| Edit Project | ✅ | ❌ | ❌ | ❌ |
| Invite Collab | ✅ | ✅ | ❌ | ❌ |
| Access Chat | ✅ | ✅ | ✅ | ❌ |

### ProjectStudioScreen
| Action | Owner | Admin | Editor | Public Viewer |
|--------|-------|-------|--------|---------------|
| Play Audio | ✅ | ✅ | ✅ | ✅ (if public) |
| View Waveform | ✅ | ✅ | ✅ | ✅ (if public) |
| Mixer Controls | ✅ | ✅ | ✅ | ❌ |
| Upload Audio | ✅ | ✅ | ✅ | ❌ |
| Edit Metadata | ✅ | ✅ | ✅ | ❌ |
| Delete Audio | ✅ | ✅ | ❌ | ❌ |
| Download Audio | ✅ | ✅ | ✅ | ❌ |
| Add Comment | ✅ | ✅ | ✅ | ✅ (if public) |
| Access Chat | ✅ | ✅ | ✅ | ❌ |

### AudioUploadScreen
| Action | Owner | Admin | Editor | Public Viewer |
|--------|-------|-------|--------|---------------|
| Access Screen | ✅ | ✅ | ✅ | ❌ |
| Upload Files | ✅ | ✅ | ✅ | ❌ |

### EditProjectScreen
| Action | Owner | Admin | Editor | Public Viewer |
|--------|-------|-------|--------|---------------|
| Access Screen | ✅ | ❌ | ❌ | ❌ |
| Edit Settings | ✅ | ❌ | ❌ | ❌ |
| Delete Project | ✅ | ❌ | ❌ | ❌ |

### AudioTrackPopup
| Action | Owner | Admin | Editor | Public Viewer |
|--------|-------|-------|--------|---------------|
| View Details | ✅ | ✅ | ✅ | ✅ (if public) |
| Edit Metadata | ✅ | ✅ | ✅ | ❌ |
| Delete Track | ✅ | ✅ | ❌ | ❌ |
| Download Track | ✅ | ✅ | ✅ | ❌ |

---

## Implementation Strategy

### 1. Check Permissions on Load
```typescript
const [userPermissions, setUserPermissions] = useState({
  can_view: false,
  can_play: false,
  can_edit: false,
  can_delete: false,
  can_invite: false,
  can_upload: false,
  can_comment: false,
  can_download: false
})

// In loadProjectData:
if (isOwner) {
  setUserPermissions({ /* all true */ })
} else if (isCollaborator) {
  setUserPermissions(collabPermissions)
} else if (project.is_public) {
  setUserPermissions({
    can_view: true,
    can_play: true,
    can_comment: true,
    /* rest false */
  })
}
```

### 2. Conditional Rendering
```typescript
{userPermissions.can_upload && (
  <TouchableOpacity onPress={() => navigate('AudioUpload')}>
    <Text>Upload</Text>
  </TouchableOpacity>
)}
```

### 3. Action Guards
```typescript
const handleDeleteAudio = () => {
  if (!userPermissions.can_delete) {
    Alert.alert('Permission Denied', 'You cannot delete audio files')
    return
  }
  // proceed with delete
}
```

---

## Database Schema

### project_collaborators table
```sql
CREATE TABLE project_collaborators (
  id UUID PRIMARY KEY,
  project_id UUID REFERENCES projects(id),
  user_id UUID REFERENCES users(id),
  role TEXT,  -- 'owner', 'admin', 'editor', 'commenter', 'viewer'
  invitation_status TEXT,  -- 'pending', 'accepted', 'declined'
  can_edit BOOLEAN,
  can_delete BOOLEAN,
  can_invite BOOLEAN,
  can_upload BOOLEAN,
  can_comment BOOLEAN,
  can_download BOOLEAN,
  invited_by UUID REFERENCES users(id),
  created_at TIMESTAMP,
  invitation_accepted_at TIMESTAMP
)
```

---

## Summary

**The permission system works in 3 tiers:**

1. **Owner**: Full access + project chat access
2. **Collaborators**: Two roles with chat access
   - **Admin**: Can edit, delete, upload, download, invite + chat access
   - **Editor**: Can edit, upload, download + chat access (cannot delete or invite)
3. **Public Viewers**: View + Play + Comment only (social media style, no chat access)
4. **No Access**: Private projects for non-collaborators

**Key Points:**
- Only Owner, Admin, and Editor can access project chat
- Public viewers can comment on public projects but cannot access chat
- This creates a social media-style experience where public projects are discoverable and playable, while maintaining full control over who can collaborate and communicate privately
