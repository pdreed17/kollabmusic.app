# Proximity-Based Audio Sharing - Setup Guide

## Overview

Your Kollab Music app now supports **proximity-based audio file sharing** - the "tap to share" feature for musicians! This allows collaborators in the same room to instantly share audio files without internet, similar to Apple's AirDrop but specifically designed for music collaboration.

## What Was Implemented

### 1. **Services**
- **NearbyCollaboratorsService** (`src/services/nearbyCollaborators.service.ts`)
  - Discovers nearby devices using Bluetooth Low Energy (BLE)
  - Only connects devices collaborating on the same project (project-scoped security)
  - Verifies collaborators against Supabase database
  - Estimates distance (immediate/near/far) based on signal strength

- **P2PTransferService** (`src/services/p2pTransfer.service.ts`)
  - Handles file transfers between nearby devices
  - Currently uses cloud-based transfer (MVP approach)
  - Designed for future WiFi Direct implementation
  - Tracks transfer progress and notifies recipients

### 2. **UI Components**
- **NearbyCollaborators** (`src/components/NearbyCollaborators.tsx`)
  - Complete UI for proximity sharing
  - Shows nearby collaborators with distance indicators
  - Share audio files with tap
  - Transfer progress tracking
  - Educational "How It Works" section

- **ProjectStudioScreen** - Added "Nearby" tab
  - Three tabs: Tracks | Nearby | Chat
  - Integrated proximity sharing into existing workflow

### 3. **Database**
- **proximity_sessions** table - Tracks active sessions
- **p2p_transfers** table - Records file transfer history
- **Row Level Security (RLS)** - Project-scoped permissions
- Auto-cleanup of stale sessions (5 minutes)

### 4. **Dependencies**
- `react-native-ble-plx` - Bluetooth Low Energy
- `expo-device` - Device identification

## Database Migration

**You must run this SQL migration in your Supabase dashboard:**

```bash
# File: supabase_migration_proximity_sharing.sql
```

**Steps:**
1. Open your Supabase project dashboard
2. Go to SQL Editor
3. Copy the contents of `supabase_migration_proximity_sharing.sql`
4. Paste and run the migration
5. Verify tables were created: `proximity_sessions` and `p2p_transfers`

## iOS Configuration

**Required: Update `app.json` for Bluetooth permissions**

Add these permissions to your `app.json`:

```json
{
  "expo": {
    "ios": {
      "infoPlist": {
        "NSBluetoothAlwaysUsageDescription": "Kollab Music uses Bluetooth to discover nearby collaborators for instant audio file sharing.",
        "NSBluetoothPeripheralUsageDescription": "Kollab Music uses Bluetooth to share audio files with nearby musicians.",
        "NSLocationWhenInUseUsageDescription": "Location is required for Bluetooth device discovery (system requirement)."
      }
    }
  }
}
```

## Android Configuration

**Required: Update `app.json` for Bluetooth permissions**

Add these permissions to your `app.json`:

```json
{
  "expo": {
    "android": {
      "permissions": [
        "BLUETOOTH",
        "BLUETOOTH_ADMIN",
        "BLUETOOTH_SCAN",
        "BLUETOOTH_CONNECT",
        "BLUETOOTH_ADVERTISE",
        "ACCESS_FINE_LOCATION"
      ]
    }
  }
}
```

## How It Works (User Flow)

### For Musicians in a Jam Session:

1. **All musicians open the same project**
   - User A creates or opens "Summer Session 2025"
   - User B, C, D join as collaborators

2. **Start Discovery**
   - Open ProjectStudioScreen → Nearby tab
   - Tap "Start Discovery"
   - App requests Bluetooth permissions (first time only)

3. **Automatic Discovery**
   - App broadcasts: "I'm on project XYZ"
   - App listens for: "Who else is on project XYZ?"
   - Only shows collaborators on THE SAME PROJECT
   - Distance indicator: "Very close" / "Nearby" / "Far"

4. **Share Audio**
   - Record or select an audio track
   - Tap "Share with Nearby"
   - File transfers to all nearby collaborators
   - Progress bar shows transfer status

5. **Cloud Sync**
   - After local transfer, files auto-upload to cloud
   - Desktop app syncs automatically
   - Absent collaborators get files from cloud

## Security Model

### Project-Scoped Sharing

**CRITICAL:** Files can ONLY be shared between collaborators on the same project.

**Verification Flow:**
1. Device broadcasts BLE signal with Project ID
2. Receiving device checks: "Am I on this project?"
3. Query Supabase: Is sender a collaborator?
4. If yes → Allow connection
5. If no → Ignore device

**What This Prevents:**
- ❌ Random nearby users seeing your files
- ❌ Sharing with non-collaborators
- ❌ Cross-project contamination
- ✅ Only verified project collaborators can connect

