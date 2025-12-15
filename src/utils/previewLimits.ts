/**
 * Preview Limits Utility
 *
 * Tracks and enforces preview limits for free users:
 * - 1 highlight preview per profile per 24 hours (30 seconds)
 * - 1 audio track preview per public project per 24 hours (30 seconds)
 *
 * Uses AsyncStorage for persistence with 24-hour reset
 */

import AsyncStorage from '@react-native-async-storage/async-storage'

const PREVIEW_STORAGE_KEY = 'kollab_preview_limits'
const PREVIEW_DURATION_MS = 30000 // 30 seconds
const RESET_PERIOD_MS = 24 * 60 * 60 * 1000 // 24 hours

interface PreviewRecord {
  itemId: string // highlight ID or audio file ID
  timestamp: number // when the preview was used
}

interface PreviewData {
  highlights: { [profileUserId: string]: PreviewRecord }
  projects: { [projectId: string]: PreviewRecord }
}

/**
 * Get the current preview data from storage
 */
async function getPreviewData(): Promise<PreviewData> {
  try {
    const data = await AsyncStorage.getItem(PREVIEW_STORAGE_KEY)
    if (data) {
      return JSON.parse(data)
    }
  } catch (error) {
    console.error('Error reading preview data:', error)
  }
  return { highlights: {}, projects: {} }
}

/**
 * Save preview data to storage
 */
async function savePreviewData(data: PreviewData): Promise<void> {
  try {
    await AsyncStorage.setItem(PREVIEW_STORAGE_KEY, JSON.stringify(data))
  } catch (error) {
    console.error('Error saving preview data:', error)
  }
}

/**
 * Clean up expired previews (older than 24 hours)
 */
function cleanExpiredPreviews(data: PreviewData): PreviewData {
  const now = Date.now()

  const cleanedHighlights: { [key: string]: PreviewRecord } = {}
  for (const [key, record] of Object.entries(data.highlights)) {
    if (now - record.timestamp < RESET_PERIOD_MS) {
      cleanedHighlights[key] = record
    }
  }

  const cleanedProjects: { [key: string]: PreviewRecord } = {}
  for (const [key, record] of Object.entries(data.projects)) {
    if (now - record.timestamp < RESET_PERIOD_MS) {
      cleanedProjects[key] = record
    }
  }

  return {
    highlights: cleanedHighlights,
    projects: cleanedProjects,
  }
}

/**
 * Check if user can preview a highlight from a specific profile
 * Returns: { canPreview, previewedHighlightId, timeUntilReset }
 */
export async function canPreviewHighlight(
  profileUserId: string
): Promise<{
  canPreview: boolean
  previewedHighlightId: string | null
  timeUntilReset: number | null
}> {
  const data = await getPreviewData()
  const cleaned = cleanExpiredPreviews(data)

  // Save cleaned data back
  if (JSON.stringify(data) !== JSON.stringify(cleaned)) {
    await savePreviewData(cleaned)
  }

  const record = cleaned.highlights[profileUserId]

  if (!record) {
    return { canPreview: true, previewedHighlightId: null, timeUntilReset: null }
  }

  const timeElapsed = Date.now() - record.timestamp
  if (timeElapsed >= RESET_PERIOD_MS) {
    return { canPreview: true, previewedHighlightId: null, timeUntilReset: null }
  }

  return {
    canPreview: false,
    previewedHighlightId: record.itemId,
    timeUntilReset: RESET_PERIOD_MS - timeElapsed,
  }
}

/**
 * Record that user has previewed a highlight from a profile
 */
export async function recordHighlightPreview(
  profileUserId: string,
  highlightId: string
): Promise<void> {
  const data = await getPreviewData()
  const cleaned = cleanExpiredPreviews(data)

  cleaned.highlights[profileUserId] = {
    itemId: highlightId,
    timestamp: Date.now(),
  }

  await savePreviewData(cleaned)
}

/**
 * Check if user can preview audio from a specific public project
 * Returns: { canPreview, previewedTrackId, timeUntilReset }
 */
export async function canPreviewProjectAudio(
  projectId: string
): Promise<{
  canPreview: boolean
  previewedTrackId: string | null
  timeUntilReset: number | null
}> {
  const data = await getPreviewData()
  const cleaned = cleanExpiredPreviews(data)

  // Save cleaned data back
  if (JSON.stringify(data) !== JSON.stringify(cleaned)) {
    await savePreviewData(cleaned)
  }

  const record = cleaned.projects[projectId]

  if (!record) {
    return { canPreview: true, previewedTrackId: null, timeUntilReset: null }
  }

  const timeElapsed = Date.now() - record.timestamp
  if (timeElapsed >= RESET_PERIOD_MS) {
    return { canPreview: true, previewedTrackId: null, timeUntilReset: null }
  }

  return {
    canPreview: false,
    previewedTrackId: record.itemId,
    timeUntilReset: RESET_PERIOD_MS - timeElapsed,
  }
}

/**
 * Record that user has previewed audio from a public project
 */
export async function recordProjectAudioPreview(
  projectId: string,
  audioFileId: string
): Promise<void> {
  const data = await getPreviewData()
  const cleaned = cleanExpiredPreviews(data)

  cleaned.projects[projectId] = {
    itemId: audioFileId,
    timestamp: Date.now(),
  }

  await savePreviewData(cleaned)
}

/**
 * Check if a specific highlight can be played
 * (either it's the one they already previewed, or they haven't previewed any yet)
 */
export async function canPlayHighlight(
  profileUserId: string,
  highlightId: string
): Promise<{
  canPlay: boolean
  isPreviewOnly: boolean
  timeUntilReset: number | null
}> {
  const result = await canPreviewHighlight(profileUserId)

  if (result.canPreview) {
    // They can preview any highlight (haven't used their preview yet)
    return { canPlay: true, isPreviewOnly: true, timeUntilReset: null }
  }

  if (result.previewedHighlightId === highlightId) {
    // This is the highlight they already previewed - let them replay it
    return { canPlay: true, isPreviewOnly: true, timeUntilReset: result.timeUntilReset }
  }

  // They've already previewed a different highlight
  return { canPlay: false, isPreviewOnly: true, timeUntilReset: result.timeUntilReset }
}

/**
 * Check if a specific audio track can be played
 */
export async function canPlayProjectAudio(
  projectId: string,
  audioFileId: string
): Promise<{
  canPlay: boolean
  isPreviewOnly: boolean
  timeUntilReset: number | null
}> {
  const result = await canPreviewProjectAudio(projectId)

  if (result.canPreview) {
    return { canPlay: true, isPreviewOnly: true, timeUntilReset: null }
  }

  if (result.previewedTrackId === audioFileId) {
    return { canPlay: true, isPreviewOnly: true, timeUntilReset: result.timeUntilReset }
  }

  return { canPlay: false, isPreviewOnly: true, timeUntilReset: result.timeUntilReset }
}

/**
 * Format time until reset for display
 */
export function formatTimeUntilReset(ms: number): string {
  const hours = Math.floor(ms / (1000 * 60 * 60))
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60))

  if (hours > 0) {
    return `${hours}h ${minutes}m`
  }
  return `${minutes}m`
}

/**
 * Get preview duration in milliseconds (30 seconds)
 */
export function getPreviewDurationMs(): number {
  return PREVIEW_DURATION_MS
}

/**
 * Clear all preview data (for testing or when user upgrades to Pro)
 */
export async function clearAllPreviews(): Promise<void> {
  try {
    await AsyncStorage.removeItem(PREVIEW_STORAGE_KEY)
  } catch (error) {
    console.error('Error clearing preview data:', error)
  }
}
