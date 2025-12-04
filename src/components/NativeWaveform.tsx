/**
 * Native Waveform Component
 *
 * A fully native React Native waveform visualization component that renders
 * audio waveforms using only React Native components (no Canvas or WebView).
 * Provides smooth performance and seamless integration with the native DAW.
 */

import React, { useMemo } from 'react'
import { View, StyleSheet, ViewStyle } from 'react-native'
import { Colors } from '../constants/theme'

// =================== TYPES ===================

interface NativeWaveformProps {
  data: number[] // Array of amplitude values (0-1)
  width: number
  height: number
  color?: string
  backgroundColor?: string
  opacity?: number
  style?: ViewStyle
  strokeWidth?: number
  showProgress?: boolean
  progressPosition?: number // 0-1 for playback position
  progressColor?: string
}

// =================== MAIN COMPONENT ===================

export default function NativeWaveform({
  data,
  width,
  height,
  color = Colors.primary,
  backgroundColor = 'transparent',
  opacity = 1,
  style,
  strokeWidth = 2,
  showProgress = false,
  progressPosition = 0,
  progressColor = Colors.success,
}: NativeWaveformProps) {

  // =================== CALCULATIONS ===================

  const waveformBars = useMemo(() => {
    if (!data || data.length === 0) {
      return []
    }

    const barWidth = width / data.length
    const centerY = height / 2

    return data.map((amplitude, index) => {
      const barHeight = Math.max(1, amplitude * centerY) // Minimum 1px height
      const x = index * barWidth

      return {
        x,
        y: centerY - barHeight / 2,
        width: Math.max(1, barWidth - 0.5), // Small gap between bars
        height: barHeight,
        amplitude,
      }
    })
  }, [data, width, height])

  const progressBars = useMemo(() => {
    if (!showProgress || progressPosition <= 0) {
      return []
    }

    const progressIndex = Math.floor(progressPosition * waveformBars.length)
    return waveformBars.slice(0, progressIndex)
  }, [waveformBars, showProgress, progressPosition])

  // =================== RENDER HELPERS ===================

  const renderWaveformBars = (bars: typeof waveformBars, barColor: string, barOpacity: number = opacity) => (
    bars.map((bar, index) => (
      <View
        key={index}
        style={[
          styles.waveformBar,
          {
            left: bar.x,
            top: bar.y,
            width: bar.width,
            height: bar.height,
            backgroundColor: barColor,
            opacity: barOpacity,
          },
        ]}
      />
    ))
  )

  // =================== MAIN RENDER ===================

  return (
    <View
      style={[
        styles.container,
        {
          width,
          height,
          backgroundColor,
          opacity,
        },
        style,
      ]}
    >
      {/* Background waveform */}
      {renderWaveformBars(waveformBars, color, 0.6)}

      {/* Progress waveform (if enabled) */}
      {showProgress && renderWaveformBars(progressBars, progressColor, 1)}

      {/* Playback line indicator */}
      {showProgress && progressPosition > 0 && (
        <View
          style={[
            styles.progressLine,
            {
              left: progressPosition * width - strokeWidth / 2,
              width: strokeWidth,
              height,
              backgroundColor: progressColor,
            },
          ]}
        />
      )}
    </View>
  )
}

// =================== ALTERNATIVE IMPLEMENTATIONS ===================

/**
 * Simplified Waveform for better performance with large datasets
 */
export function SimpleNativeWaveform({
  data,
  width,
  height,
  color = Colors.primary,
  opacity = 1,
  style,
}: Pick<NativeWaveformProps, 'data' | 'width' | 'height' | 'color' | 'opacity' | 'style'>) {

  const simplifiedData = useMemo(() => {
    if (!data || data.length === 0) return []

    // Downsample for performance if too many data points
    const targetPoints = Math.min(data.length, Math.floor(width / 2))
    const step = Math.max(1, Math.floor(data.length / targetPoints))

    return data.filter((_, index) => index % step === 0)
  }, [data, width])

  const waveformPath = useMemo(() => {
    if (!simplifiedData || simplifiedData.length === 0) {
      return []
    }

    const barWidth = width / simplifiedData.length
    const centerY = height / 2

    return simplifiedData.map((amplitude, index) => ({
      x: index * barWidth,
      height: Math.max(2, amplitude * height * 0.8), // 80% of container height
      width: Math.max(1, barWidth - 0.5),
    }))
  }, [simplifiedData, width, height])

  return (
    <View style={[styles.container, { width, height, opacity }, style]}>
      {waveformPath.map((bar, index) => (
        <View
          key={index}
          style={[
            styles.simpleBar,
            {
              left: bar.x,
              top: (height - bar.height) / 2,
              width: bar.width,
              height: bar.height,
              backgroundColor: color,
            },
          ]}
        />
      ))}
    </View>
  )
}

