/**
 * P2PTransferService
 *
 * Handles peer-to-peer file transfers between nearby collaborators
 * Uses local network transfer for fast audio file sharing
 * Falls back to cloud upload if P2P fails
 *
 * Flow:
 * 1. Sender selects audio file to share
 * 2. Find nearby collaborator (from NearbyCollaboratorsService)
 * 3. Establish P2P connection
 * 4. Transfer file directly (fast, no internet needed)
 * 5. Both devices upload to cloud for sync
 * 6. Update project metadata in Supabase
 */

import * as FileSystem from 'expo-file-system'
import { supabase } from '../lib/supabase'
import { Platform } from 'react-native'

export interface TransferProgress {
  fileId: string
  fileName: string
  totalBytes: number
  transferredBytes: number
  percentage: number
  status: 'preparing' | 'transferring' | 'finalizing' | 'completed' | 'failed'
  error?: string
}

export interface FileToTransfer {
  uri: string
  name: string
  size: number
  mimeType: string
  stemType: string
  stemName: string
  projectId: string
}

class P2PTransferService {
  private activeTransfers: Map<string, TransferProgress> = new Map()
  private listeners: Set<(progress: TransferProgress) => void> = new Set()

  /**
   * Send audio file to nearby collaborator via P2P
   *
   * Note: For MVP, we'll use cloud-based transfer
   * True P2P (WiFi Direct) requires native modules
   */
  async sendFile(
    file: FileToTransfer,
    recipientUserId: string,
    senderUserId: string
  ): Promise<boolean> {
    const transferId = this.generateTransferId()

    try {
      // Initialize progress tracking
      const progress: TransferProgress = {
        fileId: transferId,
        fileName: file.name,
        totalBytes: file.size,
        transferredBytes: 0,
        percentage: 0,
        status: 'preparing',
      }

      this.activeTransfers.set(transferId, progress)
      this.notifyListeners(progress)

      // Step 1: Upload to cloud (serves as P2P transfer for MVP)
      await this.uploadToCloud(file, senderUserId, transferId)

      // Step 2: Notify recipient
      await this.notifyRecipient(file, recipientUserId, transferId)

      // Step 3: Mark as completed
      progress.status = 'completed'
      progress.percentage = 100
      this.activeTransfers.set(transferId, progress)
      this.notifyListeners(progress)

      return true
    } catch (error) {
      console.error('Error sending file:', error)

      const progress = this.activeTransfers.get(transferId)
      if (progress) {
        progress.status = 'failed'
        progress.error = error instanceof Error ? error.message : 'Unknown error'
        this.activeTransfers.set(transferId, progress)
        this.notifyListeners(progress)
      }

      return false
    } finally {
      // Cleanup after 5 seconds
      setTimeout(() => {
        this.activeTransfers.delete(transferId)
      }, 5000)
    }
  }

  /**
   * Receive audio file from nearby collaborator
   */
  async receiveFile(
    transferId: string,
    projectId: string,
    recipientUserId: string
  ): Promise<{ success: boolean; filePath?: string }> {
    try {
      // Get transfer metadata from database
      const { data: transfer, error } = await supabase
        .from('p2p_transfers')
        .select('*')
        .eq('id', transferId)
        .single()

      if (error || !transfer) {
        throw new Error('Transfer not found')
      }

      // Download file from cloud to device
      const localPath = await this.downloadFromCloud(transfer.file_path)

      // Mark transfer as received
      await supabase
        .from('p2p_transfers')
        .update({
          status: 'completed',
          received_at: new Date().toISOString(),
        })
        .eq('id', transferId)

      return { success: true, filePath: localPath }
    } catch (error) {
      console.error('Error receiving file:', error)
      return { success: false }
    }
  }

  /**
   * Upload file to cloud storage
   */
  private async uploadToCloud(
    file: FileToTransfer,
    userId: string,
    transferId: string
  ): Promise<string> {
    try {
      // Update progress
      this.updateProgress(transferId, 'transferring', 10)

      // Generate unique file path
      const fileExt = file.name.split('.').pop()
      const timestamp = Date.now()
      const fileName = `${timestamp}_${file.stemName.replace(/[^a-zA-Z0-9]/g, '_')}.${fileExt}`
      const filePath = `${file.projectId}/p2p/${fileName}`

      // Read file as blob
      const fileInfo = await FileSystem.getInfoAsync(file.uri)
      if (!fileInfo.exists) {
        throw new Error('File not found')
      }

      this.updateProgress(transferId, 'transferring', 30)

      // Upload to Supabase Storage
      const response = await fetch(file.uri)
      const blob = await response.blob()

      this.updateProgress(transferId, 'transferring', 60)

      const { error: uploadError } = await supabase.storage
        .from('audio-files')
        .upload(filePath, blob, {
          contentType: file.mimeType,
          upsert: false,
        })

      if (uploadError) throw uploadError

      this.updateProgress(transferId, 'transferring', 90)

      // Insert into audio_files table
      await supabase.from('audio_files').insert({
        project_id: file.projectId,
        file_path: filePath,
        file_name: file.name,
        file_size: file.size,
        file_type: 'audio',
        format: fileExt || 'unknown',
        stem_type: file.stemType,
        stem_name: file.stemName,
        volume: 1.0,
        pan: 0.0,
        is_muted: false,
        is_soloed: false,
        created_by: userId,
      })

      this.updateProgress(transferId, 'finalizing', 95)

      return filePath
    } catch (error) {
      console.error('Error uploading to cloud:', error)
      throw error
    }
  }

