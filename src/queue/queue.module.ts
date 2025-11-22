import { DynamicModule, Module, Provider } from '@nestjs/common';
import { IQueueService } from './interfaces/queue-service.interface';
import {
  QueueModuleOptions,
  QueueModuleFeatureOptions,
  QueueProvider,
} from './interfaces/queue-options.interface';
import { SqsQueueService } from './services/sqs-queue.service';
import { RabbitMqQueueService } from './services/rabbitmq-queue.service';
import { CompositeQueueService } from './services/composite-queue.service';
import { ConditionalQueueService } from './services/conditional-queue.service';
import { QueueReadinessService } from './services/queue-readiness.service';

const QUEUE_MODULE_OPTIONS = 'QUEUE_MODULE_OPTIONS';
const SQS_QUEUE_SERVICE = 'SQS_QUEUE_SERVICE';
const RABBITMQ_QUEUE_SERVICE = 'RABBITMQ_QUEUE_SERVICE';

@Module({})
export class QueueModule {
  static forRoot(options: QueueModuleOptions): DynamicModule {
    // Validate provider option
    if (!Object.values(QueueProvider).includes(options.provider)) {
      throw new Error(
        `Invalid queue provider: ${options.provider}. Must be 'sqs', 'rabbitmq', 'all', or 'conditional'`,
      );
    }

    const providers: Provider[] = [
      {
        provide: QUEUE_MODULE_OPTIONS,
        useValue: options,
      },

      {
        provide: SQS_QUEUE_SERVICE,
        useFactory: () => new SqsQueueService(options.sqs),
      },
      {
        provide: RABBITMQ_QUEUE_SERVICE,
        useFactory: () => new RabbitMqQueueService(options.rabbitmq),
      },
      QueueReadinessService,
    ];

    if (options.provider === QueueProvider.ALL) {
      providers.push({
        provide: IQueueService,
        useFactory: (
          sqsService: SqsQueueService,
          rabbitMqService: RabbitMqQueueService,
        ) => new CompositeQueueService(sqsService, rabbitMqService),
        inject: [SQS_QUEUE_SERVICE, RABBITMQ_QUEUE_SERVICE],
      });
    } else if (options.provider === QueueProvider.CONDITIONAL) {
      providers.push({
        provide: IQueueService,
        useFactory: (
          sqsService: SqsQueueService,
          rabbitMqService: RabbitMqQueueService,
        ) => {
          return new ConditionalQueueService(
            sqsService,
            rabbitMqService,
            options.routingStrategy,
          );
        },
        inject: [SQS_QUEUE_SERVICE, RABBITMQ_QUEUE_SERVICE],
      });
    } else if (options.provider === QueueProvider.SQS) {
      providers.push({
        provide: IQueueService,
        useExisting: 'SQS_QUEUE_SERVICE',
      });
    } else if (options.provider === QueueProvider.RABBITMQ) {
      providers.push({
        provide: IQueueService,
        useExisting: 'RABBITMQ_QUEUE_SERVICE',
      });
    } else {
      throw new Error(`Unexpected queue provider: ${options.provider}`);
    }

    return {
      module: QueueModule,
      global: true,
      providers,
      exports: [
        IQueueService,
        QUEUE_MODULE_OPTIONS,
        SQS_QUEUE_SERVICE,
        RABBITMQ_QUEUE_SERVICE,
      ],
    };
  }

  static forFeature(featureOptions: QueueModuleFeatureOptions): DynamicModule {
    // Validate provider option
    if (!Object.values(QueueProvider).includes(featureOptions.provider)) {
      throw new Error(
        `Invalid queue provider: ${featureOptions.provider}. Must be 'sqs', 'rabbitmq', 'all', or 'conditional'`,
      );
    }

    return {
      module: QueueModule,
      providers: [
        {
          provide: IQueueService,
          useFactory: (
            sqsService: SqsQueueService,
            rabbitMqService: RabbitMqQueueService,
          ) => {
            const provider = featureOptions.provider;

            if (provider === QueueProvider.SQS) {
              return sqsService;
            }

            if (provider === QueueProvider.RABBITMQ) {
              return rabbitMqService;
            }

            if (provider === QueueProvider.ALL) {
              return new CompositeQueueService(sqsService, rabbitMqService);
            }

            // conditional
            return new ConditionalQueueService(
              sqsService,
              rabbitMqService,
              featureOptions.routingStrategy,
            );
          },
          inject: [SQS_QUEUE_SERVICE, RABBITMQ_QUEUE_SERVICE],
        },
      ],
      exports: [IQueueService],
    };
  }
}
