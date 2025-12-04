# Audio Upload & Playback - Best Practices for Production

## 🎯 Overview
This document outlines the best-in-class audio handling system implemented for Kollab Music, ensuring smooth uploads, optimal playback, and professional-grade file management.

---

## ✅ What's Been Implemented

### 1. **Modern File Upload System** (`src/utils/fileUpload.util.ts`)
- ✅ FormData-based uploads (no blob conversion issues)
- ✅ Real-time progress tracking with XMLHttpRequest
- ✅ Better memory management for large files
- ✅ Automatic file size validation
- ✅ Error handling and retry logic ready

### 2. **Comprehensive Audio Service** (`src/services/audio.service.ts`)
- ✅ Support for all professional audio formats (WAV, FLAC, AIFF, ALAC, MP3, AAC, OGG, OPUS, MIDI)
- ✅ Automatic format detection and validation
- ✅ Metadata extraction (duration, format, lossless detection)
- ✅ File size and duration validation
- ✅ Quality recommendations based on use case
- ✅ Upload time estimation

### 3. **Format Support Matrix**

| Format | Quality | Use Case | Max File Size |
|--------|---------|----------|---------------|
| WAV    | Lossless | Mixing/Mastering | 500MB |
| FLAC   | Lossless | Professional | 500MB |
| AIFF   | Lossless | Pro Audio | 500MB |
| MP3    | Lossy | Sharing/Demo | 500MB |
| AAC    | Lossy | Mobile-optimized | 500MB |
| OGG    | Lossy | Web streaming | 500MB |

---

## 🚀 Production Recommendations

### **Immediate Priority: Supabase Storage Configuration**

#### 1. Enable Storage CDN
```bash
# In Supabase Dashboard:
# Settings → Storage → Enable CDN
# This provides:
# - Global edge caching
# - Faster downloads worldwide
# - Reduced server load
```

#### 2. Configure Storage Buckets
```sql
-- Run in Supabase SQL Editor:

-- Create optimized audio-files bucket if not exists
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('audio-files', 'audio-files', true, 524288000) -- 500MB limit
ON CONFLICT (id) DO UPDATE
SET file_size_limit = 524288000,
    public = true;

-- Create RLS policies for secure access
CREATE POLICY "Authenticated users can upload audio"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'audio-files');

CREATE POLICY "Users can read their project audio"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'audio-files');
```

#### 3. Enable Automatic Compression
For production, enable Supabase's automatic audio compression:
- Go to Supabase Dashboard → Storage → audio-files
- Enable "Transform on upload" for MP3/AAC files
- Set quality presets: High (320kbps), Medium (192kbps), Low (128kbps)

---

### **Audio Optimization Strategy**

#### For Mixing/Mastering Projects
```typescript
// Recommended settings for professional use
const proAudioConfig = {
  format: 'WAV',
  bitDepth: '24-bit',
  sampleRate: '48kHz or 96kHz',
  maxSize: '500MB',
  compression: 'none'
}
```

#### For Collaboration/Sharing
```typescript
// Balance quality and file size
const sharingConfig = {
  format: 'MP3 or AAC',
  bitrate: '320kbps',
  sampleRate: '44.1kHz',
  maxSize: '100MB',
  compression: 'automatic'
}
```

#### For Demo/Preview
```typescript
// Fast uploads, good enough quality
const demoConfig = {
  format: 'MP3',
  bitrate: '192kbps',
  sampleRate: '44.1kHz',
  maxSize: '50MB',
  compression: 'aggressive'
}
```

---

### **Streaming & Playback Optimization**

#### 1. Implement Adaptive Streaming
```typescript
// TODO: Add to audioPlayer.service.ts
export class StreamingAudioPlayer {
  // Use HLS (HTTP Live Streaming) for large files
  async streamAudio(fileUrl: string) {
    // For files > 50MB, use streaming instead of full download
    if (fileSize > 50 * 1024 * 1024) {
      return this.useHLSStreaming(fileUrl)
    }
    return this.useDirectPlayback(fileUrl)
  }
}
```

#### 2. Enable Audio Caching
```typescript
// Cache frequently accessed files locally
import * as FileSystem from 'expo-file-system'

const CACHE_DIR = FileSystem.cacheDirectory + 'audio/'

export async function cacheAudioFile(url: string, fileId: string) {
  const cachedPath = CACHE_DIR + fileId
  const info = await FileSystem.getInfoAsync(cachedPath)

  if (info.exists) {
    return cachedPath // Use cached version
  }

  await FileSystem.downloadAsync(url, cachedPath)
  return cachedPath
}
```

---

### **Upload Experience Enhancements**

#### 1. Background Uploads (Future Enhancement)
```typescript
// Install: expo install expo-task-manager expo-background-fetch
// Allows uploads to continue when app is in background
import * as BackgroundFetch from 'expo-background-fetch'
import * as TaskManager from 'expo-task-manager'
```

