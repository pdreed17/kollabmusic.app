/**
 * Native DAW History System
 *
 * Comprehensive undo/redo system for the native DAW.
 * Tracks all user actions and provides reliable undo/redo functionality
 * with state management and operation batching.
 */

import React, { createContext, useContext, useReducer, useCallback, useRef, useEffect } from 'react'
import { Alert } from 'react-native'
import { AudioTrack, AudioEffect } from './NativeAudioEngine'
import { ProjectData } from './NativeExportImport'

// =================== TYPES ===================

export type DAWActionType =
  | 'TRACK_ADD'
  | 'TRACK_REMOVE'
  | 'TRACK_MOVE'
  | 'TRACK_RESIZE'
  | 'TRACK_VOLUME_CHANGE'
  | 'TRACK_MUTE_TOGGLE'
  | 'TRACK_SOLO_TOGGLE'
  | 'TRACK_EFFECT_ADD'
  | 'TRACK_EFFECT_REMOVE'
  | 'TRACK_EFFECT_UPDATE'
  | 'MASTER_VOLUME_CHANGE'
  | 'BPM_CHANGE'
  | 'PROJECT_LOAD'
  | 'BATCH_OPERATION'

export interface DAWAction {
  id: string
  type: DAWActionType
  timestamp: number
  description: string
  data: any
  undoData: any
}

export interface DAWHistoryState {
  history: DAWAction[]
  currentIndex: number
  maxHistorySize: number
  isUndoing: boolean
  isRedoing: boolean
  batchId?: string
}

export interface DAWState {
  tracks: AudioTrack[]
  masterVolume: number
  bpm: number
  projectData?: ProjectData
}

interface DAWHistoryContextType {
  state: DAWHistoryState
  dawState: DAWState
  canUndo: boolean
  canRedo: boolean
  undo: () => Promise<boolean>
  redo: () => Promise<boolean>
  recordAction: (action: Omit<DAWAction, 'id' | 'timestamp'>) => void
  startBatch: (description: string) => string
  endBatch: () => void
  clearHistory: () => void
  setDAWState: (state: Partial<DAWState>) => void
}

// =================== CONSTANTS ===================

const MAX_HISTORY_SIZE = 100
const BATCH_TIMEOUT = 500 // ms

// =================== ACTION CREATORS ===================

export const createTrackAction = {
  add: (track: AudioTrack): Omit<DAWAction, 'id' | 'timestamp'> => ({
    type: 'TRACK_ADD',
    description: `Add track "${track.name}"`,
    data: { track },
    undoData: { trackId: track.id },
  }),

  remove: (track: AudioTrack): Omit<DAWAction, 'id' | 'timestamp'> => ({
    type: 'TRACK_REMOVE',
    description: `Remove track "${track.name}"`,
    data: { trackId: track.id },
    undoData: { track },
  }),

  move: (
    trackId: string,
    oldPosition: number,
    newPosition: number
  ): Omit<DAWAction, 'id' | 'timestamp'> => ({
    type: 'TRACK_MOVE',
    description: `Move track`,
    data: { trackId, newPosition },
    undoData: { trackId, oldPosition },
  }),

  resize: (
    trackId: string,
    oldStartTime: number,
    oldDuration: number,
    newStartTime: number,
    newDuration: number
  ): Omit<DAWAction, 'id' | 'timestamp'> => ({
    type: 'TRACK_RESIZE',
    description: `Resize track`,
    data: { trackId, newStartTime, newDuration },
    undoData: { trackId, oldStartTime, oldDuration },
  }),

  volumeChange: (
    trackId: string,
    oldVolume: number,
    newVolume: number
  ): Omit<DAWAction, 'id' | 'timestamp'> => ({
    type: 'TRACK_VOLUME_CHANGE',
    description: `Change track volume`,
    data: { trackId, newVolume },
    undoData: { trackId, oldVolume },
  }),

  muteToggle: (
    trackId: string,
    newMuted: boolean
  ): Omit<DAWAction, 'id' | 'timestamp'> => ({
    type: 'TRACK_MUTE_TOGGLE',
    description: `${newMuted ? 'Mute' : 'Unmute'} track`,
    data: { trackId, newMuted },
    undoData: { trackId, oldMuted: !newMuted },
  }),

  soloToggle: (
    trackId: string,
    newSolo: boolean
  ): Omit<DAWAction, 'id' | 'timestamp'> => ({
    type: 'TRACK_SOLO_TOGGLE',
    description: `${newSolo ? 'Solo' : 'Unsolo'} track`,
    data: { trackId, newSolo },
    undoData: { trackId, oldSolo: !newSolo },
  }),

  effectAdd: (
    trackId: string,
    effect: AudioEffect
  ): Omit<DAWAction, 'id' | 'timestamp'> => ({
    type: 'TRACK_EFFECT_ADD',
    description: `Add ${effect.type} effect`,
    data: { trackId, effect },
    undoData: { trackId, effectId: effect.id },
  }),

  effectRemove: (
    trackId: string,
    effect: AudioEffect
  ): Omit<DAWAction, 'id' | 'timestamp'> => ({
    type: 'TRACK_EFFECT_REMOVE',
    description: `Remove ${effect.type} effect`,
    data: { trackId, effectId: effect.id },
    undoData: { trackId, effect },
  }),

  effectUpdate: (
    trackId: string,
    effectId: string,
    oldParameters: Record<string, number>,
    newParameters: Record<string, number>
  ): Omit<DAWAction, 'id' | 'timestamp'> => ({
    type: 'TRACK_EFFECT_UPDATE',
    description: `Update effect parameters`,
    data: { trackId, effectId, newParameters },
    undoData: { trackId, effectId, oldParameters },
  }),
}

