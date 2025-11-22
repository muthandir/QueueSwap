export interface QueueMessage {
  id: string;
  body: string;
  attributes?: Record<string, any>;
  receiptHandle?: string;
}

export interface PublishMessageOptions {
  delaySeconds?: number;
  messageAttributes?: Record<string, any>;
}

export interface SubscribeOptions {
  maxMessages?: number;
  waitTimeSeconds?: number;
  visibilityTimeout?: number;
}

export abstract class IQueueService {
  abstract publishMessage(
    message: string | object,
    options?: PublishMessageOptions,
  ): Promise<string>;

  abstract subscribeToMessages(
    options?: SubscribeOptions,
  ): Promise<QueueMessage[]>;

  abstract deleteMessage(receiptHandle: string): Promise<void>;

  abstract getQueueAttributes(): Promise<Record<string, any>>;
}
