import { decodeAudioFile, resampleAudio, stereoToMono } from './audioDecoder';

/**
 * Offline BPM Detection for React Native
 * Uses beat tracking algorithm with autocorrelation
 * Falls back to tempo estimation if primary method fails
 */

export interface BPMResult {
  bpm: number;
  confidence: number;
  method: 'rhythm-extractor' | 'autocorrelation' | 'energy-peaks';
}

/**
 * Main BPM detection function
 * @param fileUri - Local file URI (file://, content://, or asset path)
 * @returns Promise<number> - Detected BPM rounded to nearest integer
 */
export async function detectBPM(fileUri: string): Promise<number> {
  try {
    console.log('Starting BPM detection for:', fileUri);

    // Decode audio to PCM
    const audioBuffer = await decodeAudioFile(fileUri);

    // Convert to mono if stereo
    const monoData =
      audioBuffer.channelData.length > 1
        ? stereoToMono(audioBuffer.channelData[0], audioBuffer.channelData[1])
        : audioBuffer.channelData[0];

    // Resample to 44.1kHz if needed (standard for BPM analysis)
    const targetSampleRate = 44100;
    const resampledData =
      audioBuffer.sampleRate !== targetSampleRate
        ? resampleAudio(monoData, audioBuffer.sampleRate, targetSampleRate)
        : monoData;

    // Try autocorrelation-based BPM detection
    try {
      const result = await detectBPMAutocorrelation(resampledData, targetSampleRate);
      console.log(`BPM detected: ${result.bpm} (confidence: ${result.confidence.toFixed(2)}, method: ${result.method})`);
      return Math.round(result.bpm);
    } catch (error) {
      console.warn('Autocorrelation failed, trying energy-based detection:', error);
      const result = await detectBPMEnergyBased(resampledData, targetSampleRate);
      console.log(`BPM detected: ${result.bpm} (method: ${result.method})`);
      return Math.round(result.bpm);
    }
  } catch (error) {
    console.error('BPM detection error:', error);
    throw new Error(`Failed to detect BPM: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Autocorrelation-based BPM detection
 * More accurate for songs with clear rhythm
 */
async function detectBPMAutocorrelation(
  audioData: Float32Array,
  sampleRate: number
): Promise<BPMResult> {
  // Calculate onset envelope (energy changes)
  const hopSize = 512;
  const onsetEnvelope = calculateOnsetEnvelope(audioData, hopSize);

  // Apply autocorrelation to find periodicity
  const minBPM = 60;
  const maxBPM = 180;
  const minLag = Math.floor((60 / maxBPM) * (sampleRate / hopSize));
  const maxLag = Math.floor((60 / minBPM) * (sampleRate / hopSize));

  const autocorr = autocorrelate(onsetEnvelope, minLag, maxLag);

  // Find peaks in autocorrelation
  const peaks = findPeaks(autocorr, minLag);

  if (peaks.length === 0) {
    throw new Error('No peaks found in autocorrelation');
  }

  // Convert best peak to BPM
  const bestPeakLag = peaks[0].index + minLag;
  const bpm = (60 * (sampleRate / hopSize)) / bestPeakLag;
  const confidence = peaks[0].value;

  // Adjust for common BPM ranges (double/half time)
  const adjustedBPM = adjustBPMRange(bpm);

  return {
    bpm: adjustedBPM,
    confidence,
    method: 'autocorrelation',
  };
}

/**
 * Energy-based BPM detection (fallback method)
 * Works well for electronic music with strong beats
 */
async function detectBPMEnergyBased(
  audioData: Float32Array,
  sampleRate: number
): Promise<BPMResult> {
  const hopSize = 512;
  const energy = calculateEnergy(audioData, hopSize);

  // Find peaks in energy envelope
  const peaks = findPeaks(energy, 20); // Min 20 frames between peaks

  if (peaks.length < 4) {
    // Not enough peaks, return default
    return {
      bpm: 120,
      confidence: 0.5,
      method: 'energy-peaks',
    };
  }

  // Calculate intervals between peaks
  const intervals: number[] = [];
  for (let i = 1; i < peaks.length; i++) {
    intervals.push(peaks[i].index - peaks[i - 1].index);
  }

  // Find most common interval (median)
  intervals.sort((a, b) => a - b);
  const medianInterval = intervals[Math.floor(intervals.length / 2)];

  // Convert to BPM
  const beatsPerSecond = (sampleRate / hopSize) / medianInterval;
  const bpm = beatsPerSecond * 60;

  const adjustedBPM = adjustBPMRange(bpm);

  return {
    bpm: adjustedBPM,
    confidence: 0.75,
    method: 'energy-peaks',
  };
}

/**
 * Calculate onset envelope (first-order difference of energy)
 */
function calculateOnsetEnvelope(audioData: Float32Array, hopSize: number): Float32Array {
  const numFrames = Math.floor(audioData.length / hopSize);
  const envelope = new Float32Array(numFrames);

  let prevEnergy = 0;
  for (let i = 0; i < numFrames; i++) {
    const start = i * hopSize;
    const end = Math.min(start + hopSize, audioData.length);

    // Calculate RMS energy for this frame
    let energy = 0;
    for (let j = start; j < end; j++) {
      energy += audioData[j] * audioData[j];
    }
    energy = Math.sqrt(energy / (end - start));

    // Onset = positive energy change
    envelope[i] = Math.max(0, energy - prevEnergy);
    prevEnergy = energy;
  }

  return envelope;
}

/**
 * Calculate energy envelope
 */
function calculateEnergy(audioData: Float32Array, hopSize: number): Float32Array {
  const numFrames = Math.floor(audioData.length / hopSize);
  const energy = new Float32Array(numFrames);

  for (let i = 0; i < numFrames; i++) {
    const start = i * hopSize;
    const end = Math.min(start + hopSize, audioData.length);

    let sum = 0;
    for (let j = start; j < end; j++) {
      sum += audioData[j] * audioData[j];
    }
    energy[i] = Math.sqrt(sum / (end - start));
  }

  return energy;
}

/**
 * Autocorrelation function
 */
function autocorrelate(data: Float32Array, minLag: number, maxLag: number): Float32Array {
  const lagRange = maxLag - minLag;
  const result = new Float32Array(lagRange);

  for (let lag = 0; lag < lagRange; lag++) {
    const actualLag = lag + minLag;
    let sum = 0;
    let count = 0;

    for (let i = 0; i < data.length - actualLag; i++) {
      sum += data[i] * data[i + actualLag];
      count++;
    }

    result[lag] = sum / count;
  }

  // Normalize
  const max = Math.max(...Array.from(result));
  if (max > 0) {
    for (let i = 0; i < result.length; i++) {
      result[i] /= max;
    }
  }

  return result;
}

/**
 * Find peaks in a signal
 */
function findPeaks(data: Float32Array, minDistance: number): Array<{ index: number; value: number }> {
  const peaks: Array<{ index: number; value: number }> = [];

  for (let i = 1; i < data.length - 1; i++) {
    if (data[i] > data[i - 1] && data[i] > data[i + 1]) {
      // Check if far enough from previous peak
      if (peaks.length === 0 || i - peaks[peaks.length - 1].index >= minDistance) {
        peaks.push({ index: i, value: data[i] });
      } else if (data[i] > peaks[peaks.length - 1].value) {
        // Replace previous peak if this one is higher
        peaks[peaks.length - 1] = { index: i, value: data[i] };
      }
    }
  }

  // Sort by value (highest first)
  peaks.sort((a, b) => b.value - a.value);

  return peaks;
}

/**
 * Adjust BPM to common range (handle double/half time)
 */
function adjustBPMRange(bpm: number): number {
  // Most music is between 60-180 BPM
  while (bpm < 60) {
    bpm *= 2;
  }
  while (bpm > 180) {
    bpm /= 2;
  }

  // Prefer common BPM ranges
  if (bpm > 140 && bpm < 160) {
    // Electronic music often around 140-150
    return bpm;
  } else if (bpm > 110 && bpm < 130) {
    // Pop/rock often around 120
    return bpm;
  } else if (bpm > 80 && bpm < 100) {
    // Hip-hop/downtempo often around 90
    return bpm;
  }

  return bpm;
}

/**
 * Get detailed BPM analysis result
 */
export async function detectBPMDetailed(fileUri: string): Promise<BPMResult> {
  try {
    const audioBuffer = await decodeAudioFile(fileUri);

    const monoData =
      audioBuffer.channelData.length > 1
        ? stereoToMono(audioBuffer.channelData[0], audioBuffer.channelData[1])
        : audioBuffer.channelData[0];

    const targetSampleRate = 44100;
    const resampledData =
      audioBuffer.sampleRate !== targetSampleRate
        ? resampleAudio(monoData, audioBuffer.sampleRate, targetSampleRate)
        : monoData;

    try {
      return await detectBPMAutocorrelation(resampledData, targetSampleRate);
    } catch (error) {
      return await detectBPMEnergyBased(resampledData, targetSampleRate);
    }
  } catch (error) {
    console.error('BPM detection error:', error);
    throw error;
  }
}
