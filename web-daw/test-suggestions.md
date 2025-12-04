# Unit & Integration Test Suggestions

This document outlines comprehensive testing strategies for the Web DAW component using React Testing Library, Vitest, and Web Audio API mocking.

## Test Setup

### Install Testing Dependencies
```bash
npm install --save-dev @testing-library/react @testing-library/jest-dom @testing-library/user-event vitest jsdom
```

### Test Configuration (vitest.config.ts)
```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./test-setup.ts'],
  },
})
```

### Test Setup File (test-setup.ts)
```typescript
import '@testing-library/jest-dom'

// Mock Web Audio API
global.AudioContext = class MockAudioContext {
  state = 'running'
  currentTime = 0
  destination = {}

  createGain() {
    return {
      gain: { value: 1, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
      connect: vi.fn(),
    }
  }

  createBufferSource() {
    return {
      buffer: null,
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    }
  }

  createOscillator() {
    return {
      frequency: { value: 440 },
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    }
  }

  decodeAudioData = vi.fn()
  close = vi.fn()
  resume = vi.fn()
}

global.webkitAudioContext = global.AudioContext

// Mock File and FileReader for audio upload tests
global.File = class MockFile {
  constructor(public name: string, public size: number = 1024) {}
}

global.FileReader = class MockFileReader {
  result: ArrayBuffer = new ArrayBuffer(8)
  readAsArrayBuffer = vi.fn(() => {
    setTimeout(() => this.onload?.({ target: { result: this.result } }), 0)
  })
  onload: ((event: any) => void) | null = null
}
```

## Core Component Tests

### 1. Component Rendering
```typescript
// DAWComponent.test.tsx
import { render, screen } from '@testing-library/react'
import { DAWComponent } from './DAWComponent'

describe('DAWComponent', () => {
  test('renders transport controls', () => {
    render(<DAWComponent />)

    expect(screen.getByText('Play')).toBeInTheDocument()
    expect(screen.getByText('Pause')).toBeInTheDocument()
    expect(screen.getByText('Stop')).toBeInTheDocument()
  })

  test('renders timeline and zoom controls', () => {
    render(<DAWComponent />)

    expect(screen.getByText('BPM:')).toBeInTheDocument()
    expect(screen.getByText('Zoom:')).toBeInTheDocument()
    expect(screen.getByDisplayValue('120')).toBeInTheDocument() // Default BPM
  })

  test('renders empty state when no tracks', () => {
    render(<DAWComponent />)

    expect(screen.getByText('+ Add Audio')).toBeInTheDocument()
  })
})
```

### 2. Audio File Upload Tests
```typescript
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

describe('Audio Upload', () => {
  test('uploads audio file and creates track', async () => {
    const user = userEvent.setup()
    render(<DAWComponent />)

    const fileInput = screen.getByLabelText('+ Add Audio')
    const mockFile = new File(['audio content'], 'test.mp3', { type: 'audio/mp3' })

    // Mock successful audio decoding
    vi.mocked(global.AudioContext.prototype.decodeAudioData).mockResolvedValue({
      length: 44100,
      duration: 1.0,
      sampleRate: 44100,
      getChannelData: vi.fn(() => new Float32Array(44100)),
    })

    await user.upload(fileInput, mockFile)

    await waitFor(() => {
      expect(screen.getByText('Track 1')).toBeInTheDocument()
      expect(screen.getByText('test.mp3')).toBeInTheDocument()
    })
  })

  test('handles upload errors gracefully', async () => {
    const user = userEvent.setup()
    render(<DAWComponent />)

    const fileInput = screen.getByLabelText('+ Add Audio')
    const mockFile = new File(['invalid'], 'test.txt', { type: 'text/plain' })

    vi.mocked(global.AudioContext.prototype.decodeAudioData).mockRejectedValue(
      new Error('Invalid audio format')
    )

    await user.upload(fileInput, mockFile)

    // Should show error alert or message
    await waitFor(() => {
      expect(global.alert).toHaveBeenCalledWith(
        expect.stringContaining('Failed to process test.txt')
      )
    })
  })
})
```