  /**
   * Notify recipient that file is ready
   */
  private async notifyRecipient(
    file: FileToTransfer,
    recipientUserId: string,
    transferId: string
  ): Promise<void> {
    try {
      // Insert transfer record
      await supabase.from('p2p_transfers').insert({
        id: transferId,
        project_id: file.projectId,
        sender_user_id: recipientUserId, // Will be set by sender
        recipient_user_id: recipientUserId,
        file_path: `${file.projectId}/p2p/${file.name}`,
        file_name: file.name,
        file_size: file.size,
        status: 'completed',
        created_at: new Date().toISOString(),
        received_at: new Date().toISOString(),
      })

      // Send real-time notification via Supabase Realtime
      const channel = supabase.channel(`project:${file.projectId}`)
      await channel.send({
        type: 'broadcast',
        event: 'file_shared',
        payload: {
          transferId,
          fileName: file.name,
          stemType: file.stemType,
          stemName: file.stemName,
        },
      })
    } catch (error) {
      console.error('Error notifying recipient:', error)
      throw error
    }
  }

  /**
   * Download file from cloud storage
   */
  private async downloadFromCloud(filePath: string): Promise<string> {
    try {
      // Get signed URL
      const { data, error } = await supabase.storage
        .from('audio-files')
        .createSignedUrl(filePath, 3600) // 1 hour expiry

      if (error) throw error

      // Download to local device
      const localUri = `${FileSystem.documentDirectory}${filePath.split('/').pop()}`

      const downloadResult = await FileSystem.downloadAsync(
        data.signedUrl,
        localUri
      )

      return downloadResult.uri
    } catch (error) {
      console.error('Error downloading from cloud:', error)
      throw error
    }
  }

  /**
   * Update transfer progress
   */
  private updateProgress(
    transferId: string,
    status: TransferProgress['status'],
    percentage: number
  ): void {
    const progress = this.activeTransfers.get(transferId)
    if (progress) {
      progress.status = status
      progress.percentage = percentage
      progress.transferredBytes = Math.floor((percentage / 100) * progress.totalBytes)
      this.activeTransfers.set(transferId, progress)
      this.notifyListeners(progress)
    }
  }

  /**
   * Get active transfers
   */
  getActiveTransfers(): TransferProgress[] {
    return Array.from(this.activeTransfers.values())
  }

  /**
   * Subscribe to transfer progress updates
   */
  subscribe(callback: (progress: TransferProgress) => void): () => void {
    this.listeners.add(callback)

    return () => {
      this.listeners.delete(callback)
    }
  }

  /**
   * Notify listeners of progress updates
   */
  private notifyListeners(progress: TransferProgress): void {
    this.listeners.forEach(listener => listener(progress))
  }

  /**
   * Generate unique transfer ID
   */
  private generateTransferId(): string {
    return `transfer_${Date.now()}_${Math.random().toString(36).substring(7)}`
  }

  /**
   * Cancel an active transfer
   */
  async cancelTransfer(transferId: string): Promise<void> {
    const progress = this.activeTransfers.get(transferId)
    if (progress) {
      progress.status = 'failed'
      progress.error = 'Cancelled by user'
      this.activeTransfers.set(transferId, progress)
      this.notifyListeners(progress)

      // Cleanup
      setTimeout(() => {
        this.activeTransfers.delete(transferId)
      }, 1000)
    }
  }

  /**
   * Share audio file with all nearby collaborators
   */
  async shareWithNearby(
    file: FileToTransfer,
    nearbyUserIds: string[],
    senderUserId: string
  ): Promise<{ success: boolean; failedRecipients: string[] }> {
    const failedRecipients: string[] = []

    for (const userId of nearbyUserIds) {
      try {
        const success = await this.sendFile(file, userId, senderUserId)
        if (!success) {
          failedRecipients.push(userId)
        }
      } catch (error) {
        console.error(`Failed to share with user ${userId}:`, error)
        failedRecipients.push(userId)
      }
    }

    return {
      success: failedRecipients.length === 0,
      failedRecipients,
    }
  }

  /**
   * Cleanup
   */
  destroy(): void {
    this.activeTransfers.clear()
    this.listeners.clear()
  }
}

export const p2pTransferService = new P2PTransferService()
export default p2pTransferService
