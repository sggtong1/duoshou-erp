import { Module } from '@nestjs/common';
import { AgentTaskService } from './agent-task.service';
import { AgentTaskController } from './agent-task.controller';
import { AgentTaskSweeperCron } from './agent-task-sweeper.cron';
import { AgentResultIngestor } from './ingestors/agent-result-ingestor.service';

@Module({
  controllers: [AgentTaskController],
  providers: [AgentTaskService, AgentTaskSweeperCron, AgentResultIngestor],
  exports: [AgentTaskService, AgentResultIngestor],
})
export class AgentModule {}
