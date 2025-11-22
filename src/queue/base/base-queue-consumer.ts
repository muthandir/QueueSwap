import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { CronJob } from 'cron';
import { IQueueService } from '../interfaces/queue-service.interface';

export interface MessageProcessingResult {
  success: boolean;
  shouldDelete: boolean;
}

@Injectable()
export abstract class BaseQueueConsumer implements OnModuleInit {
  @Inject(IQueueService)
  private readonly queueService: IQueueService;

  protected readonly logger: Logger;
  private cronJob: CronJob;

  constructor(
    loggerName: string,
    private readonly cronExpression: string,
  ) {
    this.logger = new Logger(loggerName);
  }

  onModuleInit() {
    this.cronJob = new CronJob(this.cronExpression, () => {
      this.pollAndProcess();
    });

    this.cronJob.start();
    this.logger.log(`Started cron job with expression: ${this.cronExpression}`);
  }

  private async pollAndProcess(): Promise<void> {
    try {
      const messages = await this.queueService.subscribeToMessages({
        maxMessages: this.getMaxMessages(),
        waitTimeSeconds: this.getWaitTimeSeconds(),
        visibilityTimeout: this.getVisibilityTimeout(),
      });

      if (messages.length > 0) {
        this.logger.log(`Received ${messages.length} messages from queue`);
        await this.processMessagesWithDeletion(messages);
      }
    } catch (error) {
      this.logger.error(`Error polling queue: ${error.message}`, error.stack);
    }
  }

  private async processMessagesWithDeletion(messages: any[]): Promise<void> {
    const results = await Promise.allSettled(
      messages.map(async (message) => {
        const result = await this.processMessage(message);

        if (result.success && result.shouldDelete) {
          try {
            await this.queueService.deleteMessage(message.receiptHandle);
            this.logger.debug(`Deleted message: ${message.id}`);
          } catch (error) {
            this.logger.error(
              `Failed to delete message ${message.id}: ${error.message}`,
            );
          }
        }

        return result;
      }),
    );

    const successful = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;

    this.logger.log(
      `Processed ${messages.length} messages: ${successful} successful, ${failed} failed`,
    );
  }

  protected abstract processMessage(
    message: any,
  ): Promise<MessageProcessingResult>;

  protected getMaxMessages(): number {
    return 10;
  }

  protected getWaitTimeSeconds(): number {
    return 10;
  }

  protected getVisibilityTimeout(): number {
    return 30;
  }
}
