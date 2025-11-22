import { IQueueService } from '../../src/queue/interfaces/queue-service.interface';

/**
 * Spy wrapper for queue services to track which queue receives messages
 */
export class QueueSpy {
  public publishedMessages: Array<{
    queueType: 'sqs' | 'rabbitmq';
    message: any;
    timestamp: Date;
  }> = [];

  constructor(
    private readonly originalService: IQueueService,
    private readonly queueType: 'sqs' | 'rabbitmq',
  ) {}

  async publishMessage(message: any, options?: any): Promise<string> {
    // Track the message
    this.publishedMessages.push({
      queueType: this.queueType,
      message: typeof message === 'string' ? JSON.parse(message) : message,
      timestamp: new Date(),
    });

    // Call original service
    return await this.originalService.publishMessage(message, options);
  }

  // Delegate other methods
  async subscribeToMessages(options?: any) {
    return await this.originalService.subscribeToMessages(options);
  }

  async deleteMessage(handle: string) {
    return await this.originalService.deleteMessage(handle);
  }

  async getQueueAttributes() {
    return await this.originalService.getQueueAttributes();
  }

  // Helper methods
  getMessagesForQueue(queueType: 'sqs' | 'rabbitmq') {
    return this.publishedMessages.filter((m) => m.queueType === queueType);
  }

  getMessagesByCountry(country: string) {
    return this.publishedMessages.filter(
      (m) => m.message.country?.toUpperCase() === country.toUpperCase(),
    );
  }

  clear() {
    this.publishedMessages = [];
  }
}