export const createProjectAction = {
  masterVolumeChange: (
    oldVolume: number,
    newVolume: number
  ): Omit<DAWAction, 'id' | 'timestamp'> => ({
    type: 'MASTER_VOLUME_CHANGE',
    description: `Change master volume`,
    data: { newVolume },
    undoData: { oldVolume },
  }),

  bpmChange: (
    oldBpm: number,
    newBpm: number
  ): Omit<DAWAction, 'id' | 'timestamp'> => ({
    type: 'BPM_CHANGE',
    description: `Change BPM from ${oldBpm} to ${newBpm}`,
    data: { newBpm },
    undoData: { oldBpm },
  }),

  load: (
    oldProject: ProjectData | undefined,
    newProject: ProjectData
  ): Omit<DAWAction, 'id' | 'timestamp'> => ({
    type: 'PROJECT_LOAD',
    description: `Load project "${newProject.name}"`,
    data: { newProject },
    undoData: { oldProject },
  }),
}

// =================== REDUCER ===================

type HistoryAction =
  | { type: 'ADD_ACTION'; action: DAWAction }
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'CLEAR_HISTORY' }
  | { type: 'START_BATCH'; batchId: string }
  | { type: 'END_BATCH' }
  | { type: 'SET_PROCESSING'; isUndoing?: boolean; isRedoing?: boolean }

function historyReducer(state: DAWHistoryState, action: HistoryAction): DAWHistoryState {
  switch (action.type) {
    case 'ADD_ACTION': {
      const { action: dawAction } = action

      // If we're in the middle of history (currentIndex < history.length - 1),
      // truncate the history after the current index
      const newHistory = state.currentIndex < state.history.length - 1
        ? state.history.slice(0, state.currentIndex + 1)
        : state.history

      // Add the new action
      newHistory.push(dawAction)

      // Ensure we don't exceed max history size
      if (newHistory.length > state.maxHistorySize) {
        newHistory.shift()
      }

      return {
        ...state,
        history: newHistory,
        currentIndex: newHistory.length - 1,
      }
    }

    case 'UNDO': {
      if (state.currentIndex >= 0) {
        return {
          ...state,
          currentIndex: state.currentIndex - 1,
        }
      }
      return state
    }

    case 'REDO': {
      if (state.currentIndex < state.history.length - 1) {
        return {
          ...state,
          currentIndex: state.currentIndex + 1,
        }
      }
      return state
    }

    case 'CLEAR_HISTORY': {
      return {
        ...state,
        history: [],
        currentIndex: -1,
      }
    }

    case 'START_BATCH': {
      return {
        ...state,
        batchId: action.batchId,
      }
    }

    case 'END_BATCH': {
      return {
        ...state,
        batchId: undefined,
      }
    }

    case 'SET_PROCESSING': {
      return {
        ...state,
        isUndoing: action.isUndoing ?? state.isUndoing,
        isRedoing: action.isRedoing ?? state.isRedoing,
      }
    }

    default:
      return state
  }
}

