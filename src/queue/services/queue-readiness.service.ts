import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { IQueueService } from '../interfaces/queue-service.interface';

@Injectable()
export class QueueReadinessService implements OnModuleInit {
  private readonly logger = new Logger(QueueReadinessService.name);

  constructor(
    @Inject(IQueueService) private readonly queueService: IQueueService,
  ) {}

  async onModuleInit(): Promise<void> {
    if (process.env.QUEUE_READINESS_ENABLED === 'false') {
      this.logger.log(
        'Queue readiness check disabled via QUEUE_READINESS_ENABLED=false',
      );
      return;
    }

    const maxAttempts = Number(process.env.QUEUE_READINESS_MAX_ATTEMPTS || 5);
    const delayMs = Number(process.env.QUEUE_READINESS_DELAY_MS || 2000);

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        await this.queueService.getQueueAttributes();
        this.logger.log('Queue readiness check passed');
        return;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : JSON.stringify(error);
        this.logger.warn(
          `Queue readiness check failed (attempt ${attempt}/${maxAttempts}): ${message}`,
        );

        if (attempt === maxAttempts) {
          this.logger.error(
            'Queues are not ready after maximum attempts. Failing application startup.',
          );
          throw error;
        }

        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }
}
