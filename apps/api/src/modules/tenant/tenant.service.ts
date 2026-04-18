import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma.service';

export interface AuthUser {
  id: string;
  email?: string;
}

@Injectable()
export class TenantService {
  constructor(private prisma: PrismaService) {}

  /**
   * Return the user's (any) membership, auto-provisioning a new organization on first call.
   *
   * V1 semantics: one user = one org = all permissions. V2 will support multi-org
   * membership + roles.
   */
  async resolveForUser(user: AuthUser) {
    const existing = await this.prisma.member.findFirst({ where: { userId: user.id } });
    if (existing) return existing;

    return this.prisma.$transaction(async (tx: any) => {
      await tx.user.upsert({
        where: { id: user.id },
        create: { id: user.id, email: user.email, authProvider: 'supabase' },
        update: { email: user.email },
      });
      const org = await tx.organization.create({
        data: { name: user.email ?? 'My Org' },
      });
      return tx.member.create({
        data: { userId: user.id, orgId: org.id, role: 'owner' },
      });
    });
  }
}
