import React, { useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import { Asset } from 'expo-asset';

interface BPMDetectorWebViewProps {
  onDetectionComplete: (bpm: number) => void;
  onError: (error: string) => void;
}

/**
 * Hidden WebView component for BPM detection
 * Uses Web Audio API to decode and analyze audio
 */
export const BPMDetectorWebView = React.forwardRef<any, BPMDetectorWebViewProps>(
  ({ onDetectionComplete, onError }, ref) => {
    const webViewRef = useRef<WebView>(null);
    const [isReady, setIsReady] = useState(false);

    // Expose detectBPM method to parent
    React.useImperativeHandle(ref, () => ({
      detectBPM: async (audioUrl: string) => {
        if (!isReady) {
          throw new Error('WebView not ready');
        }

        console.log('[BPM Detector] Sending detection request to WebView');

        webViewRef.current?.postMessage(JSON.stringify({
          action: 'detectBPM',
          audioUrl
        }));
      }
    }));

    const handleMessage = (event: any) => {
      try {
        const message = JSON.parse(event.nativeEvent.data);

        if (message.ready) {
          console.log('[BPM Detector] WebView is ready');
          setIsReady(true);
          return;
        }

        if (message.success) {
          console.log('[BPM Detector] Detection successful:', message.bpm, 'BPM');
          onDetectionComplete(message.bpm);
        } else {
          console.error('[BPM Detector] Detection failed:', message.error);
          onError(message.error);
        }
      } catch (error) {
        console.error('[BPM Detector] Message parsing error:', error);
        onError('Failed to parse WebView message');
      }
    };

    // Load HTML content
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>BPM Detector</title>
</head>
<body>
  <script>
    let audioContext = null;

    function getAudioContext() {
      if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
      }
      return audioContext;
    }

    async function detectBPM(audioUrl) {
      try {
        console.log('[BPM Detector] Starting detection');

        const ctx = getAudioContext();
        const response = await fetch(audioUrl);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await ctx.decodeAudioData(arrayBuffer);

        const samples = audioBuffer.getChannelData(0);
        const sampleRate = audioBuffer.sampleRate;

        const bpm = detectBPMFromSamples(samples, sampleRate);
        return bpm;
      } catch (error) {
        console.error('[BPM Detector] Error:', error);
        throw error;
      }
    }

    function detectBPMFromSamples(samples, sampleRate) {
      const hopSize = 512;
      const onsetEnvelope = calculateOnsetEnvelope(samples, hopSize);

      const minBPM = 60;
      const maxBPM = 200;
      const minLag = Math.floor((60 / maxBPM) * (sampleRate / hopSize));
      const maxLag = Math.floor((60 / minBPM) * (sampleRate / hopSize));

      const autocorr = autocorrelate(onsetEnvelope, minLag, maxLag);
      const peaks = findPeaks(autocorr, minLag);

      if (peaks.length === 0) return 120;

      const bestPeakLag = peaks[0].index + minLag;
      let bpm = (60 * (sampleRate / hopSize)) / bestPeakLag;

      // Pass all peaks for smarter double/half-time detection
      bpm = adjustBPMRange(bpm, peaks, minLag, sampleRate, hopSize);

      return Math.round(bpm);
    }

    function calculateOnsetEnvelope(audioData, hopSize) {
      const numFrames = Math.floor(audioData.length / hopSize);
      const envelope = new Float32Array(numFrames);

      let prevEnergy = 0;
      for (let i = 0; i < numFrames; i++) {
        const start = i * hopSize;
        const end = Math.min(start + hopSize, audioData.length);

        let energy = 0;
        for (let j = start; j < end; j++) {
          energy += audioData[j] * audioData[j];
        }
        energy = Math.sqrt(energy / (end - start));

        envelope[i] = Math.max(0, energy - prevEnergy);
        prevEnergy = energy;
      }

      return envelope;
    }

    function autocorrelate(data, minLag, maxLag) {
      const lagRange = maxLag - minLag;
      const result = new Float32Array(lagRange);

      for (let lag = 0; lag < lagRange; lag++) {
        const actualLag = lag + minLag;
        let sum = 0;
        let count = 0;

        for (let i = 0; i < data.length - actualLag; i++) {
          sum += data[i] * data[i + actualLag];
          count++;
        }

        result[lag] = sum / count;
      }

      const max = Math.max(...result);
      if (max > 0) {
        for (let i = 0; i < result.length; i++) {
          result[i] /= max;
        }
      }

      return result;
    }

    function findPeaks(data, minDistance) {
      const peaks = [];

      for (let i = 1; i < data.length - 1; i++) {
        if (data[i] > data[i - 1] && data[i] > data[i + 1]) {
          if (peaks.length === 0 || i - peaks[peaks.length - 1].index >= minDistance) {
            peaks.push({ index: i, value: data[i] });
          } else if (data[i] > peaks[peaks.length - 1].value) {
            peaks[peaks.length - 1] = { index: i, value: data[i] };
          }
        }
      }

      peaks.sort((a, b) => b.value - a.value);
      return peaks;
    }

    function adjustBPMRange(bpm, peaks, minLag, sampleRate, hopSize) {
      // Bring into 60-200 range
      while (bpm < 60) bpm *= 2;
      while (bpm > 200) bpm /= 2;

      // Check if there are alternative peaks that might indicate double/half time
      // Convert top peaks to BPM values
      const peakBPMs = peaks.slice(0, 5).map(peak => {
        const lag = peak.index + minLag;
        let tempBPM = (60 * (sampleRate / hopSize)) / lag;
        while (tempBPM < 60) tempBPM *= 2;
        while (tempBPM > 200) tempBPM /= 2;
        return { bpm: tempBPM, strength: peak.value };
      });

      // Check if double-time has a strong peak
      const doubleBPM = bpm * 2;
      if (bpm >= 60 && bpm < 80) {
        const hasDoublePeak = peakBPMs.some(p =>
          Math.abs(p.bpm - doubleBPM) < 3 && p.strength > 0.5
        );

        // Only double if there's evidence of double-time in the peaks
        // AND the doubled value is in a more common range
        if (hasDoublePeak && doubleBPM <= 180) {
          return doubleBPM;
        }

        // Otherwise trust the original detection
        return bpm;
      }

      // Check if half-time makes more sense for very fast tempos
      const halfBPM = bpm / 2;
      if (bpm > 180) {
        const hasHalfPeak = peakBPMs.some(p =>
          Math.abs(p.bpm - halfBPM) < 3 && p.strength > 0.5
        );

        if (hasHalfPeak && halfBPM >= 90) {
          return halfBPM;
        }

        return bpm;
      }

      return bpm;
    }

    window.addEventListener('message', async (event) => {
      try {
        const message = JSON.parse(event.data);

        if (message.action === 'detectBPM') {
          const bpm = await detectBPM(message.audioUrl);
          window.ReactNativeWebView.postMessage(JSON.stringify({
            success: true,
            bpm: bpm
          }));
        }
      } catch (error) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          success: false,
          error: error.message
        }));
      }
    });

    window.ReactNativeWebView.postMessage(JSON.stringify({ ready: true }));
  </script>
</body>
</html>
    `;

    return (
      <View style={styles.hidden}>
        <WebView
          ref={webViewRef}
          source={{ html: htmlContent }}
          onMessage={handleMessage}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          originWhitelist={['*']}
          mixedContentMode="always"
          allowFileAccess={true}
          allowUniversalAccessFromFileURLs={true}
        />
      </View>
    );
  }
);

const styles = StyleSheet.create({
  hidden: {
    width: 1,
    height: 1,
    opacity: 0,
    position: 'absolute',
    top: -100,
    left: -100,
    pointerEvents: 'none',
    overflow: 'hidden',
  },
});
