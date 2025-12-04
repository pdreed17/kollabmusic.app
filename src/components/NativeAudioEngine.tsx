/**
 * Native Audio Engine Component
 *
 * A comprehensive audio engine built with expo-av for native audio playback
 * in the DAW. Handles multiple tracks, mixing, effects, and synchronization.
 */

import React, { useState, useRef, useCallback, useEffect } from 'react'
import { Audio, AVPlaybackStatus } from 'expo-av'
import { Alert } from 'react-native'

// =================== TYPES ===================

export interface AudioTrack {
  id: string
  uri: string
  name: string
  volume: number // 0-1
  muted: boolean
  solo: boolean
  startTime: number // seconds offset in timeline
  duration: number
  effects: AudioEffect[]
  waveformData?: number[]
}

export interface AudioEffect {
  id: string
  type: 'reverb' | 'delay' | 'eq' | 'compressor' | 'distortion'
  enabled: boolean
  parameters: Record<string, number>
}

export interface PlaybackState {
  isPlaying: boolean
  position: number // current playback position in seconds
  duration: number // total project duration
  bpm: number
  isRecording: boolean
  masterVolume: number
}

export interface MixingState {
  tracks: AudioTrack[]
  masterVolume: number
  masterMuted: boolean
  soloedTracks: string[]
}

export interface AudioEngineProps {
  tracks: AudioTrack[]
  onPlaybackStateChange?: (state: PlaybackState) => void
  onPositionUpdate?: (position: number) => void
  onTrackUpdate?: (trackId: string, updates: Partial<AudioTrack>) => void
  onError?: (error: string) => void
  bpm?: number
  masterVolume?: number
  isPlaying?: boolean
  position?: number
}

// =================== AUDIO ENGINE HOOK ===================

