import { Directory, File, Paths } from 'expo-file-system';

/*
 * The learner's own recordings live in <documents>/recordings/<phraseId>.<ext> — inside the app
 * sandbox, never uploaded. Only the file name is persisted in state: the absolute documents path
 * changes between app updates on iOS, so the URI is rebuilt each time it is needed.
 */
const folder = () => {
  const dir = new Directory(Paths.document, 'recordings');
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  return dir;
};

export const PERSISTENT = true;

/** Moves a finished recording out of the cache into permanent storage. Returns the stored file name. */
export async function keepRecording(phraseId: string, tempUri: string): Promise<string> {
  const ext = (tempUri.split('?')[0].match(/\.(\w{2,5})$/)?.[1] ?? 'm4a').toLowerCase();
  const name = `${phraseId}.${ext}`;
  const dir = folder();
  for (const old of dir.list()) {
    if (old instanceof File && old.name.startsWith(phraseId + '.')) old.delete();
  }
  const temp = new File(tempUri);
  await temp.copy(new File(dir, name));
  try {
    temp.delete();
  } catch {
    // the cache copy is disposable; the system clears it anyway
  }
  return name;
}

export function recordingUri(fileName: string): string | null {
  const file = new File(folder(), fileName);
  return file.exists ? file.uri : null;
}

export function deleteRecording(fileName: string) {
  const file = new File(folder(), fileName);
  if (file.exists) file.delete();
}

export function deleteAllRecordings() {
  const dir = new Directory(Paths.document, 'recordings');
  if (dir.exists) dir.delete();
}

/** Total bytes used by saved recordings. */
export function recordingsSize(): number {
  const dir = new Directory(Paths.document, 'recordings');
  if (!dir.exists) return 0;
  return dir.list().reduce((sum, item) => sum + (item instanceof File ? item.size ?? 0 : 0), 0);
}
