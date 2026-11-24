/*
 * Expo config plugin: run @rive-app/react-native on its legacy runtime backend.
 *
 * Laith's state machine is driven by state-machine inputs (number `mood`, triggers `pat`, `tail`,
 * `book`). The library's default "experimental" backend does not implement inputs at all — on both
 * platforms setNumberInputValue / triggerInput only throw "SMI inputs not supported" — so the
 * character drew and idled but never reacted. The legacy backend supports them.
 *
 *   Android: gradle property USE_RIVE_LEGACY=true   (read by the library's build.gradle)
 *   iOS:     `$UseRiveLegacy = true` in the Podfile  (read by RNRive.podspec)
 */
const { withGradleProperties, withPodfile } = require('expo/config-plugins');

const MARK = '# @generated withRiveLegacy';

module.exports = function withRiveLegacy(config) {
  config = withGradleProperties(config, (cfg) => {
    cfg.modResults = cfg.modResults.filter((item) => !(item.type === 'property' && item.key === 'USE_RIVE_LEGACY'));
    cfg.modResults.push({ type: 'property', key: 'USE_RIVE_LEGACY', value: 'true' });
    return cfg;
  });

  config = withPodfile(config, (cfg) => {
    if (!cfg.modResults.contents.includes(MARK)) {
      cfg.modResults.contents = `${MARK}\n$UseRiveLegacy = true\n\n` + cfg.modResults.contents;
    }
    return cfg;
  });

  return config;
};
