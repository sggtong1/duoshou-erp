import { z } from 'zod';

export const OuterPackageSchema = z.object({
  lengthMm: z.number().positive(),
  widthMm: z.number().positive(),
  heightMm: z.number().positive(),
  weightG: z.number().positive(),
});
export type OuterPackage = z.infer<typeof OuterPackageSchema>;

export const CreateProductTemplateDto = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  temuCategoryId: z.number().int().positive(),
  temuCategoryPath: z.array(z.string()).min(1),
  shopTypeTarget: z.enum(['full', 'semi']),
  mainImageUrl: z.string().url(),
  carouselImageUrls: z.array(z.string().url()).max(9).default([]),
  suggestedPriceCents: z.number().int().positive(),
  attributes: z.record(z.string(), z.string()).default({}),
  outerPackage: OuterPackageSchema,
});
export type CreateProductTemplateInput = z.infer<typeof CreateProductTemplateDto>;

export const UpdateProductTemplateDto = CreateProductTemplateDto.partial();
export type UpdateProductTemplateInput = z.infer<typeof UpdateProductTemplateDto>;
