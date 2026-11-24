/*
 * Runs after `npm install` / `npm ci` (package.json "postinstall").
 *
 * expo-modules-jsi compiles its Swift code in Swift 6 language mode, where data-race checks are
 * errors. With the Xcode 26.x releases on GitHub's macOS runners this stops the iOS build at
 *   JavaScriptObject.swift: error: sending 'slot' risks causing data races
 * The same check is a warning in Swift 5 language mode, so the package is switched to it. The code
 * and its behaviour are unchanged; only how strictly the compiler reports that diagnostic.
 *
 * Remove this once Expo ships a release that compiles cleanly with the runner's Xcode.
 */
const fs = require('fs');
const path = require('path');

const target = path.join(__dirname, '..', 'node_modules', 'expo-modules-jsi', 'apple', 'Package.swift');

if (!fs.existsSync(target)) {
  console.log('[patch-native] expo-modules-jsi not installed; nothing to patch');
  process.exit(0);
}

const source = fs.readFileSync(target, 'utf8');
if (source.includes('swiftLanguageModes: [.v5]')) {
  console.log('[patch-native] expo-modules-jsi already in Swift 5 language mode');
  process.exit(0);
}
if (!source.includes('swiftLanguageModes: [.v6]')) {
  console.log('[patch-native] expo-modules-jsi changed upstream; patch not applied (check the iOS build)');
  process.exit(0);
}

fs.writeFileSync(target, source.replace('swiftLanguageModes: [.v6]', 'swiftLanguageModes: [.v5]'));
console.log('[patch-native] expo-modules-jsi switched to Swift 5 language mode');
