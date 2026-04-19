import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma.service';

@Injectable()
export class BulkJobService {
  constructor(private prisma: PrismaService) {}

  async get(orgId: string, id: string) {
    const job = await (this.prisma as any).bulkJob.findFirst({
      where: { id, orgId },
      include: {
        items: {
          include: {
            shop: {
              select: { id: true, displayName: true, platformShopId: true, shopType: true },
            },
          },
        },
      },
    });
    if (!job) throw new NotFoundException(`Job ${id} not found`);
    return job;
  }

  list(orgId: string, limit = 20) {
    return (this.prisma as any).bulkJob.findMany({
      where: { orgId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}
