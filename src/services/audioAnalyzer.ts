/**
 * AudioAnalyzer.ts
 *
 * Complete audio feature extraction system for music similarity analysis.
 * Extracts: BPM, Key, MFCCs, Chroma, Spectral features, Energy
 * Works offline, on-device using Meyda + custom DSP algorithms.
 */

import Meyda, { MeydaFeaturesObject } from 'meyda';

// ============================================================================
// TYPES
// ============================================================================

export interface AudioFeatures {
  bpm: number;
  key: string;
  mfcc: number[]; // 13 coefficients, averaged over time
  chroma: number[]; // 12 pitch classes
  spectralCentroid: number;
  energy: number; // RMS
  waveformPeaks: number[]; // For visualization (100 sample points)
}

export interface AudioEmbedding {
  features: AudioFeatures;
  embedding: number[]; // Compressed 64-dimensional vector
  duration: number; // seconds
  sampleRate: number;
  createdAt: string;
}

export interface AnalysisProgress {
  stage: 'loading' | 'extracting' | 'embedding' | 'complete';
  progress: number; // 0-100
  message: string;
}

// ============================================================================
// AUDIO BUFFER LOADING
// ============================================================================

/**
 * Load audio file and convert to AudioBuffer
 * Supports .wav, .m4a, .mp3
 */
export async function loadAudioBuffer(
  fileUri: string,
  onProgress?: (progress: AnalysisProgress) => void
): Promise<{ buffer: AudioBuffer; audioContext: AudioContext }> {
  try {
    onProgress?.({
      stage: 'loading',
      progress: 10,
      message: 'Loading audio file...',
    });

    // Fetch audio file
    const response = await fetch(fileUri);
    const arrayBuffer = await response.arrayBuffer();

    onProgress?.({
      stage: 'loading',
      progress: 50,
      message: 'Decoding audio...',
    });

    // Create AudioContext (Web Audio API)
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

    // Decode audio data
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    onProgress?.({
      stage: 'loading',
      progress: 100,
      message: 'Audio loaded successfully',
    });

    return { buffer: audioBuffer, audioContext };
  } catch (error) {
    console.error('Error loading audio buffer:', error);
    throw new Error('Failed to load audio file. Ensure it is a valid audio format (.wav, .m4a, .mp3).');
  }
}

/**
 * Convert AudioBuffer to Float32Array (mono signal)
 */
function audioBufferToSignal(buffer: AudioBuffer): Float32Array {
  // If stereo, mix down to mono
  if (buffer.numberOfChannels > 1) {
    const left = buffer.getChannelData(0);
    const right = buffer.getChannelData(1);
    const mono = new Float32Array(left.length);

    for (let i = 0; i < left.length; i++) {
      mono[i] = (left[i] + right[i]) / 2;
    }

    return mono;
  }

  return buffer.getChannelData(0);
}

// ============================================================================
// BPM DETECTION
// ============================================================================

/**
 * Detect BPM using autocorrelation-based tempo detection
 * Range: 60-180 BPM (typical music range)
 */
function detectBPM(signal: Float32Array, sampleRate: number): number {
  try {
    // Downsample for faster processing (to 11025 Hz)
    const downsampleFactor = Math.floor(sampleRate / 11025);
    const downsampled = downsample(signal, downsampleFactor);
    const newSampleRate = sampleRate / downsampleFactor;

    // Compute onset detection function (energy envelope)
    const hopSize = 512;
    const frameSize = 2048;
    const energyEnvelope = computeEnergyEnvelope(downsampled, frameSize, hopSize);

    // Autocorrelation to find periodicity
    const minBPM = 60;
    const maxBPM = 180;
    const minLag = Math.floor((60 / maxBPM) * newSampleRate / hopSize);
    const maxLag = Math.floor((60 / minBPM) * newSampleRate / hopSize);

    let maxCorrelation = 0;
    let bestLag = minLag;

    for (let lag = minLag; lag <= maxLag; lag++) {
      let correlation = 0;
      for (let i = 0; i < energyEnvelope.length - lag; i++) {
        correlation += energyEnvelope[i] * energyEnvelope[i + lag];
      }

      if (correlation > maxCorrelation) {
        maxCorrelation = correlation;
        bestLag = lag;
      }
    }

    // Convert lag to BPM
    const bpm = Math.round((60 * newSampleRate) / (bestLag * hopSize));

    // Validate BPM is in reasonable range
    return Math.max(60, Math.min(180, bpm));
  } catch (error) {
    console.error('BPM detection error:', error);
    return 120; // Default fallback
  }
}

