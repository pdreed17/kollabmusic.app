/**
 * NearbyCollaborators Component
 *
 * Displays nearby collaborators and file sharing UI
 * Used in ProjectStudioScreen as a tab
 */

import React, { useEffect, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Colors, Typography, Spacing, BorderRadius } from '../constants/theme'
import nearbyCollaboratorsService, {
  NearbyCollaborator,
} from '../services/nearbyCollaborators.service'
import p2pTransferService, {
  TransferProgress,
} from '../services/p2pTransfer.service'

interface NearbyCollaboratorsProps {
  projectId: string
  userId: string
  onShareFile?: () => void
}

export default function NearbyCollaborators({
  projectId,
  userId,
  onShareFile,
}: NearbyCollaboratorsProps) {
  const [isSessionActive, setIsSessionActive] = useState(false)
  const [nearbyCollaborators, setNearbyCollaborators] = useState<NearbyCollaborator[]>([])
  const [transfers, setTransfers] = useState<TransferProgress[]>([])
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    // Subscribe to nearby collaborators updates
    const unsubscribeCollaborators = nearbyCollaboratorsService.subscribe(
      (collaborators) => {
        setNearbyCollaborators(collaborators)
      }
    )

    // Subscribe to transfer updates
    const unsubscribeTransfers = p2pTransferService.subscribe((progress) => {
      setTransfers(p2pTransferService.getActiveTransfers())
    })

    return () => {
      unsubscribeCollaborators()
      unsubscribeTransfers()
    }
  }, [])

  const handleStartSession = async () => {
    try {
      setIsLoading(true)
      const success = await nearbyCollaboratorsService.startSession(projectId, userId)

      if (success) {
        setIsSessionActive(true)
        Alert.alert(
          'Session Started',
          'Now discovering nearby collaborators. Make sure others have their sessions active too.'
        )
      } else {
        Alert.alert(
          'Failed to Start',
          'Could not start proximity session. Please check Bluetooth permissions.'
        )
      }
    } catch (error) {
      console.error('Error starting session:', error)
      Alert.alert('Error', 'Failed to start session')
    } finally {
      setIsLoading(false)
    }
  }

  const handleStopSession = async () => {
    try {
      setIsLoading(true)
      await nearbyCollaboratorsService.stopSession()
      setIsSessionActive(false)
      setNearbyCollaborators([])
    } catch (error) {
      console.error('Error stopping session:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const getDistanceIcon = (distance: 'immediate' | 'near' | 'far') => {
    switch (distance) {
      case 'immediate':
        return 'radio-button-on'
      case 'near':
        return 'radio-button-off'
      case 'far':
        return 'ellipse-outline'
    }
  }

  const getDistanceText = (distance: 'immediate' | 'near' | 'far') => {
    switch (distance) {
      case 'immediate':
        return 'Very close'
      case 'near':
        return 'Nearby'
      case 'far':
        return 'Far'
    }
  }

  const getDistanceColor = (distance: 'immediate' | 'near' | 'far') => {
    switch (distance) {
      case 'immediate':
        return Colors.success
      case 'near':
        return Colors.primary
      case 'far':
        return Colors.textSecondary
    }
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header Section */}
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <Ionicons name="radio" size={32} color={Colors.primary} />
        </View>
        <Text style={styles.headerTitle}>Nearby Sharing</Text>
        <Text style={styles.headerSubtitle}>
          Share audio files instantly with collaborators in the same room
        </Text>
      </View>

      {/* Session Control */}
      <View style={styles.sessionControl}>
        {!isSessionActive ? (
          <TouchableOpacity
            style={styles.startButton}
            onPress={handleStartSession}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color={Colors.text} />
            ) : (
              <>
                <Ionicons name="play-circle" size={24} color={Colors.text} />
                <Text style={styles.startButtonText}>Start Discovery</Text>
              </>
            )}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.stopButton}
            onPress={handleStopSession}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color={Colors.text} />
            ) : (
              <>
                <Ionicons name="stop-circle" size={24} color={Colors.text} />
                <Text style={styles.stopButtonText}>Stop Discovery</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* Nearby Collaborators List */}
      {isSessionActive && (
        <View style={styles.collaboratorsSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              Nearby ({nearbyCollaborators.length})
            </Text>
            {nearbyCollaborators.length > 0 && (
              <View style={styles.activeIndicator}>
                <View style={styles.activeDot} />
                <Text style={styles.activeText}>Discovering...</Text>
              </View>
            )}
          </View>

          {nearbyCollaborators.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons
                name="person-add-outline"
                size={48}
                color={Colors.textSecondary}
              />
              <Text style={styles.emptyStateText}>No one nearby yet</Text>
              <Text style={styles.emptyStateSubtext}>
                Ask collaborators to start their discovery
              </Text>
            </View>
          ) : (
            nearbyCollaborators.map((collaborator) => (
              <View key={collaborator.deviceId} style={styles.collaboratorCard}>
                <View style={styles.collaboratorHeader}>
                  <View style={styles.collaboratorAvatar}>
                    <Ionicons name="person" size={24} color={Colors.primary} />
                  </View>
                  <View style={styles.collaboratorInfo}>
                    <Text style={styles.collaboratorName}>
                      {collaborator.userDisplayName}
                    </Text>
                    <View style={styles.collaboratorMeta}>
                      <Ionicons
                        name={getDistanceIcon(collaborator.distance)}
                        size={12}
                        color={getDistanceColor(collaborator.distance)}
                      />
                      <Text
                        style={[
                          styles.distanceText,
                          { color: getDistanceColor(collaborator.distance) },
                        ]}
                      >
                        {getDistanceText(collaborator.distance)}
                      </Text>
                    </View>
                  </View>
                  <Ionicons
                    name="checkmark-circle"
                    size={24}
                    color={Colors.success}
                  />
                </View>
              </View>
            ))
          )}
        </View>
      )}

      {/* Share Files Section */}
      {isSessionActive && nearbyCollaborators.length > 0 && (
        <View style={styles.shareSection}>
          <Text style={styles.sectionTitle}>Share Audio</Text>
          <TouchableOpacity style={styles.shareButton} onPress={onShareFile}>
            <Ionicons name="share-outline" size={24} color={Colors.primary} />
            <View style={styles.shareButtonContent}>
              <Text style={styles.shareButtonText}>Share Current Track</Text>
              <Text style={styles.shareButtonSubtext}>
                Sends to all {nearbyCollaborators.length} nearby{' '}
                {nearbyCollaborators.length === 1 ? 'collaborator' : 'collaborators'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>
      )}

      {/* Active Transfers */}
      {transfers.length > 0 && (
        <View style={styles.transfersSection}>
          <Text style={styles.sectionTitle}>Active Transfers</Text>
          {transfers.map((transfer) => (
            <View key={transfer.fileId} style={styles.transferCard}>
              <View style={styles.transferHeader}>
                <Ionicons
                  name={
                    transfer.status === 'completed'
                      ? 'checkmark-circle'
                      : transfer.status === 'failed'
                      ? 'close-circle'
                      : 'arrow-up-circle'
                  }
                  size={24}
                  color={
                    transfer.status === 'completed'
                      ? Colors.success
                      : transfer.status === 'failed'
                      ? Colors.error
                      : Colors.primary
                  }
                />
                <View style={styles.transferInfo}>
                  <Text style={styles.transferFileName}>{transfer.fileName}</Text>
                  <Text style={styles.transferStatus}>
                    {transfer.status === 'preparing' && 'Preparing...'}
                    {transfer.status === 'transferring' &&
                      `Transferring... ${transfer.percentage}%`}
                    {transfer.status === 'finalizing' && 'Finalizing...'}
                    {transfer.status === 'completed' && 'Completed'}
                    {transfer.status === 'failed' && `Failed: ${transfer.error}`}
                  </Text>
                </View>
              </View>
              {transfer.status === 'transferring' && (
                <View style={styles.progressBar}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${transfer.percentage}%` },
                    ]}
                  />
                </View>
              )}
            </View>
          ))}
        </View>
      )}

      {/* How It Works */}
      <View style={styles.infoSection}>
        <Text style={styles.infoTitle}>How It Works</Text>

        <View style={styles.infoItem}>
          <View style={styles.infoNumber}>
            <Text style={styles.infoNumberText}>1</Text>
          </View>
          <Text style={styles.infoText}>
            Everyone opens the same project and starts discovery
          </Text>
        </View>

        <View style={styles.infoItem}>
          <View style={styles.infoNumber}>
            <Text style={styles.infoNumberText}>2</Text>
          </View>
          <Text style={styles.infoText}>
            Nearby collaborators appear automatically via Bluetooth
          </Text>
        </View>

        <View style={styles.infoItem}>
          <View style={styles.infoNumber}>
            <Text style={styles.infoNumberText}>3</Text>
          </View>
          <Text style={styles.infoText}>
            Share audio files instantly - no internet needed
          </Text>
        </View>

        <View style={styles.infoItem}>
          <View style={styles.infoNumber}>
            <Text style={styles.infoNumberText}>4</Text>
          </View>
          <Text style={styles.infoText}>
            Files sync to cloud automatically for desktop access
          </Text>
        </View>
      </View>

      {/* Requirements */}
      <View style={styles.requirementsSection}>
        <Text style={styles.requirementsTitle}>Requirements</Text>
        <View style={styles.requirement}>
          <Ionicons name="bluetooth" size={16} color={Colors.info} />
          <Text style={styles.requirementText}>Bluetooth must be enabled</Text>
        </View>
        <View style={styles.requirement}>
          <Ionicons name="location" size={16} color={Colors.info} />
          <Text style={styles.requirementText}>
            Location permission required (for Bluetooth discovery)
          </Text>
        </View>
        <View style={styles.requirement}>
          <Ionicons name="people" size={16} color={Colors.info} />
          <Text style={styles.requirementText}>
            All collaborators must be on the same project
          </Text>
        </View>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.backgroundDark,
  },
  header: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.lg,
  },
  headerIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  headerTitle: {
    ...Typography.h2,
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  headerSubtitle: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  sessionControl: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  startButtonText: {
    ...Typography.bodyLarge,
    color: Colors.text,
    fontWeight: '600',
  },
  stopButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.error,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  stopButtonText: {
    ...Typography.bodyLarge,
    color: Colors.text,
    fontWeight: '600',
  },
  collaboratorsSection: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    ...Typography.h3,
    color: Colors.text,
  },
  activeIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  activeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.success,
  },
  activeText: {
    ...Typography.caption,
    color: Colors.success,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing.xxxl,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
  },
  emptyStateText: {
    ...Typography.h3,
    color: Colors.text,
    marginTop: Spacing.md,
  },
  emptyStateSubtext: {
    ...Typography.body,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },
  collaboratorCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  collaboratorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  collaboratorAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
  },
  collaboratorInfo: {
    flex: 1,
  },
  collaboratorName: {
    ...Typography.bodyLarge,
    color: Colors.text,
    fontWeight: '600',
    marginBottom: Spacing.xxs,
  },
  collaboratorMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  distanceText: {
    ...Typography.caption,
    fontWeight: '500',
  },
  shareSection: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    borderColor: Colors.primary,
    borderStyle: 'dashed',
  },
  shareButtonContent: {
    flex: 1,
  },
  shareButtonText: {
    ...Typography.bodyLarge,
    color: Colors.text,
    fontWeight: '600',
    marginBottom: Spacing.xxs,
  },
  shareButtonSubtext: {
    ...Typography.caption,
    color: Colors.textSecondary,
  },
  transfersSection: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  transferCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  transferHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  transferInfo: {
    flex: 1,
  },
  transferFileName: {
    ...Typography.body,
    color: Colors.text,
    fontWeight: '600',
    marginBottom: Spacing.xxs,
  },
  transferStatus: {
    ...Typography.caption,
    color: Colors.textSecondary,
  },
  progressBar: {
    height: 4,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 2,
    marginTop: Spacing.sm,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.primary,
  },
  infoSection: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    backgroundColor: Colors.surface,
    marginBottom: Spacing.lg,
  },
  infoTitle: {
    ...Typography.h3,
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  infoNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoNumberText: {
    ...Typography.caption,
    color: Colors.text,
    fontWeight: '700',
  },
  infoText: {
    ...Typography.body,
    color: Colors.text,
    flex: 1,
    lineHeight: 20,
  },
  requirementsSection: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxxl,
  },
  requirementsTitle: {
    ...Typography.h3,
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  requirement: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  requirementText: {
    ...Typography.body,
    color: Colors.textSecondary,
  },
})
