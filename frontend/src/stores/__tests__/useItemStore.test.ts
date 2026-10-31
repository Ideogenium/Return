import { http, HttpResponse } from 'msw';
import { server } from '../../../__mocks__/server';
import { useItemStore } from '../useItemStore';
import apiClient, { UPLOAD_TIMEOUT_MS } from '../../api/apiClient';

const API_BASE = 'http://localhost:3000/v1';

beforeAll(() => server.listen());
afterEach(() => {
  server.resetHandlers();
  useItemStore.getState().reset();
});
afterAll(() => server.close());

describe('useItemStore', () => {
  describe('fetchItems', () => {
    it('should fetch and store items list', async () => {
      await useItemStore.getState().fetchItems();

      const state = useItemStore.getState();
      expect(state.items).toHaveLength(1);
      expect(state.items[0]!.name).toBe('Perceuse Bosch');
      expect(state.items[0]!.category).toBe('TOOLS');
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('should set error on fetch failure', async () => {
      server.use(
        http.get(`${API_BASE}/items`, () => {
          return HttpResponse.json(
            {
              type: 'https://api.return.app/errors/network-error',
              title: 'Server Error',
              status: 500,
              detail: 'Internal server error.',
              instance: '/items',
              timestamp: '2026-02-25T10:00:00Z',
              requestId: 'req-mock',
            },
            { status: 500 },
          );
        }),
      );

      await expect(useItemStore.getState().fetchItems()).rejects.toThrow();

      const state = useItemStore.getState();
      expect(state.items).toHaveLength(0);
      expect(state.isLoading).toBe(false);
      expect(state.error).not.toBeNull();
    });
  });

  describe('fetchItem', () => {
    it('should fetch and store a single item', async () => {
      await useItemStore.getState().fetchItem('9a1b2c3d-4e5f-6a7b-8c9d-0e1f2a3b4c5d');

      const state = useItemStore.getState();
      expect(state.selectedItem).not.toBeNull();
      expect(state.selectedItem?.name).toBe('Perceuse Bosch');
      expect(state.isLoading).toBe(false);
    });

    it('should set error on 404', async () => {
      await expect(useItemStore.getState().fetchItem('not-found')).rejects.toThrow();

      const state = useItemStore.getState();
      expect(state.selectedItem).toBeNull();
      expect(state.error?.status).toBe(404);
      expect(state.isLoading).toBe(false);
    });
  });

  describe('createItem', () => {
    it('should create and add item to list', async () => {
      const newItem = await useItemStore.getState().createItem({
        name: 'Tondeuse',
        category: 'GARDEN',
        description: 'Tondeuse thermique',
      });

      expect(newItem.name).toBe('Tondeuse');
      expect(newItem.category).toBe('GARDEN');

      const state = useItemStore.getState();
      expect(state.items).toHaveLength(1);
      expect(state.isLoading).toBe(false);
    });
  });

  describe('updateItem', () => {
    it('should update item in list', async () => {
      await useItemStore.getState().fetchItems();

      const itemId = useItemStore.getState().items[0]!.id;
      const updated = await useItemStore.getState().updateItem(itemId, {
        name: 'Perceuse Bosch Pro',
      });

      expect(updated.name).toBe('Perceuse Bosch Pro');

      const state = useItemStore.getState();
      expect(state.items[0]!.name).toBe('Perceuse Bosch Pro');
      expect(state.isLoading).toBe(false);
    });
  });

  describe('deleteItem', () => {
    it('should remove item from list', async () => {
      await useItemStore.getState().fetchItems();
      expect(useItemStore.getState().items).toHaveLength(1);

      const itemId = useItemStore.getState().items[0]!.id;
      await useItemStore.getState().deleteItem(itemId);

      const state = useItemStore.getState();
      expect(state.items).toHaveLength(0);
      expect(state.isLoading).toBe(false);
    });

    it('should set error on 409 (item currently loaned)', async () => {
      server.use(
        http.delete(`${API_BASE}/items/:itemId`, () => {
          return HttpResponse.json(
            {
              type: 'https://api.return.app/errors/item-currently-loaned',
              title: 'Item Currently Loaned',
              status: 409,
              detail: 'Cannot delete item while it is loaned.',
              instance: '/items/some-id',
              timestamp: '2026-02-25T10:00:00Z',
              requestId: 'req-mock',
            },
            { status: 409 },
          );
        }),
      );

      await expect(useItemStore.getState().deleteItem('some-id')).rejects.toThrow();

      const state = useItemStore.getState();
      expect(state.error?.status).toBe(409);
      expect(state.isLoading).toBe(false);
    });
  });

  describe('deletePhoto', () => {
    it('should remove photo from item', async () => {
      await useItemStore.getState().fetchItems();

      const item = useItemStore.getState().items[0]!;
      const photoId = item.photos![0]!.id;

      await useItemStore.getState().deletePhoto(item.id, photoId);

      const state = useItemStore.getState();
      expect(state.items[0]!.photos).toHaveLength(0);
    });

    it('should set error on 404 (photo not found)', async () => {
      server.use(
        http.delete(`${API_BASE}/items/:itemId/photos/:photoId`, () => {
          return HttpResponse.json(
            {
              type: 'https://api.return.app/errors/photo-not-found',
              title: 'Photo Not Found',
              status: 404,
              detail: 'Photo not found.',
              instance: '/items/some-id/photos/bad-id',
              timestamp: '2026-02-25T10:00:00Z',
              requestId: 'req-mock',
            },
            { status: 404 },
          );
        }),
      );

      await expect(useItemStore.getState().deletePhoto('some-id', 'bad-id')).rejects.toThrow();

      const state = useItemStore.getState();
      expect(state.error?.status).toBe(404);
    });
  });

  describe('uploadPhoto', () => {
    it('should add photo to item', async () => {
      await useItemStore.getState().fetchItems();

      const itemId = useItemStore.getState().items[0]!.id;
      const formData = new FormData();
      const photo = await useItemStore.getState().uploadPhoto(itemId, formData);

      expect(photo.id).toBe('p-new-photo-id');
      expect(photo.url).toBeTruthy();

      const state = useItemStore.getState();
      expect(state.items[0]!.photos).toHaveLength(2);
    });

    it('gives the upload the photo timeout, not the default one', async () => {
      await useItemStore.getState().fetchItems();
      const post = jest.spyOn(apiClient, 'post');

      await useItemStore
        .getState()
        .uploadPhoto(useItemStore.getState().items[0]!.id, new FormData());

      expect(post.mock.calls[0]?.[2]).toEqual(
        expect.objectContaining({ timeout: UPLOAD_TIMEOUT_MS }),
      );
      post.mockRestore();
    });

    it('should set error on 400 (max photos exceeded)', async () => {
      server.use(
        http.post(`${API_BASE}/items/:itemId/photos`, () => {
          return HttpResponse.json(
            {
              type: 'https://api.return.app/errors/max-photos-exceeded',
              title: 'Max Photos Exceeded',
              status: 400,
              detail: 'Maximum of 5 photos per item.',
              instance: '/items/some-id/photos',
              timestamp: '2026-02-25T10:00:00Z',
              requestId: 'req-mock',
            },
            { status: 400 },
          );
        }),
      );

      const formData = new FormData();
      await expect(useItemStore.getState().uploadPhoto('some-id', formData)).rejects.toThrow();

      const state = useItemStore.getState();
      expect(state.error?.status).toBe(400);
    });
  });
});
