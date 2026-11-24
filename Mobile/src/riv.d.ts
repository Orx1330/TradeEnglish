// Bundled Rive files resolve to an asset id, like images (see metro.config.js).
declare module '*.riv' {
  const asset: number;
  export default asset;
}
