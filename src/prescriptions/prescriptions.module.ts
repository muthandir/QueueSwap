import { Module } from '@nestjs/common';
import { PrescriptionsController } from './prescriptions.controller';
import { PrescriptionsService } from './prescriptions.service';
import { QueueModule } from '../queue/queue.module';
import { QueueProvider } from '../queue/interfaces/queue-options.interface';
import { prescriptionRoutingStrategy } from './routing/prescription-routing.strategy';

@Module({
  imports: [
    // Override: Use conditional routing with prescription-specific strategy
    // Routing rules defined in prescriptionRoutingStrategy:
    // - Turkish orders (country='TR') → RabbitMQ (KVKK data residency)
    // - All other orders → SQS (default)
    QueueModule.forFeature({
      provider: QueueProvider.CONDITIONAL,
      routingStrategy: prescriptionRoutingStrategy,
    }),
  ],
  controllers: [PrescriptionsController],
  providers: [PrescriptionsService],
  exports: [PrescriptionsService],
})
export class PrescriptionsModule {}
