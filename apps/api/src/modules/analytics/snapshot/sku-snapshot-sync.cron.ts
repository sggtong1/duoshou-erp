// DEPRECATED 2026-05-11: BI 数据改由 mini-services/sync/sync_bi.py 同步到 Supabase bi_* 表，
// 此 cron 已从 AnalyticsModule providers 移除，@Cron 装饰器已去除。
// 文件保留作历史参考，未来若需手动复用可重新注册并恢复装饰器。
import { Injectable, Logger } from '@nestjs/common';
import { SkuSnapshotSyncService } from './sku-snapshot-sync.service';

@Injectable()
export class SkuSnapshotSyncCron {
  private logger = new Logger(SkuSnapshotSyncCron.name);
  constructor(private sync: SkuSnapshotSyncService) {}

  async run() {
    const total = await this.sync.syncAllActiveShops();
    if (total > 0) this.logger.log(`sku-snapshot cron: touched ${total}`);
  }
}
