import { registerAs } from '@nestjs/config';
import {
  QueueModuleOptions,
  QueueProvider,
} from '../queue/interfaces/queue-options.interface';

export default registerAs('queue', (): QueueModuleOptions => {
  const providerEnv = process.env.QUEUE_PROVIDER || QueueProvider.SQS;

  const provider = Object.values(QueueProvider).includes(
    providerEnv as QueueProvider,
  )
    ? (providerEnv as QueueProvider)
    : QueueProvider.SQS;

  return {
    provider,
    sqs: {
      region: process.env.AWS_REGION || 'us-east-1',
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'test',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'test',
      queueUrl: process.env.SQS_QUEUE_URL || '',
      endpoint: process.env.AWS_ENDPOINT,
    },
    rabbitmq: {
      url: process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672',
      queueName: process.env.RABBITMQ_QUEUE_NAME || 'test-queue',
    },
  };
});
