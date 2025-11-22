import { Injectable, Logger } from '@nestjs/common';
import {
  SQSClient,
  SendMessageCommand,
  ReceiveMessageCommand,
  DeleteMessageCommand,
  GetQueueAttributesCommand,
} from '@aws-sdk/client-sqs';
import {
  IQueueService,
  QueueMessage,
  PublishMessageOptions,
  SubscribeOptions,
} from '../interfaces/queue-service.interface';
import { SqsQueueOptions } from '../interfaces/queue-options.interface';

@Injectable()
export class SqsQueueService implements IQueueService {
  private readonly logger = new Logger(SqsQueueService.name);
  private readonly sqsClient: SQSClient;
  private readonly queueUrl: string;

  constructor(private readonly options: SqsQueueOptions) {
    this.queueUrl = options.queueUrl;
    this.sqsClient = new SQSClient({
      region: options.region,
      credentials: {
        accessKeyId: options.accessKeyId,
        secretAccessKey: options.secretAccessKey,
      },
      endpoint: options.endpoint,
    });
    this.logger.log(
      `SQS Queue Service initialized for queue: ${this.queueUrl}`,
    );
  }

  async publishMessage(
    message: string | object,
    options?: PublishMessageOptions,
  ): Promise<string> {
    try {
      const messageBody =
        typeof message === 'string' ? message : JSON.stringify(message);
      const command = new SendMessageCommand({
        QueueUrl: this.queueUrl,
        MessageBody: messageBody,
        DelaySeconds: options?.delaySeconds,
        MessageAttributes: options?.messageAttributes
          ? this.convertToSqsAttributes(options.messageAttributes)
          : undefined,
      });

      const response = await this.sqsClient.send(command);
      this.logger.log(`Message published to SQS: ${response.MessageId}`);
      return response.MessageId;
    } catch (error) {
      this.logger.error(`Failed to publish message to SQS: ${error.message}`);
      throw error;
    }
  }

  async subscribeToMessages(
    options?: SubscribeOptions,
  ): Promise<QueueMessage[]> {
    try {
      const command = new ReceiveMessageCommand({
        QueueUrl: this.queueUrl,
        MaxNumberOfMessages: options?.maxMessages || 10,
        WaitTimeSeconds: options?.waitTimeSeconds || 0,
        VisibilityTimeout: options?.visibilityTimeout || 30,
        MessageAttributeNames: ['All'],
        AttributeNames: ['All'],
      });

      const response = await this.sqsClient.send(command);
      const messages = response.Messages || [];

      this.logger.log(`Received ${messages.length} messages from SQS`);

      return messages.map((msg) => ({
        id: msg.MessageId,
        body: msg.Body,
        receiptHandle: msg.ReceiptHandle,
        attributes: {
          ...msg.Attributes,
          ...this.convertFromSqsAttributes(msg.MessageAttributes || {}),
        },
      }));
    } catch (error) {
      this.logger.error(
        `Failed to receive messages from SQS: ${error.message}`,
      );
      throw error;
    }
  }

  async deleteMessage(receiptHandle: string): Promise<void> {
    try {
      const command = new DeleteMessageCommand({
        QueueUrl: this.queueUrl,
        ReceiptHandle: receiptHandle,
      });

      await this.sqsClient.send(command);
      this.logger.log(`Message deleted from SQS`);
    } catch (error) {
      this.logger.error(`Failed to delete message from SQS: ${error.message}`);
      throw error;
    }
  }

  async getQueueAttributes(): Promise<Record<string, any>> {
    try {
      const command = new GetQueueAttributesCommand({
        QueueUrl: this.queueUrl,
        AttributeNames: ['All'],
      });

      const response = await this.sqsClient.send(command);
      return response.Attributes || {};
    } catch (error) {
      this.logger.error(
        `Failed to get queue attributes from SQS: ${error.message}`,
      );
      throw error;
    }
  }

  private convertToSqsAttributes(attributes: Record<string, any>): any {
    const sqsAttributes: any = {};
    for (const [key, value] of Object.entries(attributes)) {
      sqsAttributes[key] = {
        DataType: typeof value === 'number' ? 'Number' : 'String',
        StringValue: String(value),
      };
    }
    return sqsAttributes;
  }

  private convertFromSqsAttributes(
    sqsAttributes: Record<string, any>,
  ): Record<string, any> {
    const attributes: Record<string, any> = {};
    for (const [key, value] of Object.entries(sqsAttributes)) {
      if (value.DataType === 'Number') {
        attributes[key] = Number(value.StringValue);
      } else {
        attributes[key] = value.StringValue;
      }
    }
    return attributes;
  }
}
