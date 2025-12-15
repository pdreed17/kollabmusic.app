/**
 * Native Mixer Controls Component
 *
 * Advanced track mixing controls that integrate with the Native Audio Engine.
 * Provides comprehensive mixing capabilities including volume, panning, EQ,
 * effects, solo/mute, and advanced audio processing controls.
 */

import React, { useState, useCallback, useMemo } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  Dimensions,
  Animated,
  PanGestureHandler,
  State,
} from 'react-native'
import { Slider } from '@react-native-community/slider'
import { Colors, Typography, Spacing } from '../constants/theme'
import { AudioTrack, AudioEffect, useNativeAudioEngine } from './NativeAudioEngine'
import Icon from 'react-native-vector-icons/MaterialIcons'

const { width: screenWidth } = Dimensions.get('window')

// =================== TYPES ===================

interface MixerTrackProps {
  track: AudioTrack
  onTrackUpdate: (trackId: string, updates: Partial<AudioTrack>) => void
  onSolo: (trackId: string, solo: boolean) => void
  onMute: (trackId: string, muted: boolean) => void
  onVolumeChange: (trackId: string, volume: number) => void
  masterVolume: number
  isPlaying: boolean
  soloedTracks: string[]
}

interface EffectsPanelProps {
  track: AudioTrack
  onEffectsUpdate: (trackId: string, effects: AudioEffect[]) => void
  visible: boolean
  onClose: () => void
}

interface EQBand {
  frequency: number
  gain: number
  q: number
}

interface EQSettings {
  lowBand: EQBand
  midBand: EQBand
  highBand: EQBand
}

// =================== MIXER TRACK COMPONENT ===================

