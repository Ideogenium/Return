/** Size returned for a file the test did not set: a small photo, under every upload limit. */
const DEFAULT_FILE_SIZE = 300 * 1024;

const fileSizes = new Map<string, number>();

/** Sets the size `new File(uri).size` reports for `uri`, until resetFileSizes(). */
export function setFileSize(uri: string, size: number): void {
  fileSizes.set(uri, size);
}

export function resetFileSizes(): void {
  fileSizes.clear();
}

/** Called with the URI of every deleted file. */
export const deletedFiles = jest.fn();

export class File {
  readonly uri: string;

  constructor(uri: string) {
    this.uri = uri;
  }

  get size(): number {
    return fileSizes.get(this.uri) ?? DEFAULT_FILE_SIZE;
  }

  delete(): void {
    deletedFiles(this.uri);
  }
}
