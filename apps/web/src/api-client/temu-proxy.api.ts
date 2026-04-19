import { http } from './http';

export interface TemuCategory { catId: number; catName: string; isLeaf: boolean }

export const temuProxyApi = {
  categories: (shopId: string, parentCatId = 0) =>
    http<TemuCategory[]>('/temu/categories', { query: { shopId, parentCatId } }),
  categoryAttrs: (shopId: string, catId: number) =>
    http<any>('/temu/category-attrs', { query: { shopId, catId } }),
  uploadImage: async (shopId: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    form.append('shopId', shopId);
    return http<{ url: string }>('/temu/images/upload', {
      method: 'POST',
      body: form as any,
      headers: {},  // let browser set multipart boundary
    });
  },
};
