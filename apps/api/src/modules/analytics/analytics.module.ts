import { Module } from '@nestjs/common';
import { SkuSnapshotSyncService } from './snapshot/sku-snapshot-sync.service';
import { SkuSnapshotSyncCron } from './snapshot/sku-snapshot-sync.cron';
import { DashboardService } from './dashboard/dashboard.service';
import { DashboardController } from './dashboard/dashboard.controller';
import { SettingsService } from './settings/settings.service';
import { SettingsController } from './settings/settings.controller';

@Module({
  controllers: [DashboardController, SettingsController],
  providers: [
    SkuSnapshotSyncService,
    SkuSnapshotSyncCron,
    DashboardService,
    SettingsService,
  ],
  exports: [SkuSnapshotSyncService, DashboardService, SettingsService],
})
export class AnalyticsModule {}
