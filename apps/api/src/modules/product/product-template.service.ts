import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma.service';
import type { CreateProductTemplateInput, UpdateProductTemplateInput } from './product-template.dto';

@Injectable()
export class ProductTemplateService {
  constructor(private prisma: PrismaService) {}

  create(orgId: string, input: CreateProductTemplateInput) {
    return (this.prisma as any).productTemplate.create({
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
  }

  list(orgId: string) {
    return (this.prisma as any).productTemplate.findMany({
      where: { orgId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(orgId: string, id: string) {
    const t = await (this.prisma as any).productTemplate.findFirst({ where: { id, orgId } });
    if (!t) throw new NotFoundException(`Template ${id} not found`);
    return t;
  }

  async update(orgId: string, id: string, input: UpdateProductTemplateInput) {
    await this.findOne(orgId, id);
    const data: any = { ...input };
    if (input.temuCategoryId !== undefined) data.temuCategoryId = BigInt(input.temuCategoryId);
    if (input.suggestedPriceCents !== undefined) data.suggestedPriceCents = BigInt(input.suggestedPriceCents);
    return (this.prisma as any).productTemplate.update({ where: { id }, data });
  }

  async delete(orgId: string, id: string) {
    await this.findOne(orgId, id);
    return (this.prisma as any).productTemplate.delete({ where: { id } });
  }
}