function downsample(signal: Float32Array, factor: number): Float32Array {
  const length = Math.floor(signal.length / factor);
  const downsampled = new Float32Array(length);

  for (let i = 0; i < length; i++) {
    downsampled[i] = signal[i * factor];
  }

  return downsampled;
}

function computeEnergyEnvelope(signal: Float32Array, frameSize: number, hopSize: number): Float32Array {
  const numFrames = Math.floor((signal.length - frameSize) / hopSize);
  const envelope = new Float32Array(numFrames);

  for (let i = 0; i < numFrames; i++) {
    const start = i * hopSize;
    let energy = 0;

    for (let j = 0; j < frameSize; j++) {
      const sample = signal[start + j] || 0;
      energy += sample * sample;
    }

    envelope[i] = Math.sqrt(energy / frameSize);
  }

  return envelope;
}

// ============================================================================
// KEY DETECTION
// ============================================================================

/**
 * Detect musical key using chroma features and key profiles (Krumhansl-Schmuckler)
 */
function detectKey(chroma: number[]): string {
  // Major and minor key profiles (Krumhansl-Schmuckler)
  const majorProfile = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
  const minorProfile = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

  const keys = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

  let maxCorrelation = -Infinity;
  let detectedKey = 'C';

  // Test all 24 keys (12 major + 12 minor)
  for (let i = 0; i < 12; i++) {
    // Rotate chroma to test this root note
    const rotatedChroma = [...chroma.slice(i), ...chroma.slice(0, i)];

    // Test major
    const majorCorr = correlation(rotatedChroma, majorProfile);
    if (majorCorr > maxCorrelation) {
      maxCorrelation = majorCorr;
      detectedKey = keys[i];
    }

    // Test minor
    const minorCorr = correlation(rotatedChroma, minorProfile);
    if (minorCorr > maxCorrelation) {
      maxCorrelation = minorCorr;
      detectedKey = keys[i] + 'm';
    }
  }

  return detectedKey;
}

function correlation(a: number[], b: number[]): number {
  const meanA = a.reduce((sum, val) => sum + val, 0) / a.length;
  const meanB = b.reduce((sum, val) => sum + val, 0) / b.length;

  let numerator = 0;
  let denomA = 0;
  let denomB = 0;

  for (let i = 0; i < a.length; i++) {
    const diffA = a[i] - meanA;
    const diffB = b[i] - meanB;
    numerator += diffA * diffB;
    denomA += diffA * diffA;
    denomB += diffB * diffB;
  }

  return numerator / Math.sqrt(denomA * denomB);
}

// ============================================================================
// MFCC & CHROMA EXTRACTION (using Meyda)
// ============================================================================

/**
 * Extract audio features using Meyda frame-by-frame
 */
function extractMeydaFeatures(
  signal: Float32Array,
  sampleRate: number,
  onProgress?: (progress: number) => void
): { mfcc: number[][]; chroma: number[][]; spectralCentroid: number[]; rms: number[] } {
  const bufferSize = 2048;
  const hopSize = 512;
  const numFrames = Math.floor((signal.length - bufferSize) / hopSize);

  const mfccFrames: number[][] = [];
  const chromaFrames: number[][] = [];
  const spectralCentroids: number[] = [];
  const rmsValues: number[] = [];

  // Configure Meyda
  Meyda.sampleRate = sampleRate;
  Meyda.bufferSize = bufferSize;

  for (let i = 0; i < numFrames; i++) {
    const start = i * hopSize;
    const frame = signal.slice(start, start + bufferSize);

    // Extract features for this frame
    const features = Meyda.extract(['mfcc', 'chroma', 'spectralCentroid', 'rms'], frame) as MeydaFeaturesObject;

    if (features.mfcc) mfccFrames.push(features.mfcc as number[]);
    if (features.chroma) chromaFrames.push(features.chroma as number[]);
    if (features.spectralCentroid) spectralCentroids.push(features.spectralCentroid as number);
    if (features.rms) rmsValues.push(features.rms as number);

    // Progress callback every 10%
    if (i % Math.floor(numFrames / 10) === 0) {
      onProgress?.((i / numFrames) * 100);
    }
  }

  return {
    mfcc: mfccFrames,
    chroma: chromaFrames,
    spectralCentroid: spectralCentroids,
    rms: rmsValues,
  };
}

