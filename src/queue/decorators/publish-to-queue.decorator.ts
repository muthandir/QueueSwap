import { SetMetadata, UseInterceptors, applyDecorators } from '@nestjs/common';
import { QueuePublishInterceptor } from '../interceptors/queue-publish.interceptor';

export const PUBLISH_TO_QUEUE_KEY = 'publishToQueue';

export interface PublishToQueueOptions {
  eventType?: string;
  messageAttributes?: Record<string, any>;
}

export const PublishToQueue = (options?: PublishToQueueOptions) =>
  applyDecorators(
    SetMetadata(PUBLISH_TO_QUEUE_KEY, options || {}),
    UseInterceptors(QueuePublishInterceptor),
  );
