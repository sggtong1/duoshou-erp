import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProductTemplateService } from './product-template.service';

describe('ProductTemplateService', () => {
  let prisma: any;
  beforeEach(() => {
    prisma = {
      productTemplate: {
        create: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'tpl-1', ...data })),
        findMany: vi.fn().mockResolvedValue([]),
        findFirst: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
    };
  });

  const makeInput = () => ({
    name: 'Test Mug',
    description: 'Ceramic',
    temuCategoryId: 1234,
    temuCategoryPath: ['Home', 'Kitchen'],
    shopTypeTarget: 'full' as const,
    mainImageUrl: 'https://example.com/a.jpg',
    carouselImageUrls: [],
    suggestedPriceCents: 1000,
    attributes: { Brand: 'Generic' },
    outerPackage: { lengthMm: 100, widthMm: 100, heightMm: 100, weightG: 300 },
  });

  it('create passes orgId and converts numerics to BigInt', async () => {
    const svc = new ProductTemplateService(prisma);
    const t = await svc.create('org-1', makeInput());
    expect(t.name).toBe('Test Mug');
    const call = prisma.productTemplate.create.mock.calls[0][0];
    expect(call.data.orgId).toBe('org-1');
    expect(call.data.temuCategoryId).toBe(1234n);
    expect(call.data.suggestedPriceCents).toBe(1000n);
  });

  it('findOne scopes by orgId', async () => {
    prisma.productTemplate.findFirst.mockResolvedValue({ id: 'tpl-1', orgId: 'org-1' });
    const svc = new ProductTemplateService(prisma);
    const t = await svc.findOne('org-1', 'tpl-1');
    expect(t.id).toBe('tpl-1');
    const call = prisma.productTemplate.findFirst.mock.calls[0][0];
    expect(call.where).toEqual({ id: 'tpl-1', orgId: 'org-1' });
  });

  it('findOne throws NotFound for cross-tenant access', async () => {
    prisma.productTemplate.findFirst.mockResolvedValue(null);
    const svc = new ProductTemplateService(prisma);
    await expect(svc.findOne('org-1', 'other')).rejects.toThrow(/not found/i);
  });

  it('update scope-checks then updates', async () => {
    prisma.productTemplate.findFirst.mockResolvedValue({ id: 'tpl-1', orgId: 'org-1' });
    prisma.productTemplate.update.mockResolvedValue({ id: 'tpl-1' });
    const svc = new ProductTemplateService(prisma);
    await svc.update('org-1', 'tpl-1', { name: 'New' });
    expect(prisma.productTemplate.update).toHaveBeenCalled();
  });
});
