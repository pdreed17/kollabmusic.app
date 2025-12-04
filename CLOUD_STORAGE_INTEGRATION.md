# Cloud Storage Integration Guide

## Overview
Kollab Music now supports seamless file access from all major cloud storage providers, making it easy for users to upload tracks and stems from wherever they store their music files.

---

## Supported Cloud Storage Providers

### iOS (via Files App)
When users tap "Select Audio File", they get access to:

1. **iCloud Drive** ✅ Built-in
2. **Google Drive** ✅ (if user has Google Drive app installed)
3. **Dropbox** ✅ (if user has Dropbox app installed)
4. **OneDrive** ✅ (if user has OneDrive app installed)
5. **Box** ✅ (if user has Box app installed)
6. **Local Files** ✅ (Music app, Downloads, etc.)
7. **Any other provider** the user has configured in their Files app

### How It Works

The app uses `expo-document-picker` which integrates with iOS's native **Files app**. This provides:
- Unified access to all cloud storage providers
- Native iOS file browsing experience
- User's familiar navigation and search
- Automatic authentication (users already signed into their cloud accounts)

---

## Supported Audio Formats

Users can upload files in these professional audio formats:

| Format | Extension | Quality | Use Case |
|--------|-----------|---------|----------|
| WAV | `.wav` | Lossless | Professional mixing/mastering |
| FLAC | `.flac` | Lossless | High-quality compression |
| AIFF | `.aiff`, `.aif` | Lossless | Mac/Pro Tools standard |
| MP3 | `.mp3` | Lossy | Sharing/distribution |
| MP4 | `.mp4` | Lossy | Audio containers |
| AAC/M4A | `.aac`, `.m4a` | Lossy | Apple ecosystem |
| OGG | `.ogg` | Lossy | Web streaming |
| OPUS | `.opus` | Lossy | High-quality compression |
| MIDI | `.mid`, `.midi` | Sequencing | MIDI composition |

**File Size Limit:** 500 MB per file

---

## User Experience

### Upload Screen UI
When users open the audio upload screen, they see:

```
[Cloud Upload Icon]
Select Audio File

WAV, MP3, MP4, FLAC, AIFF, AAC, M4A, OGG, MIDI
Max 500 MB

Access files from iCloud, Google Drive, Dropbox, or local storage
```

### File Selection Flow
1. User taps "Select Audio File"
2. iOS Files app opens
3. User can browse:
   - Recent files
   - iCloud Drive
   - Google Drive (if configured)
   - Dropbox (if configured)
   - Local "On My iPhone" storage
   - Any other connected provider
4. User selects their audio file
5. File is automatically validated and uploaded

---

## Implementation Details

### Document Picker Configuration
```typescript
const result = await DocumentPicker.getDocumentAsync({
  type: 'audio/*',  // iOS Files app filters to show only audio files
  copyToCacheDirectory: true,  // Copies remote files to local cache for upload
})
```

### Format Validation
```typescript
const ALLOWED_FORMATS = [
  'audio/wav', 'audio/x-wav',
  'audio/mpeg', 'audio/mp3',
  'audio/flac', 'audio/x-flac',
  'audio/aiff', 'audio/x-aiff',
  'audio/aac', 'audio/mp4',
  'audio/ogg', 'audio/opus',
  'audio/midi', 'audio/x-midi',
]

const ALLOWED_EXTENSIONS = [
  '.wav', '.mp3', '.flac', '.aiff', '.aif',
  '.m4a', '.mp4', '.aac', '.ogg', '.opus', '.mid', '.midi'
]
```

### Upload Process
1. User selects file from any cloud provider
2. File is copied to local cache (if remote)
3. File is validated for format and size
4. Audio duration is extracted
5. File is converted to ArrayBuffer
6. ArrayBuffer is uploaded to Supabase Storage
7. Metadata is saved to database

---

## User Benefits

### 1. No Manual Downloads Required
Users don't need to:
- Download files from cloud storage first
- Manage local storage space
- Delete files after uploading

### 2. Direct Access
Files can be accessed directly from:
- Cloud storage where they keep their music library
- Shared folders from collaborators
- Project folders organized in cloud drives

### 3. Large File Support
- Files up to 500 MB supported
- Progress indication for large uploads
- Warning for files > 100 MB

### 4. Format Flexibility
- Support for all professional audio formats
- Clear error messages for unsupported formats
- Guidance on recommended formats

---

## Setup Instructions for Users

### For Best Experience:

#### 1. **Install Cloud Storage Apps** (iOS)
Users should install their preferred cloud storage apps:
- Google Drive → App Store
- Dropbox → App Store
- OneDrive → App Store

#### 2. **Enable Files App Integration**
In each cloud app's settings:
1. Open app settings
2. Find "Files app" or "File Provider" option
3. Enable integration

#### 3. **Sign In**
Make sure you're signed into cloud storage apps before using Kollab Music

---

## Technical Advantages

### 1. Native Integration
- Uses iOS's built-in Files app
- No custom cloud storage SDKs needed
- Automatic updates when providers add features
- Consistent user experience

### 2. Security
- No cloud storage credentials stored in Kollab Music
- Users authenticate directly with cloud providers
- Files accessed through iOS's secure file system
- Temporary copies automatically cleaned up

### 3. Performance
- Files copied to local cache for reliable upload
- No streaming complexity
- Progress tracking for large files
- Automatic retry on network issues

---

## Future Enhancements

### Phase 2 (Planned)
1. **Android Support**
   - Same cloud provider access via Android Storage Access Framework
   - Google Drive, Dropbox, OneDrive integration

2. **Direct Cloud Upload**
   - Upload directly from cloud to Supabase
   - No local cache needed for remote files
   - Faster for large files

3. **Multi-File Selection**
   - Select multiple stems at once
   - Batch upload with combined progress
   - Automatic stem type detection

4. **Smart Folder Access**
   - Remember frequently accessed folders
   - Quick access to recent projects
   - Bookmark favorite cloud locations

---

## Troubleshooting

### Issue: "Can't see my cloud storage"
**Solution:**
1. Install the cloud storage app (e.g., Google Drive)
2. Open the app and sign in
3. Go to app settings → Enable Files integration
4. Restart Kollab Music

### Issue: "File upload fails"
**Solution:**
1. Check file size is under 500 MB
2. Verify file format is supported
3. Ensure stable internet connection
4. Check cloud storage app is up to date

### Issue: "Slow upload for cloud files"
**Explanation:**
- Files from cloud storage are first downloaded to your device
- Then uploaded to Kollab Music servers
- Large files may take time (shown in progress bar)

---

## Developer Notes

### Adding New Providers
No code changes needed! Any provider that integrates with iOS Files app automatically works.

### Testing
Test with files from:
1. Local device storage
2. iCloud Drive
3. Google Drive
4. Dropbox
5. Shared folders
6. Different file sizes (1MB, 50MB, 200MB)

### Monitoring
Track upload success rates by source:
- Local storage
- iCloud
- Other cloud providers

---

## Summary

✅ **Users can access files from any cloud storage provider**
✅ **No manual downloads or app switching required**
✅ **All professional audio formats supported**
✅ **Secure, native iOS integration**
✅ **Simple, intuitive user experience**

This integration makes Kollab Music more accessible and convenient for musicians who store their work in cloud storage, which is increasingly common in professional music production workflows.
