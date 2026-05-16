import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AgentTaskService } from './agent-task.service';

/**
 * 每分钟把超过租约的 claimed/running 任务回收成 pending，让其它插件能重新领取。
 * 这是 at-least-once 派单语义的关键 —— 插件 crash / 离线时任务不会卡死。
 */
@Injectable()
export class AgentTaskSweeperCron {
  private readonly logger = new Logger(AgentTaskSweeperCron.name);

  constructor(private svc: AgentTaskService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async sweep() {
    try {
      await this.svc.sweepExpired();
    } catch (e: any) {
      this.logger.error(`sweepExpired failed: ${e?.message ?? e}`);
    }
  }
}
