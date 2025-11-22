import { Injectable, Logger } from '@nestjs/common';

export interface NotificationData {
  to: string;
  subject: string;
  body: string;
  metadata?: Record<string, any>;
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  async sendOrderConfirmation(
    email: string,
    orderId: string,
    _patientName: string,
    _medications: Array<{
      medicationName: string;
      dosage: string;
      quantity: string;
    }>,
  ): Promise<void> {
    const subject = `Prescription Order Confirmed (${orderId})`;
    const body = this.buildOrderConfirmationEmail();

    await this.send({
      to: email,
      subject,
      body,
      metadata: {
        type: 'order_confirmation',
        orderId,
      },
    });
  }

  async send(data: NotificationData): Promise<void> {
    this.logger.log('step-6-notification-service═════════════════════════');
    this.logger.log('step-6-notification-service📧 SENDING EMAIL NOTIFICATION');
    this.logger.log('step-6-notification-service═════════════════════════════');
    this.logger.log(`step-6-notification-serviceTo: ${data.to}`);
    this.logger.log(`step-6-notification-serviceSubject: ${data.subject}`);
    this.logger.log('─────────────────────────────');
    this.logger.log(data.body);
    this.logger.log('─────────────────────────────');
    if (data.metadata) {
      this.logger.log(`Metadata: ${JSON.stringify(data.metadata, null, 2)}`);
    }
    this.logger.log('step-6-notification-service═════════════════════════════');
    this.logger.log('step-6-notification-service✅ Email sent (simulated)');
    this.logger.log('');

    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  private buildOrderConfirmationEmail(): string {
    return `Thank you! We've received your prescription order.`;
  }
}
