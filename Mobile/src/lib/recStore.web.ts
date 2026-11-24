/*
 * Browser preview only: there is no app sandbox, so recordings stay in memory as blob URLs for
 * the current tab. The iOS and Android builds use recStore.ts, which writes real files.
 */
const blobs = new Map<string, { uri: string; size: number }>();

export const PERSISTENT = false;

export async function keepRecording(phraseId: string, tempUri: string): Promise<string> {
  const name = `${phraseId}.webm`;
  let size = 0;
  try {
    size = (await (await fetch(tempUri)).blob()).size;
  } catch {
    size = 0;
  }
  blobs.set(name, { uri: tempUri, size });
  return name;
}

export function recordingUri(fileName: string): string | null {
  return blobs.get(fileName)?.uri ?? null;
}

export function deleteRecording(fileName: string) {
  blobs.delete(fileName);
}

export function deleteAllRecordings() {
  blobs.clear();
}

export function recordingsSize(): number {
  let sum = 0;
  blobs.forEach((b) => (sum += b.size));
  return sum;
}
