# DAW Features Technical Specification

## Table of Contents
1. [BPM-Based Grid System](#bpm-based-grid-system)
2. [Timestamped Comment System](#timestamped-comment-system)
3. [Database Schema](#database-schema)
4. [Implementation Roadmap](#implementation-roadmap)

---

## BPM-Based Grid System

### Overview
Transform the timeline into an Ableton-style grid where each column represents a beat/bar based on project BPM. Tracks can be layered vertically and moved horizontally along the beat grid.

### Core Concepts

#### 1. Beat Grid Mathematics
```typescript
// Core calculations
const millisecondsPerBeat = 60000 / BPM
const beatsPerBar = 4 // From time signature (4/4)
const pixelsPerBeat = 60 // Adjustable zoom level
const millisecondsPerBar = millisecondsPerBeat * beatsPerBar

// Conversion functions
function msToBeats(ms: number, bpm: number): number {
  return ms / (60000 / bpm)
}

function beatsToMs(beats: number, bpm: number): number {
  return beats * (60000 / bpm)
}

function beatsToPixels(beats: number, pixelsPerBeat: number): number {
  return beats * pixelsPerBeat
}

function pixelsToBeats(pixels: number, pixelsPerBeat: number): number {
  return pixels / pixelsPerBeat
}

function snapToNearestBeat(beats: number): number {
  return Math.round(beats)
}

function snapToNearestBar(beats: number, beatsPerBar: number): number {
  return Math.round(beats / beatsPerBar) * beatsPerBar
}
```

#### 2. Database Changes

**Projects Table:**
```sql
ALTER TABLE projects ADD COLUMN bpm INTEGER DEFAULT 120;
ALTER TABLE projects ADD COLUMN time_signature VARCHAR(10) DEFAULT '4/4';
```

**Audio Files Table:**
```sql
-- Convert start_time_ms to use beats instead
-- OR add a beats column and calculate ms from BPM
ALTER TABLE audio_files ADD COLUMN start_beat FLOAT DEFAULT 0;
-- start_time_ms will be calculated as: start_beat * (60000 / project.bpm)
```

#### 3. Grid Rendering

**Beat Lines (Light):**
- Draw every beat
- Color: `rgba(255, 255, 255, 0.1)`
- Width: 1px

**Bar Lines (Dark):**
- Draw every bar (every 4 beats in 4/4)
- Color: `rgba(255, 255, 255, 0.3)`
- Width: 2px

**Beat Numbers:**
- Show beat position within bar (1, 2, 3, 4)
- Small text above timeline

**Bar Numbers:**
- Show bar number (1, 2, 3, 4, 5...)
- Larger text above timeline

**Visual Layout:**
```
Bar Numbers:      1              2              3              4
                  |              |              |              |
Beat Numbers:   1 2 3 4        1 2 3 4        1 2 3 4        1 2 3 4
Grid Lines:     | | | |        | | | |        | | | |        | | | |
                ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓
Track 1:        [████████]                    [██████]
Track 2:                        [████████████████]
Track 3:                [████]       [████]
```

#### 4. Snap-to-Grid Dragging

**Implementation:**
```typescript
onPanResponderMove: (_, gestureState) => {
  // Get new pixel position
  const newPixelPos = initialPixelPos + gestureState.dx

  // Convert to beats
  const newBeats = pixelsToBeats(newPixelPos, pixelsPerBeat)

  // Snap to nearest beat
  const snappedBeats = snapToNearestBeat(newBeats)

  // Convert back to milliseconds for storage
  const newStartTimeMs = beatsToMs(snappedBeats, projectBPM)

  // Update track position
  onTrackMove(track.id, newStartTimeMs)
}
```

**Visual Feedback:**
- Show ghost outline at snap position
- Highlight grid line where clip will snap
- Display beat position in tooltip (e.g., "Bar 2, Beat 3")

#### 5. Beat-Accurate Playback

**Timeline Cursor:**
```typescript
// Playhead position in beats
const playheadBeats = msToBeats(currentTimeMs, projectBPM)
const playheadPixels = beatsToPixels(playheadBeats, pixelsPerBeat)

// Update 60fps for smooth movement
useEffect(() => {
  const interval = setInterval(() => {
    if (isPlaying) {
      setCurrentTimeMs(prev => prev + 16.67) // ~60fps
    }
  }, 16.67)
  return () => clearInterval(interval)
}, [isPlaying])
```

**Synchronized Multi-Track Playback:**
```typescript
function playAllTracksFromBeat(startBeat: number) {
  const startTimeMs = beatsToMs(startBeat, projectBPM)

  audioFiles.forEach(async (track) => {
    const trackStartBeat = msToBeats(track.start_time_ms, projectBPM)
    const relativeDelay = trackStartBeat - startBeat

    if (relativeDelay >= 0) {
      // Track starts after cursor - delay playback
      const delayMs = beatsToMs(relativeDelay, projectBPM)
      setTimeout(() => playTrack(track.id), delayMs)
    } else {
      // Track starts before cursor - seek and play
      const seekPosition = Math.abs(beatsToMs(relativeDelay, projectBPM))
      await playTrackFromPosition(track.id, seekPosition)
    }
  })
}
```

#### 6. UI Components

**BPM Control (in Project Settings):**
```tsx
<View style={styles.bpmControl}>
  <Text style={styles.label}>BPM</Text>
  <TextInput
    style={styles.bpmInput}
    value={bpm.toString()}
    onChangeText={(text) => {
      const newBPM = parseInt(text)
      if (newBPM >= 40 && newBPM <= 240) {
        updateProjectBPM(newBPM)
      }
    }}
    keyboardType="number-pad"
  />
  <View style={styles.bpmButtons}>
    <TouchableOpacity onPress={() => updateProjectBPM(bpm - 1)}>
      <Ionicons name="remove" size={20} />
    </TouchableOpacity>
    <TouchableOpacity onPress={() => updateProjectBPM(bpm + 1)}>
      <Ionicons name="add" size={20} />
    </TouchableOpacity>
  </View>
</View>
```

**Grid Zoom Controls:**
```tsx
<View style={styles.zoomControls}>
  <TouchableOpacity onPress={() => setPixelsPerBeat(prev => prev / 2)}>
    <Text>Zoom Out</Text>
  </TouchableOpacity>
  <Text>{Math.round(pixelsPerBeat)}px/beat</Text>
  <TouchableOpacity onPress={() => setPixelsPerBeat(prev => prev * 2)}>
    <Text>Zoom In</Text>
  </TouchableOpacity>
</View>
```

---

## Timestamped Comment System

### Overview
Allow users to leave timestamped comments on individual audio tracks. Each comment anchors to a specific time position, and supports threaded discussions between collaborators.

### User Flow

1. **User clicks on audio track** → Opens track detail modal
2. **Track plays with playback controls** → User can scrub to any position
3. **User clicks "Add Comment" at current timestamp** → Comment input appears
4. **User types comment and submits** → Comment marker appears at that timestamp
5. **Other users click comment marker** → Opens comment thread
6. **Users can reply to comments** → Threaded discussion UI

### Visual Design

#### Track Detail Modal
```
┌─────────────────────────────────────────────────┐
│ Track Name                              [X]     │
├─────────────────────────────────────────────────┤
│                                                 │
│  ◀◀  ▶  ▶▶    0:00 ━━━●━━━━━━━ 2:45           │
│                         │                       │
│              💬        💬        💬             │ ← Comment markers
│              0:15      0:45      1:30           │
│                                                 │
├─────────────────────────────────────────────────┤
│ Comments (3)                         [+ Add]   │
│                                                 │
│ 💬 0:15 - @john_doe                            │
│ "This bass line is too loud"                   │
│   └─ @jane_smith: "I agree, let's lower it"   │
│   └─ @john_doe: "Done, thanks!"                │
│                                                 │
│ 💬 0:45 - @jane_smith                          │
│ "Love the synth here!"                         │
│   └─ @john_doe: "Thanks! 🎹"                   │
│                                                 │
│ 💬 1:30 - @collaborator                        │
│ "Can we try a different drum pattern?"         │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Database Schema

#### Comments Table
```sql
CREATE TABLE track_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  audio_file_id UUID NOT NULL REFERENCES audio_files(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  timestamp_ms INTEGER NOT NULL, -- Position in track where comment was made
  content TEXT NOT NULL,
  parent_comment_id UUID REFERENCES track_comments(id) ON DELETE CASCADE, -- For threaded replies
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT fk_audio_file FOREIGN KEY (audio_file_id) REFERENCES audio_files(id),
  CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_parent_comment FOREIGN KEY (parent_comment_id) REFERENCES track_comments(id)
);

-- Indexes for performance
CREATE INDEX idx_track_comments_audio_file ON track_comments(audio_file_id);
CREATE INDEX idx_track_comments_timestamp ON track_comments(timestamp_ms);
CREATE INDEX idx_track_comments_parent ON track_comments(parent_comment_id);
```

#### Comment Notifications Table (Optional)
```sql
CREATE TABLE comment_notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  comment_id UUID NOT NULL REFERENCES track_comments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT fk_comment FOREIGN KEY (comment_id) REFERENCES track_comments(id),
  CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_comment_notifications_user ON comment_notifications(user_id, is_read);
```

### TypeScript Types

```typescript
type TrackComment = {
  id: string
  audio_file_id: string
  user_id: string
  timestamp_ms: number
  content: string
  parent_comment_id: string | null
  created_at: string
  updated_at: string
  user: {
    id: string
    username: string
    display_name: string
    avatar_url: string | null
  }
  replies?: TrackComment[] // Populated for threaded view
}

type CommentThread = {
  rootComment: TrackComment
  replies: TrackComment[]
  replyCount: number
}
```

### API Functions

```typescript
// Get all comments for a track
async function getTrackComments(audioFileId: string): Promise<TrackComment[]> {
  const { data, error } = await supabase
    .from('track_comments')
    .select(`
      *,
      user:users(id, username, display_name, avatar_url)
    `)
    .eq('audio_file_id', audioFileId)
    .order('timestamp_ms', { ascending: true })

  if (error) throw error
  return data
}

// Get comment thread (root + replies)
async function getCommentThread(commentId: string): Promise<CommentThread> {
  const { data: rootComment, error: rootError } = await supabase
    .from('track_comments')
    .select(`
      *,
      user:users(id, username, display_name, avatar_url)
    `)
    .eq('id', commentId)
    .single()

  if (rootError) throw rootError

  const { data: replies, error: repliesError } = await supabase
    .from('track_comments')
    .select(`
      *,
      user:users(id, username, display_name, avatar_url)
    `)
    .eq('parent_comment_id', commentId)
    .order('created_at', { ascending: true })

  if (repliesError) throw repliesError

  return {
    rootComment,
    replies,
    replyCount: replies.length
  }
}

// Add new comment
async function addTrackComment(
  audioFileId: string,
  userId: string,
  timestampMs: number,
  content: string,
  parentCommentId?: string
): Promise<TrackComment> {
  const { data, error } = await supabase
    .from('track_comments')
    .insert({
      audio_file_id: audioFileId,
      user_id: userId,
      timestamp_ms: timestampMs,
      content: content,
      parent_comment_id: parentCommentId || null
    })
    .select(`
      *,
      user:users(id, username, display_name, avatar_url)
    `)
    .single()

  if (error) throw error

  // Notify collaborators (optional)
  await notifyCollaborators(audioFileId, data.id)

  return data
}

// Delete comment
async function deleteComment(commentId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('track_comments')
    .delete()
    .eq('id', commentId)
    .eq('user_id', userId) // Only allow user to delete their own comments

  if (error) throw error
}

// Update comment
async function updateComment(
  commentId: string,
  userId: string,
  newContent: string
): Promise<TrackComment> {
  const { data, error } = await supabase
    .from('track_comments')
    .update({
      content: newContent,
      updated_at: new Date().toISOString()
    })
    .eq('id', commentId)
    .eq('user_id', userId)
    .select(`
      *,
      user:users(id, username, display_name, avatar_url)
    `)
    .single()

  if (error) throw error
  return data
}
```

### UI Components

#### Track Detail Modal Component
```tsx
<Modal visible={selectedTrack !== null} animationType="slide">
  <View style={styles.modalContainer}>
    {/* Header */}
    <View style={styles.modalHeader}>
      <Text style={styles.trackTitle}>{selectedTrack.name}</Text>
      <TouchableOpacity onPress={closeModal}>
        <Ionicons name="close" size={24} />
      </TouchableOpacity>
    </View>

    {/* Audio Player with Waveform */}
    <View style={styles.playerSection}>
      <AudioPlayerWithComments
        track={selectedTrack}
        comments={trackComments}
        onSeek={handleSeek}
        onCommentPress={handleCommentPress}
      />
    </View>

    {/* Comment List */}
    <ScrollView style={styles.commentsSection}>
      <View style={styles.commentsHeader}>
        <Text style={styles.commentsTitle}>
          Comments ({trackComments.length})
        </Text>
        <TouchableOpacity
          style={styles.addCommentButton}
          onPress={handleAddComment}
        >
          <Ionicons name="add" size={20} />
          <Text>Add</Text>
        </TouchableOpacity>
      </View>

      {trackComments.map(comment => (
        <CommentItem
          key={comment.id}
          comment={comment}
          onReply={handleReply}
          onDelete={handleDeleteComment}
          onSeek={() => seekToTimestamp(comment.timestamp_ms)}
        />
      ))}
    </ScrollView>
  </View>
</Modal>
```

#### Comment Item Component
```tsx
function CommentItem({ comment, onReply, onDelete, onSeek }) {
  const [showReplies, setShowReplies] = useState(false)
  const [replyText, setReplyText] = useState('')

  return (
    <View style={styles.commentItem}>
      {/* Comment Header */}
      <View style={styles.commentHeader}>
        <TouchableOpacity onPress={onSeek}>
          <Text style={styles.timestamp}>
            {formatTime(comment.timestamp_ms)}
          </Text>
        </TouchableOpacity>
        <Text style={styles.username}>@{comment.user.username}</Text>
        <Text style={styles.timeAgo}>{formatTimeAgo(comment.created_at)}</Text>
      </View>

      {/* Comment Content */}
      <Text style={styles.commentContent}>{comment.content}</Text>

      {/* Comment Actions */}
      <View style={styles.commentActions}>
        <TouchableOpacity onPress={() => setShowReplies(!showReplies)}>
          <Text style={styles.actionText}>
            {comment.replies?.length || 0} replies
          </Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => onReply(comment.id)}>
          <Text style={styles.actionText}>Reply</Text>
        </TouchableOpacity>
        {comment.user_id === currentUserId && (
          <TouchableOpacity onPress={() => onDelete(comment.id)}>
            <Text style={styles.deleteText}>Delete</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Replies */}
      {showReplies && comment.replies && (
        <View style={styles.repliesContainer}>
          {comment.replies.map(reply => (
            <CommentItem
              key={reply.id}
              comment={reply}
              onReply={onReply}
              onDelete={onDelete}
              onSeek={onSeek}
              isReply={true}
            />
          ))}

          {/* Reply Input */}
          <View style={styles.replyInput}>
            <TextInput
              style={styles.input}
              placeholder="Write a reply..."
              value={replyText}
              onChangeText={setReplyText}
            />
            <TouchableOpacity onPress={() => {
              onReply(comment.id, replyText)
              setReplyText('')
            }}>
              <Ionicons name="send" size={20} />
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  )
}
```

#### Comment Markers on Timeline
```tsx
function AudioPlayerWithComments({ track, comments, onCommentPress }) {
  return (
    <View style={styles.playerContainer}>
      {/* Waveform or Progress Bar */}
      <View style={styles.waveform}>
        <Slider
          value={position}
          maximumValue={track.duration_ms}
          onValueChange={onSeek}
        />

        {/* Comment Markers */}
        {comments.map(comment => (
          <TouchableOpacity
            key={comment.id}
            style={[
              styles.commentMarker,
              { left: `${(comment.timestamp_ms / track.duration_ms) * 100}%` }
            ]}
            onPress={() => onCommentPress(comment)}
          >
            <Ionicons name="chatbubble" size={16} color="#FF6B6B" />
          </TouchableOpacity>
        ))}
      </View>

      {/* Playback Controls */}
      <View style={styles.controls}>
        <TouchableOpacity onPress={handlePlayPause}>
          <Ionicons
            name={isPlaying ? 'pause' : 'play'}
            size={32}
          />
        </TouchableOpacity>
        <Text style={styles.time}>
          {formatTime(position)} / {formatTime(track.duration_ms)}
        </Text>
      </View>
    </View>
  )
}
```

### Real-time Updates (Optional)

```typescript
// Subscribe to new comments on current track
useEffect(() => {
  if (!selectedTrack) return

  const subscription = supabase
    .channel(`comments:${selectedTrack.id}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'track_comments',
        filter: `audio_file_id=eq.${selectedTrack.id}`
      },
      async (payload) => {
        // Fetch full comment with user data
        const { data } = await supabase
          .from('track_comments')
          .select(`
            *,
            user:users(id, username, display_name, avatar_url)
          `)
          .eq('id', payload.new.id)
          .single()

        if (data) {
          setTrackComments(prev => [...prev, data])
        }
      }
    )
    .subscribe()

  return () => {
    subscription.unsubscribe()
  }
}, [selectedTrack])
```

---

## Implementation Roadmap

### Phase 1: BPM System (Week 1)
- [ ] Add BPM/time signature to database
- [ ] Create BPM utility functions
- [ ] Add BPM controls to UI
- [ ] Update grid rendering to show beats/bars
- [ ] Test beat calculations

### Phase 2: Grid Snapping (Week 2)
- [ ] Implement snap-to-grid dragging
- [ ] Add visual snap feedback
- [ ] Update track storage to use beats
- [ ] Test on multiple BPMs
- [ ] Polish grid visuals

### Phase 3: Beat-Accurate Playback (Week 3)
- [ ] Implement synchronized multi-track playback
- [ ] Create timeline cursor system
- [ ] Add beat-based seeking
- [ ] Test playback synchronization
- [ ] Optimize performance

### Phase 4: Comment System - Database (Week 4)
- [ ] Create track_comments table
- [ ] Create comment_notifications table
- [ ] Write Supabase functions
- [ ] Test database operations
- [ ] Set up Row Level Security policies

### Phase 5: Comment System - UI (Week 5)
- [ ] Create track detail modal
- [ ] Build comment list component
- [ ] Add comment markers to timeline
- [ ] Implement comment input
- [ ] Add reply functionality

### Phase 6: Comment System - Features (Week 6)
- [ ] Add threaded discussions
- [ ] Implement edit/delete
- [ ] Add real-time updates
- [ ] Create notification system
- [ ] Polish UX

### Phase 7: Testing & Optimization (Week 7)
- [ ] Test on actual devices
- [ ] Optimize performance
- [ ] Fix bugs
- [ ] User testing with collaborators
- [ ] Final polish

---

## Success Metrics

### BPM System
- ✅ Tracks snap precisely to beat grid
- ✅ Multiple tracks play in sync
- ✅ Grid remains stable across different BPMs
- ✅ Zoom in/out works smoothly
- ✅ Performance: 60fps with 8-10 tracks

### Comment System
- ✅ Comments appear at exact timestamps
- ✅ Threaded discussions work smoothly
- ✅ Real-time updates (< 1 second delay)
- ✅ Comments persist across sessions
- ✅ Mobile-optimized UI (easy to tap/read)

---

## Mobile Optimization Tips

### Performance
1. Lazy load comments (load on demand)
2. Virtualize comment list for long threads
3. Debounce timeline scrubbing
4. Cache waveform images
5. Limit simultaneous audio tracks

### UX
1. Use bottom sheets for modals (mobile native)
2. Swipe gestures for navigation
3. Haptic feedback on beat snap
4. Pull to refresh comments
5. Offline comment drafts

### Accessibility
1. Screen reader support for comments
2. High contrast mode for grid
3. Adjustable text sizes
4. Keyboard shortcuts (iPad)
5. VoiceOver optimized navigation

---

## Notes & Considerations

### BPM System
- Consider variable BPM (tempo changes) in future
- Add metronome click for recording
- Support different time signatures (3/4, 6/8, etc.)
- Add quantize options (1/4, 1/8, 1/16 notes)

### Comment System
- Add @mentions for collaborators
- Allow emoji reactions to comments
- Support audio comments (voice notes)
- Add comment search/filter
- Export comments to PDF for reference

### Integration
- Comments could include suggested edits (fork/version)
- BPM changes could be tracked in comments
- Link comments to specific regions (ranges, not just points)
- Integration with notification system
- Activity feed showing comment activity

---

**Last Updated:** 2025-01-17
**Status:** Specification Complete - Ready for Implementation