### 3. Drag and Drop Tests
```typescript
describe('Clip Drag and Drop', () => {
  test('dragging clip updates start time', async () => {
    const user = userEvent.setup()
    render(<DAWComponent />)

    // First upload a track
    await uploadMockTrack()

    const clip = screen.getByTitle(/test\.mp3/)
    const initialPosition = clip.style.left

    // Simulate drag operation
    await user.pointer([
      { keys: '[MouseLeft>]', target: clip, coords: { x: 100, y: 50 } },
      { coords: { x: 200, y: 50 } }, // Drag 100px to the right
      { keys: '[/MouseLeft]' },
    ])

    // Verify clip position changed
    expect(clip.style.left).not.toBe(initialPosition)

    // Verify snapping occurred (should snap to nearest grid position)
    const newPosition = parseInt(clip.style.left)
    expect(newPosition % 60).toBe(0) // Assuming 60px per beat default
  })

  test('dragging updates undo history', async () => {
    const user = userEvent.setup()
    render(<DAWComponent />)

    await uploadMockTrack()

    const clip = screen.getByTitle(/test\.mp3/)
    const initialPosition = clip.style.left

    // Drag clip
    await dragClip(clip, 100)

    // Undo with Ctrl+Z
    await user.keyboard('{Control>}z{/Control}')

    // Verify clip returned to original position
    expect(clip.style.left).toBe(initialPosition)
  })
})
```

### 4. Playback Tests
```typescript
describe('Audio Playback', () => {
  test('play button starts playback', async () => {
    const user = userEvent.setup()
    render(<DAWComponent />)

    await uploadMockTrack()

    const playButton = screen.getByText('Play')
    await user.click(playButton)

    // Verify audio context methods were called
    expect(global.AudioContext.prototype.createBufferSource).toHaveBeenCalled()

    // Verify UI state changed
    expect(screen.getByText('Pause')).toBeInTheDocument()
    expect(playButton).toBeDisabled()
  })

  test('spacebar toggles playback', async () => {
    const user = userEvent.setup()
    render(<DAWComponent />)

    await uploadMockTrack()

    // Press spacebar to play
    await user.keyboard(' ')
    expect(screen.getByText('Pause')).toBeInTheDocument()

    // Press spacebar to pause
    await user.keyboard(' ')
    expect(screen.getByText('Play')).toBeInTheDocument()
  })

  test('multiple clips play simultaneously', async () => {
    render(<DAWComponent />)

    // Upload two tracks
    await uploadMockTrack('track1.mp3')
    await uploadMockTrack('track2.mp3')

    const playButton = screen.getByText('Play')
    await user.click(playButton)

    // Verify multiple audio sources were created
    expect(global.AudioContext.prototype.createBufferSource).toHaveBeenCalledTimes(2)
  })
})
```

### 5. Timeline and Zoom Tests
```typescript
describe('Timeline Controls', () => {
  test('zoom controls change timeline scale', async () => {
    const user = userEvent.setup()
    render(<DAWComponent />)

    await uploadMockTrack()

    const zoomInButton = screen.getByText('+')
    const clip = screen.getByTitle(/test\.mp3/)
    const initialWidth = clip.style.width

    await user.click(zoomInButton)

    // Verify clip width increased (zoom in makes things wider)
    expect(parseInt(clip.style.width)).toBeGreaterThan(parseInt(initialWidth))
  })

  test('BPM change updates grid spacing', async () => {
    const user = userEvent.setup()
    render(<DAWComponent />)

    const bpmInput = screen.getByDisplayValue('120')
    await user.clear(bpmInput)
    await user.type(bpmInput, '140')

    // Verify grid markers updated (would need to test actual grid line positions)
    expect(bpmInput).toHaveValue(140)
  })

  test('metronome toggle enables click track', async () => {
    const user = userEvent.setup()
    render(<DAWComponent />)

    const metronomeCheckbox = screen.getByLabelText('Metronome')
    await user.click(metronomeCheckbox)

    expect(metronomeCheckbox).toBeChecked()

    // Start playback and verify metronome sounds
    await user.click(screen.getByText('Play'))
    expect(global.AudioContext.prototype.createOscillator).toHaveBeenCalled()
  })
})
```

### 6. Export/Import Tests
```typescript
describe('Project Export/Import', () => {
  test('export creates valid JSON project', async () => {
    const user = userEvent.setup()
    render(<DAWComponent />)

    await uploadMockTrack()

    // Mock URL.createObjectURL for download test
    global.URL.createObjectURL = vi.fn(() => 'blob:mock-url')

    // Trigger export with Ctrl+S
    await user.keyboard('{Control>}s{/Control}')

    // Verify download was triggered
    expect(global.URL.createObjectURL).toHaveBeenCalled()

    // Could also capture and verify the JSON structure
    const createObjectURLCall = vi.mocked(global.URL.createObjectURL).mock.calls[0][0]
    expect(createObjectURLCall.type).toBe('application/json')
  })

  test('exported JSON contains clip positions and metadata', async () => {
    // Implementation would verify the actual JSON content structure
    // This requires capturing the Blob content and parsing it
  })
})
```

