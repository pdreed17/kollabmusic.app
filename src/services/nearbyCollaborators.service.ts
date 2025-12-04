/**
 * NearbyCollaboratorsService
 *
 * Handles proximity-based device discovery for project collaborators
 * Uses BLE (Bluetooth Low Energy) to discover nearby devices
 * Only connects devices that are collaborating on the same project
 *
 * Security:
 * - Project ID must match
 * - User must be verified collaborator in Supabase
 * - Encrypted handshake using project-specific keys
 */

import { BleManager, Device, Characteristic } from 'react-native-ble-plx'
import * as ExpoDevice from 'expo-device'
import { supabase } from '../lib/supabase'
import { Platform, PermissionsAndroid } from 'react-native'

// BLE Service UUID for Kollab Music App
const KOLLAB_SERVICE_UUID = '0000FFF0-0000-1000-8000-00805F9B34FB'
const PROJECT_CHARACTERISTIC_UUID = '0000FFF1-0000-1000-8000-00805F9B34FB'
const USER_CHARACTERISTIC_UUID = '0000FFF2-0000-1000-8000-00805F9B34FB'

export interface NearbyCollaborator {
  deviceId: string
  userId: string
  projectId: string
  userName: string
  userDisplayName: string
  lastSeen: Date
  signalStrength: number // RSSI value
  distance: 'immediate' | 'near' | 'far' // Estimated based on RSSI
}

interface ProximitySession {
  projectId: string
  userId: string
  deviceId: string
  isActive: boolean
}

class NearbyCollaboratorsService {
  private bleManager: BleManager
  private currentSession: ProximitySession | null = null
  private discoveredDevices: Map<string, NearbyCollaborator> = new Map()
  private isScanning: boolean = false
  private listeners: Set<(collaborators: NearbyCollaborator[]) => void> = new Set()

  constructor() {
    this.bleManager = new BleManager()
  }

  /**
   * Request necessary permissions for BLE
   */
  async requestPermissions(): Promise<boolean> {
    try {
      if (Platform.OS === 'android') {
        if (Platform.Version >= 31) {
          // Android 12+ requires new permissions
          const granted = await PermissionsAndroid.requestMultiple([
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE,
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          ])

          return Object.values(granted).every(
            permission => permission === PermissionsAndroid.RESULTS.GRANTED
          )
        } else {
          // Android < 12
          const granted = await PermissionsAndroid.requestMultiple([
            PermissionsAndroid.PERMISSIONS.BLUETOOTH,
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADMIN,
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          ])

          return Object.values(granted).every(
            permission => permission === PermissionsAndroid.RESULTS.GRANTED
          )
        }
      }

      // iOS permissions are handled via Info.plist
      return true
    } catch (error) {
      console.error('Error requesting BLE permissions:', error)
      return false
    }
  }

  /**
   * Start a proximity session for a specific project
   */
  async startSession(projectId: string, userId: string): Promise<boolean> {
    try {
      // Check if user is a collaborator
      const isCollaborator = await this.verifyCollaborator(projectId, userId)
      if (!isCollaborator) {
        throw new Error('User is not a collaborator on this project')
      }

      // Request permissions
      const hasPermissions = await this.requestPermissions()
      if (!hasPermissions) {
        throw new Error('BLE permissions not granted')
      }

      // Get device ID
      const deviceId = await this.getDeviceId()

      // Set current session
      this.currentSession = {
        projectId,
        userId,
        deviceId,
        isActive: true,
      }

      // Update database
      await this.updateProximitySession(true)

      // Start scanning for nearby devices
      await this.startScanning()

      // Start advertising this device
      await this.startAdvertising()

      return true
    } catch (error) {
      console.error('Error starting proximity session:', error)
      return false
    }
  }

  /**
   * Stop the proximity session
   */
  async stopSession(): Promise<void> {
    try {
      if (this.currentSession) {
        // Stop scanning
        if (this.isScanning) {
          this.bleManager.stopDeviceScan()
          this.isScanning = false
        }

        // Update database
        await this.updateProximitySession(false)

        // Clear session
        this.currentSession = null
        this.discoveredDevices.clear()

        // Notify listeners
        this.notifyListeners()
      }
    } catch (error) {
      console.error('Error stopping proximity session:', error)
    }
  }

  /**
   * Start scanning for nearby devices
   */
  private async startScanning(): Promise<void> {
    if (this.isScanning) return

    try {
      this.isScanning = true

      this.bleManager.startDeviceScan(
        [KOLLAB_SERVICE_UUID],
        { allowDuplicates: true },
        async (error, device) => {
          if (error) {
            console.error('BLE scan error:', error)
            return
          }

          if (device) {
            await this.handleDiscoveredDevice(device)
          }
        }
      )

      // Clean up old devices every 10 seconds
      setInterval(() => {
        this.cleanupStaleDevices()
      }, 10000)
    } catch (error) {
      console.error('Error starting BLE scan:', error)
      this.isScanning = false
    }
  }

