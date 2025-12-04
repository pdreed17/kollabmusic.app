// BPM-based time calculation utilities for DAW timeline

export type TimeSignature = {
  beatsPerBar: number
  beatUnit: number
}

export const DEFAULT_BPM = 120
export const DEFAULT_TIME_SIGNATURE: TimeSignature = {
  beatsPerBar: 4,
  beatUnit: 4,
}

/**
 * Convert milliseconds to beats based on BPM
 */
export function msToBeats(ms: number, bpm: number): number {
  const millisecondsPerBeat = 60000 / bpm
  return ms / millisecondsPerBeat
}

/**
 * Convert beats to milliseconds based on BPM
 */
export function beatsToMs(beats: number, bpm: number): number {
  const millisecondsPerBeat = 60000 / bpm
  return beats * millisecondsPerBeat
}

/**
 * Convert milliseconds to bars based on BPM and time signature
 */
export function msToBars(
  ms: number,
  bpm: number,
  timeSignature: TimeSignature = DEFAULT_TIME_SIGNATURE
): number {
  const beats = msToBeats(ms, bpm)
  return beats / timeSignature.beatsPerBar
}

/**
 * Convert bars to milliseconds based on BPM and time signature
 */
export function barsToMs(
  bars: number,
  bpm: number,
  timeSignature: TimeSignature = DEFAULT_TIME_SIGNATURE
): number {
  const beats = bars * timeSignature.beatsPerBar
  return beatsToMs(beats, bpm)
}

/**
 * Snap a time position to the nearest beat
 */
export function snapToGrid(
  ms: number,
  bpm: number,
  gridResolution: 'bar' | 'beat' | 'eighth' | 'sixteenth' = 'beat',
  timeSignature: TimeSignature = DEFAULT_TIME_SIGNATURE
): number {
  const millisecondsPerBeat = 60000 / bpm
  let snapInterval: number

  switch (gridResolution) {
    case 'bar':
      snapInterval = millisecondsPerBeat * timeSignature.beatsPerBar
      break
    case 'beat':
      snapInterval = millisecondsPerBeat
      break
    case 'eighth':
      snapInterval = millisecondsPerBeat / 2
      break
    case 'sixteenth':
      snapInterval = millisecondsPerBeat / 4
      break
    default:
      snapInterval = millisecondsPerBeat
  }

  return Math.round(ms / snapInterval) * snapInterval
}

/**
 * Get the duration of one beat in milliseconds
 */
export function getBeatDuration(bpm: number): number {
  return 60000 / bpm
}

/**
 * Get the duration of one bar in milliseconds
 */
export function getBarDuration(
  bpm: number,
  timeSignature: TimeSignature = DEFAULT_TIME_SIGNATURE
): number {
  return getBeatDuration(bpm) * timeSignature.beatsPerBar
}

/**
 * Format beats as bars:beats notation (e.g., "2:3" for bar 2, beat 3)
 */
export function formatBeatsAsBars(
  totalBeats: number,
  timeSignature: TimeSignature = DEFAULT_TIME_SIGNATURE
): string {
  const bars = Math.floor(totalBeats / timeSignature.beatsPerBar)
  const beats = Math.floor(totalBeats % timeSignature.beatsPerBar)
  return `${bars + 1}:${beats + 1}`
}

/**
 * Calculate pixels per beat based on zoom level
 */
export function getPixelsPerBeat(zoomLevel: number, basePixelsPerBeat: number = 60): number {
  return basePixelsPerBeat * zoomLevel
}

/**
 * Convert beats to pixels
 */
export function beatsToPixels(beats: number, pixelsPerBeat: number): number {
  return beats * pixelsPerBeat
}

/**
 * Convert pixels to beats
 */
export function pixelsToBeats(pixels: number, pixelsPerBeat: number): number {
  return pixels / pixelsPerBeat
}
