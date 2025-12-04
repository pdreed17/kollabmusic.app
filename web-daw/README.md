# Web DAW Demo

A production-ready React + TypeScript component that implements a DAW-like track-grid-timeline for music production. Features multi-track audio playback, drag-and-drop timeline editing, waveform visualization, and sample-accurate scheduling — similar to Ableton Live, FL Studio, or Logic Pro.

![Web DAW Demo](./demo-screenshot.png)

## ✨ Features

### Core DAW Functionality
- 🎵 **Multi-track Audio Playback** - Upload and play multiple audio tracks simultaneously with Web Audio API
- 🎯 **Sample-Accurate Scheduling** - Precise timing ensures tracks stay in perfect sync
- 🎛️ **Timeline with Gridlines** - Visual grid showing beats/measures with tempo-based snapping
- 🖱️ **Drag-and-Drop Clips** - Move audio clips left/right on timeline with grid snapping
- 📊 **Waveform Visualization** - Real-time rendered waveforms for each audio clip
- ⚡ **Zoom Controls** - Horizontal timeline zoom from 10-200 pixels per second

### Transport & Timing
- ⏯️ **Transport Controls** - Play, pause, stop with keyboard shortcuts
- 🥁 **Metronome** - Built-in click track with adjustable BPM
- 🔄 **Loop Playback** - Seamless looping for composition workflows
- 🎼 **Tempo Control** - Adjustable BPM from 60-200 with real-time grid updates
- ⏱️ **Playhead Animation** - Smooth visual playback indicator

### Track Management
- 🎚️ **Individual Track Controls** - Mute, solo, and gain controls per lane
- 📁 **File Upload** - Support for MP3, WAV, M4A, OGG audio formats
- ✂️ **Track Selection** - Click to select clips with visual feedback
- 🗑️ **Clip Management** - Delete selected clips with keyboard shortcuts

### Project Management
- 💾 **Export/Import Projects** - Save timeline as JSON with clip positions and metadata
- ↩️ **Undo/Redo System** - Full history tracking for clip movements and edits
- ⌨️ **Keyboard Shortcuts** - Space (play/pause), Ctrl+S (export), Ctrl+Z (undo), Delete (remove clips)

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Modern browser with Web Audio API support (Chrome 66+, Firefox 60+, Safari 11+, Edge 79+)

### Installation & Setup

