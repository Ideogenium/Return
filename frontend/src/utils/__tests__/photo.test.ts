import { buildPhotoFormData } from '../photo';

/**
 * Jest runs on Node's FormData, which turns the React Native file part ({ uri, type, name })
 * into a string: the part is read from the append call instead.
 */
async function appendedPart(uri: string, fieldName?: string) {
  const append = jest.spyOn(FormData.prototype, 'append');
  try {
    await buildPhotoFormData(uri, fieldName);
    expect(append).toHaveBeenCalledTimes(1);
    const [name, part] = append.mock.calls[0]!;
    return { fieldName: name, part };
  } finally {
    append.mockRestore();
  }
}

describe('buildPhotoFormData', () => {
  it('sends a converted JPEG as image/jpeg named photo.jpg', async () => {
    expect(await appendedPart('file:///tmp/manipulated/IMG_0001.jpg')).toEqual({
      fieldName: 'photo',
      part: { uri: 'file:///tmp/manipulated/IMG_0001.jpg', type: 'image/jpeg', name: 'photo.jpg' },
    });
  });

  it('sends a converted PNG as image/png named photo.png', async () => {
    expect(await appendedPart('file:///tmp/manipulated/cutout.png', 'avatar')).toEqual({
      fieldName: 'avatar',
      part: { uri: 'file:///tmp/manipulated/cutout.png', type: 'image/png', name: 'photo.png' },
    });
  });
});
