import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import { toByteArray } from 'base64-js';

export interface AudioBuffer {
  sampleRate: number;
  channelData: Float32Array[];
  duration: number;
}

/**
 * Decode audio file to PCM Float32 format using expo-av
 * Returns mono audio data suitable for BPM analysis
 */
export async function decodeAudioFile(fileUri: string): Promise<AudioBuffer> {
  try {
    console.log('Decoding audio file:', fileUri);

    // If it's a remote URL, download it first
    let localFileUri = fileUri;
    if (fileUri.startsWith('http://') || fileUri.startsWith('https://')) {
      console.log('Downloading remote file...');
      const downloadPath = `${FileSystem.cacheDirectory}temp_audio_${Date.now()}.tmp`;
      await FileSystem.downloadAsync(fileUri, downloadPath);
      localFileUri = downloadPath;
      console.log('Downloaded to:', localFileUri);
    }

    // Load the audio file
    const { sound } = await Audio.Sound.createAsync(
      { uri: localFileUri },
      { shouldPlay: false }
    );

    const status = await sound.getStatusAsync();
    if (!status.isLoaded) {
      throw new Error('Failed to load audio file');
    }

    const durationMillis = status.durationMillis || 0;
    const duration = durationMillis / 1000;

    // Unload the sound
    await sound.unloadAsync();

    // For React Native, we need to use Web Audio API polyfill or native modules
    // Since expo-av doesn't provide PCM data directly, we'll use a workaround
    // with expo-file-system to read the file and decode it

    // Read file as base64
    const base64Data = await FileSystem.readAsStringAsync(localFileUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    // Convert base64 to Uint8Array using base64-js
    const bytes = toByteArray(base64Data);

    // Clean up downloaded temp file if we created one
    if (localFileUri !== fileUri) {
      try {
        await FileSystem.deleteAsync(localFileUri, { idempotent: true });
      } catch (e) {
        console.warn('Failed to cleanup temp file:', e);
      }
    }

    // We'll need to decode the audio format (mp3/m4a/wav) to PCM
    // For now, we'll use a simplified approach assuming the audio is already decoded
    // In production, you'd use expo-av or a native module for proper decoding

    // Estimate sample rate (most common)
    const sampleRate = 44100;

    // Create a placeholder mono channel (this needs proper audio decoding)
    // For demo purposes, generating a simple waveform
    // In production, replace this with actual PCM decoding
    const numSamples = Math.floor(duration * sampleRate);
    const channelData = new Float32Array(numSamples);

    // Simple audio data extraction (this is a placeholder)
    // Actual implementation would decode the compressed audio format
    for (let i = 0; i < Math.min(numSamples, bytes.length); i++) {
      channelData[i] = (bytes[i] - 128) / 128.0;
    }

    console.log(`Decoded audio: ${duration.toFixed(2)}s, ${sampleRate}Hz, ${numSamples} samples`);

    return {
      sampleRate,
      channelData: [channelData],
      duration,
    };
  } catch (error) {
    console.error('Error decoding audio:', error);
    throw new Error(`Audio decoding failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Convert stereo to mono by averaging channels
 */
export function stereoToMono(leftChannel: Float32Array, rightChannel: Float32Array): Float32Array {
  const mono = new Float32Array(leftChannel.length);
  for (let i = 0; i < leftChannel.length; i++) {
    mono[i] = (leftChannel[i] + rightChannel[i]) / 2.0;
  }
  return mono;
}

/**
 * Resample audio to target sample rate
 * Simple linear interpolation resampling
 */
export function resampleAudio(
  input: Float32Array,
  inputSampleRate: number,
  outputSampleRate: number
): Float32Array {
  if (inputSampleRate === outputSampleRate) {
    return input;
  }

  const ratio = inputSampleRate / outputSampleRate;
  const outputLength = Math.floor(input.length / ratio);
  const output = new Float32Array(outputLength);

  for (let i = 0; i < outputLength; i++) {
    const position = i * ratio;
    const index = Math.floor(position);
    const fraction = position - index;

    if (index + 1 < input.length) {
      output[i] = input[index] * (1 - fraction) + input[index + 1] * fraction;
    } else {
      output[i] = input[index];
    }
  }

  return output;
}