export function useNativeAudioEngine({
  tracks,
  onPlaybackStateChange,
  onPositionUpdate,
  onTrackUpdate,
  onError,
  bpm = 120,
  masterVolume = 1.0,
}: AudioEngineProps) {

  // =================== STATE ===================

  const [playbackState, setPlaybackState] = useState<PlaybackState>({
    isPlaying: false,
    position: 0,
    duration: 0,
    bpm,
    isRecording: false,
    masterVolume,
  })

  const [mixingState, setMixingState] = useState<MixingState>({
    tracks,
    masterVolume,
    masterMuted: false,
    soloedTracks: [],
  })

  const [isInitialized, setIsInitialized] = useState(false)

  // =================== REFS ===================

  const soundRefs = useRef<Map<string, Audio.Sound>>(new Map())
  const positionInterval = useRef<NodeJS.Timeout | null>(null)
  const playbackStartTime = useRef<number>(0)
  const playbackOffset = useRef<number>(0)

  // =================== INITIALIZATION ===================

  const initializeAudio = useCallback(async () => {
    try {
      // Configure audio session for optimal DAW performance
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        interruptionModeIOS: Audio.INTERRUPTION_MODE_IOS_DO_NOT_MIX,
        playsInSilentModeIOS: true,
        interruptionModeAndroid: Audio.INTERRUPTION_MODE_ANDROID_DO_NOT_MIX,
        shouldDuckAndroid: true,
        staysActiveInBackground: true,
        playThroughEarpieceAndroid: false,
      })

      // Load all track audio files
      await loadTracks(tracks)

      setIsInitialized(true)
    } catch (error) {
      const errorMessage = `Failed to initialize audio engine: ${error}`
      console.error(errorMessage)
      onError?.(errorMessage)
    }
  }, [tracks, onError])

  const loadTracks = useCallback(async (tracksToLoad: AudioTrack[]) => {
    try {
      // Unload existing sounds
      for (const sound of soundRefs.current.values()) {
        try {
          await sound.unloadAsync()
        } catch (e) {
          console.warn('Error unloading sound:', e)
        }
      }
      soundRefs.current.clear()

      // Load new sounds
      for (const track of tracksToLoad) {
        if (track.uri) {
          try {
            const { sound } = await Audio.Sound.createAsync(
              { uri: track.uri },
              {
                shouldPlay: false,
                isLooping: false,
                volume: track.volume,
                isMuted: track.muted,
              }
            )

            // Set up status update callback for each track
            sound.setOnPlaybackStatusUpdate((status) => {
              onTrackPlaybackUpdate(track.id, status)
            })

            soundRefs.current.set(track.id, sound)
          } catch (error) {
            console.error(`Failed to load track ${track.name}:`, error)
          }
        }
      }

      // Calculate total project duration
      const maxDuration = Math.max(
        ...tracksToLoad.map(track => track.startTime + track.duration),
        0
      )

      setPlaybackState(prev => ({ ...prev, duration: maxDuration }))
    } catch (error) {
      const errorMessage = `Failed to load tracks: ${error}`
      console.error(errorMessage)
      onError?.(errorMessage)
    }
  }, [onError])

  // =================== PLAYBACK CONTROL ===================

  const play = useCallback(async (startPosition: number = playbackState.position) => {
    try {
      if (!isInitialized) {
        await initializeAudio()
        return
      }

      playbackStartTime.current = Date.now()
      playbackOffset.current = startPosition

      // Start position tracking
      if (positionInterval.current) {
        clearInterval(positionInterval.current)
      }

      positionInterval.current = setInterval(() => {
        const elapsed = (Date.now() - playbackStartTime.current) / 1000
        const currentPosition = playbackOffset.current + elapsed

        setPlaybackState(prev => ({ ...prev, position: currentPosition }))
        onPositionUpdate?.(currentPosition)
      }, 50) // 20fps position updates

      // Calculate playback positions for each track considering their start times
      const playPromises = tracks.map(async (track) => {
        const sound = soundRefs.current.get(track.id)
        if (!sound || track.muted) return

        // Check if this track should be playing at the current position
        const trackEndTime = track.startTime + track.duration
        if (startPosition >= track.startTime && startPosition < trackEndTime) {
          // Calculate position within this track
          const trackPosition = (startPosition - track.startTime) * 1000 // expo-av uses milliseconds

          // Apply solo logic
          const soloedTracks = mixingState.soloedTracks
          const shouldPlay = soloedTracks.length === 0 || soloedTracks.includes(track.id)

          if (shouldPlay) {
            await sound.setPositionAsync(trackPosition)
            await sound.playAsync()
          }
        }
      })

      await Promise.all(playPromises)

      const newState = { ...playbackState, isPlaying: true, position: startPosition }
      setPlaybackState(newState)
      onPlaybackStateChange?.(newState)

    } catch (error) {
      const errorMessage = `Playback failed: ${error}`
      console.error(errorMessage)
      onError?.(errorMessage)
    }
  }, [playbackState, tracks, mixingState.soloedTracks, isInitialized, initializeAudio, onPlaybackStateChange, onPositionUpdate, onError])

  const pause = useCallback(async () => {
    try {
      if (positionInterval.current) {
        clearInterval(positionInterval.current)
        positionInterval.current = null
      }

      // Pause all tracks
      const pausePromises = Array.from(soundRefs.current.values()).map(
        sound => sound.pauseAsync()
      )

      await Promise.all(pausePromises)

      const newState = { ...playbackState, isPlaying: false }
      setPlaybackState(newState)
      onPlaybackStateChange?.(newState)

    } catch (error) {
      const errorMessage = `Pause failed: ${error}`
      console.error(errorMessage)
      onError?.(errorMessage)
    }
  }, [playbackState, onPlaybackStateChange, onError])

  const stop = useCallback(async () => {
    try {
      await pause()

      // Stop and reset all tracks
      const stopPromises = Array.from(soundRefs.current.values()).map(
        sound => sound.setPositionAsync(0)
      )

      await Promise.all(stopPromises)

      const newState = { ...playbackState, isPlaying: false, position: 0 }
      setPlaybackState(newState)
      onPlaybackStateChange?.(newState)

    } catch (error) {
      const errorMessage = `Stop failed: ${error}`
      console.error(errorMessage)
      onError?.(errorMessage)
    }
  }, [pause, playbackState, onPlaybackStateChange, onError])

  const seekTo = useCallback(async (position: number) => {
    try {
      const wasPlaying = playbackState.isPlaying

      if (wasPlaying) {
        await pause()
      }

      // Update position for all tracks
      const seekPromises = tracks.map(async (track) => {
        const sound = soundRefs.current.get(track.id)
        if (!sound) return

        // Calculate position within this track
        if (position >= track.startTime && position < track.startTime + track.duration) {
          const trackPosition = (position - track.startTime) * 1000
          await sound.setPositionAsync(Math.max(0, trackPosition))
        } else {
          await sound.setPositionAsync(0)
        }
      })

      await Promise.all(seekPromises)

      const newState = { ...playbackState, position }
      setPlaybackState(newState)
      onPlaybackStateChange?.(newState)
      onPositionUpdate?.(position)

      if (wasPlaying) {
        await play(position)
      }

    } catch (error) {
      const errorMessage = `Seek failed: ${error}`
      console.error(errorMessage)
      onError?.(errorMessage)
    }
  }, [playbackState, tracks, pause, play, onPlaybackStateChange, onPositionUpdate, onError])

  // =================== MIXING CONTROLS ===================

  const setTrackVolume = useCallback(async (trackId: string, volume: number) => {
    try {
      const sound = soundRefs.current.get(trackId)
      if (sound) {
        await sound.setVolumeAsync(volume * mixingState.masterVolume)
      }

      // Update track state
      onTrackUpdate?.(trackId, { volume })
    } catch (error) {
      console.error(`Failed to set volume for track ${trackId}:`, error)
    }
  }, [mixingState.masterVolume, onTrackUpdate])

  const setTrackMuted = useCallback(async (trackId: string, muted: boolean) => {
    try {
      const sound = soundRefs.current.get(trackId)
      if (sound) {
        await sound.setIsMutedAsync(muted)
      }

      onTrackUpdate?.(trackId, { muted })
    } catch (error) {
      console.error(`Failed to mute track ${trackId}:`, error)
    }
  }, [onTrackUpdate])

  const setSolo = useCallback(async (trackId: string, solo: boolean) => {
    try {
      const newSoloedTracks = solo
        ? [...mixingState.soloedTracks, trackId]
        : mixingState.soloedTracks.filter(id => id !== trackId)

      setMixingState(prev => ({ ...prev, soloedTracks: newSoloedTracks }))

      // Update all track solo states
      for (const [id, sound] of soundRefs.current) {
        const shouldBeSoloed = newSoloedTracks.length === 0 || newSoloedTracks.includes(id)
        await sound.setIsMutedAsync(!shouldBeSoloed)
      }

      onTrackUpdate?.(trackId, { solo })
    } catch (error) {
      console.error(`Failed to set solo for track ${trackId}:`, error)
    }
  }, [mixingState.soloedTracks, onTrackUpdate])

  const setMasterVolume = useCallback(async (volume: number) => {
    try {
      setMixingState(prev => ({ ...prev, masterVolume: volume }))

      // Update volume for all tracks
      const volumePromises = tracks.map(async (track) => {
        const sound = soundRefs.current.get(track.id)
        if (sound) {
          await sound.setVolumeAsync(track.volume * volume)
        }
      })

      await Promise.all(volumePromises)

      setPlaybackState(prev => ({ ...prev, masterVolume: volume }))
    } catch (error) {
      console.error('Failed to set master volume:', error)
    }
  }, [tracks])

  // =================== STATUS UPDATES ===================

  const onTrackPlaybackUpdate = useCallback((trackId: string, status: AVPlaybackStatus) => {
    if (status.isLoaded) {
      // Handle track-specific playback events
      if (status.didJustFinish) {
        console.log(`Track ${trackId} finished playing`)
      }

      // Could emit track-level events here if needed
    }
  }, [])

  // =================== CLEANUP ===================

  useEffect(() => {
    initializeAudio()

    return () => {
      if (positionInterval.current) {
        clearInterval(positionInterval.current)
      }

      // Unload all sounds
      for (const sound of soundRefs.current.values()) {
        sound.unloadAsync().catch(console.warn)
      }
    }
  }, [initializeAudio])

  // Update tracks when they change
  useEffect(() => {
    if (isInitialized) {
      loadTracks(tracks)
    }
  }, [tracks, isInitialized, loadTracks])

  // =================== RETURN INTERFACE ===================

  return {
    // State
    playbackState,
    mixingState,
    isInitialized,

    // Playback controls
    play,
    pause,
    stop,
    seekTo,

    // Mixing controls
    setTrackVolume,
    setTrackMuted,
    setSolo,
    setMasterVolume,

    // Utility
    initializeAudio,
  }
}

