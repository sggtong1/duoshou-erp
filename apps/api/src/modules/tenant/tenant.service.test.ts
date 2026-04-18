import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TenantService } from './tenant.service';

describe('TenantService.resolveForUser', () => {
  let prisma: any;
  beforeEach(() => {
    prisma = {
      member: {
        findFirst: vi.fn(),
        create: vi.fn(),
      },
      user: { upsert: vi.fn() },
      organization: { create: vi.fn() },
      $transaction: vi.fn(),
    };
  });

  it('returns existing member on subsequent calls', async () => {
    prisma.member.findFirst.mockResolvedValue({ id: 'm-1', orgId: 'org-1', userId: 'u-1', role: 'owner' });
    const svc = new TenantService(prisma);
    const m = await svc.resolveForUser({ id: 'u-1', email: 'a@b.c' });
    expect(m.orgId).toBe('org-1');
    expect(prisma.organization.create).not.toHaveBeenCalled();
  });

  it('creates org + user + member on first-time user', async () => {
    prisma.member.findFirst.mockResolvedValue(null);
    prisma.$transaction.mockImplementation(async (fn: any) => fn(prisma));
    prisma.user.upsert.mockResolvedValue({ id: 'u-1', email: 'a@b.c' });
    prisma.organization.create.mockResolvedValue({ id: 'org-1', name: 'a@b.c' });
    prisma.member.create.mockResolvedValue({ id: 'm-1', orgId: 'org-1', userId: 'u-1', role: 'owner' });

    const svc = new TenantService(prisma);
    const m = await svc.resolveForUser({ id: 'u-1', email: 'a@b.c' });
    expect(m.orgId).toBe('org-1');
    expect(prisma.user.upsert).toHaveBeenCalled();
    expect(prisma.organization.create).toHaveBeenCalled();
    expect(prisma.member.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ userId: 'u-1', orgId: 'org-1', role: 'owner' }),
    }));
  });

  it('uses email as org name fallback', async () => {
    prisma.member.findFirst.mockResolvedValue(null);
    prisma.$transaction.mockImplementation(async (fn: any) => fn(prisma));
    prisma.user.upsert.mockResolvedValue({ id: 'u-2', email: 'x@y.z' });
    prisma.organization.create.mockResolvedValue({ id: 'org-2', name: 'x@y.z' });
    prisma.member.create.mockResolvedValue({ id: 'm-2', orgId: 'org-2', userId: 'u-2', role: 'owner' });

    const svc = new TenantService(prisma);
    await svc.resolveForUser({ id: 'u-2', email: 'x@y.z' });
    expect(prisma.organization.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ name: 'x@y.z' }),
    }));
  });

  it('uses "My Org" fallback if no email', async () => {
    prisma.member.findFirst.mockResolvedValue(null);
    prisma.$transaction.mockImplementation(async (fn: any) => fn(prisma));
    prisma.user.upsert.mockResolvedValue({ id: 'u-3' });
    prisma.organization.create.mockResolvedValue({ id: 'org-3', name: 'My Org' });
    prisma.member.create.mockResolvedValue({ id: 'm-3', orgId: 'org-3', userId: 'u-3', role: 'owner' });

    const svc = new TenantService(prisma);
    await svc.resolveForUser({ id: 'u-3' });
    expect(prisma.organization.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ name: 'My Org' }),
    }));
  });
});
