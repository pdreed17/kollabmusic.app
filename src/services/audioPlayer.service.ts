// services/audioPlayer.service.ts
// Expo Go Compatible Audio Player Service using expo-av

import { Audio, AVPlaybackStatus } from 'expo-av';

export interface TrackInfo {
  id: string;
  uri: string;
  title: string;
  artist?: string;
  volume?: number;
  pan?: number;
  isMuted?: boolean;
  isSoloed?: boolean;
}

class AudioPlayerService {
  private sounds: Map<string, Audio.Sound> = new Map();
private playbackStatuses: Map<string, AVPlaybackStatus> = new Map();
  private isPlaying: boolean = false;
  private currentPosition: number = 0;
  private listeners: Map<string, ((status: any) => void)[]> = new Map();

  constructor() {
    // Configure audio mode for playback
    this.initializeAudio();
  }

  private async initializeAudio() {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });
    } catch (error) {
      if (__DEV__) console.error('Error initializing audio:', error);
    }
  }

  /**
   * Load a single audio track
   */
  async loadTrack(trackInfo: TrackInfo): Promise<void> {
    try {
      // Check if track already loaded
      if (this.sounds.has(trackInfo.id)) {
        if (__DEV__) console.log(`Track ${trackInfo.id} already loaded`);
        return;
      }

      // Create and load the sound
      const { sound } = await Audio.Sound.createAsync(
        { uri: trackInfo.uri },
        {
          shouldPlay: false,
          volume: trackInfo.volume ?? 1.0,
          isMuted: trackInfo.isMuted ?? false,
        },
        (status) => this.onPlaybackStatusUpdate(trackInfo.id, status)
      );

      this.sounds.set(trackInfo.id, sound);
      if (__DEV__) console.log(`Track ${trackInfo.id} loaded successfully`);
    } catch (error) {
      if (__DEV__) console.error(`Error loading track ${trackInfo.id}:`, error);
      throw error;
    }
  }

  /**
   * Load multiple tracks at once
   */
  async loadTracks(tracks: TrackInfo[]): Promise<void> {
    try {
      await Promise.all(tracks.map(track => this.loadTrack(track)));
      if (__DEV__) console.log(`Loaded ${tracks.length} tracks`);
    } catch (error) {
      if (__DEV__) console.error('Error loading tracks:', error);
      throw error;
    }
  }

  /**
   * Play all loaded tracks in sync
   */
  async play(): Promise<void> {
    try {
      if (this.sounds.size === 0) {
        if (__DEV__) console.warn('No tracks loaded');
        return;
      }

      // Play all sounds simultaneously
      const playPromises = Array.from(this.sounds.values()).map(sound =>
        sound.playAsync()
      );

      await Promise.all(playPromises);
      this.isPlaying = true;
      this.notifyListeners('play', { isPlaying: true });
    } catch (error) {
      if (__DEV__) console.error('Error playing tracks:', error);
      throw error;
    }
  }

  /**
   * Pause all tracks
   */
  async pause(): Promise<void> {
    try {
      const pausePromises = Array.from(this.sounds.values()).map(sound =>
        sound.pauseAsync()
      );

      await Promise.all(pausePromises);
      this.isPlaying = false;
      this.notifyListeners('pause', { isPlaying: false });
    } catch (error) {
      if (__DEV__) console.error('Error pausing tracks:', error);
      throw error;
    }
  }

  /**
   * Stop all tracks and reset position to beginning
   */
  async stop(): Promise<void> {
    try {
      const stopPromises = Array.from(this.sounds.values()).map(sound =>
        sound.stopAsync()
      );

      await Promise.all(stopPromises);
      this.isPlaying = false;
      this.currentPosition = 0;
      this.notifyListeners('stop', { isPlaying: false, position: 0 });
    } catch (error) {
      if (__DEV__) console.error('Error stopping tracks:', error);
      throw error;
    }
  }

  /**
   * Seek to a specific position (in milliseconds)
   */
  async seekTo(positionMillis: number): Promise<void> {
    try {
      const seekPromises = Array.from(this.sounds.values()).map(sound =>
        sound.setPositionAsync(positionMillis)
      );

      await Promise.all(seekPromises);
      this.currentPosition = positionMillis;
      this.notifyListeners('seek', { position: positionMillis });
    } catch (error) {
      if (__DEV__) console.error('Error seeking:', error);
      throw error;
    }
  }

  /**
   * Set volume for a specific track
   */
  async setTrackVolume(trackId: string, volume: number): Promise<void> {
    try {
      const sound = this.sounds.get(trackId);
      if (!sound) {
        if (__DEV__) console.warn(`Track ${trackId} not found`);
        return;
      }

      // Clamp volume between 0 and 1
      const clampedVolume = Math.max(0, Math.min(1, volume));
      await sound.setVolumeAsync(clampedVolume);

      this.notifyListeners('volumeChange', { trackId, volume: clampedVolume });
    } catch (error) {
      if (__DEV__) console.error(`Error setting volume for track ${trackId}:`, error);
      throw error;
    }
  }

  /**
   * Mute/unmute a specific track
   */
  async setTrackMuted(trackId: string, isMuted: boolean): Promise<void> {
    try {
      const sound = this.sounds.get(trackId);
      if (!sound) {
        if (__DEV__) console.warn(`Track ${trackId} not found`);
        return;
      }

      await sound.setIsMutedAsync(isMuted);
      this.notifyListeners('muteChange', { trackId, isMuted });
    } catch (error) {
      if (__DEV__) console.error(`Error muting track ${trackId}:`, error);
      throw error;
    }
  }

  /**
   * Solo a track (mute all others)
   */
  async soloTrack(trackId: string): Promise<void> {
    try {
      const promises = Array.from(this.sounds.entries()).map(([id, sound]) => {
        const shouldMute = id !== trackId;
        return sound.setIsMutedAsync(shouldMute);
      });

      await Promise.all(promises);
      this.notifyListeners('solo', { trackId });
    } catch (error) {
      if (__DEV__) console.error(`Error soloing track ${trackId}:`, error);
      throw error;
    }
  }

  /**
   * Unsolo all tracks (unmute everything)
   */
  async unsoloAll(): Promise<void> {
    try {
      const promises = Array.from(this.sounds.values()).map(sound =>
        sound.setIsMutedAsync(false)
      );

      await Promise.all(promises);
      this.notifyListeners('unsolo', {});
    } catch (error) {
      if (__DEV__) console.error('Error unsoloing tracks:', error);
      throw error;
    }
  }

  /**
   * Get current playback position (in milliseconds)
   */
  async getCurrentPosition(): Promise<number> {
    try {
      // Get position from first track (they should all be in sync)
      const firstSound = Array.from(this.sounds.values())[0];
      if (!firstSound) return 0;

      const status = await firstSound.getStatusAsync();
      if (status.isLoaded) {
        return status.positionMillis;
      }
      return 0;
    } catch (error) {
      if (__DEV__) console.error('Error getting position:', error);
      return 0;
    }
  }

  /**
   * Get duration of a track (in milliseconds)
   */
  async getTrackDuration(trackId: string): Promise<number> {
    try {
      const sound = this.sounds.get(trackId);
      if (!sound) return 0;

      const status = await sound.getStatusAsync();
      if (status.isLoaded && status.durationMillis) {
        return status.durationMillis;
      }
      return 0;
    } catch (error) {
      if (__DEV__) console.error(`Error getting duration for track ${trackId}:`, error);
      return 0;
    }
  }

  /**
   * Check if currently playing
   */
  getIsPlaying(): boolean {
    return this.isPlaying;
  }

  /**
   * Unload a specific track
   */
  async unloadTrack(trackId: string): Promise<void> {
    try {
      const sound = this.sounds.get(trackId);
      if (!sound) return;

      await sound.unloadAsync();
      this.sounds.delete(trackId);
      if (__DEV__) console.log(`Track ${trackId} unloaded`);
    } catch (error) {
      if (__DEV__) console.error(`Error unloading track ${trackId}:`, error);
    }
  }

  /**
   * Unload all tracks and clean up
   */
  async unloadAll(): Promise<void> {
    try {
      const unloadPromises = Array.from(this.sounds.values()).map(sound =>
        sound.unloadAsync()
      );

      await Promise.all(unloadPromises);
      this.sounds.clear();
      this.isPlaying = false;
      this.currentPosition = 0;
      if (__DEV__) console.log('All tracks unloaded');
    } catch (error) {
      if (__DEV__) console.error('Error unloading tracks:', error);
    }
  }

  /**
   * Add event listener
   */
  addEventListener(event: string, callback: (status: any) => void): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);

    // Return unsubscribe function
    return () => {
      const callbacks = this.listeners.get(event);
      if (callbacks) {
        const index = callbacks.indexOf(callback);
        if (index > -1) {
          callbacks.splice(index, 1);
        }
      }
    };
  }

  /**
   * Internal playback status update handler
   */
  private onPlaybackStatusUpdate(trackId: string, status: AVPlaybackStatus): void {
    if (status.isLoaded) {
      this.playbackStatuses.set(trackId, status);
      
      // Update current position from first track
      if (trackId === Array.from(this.sounds.keys())[0]) {
        this.currentPosition = status.positionMillis;
      }

      // Notify progress listeners
      this.notifyListeners('progress', {
        trackId,
        position: status.positionMillis,
        duration: status.durationMillis,
      });

      // Check if playback finished
      if (status.didJustFinish) {
        this.isPlaying = false;
        this.notifyListeners('finished', { trackId });
      }
    }
  }

  /**
   * Notify all listeners for a specific event
   */
  private notifyListeners(event: string, data: any): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach(callback => callback(data));
    }
  }
}

// Export singleton instance
export default new AudioPlayerService();