// =================== AUDIO ENGINE COMPONENT ===================

export default function NativeAudioEngine(props: AudioEngineProps) {
  const audioEngine = useNativeAudioEngine(props)

  // This component mainly provides the hook functionality
  // The actual UI controls would be in the DAWTimeline component
  return null
}

// =================== UTILITY FUNCTIONS ===================

/**
 * Convert seconds to BPM-based grid position
 */
export function secondsToBeats(seconds: number, bpm: number): number {
  return (seconds / 60) * bpm
}

/**
 * Convert BPM-based grid position to seconds
 */
export function beatsToSeconds(beats: number, bpm: number): number {
  return (beats / bpm) * 60
}

/**
 * Snap position to grid based on BPM
 */
export function snapToGrid(
  position: number,
  bpm: number,
  subdivision: number = 4 // 4 = quarter notes, 8 = eighth notes, etc.
): number {
  const beatLength = 60 / bpm
  const gridSize = beatLength / (subdivision / 4)
  return Math.round(position / gridSize) * gridSize
}

/**
 * Calculate optimal buffer size based on device capabilities
 */
export function getOptimalBufferSize(): number {
  // This would ideally check device performance and adjust accordingly
  return 2048 // Default buffer size
}

/**
 * Generate click track for metronome
 */
export function generateClickTrack(
  duration: number,
  bpm: number,
  sampleRate: number = 44100
): number[] {
  const beatInterval = 60 / bpm
  const samples = Math.floor(duration * sampleRate)
  const clickSamples: number[] = new Array(samples).fill(0)

  let currentBeat = 0
  while (currentBeat * beatInterval < duration) {
    const sampleIndex = Math.floor(currentBeat * beatInterval * sampleRate)

    // Generate a simple click sound (sine wave burst)
    for (let i = 0; i < 1000 && sampleIndex + i < samples; i++) {
      const amplitude = Math.exp(-i / 200) * 0.5 // Exponential decay
      clickSamples[sampleIndex + i] = amplitude * Math.sin(2 * Math.PI * 1000 * i / sampleRate)
    }

    currentBeat++
  }

  return clickSamples
}