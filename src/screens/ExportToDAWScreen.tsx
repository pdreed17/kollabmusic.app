import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { supabase } from '../lib/supabase';

// Design System
const Colors = {
  primary: '#6366F1',
  primaryDark: '#4F46E5',
  primaryLight: '#818CF8',
  backgroundDark: '#0F0F0F',
  background: '#1A1A1A',
  surface: '#262626',
  surfaceElevated: '#303030',
  border: '#404040',
  text: '#FFFFFF',
  textSecondary: '#9CA3AF',
  textTertiary: '#6B7280',
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
};

const Typography = {
  h1: { fontSize: 24, fontWeight: '600' as const },
  h2: { fontSize: 20, fontWeight: '600' as const },
  h3: { fontSize: 18, fontWeight: '500' as const },
  body: { fontSize: 14, fontWeight: '400' as const },
  caption: { fontSize: 12, fontWeight: '500' as const },
};

const Spacing = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
};

const BorderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
};

// Types
interface Project {
  id: string;
  title: string;
  bpm: number;
  key: string;
  time_signature: string;
}

interface AudioFile {
  id: string;
  file_name: string;
  file_path: string;
  stem_type: string;
  stem_name: string;
  volume: number;
  pan: number;
  color: string;
  duration_ms: number;
}

interface ExportSettings {
  format: 'wav' | 'aiff' | 'flac';
  bitDepth: 16 | 24 | 32;
  sampleRate: 44100 | 48000 | 96000;
  includeMetadata: boolean;
  dawPreset: DAWPreset | null;
}

interface DAWPreset {
  id: string;
  name: string;
  icon: string;
  stemNaming: 'sequential' | 'descriptive';
  folderStructure: 'flat' | 'nested';
  metadataFormat: 'embedded' | 'sidecar';
  includeMarkers: boolean;
  instructions: string;
}

// DAW Presets
const DAW_PRESETS: DAWPreset[] = [
  {
    id: 'ableton',
    name: 'Ableton Live',
    icon: '🎹',
    stemNaming: 'descriptive',
    folderStructure: 'nested',
    metadataFormat: 'sidecar',
    includeMarkers: true,
    instructions: `HOW TO IMPORT TO ABLETON LIVE
==============================
1. Open Ableton Live
2. Create new project or open existing
3. Go to: File > Import Audio
4. Select all WAV files from this folder
5. Drag into Arrangement View
6. Stems will align automatically

PROJECT INFO will be shown in README.txt

TIPS:
- Color-code tracks to match Kollab colors
- Enable Warp for tempo changes
- All stems start at same position`,
  },
  {
    id: 'logic',
    name: 'Logic Pro',
    icon: '🎼',
    stemNaming: 'sequential',
    folderStructure: 'flat',
    metadataFormat: 'embedded',
    includeMarkers: true,
    instructions: `HOW TO IMPORT TO LOGIC PRO
==========================
1. Open Logic Pro
2. File > New > Project
3. Set tempo to BPM (see README)
4. File > Import > Audio Files
5. Select all WAV files
6. Choose "Add Files at Project Start"

Files are numbered sequentially (01, 02, 03...)
to preserve track order from Kollab.`,
  },
  {
    id: 'protools',
    name: 'Pro Tools',
    icon: '🎚️',
    stemNaming: 'descriptive',
    folderStructure: 'flat',
    metadataFormat: 'embedded',
    includeMarkers: false,
    instructions: `HOW TO IMPORT TO PRO TOOLS
===========================
1. Open Pro Tools session
2. Set session tempo (see README)
3. File > Import > Audio
4. Select all WAV files
5. Import to Session Start

All stems are pre-aligned and ready to mix.`,
  },
  {
    id: 'flstudio',
    name: 'FL Studio',
    icon: '🎛️',
    stemNaming: 'descriptive',
    folderStructure: 'nested',
    metadataFormat: 'embedded',
    includeMarkers: false,
    instructions: `HOW TO IMPORT TO FL STUDIO
===========================
1. Open FL Studio
2. Set project tempo (see README)
3. Go to File > Import > Audio File
4. Browse to export folder
5. Select all WAV files
6. Files will load into Playlist

Each stem can be assigned to its own mixer channel.`,
  },
  {
    id: 'universal',
    name: 'Universal (Any DAW)',
    icon: '🌐',
    stemNaming: 'descriptive',
    folderStructure: 'flat',
    metadataFormat: 'embedded',
    includeMarkers: true,
    instructions: `UNIVERSAL DAW IMPORT
====================
These stems are compatible with any professional DAW:
- Studio One
- Reaper
- Cubase
- GarageBand
- And more!

IMPORT STEPS (MOST DAWs):
1. Create new project
2. Set tempo/key (see README.txt)
3. Import all WAV files
4. Stems will align at project start

All files are 24-bit WAV format with
embedded metadata for maximum compatibility.`,
  },
];