// =================== DAW STATE REDUCER ===================

type DAWStateAction =
  | { type: 'SET_STATE'; state: Partial<DAWState> }
  | { type: 'APPLY_ACTION'; action: DAWAction; isUndo: boolean }

function dawStateReducer(state: DAWState, action: DAWStateAction): DAWState {
  switch (action.type) {
    case 'SET_STATE':
      return { ...state, ...action.state }

    case 'APPLY_ACTION': {
      const { action: dawAction, isUndo } = action
      const data = isUndo ? dawAction.undoData : dawAction.data

      switch (dawAction.type) {
        case 'TRACK_ADD': {
          if (isUndo) {
            return {
              ...state,
              tracks: state.tracks.filter(track => track.id !== data.trackId),
            }
          } else {
            return {
              ...state,
              tracks: [...state.tracks, data.track],
            }
          }
        }

        case 'TRACK_REMOVE': {
          if (isUndo) {
            return {
              ...state,
              tracks: [...state.tracks, data.track],
            }
          } else {
            return {
              ...state,
              tracks: state.tracks.filter(track => track.id !== data.trackId),
            }
          }
        }

        case 'TRACK_MOVE': {
          const trackIndex = state.tracks.findIndex(track => track.id === data.trackId)
          if (trackIndex === -1) return state

          const newTracks = [...state.tracks]
          const track = newTracks[trackIndex]
          const position = isUndo ? data.oldPosition : data.newPosition

          track.startTime = position
          return { ...state, tracks: newTracks }
        }

        case 'TRACK_RESIZE': {
          const trackIndex = state.tracks.findIndex(track => track.id === data.trackId)
          if (trackIndex === -1) return state

          const newTracks = [...state.tracks]
          const track = newTracks[trackIndex]

          if (isUndo) {
            track.startTime = data.oldStartTime
            track.duration = data.oldDuration
          } else {
            track.startTime = data.newStartTime
            track.duration = data.newDuration
          }

          return { ...state, tracks: newTracks }
        }

        case 'TRACK_VOLUME_CHANGE': {
          const trackIndex = state.tracks.findIndex(track => track.id === data.trackId)
          if (trackIndex === -1) return state

          const newTracks = [...state.tracks]
          newTracks[trackIndex] = {
            ...newTracks[trackIndex],
            volume: isUndo ? data.oldVolume : data.newVolume,
          }

          return { ...state, tracks: newTracks }
        }

        case 'TRACK_MUTE_TOGGLE': {
          const trackIndex = state.tracks.findIndex(track => track.id === data.trackId)
          if (trackIndex === -1) return state

          const newTracks = [...state.tracks]
          newTracks[trackIndex] = {
            ...newTracks[trackIndex],
            muted: isUndo ? data.oldMuted : data.newMuted,
          }

          return { ...state, tracks: newTracks }
        }

        case 'TRACK_SOLO_TOGGLE': {
          const trackIndex = state.tracks.findIndex(track => track.id === data.trackId)
          if (trackIndex === -1) return state

          const newTracks = [...state.tracks]
          newTracks[trackIndex] = {
            ...newTracks[trackIndex],
            solo: isUndo ? data.oldSolo : data.newSolo,
          }

          return { ...state, tracks: newTracks }
        }

        case 'TRACK_EFFECT_ADD': {
          if (isUndo) {
            const trackIndex = state.tracks.findIndex(track => track.id === data.trackId)
            if (trackIndex === -1) return state

            const newTracks = [...state.tracks]
            newTracks[trackIndex] = {
              ...newTracks[trackIndex],
              effects: newTracks[trackIndex].effects.filter(effect => effect.id !== data.effectId),
            }

            return { ...state, tracks: newTracks }
          } else {
            const trackIndex = state.tracks.findIndex(track => track.id === data.trackId)
            if (trackIndex === -1) return state

            const newTracks = [...state.tracks]
            newTracks[trackIndex] = {
              ...newTracks[trackIndex],
              effects: [...newTracks[trackIndex].effects, data.effect],
            }

            return { ...state, tracks: newTracks }
          }
        }

        case 'TRACK_EFFECT_REMOVE': {
          if (isUndo) {
            const trackIndex = state.tracks.findIndex(track => track.id === data.trackId)
            if (trackIndex === -1) return state

            const newTracks = [...state.tracks]
            newTracks[trackIndex] = {
              ...newTracks[trackIndex],
              effects: [...newTracks[trackIndex].effects, data.effect],
            }

            return { ...state, tracks: newTracks }
          } else {
            const trackIndex = state.tracks.findIndex(track => track.id === data.trackId)
            if (trackIndex === -1) return state

            const newTracks = [...state.tracks]
            newTracks[trackIndex] = {
              ...newTracks[trackIndex],
              effects: newTracks[trackIndex].effects.filter(effect => effect.id !== data.effectId),
            }

            return { ...state, tracks: newTracks }
          }
        }

        case 'TRACK_EFFECT_UPDATE': {
          const trackIndex = state.tracks.findIndex(track => track.id === data.trackId)
          if (trackIndex === -1) return state

          const effectIndex = state.tracks[trackIndex].effects.findIndex(effect => effect.id === data.effectId)
          if (effectIndex === -1) return state

          const newTracks = [...state.tracks]
          const newEffects = [...newTracks[trackIndex].effects]
          newEffects[effectIndex] = {
            ...newEffects[effectIndex],
            parameters: isUndo ? data.oldParameters : data.newParameters,
          }

          newTracks[trackIndex] = {
            ...newTracks[trackIndex],
            effects: newEffects,
          }

          return { ...state, tracks: newTracks }
        }

        case 'MASTER_VOLUME_CHANGE': {
          return {
            ...state,
            masterVolume: isUndo ? data.oldVolume : data.newVolume,
          }
        }

        case 'BPM_CHANGE': {
          return {
            ...state,
            bpm: isUndo ? data.oldBpm : data.newBpm,
          }
        }

        case 'PROJECT_LOAD': {
          const project = isUndo ? data.oldProject : data.newProject
          if (!project) return state

          return {
            ...state,
            tracks: project.tracks,
            masterVolume: project.masterVolume,
            bpm: project.bpm,
            projectData: project,
          }
        }

        default:
          return state
      }
    }

    default:
      return state
  }
}

