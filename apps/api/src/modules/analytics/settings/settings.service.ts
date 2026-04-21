import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infra/prisma.service';
import type { UpdateSettingsInput } from './settings.dto';

@Injectable()
export class SettingsService {
  constructor(private prisma: PrismaService) {}

  async get(orgId: string) {
    const row = await (this.prisma as any).orgSettings.findUnique({ where: { orgId } });
    if (row) {
      return {
        lowStockThreshold: row.lowStockThreshold,
        lowStockDaysThreshold: row.lowStockDaysThreshold,
      };
    }
    return { lowStockThreshold: 10, lowStockDaysThreshold: 7 };
  }

  async update(orgId: string, input: UpdateSettingsInput) {
    const updated = await (this.prisma as any).orgSettings.upsert({
      where: { orgId },
      create: {
        orgId,
        lowStockThreshold: input.lowStockThreshold ?? 10,
        lowStockDaysThreshold: input.lowStockDaysThreshold ?? 7,
      },
      update: {
        ...(input.lowStockThreshold !== undefined && { lowStockThreshold: input.lowStockThreshold }),
        ...(input.lowStockDaysThreshold !== undefined && { lowStockDaysThreshold: input.lowStockDaysThreshold }),
      },
    });
    return {
      lowStockThreshold: updated.lowStockThreshold,
      lowStockDaysThreshold: updated.lowStockDaysThreshold,
    };
  }
}
