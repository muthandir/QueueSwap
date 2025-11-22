import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { PrescriptionsService } from './prescriptions.service';
import { CreatePrescriptionOrderDto } from './dto/prescription-order.dto';
import { PublishToQueue } from '../queue/decorators/publish-to-queue.decorator';

@Controller('prescriptions')
export class PrescriptionsController {
  private readonly logger = new Logger(PrescriptionsController.name);

  constructor(private readonly prescriptionsService: PrescriptionsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @PublishToQueue({
    messageAttributes: { orderType: 'prescription' },
  })
  async createOrder(@Body() dto: CreatePrescriptionOrderDto) {
    this.logger.log(
      `[step-1-controller] Received POST /prescriptions for ${dto.patientEmail}`,
    );
    const order = await this.prescriptionsService.createPrescriptionOrder(dto);

    return {
      success: true,
      message: 'Prescription order created successfully',
      data: {
        orderId: order.orderId,
        status: order.status,
        createdAt: order.createdAt,
      },
    };
  }
}