// =================== CONTEXT ===================

const DAWHistoryContext = createContext<DAWHistoryContextType | null>(null)

export function useDAWHistory() {
  const context = useContext(DAWHistoryContext)
  if (!context) {
    throw new Error('useDAWHistory must be used within a DAWHistoryProvider')
  }
  return context
}

// =================== PROVIDER ===================

interface DAWHistoryProviderProps {
  children: React.ReactNode
  initialState?: Partial<DAWState>
  maxHistorySize?: number
  onStateChange?: (state: DAWState) => void
}

export function DAWHistoryProvider({
  children,
  initialState,
  maxHistorySize = MAX_HISTORY_SIZE,
  onStateChange,
}: DAWHistoryProviderProps) {
  const [historyState, dispatchHistory] = useReducer(historyReducer, {
    history: [],
    currentIndex: -1,
    maxHistorySize,
    isUndoing: false,
    isRedoing: false,
  })

  const [dawState, dispatchDAWState] = useReducer(dawStateReducer, {
    tracks: [],
    masterVolume: 1,
    bpm: 120,
    ...initialState,
  })

  const batchTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const batchActionsRef = useRef<DAWAction[]>([])

  // Notify parent of state changes
  useEffect(() => {
    onStateChange?.(dawState)
  }, [dawState, onStateChange])

  const recordAction = useCallback((actionData: Omit<DAWAction, 'id' | 'timestamp'>) => {
    if (historyState.isUndoing || historyState.isRedoing) {
      // Don't record actions while undoing/redoing
      return
    }

    const action: DAWAction = {
      ...actionData,
      id: `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
    }

    if (historyState.batchId) {
      // We're in a batch operation
      batchActionsRef.current.push(action)

      // Reset batch timeout
      if (batchTimeoutRef.current) {
        clearTimeout(batchTimeoutRef.current)
      }

      batchTimeoutRef.current = setTimeout(() => {
        endBatch()
      }, BATCH_TIMEOUT)
    } else {
      // Record individual action
      dispatchHistory({ type: 'ADD_ACTION', action })
      dispatchDAWState({ type: 'APPLY_ACTION', action, isUndo: false })
    }
  }, [historyState.isUndoing, historyState.isRedoing, historyState.batchId])

  const startBatch = useCallback((description: string): string => {
    const batchId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    dispatchHistory({ type: 'START_BATCH', batchId })
    batchActionsRef.current = []
    return batchId
  }, [])

  const endBatch = useCallback(() => {
    if (batchActionsRef.current.length > 0) {
      const batchAction: DAWAction = {
        id: `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: 'BATCH_OPERATION',
        timestamp: Date.now(),
        description: `Batch operation (${batchActionsRef.current.length} actions)`,
        data: { actions: batchActionsRef.current },
        undoData: { actions: batchActionsRef.current },
      }

      dispatchHistory({ type: 'ADD_ACTION', action: batchAction })

      // Apply all batched actions
      batchActionsRef.current.forEach(action => {
        dispatchDAWState({ type: 'APPLY_ACTION', action, isUndo: false })
      })
    }

    dispatchHistory({ type: 'END_BATCH' })
    batchActionsRef.current = []

    if (batchTimeoutRef.current) {
      clearTimeout(batchTimeoutRef.current)
      batchTimeoutRef.current = null
    }
  }, [])

  const undo = useCallback(async (): Promise<boolean> => {
    if (historyState.currentIndex < 0) {
      return false
    }

    try {
      dispatchHistory({ type: 'SET_PROCESSING', isUndoing: true })

      const actionToUndo = historyState.history[historyState.currentIndex]

      if (actionToUndo.type === 'BATCH_OPERATION') {
        // Undo batch operations in reverse order
        const actions = actionToUndo.undoData.actions as DAWAction[]
        for (let i = actions.length - 1; i >= 0; i--) {
          dispatchDAWState({ type: 'APPLY_ACTION', action: actions[i], isUndo: true })
        }
      } else {
        dispatchDAWState({ type: 'APPLY_ACTION', action: actionToUndo, isUndo: true })
      }

      dispatchHistory({ type: 'UNDO' })
      return true
    } catch (error) {
      console.error('Undo failed:', error)
      Alert.alert('Undo Failed', 'Unable to undo the last action.')
      return false
    } finally {
      dispatchHistory({ type: 'SET_PROCESSING', isUndoing: false })
    }
  }, [historyState.currentIndex, historyState.history])

  const redo = useCallback(async (): Promise<boolean> => {
    if (historyState.currentIndex >= historyState.history.length - 1) {
      return false
    }

    try {
      dispatchHistory({ type: 'SET_PROCESSING', isRedoing: true })

      const actionToRedo = historyState.history[historyState.currentIndex + 1]

      if (actionToRedo.type === 'BATCH_OPERATION') {
        // Redo batch operations in original order
        const actions = actionToRedo.data.actions as DAWAction[]
        for (const action of actions) {
          dispatchDAWState({ type: 'APPLY_ACTION', action, isUndo: false })
        }
      } else {
        dispatchDAWState({ type: 'APPLY_ACTION', action: actionToRedo, isUndo: false })
      }

      dispatchHistory({ type: 'REDO' })
      return true
    } catch (error) {
      console.error('Redo failed:', error)
      Alert.alert('Redo Failed', 'Unable to redo the action.')
      return false
    } finally {
      dispatchHistory({ type: 'SET_PROCESSING', isRedoing: false })
    }
  }, [historyState.currentIndex, historyState.history])

  const clearHistory = useCallback(() => {
    dispatchHistory({ type: 'CLEAR_HISTORY' })
  }, [])

  const setDAWState = useCallback((state: Partial<DAWState>) => {
    dispatchDAWState({ type: 'SET_STATE', state })
  }, [])

  const canUndo = historyState.currentIndex >= 0 && !historyState.isUndoing && !historyState.isRedoing
  const canRedo = historyState.currentIndex < historyState.history.length - 1 && !historyState.isUndoing && !historyState.isRedoing

  // Cleanup batch timeout on unmount
  useEffect(() => {
    return () => {
      if (batchTimeoutRef.current) {
        clearTimeout(batchTimeoutRef.current)
      }
    }
  }, [])

  const value: DAWHistoryContextType = {
    state: historyState,
    dawState,
    canUndo,
    canRedo,
    undo,
    redo,
    recordAction,
    startBatch,
    endBatch,
    clearHistory,
    setDAWState,
  }

  return (
    <DAWHistoryContext.Provider value={value}>
      {children}
    </DAWHistoryContext.Provider>
  )
}

