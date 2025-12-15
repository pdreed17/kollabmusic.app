# Kollab Music App - Complete Features Documentation

**Last Updated:** December 8, 2024

This document provides a comprehensive list of all user-facing features and actions available in the Kollab Music app.

---

## 1. PROFILE & ACCOUNT MANAGEMENT

### ProfileScreen (My Profile)

#### What Users Can View:
- Profile avatar (with initials fallback if no photo)
- Display name and username (@handle)
- Email address
- Bio/about section
- Specialties/skills with icons
- "Open to Kollab" status indicator
- Stats: Projects Created, Kollabs (collaborations), Files Uploaded, Konnects (followers)
- Highlights player (up to 5 audio highlights)
- Recent projects (last 3)

#### What Users Can Do:
- Edit profile (navigate to edit screen)
- Upload/change profile picture
- Edit bio
- Select/add specialties from 18 options:
  - **Instruments**: Vocals, Guitar, Bass, Piano, Drums
  - **Production**: Producing, Mixing, Mastering, Sound Design, Beat Making
  - **Songwriting**: Lyrics, Melody, Composition, Arrangement
  - **Performance**: DJ, Live Performance, Engineering
  - **Other**
- Toggle "Open to Kollab" visibility (show if accepting collaboration requests)
- Upload highlights (audio files up to 500 MB, max 5 per user)
- Delete highlights
- Reorder highlights (move up/down)
- View all recent projects
- Access Activity, Pending Invitations, Blocked Users, Settings
- Sign out

---

### EditProfileScreen

#### What Users Can Do:
- Add/change avatar photo using device image picker (1:1 aspect ratio)
- Edit display name (required field)
- Edit bio (multiline text)
- Toggle "Open to Kollab" status
- Select multiple specialties from grouped categories:
  - Instruments
  - Production
  - Songwriting
  - Other
- Save profile changes
- Cancel and discard changes

---

### SettingsScreen

#### What Users Can View:
- Current email address
- Current subscription plan (shows "Free Plan")
- Account settings section
- Notification preferences section
- Audio settings section
- Subscription/Billing options
- Legal & Privacy links
- App version number

#### What Users Can Do:
- Navigate to Edit Profile
- Navigate to Change Password
- Navigate to Blocked Users
- Change hand preference (left/right - controls navigation pill layout)
- Toggle Push Notifications on/off
- Toggle Email Notifications on/off
- Toggle High Quality Playback on/off
- Toggle Auto-Download Stems on/off
- Choose audio quality preset (Low, Medium, High)
- Navigate to Subscription screen
- Navigate to Billing History
- View Privacy Policy
- View Terms of Service
- Request data export (coming soon)
- Delete account (coming soon)

---

### ChangePasswordScreen

#### What Users Can Do:
- Enter current password (with show/hide toggle)
- Enter new password (with show/hide toggle)
- Confirm new password (with show/hide toggle)
- View password strength indicator (Weak/Medium/Strong)
- View password requirements checklist:
  - At least 8 characters
  - At least one uppercase letter
  - At least one lowercase letter
  - At least one number
- Submit password change
- See validation errors in real-time

---

### BlockedUsersScreen

#### What Users Can View:
- List of all blocked users with:
  - User avatar
  - Display name
  - Username (@handle)
- Empty state message if no blocked users

#### What Users Can Do:
- View list of blocked users
- Unblock individual users (with confirmation dialog)
- See context for why user was blocked

---

## 2. PROJECTS

### ProjectsListScreen

#### What Users Can View:
- Search bar with live search
- Filter pills showing counts:
  - All (total projects)
  - My Projects (projects you own)
  - Kollabs (projects you collaborate on)
- Project cards displaying:
  - Project icon (genre-based color and icon)
  - Project title
  - Genre badge (if applicable)
  - Status badges (Archived, Done)
  - Kollabs count indicator
  - BPM (beats per minute)
  - Musical key
  - Last updated date (relative time)
- Empty states for each filter type

