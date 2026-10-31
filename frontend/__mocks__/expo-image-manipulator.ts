export const SaveFormat = {
  JPEG: 'jpeg',
  PNG: 'png',
  WEBP: 'webp',
};

/**
 * URI of the file the mock "renders" for a picked image: same base name, in a cache folder,
 * with the extension of the saved format (.jpg by default, .png for SaveFormat.PNG).
 */
export function normalizedUri(uri: string, extension: 'jpg' | 'png' = 'jpg'): string {
  const baseName =
    uri
      .split('/')
      .pop()
      ?.replace(/\.[^.]+$/, '') ?? 'photo';
  return `file:///tmp/manipulated/${baseName}.${extension}`;
}

function createContext(uri: string) {
  const image = {
    width: 0,
    height: 0,
    saveAsync: jest.fn(async (options?: { format?: string }) => ({
      uri: normalizedUri(uri, options?.format === SaveFormat.PNG ? 'png' : 'jpg'),
      width: 0,
      height: 0,
    })),
    release: jest.fn(),
  };
  const context = {
    resize: jest.fn(),
    renderAsync: jest.fn().mockResolvedValue(image),
    release: jest.fn(),
    image,
  };
  context.resize.mockReturnValue(context);
  return context;
}

export const ImageManipulator = {
  manipulate: jest.fn((uri: string) => createContext(uri)),
};