// =================== HOOKS FOR COMMON OPERATIONS ===================

export function useDAWActions() {
  const { recordAction, startBatch, endBatch, dawState } = useDAWHistory()

  return {
    // Track operations
    addTrack: useCallback((track: AudioTrack) => {
      recordAction(createTrackAction.add(track))
    }, [recordAction]),

    removeTrack: useCallback((track: AudioTrack) => {
      recordAction(createTrackAction.remove(track))
    }, [recordAction]),

    moveTrack: useCallback((trackId: string, oldPosition: number, newPosition: number) => {
      recordAction(createTrackAction.move(trackId, oldPosition, newPosition))
    }, [recordAction]),

    resizeTrack: useCallback((
      trackId: string,
      oldStartTime: number,
      oldDuration: number,
      newStartTime: number,
      newDuration: number
    ) => {
      recordAction(createTrackAction.resize(trackId, oldStartTime, oldDuration, newStartTime, newDuration))
    }, [recordAction]),

    changeTrackVolume: useCallback((trackId: string, oldVolume: number, newVolume: number) => {
      recordAction(createTrackAction.volumeChange(trackId, oldVolume, newVolume))
    }, [recordAction]),

    toggleTrackMute: useCallback((trackId: string, newMuted: boolean) => {
      recordAction(createTrackAction.muteToggle(trackId, newMuted))
    }, [recordAction]),

    toggleTrackSolo: useCallback((trackId: string, newSolo: boolean) => {
      recordAction(createTrackAction.soloToggle(trackId, newSolo))
    }, [recordAction]),

    addTrackEffect: useCallback((trackId: string, effect: AudioEffect) => {
      recordAction(createTrackAction.effectAdd(trackId, effect))
    }, [recordAction]),

    removeTrackEffect: useCallback((trackId: string, effect: AudioEffect) => {
      recordAction(createTrackAction.effectRemove(trackId, effect))
    }, [recordAction]),

    updateTrackEffect: useCallback((
      trackId: string,
      effectId: string,
      oldParameters: Record<string, number>,
      newParameters: Record<string, number>
    ) => {
      recordAction(createTrackAction.effectUpdate(trackId, effectId, oldParameters, newParameters))
    }, [recordAction]),

    // Project operations
    changeMasterVolume: useCallback((oldVolume: number, newVolume: number) => {
      recordAction(createProjectAction.masterVolumeChange(oldVolume, newVolume))
    }, [recordAction]),

    changeBPM: useCallback((oldBpm: number, newBpm: number) => {
      recordAction(createProjectAction.bpmChange(oldBpm, newBpm))
    }, [recordAction]),

    loadProject: useCallback((oldProject: ProjectData | undefined, newProject: ProjectData) => {
      recordAction(createProjectAction.load(oldProject, newProject))
    }, [recordAction]),

    // Batch operations
    startBatchOperation: useCallback((description: string) => {
      return startBatch(description)
    }, [startBatch]),

    endBatchOperation: useCallback(() => {
      endBatch()
    }, [endBatch]),

    // Current state
    dawState,
  }
}

export default DAWHistoryProvider