1. **Clone or download the files**:
   ```bash
   # If using git
   git clone <repository-url>
   cd web-daw-demo

   # Or create a new directory and copy files
   mkdir web-daw-demo
   cd web-daw-demo
   # Copy all files from the web-daw folder
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start development server**:
   ```bash
   npm run dev
   ```

4. **Open in browser**:
   - Vite will automatically open http://localhost:3000
   - Click "Start Demo" to enable audio context
   - Upload 2-3 audio files to test functionality

### Alternative Setup (Create React App)
If you prefer Create React App over Vite:

```bash
npx create-react-app web-daw-demo --template typescript
cd web-daw-demo
# Copy DAWComponent.tsx, App.tsx, and App.css to src/
npm start
```

## 🎮 How to Use

### Basic Workflow
1. **Start Audio**: Click "Start Demo" to enable Web Audio API
2. **Upload Tracks**: Click "+ Add Audio" and select audio files (MP3, WAV, M4A, OGG)
3. **Arrange Timeline**: Drag clips left/right to arrange your composition
4. **Playback**: Press spacebar or click Play to hear tracks in sync
5. **Adjust Settings**: Change BPM, zoom level, enable loop/metronome
6. **Export**: Press Ctrl+S to export your project as JSON

### Keyboard Shortcuts
- `Space` - Play/Pause
- `Ctrl+S` (Cmd+S on Mac) - Export project
- `Ctrl+Z` (Cmd+Z on Mac) - Undo
- `Ctrl+Shift+Z` (Cmd+Shift+Z on Mac) - Redo
- `Delete/Backspace` - Delete selected clips

### Timeline Navigation
- **Zoom**: Use +/- buttons or scroll wheel to zoom timeline
- **Snap**: Clips automatically snap to beat grid when dragging
- **Selection**: Click clips to select (yellow outline when selected)
- **Playhead**: Red line shows current playback position

### Track Controls
- **M** - Mute track (red when muted)
- **S** - Solo track (yellow when soloed)
- **Drag** - Move clips horizontally to change start time
- **Double-click** - Opens inspector panel (planned feature)

## 🧪 Testing & Validation

### Acceptance Tests
Run these tests locally to verify functionality:

#### ✅ Basic Upload & Playback
1. Upload 2-3 different audio files
2. Verify each creates a new lane with waveform
3. Press Play - all tracks should play in sync from start
4. Verify playhead moves smoothly across timeline

#### ✅ Drag & Drop
1. Drag one clip to different position on timeline
2. Verify clip snaps to beat grid (visual grid lines)
3. Press Play - verify clip plays at new timing
4. Verify other clips continue playing at original times

#### ✅ Timeline Controls
1. Change BPM from 120 to 90 - verify grid spacing updates
2. Use zoom controls - verify timeline scale changes
3. Enable loop mode - verify playback loops at project end
4. Enable metronome - verify click track sounds with beat

#### ✅ Export/Import
1. Create arrangement with 2+ clips at different positions
2. Press Ctrl+S to export - verify JSON file downloads
3. Check JSON contains clip positions, names, and durations
4. Verify file sizes and metadata are preserved

#### ✅ Undo/Redo
1. Move a clip to new position
2. Press Ctrl+Z - verify clip returns to original position
3. Press Ctrl+Shift+Z - verify clip moves to new position again
4. Verify history persists through multiple operations

### Browser Compatibility
Test in multiple browsers to ensure Web Audio API compatibility:

- ✅ **Chrome 66+** - Full support, optimal performance
- ✅ **Firefox 60+** - Full support, good performance
- ✅ **Safari 11+** - Full support, may require user gesture for audio
- ✅ **Edge 79+** - Full support (Chromium-based)
- ❌ **Internet Explorer** - Not supported (no Web Audio API)

### Performance Testing
- **Load Test**: Upload 8+ simultaneous tracks, verify smooth playback
- **Length Test**: Test with clips >5 minutes, verify memory usage stays reasonable
- **Format Test**: Verify support for MP3, WAV, M4A, OGG formats

## 🏗️ Architecture & Implementation

### Web Audio API Usage
The component uses modern Web Audio API patterns for optimal performance:

```typescript
// Sample-accurate scheduling
const scheduleClip = (clip: AudioClip, startOffset: number) => {
  const source = audioContext.createBufferSource()
  const gainNode = audioContext.createGain()

  source.buffer = clip.audioBuffer
  source.connect(gainNode)
  gainNode.connect(masterGain)

  // Schedule with offset for precise timing
  const playTime = audioContext.currentTime + Math.max(0, clipStartTime - currentTime)
  source.start(playTime, offset, duration)
}
```

### Waveform Rendering
Waveforms are generated from AudioBuffer data and rendered to Canvas:

```typescript
const generateWaveformData = (audioBuffer: AudioBuffer, width: number) => {
  const samples = audioBuffer.getChannelData(0)
  const samplesPerPixel = Math.floor(samples.length / width)
  // Process samples into amplitude array for visualization
}
```

### State Management
Uses React hooks with TypeScript for type-safe state management:

```typescript
interface TimelineState {
  currentTime: number
  isPlaying: boolean
  tempo: number
  zoom: number
  selectedClipIds: string[]
  lanes: Lane[]
}
```

### Grid Snapping Algorithm
```typescript
const snapToGrid = (seconds: number, tempo: number, gridSize: number = 0.25) => {
  const beats = secondsToBeats(seconds, tempo)
  const snappedBeats = Math.round(beats / gridSize) * gridSize
  return beatsToSeconds(snappedBeats, tempo)
}
```

## 🔧 Customization & Extension

### Adding New File Formats
To support additional audio formats, extend the file upload handler:

```typescript
const supportedFormats = ['.mp3', '.wav', '.m4a', '.ogg', '.flac', '.aac']

// Add format detection in handleFileUpload function
if (!supportedFormats.some(format => file.name.toLowerCase().endsWith(format))) {
  throw new Error(`Unsupported format: ${file.name}`)
}
```

### Enhanced Waveform Visualization
For better waveform quality, consider integrating WaveSurfer.js:

```bash
npm install wavesurfer.js
```

```typescript
import WaveSurfer from 'wavesurfer.js'

