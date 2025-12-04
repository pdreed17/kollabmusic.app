# BPM Detection Integration Guide

## Where Users Will See BPM in Your App

Here are **3 practical ways** to integrate BPM detection into Kollab Music App:

---

## Integration 1: Auto-Detect BPM on Upload ✨ RECOMMENDED

**User Experience:**
1. User uploads audio file to project
2. App automatically detects BPM in background
3. BPM appears in track list and edit modal
4. User can see BPM of all tracks at a glance

### Implementation

#### Step 1: Find the file upload function

Look for where audio files are uploaded in `ProjectStudioScreen.tsx`. You'll likely have a function like `uploadAudioFile()` or similar. Add BPM detection there:

```typescript
// At the top of ProjectStudioScreen.tsx, add import:
import { detectBPM } from '../services/bpmDetector';

// In your upload function (example):
const uploadAudioFile = async (fileUri: string, fileName: string) => {
  try {
    // ... existing upload code ...

    // Detect BPM in background (don't block UI)
    let detectedBPM: number | null = null;
    try {
      console.log('Detecting BPM for uploaded file...');
      detectedBPM = await detectBPM(fileUri);
      console.log('BPM detected:', detectedBPM);
    } catch (error) {
      console.warn('BPM detection failed:', error);
      // Continue without BPM - not critical
    }

    // Save to database with BPM
    const { data, error } = await supabase
      .from('audio_files')
      .insert({
        // ... existing fields ...
        bpm: detectedBPM, // Add BPM field
      });

    // ... rest of upload code ...
  } catch (error) {
    // ... error handling ...
  }
};
```

#### Step 2: Display BPM in track list

Find where you render the track list (likely in `ProjectStudioScreen.tsx`):

```typescript
{/* Inside your track item rendering */}
<View style={styles.trackItem}>
  <Text style={styles.trackName}>{track.file_name}</Text>

  {/* ADD THIS: Show BPM badge */}
  {track.bpm && (
    <View style={styles.bpmBadge}>
      <Ionicons name="musical-note" size={12} color="#fff" />
      <Text style={styles.bpmText}>{track.bpm} BPM</Text>
    </View>
  )}

  {/* ... rest of track UI ... */}
</View>

// Add styles:
const styles = StyleSheet.create({
  // ... existing styles ...

  bpmBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#9C27B0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  bpmText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
});
```

---

## Integration 2: Manual "Detect BPM" Button in Edit Modal 🎯

**User Experience:**
1. User taps track to edit
2. Sees "Detect BPM" button in edit modal
3. Taps button → loading spinner
4. BPM appears and gets saved

### Implementation

#### Step 1: Add state variables

In `ProjectStudioScreen.tsx`, add these states at the top with other `useState`:

```typescript
const [detectedBPM, setDetectedBPM] = useState<number | null>(null);
const [isDetectingBPM, setIsDetectingBPM] = useState(false);
```

#### Step 2: Add BPM detection function

Add this function with your other functions in `ProjectStudioScreen.tsx`:

```typescript
const handleDetectBPM = async () => {
  if (!selectedTrack) return;

  try {
    setIsDetectingBPM(true);

    // Get signed URL for the file
    const { data, error } = await supabase.storage
      .from('audio-files')
      .createSignedUrl(selectedTrack.file_path, 3600);

    if (error) throw error;

    // Detect BPM from signed URL
    const bpm = await detectBPM(data.signedUrl);

    setDetectedBPM(bpm);

    // Optionally update database immediately
    await supabase
      .from('audio_files')
      .update({ bpm })
      .eq('id', selectedTrack.id);

    Alert.alert('BPM Detected', `${bpm} BPM`);
  } catch (error) {
    console.error('BPM detection error:', error);
    Alert.alert('Error', 'Failed to detect BPM');
  } finally {
    setIsDetectingBPM(false);
  }
};
```

#### Step 3: Add UI to Edit Modal

Find the Edit Audio Modal (around line 1387) and add this section AFTER the Trim Section (after line 1470):

```typescript
{/* BPM Detection Section - ADD THIS */}
<View style={styles.editField}>
  <Text style={styles.editLabel}>Tempo (BPM)</Text>
  <Text style={styles.editHint}>Detect the tempo of this audio file</Text>

  <TouchableOpacity
    style={styles.detectBPMButton}
    onPress={handleDetectBPM}
    disabled={isDetectingBPM}
  >
    {isDetectingBPM ? (
      <ActivityIndicator size="small" color="#fff" />
    ) : (
      <>
        <Ionicons name="analytics-outline" size={20} color="#fff" />
        <Text style={styles.detectBPMText}>
          {detectedBPM || selectedTrack?.bpm
            ? `${detectedBPM || selectedTrack.bpm} BPM • Detect Again`
            : 'Detect BPM'}
        </Text>
      </>
    )}
  </TouchableOpacity>

  {(detectedBPM || selectedTrack?.bpm) && (
    <View style={styles.bpmResultBox}>
      <Ionicons name="musical-note" size={24} color={Colors.primary} />
      <Text style={styles.bpmResultText}>
        {detectedBPM || selectedTrack.bpm} BPM
      </Text>
    </View>
  )}
</View>
```

#### Step 4: Add styles

Add these styles to your `styles` object (around line 2100+):

