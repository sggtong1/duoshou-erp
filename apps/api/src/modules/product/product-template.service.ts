import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma.service';
import type { CreateProductTemplateInput, UpdateProductTemplateInput } from './product-template.dto';

// Prisma stores temuCategoryId and suggestedPriceCents as BigInt (Postgres bigint).
// Express/JSON.stringify cannot serialize BigInt natively, so we convert to Number here.
function serializeTemplate(t: any) {
  if (!t) return t;
  return {
    ...t,
    temuCategoryId: t.temuCategoryId !== undefined ? Number(t.temuCategoryId) : t.temuCategoryId,
    suggestedPriceCents: t.suggestedPriceCents !== undefined ? Number(t.suggestedPriceCents) : t.suggestedPriceCents,
  };
}

@Injectable()
export class ProductTemplateService {
  constructor(private prisma: PrismaService) {}

  async create(orgId: string, input: CreateProductTemplateInput) {
    const t = await (this.prisma as any).productTemplate.create({
      data: {
        orgId,
        name: input.name,
        description: input.description,
        temuCategoryId: BigInt(input.temuCategoryId),
        temuCategoryPath: input.temuCategoryPath,
        shopTypeTarget: input.shopTypeTarget,
        mainImageUrl: input.mainImageUrl,
        carouselImageUrls: input.carouselImageUrls,
        suggestedPriceCents: BigInt(input.suggestedPriceCents),
        attributes: input.attributes,
        outerPackage: input.outerPackage,
      },
    });
    return serializeTemplate(t);
  }

  async list(orgId: string) {
    const rows = await (this.prisma as any).productTemplate.findMany({
      where: { orgId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(serializeTemplate);
  }

  async findOne(orgId: string, id: string) {
    const t = await (this.prisma as any).productTemplate.findFirst({ where: { id, orgId } });
    if (!t) throw new NotFoundException(`Template ${id} not found`);
    return serializeTemplate(t);
  }

  async update(orgId: string, id: string, input: UpdateProductTemplateInput) {
    await this.findOne(orgId, id);
    const data: any = { ...input };
    if (input.temuCategoryId !== undefined) data.temuCategoryId = BigInt(input.temuCategoryId);
    if (input.suggestedPriceCents !== undefined) data.suggestedPriceCents = BigInt(input.suggestedPriceCents);
    const t = await (this.prisma as any).productTemplate.update({ where: { id }, data });
    return serializeTemplate(t);
  }

  async delete(orgId: string, id: string) {
    await this.findOne(orgId, id);
    return (this.prisma as any).productTemplate.delete({ where: { id } });
  }
}