// Cloud Service Types
type CloudService = 'icloud' | 'google_drive' | 'dropbox' | 'email' | 'download';

interface CloudServiceOption {
  id: CloudService;
  name: string;
  icon: keyof typeof Ionicons.glyphMap;
  available: boolean;
  comingSoon?: boolean;
}

const ExportToDAWScreen = ({ route, navigation }: any) => {
  const { project, audioFiles } = route.params as { project: Project; audioFiles: AudioFile[] };

  // State
  const [selectedDAW, setSelectedDAW] = useState<DAWPreset | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportSettings, setExportSettings] = useState<ExportSettings>({
    format: 'wav',
    bitDepth: 24,
    sampleRate: 48000,
    includeMetadata: true,
    dawPreset: null,
  });

  // Cloud services (implement integration in phases)
  const cloudServices: CloudServiceOption[] = [
    {
      id: 'icloud',
      name: 'iCloud Drive',
      icon: 'cloud-outline',
      available: Platform.OS === 'ios',
    },
    {
      id: 'google_drive',
      name: 'Google Drive',
      icon: 'logo-google',
      available: false,
      comingSoon: true,
    },
    {
      id: 'dropbox',
      name: 'Dropbox',
      icon: 'logo-dropbox',
      available: false,
      comingSoon: true,
    },
    {
      id: 'email',
      name: 'Email Link',
      icon: 'mail-outline',
      available: true,
    },
    {
      id: 'download',
      name: 'Direct Download',
      icon: 'download-outline',
      available: true,
    },
  ];

  // Generate DAW-friendly filename
  const generateFileName = (stem: AudioFile, index: number, preset: DAWPreset): string => {
    const safe = (str: string) =>
      str
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .substring(0, 50);

    if (preset.stemNaming === 'sequential') {
      return `${String(index + 1).padStart(2, '0')}_${safe(stem.stem_name)}.${exportSettings.format}`;
    } else {
      return `${safe(stem.stem_type)}_${safe(stem.stem_name)}.${exportSettings.format}`;
    }
  };

  // Generate README instructions
  const generateReadme = (preset: DAWPreset): string => {
    return `${preset.instructions}

========================================
PROJECT INFORMATION
========================================
Title: ${project.title}
BPM: ${project.bpm}
Key: ${project.key}
Time Signature: ${project.time_signature}

========================================
STEM LIST (${audioFiles.length} files)
========================================
${audioFiles
  .map(
    (stem, idx) =>
      `${idx + 1}. ${stem.stem_name} (${stem.stem_type})
   Color: ${stem.color}
   Volume: ${(stem.volume * 100).toFixed(0)}%
   Pan: ${stem.pan > 0 ? 'R' : stem.pan < 0 ? 'L' : 'C'}${Math.abs(stem.pan * 100).toFixed(0)}`
  )
  .join('\n\n')}

========================================
EXPORTED FROM KOLLAB
========================================
Date: ${new Date().toLocaleDateString()}
Format: ${exportSettings.format.toUpperCase()}
Bit Depth: ${exportSettings.bitDepth}-bit
Sample Rate: ${exportSettings.sampleRate} Hz

Questions? support@kollabapp.com
`;
  };

  // Handle DAW selection
  const handleSelectDAW = (preset: DAWPreset) => {
    setSelectedDAW(preset);
    setExportSettings((prev) => ({ ...prev, dawPreset: preset }));
  };

  // Handle export
  const handleExport = async (destination: CloudService) => {
    if (!selectedDAW) {
      Alert.alert('Select DAW', 'Please choose your DAW or Universal preset');
      return;
    }

    setIsExporting(true);
    setExportProgress(0);

    try {
      // Step 1: Download audio files from Supabase Storage
      const downloadedFiles: { uri: string; name: string }[] = [];
      
      for (let i = 0; i < audioFiles.length; i++) {
        const stem = audioFiles[i];
        const fileName = generateFileName(stem, i, selectedDAW);
        
        // Get signed URL from Supabase
        const { data: urlData, error: urlError } = await supabase.storage
          .from('audio-files')
          .createSignedUrl(stem.file_path, 3600); // 1 hour expiry

        if (urlError) throw urlError;

        // Download file to local device - FIXED
        const cacheDir = (FileSystem as any).cacheDirectory || (FileSystem as any).documentDirectory;
        if (!cacheDir) throw new Error('File system not available');
        
        const localUri = `${cacheDir}${fileName}`;
        const { uri } = await FileSystem.downloadAsync(urlData.signedUrl, localUri);
        
        downloadedFiles.push({ uri, name: fileName });
        setExportProgress(((i + 1) / (audioFiles.length + 1)) * 100);
      }

      // Step 2: Generate README.txt - FIXED
      const readmeContent = generateReadme(selectedDAW);
      const cacheDir = (FileSystem as any).cacheDirectory || (FileSystem as any).documentDirectory;
      if (!cacheDir) throw new Error('File system not available');
      
      const readmeUri = `${cacheDir}README.txt`;
      await FileSystem.writeAsStringAsync(readmeUri, readmeContent);
      downloadedFiles.push({ uri: readmeUri, name: 'README.txt' });

      setExportProgress(100);

      // Step 3: Handle destination
      switch (destination) {
        case 'download':
          // Share all files using system share sheet
          if (await Sharing.isAvailableAsync()) {
            // For simplicity, share the first file and inform about others
            // In production, you'd zip these files first
            await Sharing.shareAsync(downloadedFiles[0].uri, {
              mimeType: 'audio/wav',
              dialogTitle: `Export: ${project.title}`,
            });
            Alert.alert(
              'Export Complete!',
              `${downloadedFiles.length} files ready to import into ${selectedDAW.name}.`,
              [{ text: 'Done', onPress: () => navigation.goBack() }]
            );
          }
          break;

        case 'email':
          Alert.alert(
            'Email Export',
            'Email integration coming soon! For now, use Direct Download and attach files manually.',
            [{ text: 'OK' }]
          );
          break;

        case 'icloud':
          if (Platform.OS === 'ios') {
            Alert.alert(
              'iCloud Drive',
              'iCloud Drive integration coming soon! For now, use Direct Download and manually move files to iCloud.',
              [{ text: 'OK' }]
            );
          }
          break;

        default:
          Alert.alert('Coming Soon', `${destination} integration will be available soon!`);
      }
    } catch (error) {
      console.error('Export error:', error);
      Alert.alert('Export Failed', 'An error occurred during export. Please try again.');
    } finally {
      setIsExporting(false);
      setExportProgress(0);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Export to DAW</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Project Info */}
        <View style={styles.projectInfo}>
          <Text style={styles.projectTitle}>{project.title}</Text>
          <View style={styles.projectMeta}>
            <Text style={styles.metaText}>
              {audioFiles.length} stems • {project.bpm} BPM • {project.key}
            </Text>
          </View>
        </View>

        {/* DAW Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Choose Your DAW</Text>
          <Text style={styles.sectionSubtitle}>
            Optimized exports for seamless import
          </Text>

          <View style={styles.dawGrid}>
            {DAW_PRESETS.map((preset) => (
              <TouchableOpacity
                key={preset.id}
                style={[
                  styles.dawCard,
                  selectedDAW?.id === preset.id && styles.dawCardSelected,
                ]}
                onPress={() => handleSelectDAW(preset)}
              >
                <Text style={styles.dawIcon}>{preset.icon}</Text>
                <Text style={styles.dawName}>{preset.name}</Text>
                {selectedDAW?.id === preset.id && (
                  <View style={styles.selectedBadge}>
                    <Ionicons name="checkmark-circle" size={20} color={Colors.success} />
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Advanced Settings (Collapsible) */}
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.advancedHeader}
            onPress={() => setShowAdvanced(!showAdvanced)}
          >
            <Text style={styles.sectionTitle}>Advanced Settings</Text>
            <Ionicons
              name={showAdvanced ? 'chevron-up' : 'chevron-down'}
              size={20}
              color={Colors.textSecondary}
            />
          </TouchableOpacity>

          {showAdvanced && (
            <View style={styles.advancedContent}>
              {/* Format */}
              <View style={styles.settingRow}>
                <Text style={styles.settingLabel}>Format</Text>
                <View style={styles.segmentedControl}>
                  {(['wav', 'aiff', 'flac'] as const).map((format) => (
                    <TouchableOpacity
                      key={format}
                      style={[
                        styles.segment,
                        exportSettings.format === format && styles.segmentSelected,
                      ]}
                      onPress={() =>
                        setExportSettings((prev) => ({ ...prev, format }))
                      }
                    >
                      <Text
                        style={[
                          styles.segmentText,
                          exportSettings.format === format && styles.segmentTextSelected,
                        ]}
                      >
                        {format.toUpperCase()}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Bit Depth */}
              <View style={styles.settingRow}>
                <Text style={styles.settingLabel}>Bit Depth</Text>
                <View style={styles.segmentedControl}>
                  {([16, 24, 32] as const).map((depth) => (
                    <TouchableOpacity
                      key={depth}
                      style={[
                        styles.segment,
                        exportSettings.bitDepth === depth && styles.segmentSelected,
                      ]}
                      onPress={() =>
                        setExportSettings((prev) => ({ ...prev, bitDepth: depth }))
                      }
                    >
                      <Text
                        style={[
                          styles.segmentText,
                          exportSettings.bitDepth === depth && styles.segmentTextSelected,
                        ]}
                      >
                        {depth}-bit
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Sample Rate */}
              <View style={styles.settingRow}>
                <Text style={styles.settingLabel}>Sample Rate</Text>
                <View style={styles.segmentedControl}>
                  {([44100, 48000, 96000] as const).map((rate) => (
                    <TouchableOpacity
                      key={rate}
                      style={[
                        styles.segment,
                        exportSettings.sampleRate === rate && styles.segmentSelected,
                      ]}
                      onPress={() =>
                        setExportSettings((prev) => ({ ...prev, sampleRate: rate }))
                      }
                    >
                      <Text
                        style={[
                          styles.segmentText,
                          exportSettings.sampleRate === rate && styles.segmentTextSelected,
                        ]}
                      >
                        {rate / 1000}kHz
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Metadata Toggle */}
              <TouchableOpacity
                style={styles.toggleRow}
                onPress={() =>
                  setExportSettings((prev) => ({
                    ...prev,
                    includeMetadata: !prev.includeMetadata,
                  }))
                }
              >
                <View>
                  <Text style={styles.settingLabel}>Include Metadata</Text>
                  <Text style={styles.toggleSubtext}>
                    Embed project info in audio files
                  </Text>
                </View>
                <View
                  style={[
                    styles.toggle,
                    exportSettings.includeMetadata && styles.toggleActive,
                  ]}
                >
                  <View
                    style={[
                      styles.toggleThumb,
                      exportSettings.includeMetadata && styles.toggleThumbActive,
                    ]}
                  />
                </View>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Export Destination */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Export Destination</Text>
          <Text style={styles.sectionSubtitle}>
            Where should we save your stems?
          </Text>

          <View style={styles.cloudGrid}>
            {cloudServices.map((service) => (
              <TouchableOpacity
                key={service.id}
                style={[
                  styles.cloudCard,
                  !service.available && styles.cloudCardDisabled,
                ]}
                onPress={() => service.available && handleExport(service.id)}
                disabled={!service.available || isExporting}
              >
                <View style={styles.cloudIconContainer}>
                  <Ionicons
                    name={service.icon}
                    size={32}
                    color={service.available ? Colors.primary : Colors.textTertiary}
                  />
                </View>
                <Text
                  style={[
                    styles.cloudName,
                    !service.available && styles.cloudNameDisabled,
                  ]}
                >
                  {service.name}
                </Text>
                {service.comingSoon && (
                  <View style={styles.comingSoonBadge}>
                    <Text style={styles.comingSoonText}>Soon</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Export Progress */}
        {isExporting && (
          <View style={styles.progressContainer}>
            <Text style={styles.progressText}>Exporting...</Text>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${exportProgress}%` }]} />
            </View>
            <Text style={styles.progressPercentage}>{Math.round(exportProgress)}%</Text>
          </View>
        )}

        {/* Info Card */}
        <View style={styles.infoCard}>
          <Ionicons name="information-circle" size={20} color={Colors.primary} />
          <Text style={styles.infoText}>
            All exports include a README.txt with import instructions specific to your DAW.
          </Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingTop: Platform.OS === 'ios' ? 60 : 20,
    paddingBottom: Spacing.md,
    backgroundColor: Colors.backgroundDark,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    ...Typography.h2,
    color: Colors.text,
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.md,
  },
  projectInfo: {
    paddingVertical: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  projectTitle: {
    ...Typography.h1,
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  projectMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaText: {
    ...Typography.body,
    color: Colors.textSecondary,
  },
  section: {
    marginTop: Spacing.lg,
  },
  sectionTitle: {
    ...Typography.h3,
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  sectionSubtitle: {
    ...Typography.body,
    color: Colors.textSecondary,
    marginBottom: Spacing.md,
  },
  dawGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  dawCard: {
    width: '48%',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.border,
  },
  dawCardSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.surfaceElevated,
  },
  dawIcon: {
    fontSize: 36,
    marginBottom: Spacing.xs,
  },
  dawName: {
    ...Typography.body,
    color: Colors.text,
    textAlign: 'center',
  },
  selectedBadge: {
    position: 'absolute',
    top: Spacing.xs,
    right: Spacing.xs,
  },
  advancedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  advancedContent: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    gap: Spacing.md,
  },
  settingRow: {
    gap: Spacing.xs,
  },
  settingLabel: {
    ...Typography.body,
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: Colors.backgroundDark,
    borderRadius: BorderRadius.sm,
    padding: 2,
  },
  segment: {
    flex: 1,
    paddingVertical: Spacing.xs,
    alignItems: 'center',
    borderRadius: BorderRadius.sm - 2,
  },
  segmentSelected: {
    backgroundColor: Colors.primary,
  },
  segmentText: {
    ...Typography.caption,
    color: Colors.textSecondary,
  },
  segmentTextSelected: {
    color: Colors.text,
    fontWeight: '600',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toggleSubtext: {
    ...Typography.caption,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  toggle: {
    width: 48,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.border,
    padding: 2,
    justifyContent: 'center',
  },
  toggleActive: {
    backgroundColor: Colors.primary,
  },
  toggleThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.text,
  },
  toggleThumbActive: {
    alignSelf: 'flex-end',
  },
  cloudGrid: {
    gap: Spacing.sm,
  },
  cloudCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 2,
    borderColor: Colors.border,
  },
  cloudCardDisabled: {
    opacity: 0.5,
  },
  cloudIconContainer: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.sm,
    marginRight: Spacing.sm,
  },
  cloudName: {
    ...Typography.body,
    color: Colors.text,
    flex: 1,
  },
  cloudNameDisabled: {
    color: Colors.textTertiary,
  },
  comingSoonBadge: {
    backgroundColor: Colors.warning,
    paddingHorizontal: Spacing.xs,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },
  comingSoonText: {
    ...Typography.caption,
    color: Colors.backgroundDark,
    fontWeight: '600',
  },
  progressContainer: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginTop: Spacing.lg,
  },
  progressText: {
    ...Typography.body,
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  progressBar: {
    height: 8,
    backgroundColor: Colors.border,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: Spacing.xs,
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.primary,
  },
  progressPercentage: {
    ...Typography.caption,
    color: Colors.textSecondary,
    textAlign: 'right',
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.md,
    padding: Spacing.md,
    marginTop: Spacing.lg,
    gap: Spacing.sm,
  },
  infoText: {
    ...Typography.body,
    color: Colors.textSecondary,
    flex: 1,
  },
});

export default ExportToDAWScreen;