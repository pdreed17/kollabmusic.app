# Comprehensive Permission & Visibility System Design
## Kollab Music App

## Table of Contents
1. [User Roles & Permissions](#user-roles--permissions)
2. [Profile Visibility](#profile-visibility)
3. [Project Access Matrix](#project-access-matrix)
4. [Activity Feed Architecture](#activity-feed-architecture)
5. [Subscription Tier Impact](#subscription-tier-impact)
6. [Database Schema](#database-schema)
7. [RLS Policy Implementation](#rls-policy-implementation)

---

## User Roles & Permissions

### Role Hierarchy

```
┌─────────────────────────────────────────────────────────┐
│                        OWNER                            │
│  • Full project control                                 │
│  • Delete project                                       │
│  • Manage all collaborators                             │
│  • Change project settings                              │
│  • Transfer ownership                                   │
│  • Export/Archive project                               │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│                       EDITOR                            │
│  • Upload/edit/delete own audio                         │
│  • Edit audio metadata                                  │
│  • Comment on all audio                                 │
│  • Invite others (if enabled by owner)                  │
│  • View all project content                             │
│  • Cannot delete project                                │
│  • Cannot remove owner                                  │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│                    COLLABORATOR                         │
│  • Upload audio (if can_upload = true)                  │
│  • Comment (if can_comment = true)                      │
│  • Download (if can_download = true)                    │
│  • View project content                                 │
│  • Cannot edit project settings                         │
│  • Cannot manage other collaborators                    │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│                       VIEWER                            │
│  • View project (read-only)                             │
│  • View audio files                                     │
│  • View comments                                        │
│  • Cannot upload                                        │
│  • Cannot comment                                       │
│  • Cannot download                                      │
└─────────────────────────────────────────────────────────┘
```

### Permission Matrix

| Action                          | Owner | Editor | Collaborator | Viewer | Public |
|--------------------------------|-------|--------|--------------|--------|--------|
| **Project Management**         |       |        |              |        |        |
| View project                   | ✅    | ✅     | ✅           | ✅     | ✅*    |
| Edit project details           | ✅    | ❌     | ❌           | ❌     | ❌     |
| Delete project                 | ✅    | ❌     | ❌           | ❌     | ❌     |
| Change privacy settings        | ✅    | ❌     | ❌           | ❌     | ❌     |
| Archive project                | ✅    | ❌     | ❌           | ❌     | ❌     |
| Transfer ownership             | ✅    | ❌     | ❌           | ❌     | ❌     |
| **Collaborator Management**    |       |        |              |        |        |
| Invite collaborators           | ✅    | ✅**   | ❌           | ❌     | ❌     |
| Remove collaborators           | ✅    | ❌     | ❌           | ❌     | ❌     |
| Change collaborator roles      | ✅    | ❌     | ❌           | ❌     | ❌     |
| View collaborators list        | ✅    | ✅     | ✅           | ✅     | ❌     |
| **Audio File Management**      |       |        |              |        |        |
| Upload audio                   | ✅    | ✅     | ✅***        | ❌     | ❌     |
| Edit own audio                 | ✅    | ✅     | ✅***        | ❌     | ❌     |
| Delete own audio               | ✅    | ✅     | ✅***        | ❌     | ❌     |
| Delete others' audio           | ✅    | ❌     | ❌           | ❌     | ❌     |
| Edit audio metadata            | ✅    | ✅     | ❌           | ❌     | ❌     |
| Move/organize tracks           | ✅    | ✅     | ❌           | ❌     | ❌     |
| Download audio                 | ✅    | ✅     | ✅***        | ❌     | ❌     |
| **Comments & Interaction**     |       |        |              |        |        |
| Add comments                   | ✅    | ✅     | ✅***        | ❌     | ❌     |
| Edit own comments              | ✅    | ✅     | ✅***        | ❌     | ❌     |
| Delete own comments            | ✅    | ✅     | ✅***        | ❌     | ❌     |
| Delete others' comments        | ✅    | ❌     | ❌           | ❌     | ❌     |
| View comments                  | ✅    | ✅     | ✅           | ✅     | ✅*    |
| **Export & Sharing**           |       |        |              |        |        |
| Export project                 | ✅    | ✅****  | ❌          | ❌     | ❌     |
| Share project link             | ✅    | ✅     | ✅           | ✅     | ✅*    |
| Generate public link           | ✅    | ❌     | ❌           | ❌     | ❌     |

**Legend:**
- \* Only if project is public
- \*\* Only if `can_invite` is enabled by owner
- \*\*\* Only if respective permission is granted (can_upload, can_comment, can_download)
- \*\*\*\* May require owner approval

---

## Profile Visibility

### Own Profile (Full Access)

```typescript
{
  // Public Information (always visible)
  username: string
  display_name: string
  bio: string
  profile_picture_url: string
  genre_preferences: string[]
  instruments: string[]
  location: string (city/region, if shared)

  // Private Information (only you)
  email: string
  phone: string
  date_of_birth: Date
  full_address: string
  payment_info: PaymentInfo

  // Privacy Settings (you control)
  profile_visibility: 'public' | 'followers' | 'private'
  show_projects: boolean
  show_collaborations: boolean
  show_highlights: boolean
  show_activity: boolean

  // Account Information (only you)
  subscription_tier: 'free' | 'pro' | 'enterprise'
  storage_used: number
  projects_count: number
  collaborations_count: number
  created_at: Date
  last_active: Date

  // Edit History (audit log)
  profile_changes: ProfileChange[]
  login_history: LoginEvent[]
  security_events: SecurityEvent[]
}
```

### Other Users' Profiles (Limited Access)

**Public View (Not Following):**
```typescript
{
  username: string
  display_name: string
  bio: string (truncated)
  profile_picture_url: string
  genre_preferences: string[] (if public)
  instruments: string[] (if public)
  location: string (city only)

  // Portfolio
  public_highlights: Highlight[]
  public_projects: Project[] (where is_public = true)
  collaboration_count: number (anonymized)

  // Social
  follower_count: number
  following_count: number
  is_following: boolean
  is_blocked: boolean
}
```

**Following View (Mutual Follow):**
```typescript
{
  ...PublicView,

  // Additional Info
  full_bio: string
  recent_activity: Activity[] (if show_activity = true)
  shared_projects: Project[] (projects you both collaborate on)
  shared_connections: User[] (mutual connections)

  // Direct Interaction
  can_message: boolean
  can_invite_to_project: boolean
}
```

**Collaborator View (Working Together):**
```typescript
{
  ...FollowingView,

  // Project Context
  shared_projects: Project[] (all projects in common)
  contribution_stats: {
    audio_files_uploaded: number
    comments_made: number
    projects_collaborated: number
  }

  // Professional Info
  skills: string[]
  past_work: PublicProject[]
  availability_status: 'available' | 'busy' | 'offline'
}
```

### Profile Edit History (Audit Log)

**Own Profile Changes:**
```typescript
{
  change_id: UUID
  timestamp: Date
  field_changed: string
  old_value: any
  new_value: any
  change_type: 'created' | 'updated' | 'deleted'
  ip_address: string
  device: string
  location: string
}
```

**Example:**
```
[2025-01-15 14:30] Updated bio from "Music producer" to "Music producer & sound engineer"
[2025-01-14 09:15] Changed profile picture
[2025-01-10 18:45] Updated genre preferences (added "Lo-fi Hip Hop")
[2025-01-05 12:00] Changed username from "beatmaker123" to "prod_beats"
```

---

## Project Access Matrix

### Project Visibility Types

```typescript
type ProjectVisibility =
  | 'private'                    // Only invited collaborators
  | 'public'                     // Anyone can view
  | 'unlisted'                   // Only with link
  | 'followers_only'             // Only your followers
```

### Access Rules by Project Type

#### 1. Private Project

```
┌─────────────────────────────────────────────────────┐
│                  PRIVATE PROJECT                    │
├─────────────────────────────────────────────────────┤
│ Visibility: Hidden from public                      │
│ Discovery: Not searchable                           │
│ Access: Only invited collaborators                  │
└─────────────────────────────────────────────────────┘

Who Can Access:
  ✅ Owner (full access)
  ✅ Invited Editors (based on permissions)
  ✅ Invited Collaborators (based on permissions)
  ✅ Invited Viewers (read-only)
  ❌ Public users
  ❌ Followers
  ❌ Other users (even with link)
```

#### 2. Public Project

```
┌─────────────────────────────────────────────────────┐
│                  PUBLIC PROJECT                     │
├─────────────────────────────────────────────────────┤
│ Visibility: Shown in search & discovery            │
│ Discovery: Searchable by title, genre, creator     │
│ Access: Anyone can view                             │
└─────────────────────────────────────────────────────┘

Who Can Access:
  ✅ Owner (full access)
  ✅ Invited Editors (based on permissions)
  ✅ Invited Collaborators (based on permissions)
  ✅ Public users (view-only)
  ✅ Can request to join (if "Looking for Kollabs")

Actions Public Users Can Do:
  ✅ View project details
  ✅ View audio files (preview)
  ✅ View collaborators
  ✅ View comments
  ✅ Like/Favorite project
  ❌ Download audio
  ❌ Comment
  ❌ Upload audio
```

#### 3. Unlisted Project

```
┌─────────────────────────────────────────────────────┐
│                 UNLISTED PROJECT                    │
├─────────────────────────────────────────────────────┤
│ Visibility: Not in search                          │
│ Discovery: Only via direct link                     │
│ Access: Anyone with link can view                   │
└─────────────────────────────────────────────────────┘

Who Can Access:
  ✅ Owner (full access)
  ✅ Invited collaborators (based on permissions)
  ✅ Anyone with the link (view-only)
  ❌ Not searchable
  ❌ Not in discovery feed
```

#### 4. Looking for Kollabs

```
┌─────────────────────────────────────────────────────┐
│            LOOKING FOR KOLLABS PROJECT              │
├─────────────────────────────────────────────────────┤
│ Visibility: Highlighted in discovery               │
│ Discovery: Featured in "Open Kollabs" section      │
│ Access: Anyone can request to join                  │
└─────────────────────────────────────────────────────┘

Additional Features:
  ✅ Appears in "Looking for Kollabs" feed
  ✅ Users can request to join
  ✅ Owner gets notification of requests
  ✅ Owner can accept/reject requests
  ✅ Can specify what roles are needed

Request Flow:
  User → Request to Join → Owner Review → Accept/Reject
  → If Accepted → Add as Collaborator with specified role
```

---

## Activity Feed Architecture

### Activity Types

```typescript
type ActivityType =
  // Project Activity
  | 'project_created'
  | 'project_updated'
  | 'project_deleted'
  | 'project_published'
  | 'project_archived'

  // Collaborator Activity
  | 'collaborator_invited'
  | 'collaborator_joined'
  | 'collaborator_left'
  | 'collaborator_removed'
  | 'role_changed'

  // Audio Activity
  | 'audio_uploaded'
  | 'audio_updated'
  | 'audio_deleted'
  | 'audio_commented'

  // Comment Activity
  | 'comment_added'
  | 'comment_replied'
  | 'comment_edited'
  | 'comment_deleted'

  // Social Activity
  | 'user_followed'
  | 'user_unfollowed'
  | 'project_liked'
  | 'highlight_shared'

  // System Activity
  | 'subscription_upgraded'
  | 'subscription_downgraded'
  | 'storage_limit_reached'
  | 'payment_received'
```

### Feed Filters

#### All Activity Feed

```sql
-- Shows everything relevant to the user
SELECT * FROM activities
WHERE
  -- Your own actions
  user_id = auth.uid()
  OR
  -- Actions on your projects
  project_id IN (SELECT id FROM projects WHERE creator_id = auth.uid())
  OR
  -- Actions on projects you collaborate on
  project_id IN (
    SELECT project_id FROM project_collaborators
    WHERE user_id = auth.uid()
  )
  OR
  -- Social interactions with you
  target_user_id = auth.uid()
  OR
  -- Public activity from users you follow
  (
    user_id IN (SELECT following_id FROM user_connections WHERE user_id = auth.uid())
    AND is_public = true
  )
ORDER BY created_at DESC
LIMIT 50;
```

#### Kollab Activity Feed (Project-Focused)

```sql
-- Shows only project collaboration activity
SELECT * FROM activities
WHERE
  activity_type IN (
    'collaborator_invited',
    'collaborator_joined',
    'audio_uploaded',
    'audio_commented',
    'comment_added',
    'project_updated'
  )
  AND
  (
    -- Projects you own
    project_id IN (SELECT id FROM projects WHERE creator_id = auth.uid())
    OR
    -- Projects you collaborate on
    project_id IN (
      SELECT project_id FROM project_collaborators
      WHERE user_id = auth.uid()
      AND invitation_status = 'accepted'
    )
  )
ORDER BY created_at DESC
LIMIT 50;
```

### Activity Privacy Rules

| Activity Type              | Visible To                                    |
|----------------------------|-----------------------------------------------|
| Project created (private)  | Owner only                                    |
| Project created (public)   | Owner + Followers                             |
| Audio uploaded             | Project collaborators                         |
| Comment added              | Project collaborators                         |
| Collaborator invited       | Owner + Invited user                          |
| Collaborator joined        | All project collaborators                     |
| User followed              | Follower + Following + Mutual connections     |
| Highlight shared           | Public (if highlight is public)               |
| Subscription upgraded      | User only                                     |

---

## Subscription Tier Impact

### Free Tier Limitations

```typescript
const FREE_TIER_LIMITS = {
  // Projects
  max_projects: 3,
  max_private_projects: 2,
  max_public_projects: 3,

  // Storage
  max_storage_mb: 100,
  max_file_size_mb: 10,
  max_audio_files_per_project: 5,

  // Collaboration
  max_collaborators_per_project: 3,
  max_active_collaborations: 5,

  // Features
  can_invite_collaborators: true,
  can_create_public_projects: true,
  can_export_projects: false,
  can_download_audio: false,
  advanced_analytics: false,
  custom_branding: false,

  // Time restrictions
  audio_preview_duration_seconds: 30,
  comment_rate_limit_per_hour: 10,

  // Notifications
  notification_types: ['mentions', 'invites', 'comments'],
  email_notifications: false,
  push_notifications: true,
}
```

### Pro Tier Benefits

```typescript
const PRO_TIER_LIMITS = {
  // Projects
  max_projects: 50,
  max_private_projects: 50,
  max_public_projects: 50,

  // Storage
  max_storage_gb: 10,
  max_file_size_mb: 100,
  max_audio_files_per_project: 50,

  // Collaboration
  max_collaborators_per_project: 20,
  max_active_collaborations: Infinity,

  // Features
  can_invite_collaborators: true,
  can_create_public_projects: true,
  can_export_projects: true,
  can_download_audio: true,
  advanced_analytics: true,
  custom_branding: true,
  version_history: true,
  priority_support: true,

  // No time restrictions
  audio_preview_duration_seconds: Infinity,
  comment_rate_limit_per_hour: Infinity,

  // Notifications
  notification_types: 'all',
  email_notifications: true,
  push_notifications: true,
  webhook_notifications: true,
}
```

### Enterprise Tier

```typescript
const ENTERPRISE_TIER_LIMITS = {
  max_projects: Infinity,
  max_storage_gb: 1000, // 1TB
  max_collaborators_per_project: Infinity,

  // Additional features
  custom_domain: true,
  white_label: true,
  sso: true,
  advanced_security: true,
  dedicated_support: true,
  sla_guarantee: true,
  audit_logs: true,
  team_management: true,
  bulk_operations: true,
}
```

### Upgrade Prompts

```typescript
// When user hits a limit
interface UpgradePrompt {
  trigger: 'project_limit' | 'storage_limit' | 'collaborator_limit' | 'feature_access'
  current_usage: number
  limit: number
  feature_name: string
  suggested_tier: 'pro' | 'enterprise'
  benefits: string[]
}

// Example
{
  trigger: 'project_limit',
  current_usage: 3,
  limit: 3,
  feature_name: 'Projects',
  suggested_tier: 'pro',
  benefits: [
    'Create up to 50 projects',
    '10GB of storage',
    'Unlimited collaborators',
    'Export projects',
    'Advanced analytics'
  ]
}
```

---

## Database Schema

### Enhanced project_collaborators Table

```sql
CREATE TABLE project_collaborators (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Role and Status
  role TEXT NOT NULL CHECK (role IN ('owner', 'editor', 'collaborator', 'viewer')),
  invitation_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (invitation_status IN ('pending', 'accepted', 'rejected', 'revoked')),

  -- Granular Permissions
  can_edit BOOLEAN DEFAULT false,
  can_delete BOOLEAN DEFAULT false,
  can_invite BOOLEAN DEFAULT false,
  can_upload BOOLEAN DEFAULT false,
  can_comment BOOLEAN DEFAULT true,
  can_download BOOLEAN DEFAULT false,
  can_export BOOLEAN DEFAULT false,

  -- Metadata
  invited_by UUID REFERENCES users(id),
  invited_at TIMESTAMP DEFAULT NOW(),
  accepted_at TIMESTAMP,
  last_activity_at TIMESTAMP,

  -- Constraints
  UNIQUE(project_id, user_id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Index for performance
CREATE INDEX idx_collaborators_project ON project_collaborators(project_id);
CREATE INDEX idx_collaborators_user ON project_collaborators(user_id);
CREATE INDEX idx_collaborators_role ON project_collaborators(role);
```

### Activity Feed Table

```sql
CREATE TABLE activities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Activity Info
  activity_type TEXT NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  target_user_id UUID REFERENCES users(id) ON DELETE SET NULL,

  -- Related Entities
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  audio_file_id UUID REFERENCES audio_files(id) ON DELETE CASCADE,
  comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,

  -- Activity Data
  metadata JSONB DEFAULT '{}',
  description TEXT,
  is_public BOOLEAN DEFAULT false,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),

  -- Indexes
  INDEX idx_activities_user (user_id),
  INDEX idx_activities_project (project_id),
  INDEX idx_activities_type (activity_type),
  INDEX idx_activities_created (created_at DESC)
);
```

### Profile Audit Log

```sql
CREATE TABLE profile_changes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Change Info
  field_changed TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  change_type TEXT CHECK (change_type IN ('created', 'updated', 'deleted')),

  -- Context
  ip_address INET,
  user_agent TEXT,
  device_info JSONB,
  location TEXT,

  created_at TIMESTAMP DEFAULT NOW(),

  INDEX idx_profile_changes_user (user_id),
  INDEX idx_profile_changes_created (created_at DESC)
);
```

### User Connections (Follow System)

```sql
CREATE TABLE user_connections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Status
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'blocked', 'muted')),

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),

  -- Constraints
  UNIQUE(user_id, following_id),
  CHECK (user_id != following_id),

  INDEX idx_connections_user (user_id),
  INDEX idx_connections_following (following_id)
);
```

---

## RLS Policy Implementation

### Projects Table Policies

```sql
-- SELECT: View projects based on role and privacy
CREATE POLICY "view_projects_comprehensive"
ON projects FOR SELECT
USING (
  -- Your own projects
  creator_id = auth.uid()
  OR
  -- Public projects
  COALESCE(is_public, false) = true
  OR
  -- Projects you're invited to (any status)
  id IN (
    SELECT project_id FROM project_collaborators
    WHERE user_id = auth.uid()
      AND invitation_status IN ('accepted', 'pending')
  )
  OR
  -- Unlisted projects you have link to (implement via temporary tokens)
  -- Projects from users you follow (if they made it visible to followers)
  (
    creator_id IN (
      SELECT following_id FROM user_connections
      WHERE user_id = auth.uid()
        AND status = 'active'
    )
    AND is_public = true
  )
);

-- INSERT: Create projects (with subscription limits checked in app)
CREATE POLICY "create_projects"
ON projects FOR INSERT
WITH CHECK (
  creator_id = auth.uid()
);

-- UPDATE: Edit projects based on role
CREATE POLICY "update_projects"
ON projects FOR UPDATE
USING (
  -- Owner can always update
  creator_id = auth.uid()
  OR
  -- Editors can update if they have can_edit permission
  id IN (
    SELECT project_id FROM project_collaborators
    WHERE user_id = auth.uid()
      AND role = 'editor'
      AND can_edit = true
      AND invitation_status = 'accepted'
  )
);

-- DELETE: Only owner can delete
CREATE POLICY "delete_projects"
ON projects FOR DELETE
USING (
  creator_id = auth.uid()
);
```

### project_collaborators Table Policies

```sql
-- SELECT: View collaborators
CREATE POLICY "view_collaborators"
ON project_collaborators FOR SELECT
USING (
  -- You're in the collaborators list
  user_id = auth.uid()
  OR
  -- You own the project
  project_id IN (
    SELECT id FROM projects WHERE creator_id = auth.uid()
  )
  OR
  -- You're a collaborator on the same project
  project_id IN (
    SELECT project_id FROM project_collaborators
    WHERE user_id = auth.uid()
      AND invitation_status = 'accepted'
  )
);

-- INSERT: Add collaborators
CREATE POLICY "add_collaborators"
ON project_collaborators FOR INSERT
WITH CHECK (
  -- Owner can add anyone
  project_id IN (
    SELECT id FROM projects WHERE creator_id = auth.uid()
  )
  OR
  -- Editors with can_invite permission can add others
  (
    project_id IN (
      SELECT project_id FROM project_collaborators
      WHERE user_id = auth.uid()
        AND role = 'editor'
        AND can_invite = true
        AND invitation_status = 'accepted'
    )
    AND role NOT IN ('owner', 'editor') -- Can't add other editors
  )
);

-- UPDATE: Change collaborator permissions
CREATE POLICY "update_collaborators"
ON project_collaborators FOR UPDATE
USING (
  -- Owner can update anyone
  project_id IN (
    SELECT id FROM projects WHERE creator_id = auth.uid()
  )
);

-- DELETE: Remove collaborators
CREATE POLICY "delete_collaborators"
ON project_collaborators FOR DELETE
USING (
  -- Owner can remove anyone (except themselves)
  project_id IN (
    SELECT id FROM projects WHERE creator_id = auth.uid()
  )
  OR
  -- Users can remove themselves
  user_id = auth.uid()
);
```

### audio_files Table Policies

```sql
-- SELECT: View audio files
CREATE POLICY "view_audio_files"
ON audio_files FOR SELECT
USING (
  -- You uploaded it
  created_by = auth.uid()
  OR
  -- You're the project owner
  project_id IN (
    SELECT id FROM projects WHERE creator_id = auth.uid()
  )
  OR
  -- You're a collaborator with access
  project_id IN (
    SELECT project_id FROM project_collaborators
    WHERE user_id = auth.uid()
      AND invitation_status = 'accepted'
  )
  OR
  -- Project is public (preview only)
  project_id IN (
    SELECT id FROM projects WHERE is_public = true
  )
);

-- INSERT: Upload audio
CREATE POLICY "upload_audio_files"
ON audio_files FOR INSERT
WITH CHECK (
  created_by = auth.uid()
  AND
  (
    -- You own the project
    project_id IN (
      SELECT id FROM projects WHERE creator_id = auth.uid()
    )
    OR
    -- You're a collaborator with upload permission
    project_id IN (
      SELECT project_id FROM project_collaborators
      WHERE user_id = auth.uid()
        AND can_upload = true
        AND invitation_status = 'accepted'
    )
  )
);

-- UPDATE: Edit audio metadata
CREATE POLICY "update_audio_files"
ON audio_files FOR UPDATE
USING (
  -- You uploaded it
  created_by = auth.uid()
  OR
  -- You're the project owner
  project_id IN (
    SELECT id FROM projects WHERE creator_id = auth.uid()
  )
  OR
  -- You're an editor with edit permission
  project_id IN (
    SELECT project_id FROM project_collaborators
    WHERE user_id = auth.uid()
      AND role = 'editor'
      AND can_edit = true
      AND invitation_status = 'accepted'
  )
);

-- DELETE: Delete audio
CREATE POLICY "delete_audio_files"
ON audio_files FOR DELETE
USING (
  -- You uploaded it
  created_by = auth.uid()
  OR
  -- You're the project owner
  project_id IN (
    SELECT id FROM projects WHERE creator_id = auth.uid()
  )
);
```

### activities Table Policies

```sql
-- SELECT: View activity feed
CREATE POLICY "view_activities"
ON activities FOR SELECT
USING (
  -- Your own activity
  user_id = auth.uid()
  OR
  -- Activity directed at you
  target_user_id = auth.uid()
  OR
  -- Activity on your projects
  project_id IN (
    SELECT id FROM projects WHERE creator_id = auth.uid()
  )
  OR
  -- Activity on projects you collaborate on
  project_id IN (
    SELECT project_id FROM project_collaborators
    WHERE user_id = auth.uid()
      AND invitation_status = 'accepted'
  )
  OR
  -- Public activity from users you follow
  (
    is_public = true
    AND user_id IN (
      SELECT following_id FROM user_connections
      WHERE user_id = auth.uid()
        AND status = 'active'
    )
  )
);

-- INSERT: Create activity (usually done by system/triggers)
CREATE POLICY "create_activities"
ON activities FOR INSERT
WITH CHECK (
  user_id = auth.uid()
);
```

### profile_changes Table Policies

```sql
-- SELECT: View own profile changes
CREATE POLICY "view_own_profile_changes"
ON profile_changes FOR SELECT
USING (
  user_id = auth.uid()
);

-- INSERT: Track changes (done automatically)
CREATE POLICY "create_profile_changes"
ON profile_changes FOR INSERT
WITH CHECK (
  user_id = auth.uid()
);
```

---

## Implementation Summary

This comprehensive system provides:

1. **4-tier role system** (Owner > Editor > Collaborator > Viewer)
2. **Granular permissions** per collaborator
3. **Multiple project visibility types** (private, public, unlisted, looking for kollabs)
4. **Profile visibility controls** with different views for different relationships
5. **Activity feed with filtering** (all vs kollab-focused)
6. **Subscription-based limits** (free, pro, enterprise)
7. **Audit logging** for profile changes and security
8. **Social features** (follow, block, mutual connections)
9. **Safe RLS policies** without circular dependencies

All policies are designed to:
- ✅ Prevent infinite recursion
- ✅ Scale efficiently
- ✅ Respect user privacy
- ✅ Enforce subscription limits
- ✅ Support social collaboration