function MixerTrack({
  track,
  onTrackUpdate,
  onSolo,
  onMute,
  onVolumeChange,
  masterVolume,
  isPlaying,
  soloedTracks,
}: MixerTrackProps) {
  const [showEffects, setShowEffects] = useState(false)
  const [showEQ, setShowEQ] = useState(false)
  const [pan, setPan] = useState(0) // -1 to 1 (left to right)
  const [eqSettings, setEQSettings] = useState<EQSettings>({
    lowBand: { frequency: 100, gain: 0, q: 1 },
    midBand: { frequency: 1000, gain: 0, q: 1 },
    highBand: { frequency: 10000, gain: 0, q: 1 },
  })

  const isSoloed = soloedTracks.includes(track.id)
  const isEffectivelyMuted = track.muted || (soloedTracks.length > 0 && !isSoloed)

  const handleVolumeChange = useCallback((volume: number) => {
    // Clamp volume between 0 and 1
    const clampedVolume = Math.max(0, Math.min(1, volume))
    onVolumeChange(track.id, clampedVolume)
  }, [track.id, onVolumeChange])

  const handleMute = useCallback(() => {
    onMute(track.id, !track.muted)
  }, [track.id, track.muted, onMute])

  const handleSolo = useCallback(() => {
    onSolo(track.id, !track.solo)
  }, [track.id, track.solo, onSolo])

  const handlePanChange = useCallback((newPan: number) => {
    // Clamp pan between -1 and 1
    const clampedPan = Math.max(-1, Math.min(1, newPan))
    setPan(clampedPan)
    // In a real implementation, this would update the audio engine's pan
    onTrackUpdate(track.id, { /* pan would be added to AudioTrack interface */ })
  }, [track.id, onTrackUpdate])

  const formatVolumeDisplay = (volume: number) => {
    if (volume === 0) return '-∞'
    const db = 20 * Math.log10(volume)
    return db > 0 ? `+${db.toFixed(1)}` : db.toFixed(1)
  }

  return (
    <View style={styles.mixerTrack}>
      {/* Track Header */}
      <View style={styles.trackHeader}>
        <Text style={styles.trackName} numberOfLines={1}>
          {track.name}
        </Text>
        <TouchableOpacity
          style={styles.effectsButton}
          onPress={() => setShowEffects(true)}
        >
          <Icon name="tune" size={16} color={Colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* EQ Section */}
      <View style={styles.eqSection}>
        <TouchableOpacity
          style={[styles.eqButton, showEQ && styles.eqButtonActive]}
          onPress={() => setShowEQ(!showEQ)}
        >
          <Icon name="equalizer" size={18} color={showEQ ? Colors.primary : Colors.textSecondary} />
        </TouchableOpacity>

        {showEQ && (
          <View style={styles.eqControls}>
            <View style={styles.eqBand}>
              <Text style={styles.eqLabel}>LOW</Text>
              <Slider
                style={styles.eqSlider}
                minimumValue={-12}
                maximumValue={12}
                value={eqSettings.lowBand.gain}
                onValueChange={(value) =>
                  setEQSettings(prev => ({
                    ...prev,
                    lowBand: { ...prev.lowBand, gain: value }
                  }))
                }
                minimumTrackTintColor={Colors.primary}
                maximumTrackTintColor={Colors.border}
                thumbStyle={{ backgroundColor: Colors.primary }}
              />
              <Text style={styles.eqValue}>
                {eqSettings.lowBand.gain.toFixed(1)}dB
              </Text>
            </View>

            <View style={styles.eqBand}>
              <Text style={styles.eqLabel}>MID</Text>
              <Slider
                style={styles.eqSlider}
                minimumValue={-12}
                maximumValue={12}
                value={eqSettings.midBand.gain}
                onValueChange={(value) =>
                  setEQSettings(prev => ({
                    ...prev,
                    midBand: { ...prev.midBand, gain: value }
                  }))
                }
                minimumTrackTintColor={Colors.primary}
                maximumTrackTintColor={Colors.border}
                thumbStyle={{ backgroundColor: Colors.primary }}
              />
              <Text style={styles.eqValue}>
                {eqSettings.midBand.gain.toFixed(1)}dB
              </Text>
            </View>

            <View style={styles.eqBand}>
              <Text style={styles.eqLabel}>HIGH</Text>
              <Slider
                style={styles.eqSlider}
                minimumValue={-12}
                maximumValue={12}
                value={eqSettings.highBand.gain}
                onValueChange={(value) =>
                  setEQSettings(prev => ({
                    ...prev,
                    highBand: { ...prev.highBand, gain: value }
                  }))
                }
                minimumTrackTintColor={Colors.primary}
                maximumTrackTintColor={Colors.border}
                thumbStyle={{ backgroundColor: Colors.primary }}
              />
              <Text style={styles.eqValue}>
                {eqSettings.highBand.gain.toFixed(1)}dB
              </Text>
            </View>
          </View>
        )}
      </View>

      {/* Pan Control */}
      <View style={styles.panSection}>
        <Text style={styles.panLabel}>PAN</Text>
        <Slider
          style={styles.panSlider}
          minimumValue={-1}
          maximumValue={1}
          value={pan}
          onValueChange={handlePanChange}
          minimumTrackTintColor={Colors.primary}
          maximumTrackTintColor={Colors.border}
          thumbStyle={{ backgroundColor: Colors.primary }}
        />
        <Text style={styles.panValue}>
          {pan === 0 ? 'C' : pan < 0 ? `L${Math.abs(pan * 100).toFixed(0)}` : `R${(pan * 100).toFixed(0)}`}
        </Text>
      </View>

      {/* Solo/Mute Buttons */}
      <View style={styles.soloMuteSection}>
        <TouchableOpacity
          style={[
            styles.soloButton,
            track.solo && styles.soloButtonActive,
          ]}
          onPress={handleSolo}
        >
          <Text style={[
            styles.soloMuteText,
            track.solo && styles.soloMuteTextActive,
          ]}>
            S
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.muteButton,
            isEffectivelyMuted && styles.muteButtonActive,
          ]}
          onPress={handleMute}
        >
          <Text style={[
            styles.soloMuteText,
            isEffectivelyMuted && styles.soloMuteTextActive,
          ]}>
            M
          </Text>
        </TouchableOpacity>
      </View>

      {/* Volume Fader */}
      <View style={styles.faderSection}>
        <Text style={styles.volumeValue}>
          {formatVolumeDisplay(track.volume)}dB
        </Text>

        <View style={styles.faderContainer}>
          <Slider
            style={styles.volumeFader}
            minimumValue={0}
            maximumValue={1}
            value={track.volume}
            onValueChange={handleVolumeChange}
            minimumTrackTintColor={Colors.primary}
            maximumTrackTintColor={Colors.border}
            thumbStyle={{
              backgroundColor: Colors.primary,
              width: 30,
              height: 15,
            }}
            vertical={true}
          />

          {/* Volume level indicator */}
          <View style={styles.levelMeter}>
            <View
              style={[
                styles.levelBar,
                {
                  height: `${track.volume * 100}%`,
                  backgroundColor: track.volume > 0.8
                    ? Colors.error
                    : track.volume > 0.6
                    ? Colors.warning
                    : Colors.success,
                },
              ]}
            />
          </View>
        </View>

        <Text style={styles.faderLabel}>VOL</Text>
      </View>

      {/* Effects Panel Modal */}
      <EffectsPanel
        track={track}
        onEffectsUpdate={onTrackUpdate}
        visible={showEffects}
        onClose={() => setShowEffects(false)}
      />
    </View>
  )
}

