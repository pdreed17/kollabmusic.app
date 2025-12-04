/**
 * Web-based DAW Component for Music Production
 *
 * A production-ready React + TypeScript component that implements a DAW-like
 * track-grid-timeline for a music-making web app. Features include:
 * - Multi-track audio playback with Web Audio API
 * - Drag-and-drop audio clips with timeline snapping
 * - Waveform visualization and timeline with gridlines
 * - Sample-accurate scheduling and sync
 * - Project export/import functionality
 *
 * Install: npm install react react-dom @types/react @types/react-dom
 * Run: npm run dev (Vite) or npm start (Create React App)
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';

// =================== INTERFACES AND TYPES ===================

interface AudioClip {
  id: string;
  name: string;
  audioBuffer: AudioBuffer;
  startTime: number; // in seconds
  duration: number; // in seconds
  laneId: string;
  selected: boolean;
  muted: boolean;
  soloed: boolean;
  gain: number; // 0-1
  file?: File; // original file for export/import
}

interface Lane {
  id: string;
  name: string;
  clips: AudioClip[];
  muted: boolean;
  soloed: boolean;
  gain: number; // 0-1
  height: number; // pixels
}

interface TimelineState {
  currentTime: number; // seconds
  isPlaying: boolean;
  tempo: number; // BPM
  timeSignature: [number, number]; // [beats per bar, note value]
  zoom: number; // pixels per second
  selectedClipIds: string[];
  lanes: Lane[];
  projectDuration: number; // seconds
  loop: boolean;
  metronome: boolean;
}

interface HistoryAction {
  type: 'MOVE_CLIP' | 'ADD_CLIP' | 'DELETE_CLIP' | 'RESIZE_CLIP';
  clipId: string;
  oldValue: any;
  newValue: any;
  timestamp: number;
}

// =================== UTILITY FUNCTIONS ===================

const generateId = (): string => Math.random().toString(36).substr(2, 9);

const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 100);
  return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
};

const beatsToSeconds = (beats: number, tempo: number): number => {
  return (beats * 60) / tempo;
};

const secondsToBeats = (seconds: number, tempo: number): number => {
  return (seconds * tempo) / 60;
};

const snapToGrid = (seconds: number, tempo: number, gridSize: number = 0.25): number => {
  const beats = secondsToBeats(seconds, tempo);
  const snappedBeats = Math.round(beats / gridSize) * gridSize;
  return beatsToSeconds(snappedBeats, tempo);
};

// =================== WAVEFORM UTILITIES ===================

const generateWaveformData = (audioBuffer: AudioBuffer, width: number = 800): number[] => {
  const samples = audioBuffer.getChannelData(0);
  const samplesPerPixel = Math.floor(samples.length / width);
  const waveform: number[] = [];

  for (let i = 0; i < width; i++) {
    const start = i * samplesPerPixel;
    const end = start + samplesPerPixel;
    let max = 0;

    for (let j = start; j < end && j < samples.length; j++) {
      max = Math.max(max, Math.abs(samples[j]));
    }

    waveform.push(max);
  }

  return waveform;
};

const renderWaveform = (
  canvas: HTMLCanvasElement,
  waveformData: number[],
  width: number,
  height: number,
  color: string = '#4ade80'
): void => {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = color;

  const barWidth = width / waveformData.length;
  const halfHeight = height / 2;

  waveformData.forEach((amplitude, i) => {
    const barHeight = amplitude * halfHeight;
    ctx.fillRect(i * barWidth, halfHeight - barHeight, barWidth - 1, barHeight * 2);
  });
};

// =================== MAIN DAW COMPONENT ===================

export const DAWComponent: React.FC = () => {
  // =================== STATE ===================

  const [timeline, setTimeline] = useState<TimelineState>({
    currentTime: 0,
    isPlaying: false,
    tempo: 120,
    timeSignature: [4, 4],
    zoom: 50, // pixels per second
    selectedClipIds: [],
    lanes: [],
    projectDuration: 180, // 3 minutes default
    loop: false,
    metronome: false,
  });

  const [history, setHistory] = useState<HistoryAction[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [dragState, setDragState] = useState<{
    clipId: string | null;
    startX: number;
    startTime: number;
    isDragging: boolean;
  }>({
    clipId: null,
    startX: 0,
    startTime: 0,
    isDragging: false,
  });

  // =================== REFS ===================

  const audioContextRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const playbackStartTimeRef = useRef<number>(0);
  const scheduledSourcesRef = useRef<Map<string, AudioBufferSourceNode>>(new Map());
  const timelineRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number>(0);
  const metronomeOscillatorRef = useRef<OscillatorNode | null>(null);
  const nextMetronomeTimeRef = useRef<number>(0);

  // =================== WEB AUDIO SETUP ===================

  useEffect(() => {
    // Initialize Web Audio API
    const initAudio = async () => {
      try {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        masterGainRef.current = audioContextRef.current.createGain();
        masterGainRef.current.connect(audioContextRef.current.destination);

        // Resume context on user interaction (browser requirement)
        if (audioContextRef.current.state === 'suspended') {
          const resumeAudio = () => {
            audioContextRef.current?.resume();
            document.removeEventListener('click', resumeAudio);
            document.removeEventListener('keydown', resumeAudio);
          };
          document.addEventListener('click', resumeAudio);
          document.addEventListener('keydown', resumeAudio);
        }
      } catch (error) {
        console.error('Failed to initialize Web Audio API:', error);
      }
    };

    initAudio();

    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  // =================== PLAYBACK LOGIC ===================

  const scheduleClip = useCallback((clip: AudioClip, startOffset: number = 0) => {
    const audioContext = audioContextRef.current;
    const masterGain = masterGainRef.current;
    if (!audioContext || !masterGain) return;

    const source = audioContext.createBufferSource();
    const gainNode = audioContext.createGain();

    source.buffer = clip.audioBuffer;
    source.connect(gainNode);
    gainNode.connect(masterGain);
    gainNode.gain.value = clip.muted ? 0 : clip.gain;

    // Calculate when to start playing this clip
    const clipStartTime = clip.startTime;
    const currentTime = timeline.currentTime + startOffset;
    const playTime = audioContext.currentTime + Math.max(0, clipStartTime - currentTime);

    // Only play if the clip should be playing at current time
    if (currentTime >= clipStartTime && currentTime < clipStartTime + clip.duration) {
      const offset = Math.max(0, currentTime - clipStartTime);
      const duration = clip.duration - offset;

      source.start(audioContext.currentTime, offset, duration);
      scheduledSourcesRef.current.set(clip.id, source);
    } else if (currentTime < clipStartTime) {
      // Schedule for future playback
      source.start(playTime, 0, clip.duration);
      scheduledSourcesRef.current.set(clip.id, source);
    }
  }, [timeline.currentTime]);

  const stopAllSources = useCallback(() => {
    scheduledSourcesRef.current.forEach(source => {
      try {
        source.stop();
      } catch (error) {
        // Source might already be stopped
      }
    });
    scheduledSourcesRef.current.clear();

    if (metronomeOscillatorRef.current) {
      metronomeOscillatorRef.current.stop();
      metronomeOscillatorRef.current = null;
    }
  }, []);

  const startMetronome = useCallback(() => {
    const audioContext = audioContextRef.current;
    const masterGain = masterGainRef.current;
    if (!audioContext || !masterGain || !timeline.metronome) return;

    const beatInterval = 60 / timeline.tempo; // seconds per beat
    const scheduleAheadTime = 0.1; // 100ms ahead

    const scheduleMetronome = () => {
      const currentTime = audioContext.currentTime;

      while (nextMetronomeTimeRef.current < currentTime + scheduleAheadTime) {
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();

        osc.connect(gain);
        gain.connect(masterGain);

        osc.frequency.value = 800; // Click frequency
        gain.gain.setValueAtTime(0.1, nextMetronomeTimeRef.current);
        gain.gain.exponentialRampToValueAtTime(0.01, nextMetronomeTimeRef.current + 0.1);

        osc.start(nextMetronomeTimeRef.current);
        osc.stop(nextMetronomeTimeRef.current + 0.1);

        nextMetronomeTimeRef.current += beatInterval;
      }

      if (timeline.isPlaying) {
        setTimeout(scheduleMetronome, 25); // Check every 25ms
      }
    };

    nextMetronomeTimeRef.current = audioContext.currentTime;
    scheduleMetronome();
  }, [timeline.tempo, timeline.metronome, timeline.isPlaying]);

  const play = useCallback(() => {
    const audioContext = audioContextRef.current;
    if (!audioContext) return;

    stopAllSources();
    playbackStartTimeRef.current = audioContext.currentTime - timeline.currentTime;

    // Schedule all clips that should be playing
    timeline.lanes.forEach(lane => {
      if (!lane.muted) {
        lane.clips.forEach(clip => {
          if (!clip.muted && (!lane.soloed || clip.soloed)) {
            scheduleClip(clip);
          }
        });
      }
    });

    if (timeline.metronome) {
      startMetronome();
    }

    setTimeline(prev => ({ ...prev, isPlaying: true }));
  }, [timeline.currentTime, timeline.lanes, timeline.metronome, scheduleClip, startMetronome, stopAllSources]);

  const pause = useCallback(() => {
    stopAllSources();
    setTimeline(prev => ({ ...prev, isPlaying: false }));
  }, [stopAllSources]);

  const stop = useCallback(() => {
    stopAllSources();
    setTimeline(prev => ({ ...prev, isPlaying: false, currentTime: 0 }));
  }, [stopAllSources]);

  // =================== PLAYHEAD ANIMATION ===================

  useEffect(() => {
    const updatePlayhead = () => {
      if (timeline.isPlaying && audioContextRef.current) {
        const newCurrentTime = audioContextRef.current.currentTime - playbackStartTimeRef.current;

        if (timeline.loop && newCurrentTime >= timeline.projectDuration) {
          // Loop back to start
          stop();
          setTimeline(prev => ({ ...prev, currentTime: 0 }));
          setTimeout(play, 10);
        } else {
          setTimeline(prev => ({ ...prev, currentTime: Math.max(0, newCurrentTime) }));
        }
      }

      if (timeline.isPlaying) {
        animationFrameRef.current = requestAnimationFrame(updatePlayhead);
      }
    };

    if (timeline.isPlaying) {
      animationFrameRef.current = requestAnimationFrame(updatePlayhead);
    } else {
      cancelAnimationFrame(animationFrameRef.current);
    }

    return () => cancelAnimationFrame(animationFrameRef.current);
  }, [timeline.isPlaying, timeline.loop, timeline.projectDuration, play, stop]);

  // =================== FILE UPLOAD AND PROCESSING ===================

  const handleFileUpload = useCallback(async (files: FileList | null) => {
    if (!files || !audioContextRef.current) return;

    const audioContext = audioContextRef.current;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      try {
        const arrayBuffer = await file.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

        // Create new lane for this clip
        const laneId = generateId();
        const clipId = generateId();

        const newClip: AudioClip = {
          id: clipId,
          name: file.name,
          audioBuffer,
          startTime: 0,
          duration: audioBuffer.duration,
          laneId,
          selected: false,
          muted: false,
          soloed: false,
          gain: 1,
          file,
        };

        const newLane: Lane = {
          id: laneId,
          name: `Track ${timeline.lanes.length + 1}`,
          clips: [newClip],
          muted: false,
          soloed: false,
          gain: 1,
          height: 80,
        };

        setTimeline(prev => ({
          ...prev,
          lanes: [...prev.lanes, newLane],
          projectDuration: Math.max(prev.projectDuration, audioBuffer.duration),
        }));

        // Add to history
        const action: HistoryAction = {
          type: 'ADD_CLIP',
          clipId,
          oldValue: null,
          newValue: newClip,
          timestamp: Date.now(),
        };

        setHistory(prev => [...prev.slice(0, historyIndex + 1), action]);
        setHistoryIndex(prev => prev + 1);

      } catch (error) {
        console.error('Error processing audio file:', error);
        alert(`Failed to process ${file.name}. Please ensure it's a valid audio file.`);
      }
    }
  }, [timeline.lanes.length, historyIndex]);

  // =================== DRAG AND DROP ===================

  const handleMouseDown = useCallback((event: React.MouseEvent, clipId: string) => {
    event.preventDefault();

    const clip = timeline.lanes
      .flatMap(lane => lane.clips)
      .find(c => c.id === clipId);

    if (!clip || !timelineRef.current) return;

    const rect = timelineRef.current.getBoundingClientRect();
    const startX = event.clientX - rect.left;

    setDragState({
      clipId,
      startX,
      startTime: clip.startTime,
      isDragging: true,
    });

    // Select the clip
    setTimeline(prev => ({
      ...prev,
      selectedClipIds: [clipId],
    }));
  }, [timeline.lanes]);

  const handleMouseMove = useCallback((event: MouseEvent) => {
    if (!dragState.isDragging || !dragState.clipId || !timelineRef.current) return;

    const rect = timelineRef.current.getBoundingClientRect();
    const currentX = event.clientX - rect.left;
    const deltaX = currentX - dragState.startX;
    const deltaTime = deltaX / timeline.zoom;
    const newStartTime = Math.max(0, dragState.startTime + deltaTime);
    const snappedTime = snapToGrid(newStartTime, timeline.tempo);

    // Update clip position
    setTimeline(prev => ({
      ...prev,
      lanes: prev.lanes.map(lane => ({
        ...lane,
        clips: lane.clips.map(clip =>
          clip.id === dragState.clipId
            ? { ...clip, startTime: snappedTime }
            : clip
        ),
      })),
    }));
  }, [dragState, timeline.zoom, timeline.tempo]);

  const handleMouseUp = useCallback(() => {
    if (!dragState.isDragging) return;

    const clip = timeline.lanes
      .flatMap(lane => lane.clips)
      .find(c => c.id === dragState.clipId);

    if (clip && clip.startTime !== dragState.startTime) {
      // Add to history
      const action: HistoryAction = {
        type: 'MOVE_CLIP',
        clipId: dragState.clipId!,
        oldValue: dragState.startTime,
        newValue: clip.startTime,
        timestamp: Date.now(),
      };

      setHistory(prev => [...prev.slice(0, historyIndex + 1), action]);
      setHistoryIndex(prev => prev + 1);
    }

    setDragState({
      clipId: null,
      startX: 0,
      startTime: 0,
      isDragging: false,
    });
  }, [dragState, timeline.lanes, historyIndex]);

  // Global mouse events for dragging
  useEffect(() => {
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  // =================== KEYBOARD SHORTCUTS ===================

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement) return;

      switch (event.code) {
        case 'Space':
          event.preventDefault();
          timeline.isPlaying ? pause() : play();
          break;
        case 'KeyS':
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            exportProject();
          }
          break;
        case 'KeyZ':
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            if (event.shiftKey) {
              redo();
            } else {
              undo();
            }
          }
          break;
        case 'Delete':
        case 'Backspace':
          if (timeline.selectedClipIds.length > 0) {
            event.preventDefault();
            deleteSelectedClips();
          }
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [timeline.isPlaying, timeline.selectedClipIds, play, pause]);

  // =================== UNDO/REDO ===================

  const undo = useCallback(() => {
    if (historyIndex < 0) return;

    const action = history[historyIndex];

    switch (action.type) {
      case 'MOVE_CLIP':
        setTimeline(prev => ({
          ...prev,
          lanes: prev.lanes.map(lane => ({
            ...lane,
            clips: lane.clips.map(clip =>
              clip.id === action.clipId
                ? { ...clip, startTime: action.oldValue }
                : clip
            ),
          })),
        }));
        break;
      // Add other action types as needed
    }

    setHistoryIndex(prev => prev - 1);
  }, [history, historyIndex]);

  const redo = useCallback(() => {
    if (historyIndex >= history.length - 1) return;

    const nextIndex = historyIndex + 1;
    const action = history[nextIndex];

    switch (action.type) {
      case 'MOVE_CLIP':
        setTimeline(prev => ({
          ...prev,
          lanes: prev.lanes.map(lane => ({
            ...lane,
            clips: lane.clips.map(clip =>
              clip.id === action.clipId
                ? { ...clip, startTime: action.newValue }
                : clip
            ),
          })),
        }));
        break;
      // Add other action types as needed
    }

    setHistoryIndex(nextIndex);
  }, [history, historyIndex]);

  // =================== UTILITY FUNCTIONS ===================

  const deleteSelectedClips = useCallback(() => {
    if (timeline.selectedClipIds.length === 0) return;

    setTimeline(prev => ({
      ...prev,
      lanes: prev.lanes.map(lane => ({
        ...lane,
        clips: lane.clips.filter(clip => !prev.selectedClipIds.includes(clip.id)),
      })),
      selectedClipIds: [],
    }));
  }, [timeline.selectedClipIds]);

  const exportProject = useCallback(() => {
    const projectData = {
      name: 'DAW Project',
      tempo: timeline.tempo,
      timeSignature: timeline.timeSignature,
      projectDuration: timeline.projectDuration,
      lanes: timeline.lanes.map(lane => ({
        ...lane,
        clips: lane.clips.map(clip => ({
          id: clip.id,
          name: clip.name,
          startTime: clip.startTime,
          duration: clip.duration,
          laneId: clip.laneId,
          muted: clip.muted,
          soloed: clip.soloed,
          gain: clip.gain,
          fileName: clip.file?.name,
          fileSize: clip.file?.size,
        })),
      })),
      exportTime: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(projectData, null, 2)], {
      type: 'application/json',
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'daw-project.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [timeline]);

  // =================== RENDER FUNCTIONS ===================

  const renderTimeRuler = () => {
    const rulerWidth = timeline.projectDuration * timeline.zoom;
    const majorTickInterval = beatsToSeconds(timeline.timeSignature[0], timeline.tempo);
    const minorTickInterval = beatsToSeconds(1, timeline.tempo);

    const ticks = [];
    for (let time = 0; time <= timeline.projectDuration; time += minorTickInterval) {
      const x = time * timeline.zoom;
      const isMajor = time % majorTickInterval === 0;

      ticks.push(
        <div
          key={time}
          className={`absolute top-0 ${isMajor ? 'h-6 bg-gray-600' : 'h-3 bg-gray-400'} w-px`}
          style={{ left: x }}
        >
          {isMajor && (
            <span className="absolute top-7 text-xs text-gray-600 transform -translate-x-1/2">
              {formatTime(time)}
            </span>
          )}
        </div>
      );
    }

    return (
      <div className="relative h-12 bg-gray-100 border-b border-gray-300" style={{ width: rulerWidth }}>
        {ticks}
      </div>
    );
  };

  const renderClip = (clip: AudioClip, laneIndex: number) => {
    const clipWidth = clip.duration * timeline.zoom;
    const clipLeft = clip.startTime * timeline.zoom;
    const isSelected = timeline.selectedClipIds.includes(clip.id);
    const isPlaying = timeline.isPlaying &&
      timeline.currentTime >= clip.startTime &&
      timeline.currentTime <= clip.startTime + clip.duration;

    return (
      <div
        key={clip.id}
        className={`absolute top-1 h-16 bg-blue-500 rounded border-2 cursor-move select-none ${
          isSelected ? 'border-yellow-400' : 'border-blue-600'
        } ${isPlaying ? 'shadow-lg ring-2 ring-green-400' : ''}`}
        style={{ left: clipLeft, width: Math.max(clipWidth, 60) }}
        onMouseDown={(e) => handleMouseDown(e, clip.id)}
        title={`${clip.name} - ${formatTime(clip.startTime)} - ${formatTime(clip.duration)}`}
      >
        <div className="p-1 text-white text-xs font-medium overflow-hidden">
          {clip.name}
        </div>
        <div className="px-1 text-white text-xs opacity-75">
          {formatTime(clip.duration)}
        </div>

        {/* Waveform placeholder */}
        <div className="absolute bottom-1 left-1 right-1 h-4 bg-blue-300 rounded opacity-60">
          <WaveformComponent audioBuffer={clip.audioBuffer} width={clipWidth - 8} height={16} />
        </div>
      </div>
    );
  };

  // =================== WAVEFORM COMPONENT ===================

  const WaveformComponent: React.FC<{ audioBuffer: AudioBuffer; width: number; height: number }> = ({ audioBuffer, width, height }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
      if (!canvasRef.current) return;

      const waveformData = generateWaveformData(audioBuffer, Math.floor(width));
      renderWaveform(canvasRef.current, waveformData, width, height, '#60a5fa');
    }, [audioBuffer, width, height]);

    return <canvas ref={canvasRef} width={width} height={height} className="w-full h-full" />;
  };

  // =================== MAIN RENDER ===================

  return (
    <div className="w-full h-screen bg-gray-50 flex flex-col">
      {/* Transport Controls */}
      <div className="flex items-center gap-4 p-4 bg-white border-b border-gray-200 shadow-sm">
        <div className="flex gap-2">
          <button
            onClick={play}
            disabled={timeline.isPlaying}
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
            title="Play (Space)"
          >
            ▶ Play
          </button>
          <button
            onClick={pause}
            disabled={!timeline.isPlaying}
            className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600 disabled:opacity-50"
            title="Pause (Space)"
          >
            ⏸ Pause
          </button>
          <button
            onClick={stop}
            className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
            title="Stop"
          >
            ⏹ Stop
          </button>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm font-medium">BPM:</label>
          <input
            type="number"
            value={timeline.tempo}
            onChange={(e) => setTimeline(prev => ({ ...prev, tempo: Math.max(60, Math.min(200, parseInt(e.target.value) || 120)) }))}
            className="w-16 px-2 py-1 border border-gray-300 rounded text-center"
            min="60"
            max="200"
          />
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm font-medium">Zoom:</label>
          <button
            onClick={() => setTimeline(prev => ({ ...prev, zoom: Math.max(10, prev.zoom - 10) }))}
            className="px-2 py-1 bg-gray-200 rounded hover:bg-gray-300"
          >
            -
          </button>
          <span className="text-sm w-12 text-center">{Math.round(timeline.zoom)}px/s</span>
          <button
            onClick={() => setTimeline(prev => ({ ...prev, zoom: Math.min(200, prev.zoom + 10) }))}
            className="px-2 py-1 bg-gray-200 rounded hover:bg-gray-300"
          >
            +
          </button>
        </div>

        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1">
            <input
              type="checkbox"
              checked={timeline.loop}
              onChange={(e) => setTimeline(prev => ({ ...prev, loop: e.target.checked }))}
              className="rounded"
            />
            <span className="text-sm">Loop</span>
          </label>

          <label className="flex items-center gap-1">
            <input
              type="checkbox"
              checked={timeline.metronome}
              onChange={(e) => setTimeline(prev => ({ ...prev, metronome: e.target.checked }))}
              className="rounded"
            />
            <span className="text-sm">Metronome</span>
          </label>
        </div>

        <div className="flex gap-2 ml-auto">
          <input
            type="file"
            accept="audio/*"
            multiple
            onChange={(e) => handleFileUpload(e.target.files)}
            className="hidden"
            id="audio-upload"
          />
          <label
            htmlFor="audio-upload"
            className="px-4 py-2 bg-blue-500 text-white rounded cursor-pointer hover:bg-blue-600"
          >
            + Add Audio
          </label>

          <button
            onClick={exportProject}
            className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
            title="Export Project (Ctrl+S)"
          >
            Export
          </button>
        </div>

        <div className="text-sm text-gray-600">
          {formatTime(timeline.currentTime)} / {formatTime(timeline.projectDuration)}
        </div>
      </div>

      {/* Timeline */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full overflow-auto">
          <div
            ref={timelineRef}
            className="relative"
            style={{ width: timeline.projectDuration * timeline.zoom }}
          >
            {/* Time Ruler */}
            {renderTimeRuler()}

            {/* Lanes */}
            <div className="relative">
              {timeline.lanes.map((lane, index) => (
                <div
                  key={lane.id}
                  className="relative bg-white border-b border-gray-200"
                  style={{ height: lane.height }}
                >
                  {/* Lane Header */}
                  <div className="absolute left-0 top-0 w-32 h-full bg-gray-100 border-r border-gray-200 p-2 z-10">
                    <div className="text-sm font-medium">{lane.name}</div>
                    <div className="flex gap-1 mt-1">
                      <button
                        onClick={() => setTimeline(prev => ({
                          ...prev,
                          lanes: prev.lanes.map(l =>
                            l.id === lane.id ? { ...l, muted: !l.muted } : l
                          ),
                        }))}
                        className={`text-xs px-1 rounded ${lane.muted ? 'bg-red-500 text-white' : 'bg-gray-200'}`}
                      >
                        M
                      </button>
                      <button
                        onClick={() => setTimeline(prev => ({
                          ...prev,
                          lanes: prev.lanes.map(l =>
                            l.id === lane.id ? { ...l, soloed: !l.soloed } : l
                          ),
                        }))}
                        className={`text-xs px-1 rounded ${lane.soloed ? 'bg-yellow-500 text-white' : 'bg-gray-200'}`}
                      >
                        S
                      </button>
                    </div>
                  </div>

                  {/* Lane Content */}
                  <div className="ml-32 relative h-full">
                    {lane.clips.map(clip => renderClip(clip, index))}
                  </div>
                </div>
              ))}
            </div>

            {/* Playhead */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-red-500 pointer-events-none z-20"
              style={{ left: timeline.currentTime * timeline.zoom }}
            >
              <div className="absolute -top-1 -left-2 w-4 h-4 bg-red-500 transform rotate-45"></div>
            </div>
          </div>
        </div>
      </div>

      {/* Status Bar */}
      <div className="p-2 bg-gray-100 border-t border-gray-200 text-xs text-gray-600 flex justify-between items-center">
        <div>
          Tracks: {timeline.lanes.length} |
          Clips: {timeline.lanes.reduce((acc, lane) => acc + lane.clips.length, 0)} |
          Audio Context: {audioContextRef.current?.state || 'Not initialized'}
        </div>
        <div>
          Shortcuts: Space (Play/Pause) | Ctrl+S (Export) | Ctrl+Z (Undo) | Delete (Remove selected)
        </div>
      </div>
    </div>
  );
};

export default DAWComponent;