/** Size returned for a file the test did not set: a small photo, under every upload limit. */
const DEFAULT_FILE_SIZE = 300 * 1024;

/**
 * What `size` does for a URI: a number (or null, as Android may report), or an Error it throws
 * (as iOS may do when the file cannot be read).
 */
type SizeBehaviour = number | null | Error;

const fileSizes = new Map<string, SizeBehaviour>();
const deleteErrors = new Map<string, Error>();
let constructorError: Error | null = null;

/** Sets what `new File(uri).size` reports for `uri`, until resetFileSystemMock(). */
export function setFileSize(uri: string, size: SizeBehaviour): void {
  fileSizes.set(uri, size);
}

/** Makes `delete()` throw for `uri` (e.g. the file does not exist). */
export function setDeleteError(uri: string, error = new Error('File does not exist')): void {
  deleteErrors.set(uri, error);
}

/** Makes `new File()` throw, as the expo-file-system web stub does. */
export function setFileConstructorError(error = new Error('validatePath is not a function')): void {
  constructorError = error;
}

export function resetFileSystemMock(): void {
  fileSizes.clear();
  deleteErrors.clear();
  constructorError = null;
}

/** Called with the URI of every deleted file. */
export const deletedFiles = jest.fn();

export class File {
  readonly uri: string;

  constructor(uri: string) {
    if (constructorError) throw constructorError;
    this.uri = uri;
  }

  get size(): number | null {
    const size = fileSizes.has(this.uri) ? fileSizes.get(this.uri)! : DEFAULT_FILE_SIZE;
    if (size instanceof Error) throw size;
    return size;
  }

  delete(): void {
    const error = deleteErrors.get(this.uri);
    if (error) throw error;
    deletedFiles(this.uri);
  }
}