// =================== EFFECTS PANEL COMPONENT ===================

function EffectsPanel({
  track,
  onEffectsUpdate,
  visible,
  onClose,
}: EffectsPanelProps) {
  const [effects, setEffects] = useState<AudioEffect[]>(track.effects || [])

  const availableEffects = [
    { type: 'reverb', name: 'Reverb', icon: 'surround-sound' },
    { type: 'delay', name: 'Delay', icon: 'replay' },
    { type: 'compressor', name: 'Compressor', icon: 'compress' },
    { type: 'distortion', name: 'Distortion', icon: 'graphic-eq' },
  ]

  const addEffect = useCallback((effectType: string) => {
    const newEffect: AudioEffect = {
      id: `${effectType}_${Date.now()}`,
      type: effectType as any,
      enabled: true,
      parameters: getDefaultParameters(effectType),
    }

    const updatedEffects = [...effects, newEffect]
    setEffects(updatedEffects)
    onEffectsUpdate(track.id, { effects: updatedEffects })
  }, [effects, track.id, onEffectsUpdate])

  const removeEffect = useCallback((effectId: string) => {
    const updatedEffects = effects.filter(e => e.id !== effectId)
    setEffects(updatedEffects)
    onEffectsUpdate(track.id, { effects: updatedEffects })
  }, [effects, track.id, onEffectsUpdate])

  const toggleEffect = useCallback((effectId: string) => {
    const updatedEffects = effects.map(effect =>
      effect.id === effectId
        ? { ...effect, enabled: !effect.enabled }
        : effect
    )
    setEffects(updatedEffects)
    onEffectsUpdate(track.id, { effects: updatedEffects })
  }, [effects, track.id, onEffectsUpdate])

  const updateEffectParameter = useCallback((effectId: string, parameter: string, value: number) => {
    const updatedEffects = effects.map(effect =>
      effect.id === effectId
        ? {
            ...effect,
            parameters: {
              ...effect.parameters,
              [parameter]: value,
            },
          }
        : effect
    )
    setEffects(updatedEffects)
    onEffectsUpdate(track.id, { effects: updatedEffects })
  }, [effects, track.id, onEffectsUpdate])

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.effectsModal}>
        <View style={styles.effectsHeader}>
          <Text style={styles.effectsTitle}>Effects - {track.name}</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Icon name="close" size={24} color={Colors.text} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.effectsContent}>
          {/* Add Effects Section */}
          <View style={styles.addEffectsSection}>
            <Text style={styles.sectionTitle}>Add Effects</Text>
            <View style={styles.effectsGrid}>
              {availableEffects.map((effect) => (
                <TouchableOpacity
                  key={effect.type}
                  style={styles.addEffectButton}
                  onPress={() => addEffect(effect.type)}
                >
                  <Icon name={effect.icon} size={24} color={Colors.primary} />
                  <Text style={styles.addEffectText}>{effect.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Current Effects */}
          <View style={styles.currentEffectsSection}>
            <Text style={styles.sectionTitle}>Current Effects</Text>
            {effects.length === 0 ? (
              <Text style={styles.noEffectsText}>No effects added</Text>
            ) : (
              effects.map((effect) => (
                <EffectControl
                  key={effect.id}
                  effect={effect}
                  onToggle={() => toggleEffect(effect.id)}
                  onRemove={() => removeEffect(effect.id)}
                  onParameterChange={(parameter, value) =>
                    updateEffectParameter(effect.id, parameter, value)
                  }
                />
              ))
            )}
          </View>
        </ScrollView>
      </View>
    </Modal>
  )
}

// =================== EFFECT CONTROL COMPONENT ===================

interface EffectControlProps {
  effect: AudioEffect
  onToggle: () => void
  onRemove: () => void
  onParameterChange: (parameter: string, value: number) => void
}

function EffectControl({
  effect,
  onToggle,
  onRemove,
  onParameterChange,
}: EffectControlProps) {
  const parameters = Object.entries(effect.parameters)

  return (
    <View style={styles.effectControl}>
      <View style={styles.effectHeader}>
        <View style={styles.effectInfo}>
          <Text style={styles.effectName}>{effect.type.toUpperCase()}</Text>
          <TouchableOpacity
            style={[
              styles.effectToggle,
              effect.enabled && styles.effectToggleActive,
            ]}
            onPress={onToggle}
          >
            <Text style={[
              styles.effectToggleText,
              effect.enabled && styles.effectToggleTextActive,
            ]}>
              {effect.enabled ? 'ON' : 'OFF'}
            </Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity onPress={onRemove} style={styles.removeEffectButton}>
          <Icon name="delete" size={20} color={Colors.error} />
        </TouchableOpacity>
      </View>

      {effect.enabled && (
        <View style={styles.effectParameters}>
          {parameters.map(([parameter, value]) => (
            <View key={parameter} style={styles.parameterControl}>
              <Text style={styles.parameterLabel}>{parameter}</Text>
              <Slider
                style={styles.parameterSlider}
                minimumValue={0}
                maximumValue={1}
                value={value}
                onValueChange={(newValue) => onParameterChange(parameter, newValue)}
                minimumTrackTintColor={Colors.primary}
                maximumTrackTintColor={Colors.border}
                thumbStyle={{ backgroundColor: Colors.primary }}
              />
              <Text style={styles.parameterValue}>
                {(value * 100).toFixed(0)}%
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  )
}

// =================== MASTER SECTION COMPONENT ===================

interface MasterSectionProps {
  masterVolume: number
  onMasterVolumeChange: (volume: number) => void
  masterMuted: boolean
  onMasterMuteToggle: () => void
}

function MasterSection({
  masterVolume,
  onMasterVolumeChange,
  masterMuted,
  onMasterMuteToggle,
}: MasterSectionProps) {
  const formatVolumeDisplay = (volume: number) => {
    if (volume === 0) return '-∞'
    const db = 20 * Math.log10(volume)
    return db > 0 ? `+${db.toFixed(1)}` : db.toFixed(1)
  }

  return (
    <View style={styles.masterSection}>
      <Text style={styles.masterLabel}>MASTER</Text>

      <TouchableOpacity
        style={[
          styles.masterMuteButton,
          masterMuted && styles.masterMuteButtonActive,
        ]}
        onPress={onMasterMuteToggle}
      >
        <Icon
          name={masterMuted ? 'volume-off' : 'volume-up'}
          size={20}
          color={masterMuted ? Colors.error : Colors.text}
        />
      </TouchableOpacity>

      <Text style={styles.masterVolumeValue}>
        {formatVolumeDisplay(masterVolume)}dB
      </Text>

      <View style={styles.masterFaderContainer}>
        <Slider
          style={styles.masterVolumeFader}
          minimumValue={0}
          maximumValue={1}
          value={masterVolume}
          onValueChange={onMasterVolumeChange}
          minimumTrackTintColor={Colors.primary}
          maximumTrackTintColor={Colors.border}
          thumbStyle={{
            backgroundColor: Colors.primary,
            width: 35,
            height: 18,
          }}
          vertical={true}
        />

        <View style={styles.masterLevelMeter}>
          <View
            style={[
              styles.levelBar,
              {
                height: `${masterVolume * 100}%`,
                backgroundColor: masterVolume > 0.8
                  ? Colors.error
                  : masterVolume > 0.6
                  ? Colors.warning
                  : Colors.success,
              },
            ]}
          />
        </View>
      </View>
    </View>
  )
}

// =================== MAIN MIXER COMPONENT ===================

interface NativeMixerControlsProps {
  tracks: AudioTrack[]
  onTrackUpdate: (trackId: string, updates: Partial<AudioTrack>) => void
  masterVolume: number
  onMasterVolumeChange: (volume: number) => void
  masterMuted: boolean
  onMasterMuteToggle: () => void
  soloedTracks: string[]
  isPlaying: boolean
}

export default function NativeMixerControls({
  tracks,
  onTrackUpdate,
  masterVolume,
  onMasterVolumeChange,
  masterMuted,
  onMasterMuteToggle,
  soloedTracks,
  isPlaying,
}: NativeMixerControlsProps) {
  const handleSolo = useCallback((trackId: string, solo: boolean) => {
    onTrackUpdate(trackId, { solo })
  }, [onTrackUpdate])

  const handleMute = useCallback((trackId: string, muted: boolean) => {
    onTrackUpdate(trackId, { muted })
  }, [onTrackUpdate])

  const handleVolumeChange = useCallback((trackId: string, volume: number) => {
    onTrackUpdate(trackId, { volume })
  }, [onTrackUpdate])

  return (
    <View style={styles.mixerContainer}>
      <ScrollView
        horizontal
        style={styles.tracksScroll}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tracksContainer}
      >
        {tracks.map((track) => (
          <MixerTrack
            key={track.id}
            track={track}
            onTrackUpdate={onTrackUpdate}
            onSolo={handleSolo}
            onMute={handleMute}
            onVolumeChange={handleVolumeChange}
            masterVolume={masterVolume}
            isPlaying={isPlaying}
            soloedTracks={soloedTracks}
          />
        ))}

        <MasterSection
          masterVolume={masterVolume}
          onMasterVolumeChange={onMasterVolumeChange}
          masterMuted={masterMuted}
          onMasterMuteToggle={onMasterMuteToggle}
        />
      </ScrollView>
    </View>
  )
}

// =================== UTILITY FUNCTIONS ===================

function getDefaultParameters(effectType: string): Record<string, number> {
  switch (effectType) {
    case 'reverb':
      return {
        roomSize: 0.5,
        damping: 0.5,
        wetLevel: 0.3,
        dryLevel: 0.7,
      }
    case 'delay':
      return {
        delayTime: 0.25,
        feedback: 0.3,
        wetLevel: 0.2,
        dryLevel: 0.8,
      }
    case 'compressor':
      return {
        threshold: 0.7,
        ratio: 0.4,
        attack: 0.003,
        release: 0.1,
        makeupGain: 0.5,
      }
    case 'distortion':
      return {
        drive: 0.5,
        tone: 0.5,
        level: 0.7,
      }
    default:
      return {}
  }
}

// =================== STYLES ===================

const styles = StyleSheet.create({
  mixerContainer: {
    height: 400,
    backgroundColor: Colors.surfaceElevated,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  tracksScroll: {
    flex: 1,
  },
  tracksContainer: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.sm,
  },
  mixerTrack: {
    width: 80,
    marginHorizontal: Spacing.xs,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  trackHeader: {
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  trackName: {
    ...Typography.caption,
    color: Colors.text,
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  effectsButton: {
    padding: Spacing.xs,
    borderRadius: 4,
    backgroundColor: Colors.surfaceElevated,
  },
  eqSection: {
    marginBottom: Spacing.sm,
  },
  eqButton: {
    alignSelf: 'center',
    padding: Spacing.xs,
    borderRadius: 4,
    backgroundColor: Colors.surfaceElevated,
  },
  eqButtonActive: {
    backgroundColor: Colors.primary + '20',
  },
  eqControls: {
    marginTop: Spacing.xs,
  },
  eqBand: {
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  eqLabel: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontSize: 10,
  },
  eqSlider: {
    width: 60,
    height: 20,
  },
  eqValue: {
    ...Typography.caption,
    color: Colors.text,
    fontSize: 9,
  },
  panSection: {
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  panLabel: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontSize: 10,
  },
  panSlider: {
    width: 60,
    height: 20,
  },
  panValue: {
    ...Typography.caption,
    color: Colors.text,
    fontSize: 10,
  },
  soloMuteSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  soloButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.warning,
    alignItems: 'center',
    justifyContent: 'center',
  },
  soloButtonActive: {
    backgroundColor: Colors.warning,
  },
  muteButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
  muteButtonActive: {
    backgroundColor: Colors.error,
  },
  soloMuteText: {
    ...Typography.caption,
    color: Colors.text,
    fontSize: 10,
    fontWeight: 'bold',
  },
  soloMuteTextActive: {
    color: Colors.surface,
  },
  faderSection: {
    flex: 1,
    alignItems: 'center',
  },
  volumeValue: {
    ...Typography.caption,
    color: Colors.text,
    fontSize: 10,
    marginBottom: Spacing.xs,
  },
  faderContainer: {
    flex: 1,
    width: 40,
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  volumeFader: {
    flex: 1,
    height: '100%',
  },
  levelMeter: {
    width: 6,
    backgroundColor: Colors.border,
    marginLeft: Spacing.xs,
    borderRadius: 3,
    overflow: 'hidden',
  },
  levelBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderRadius: 3,
  },
  faderLabel: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontSize: 9,
    marginTop: Spacing.xs,
  },
  masterSection: {
    width: 90,
    marginHorizontal: Spacing.xs,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.primary + '10',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: Colors.primary + '30',
    alignItems: 'center',
  },
  masterLabel: {
    ...Typography.caption,
    color: Colors.primary,
    fontWeight: 'bold',
    marginBottom: Spacing.sm,
  },
  masterMuteButton: {
    padding: Spacing.sm,
    borderRadius: 6,
    backgroundColor: Colors.surfaceElevated,
    marginBottom: Spacing.sm,
  },
  masterMuteButtonActive: {
    backgroundColor: Colors.error + '20',
  },
  masterVolumeValue: {
    ...Typography.caption,
    color: Colors.text,
    fontSize: 11,
    marginBottom: Spacing.sm,
  },
  masterFaderContainer: {
    flex: 1,
    width: 50,
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  masterVolumeFader: {
    flex: 1,
    height: '100%',
  },
  masterLevelMeter: {
    width: 8,
    backgroundColor: Colors.border,
    marginLeft: Spacing.xs,
    borderRadius: 4,
    overflow: 'hidden',
  },

  // Effects Modal Styles
  effectsModal: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  effectsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  effectsTitle: {
    ...Typography.h3,
    color: Colors.text,
  },
  closeButton: {
    padding: Spacing.sm,
  },
  effectsContent: {
    flex: 1,
    padding: Spacing.lg,
  },
  addEffectsSection: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    ...Typography.h4,
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  effectsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  addEffectButton: {
    width: (screenWidth - Spacing.lg * 2 - Spacing.md) / 2,
    padding: Spacing.lg,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  addEffectText: {
    ...Typography.body,
    color: Colors.text,
    marginTop: Spacing.sm,
  },
  currentEffectsSection: {
    flex: 1,
  },
  noEffectsText: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: Spacing.xl,
  },
  effectControl: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  effectHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  effectInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  effectName: {
    ...Typography.body,
    color: Colors.text,
    fontWeight: 'bold',
    marginRight: Spacing.md,
  },
  effectToggle: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: 4,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  effectToggleActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  effectToggleText: {
    ...Typography.caption,
    color: Colors.text,
    fontWeight: 'bold',
  },
  effectToggleTextActive: {
    color: Colors.surface,
  },
  removeEffectButton: {
    padding: Spacing.sm,
  },
  effectParameters: {
    gap: Spacing.md,
  },
  parameterControl: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  parameterLabel: {
    ...Typography.body,
    color: Colors.text,
    width: 80,
    textTransform: 'capitalize',
  },
  parameterSlider: {
    flex: 1,
    height: 40,
  },
  parameterValue: {
    ...Typography.body,
    color: Colors.textSecondary,
    width: 40,
    textAlign: 'right',
  },
})