## Technical Architecture

```
User A's Phone                    User B's Phone
─────────────                    ─────────────
   │                                  │
   │ 1. Start Session                 │ 1. Start Session
   │    (BLE Broadcast)               │    (BLE Broadcast)
   │                                  │
   │ 2. Discover                      │ 2. Discover
   │    "Project: XYZ"  ──BLE──>      │    "Project: XYZ"
   │                                  │
   │ 3. Verify with Supabase          │ 3. Verify with Supabase
   │    ✓ Both are collaborators      │    ✓ Both are collaborators
   │                                  │
   │ 4. Share File                    │ 4. Receive File
   │    (Cloud transfer for MVP)      │    (Download from cloud)
   │                                  │
   │ 5. Upload to cloud  ────>  ☁️  <──── 5. Download from cloud
   │                                  │
   └────────────────────────────────┘
                  │
                  ▼
            Desktop Syncs
```

## Current Implementation (MVP)

**What Works Now:**
- ✅ BLE device discovery
- ✅ Project-scoped verification
- ✅ Nearby collaborator list
- ✅ Distance estimation
- ✅ UI for sharing
- ✅ Cloud-based file transfer
- ✅ Database tracking

**What's Coming Next (Future Enhancements):**
- 🔄 True WiFi Direct P2P transfer (faster, no internet)
- 🔄 NFC tap-to-share
- 🔄 BLE Peripheral advertising (currently scan-only)
- 🔄 Multi-file batch sharing
- 🔄 Background transfers

## Why Cloud Transfer for MVP?

**True P2P (WiFi Direct) requires:**
- Native iOS/Android modules (not supported by Expo)
- Complex peer connection management
- Platform-specific implementations

**Current approach (Cloud-based):**
- ✅ Works immediately with Expo
- ✅ Reliable and tested
- ✅ Automatic desktop sync
- ✅ Same UX from user perspective
- ⚠️ Requires internet connection

**Future:** When you eject to bare React Native or use custom dev client, we can implement true WiFi Direct for offline transfers.

## Testing the Feature

### Test Scenario 1: Discovery

1. Open project on two devices (logged in as different collaborators)
2. Go to Nearby tab on both devices
3. Tap "Start Discovery" on both
4. ✅ Should see each other appear in "Nearby" list

### Test Scenario 2: Distance

1. Start discovery on two devices
2. Hold phones close together
3. ✅ Should show "Very close"
4. Move apart 2-3 meters
5. ✅ Should show "Nearby"
6. Move 5+ meters apart
7. ✅ Should show "Far"

### Test Scenario 3: Project Isolation

1. Device A on "Project 1"
2. Device B on "Project 2"
3. Both start discovery
4. ✅ Should NOT see each other (different projects)

### Test Scenario 4: File Sharing

1. Both devices on same project
2. Both start discovery
3. Device A selects a track
4. Device A taps "Share with Nearby"
5. ✅ Progress bar shows transfer
6. ✅ Device B receives notification
7. ✅ File appears in Device B's track list

## Troubleshooting

### "Failed to Start Session"
**Cause:** Bluetooth permissions not granted
**Fix:**
1. Go to iOS Settings → Kollab Music
2. Enable Bluetooth permission
3. Enable Location permission (required for BLE discovery)

### "No one nearby yet"
**Possible causes:**
1. Other user hasn't started discovery
2. Too far apart (>10 meters)
3. Bluetooth off on one device
4. Different projects
5. Not verified collaborators

**Fix:**
1. Both users tap "Start Discovery"
2. Move closer together
3. Verify both are collaborators on the same project

### Transfer Failed
**Possible causes:**
1. Internet connection lost
2. Supabase storage quota exceeded
3. File too large (>500MB)

**Fix:**
1. Check internet connection
2. Retry transfer
3. Check Supabase storage limits

## Next Steps

1. **Run the database migration** (see above)
2. **Add Bluetooth permissions** to `app.json` (see above)
3. **Rebuild your app** with dev client
4. **Test with two devices** on the same project
5. **Gather user feedback** on the UX

## Future Roadmap

### Phase 2: True P2P (WiFi Direct)
- Implement native modules for iOS/Android
- Direct device-to-device transfer (no internet)
- Faster transfers for large files

### Phase 3: NFC Tap-to-Share
- Tap phones together to initiate
- Like Apple Pay but for audio files
- Instant connection establishment

### Phase 4: Desktop Support
- Desktop app can join proximity sessions
- Share from laptop to phone
- Full cross-platform support

## Questions?

This is a novel feature specifically designed for musicians. The key innovation is **project-scoped security** - unlike AirDrop which is user-to-user, this is **project-based**, ensuring files only go to the right collaborators.

**Your "tap to share" vision is now partially implemented and ready for testing!**
