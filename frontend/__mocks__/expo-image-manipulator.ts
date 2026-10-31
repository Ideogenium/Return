export const SaveFormat = {
  JPEG: 'jpeg',
  PNG: 'png',
  WEBP: 'webp',
};

/** URI of the JPEG the mock "renders" for a picked image: same base name, .jpg, in a cache folder. */
export function normalizedUri(uri: string): string {
  const baseName =
    uri
      .split('/')
      .pop()
      ?.replace(/\.[^.]+$/, '') ?? 'photo';
  return `file:///tmp/manipulated/${baseName}.jpg`;
}

function createContext(uri: string) {
  const image = {
    width: 0,
    height: 0,
    saveAsync: jest.fn().mockResolvedValue({ uri: normalizedUri(uri), width: 0, height: 0 }),
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
