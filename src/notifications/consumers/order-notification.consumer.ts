import { Injectable } from '@nestjs/common';
import { CronExpression } from '@nestjs/schedule';
import {
  BaseQueueConsumer,
  MessageProcessingResult,
} from '../../queue/base/base-queue-consumer';
import { NotificationService } from '../notification.service';

@Injectable()
export class OrderNotificationConsumer extends BaseQueueConsumer {
  constructor(private readonly notificationService: NotificationService) {
    super(OrderNotificationConsumer.name, CronExpression.EVERY_5_SECONDS);
  }

  protected async processMessage(
    message: any,
  ): Promise<MessageProcessingResult> {
    try {
      this.logger.log(
        `[step-5-consumer] Processing order message: ${message.id}`,
      );
      const orderData = JSON.parse(message.body);

      await this.notificationService.sendOrderConfirmation(
        orderData.patientEmail,
        orderData.orderId,
        orderData.patientName,
        orderData.medications,
      );

      this.logger.log(
        `[step-7-consumer] Successfully processed message: ${message.id}`,
      );

      return { success: true, shouldDelete: true };
    } catch (error) {
      this.logger.error(
        `Failed to process message: ${error.message}`,
        error.stack,
      );
      return { success: false, shouldDelete: false };
    }
  }
}
