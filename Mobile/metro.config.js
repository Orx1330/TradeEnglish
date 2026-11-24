const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Rive: the character file (.riv) and the web runtime's WebAssembly module are bundled as assets,
// so the mascot works offline like everything else in the app.
for (const ext of ['riv', 'wasm']) {
  if (!config.resolver.assetExts.includes(ext)) config.resolver.assetExts.push(ext);
}

module.exports = config;