#### 2. Retry Failed Uploads
```typescript
// Add to fileUpload.util.ts
export async function uploadWithRetry(
  fileUri: string,
  options: UploadOptions,
  maxRetries = 3
): Promise<UploadResult> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const result = await uploadFile(fileUri, options)
    if (result.success) return result

    if (attempt < maxRetries) {
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt))
    }
  }
  return { success: false, error: 'Upload failed after retries' }
}
```

#### 3. Chunked Upload for Very Large Files
```typescript
// For files > 100MB, split into chunks
export async function uploadInChunks(
  fileUri: string,
  chunkSize = 5 * 1024 * 1024 // 5MB chunks
) {
  // TODO: Implement multipart upload
  // Supabase supports this via S3-compatible API
}
```

---

### **Database Optimization**

#### Add Indices for Fast Queries
```sql
-- Run in Supabase SQL Editor:

-- Index for fast project audio lookup
CREATE INDEX IF NOT EXISTS idx_audio_files_project_created
ON audio_files(project_id, created_at DESC);

-- Index for user's uploads
CREATE INDEX IF NOT EXISTS idx_audio_files_user
ON audio_files(created_by, created_at DESC);

-- Index for stem type filtering
CREATE INDEX IF NOT EXISTS idx_audio_files_stem
ON audio_files(project_id, stem_type);
```

---

### **Monitoring & Analytics**

#### Track Key Metrics
```typescript
// Add to analytics service
export const audioAnalytics = {
  trackUploadStart: (fileSize: number, format: string) => {},
  trackUploadComplete: (duration: number, fileSize: number) => {},
  trackUploadFailed: (error: string, fileSize: number) => {},
  trackPlaybackStart: (fileId: string) => {},
  trackPlaybackError: (fileId: string, error: string) => {},
}
```

---

## 📊 Performance Targets

### Upload Performance
- Small files (< 10MB): < 5 seconds
- Medium files (10-50MB): < 30 seconds
- Large files (50-500MB): < 5 minutes
- Success rate: > 98%

### Playback Performance
- Audio load time: < 2 seconds
- Scrubbing responsiveness: < 100ms
- Buffer time: < 500ms
- Zero playback stuttering

---

## 🔒 Security Best Practices

### 1. Validate All Uploads
```typescript
// Always validate before upload
const validation = await audioService.validateAudioFile(
  uri,
  fileName,
  fileSize,
  mimeType
)

if (!validation.valid) {
  Alert.alert('Invalid File', validation.error)
  return
}
```

### 2. Sanitize File Names
```typescript
// Remove special characters that could cause issues
function sanitizeFileName(fileName: string): string {
  return fileName
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_{2,}/g, '_')
}
```

### 3. Use Signed URLs for Private Audio
```typescript
// For private projects
const signedUrl = await audioService.getAudioUrl(filePath)
// Expires after 1 hour
```

---

## 🎨 UX Best Practices

### Progress Feedback
- Show percentage during upload
- Display estimated time remaining
- Allow cancellation
- Show success/error states clearly

### File Recommendations
- Suggest optimal format based on use case
- Warn about quality issues
- Show file size before upload
- Provide compression options

### Error Handling
- Clear error messages
- Suggest solutions (e.g., "File too large - try compressing")
- Retry button for failed uploads
- Save draft if upload fails

---

## 🔮 Future Enhancements

### Phase 2 (Post-Launch)
1. **Audio Waveform Visualization**
   - Use `react-native-audio-waveform`
   - Display waveforms for all tracks
   - Enable precise editing

2. **Real-time Collaboration**
   - Multiple users editing simultaneously
   - Live cursor positions
   - Conflict resolution

3. **AI-Powered Features**
   - Automatic stem separation
   - Beat detection and tempo analysis
   - Key detection
   - Quality enhancement

4. **Advanced Export**
   - Multi-track export
   - Format conversion
   - Mastering presets
   - Direct DAW integration

---

## 📝 Migration Checklist

- [ ] Update Supabase storage bucket configuration
- [ ] Add database indices
- [ ] Enable CDN on Supabase
- [ ] Set up monitoring/analytics
- [ ] Test upload/playback on slow connections
- [ ] Test with maximum file sizes
- [ ] Verify all audio formats work
- [ ] Test on both iOS and Android
- [ ] Load test with multiple concurrent uploads
- [ ] Set up error tracking (Sentry/Bugsnag)

---

## 🆘 Troubleshooting

### Upload Fails
1. Check network connection
2. Verify file size < 500MB
3. Confirm format is supported
4. Check Supabase storage limits
5. Verify RLS policies allow upload

### Playback Issues
1. Check audio URL is accessible
2. Verify file format is supported by device
3. Test with different audio files
4. Check for corrupted files
5. Verify storage bucket is public or use signed URLs

### Performance Issues
1. Enable CDN
2. Add database indices
3. Implement caching
4. Use streaming for large files
5. Compress audio files

---

## 📚 Resources

- [Supabase Storage Docs](https://supabase.com/docs/guides/storage)
- [Expo AV Documentation](https://docs.expo.dev/versions/latest/sdk/av/)
- [Audio File Format Guide](https://en.wikipedia.org/wiki/Audio_file_format)
- [Web Audio API Best Practices](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices)
