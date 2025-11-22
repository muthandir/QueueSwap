import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { IQueueService } from '../interfaces/queue-service.interface';
import {
  PUBLISH_TO_QUEUE_KEY,
  PublishToQueueOptions,
} from '../decorators/publish-to-queue.decorator';

@Injectable()
export class QueuePublishInterceptor implements NestInterceptor {
  private readonly logger = new Logger(QueuePublishInterceptor.name);

  constructor(
    private readonly queueService: IQueueService,
    private readonly reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const options = this.reflector.get<PublishToQueueOptions>(
      PUBLISH_TO_QUEUE_KEY,
      context.getHandler(),
    );

    if (!options) {
      return next.handle();
    }

    return next.handle().pipe(
      tap(async (data) => {
        if (!data) {
          return;
        }

        try {
          const contextType = context.getType<'http' | 'rpc' | 'ws'>();
          let messagePayload: any;

          if (contextType === 'http') {
            const http = context.switchToHttp();
            const request = http.getRequest();

            // For HTTP, combine request body (domain input) with
            // response data (e.g. generated orderId, status, timestamps).
            const responseBody = data;
            const orderData = responseBody?.data ?? responseBody;

            messagePayload = {
              ...(request.body || {}),
              ...(orderData || {}),
            };
          } else {
            // Fallback for non-HTTP contexts
            messagePayload = data;
          }

          const finalPayload = options.eventType
            ? { ...messagePayload, eventType: options.eventType }
            : messagePayload;

          await this.queueService.publishMessage(finalPayload, {
            messageAttributes: options.messageAttributes,
          });

          this.logger.log(
            `[step-4-decorator] Published to queue: ${
              (finalPayload && finalPayload.orderId) || 'unknown'
            }`,
          );
        } catch (error) {
          this.logger.error(`Failed to publish to queue: ${error.message}`);
          // Don't throw - queue publishing shouldn't break the API response
        }
      }),
    );
  }
}
