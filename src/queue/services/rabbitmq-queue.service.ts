import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import * as amqp from 'amqp-connection-manager';
import { ChannelWrapper } from 'amqp-connection-manager';
import { Channel, GetMessage } from 'amqplib';
import {
  IQueueService,
  QueueMessage,
  PublishMessageOptions,
  SubscribeOptions,
} from '../interfaces/queue-service.interface';
import { RabbitMqQueueOptions } from '../interfaces/queue-options.interface';

@Injectable()
export class RabbitMqQueueService implements IQueueService, OnModuleDestroy {
  private readonly logger = new Logger(RabbitMqQueueService.name);
  private readonly connection: amqp.AmqpConnectionManager;
  private readonly channelWrapper: ChannelWrapper;
  private readonly queueName: string;

  constructor(private readonly options: RabbitMqQueueOptions) {
    this.queueName = options.queueName;
    this.connection = amqp.connect([options.url]);
    this.channelWrapper = this.connection.createChannel({
      json: false,
      setup: async (channel: Channel) => {
        await channel.assertQueue(this.queueName, {
          durable: true,
        });
      },
    });

    this.connection.on('connect', () => {
      this.logger.log('Connected to RabbitMQ');
    });

    this.connection.on('disconnect', (err) => {
      this.logger.error('Disconnected from RabbitMQ', err);
    });

    this.logger.log(
      `RabbitMQ Queue Service initialized for queue: ${this.queueName}`,
    );
  }

  async publishMessage(
    message: string | object,
    options?: PublishMessageOptions,
  ): Promise<string> {
    try {
      const messageId = this.generateMessageId();
      const messageBody =
        typeof message === 'string' ? message : JSON.stringify(message);
      const messageBuffer = Buffer.from(messageBody);

      await this.channelWrapper.sendToQueue(this.queueName, messageBuffer, {
        persistent: true,
        messageId,
        headers: options?.messageAttributes || {},
        ...(options?.delaySeconds && {
          expiration: String(options.delaySeconds * 1000),
        }),
      });

      this.logger.log(`Message published to RabbitMQ: ${messageId}`);
      return messageId;
    } catch (error) {
      this.logger.error(
        `Failed to publish message to RabbitMQ: ${error.message}`,
      );
      throw error;
    }
  }

  async subscribeToMessages(
    options?: SubscribeOptions,
  ): Promise<QueueMessage[]> {
    try {
      const maxMessages = options?.maxMessages || 10;
      const messages: QueueMessage[] = [];

      for (let i = 0; i < maxMessages; i++) {
        const msg = await this.channelWrapper.get(this.queueName, {
          noAck: false,
        });

        if (msg === false) {
          break; // No more messages
        }

        const getMessage = msg as GetMessage;
        messages.push({
          id: getMessage.properties.messageId || this.generateMessageId(),
          body: getMessage.content.toString(),
          receiptHandle: getMessage.fields.deliveryTag.toString(),
          attributes: {
            ...getMessage.properties.headers,
            timestamp: getMessage.properties.timestamp,
            deliveryTag: getMessage.fields.deliveryTag,
          },
        });
      }

      this.logger.log(`Received ${messages.length} messages from RabbitMQ`);
      return messages;
    } catch (error) {
      this.logger.error(
        `Failed to receive messages from RabbitMQ: ${error.message}`,
      );
      throw error;
    }
  }

  async deleteMessage(receiptHandle: string): Promise<void> {
    try {
      const deliveryTag = parseInt(receiptHandle, 10);
      await this.channelWrapper.ack({ fields: { deliveryTag } } as any);
      this.logger.log(`Message deleted from RabbitMQ`);
    } catch (error) {
      this.logger.error(
        `Failed to delete message from RabbitMQ: ${error.message}`,
      );
      throw error;
    }
  }

  async getQueueAttributes(): Promise<Record<string, any>> {
    try {
      const channel = await this.channelWrapper.addSetup(
        async (ch: Channel) => {
          return ch.checkQueue(this.queueName);
        },
      );

      return {
        messageCount: (channel as any).messageCount || 0,
        consumerCount: (channel as any).consumerCount || 0,
        queueName: this.queueName,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get queue attributes from RabbitMQ: ${error.message}`,
      );
      throw error;
    }
  }

  async onModuleDestroy() {
    await this.channelWrapper.close();
    await this.connection.close();
    this.logger.log('RabbitMQ connection closed');
  }

  private generateMessageId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }
}