/**
 * Stereo Waveform for dual-channel audio
 */
export function StereoNativeWaveform({
  leftData,
  rightData,
  width,
  height,
  leftColor = Colors.primary,
  rightColor = Colors.secondary,
  opacity = 1,
  style,
}: {
  leftData: number[]
  rightData: number[]
  width: number
  height: number
  leftColor?: string
  rightColor?: string
  opacity?: number
  style?: ViewStyle
}) {

  const channelHeight = height / 2

  return (
    <View style={[styles.container, { width, height, opacity }, style]}>
      {/* Left Channel (Top) */}
      <View style={[styles.channelContainer, { height: channelHeight }]}>
        <NativeWaveform
          data={leftData}
          width={width}
          height={channelHeight}
          color={leftColor}
          opacity={opacity}
        />
      </View>

      {/* Divider Line */}
      <View style={[styles.channelDivider, { width }]} />

      {/* Right Channel (Bottom) */}
      <View style={[styles.channelContainer, { height: channelHeight }]}>
        <NativeWaveform
          data={rightData}
          width={width}
          height={channelHeight}
          color={rightColor}
          opacity={opacity}
        />
      </View>
    </View>
  )
}

// =================== UTILITY FUNCTIONS ===================

/**
 * Generate sample waveform data for testing
 */
export function generateSampleWaveformData(length: number = 100): number[] {
  return Array.from({ length }, (_, i) => {
    // Generate a sine wave with some randomness
    const sine = Math.sin((i / length) * Math.PI * 4) * 0.5 + 0.5
    const noise = (Math.random() - 0.5) * 0.2
    return Math.max(0, Math.min(1, sine + noise))
  })
}

/**
 * Process audio file data into waveform data
 * This would typically be called after loading an audio file
 */
export function processAudioToWaveform(
  audioBuffer: ArrayBuffer,
  targetLength: number = 200
): Promise<number[]> {
  return new Promise((resolve) => {
    try {
      // In a real implementation, you would use Web Audio API or a native audio library
      // For now, we'll generate sample data
      const waveformData = generateSampleWaveformData(targetLength)
      resolve(waveformData)
    } catch (error) {
      console.error('Error processing audio to waveform:', error)
      resolve(generateSampleWaveformData(targetLength))
    }
  })
}

/**
 * Downsample waveform data for performance
 */
export function downsampleWaveform(data: number[], targetLength: number): number[] {
  if (data.length <= targetLength) {
    return data
  }

  const step = data.length / targetLength
  const result: number[] = []

  for (let i = 0; i < targetLength; i++) {
    const startIdx = Math.floor(i * step)
    const endIdx = Math.floor((i + 1) * step)

    // Take the maximum amplitude in this range for better visual representation
    let max = 0
    for (let j = startIdx; j < endIdx && j < data.length; j++) {
      max = Math.max(max, data[j])
    }

    result.push(max)
  }

  return result
}

// =================== STYLES ===================

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    overflow: 'hidden',
  },
  waveformBar: {
    position: 'absolute',
    borderRadius: 0.5,
  },
  simpleBar: {
    position: 'absolute',
    borderRadius: 1,
  },
  progressLine: {
    position: 'absolute',
    top: 0,
    opacity: 0.8,
  },
  channelContainer: {
    position: 'relative',
  },
  channelDivider: {
    height: 1,
    backgroundColor: Colors.border,
    opacity: 0.3,
  },
})