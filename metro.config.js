const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Add WASM support
config.resolver.assetExts.push('wasm');

// Ensure .js files from essentia.js are processed
config.resolver.sourceExts = [...config.resolver.sourceExts, 'cjs'];

module.exports = config;
