import { RoutingStrategy } from './routing-strategy.interface';

export enum QueueProvider {
  SQS = 'sqs',
  RABBITMQ = 'rabbitmq',
  ALL = 'all',
  CONDITIONAL = 'conditional',
}

export interface SqsQueueOptions {
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  queueUrl: string;
  endpoint?: string;
}

export interface RabbitMqQueueOptions {
  url: string;
  queueName: string;
}

export interface QueueModuleOptions {
  provider: QueueProvider;
  sqs?: SqsQueueOptions;
  rabbitmq?: RabbitMqQueueOptions;
  routingStrategy?: RoutingStrategy;
}

export interface QueueModuleFeatureOptions {
  provider: QueueProvider;
  routingStrategy?: RoutingStrategy;
}