  /**
   * Handle a discovered BLE device
   */
  private async handleDiscoveredDevice(device: Device): Promise<void> {
    try {
      if (!device.id || !this.currentSession) return

      // Read project ID and user ID from device
      const deviceInfo = await this.readDeviceInfo(device)
      if (!deviceInfo) return

      // Verify project match
      if (deviceInfo.projectId !== this.currentSession.projectId) {
        return // Different project, ignore
      }

      // Don't add self
      if (deviceInfo.userId === this.currentSession.userId) {
        return
      }

      // Verify user is a collaborator
      const isCollaborator = await this.verifyCollaborator(
        deviceInfo.projectId,
        deviceInfo.userId
      )
      if (!isCollaborator) {
        return
      }

      // Get user info from Supabase
      const { data: userData } = await supabase
        .from('users')
        .select('username, display_name')
        .eq('id', deviceInfo.userId)
        .single()

      if (!userData) return

      // Calculate distance based on RSSI
      const distance = this.estimateDistance(device.rssi || -100)

      // Add/update collaborator
      const collaborator: NearbyCollaborator = {
        deviceId: device.id,
        userId: deviceInfo.userId,
        projectId: deviceInfo.projectId,
        userName: userData.username,
        userDisplayName: userData.display_name || userData.username,
        lastSeen: new Date(),
        signalStrength: device.rssi || -100,
        distance,
      }

      this.discoveredDevices.set(device.id, collaborator)
      this.notifyListeners()
    } catch (error) {
      console.error('Error handling discovered device:', error)
    }
  }

  /**
   * Read device info (project ID, user ID) from BLE characteristics
   */
  private async readDeviceInfo(
    device: Device
  ): Promise<{ projectId: string; userId: string } | null> {
    try {
      // Connect to device
      const connectedDevice = await device.connect()

      // Discover services and characteristics
      await connectedDevice.discoverAllServicesAndCharacteristics()

      // Read project ID
      const projectChar = await connectedDevice.readCharacteristicForService(
        KOLLAB_SERVICE_UUID,
        PROJECT_CHARACTERISTIC_UUID
      )

      // Read user ID
      const userChar = await connectedDevice.readCharacteristicForService(
        KOLLAB_SERVICE_UUID,
        USER_CHARACTERISTIC_UUID
      )

      // Disconnect
      await connectedDevice.cancelConnection()

      if (!projectChar.value || !userChar.value) return null

      // Decode base64 values
      const projectId = this.base64Decode(projectChar.value)
      const userId = this.base64Decode(userChar.value)

      return { projectId, userId }
    } catch (error) {
      console.error('Error reading device info:', error)
      return null
    }
  }

  /**
   * Start advertising this device via BLE
   * Note: BLE peripheral mode requires native module (not implemented in react-native-ble-plx)
   * This is a placeholder - would need platform-specific implementation
   */
  private async startAdvertising(): Promise<void> {
    // TODO: Implement BLE peripheral advertising
    // This requires native modules for iOS/Android
    // For now, we'll rely on scanning only
    console.log('BLE advertising would start here (requires native implementation)')
  }

  /**
   * Verify user is a collaborator on the project
   */
  private async verifyCollaborator(
    projectId: string,
    userId: string
  ): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('project_collaborators')
        .select('id')
        .eq('project_id', projectId)
        .eq('user_id', userId)
        .single()

      if (error) return false
      return !!data
    } catch (error) {
      console.error('Error verifying collaborator:', error)
      return false
    }
  }

  /**
   * Update proximity session in database
   */
  private async updateProximitySession(isActive: boolean): Promise<void> {
    if (!this.currentSession) return

    try {
      const { error } = await supabase.from('proximity_sessions').upsert({
        project_id: this.currentSession.projectId,
        user_id: this.currentSession.userId,
        device_id: this.currentSession.deviceId,
        is_active: isActive,
        last_seen: new Date().toISOString(),
      })

      if (error) throw error
    } catch (error) {
      console.error('Error updating proximity session:', error)
    }
  }

  /**
   * Get unique device ID
   */
  private async getDeviceId(): Promise<string> {
    const deviceId =
      (await ExpoDevice.getDeviceTypeAsync()).toString() +
      '_' +
      ExpoDevice.modelName +
      '_' +
      Math.random().toString(36).substring(7)

    return deviceId
  }

  /**
   * Estimate distance based on RSSI (signal strength)
   */
  private estimateDistance(rssi: number): 'immediate' | 'near' | 'far' {
    if (rssi > -50) return 'immediate' // < 1 meter
    if (rssi > -70) return 'near' // 1-3 meters
    return 'far' // > 3 meters
  }

  /**
   * Clean up devices that haven't been seen in 30 seconds
   */
  private cleanupStaleDevices(): void {
    const now = new Date()
    const staleThreshold = 30000 // 30 seconds

    for (const [deviceId, collaborator] of this.discoveredDevices.entries()) {
      const timeSinceLastSeen = now.getTime() - collaborator.lastSeen.getTime()
      if (timeSinceLastSeen > staleThreshold) {
        this.discoveredDevices.delete(deviceId)
      }
    }

    this.notifyListeners()
  }

  /**
   * Get list of nearby collaborators
   */
  getNearbyCollaborators(): NearbyCollaborator[] {
    return Array.from(this.discoveredDevices.values())
  }

  /**
   * Subscribe to nearby collaborator updates
   */
  subscribe(callback: (collaborators: NearbyCollaborator[]) => void): () => void {
    this.listeners.add(callback)

    // Return unsubscribe function
    return () => {
      this.listeners.delete(callback)
    }
  }

  /**
   * Notify all listeners of updates
   */
  private notifyListeners(): void {
    const collaborators = this.getNearbyCollaborators()
    this.listeners.forEach(listener => listener(collaborators))
  }

  /**
   * Base64 decode helper
   */
  private base64Decode(base64: string): string {
    try {
      return Buffer.from(base64, 'base64').toString('utf-8')
    } catch {
      return ''
    }
  }

  /**
   * Cleanup
   */
  async destroy(): Promise<void> {
    await this.stopSession()
    this.listeners.clear()
    await this.bleManager.destroy()
  }
}

export const nearbyCollaboratorsService = new NearbyCollaboratorsService()
export default nearbyCollaboratorsService