/**
 * Average MFCC coefficients over all frames
 */
function averageMFCC(mfccFrames: number[][]): number[] {
  if (mfccFrames.length === 0) return new Array(13).fill(0);

  const numCoefficients = mfccFrames[0].length;
  const averaged = new Array(numCoefficients).fill(0);

  for (const frame of mfccFrames) {
    for (let i = 0; i < numCoefficients; i++) {
      averaged[i] += frame[i];
    }
  }

  return averaged.map(val => val / mfccFrames.length);
}

/**
 * Average chroma features over all frames
 */
function averageChroma(chromaFrames: number[][]): number[] {
  if (chromaFrames.length === 0) return new Array(12).fill(0);

  const averaged = new Array(12).fill(0);

  for (const frame of chromaFrames) {
    for (let i = 0; i < 12; i++) {
      averaged[i] += frame[i];
    }
  }

  return averaged.map(val => val / chromaFrames.length);
}

// ============================================================================
// WAVEFORM PEAKS (for visualization)
// ============================================================================

/**
 * Extract 100 peak samples for waveform visualization
 */
function extractWaveformPeaks(signal: Float32Array, numPeaks: number = 100): number[] {
  const segmentSize = Math.floor(signal.length / numPeaks);
  const peaks: number[] = [];

  for (let i = 0; i < numPeaks; i++) {
    const start = i * segmentSize;
    const end = Math.min(start + segmentSize, signal.length);

    let maxAbsValue = 0;
    for (let j = start; j < end; j++) {
      maxAbsValue = Math.max(maxAbsValue, Math.abs(signal[j]));
    }

    peaks.push(maxAbsValue);
  }

  return peaks;
}

// ============================================================================
// EMBEDDING COMPRESSION (PCA-style dimensionality reduction)
// ============================================================================

/**
 * Compress MFCC (13) + Chroma (12) + other features into 64-dimensional embedding
 * Uses simple weighted averaging and normalization
 */
function createEmbedding(features: AudioFeatures): number[] {
  const embedding: number[] = [];

  // Part 1: MFCC coefficients (first 13 dimensions)
  embedding.push(...features.mfcc.slice(0, 13));

  // Part 2: Chroma features (next 12 dimensions)
  embedding.push(...features.chroma);

  // Part 3: Normalized scalar features (5 dimensions)
  embedding.push(
    features.bpm / 180, // Normalize to 0-1
    features.spectralCentroid / 8000, // Normalize to 0-1
    features.energy, // Already 0-1
    keyToNumber(features.key) / 23, // Normalize 24 keys to 0-1
    features.waveformPeaks.reduce((sum, val) => sum + val, 0) / features.waveformPeaks.length // Avg peak
  );

  // Part 4: Statistical features from waveform (10 dimensions)
  const peakStats = computeStatistics(features.waveformPeaks);
  embedding.push(...peakStats);

  // Part 5: MFCC variance (13 dimensions) - represents timbre variation
  // For MVP, use MFCC values again (in production, calculate variance over frames)
  embedding.push(...features.mfcc.map(val => Math.abs(val) / 100));

  // Part 6: Chroma variance (11 dimensions to reach 64 total)
  embedding.push(...features.chroma.slice(0, 11).map(val => Math.abs(val)));

  // Normalize entire embedding to unit vector (L2 normalization)
  return normalizeVector(embedding.slice(0, 64));
}

function keyToNumber(key: string): number {
  const keys = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const root = key.replace('m', '');
  const isMajor = !key.includes('m');

  const rootIndex = keys.indexOf(root);
  return isMajor ? rootIndex : rootIndex + 12;
}

function computeStatistics(values: number[]): number[] {
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);
  const min = Math.min(...values);
  const max = Math.max(...values);

  // Sort for median and quartiles
  const sorted = [...values].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const q1 = sorted[Math.floor(sorted.length / 4)];
  const q3 = sorted[Math.floor((3 * sorted.length) / 4)];

  return [mean, variance, stdDev, min, max, median, q1, q3, max - min, q3 - q1];
}

function normalizeVector(vec: number[]): number[] {
  const magnitude = Math.sqrt(vec.reduce((sum, val) => sum + val * val, 0));
  return magnitude === 0 ? vec : vec.map(val => val / magnitude);
}

