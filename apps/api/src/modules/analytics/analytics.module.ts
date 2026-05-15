import { Module } from '@nestjs/common';
// NOTE: SkuSnapshotSyncCron 已弃用(2026-05-11),不再注册为 provider。
// BI 数据由 mini-services/sync/sync_bi.py 写入 Supabase bi_* 表,Dashboard 直接读 bi_*。
// SkuSnapshotSyncService 暂时保留,因为 DashboardController 的 POST /dashboard/sync/now 仍在调用它。
import { SkuSnapshotSyncService } from './snapshot/sku-snapshot-sync.service';
import { DashboardService } from './dashboard/dashboard.service';
import { DashboardController } from './dashboard/dashboard.controller';
import { SettingsService } from './settings/settings.service';
import { SettingsController } from './settings/settings.controller';

@Module({
  controllers: [DashboardController, SettingsController],
  providers: [
    SkuSnapshotSyncService,
    DashboardService,
    SettingsService,
  ],
  exports: [SkuSnapshotSyncService, DashboardService, SettingsService],
})
export class AnalyticsModule {}
