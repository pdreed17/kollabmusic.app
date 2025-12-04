import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { detectBPM, detectBPMDetailed } from '../services/bpmDetector';

/**
 * Example component demonstrating BPM detection usage
 */
export default function BPMDetectorExample() {
  const [bpm, setBpm] = useState<number | null>(null);
  const [isDetecting, setIsDetecting] = useState(false);
  const [fileName, setFileName] = useState<string>('');
  const [detectionMethod, setDetectionMethod] = useState<string>('');

  const handlePickAudio = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['audio/*', 'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/m4a'],
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        return;
      }

      const file = result.assets[0];
      setFileName(file.name);
      setBpm(null);
      setDetectionMethod('');

      await performBPMDetection(file.uri);
    } catch (error) {
      console.error('Error picking audio:', error);
      Alert.alert('Error', 'Failed to pick audio file');
    }
  };

  const performBPMDetection = async (fileUri: string) => {
    try {
      setIsDetecting(true);
      console.log('Starting BPM detection for:', fileUri);

      const startTime = Date.now();

      // Use detailed detection to get method info
      const result = await detectBPMDetailed(fileUri);

      const endTime = Date.now();
      const duration = ((endTime - startTime) / 1000).toFixed(2);

      console.log(`BPM detection completed in ${duration}s`);

      setBpm(Math.round(result.bpm));
      setDetectionMethod(`${result.method} (confidence: ${(result.confidence * 100).toFixed(1)}%)`);

      Alert.alert(
        'BPM Detected',
        `${Math.round(result.bpm)} BPM\nMethod: ${result.method}\nTime: ${duration}s`
      );
    } catch (error) {
      console.error('BPM detection failed:', error);
      Alert.alert(
        'Detection Failed',
        error instanceof Error ? error.message : 'Unknown error occurred'
      );
    } finally {
      setIsDetecting(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Offline BPM Detector</Text>

      <TouchableOpacity style={styles.button} onPress={handlePickAudio} disabled={isDetecting}>
        <Text style={styles.buttonText}>Pick Audio File</Text>
      </TouchableOpacity>

      {fileName ? (
        <View style={styles.fileInfo}>
          <Text style={styles.fileName}>{fileName}</Text>
        </View>
      ) : null}

      {isDetecting && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Detecting BPM...</Text>
        </View>
      )}

      {bpm !== null && !isDetecting && (
        <View style={styles.resultContainer}>
          <Text style={styles.bpmLabel}>Detected BPM:</Text>
          <Text style={styles.bpmValue}>{bpm}</Text>
          {detectionMethod && <Text style={styles.methodText}>{detectionMethod}</Text>}
        </View>
      )}

      <View style={styles.infoContainer}>
        <Text style={styles.infoText}>
          • Fully offline BPM detection{'\n'}
          • Supports MP3, WAV, M4A{'\n'}
          • Accurate for full songs{'\n'}
          • No server calls required
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 30,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 20,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  fileInfo: {
    backgroundColor: '#f0f0f0',
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
  },
  fileName: {
    fontSize: 14,
    color: '#333',
  },
  loadingContainer: {
    alignItems: 'center',
    marginVertical: 30,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  resultContainer: {
    alignItems: 'center',
    backgroundColor: '#e8f5e9',
    padding: 30,
    borderRadius: 15,
    marginVertical: 20,
  },
  bpmLabel: {
    fontSize: 18,
    color: '#666',
    marginBottom: 10,
  },
  bpmValue: {
    fontSize: 64,
    fontWeight: 'bold',
    color: '#2e7d32',
  },
  methodText: {
    marginTop: 10,
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
  },
  infoContainer: {
    marginTop: 'auto',
    backgroundColor: '#f5f5f5',
    padding: 15,
    borderRadius: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 22,
  },
});
