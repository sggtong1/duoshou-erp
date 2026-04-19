import { http } from './http';

export interface ProductTemplate {
  id: string;
  name: string;
  description?: string;
  temuCategoryId: string;        // BigInt serialized as string by Prisma JSON
  temuCategoryPath: string[];
  shopTypeTarget: 'full' | 'semi';
  mainImageUrl: string;
  carouselImageUrls: string[];
  suggestedPriceCents: string;   // BigInt as string
  attributes: Record<string, string>;
  outerPackage: { lengthMm: number; widthMm: number; heightMm: number; weightG: number };
  createdAt: string;
  updatedAt: string;
}

export interface CreateTemplateInput {
  name: string;
  description?: string;
  temuCategoryId: number;
  temuCategoryPath: string[];
  shopTypeTarget: 'full' | 'semi';
  mainImageUrl: string;
  carouselImageUrls: string[];
  suggestedPriceCents: number;
  attributes: Record<string, string>;
  outerPackage: { lengthMm: number; widthMm: number; heightMm: number; weightG: number };
}

export const templatesApi = {
  list: () => http<ProductTemplate[]>('/product-templates'),
  get: (id: string) => http<ProductTemplate>('/product-templates/' + id),
  create: (input: CreateTemplateInput) =>
    http<ProductTemplate>('/product-templates', { method: 'POST', body: JSON.stringify(input) }),
  update: (id: string, input: Partial<CreateTemplateInput>) =>
    http<ProductTemplate>('/product-templates/' + id, { method: 'PATCH', body: JSON.stringify(input) }),
  delete: (id: string) =>
    http<void>('/product-templates/' + id, { method: 'DELETE' }),
};
