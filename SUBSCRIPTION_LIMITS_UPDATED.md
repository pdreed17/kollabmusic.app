# Subscription Tier Limits - Kollab Music App

## Free Tier

### Project Limits
- **Can CREATE:** 3 projects (as owner)
- **Can COLLABORATE ON:** 3 projects (as invited collaborator)
- **Total Active Projects:** 6 (3 owned + 3 collaborated)

### Audio Limits
- **Max tracks per project:** 8 audio files
- **File size limit:** 25 MB per file
- **Total storage:** 200 MB (~8 files per project × 3 projects)

### Collaboration
- **Collaborators per owned project:** 5 people
- **Can invite others:** Yes
- **Can be invited:** Yes (up to 3 projects)

### Features
- ✅ Create private projects
- ✅ Create public projects
- ✅ Upload/download audio
- ✅ Comment on tracks
- ✅ Basic notifications
- ✅ Profile & Highlights
- ❌ Export projects
- ❌ Advanced analytics
- ❌ Priority support
- ❌ Version history

### Restrictions
- 30-second preview for public users on your tracks
- Cannot exceed 3 owned projects
- Cannot exceed 3 collaborated projects
- 8 tracks max per project
- Basic activity feed only

---

## Pro Tier ($9.99/month or $99/year)

### Project Limits
- **Can CREATE:** ♾️ Unlimited projects
- **Can COLLABORATE ON:** ♾️ Unlimited projects
- **Total Active Projects:** ♾️ No limit

### Audio Limits
- **Max tracks per project:** ♾️ Unlimited audio files
- **File size limit:** 500 MB per file
- **Total storage:** 50 GB

### Collaboration
- **Collaborators per project:** ♾️ Unlimited
- **Can invite others:** Yes
- **Can be invited:** Yes (unlimited)

### Features
- ✅ Everything from Free Tier
- ✅ Unlimited projects (create & collaborate)
- ✅ Unlimited audio uploads per project
- ✅ Export projects (stems, mixdowns)
- ✅ Advanced analytics & insights
- ✅ Version history & rollback
- ✅ Priority support
- ✅ Custom profile URL
- ✅ Early access to new features
- ✅ Ad-free experience
- ✅ High-quality audio streaming
- ✅ Batch operations
- ✅ Extended activity feed
- ✅ Direct messaging

### No Restrictions
- Full preview duration
- No project limits
- No collaboration limits
- No upload limits per project
- Advanced search & filters

---

## Comparison Table

| Feature | Free Tier | Pro Tier |
|---------|-----------|----------|
| **Projects** | | |
| Create projects (as owner) | 3 | ♾️ Unlimited |
| Collaborate on projects | 3 | ♾️ Unlimited |
| Total active projects | 6 | ♾️ Unlimited |
| **Audio** | | |
| Tracks per project | 8 | ♾️ Unlimited |
| File size limit | 25 MB | 500 MB |
| Total storage | 200 MB | 50 GB |
| **Collaboration** | | |
| Collaborators per project | 5 | ♾️ Unlimited |
| Can invite | ✅ | ✅ |
| Can be invited | ✅ (max 3) | ✅ (unlimited) |
| **Features** | | |
| Export projects | ❌ | ✅ |
| Advanced analytics | ❌ | ✅ |
| Version history | ❌ | ✅ |
| Priority support | ❌ | ✅ |
| Direct messaging | ❌ | ✅ |
| Custom profile URL | ❌ | ✅ |
| **Quality** | | |
| Audio preview duration | 30 sec | Full |
| Streaming quality | Standard | High |
| Ad-free | ❌ | ✅ |

---

## Upgrade Prompts

### When Free User Hits Limits

**Creating 4th Project:**
```
🎵 You've reached your project limit!

Free tier: 3 projects
You have: 3 projects

Upgrade to Pro for:
✓ Unlimited projects
✓ Unlimited audio uploads per project
✓ Advanced analytics
✓ Export capabilities

[Upgrade to Pro] [Maybe Later]
```

**Being Invited to 4th Collaboration:**
```
🎵 Collaboration limit reached!

Free tier: 3 collaborations
You're in: 3 collaborations

To join more projects:
✓ Upgrade to Pro for unlimited collaborations
✓ Or leave one of your current collaborations

[Upgrade to Pro] [View My Collaborations]
```

