import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma.service';

export interface ProductListFilter {
  shopId?: string;
  status?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

@Injectable()
export class ProductService {
  constructor(private prisma: PrismaService) {}

  async list(orgId: string, filter: ProductListFilter = {}) {
    const page = Math.max(1, filter.page ?? 1);
    const pageSize = Math.min(100, filter.pageSize ?? 20);
    const where: any = { orgId };
    if (filter.shopId) where.shopId = filter.shopId;
    if (filter.status) where.status = filter.status;
    if (filter.search) where.title = { contains: filter.search, mode: 'insensitive' };

    const [total, items] = await Promise.all([
      (this.prisma as any).product.count({ where }),
      (this.prisma as any).product.findMany({
        where,
        include: {
          shop: { select: { id: true, displayName: true, platformShopId: true, shopType: true } },
        },
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return { total, page, pageSize, items };
  }
}