### 7. Track Controls Tests
```typescript
describe('Track Controls', () => {
  test('mute button silences track', async () => {
    const user = userEvent.setup()
    render(<DAWComponent />)

    await uploadMockTrack()

    const muteButton = screen.getByText('M')
    await user.click(muteButton)

    // Verify mute button is visually active
    expect(muteButton).toHaveClass('bg-red-500')

    // Start playback and verify muted track has zero gain
    await user.click(screen.getByText('Play'))

    const gainNodes = vi.mocked(global.AudioContext.prototype.createGain).mock.results
    expect(gainNodes[0].value.gain.value).toBe(0) // Muted = 0 gain
  })

  test('solo button isolates track', async () => {
    const user = userEvent.setup()
    render(<DAWComponent />)

    await uploadMockTrack('track1.mp3')
    await uploadMockTrack('track2.mp3')

    // Solo the first track
    const soloButtons = screen.getAllByText('S')
    await user.click(soloButtons[0])

    expect(soloButtons[0]).toHaveClass('bg-yellow-500')

    // Start playback and verify only soloed track plays
    await user.click(screen.getByText('Play'))

    // Implementation would verify gain settings for each track
  })
})
```

## Integration Tests

### End-to-End Workflow Test
```typescript
describe('Complete DAW Workflow', () => {
  test('full composition workflow', async () => {
    const user = userEvent.setup()
    render(<DAWComponent />)

    // 1. Upload multiple tracks
    await uploadMockTrack('drums.wav')
    await uploadMockTrack('bass.mp3')
    await uploadMockTrack('melody.wav')

    // 2. Arrange tracks on timeline
    const clips = screen.getAllByTitle(/\.(wav|mp3)/)
    await dragClip(clips[1], 120) // Move bass 2 seconds later
    await dragClip(clips[2], 240) // Move melody 4 seconds later

    // 3. Adjust tempo and zoom
    await user.clear(screen.getByDisplayValue('120'))
    await user.type(screen.getByDisplayValue(''), '130')
    await user.click(screen.getByText('+')) // Zoom in

    // 4. Test playback with arrangement
    await user.click(screen.getByText('Play'))

    // 5. Export project
    await user.keyboard('{Control>}s{/Control}')

    // Verify all steps completed successfully
    expect(screen.getByDisplayValue('130')).toBeInTheDocument()
    expect(global.AudioContext.prototype.createBufferSource).toHaveBeenCalledTimes(3)
    expect(global.URL.createObjectURL).toHaveBeenCalled()
  })
})
```

## Testing Utilities

### Helper Functions
```typescript
// test-utils.tsx
export async function uploadMockTrack(filename = 'test.mp3') {
  const fileInput = screen.getByLabelText('+ Add Audio')
  const mockFile = new File(['audio'], filename, { type: 'audio/mp3' })

  vi.mocked(global.AudioContext.prototype.decodeAudioData).mockResolvedValue({
    length: 44100,
    duration: 1.0,
    sampleRate: 44100,
    getChannelData: vi.fn(() => new Float32Array(44100)),
  })

  await userEvent.upload(fileInput, mockFile)

  await waitFor(() => {
    expect(screen.getByText(filename)).toBeInTheDocument()
  })
}

export async function dragClip(clipElement: HTMLElement, deltaX: number) {
  await userEvent.pointer([
    { keys: '[MouseLeft>]', target: clipElement },
    { coords: { x: deltaX, y: 0 } },
    { keys: '[/MouseLeft]' },
  ])
}
```

## Performance Tests

### Memory and Performance Tests
```typescript
describe('Performance', () => {
  test('handles multiple large files without memory leaks', async () => {
    // Test with many files
    // Monitor memory usage
    // Verify cleanup on component unmount
  })

  test('maintains 60fps during playback with many tracks', async () => {
    // Test frame rate during playback
    // Verify smooth animation performance
  })
})
```

## Running Tests

### Commands
```bash
# Run all tests
npm test

# Run with coverage
npm run test -- --coverage

# Run specific test file
npm test -- DAWComponent.test.tsx

# Run in watch mode
npm test -- --watch

# Run with UI
npm run test:ui
```

### Test Coverage Goals
- **Statements**: 90%+
- **Branches**: 85%+
- **Functions**: 95%+
- **Lines**: 90%+

Focus on testing:
1. ✅ Critical user interactions (upload, drag, playback)
2. ✅ Audio processing logic (Web Audio API integration)
3. ✅ State management (timeline state, history)
4. ✅ Error handling (file upload failures, audio context errors)
5. ✅ Keyboard shortcuts and accessibility
6. ✅ Export/import functionality

This testing strategy ensures the DAW component is robust, performant, and reliable across different browsers and usage scenarios.