// ============================================================================
// MAIN ANALYSIS FUNCTION
// ============================================================================

/**
 * Complete audio analysis pipeline
 * Extracts all features and creates compressed embedding
 */
export async function analyzeAudio(
  fileUri: string,
  onProgress?: (progress: AnalysisProgress) => void
): Promise<AudioEmbedding> {
  try {
    // Step 1: Load audio buffer
    const { buffer, audioContext } = await loadAudioBuffer(fileUri, onProgress);
    const signal = audioBufferToSignal(buffer);
    const sampleRate = buffer.sampleRate;

    onProgress?.({
      stage: 'extracting',
      progress: 10,
      message: 'Extracting audio features...',
    });

    // Step 2: Extract features with Meyda
    const { mfcc, chroma, spectralCentroid, rms } = extractMeydaFeatures(
      signal,
      sampleRate,
      (frameProgress) => {
        onProgress?.({
          stage: 'extracting',
          progress: 10 + (frameProgress * 0.5), // 10-60%
          message: 'Analyzing frequency content...',
        });
      }
    );

    onProgress?.({
      stage: 'extracting',
      progress: 65,
      message: 'Detecting tempo...',
    });

    // Step 3: Detect BPM
    const bpm = detectBPM(signal, sampleRate);

    onProgress?.({
      stage: 'extracting',
      progress: 75,
      message: 'Detecting musical key...',
    });

    // Step 4: Average features
    const avgMFCC = averageMFCC(mfcc);
    const avgChroma = averageChroma(chroma);
    const avgSpectralCentroid = spectralCentroid.reduce((sum, val) => sum + val, 0) / spectralCentroid.length;
    const avgEnergy = rms.reduce((sum, val) => sum + val, 0) / rms.length;

    // Step 5: Detect key
    const key = detectKey(avgChroma);

    onProgress?.({
      stage: 'extracting',
      progress: 85,
      message: 'Extracting waveform...',
    });

    // Step 6: Extract waveform peaks
    const waveformPeaks = extractWaveformPeaks(signal);

    // Step 7: Create features object
    const features: AudioFeatures = {
      bpm,
      key,
      mfcc: avgMFCC,
      chroma: avgChroma,
      spectralCentroid: avgSpectralCentroid,
      energy: avgEnergy,
      waveformPeaks,
    };

    onProgress?.({
      stage: 'embedding',
      progress: 90,
      message: 'Creating embedding vector...',
    });

    // Step 8: Create compressed embedding
    const embedding = createEmbedding(features);

    onProgress?.({
      stage: 'complete',
      progress: 100,
      message: 'Analysis complete!',
    });

    // Cleanup
    audioContext.close();

    return {
      features,
      embedding,
      duration: buffer.duration,
      sampleRate: buffer.sampleRate,
      createdAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error('Audio analysis error:', error);
    throw error;
  }
}

/**
 * Fallback analyzer for devices that can't run full DSP
 * Extracts only basic features
 */
export async function analyzeAudioBasic(
  fileUri: string,
  onProgress?: (progress: AnalysisProgress) => void
): Promise<AudioEmbedding> {
  try {
    onProgress?.({
      stage: 'loading',
      progress: 20,
      message: 'Loading audio (basic mode)...',
    });

    const { buffer, audioContext } = await loadAudioBuffer(fileUri);
    const signal = audioBufferToSignal(buffer);

    onProgress?.({
      stage: 'extracting',
      progress: 60,
      message: 'Extracting basic features...',
    });

    // Extract only BPM and energy (lightweight)
    const bpm = detectBPM(signal, buffer.sampleRate);
    const waveformPeaks = extractWaveformPeaks(signal);
    const energy = waveformPeaks.reduce((sum, val) => sum + val, 0) / waveformPeaks.length;

    // Create minimal features
    const features: AudioFeatures = {
      bpm,
      key: 'C', // Default
      mfcc: new Array(13).fill(0),
      chroma: new Array(12).fill(0),
      spectralCentroid: 2000, // Default
      energy,
      waveformPeaks,
    };

    onProgress?.({
      stage: 'complete',
      progress: 100,
      message: 'Basic analysis complete',
    });

    audioContext.close();

    return {
      features,
      embedding: createEmbedding(features),
      duration: buffer.duration,
      sampleRate: buffer.sampleRate,
      createdAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error('Basic audio analysis error:', error);
    throw error;
  }
}
