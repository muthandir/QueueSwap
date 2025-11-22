import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { PrescriptionsController } from '../src/prescriptions/prescriptions.controller';
import { PrescriptionsService } from '../src/prescriptions/prescriptions.service';
import { QueuePublishInterceptor } from '../src/queue/interceptors/queue-publish.interceptor';
import { IQueueService } from '../src/queue/interfaces/queue-service.interface';
import { ConditionalQueueService } from '../src/queue/services/conditional-queue.service';
import { prescriptionRoutingStrategy } from '../src/prescriptions/routing/prescription-routing.strategy';
import { prescriptionOrderFixtures } from './fixtures/prescription-orders.fixture';
import { Reflector } from '@nestjs/core';

describe('@PublishToQueue Decorator + Conditional Routing', () => {
  let app: INestApplication;

  const mockSqsService = {
    publishMessage: jest.fn().mockResolvedValue('sqs-msg-id'),
    subscribeToMessages: jest.fn(),
    deleteMessage: jest.fn(),
    getQueueAttributes: jest.fn(),
  };

  const mockRabbitService = {
    publishMessage: jest.fn().mockResolvedValue('rabbitmq-msg-id'),
    subscribeToMessages: jest.fn(),
    deleteMessage: jest.fn(),
    getQueueAttributes: jest.fn(),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [PrescriptionsController],
      providers: [
        PrescriptionsService,
        QueuePublishInterceptor,
        Reflector,
        {
          provide: IQueueService,
          useFactory: () =>
            new ConditionalQueueService(
              mockSqsService as any,
              mockRabbitService as any,
              prescriptionRoutingStrategy,
            ),
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('routes Turkish prescription to RabbitMQ via decorator', async () => {
    await request(app.getHttpServer())
      .post('/prescriptions')
      .send(prescriptionOrderFixtures.turkish)
      .expect(201);

    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(mockRabbitService.publishMessage).toHaveBeenCalledTimes(1);
    expect(mockSqsService.publishMessage).not.toHaveBeenCalled();
  });

  it('routes US prescription to SQS via decorator', async () => {
    await request(app.getHttpServer())
      .post('/prescriptions')
      .send(prescriptionOrderFixtures.us)
      .expect(201);

    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(mockSqsService.publishMessage).toHaveBeenCalledTimes(1);
    expect(mockRabbitService.publishMessage).not.toHaveBeenCalled();
  });

  it('routes standard prescription to SQS via decorator', async () => {
    await request(app.getHttpServer())
      .post('/prescriptions')
      .send(prescriptionOrderFixtures.standard)
      .expect(201);

    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(mockSqsService.publishMessage).toHaveBeenCalledTimes(1);
    expect(mockRabbitService.publishMessage).not.toHaveBeenCalled();
  });

  it('does not publish when validation fails', async () => {
    await request(app.getHttpServer())
      .post('/prescriptions')
      .send({ invalid: 'data' })
      .expect(400);

    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(mockSqsService.publishMessage).not.toHaveBeenCalled();
    expect(mockRabbitService.publishMessage).not.toHaveBeenCalled();
  });
});