**Uploading 9th Track to Project:**
```
🎵 Track limit reached for this project!

Free tier: 8 tracks per project
This project has: 8 tracks

Upgrade to Pro for:
✓ Unlimited tracks per project
✓ 50GB total storage
✓ Export & download all tracks

[Upgrade to Pro] [Manage Tracks]
```

---

## Implementation in Database

### Check Functions

```sql
-- Function to check if user can create a project
CREATE OR REPLACE FUNCTION can_create_project(user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  user_tier TEXT;
  owned_projects_count INTEGER;
BEGIN
  -- Get user's subscription tier
  SELECT subscription_tier INTO user_tier
  FROM users
  WHERE id = user_id;

  -- Pro tier has unlimited
  IF user_tier = 'pro' THEN
    RETURN TRUE;
  END IF;

  -- Free tier: check if under limit
  SELECT COUNT(*) INTO owned_projects_count
  FROM projects
  WHERE creator_id = user_id
    AND status != 'deleted';

  RETURN owned_projects_count < 3;
END;
$$ LANGUAGE plpgsql;

-- Function to check if user can join a collaboration
CREATE OR REPLACE FUNCTION can_join_collaboration(user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  user_tier TEXT;
  collab_count INTEGER;
BEGIN
  -- Get user's subscription tier
  SELECT subscription_tier INTO user_tier
  FROM users
  WHERE id = user_id;

  -- Pro tier has unlimited
  IF user_tier = 'pro' THEN
    RETURN TRUE;
  END IF;

  -- Free tier: check if under limit (3 collaborations)
  SELECT COUNT(*) INTO collab_count
  FROM project_collaborators
  WHERE user_id = user_id
    AND invitation_status = 'accepted'
    AND role != 'owner'; -- Don't count projects they own

  RETURN collab_count < 3;
END;
$$ LANGUAGE plpgsql;

-- Function to check if project can add more tracks
CREATE OR REPLACE FUNCTION can_upload_to_project(project_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  owner_tier TEXT;
  track_count INTEGER;
BEGIN
  -- Get project owner's subscription tier
  SELECT u.subscription_tier INTO owner_tier
  FROM projects p
  JOIN users u ON p.creator_id = u.id
  WHERE p.id = project_id;

  -- Pro tier has unlimited
  IF owner_tier = 'pro' THEN
    RETURN TRUE;
  END IF;

  -- Free tier: check if under limit (8 tracks)
  SELECT COUNT(*) INTO track_count
  FROM audio_files
  WHERE project_id = project_id;

  RETURN track_count < 8;
END;
$$ LANGUAGE plpgsql;
```

### Usage in App

```typescript
// Before creating project
const canCreate = await canCreateProject(user.id)
if (!canCreate) {
  showUpgradePrompt('project_limit')
  return
}

// Before accepting collaboration invite
const canJoin = await canJoinCollaboration(user.id)
if (!canJoin) {
  showUpgradePrompt('collaboration_limit')
  return
}

// Before uploading audio
const canUpload = await canUploadToProject(project.id)
if (!canUpload) {
  showUpgradePrompt('track_limit')
  return
}
```

---

## Enforcement Points

### Backend (RLS Policies)
- ❌ Don't enforce in RLS (too complex, can cause issues)
- ✅ Enforce in application logic before insert
- ✅ Use database functions to check limits

### Frontend (App)
- ✅ Check limits before showing "Create Project" button
- ✅ Show upgrade prompts when limit reached
- ✅ Display usage stats (3/3 projects used)
- ✅ Disable actions when at limit

### Middleware (API)
- ✅ Validate subscription tier
- ✅ Check limits before expensive operations
- ✅ Return clear error messages
- ✅ Suggest upgrade when appropriate

---

## Upgrade Flow

```
User hits limit
  ↓
Show upgrade prompt with benefits
  ↓
User clicks "Upgrade to Pro"
  ↓
Redirect to payment screen (Stripe)
  ↓
Process payment
  ↓
Update user.subscription_tier = 'pro'
  ↓
Unlock all Pro features immediately
  ↓
Send confirmation email
  ↓
Show success message
  ↓
User can now use unlimited features
```

---

## Migration Path (Free → Pro)

**When user upgrades:**
1. Update `users.subscription_tier` to `'pro'`
2. No need to modify existing projects
3. All limits immediately removed
4. Can now:
   - Create unlimited new projects
   - Join unlimited collaborations
   - Upload unlimited tracks to any project
   - Access all Pro features

**No data loss or migration needed** - existing data stays intact.