#### What Users Can Do:
- Search projects by title, description, or genre (live search)
- Filter projects by:
  - All projects (accessible to you)
  - My Projects (you own)
  - Kollabs (you're a collaborator on)
- Clear search query with X button
- Tap any project card to view project details
- Swipe project card right to reveal Edit button (owner only)
- Navigate to Create Project screen
- Navigate to Search/Find Projects screen
- Pull-to-refresh to reload project list

---

### CreateProjectScreen

#### What Users Can Do:
- Enter project title (required, validated)
- Enter project description (optional, multiline)
- Enter genre (optional)
- Enter BPM (optional, number validation: 20-300)
- Enter musical key (optional)
- Toggle "Public Project" (makes project discoverable by other users)
- Toggle "Looking for Kollabs" (shows project is open to collaboration requests)
- Create project (automatically adds creator as owner with full permissions)
- Cancel project creation

---

### EditProjectScreen

#### What Users Can View:
- Current project title, description, genre, BPM, key
- Project status options: Active, Archived, Completed
- Collaboration needs selector with 12 skills:
  - Vocals, Guitar, Bass, Drums, Piano
  - Producing, Mixing, Mastering
  - Sound Design, Beat Making
  - Lyrics, Composition

#### What Users Can Do:
- Edit project title (required field)
- Edit description (multiline)
- Edit genre
- Edit BPM (validated: 20-300)
- Edit musical key
- Toggle public visibility
- Select multiple collaboration needs/skills wanted
- Change project status (Active/Archived/Completed)
- Save all changes
- Delete project (owner only, with confirmation dialog)
- Cancel and discard changes

---

### ProjectDetailScreen

#### What Users Can View:
- Project title with genre-based icon and color
- Genre badge
- Creator name
- Status badges:
  - Archived
  - Completed
  - Looking for Collabs (with count of needed skills)
- Full project description
- BPM and Key metadata
- Collaboration needs displayed as chips with icons
- Public badge (if project is public)
- List of project collaborators with:
  - Avatar
  - Display name
  - Username
  - Owner star indicator
- Total collaborator count

#### What Users Can Do:
- Open project in full Studio view (main action)
- Upload audio files (if user has can_upload permission)
- Edit project details (owner only)
- Invite collaborators (owner only)
- View project in studio interface
- See info message if viewing public project as non-collaborator

---

### ProjectStudioScreen

#### What Users Can View:
- Audio track list showing:
  - Track icon/color indicator (based on stem type)
  - Stem type name
  - Original file name
  - Track duration
  - File format/extension
  - Volume slider (0-100%)
  - Pan control (L-R stereo positioning)
  - Mute toggle button
  - Solo toggle button
  - Visibility toggle (hide/show)
  - Uploader info (user who uploaded)
  - Upload count badge
- Audio player controls:
  - Play/pause button
  - Timeline scrubber with current position
  - Current time / total duration display
  - Master volume control
- Two tabs:
  - Track Info (comments, metadata)
  - Chat (project-level messaging)
- Time-stamped comments on individual tracks

#### What Users Can Do:
- Play/pause individual audio tracks
- Seek through timeline (scrub to any position)
- Control individual track volume (slider 0-100%)
- Control track pan (stereo L-R positioning)
- Mute individual tracks (exclude from playback)
- Solo individual tracks (play only that track)
- Hide/show tracks from view
- Organize/reorder tracks (drag and drop mode)
- View time-stamped comments on tracks
- Add new comments with timestamps
- Reply to existing comments
- Detect BPM using WebView integration
- Download individual tracks (if user has can_download permission)
- Share/export tracks
- Upload new audio files to project
- Chat with collaborators in real-time (ProjectChat component)
- Switch between Track Info and Chat tabs

---

## 3. COLLABORATION

### InviteCollaboratorScreen

#### What Users Can Do:
- Search for users by username (autocomplete suggestions)
  - Debounced search (waits for typing to stop)
  - Minimum 2 characters required
- Select user from suggestions list
- Choose collaborator role:
  - **Admin**: Full access
    - Edit project details
    - Delete project
    - Invite other collaborators
    - Upload audio files
    - Add comments
    - Download files
  - **Editor**: Limited access
    - Upload audio files
    - Edit track details
    - Add comments
    - Download files
    - Cannot delete project or invite others
- View detailed permissions list for each role
- Send invitation to selected user with chosen role
- See validation errors:
  - User not found
  - Cannot invite yourself
  - User already collaborating
  - User is blocked or blocking you

---

### CollaboratorsScreen

#### What Users Can View:
- List of all accepted collaborators on the project
- Owner badge on project creator
- For each collaborator:
  - Avatar (with initials fallback)
  - Display name
  - Username (@handle)
  - Role badge (Owner/Admin/Editor)

#### What Users Can Do:
- View all collaborators on project
- See who has which permissions/roles
- Tap collaborator to view their profile

---

### PendingInvitationsScreen

#### What Users Can View:
- List of pending project invitations with:
  - Inviter's name and avatar
  - Project name
  - Project description preview
  - Date invited
  - Accept button (green)
  - Decline button (red)

#### What Users Can Do:
- Accept project invitation (adds you to project collaborators)
- Decline project invitation (removes invitation)
- View project details before accepting
- See who invited you

---

### SearchScreen

#### What Users Can View:
- Live search bar with placeholder
- Filter pills with counts:
  - All
  - Projects
  - People
  - Genres
- Search results showing:
  - **Projects**:
    - Title
    - Genre
    - BPM
    - Musical key
    - Collaboration needs (with skill icons)
    - Skill match badge (if project needs match your specialties)
  - **People**:
    - Avatar
    - Display name
    - Username (@handle)
    - "Open to Kollab" status indicator
    - Specialties
    - Connection status
- Empty state when no results found

#### What Users Can Do:
- Search for projects and people (live search)
- Filter results by category:
  - All (projects + people)
  - Projects only
  - People only
  - Genres only
- Connect with users ("Konnect" button)
- Check your connection status with users
- View project details from search results
- View user profiles from search results
- Find projects looking for collaborators with skills that match yours
- Clear search query

---

### UserProfileScreen

#### What Users Can View:
- User's avatar (with initials fallback)
- Display name
- Username (@handle)
- Bio/about section
- User's specialties (skill icons)
- "Open to Kollab" status indicator
- User stats:
  - Projects Created
  - Collaborations
  - Total Tracks Uploaded
- User's highlights (if they allow public viewing)
- User's public projects (if they allow public viewing)
- User's collaborators list (if they allow public viewing)
- Your connection status with this user (Connected/Not Connected)
- Block/Unblock buttons
- Blocked status indicator (if you're blocking or being blocked)

#### What Users Can Do:
- Connect with user ("Konnect" button - send connection request)
- Disconnect from user (remove connection)
- Block user (with confirmation dialog)
- Unblock user
- View user's audio highlights (if allowed)
- Play user's highlights
- View user's public projects (if allowed)
- View user's collaborators (if allowed)
- Navigate to chat with user (if you're connected)
- See if you're blocking or blocked by this user
- View user's skills and specialties

---

## 4. AUDIO / CONTENT MANAGEMENT

### AudioUploadScreen

#### What Users Can View:
- Cloud storage provider options:
  - iCloud Drive (iOS)
  - Google Drive
  - Dropbox
  - Browse All Files (device file picker)
- Recording option with microphone icon
- Selected file display showing:
  - File name
  - File size (MB)
  - Duration (mm:ss)
  - Format/extension
- Audio preview player:
  - Play/pause button
  - Progress bar
  - Duration display
- Stem type selector (9 types with icons):
  - Vocals
  - Drums
  - Bass
  - Guitar
  - Keys/Piano
  - Synth
  - Multiple (combination of instruments)
  - FX (effects/sound effects)
  - Other
- Tips section for upload best practices
- Upload progress indicator (percentage and bar)

#### What Users Can Do:
- Browse device files using document picker
- Select audio from cloud storage providers
- Record audio directly in the app:
  - Start recording
  - See live duration timer
  - Cancel recording
  - Stop recording and save
- Play audio preview before uploading
- Change selected file (pick different file)
- Edit stem name (auto-populated from filename, editable)
- Select stem type from 9 categories
- Upload file to project with progress tracking
- Get prompted to find similar tracks after successful upload
- View file information:
  - Size (MB)
  - Duration (mm:ss)
  - Format (extension)

**Supported Audio Formats:**
- WAV, MP3, FLAC, AIFF, AAC, M4A, OGG, OPUS, MIDI

**File Size Limits:**
- Maximum: 500 MB per file
- Warning shown if file exceeds 100 MB

---

### HighlightUploadScreen

#### What Users Can Do:
- Upload audio file as profile highlight
- Select audio from device
- Set uploaded file as profile highlight (visible on profile)
- View existing highlights
- Delete highlights
- Manage up to 5 highlights maximum per user

---

### SimilarTracksScreen

#### What Users Can View:
- List of similar tracks based on uploaded audio
- Matching criteria visualization
- Match percentage or score
- Track details for similar matches

#### What Users Can Do:
- Find tracks similar to your uploaded audio (using audio embeddings)
- View similarity scores/percentages
- Add similar tracks to your project
- Discover tracks with similar:
  - BPM
  - Key
  - Genre
  - Audio characteristics

---

## 5. DAW (Digital Audio Workstation) FEATURES

### ProjectStudioScreen - Audio Editor Features

#### What Users Can Do:
- **BPM Detection**:
  - Automatically detect tempo/BPM of uploaded tracks
  - Uses WebView integration with audio analysis
  - Updates project BPM metadata
- **Audio Trimming**:
  - Trim start/end of audio files
  - Set in/out points
  - Non-destructive editing
- **Export Stems**:
  - Export individual tracks or full project
  - Choose export format
  - Download for use in external DAW
- **Audio Analysis**:
  - View frequency spectrum data
  - Analyze audio characteristics
  - Visualize waveforms
- **Metadata Editing**:
  - Edit track BPM
  - Edit musical key
  - Edit stem type
  - Add notes/descriptions

---

### NativeDAWScreen

#### Features Available:
- Native DAW integration (platform-specific)
- Multi-track recording capabilities
- Real-time audio processing
- VST/AU plugin support (planned)
- Advanced mixing console
- Track automation
- MIDI support

---

### WebDAWScreen

#### Features Available:
- Browser-based DAW interface
- Web Audio API integration
- Visual track editor
- Effects processing
- Real-time collaboration features
- No software installation required

---

### ExportToDAWScreen

#### What Users Can Do:
- Export project to DAW-compatible format
- Choose export settings:
  - **Audio Quality**:
    - Low (MP3 128kbps)
    - Medium (MP3 320kbps)
    - High (WAV 44.1kHz)
    - Pro (WAV 96kHz - Pro plan only)
  - **Format**:
    - Individual stems (separate files)
    - Mixed down (single file)
  - **Tempo/BPM Sync**:
    - Include BPM metadata
    - Time-stretch to match project BPM
  - **Metadata Inclusion**:
    - Include track names
    - Include markers/comments
    - Include project info
- Download exported files
- Share export with collaborators

---

## 6. SOCIAL & COMMUNICATION

### ActivityScreen

#### What Users Can View:

**Invitations Section** (collapsible):
- Pending project invitations with:
  - Inviter's name and avatar
  - Project name
  - Project details preview
  - Accept/Decline buttons
  - Count badge showing number of pending invitations
- Can be expanded or collapsed

**Notifications Section** (collapsible):
- Comments on your projects:
  - User who commented (name + avatar)
  - Comment text preview
  - Track/project name
  - Timestamp (relative time)
  - Count badge showing unread notifications
- Can be expanded or collapsed

**Activity Feed** with filters:
- **All Activity**: Public projects and activity from all users
- **My Kollabs**: Activity from your collaborators only

Each activity item shows:
- Icon and color coded by activity type:
  - Project created
  - Audio uploaded
  - User joined project
  - Comment added
  - Project updated
- Username and action description
- Additional details:
  - Genre
  - BPM
  - Key
  - Stem type
- Timestamp (relative time: "2h ago", "1d ago")
- Skill match badge (if collaboration needs match your specialties)

**Empty States**:
- No invitations
- No notifications
- No activity for selected filter

#### What Users Can Do:
- Accept invitations with one click
- Decline invitations with one click
- Dismiss individual notifications
- Filter activity feed:
  - All Activity (everything public)
  - My Kollabs (collaborators only)
- Tap any activity item to view related project
- Pull to refresh activity feed
- See highlighted activities where skills match your specialties
- Expand/collapse invitation and notification sections

---

### ProjectChat Component

#### What Users Can View:
- Real-time chat messages for the project
- Message bubbles showing:
  - Sender's avatar (for others' messages)
  - Sender's name
  - Message content
  - Timestamp (relative or absolute)
  - "Edited" indicator if message was edited
- Date separators (Today, Yesterday, dates)
- Empty state ("No messages yet")
- Typing indicator (if implemented)

#### What Users Can Do:
- Send chat messages (up to 1000 characters)
- View message history
- See real-time messages from collaborators
- Delete own messages (long-press, confirmation required)
- Auto-scroll to latest message
- See who sent each message
- See when messages were sent
- View grouped messages by date

---

### CommentModal Component

#### What Users Can View:
- List of comments on audio track
- Each comment shows:
  - Commenter's name and avatar
  - Comment text
  - Timestamp in track (mm:ss)
  - Date/time posted
  - Edit/delete options (for own comments)

#### What Users Can Do:
- Add time-stamped comments to audio tracks
- Specify exact timestamp in track (mm:ss format)
- Edit your own comments
- Delete your own comments
- Reply to comments (if threading enabled)
- View all comments on a track
- Jump to timestamp in track by clicking comment

---

## 7. BILLING & SUBSCRIPTIONS

### SubscriptionScreen

#### What Users Can View:
- Current subscription plan badge (Free/Pro)
- Current usage stats (projects created, collaborations)
- Billing period toggle (Monthly/Yearly)
- Two subscription tiers with pricing:

**Free Plan** - $0/month:
- 3 owned projects
- Collaborate on 3 projects
- 8 tracks per project
- Standard audio quality (44.1kHz)
- Basic collaboration tools
- Email support

**Pro Plan** - $15/month or $144/year (save 20%):
- Unlimited owned projects
- Unlimited collaborations
- Unlimited tracks per project
- High-quality audio (up to 96kHz)
- Advanced DAW tools
- Version history
- Priority support
- Real-time collaboration

#### What Users Can Do:
- View current subscription details
- See usage stats for free tier (X/3 projects, X/3 collaborations)
- Toggle between monthly and yearly billing (see 20% savings)
- View feature comparison across both plans
- Upgrade to Pro (currently "Coming Soon" - Stripe integration pending)
- Manage current subscription (Coming Soon)
- Cancel subscription (Coming Soon)

---

### BillingHistoryScreen

#### What Users Can View:
- List of past invoices with:
  - Invoice date
  - Amount charged
  - Plan name
  - Billing period
  - Payment status:
    - Paid (green checkmark)
    - Pending (orange clock)
    - Failed (red X)
  - Status icon and color coding
- Download invoice link (if available)
- Empty state if no billing history

#### What Users Can Do:
- View complete invoice history
- Download invoices as PDF
- See payment status for each billing period
- Track subscription changes over time
- Contact support for billing issues

---

## 8. SHARED COMPONENTS & UI ELEMENTS

### HighlightPlayer Component

#### What Users Can View:
- Audio player interface for highlight
- File name
- Duration (mm:ss)
- BPM (if detected/available)
- Key signature (if detected/available)
- Play/pause button
- Progress bar
- Time elapsed / total time

#### What Users Can Do:
- Play highlight preview
- Pause playback
- Seek through highlight (scrub timeline)
- View audio metadata (BPM, key, duration)

---

### MultiTrackTimeline Component

#### Features:
- Visual timeline representation of all tracks
- Track waveform visualization
- Playhead position indicator (current time)
- Zoom controls (in/out)
- Horizontal scroll for long projects
- Track height controls
- Grid lines for timing reference
- Snap-to-grid functionality

---

### NavigationPill Component

#### What Users Can View:
- Floating navigation button
- Current screen indicator
- Animated icon
- Positioned left or right based on hand preference

#### What Users Can Do:
- Navigate between main app sections
- Quick access to:
  - Home
  - Projects
  - Activity
  - Profile
  - Search
- Customize position (left/right handed mode)

---

### BackButton Component

#### What Users Can Do:
- Navigate back to previous screen
- See back button on all sub-screens
- Positioned based on hand preference setting

---

## 9. KEY INTERACTIVE PATTERNS

### Modals & Alerts
- **Confirmation Dialogs**: For destructive actions (delete, leave project, block user)
- **Success Notifications**: "Project created", "File uploaded", etc.
- **Error Alerts**: User-friendly error messages with retry options
- **Loading Indicators**: Spinners and progress bars during async operations
- **Pull-to-Refresh**: On all list screens (projects, activity, search results)

### Input Types
- **Text Inputs**: With placeholders and validation
- **Number Inputs**: With min/max validation (e.g., BPM: 20-300)
- **Multiline Text**: For descriptions and bios
- **Toggle Switches**: For boolean settings
- **Picker Components**: For selecting from predefined options
- **Search with Autocomplete**: Debounced with suggestions
- **File Pickers**: For audio and images
- **Sliders**: For volume, pan controls

### Navigation
- **Bottom Tab Navigation**: Main app sections
- **Stack Navigation**: Sub-screens with back buttons
- **Deep Linking**: Direct links to projects/profiles
- **Navigation Pills**: Floating navigation (left/right customizable)
- **Gesture Navigation**: Swipe to reveal actions

### Permissions & Access Control

#### User Roles:
- **Owner**: Created the project, has all permissions, cannot be removed
- **Admin**: Full access except cannot delete project or remove owner
- **Editor**: Can upload, edit, comment, download
- **Viewer**: Can view and download only

#### Granular Permissions:
- `can_edit`: Edit project details
- `can_delete`: Delete project
- `can_upload`: Upload audio files
- `can_comment`: Add comments and chat
- `can_download`: Download project files
- `can_invite`: Invite other collaborators

#### Privacy Controls:
- **Project Visibility**: Public (discoverable) or Private (invite-only)
- **Profile Visibility**: Control what others can see:
  - Highlights
  - Projects
  - Collaborators
  - Stats
- **Blocking**: Block users from viewing profile or sending invitations
- **Open to Kollab**: Signal availability for collaboration

---

## 10. FEATURES PLANNED BUT NOT YET IMPLEMENTED

### Account Management
- Data export (download all your data)
- Account deletion (full data removal)

### Payments
- Stripe integration for subscriptions
- Credit card management
- Subscription upgrades/downgrades
- Auto-renewal management
- Billing alerts

### Advanced DAW
- VST/AU plugin support
- Advanced mixing console
- Track automation recording
- MIDI editing interface
- Advanced effects processing

### Collaboration
- Real-time cursor tracking (see where collaborators are working)
- Live audio streaming (hear each other's work in real-time)
- Video chat integration
- Screen sharing

### Pro Features (Not Yet Active)
- Stripe payment integration for Pro upgrades
- Subscription management and cancellation
- Billing portal access

### Social Features
- Direct messaging between users
- User-to-user calling
- Friend requests and friend lists
- Activity likes/reactions
- Comment threading and replies
- @mentions in comments and chat

### Content Discovery
- Curated playlists/collections
- Featured projects
- Trending tracks
- Genre exploration
- Recommended collaborators based on skills

---

## TECHNICAL SPECIFICATIONS

### File Support
**Audio Formats**: WAV, MP3, FLAC, AIFF, AAC, M4A, OGG, OPUS, MIDI
**Image Formats**: JPG, PNG (for avatars)
**Max File Sizes**:
- Audio: 500 MB per file
- Images: Standard mobile limits

### Audio Processing
- Sample rates: 44.1kHz (standard), 48kHz, 96kHz (Pro)
- Bit depth: 16-bit, 24-bit
- BPM range: 20-300
- Supported keys: All major and minor keys

### Platform Support
- iOS (iPhone and iPad)
- Android (phones and tablets)
- Web (limited features)

### Offline Capabilities
- Downloaded tracks playable offline
- Draft project edits (sync when online)
- Cached profile data

### Real-time Features
- Live chat messaging (Supabase Realtime)
- Activity feed updates
- Project updates
- Notification delivery

---

## SUMMARY

The Kollab Music app currently provides:

- **150+ distinct user actions** across all screens
- **Role-based access control** with 4 permission levels
- **Real-time collaboration** via Supabase
- **Audio file management** up to 500 MB per file
- **9 stem/track types** for organization
- **18 musical specialties** for user profiles
- **2 subscription tiers** (Free, Pro)
- **Advanced search & filtering** for projects and people
- **Time-stamped comments** on audio tracks
- **Project-level chat** for collaborators
- **Audio highlights** for user profiles
- **BPM detection** and audio analysis
- **Multi-track timeline** interface
- **DAW integration** and export capabilities

The app is designed for musicians, producers, and audio creators to collaborate remotely on music projects with professional-grade tools and seamless real-time communication.
