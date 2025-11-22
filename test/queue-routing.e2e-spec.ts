import { ConditionalQueueService } from '../src/queue/services/conditional-queue.service';
import { SqsQueueService } from '../src/queue/services/sqs-queue.service';
import { RabbitMqQueueService } from '../src/queue/services/rabbitmq-queue.service';
import { CompositeQueueService } from '../src/queue/services/composite-queue.service';
import { prescriptionRoutingStrategy } from '../src/prescriptions/routing/prescription-routing.strategy';

describe('Queue Routing Tests', () => {
  let mockSqsService: jest.Mocked<SqsQueueService>;
  let mockRabbitMqService: jest.Mocked<RabbitMqQueueService>;

  beforeEach(() => {
    mockSqsService = {
      publishMessage: jest.fn().mockResolvedValue('sqs-msg-id'),
      subscribeToMessages: jest.fn().mockResolvedValue([]),
      deleteMessage: jest.fn().mockResolvedValue(undefined),
      getQueueAttributes: jest.fn().mockResolvedValue({}),
    } as any;

    mockRabbitMqService = {
      publishMessage: jest.fn().mockResolvedValue('rabbitmq-msg-id'),
      subscribeToMessages: jest.fn().mockResolvedValue([]),
      deleteMessage: jest.fn().mockResolvedValue(undefined),
      getQueueAttributes: jest.fn().mockResolvedValue({}),
    } as any;
  });

  describe('ConditionalQueueService Routing', () => {
    it('should route Turkish prescription to RabbitMQ', async () => {
      const service = new ConditionalQueueService(
        mockSqsService,
        mockRabbitMqService,
        prescriptionRoutingStrategy,
      );

      const turkishOrder = { country: 'TR', patientName: 'Ahmet' };
      await service.publishMessage(turkishOrder);

      expect(mockRabbitMqService.publishMessage).toHaveBeenCalledWith(
        turkishOrder,
        undefined,
      );
      expect(mockSqsService.publishMessage).not.toHaveBeenCalled();
    });

    it('should route US prescription to SQS', async () => {
      const service = new ConditionalQueueService(
        mockSqsService,
        mockRabbitMqService,
        prescriptionRoutingStrategy,
      );

      const usOrder = { country: 'US', patientName: 'John' };
      await service.publishMessage(usOrder);

      expect(mockSqsService.publishMessage).toHaveBeenCalledWith(
        usOrder,
        undefined,
      );
      expect(mockRabbitMqService.publishMessage).not.toHaveBeenCalled();
    });

    it('should route standard prescription to SQS (default)', async () => {
      const service = new ConditionalQueueService(
        mockSqsService,
        mockRabbitMqService,
        prescriptionRoutingStrategy,
      );

      const standardOrder = { patientName: 'Jane' };
      await service.publishMessage(standardOrder);

      expect(mockSqsService.publishMessage).toHaveBeenCalledWith(
        standardOrder,
        undefined,
      );
      expect(mockRabbitMqService.publishMessage).not.toHaveBeenCalled();
    });

    it('should subscribe from both queues', async () => {
      const service = new ConditionalQueueService(
        mockSqsService,
        mockRabbitMqService,
        prescriptionRoutingStrategy,
      );

      mockSqsService.subscribeToMessages.mockResolvedValue([
        { id: '1', body: 'msg1', receiptHandle: 'h1' },
      ]);
      mockRabbitMqService.subscribeToMessages.mockResolvedValue([
        { id: '2', body: 'msg2', receiptHandle: 'h2' },
      ]);

      const messages = await service.subscribeToMessages();

      expect(messages).toHaveLength(2);
      expect(mockSqsService.subscribeToMessages).toHaveBeenCalled();
      expect(mockRabbitMqService.subscribeToMessages).toHaveBeenCalled();
    });
  });

  describe('CompositeQueueService (All Provider)', () => {
    it('should publish to both SQS and RabbitMQ', async () => {
      const service = new CompositeQueueService(
        mockSqsService,
        mockRabbitMqService,
      );

      const message = { test: 'data' };
      const result = await service.publishMessage(message);

      expect(mockSqsService.publishMessage).toHaveBeenCalledWith(
        message,
        undefined,
      );
      expect(mockRabbitMqService.publishMessage).toHaveBeenCalledWith(
        message,
        undefined,
      );
      expect(result).toBe('sqs-msg-id'); // Returns primary ID
    });

    it('should subscribe only from primary queue (SQS)', async () => {
      const service = new CompositeQueueService(
        mockSqsService,
        mockRabbitMqService,
      );

      mockSqsService.subscribeToMessages.mockResolvedValue([
        { id: '1', body: 'sqs', receiptHandle: 'h1' },
      ]);
      mockRabbitMqService.subscribeToMessages.mockResolvedValue([
        { id: '2', body: 'rabbit', receiptHandle: 'h2' },
      ]);

      const messages = await service.subscribeToMessages();

      // Only primary (SQS) messages should be returned
      expect(messages).toHaveLength(1);
      expect(messages[0].body).toBe('sqs');
      expect(mockSqsService.subscribeToMessages).toHaveBeenCalled();
      // Secondary is not read in this pattern
      expect(mockRabbitMqService.subscribeToMessages).not.toHaveBeenCalled();
    });
  });

  describe('Routing Strategy Logic', () => {
    it('should identify Turkish data residency countries', () => {
      const decision = prescriptionRoutingStrategy({ country: 'TR' });

      expect(decision.destination).toBe('rabbitmq');
      expect(decision.reason).toContain('Turkish data residency');
    });

    it('should route non-residency countries to SQS', () => {
      const countries = ['US', 'GB', 'DE', 'FR'];

      countries.forEach((country) => {
        const decision = prescriptionRoutingStrategy({ country });
        expect(decision.destination).toBe('sqs');
        expect(decision.reason).toContain('Standard prescription');
      });
    });

    it('should default to SQS for no routing criteria', () => {
      const decision = prescriptionRoutingStrategy({});

      expect(decision.destination).toBe('sqs');
      expect(decision.reason).toContain('Standard');
    });
  });
});
