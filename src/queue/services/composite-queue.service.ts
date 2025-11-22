import { Injectable, Logger } from '@nestjs/common';
import {
  IQueueService,
  QueueMessage,
  PublishMessageOptions,
  SubscribeOptions,
} from '../interfaces/queue-service.interface';

@Injectable()
export class CompositeQueueService implements IQueueService {
  private readonly logger = new Logger(CompositeQueueService.name);

  constructor(
    private readonly primaryService: IQueueService,
    private readonly secondaryService: IQueueService,
  ) {
    this.logger.log(
      'Composite Queue Service initialized with primary + secondary providers (dual-write, primary-read)',
    );
  }

  async publishMessage(
    message: string | object,
    options?: PublishMessageOptions,
  ): Promise<string> {
    // Publish to both queues in parallel (dual-write)
    const [primaryId, secondaryId] = await Promise.all([
      this.primaryService.publishMessage(message, options),
      this.secondaryService.publishMessage(message, options),
    ]);

    this.logger.log(
      `Message published to primary + secondary queues - Primary: ${primaryId}, Secondary: ${secondaryId}`,
    );
    return primaryId; // Return primary ID
  }

  async subscribeToMessages(
    options?: SubscribeOptions,
  ): Promise<QueueMessage[]> {
    // Read only from the PRIMARY queue.
    const primaryMessages =
      await this.primaryService.subscribeToMessages(options);

    this.logger.log(
      `Received messages from primary queue only - Primary: ${primaryMessages.length}`,
    );

    return primaryMessages;
  }

  async deleteMessage(receiptHandle: string): Promise<void> {
    // Delete only from the PRIMARY queue (where we read from).
    await this.primaryService.deleteMessage(receiptHandle);
    this.logger.log('Delete message attempted on primary queue');
  }

  async getQueueAttributes(): Promise<Record<string, any>> {
    const [primaryAttrs, secondaryAttrs] = await Promise.all([
      this.primaryService.getQueueAttributes(),
      this.secondaryService.getQueueAttributes(),
    ]);

    return {
      primary: primaryAttrs,
      secondary: secondaryAttrs,
    };
  }
}
