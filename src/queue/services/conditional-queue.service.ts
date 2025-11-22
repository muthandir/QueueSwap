import { Injectable, Logger } from '@nestjs/common';
import {
  IQueueService,
  QueueMessage,
  PublishMessageOptions,
  SubscribeOptions,
} from '../interfaces/queue-service.interface';
import {
  RoutingStrategy,
  defaultRoutingStrategy,
} from '../interfaces/routing-strategy.interface';

@Injectable()
export class ConditionalQueueService implements IQueueService {
  private readonly logger = new Logger(ConditionalQueueService.name);
  private readonly routingStrategy: RoutingStrategy;

  constructor(
    private readonly sqsService: IQueueService,
    private readonly rabbitMqService: IQueueService,
    routingStrategy?: RoutingStrategy,
  ) {
    this.routingStrategy = routingStrategy || defaultRoutingStrategy;
    this.logger.log(
      'Conditional Queue Service initialized with routing strategy',
    );
  }

  async publishMessage(
    message: string | object,
    options?: PublishMessageOptions,
  ): Promise<string> {
    const messageObj =
      typeof message === 'string' ? JSON.parse(message) : message;

    // Use the injected routing strategy to make decision
    const decision = this.routingStrategy(messageObj);

    this.logger.log(
      `[step-3-routing] Routing to ${decision.destination.toUpperCase()}: ${
        decision.reason || 'Strategy decision'
      }`,
    );

    const targetService =
      decision.destination === 'sqs' ? this.sqsService : this.rabbitMqService;

    return await targetService.publishMessage(message, options);
  }

  async subscribeToMessages(
    options?: SubscribeOptions,
  ): Promise<QueueMessage[]> {
    // Read from all queues since messages could be in any based on routing
    const [sqsMessages, rabbitMessages] = await Promise.all([
      this.sqsService.subscribeToMessages(options),
      this.rabbitMqService.subscribeToMessages(options),
    ]);

    this.logger.log(
      `Retrieved messages - SQS: ${sqsMessages.length}, RabbitMQ: ${rabbitMessages.length}`,
    );

    return [...sqsMessages, ...rabbitMessages];
  }

  async deleteMessage(receiptHandle: string): Promise<void> {
    await Promise.allSettled([
      this.sqsService.deleteMessage(receiptHandle),
      this.rabbitMqService.deleteMessage(receiptHandle),
    ]);

    this.logger.log('Delete message attempted on all queues');
  }

  async getQueueAttributes(): Promise<Record<string, any>> {
    const [sqsAttrs, rabbitAttrs] = await Promise.all([
      this.sqsService.getQueueAttributes(),
      this.rabbitMqService.getQueueAttributes(),
    ]);

    return {
      sqs: sqsAttrs,
      rabbitmq: rabbitAttrs,
    };
  }
}