// Replace simple canvas waveform with WaveSurfer
const waveform = WaveSurfer.create({
  container: containerRef.current,
  waveColor: '#4ade80',
  progressColor: '#2563eb',
  height: 60
})
```

### Backend Integration
For production use, add server endpoints for file storage:

```typescript
// Example upload endpoint integration
const uploadToServer = async (file: File) => {
  const formData = new FormData()
  formData.append('audio', file)

  const response = await fetch('/api/upload', {
    method: 'POST',
    body: formData
  })

  return response.json()
}
```

## 📋 TODO List - Future Improvements

### Immediate Enhancements
- [ ] **Clip Resize Handles** - Drag clip edges to trim start/end times
- [ ] **Fade In/Out** - Visual fade handles with audio crossfading
- [ ] **Better Waveform Caching** - Cache generated waveforms for performance
- [ ] **Clip Inspector Panel** - Detailed controls for gain, pan, effects per clip
- [ ] **Track Height Adjustment** - Resizable lanes for better waveform visibility

### Advanced Features
- [ ] **Multi-Track Recording** - Record audio directly into timeline
- [ ] **Audio Effects** - Built-in reverb, delay, EQ using Web Audio nodes
- [ ] **MIDI Support** - MIDI clip editing and virtual instruments
- [ ] **Time Stretching** - Change clip tempo without affecting pitch
- [ ] **Crossfades** - Automatic crossfading between overlapping clips

### Professional Features
- [ ] **Audio Mixdown Export** - Export final mix as audio file using OfflineAudioContext
- [ ] **Project Templates** - Pre-configured track layouts and settings
- [ ] **Collaboration** - Real-time collaborative editing via WebSockets
- [ ] **Plugin System** - VST-style audio plugins via AudioWorklet
- [ ] **Advanced Automation** - Automate gain, pan, effects parameters over time

### Performance Optimizations
- [ ] **Virtual Scrolling** - Handle hundreds of tracks efficiently
- [ ] **Web Workers** - Offload audio processing to background threads
- [ ] **IndexedDB Storage** - Cache large audio files in browser storage
- [ ] **Streaming Playback** - Support for large files via streaming
- [ ] **GPU Acceleration** - Hardware-accelerated waveform rendering

## 🐛 Troubleshooting

### Common Issues

**"Audio context failed to initialize"**
- Ensure you click "Start Demo" to enable audio (browser security requirement)
- Try refreshing the page and clicking again
- Check browser console for specific error messages

**"Files won't upload"**
- Verify file format is supported (MP3, WAV, M4A, OGG)
- Check file isn't corrupted - try a different audio file
- Ensure file size is reasonable (<100MB for browser memory limits)

**"Tracks don't play in sync"**
- This shouldn't happen with proper Web Audio scheduling
- If it occurs, try refreshing and re-uploading files
- Check browser performance - close other tabs using audio

**"Drag and drop not working"**
- Ensure you're dragging the clip itself, not empty space
- Try clicking the clip first to select it, then dragging
- Check that the clip isn't too short to see the drag handle

**"Export doesn't work"**
- Verify your browser supports file downloads
- Check if popup blocker is preventing download
- Try right-click → "Save link as" if automatic download fails

### Browser-Specific Notes

**Safari**
- Requires user interaction before audio context starts
- May have stricter memory limits for large files
- Audio context state may reset between page reloads

**Firefox**
- Excellent Web Audio API support
- May have different audio decoding behavior vs Chrome
- Good performance with large numbers of audio nodes

**Chrome**
- Best overall performance and compatibility
- Most comprehensive Web Audio API implementation
- Recommended for development and testing

## 📄 License

MIT License - feel free to use in personal or commercial projects.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

For major changes, please open an issue first to discuss what you would like to change.

## 📞 Support

- **Issues**: Report bugs or request features via GitHub Issues
- **Discussions**: Join discussions about new features and improvements
- **Documentation**: Check this README for comprehensive setup and usage info

---

**Built with ❤️ using React + TypeScript + Web Audio API**