import { create } from 'zustand';
import apiClient, { UPLOAD_TIMEOUT_MS } from '../api/apiClient';
import { extractProblemDetails } from '../utils/error';
import type {
  Item,
  Photo,
  CreateItemDto,
  UpdateItemDto,
  PaginatedResponse,
  ProblemDetails,
  ItemCategory,
} from '../types/api.types';

interface FetchItemsParams {
  page?: number;
  category?: ItemCategory;
  available?: boolean;
}

interface ItemState {
  items: Item[];
  selectedItem: Item | null;
  isLoading: boolean;
  error: ProblemDetails | null;

  fetchItems: (params?: FetchItemsParams) => Promise<void>;
  fetchItem: (id: string) => Promise<void>;
  createItem: (data: CreateItemDto) => Promise<Item>;
  updateItem: (id: string, data: UpdateItemDto) => Promise<Item>;
  deleteItem: (id: string) => Promise<void>;
  uploadPhoto: (itemId: string, formData: FormData) => Promise<Photo>;
  deletePhoto: (itemId: string, photoId: string) => Promise<void>;
  reset: () => void;
}

const initialState = {
  items: [],
  selectedItem: null,
  isLoading: false,
  error: null,
};

export const useItemStore = create<ItemState>((set) => ({
  ...initialState,

  fetchItems: async (params) => {
    set({ isLoading: true, error: null });
    try {
      const { data } = await apiClient.get<PaginatedResponse<Item>>('/items', {
        params: {
          page: params?.page ?? 1,
          limit: 20,
          ...(params?.category && { category: params.category }),
          ...(params?.available !== undefined && { available: params.available }),
        },
      });
      set({ items: data.data, isLoading: false });
    } catch (err) {
      set({ isLoading: false, error: extractProblemDetails(err) });
      throw err;
    }
  },

  fetchItem: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const { data } = await apiClient.get<Item>(`/items/${id}`);
      set({ selectedItem: data, isLoading: false });
    } catch (err) {
      set({ isLoading: false, error: extractProblemDetails(err) });
      throw err;
    }
  },

  createItem: async (data) => {
    set({ isLoading: true, error: null });
    try {
      const { data: newItem } = await apiClient.post<Item>('/items', data);
      set((state) => ({
        items: [...state.items, newItem],
        isLoading: false,
      }));
      return newItem;
    } catch (err) {
      set({ isLoading: false, error: extractProblemDetails(err) });
      throw err;
    }
  },

  updateItem: async (id, data) => {
    set({ isLoading: true, error: null });
    try {
      const { data: updated } = await apiClient.patch<Item>(`/items/${id}`, data);
      set((state) => ({
        items: state.items.map((i) => (i.id === id ? updated : i)),
        selectedItem: state.selectedItem?.id === id ? updated : state.selectedItem,
        isLoading: false,
      }));
      return updated;
    } catch (err) {
      set({ isLoading: false, error: extractProblemDetails(err) });
      throw err;
    }
  },

  deleteItem: async (id) => {
    set({ isLoading: true, error: null });
    try {
      await apiClient.delete(`/items/${id}`);
      set((state) => ({
        items: state.items.filter((i) => i.id !== id),
        selectedItem: state.selectedItem?.id === id ? null : state.selectedItem,
        isLoading: false,
      }));
    } catch (err) {
      set({ isLoading: false, error: extractProblemDetails(err) });
      throw err;
    }
  },

  uploadPhoto: async (itemId, formData) => {
    set({ error: null });
    try {
      const { data: photo } = await apiClient.post<Photo>(`/items/${itemId}/photos`, formData, {
        headers: { 'Content-Type': undefined },
        timeout: UPLOAD_TIMEOUT_MS,
      });
      set((state) => {
        const addPhoto = (item: Item | null) => {
          if (!item || item.id !== itemId) return item;
          return { ...item, photos: [...(item.photos ?? []), photo] };
        };
        return {
          items: state.items.map((i) => addPhoto(i) as Item),
          selectedItem: addPhoto(state.selectedItem),
        };
      });
      return photo;
    } catch (err) {
      set({ error: extractProblemDetails(err) });
      throw err;
    }
  },

  deletePhoto: async (itemId, photoId) => {
    set({ error: null });
    try {
      await apiClient.delete(`/items/${itemId}/photos/${photoId}`);
      set((state) => {
        const removePhoto = (item: Item | null) => {
          if (!item || item.id !== itemId) return item;
          return { ...item, photos: (item.photos ?? []).filter((p) => p.id !== photoId) };
        };
        return {
          items: state.items.map((i) => removePhoto(i) as Item),
          selectedItem: removePhoto(state.selectedItem),
        };
      });
    } catch (err) {
      set({ error: extractProblemDetails(err) });
      throw err;
    }
  },

  reset: () => set({ ...initialState }),
}));