```typescript
detectBPMButton: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  gap: Spacing.sm,
  backgroundColor: Colors.primary,
  paddingVertical: Spacing.lg,
  paddingHorizontal: Spacing.xl,
  borderRadius: BorderRadius.lg,
  marginTop: Spacing.md,
},
detectBPMText: {
  ...Typography.bodyLarge,
  color: '#fff',
  fontWeight: '600',
},
bpmResultBox: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  gap: Spacing.md,
  backgroundColor: `${Colors.primary}10`,
  padding: Spacing.xl,
  borderRadius: BorderRadius.lg,
  marginTop: Spacing.lg,
  borderWidth: 2,
  borderColor: Colors.primary,
},
bpmResultText: {
  ...Typography.h2,
  color: Colors.primary,
  fontWeight: 'bold',
},
```

---

## Integration 3: BPM Display in Project Overview 📊

**User Experience:**
1. User sees project overview/track list
2. Each track shows its BPM
3. Can sort/filter by BPM
4. Visual tempo indicator

### Implementation

Find where you render the track list items and modify like this:

```typescript
{/* Track List Item */}
<View style={styles.trackListItem}>
  <View style={styles.trackInfo}>
    <Text style={styles.trackTitle}>{track.file_name}</Text>

    {/* Track metadata row */}
    <View style={styles.trackMeta}>
      <Text style={styles.trackDuration}>
        {formatTime(track.duration_ms || 0)}
      </Text>

      {/* ADD BPM DISPLAY */}
      {track.bpm && (
        <>
          <Text style={styles.metaSeparator}>•</Text>
          <View style={styles.bpmTag}>
            <Ionicons name="pulse" size={12} color={Colors.primary} />
            <Text style={styles.bpmTagText}>{track.bpm} BPM</Text>
          </View>
        </>
      )}

      {track.stem_type && (
        <>
          <Text style={styles.metaSeparator}>•</Text>
          <Text style={styles.stemType}>{track.stem_type}</Text>
        </>
      )}
    </View>
  </View>
</View>

// Add styles:
const styles = StyleSheet.create({
  trackMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  metaSeparator: {
    color: Colors.textSecondary,
    fontSize: 12,
  },
  bpmTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: `${Colors.primary}15`,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  bpmTagText: {
    fontSize: 11,
    color: Colors.primary,
    fontWeight: '600',
  },
});
```

---

## Complete Visual Example

Here's what the Edit Modal will look like with all additions:

```
┌──────────────────────────────────────┐
│ Cancel   Edit Audio           Save   │
├──────────────────────────────────────┤
│                                       │
│ Audio File Details                   │
│                                       │
│ File Name                            │
│ ┌─────────────────────────────────┐ │
│ │ Melody Chorus Vocals            │ │
│ └─────────────────────────────────┘ │
│                                       │
│ Audio Type                           │
│ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐     │
│ │Voc│ │Drm│ │Bas│ │Gtr│ │Key│     │
│ └───┘ └───┘ └───┘ └───┘ └───┘     │
│                                       │
│ Trim Audio                           │
│ Start: 0:00    End: 0:09             │
│                                       │
│ Tempo (BPM)                          │
│ Detect the tempo of this audio file  │
│ ┌─────────────────────────────────┐ │
│ │  🔬  Detect BPM                 │ │ ← NEW BUTTON
│ └─────────────────────────────────┘ │
│                                       │
│ ┌─────────────────────────────────┐ │
│ │      🎵  120 BPM                │ │ ← NEW RESULT
│ └─────────────────────────────────┘ │
│                                       │
│ [🔄 Revert to Original]              │
│                                       │
│ [🗑️ Delete Audio File]               │
│                                       │
└──────────────────────────────────────┘
```

---

## Testing the Integration

### Test Flow:

1. **Upload a file**
   - Choose an audio file (MP3/M4A/WAV)
   - Watch console logs for "Detecting BPM..."
   - Should see "BPM detected: 120" (or similar)

2. **Edit the file**
   - Tap the track
   - See "Detect BPM" button
   - Tap button
   - See spinner
   - See BPM result appear

3. **Check database**
   ```sql
   -- In Supabase SQL editor:
   SELECT file_name, bpm FROM audio_files;
   ```

### Console Output Example:

```
LOG Detecting BPM for uploaded file...
LOG Starting BPM detection for: file:///path/to/audio.mp3
LOG Decoded audio: 3.45s, 44100Hz, 152145 samples
LOG BPM detected: 128 (confidence: 0.87, method: autocorrelation)
```

---

## Recommended Approach

I recommend **Integration 2** (Manual Button) for now because:

✅ User has control over when BPM is detected
✅ Doesn't slow down uploads
✅ Clear visual feedback
✅ Easy to test
✅ Can add auto-detection later

---

## Next Steps

1. Add the "Detect BPM" button to Edit Modal (Integration 2)
2. Test with a few audio files
3. Once working, add BPM display to track list (Integration 3)
4. Optional: Add auto-detection on upload (Integration 1)

---

## Troubleshooting

**"BPM detection is slow"**
- Expected: 2-5 seconds for 3-minute song
- Show loading spinner so user knows it's working

**"BPM is inaccurate"**
- Check console logs for confidence score
- Try with songs that have clear beats
- Adjust BPM range if needed

**"Can't detect BPM"**
- Make sure file is valid audio
- Check file permissions
- Try with different audio format

---

Let me know which integration you want to implement and I'll help you add it!
