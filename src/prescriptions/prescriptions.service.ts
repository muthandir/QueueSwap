import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  CreatePrescriptionOrderDto,
  OrderStatus,
} from './dto/prescription-order.dto';

export interface PrescriptionOrder {
  orderId: string;
  status: OrderStatus;
  createdAt: string;
  patientName: string;
  patientEmail: string;
  nhsNumber: string;
  pharmacyId: string;
  medications: Array<{
    medicationName: string;
    dosage: string;
    quantity: string;
  }>;
  deliveryMethod: string;
  deliveryAddress?: string;
  notes?: string;
  country?: string;
}

@Injectable()
export class PrescriptionsService {
  private readonly logger = new Logger(PrescriptionsService.name);
  private orders: Map<string, PrescriptionOrder> = new Map();
  async createPrescriptionOrder(
    dto: CreatePrescriptionOrderDto,
  ): Promise<PrescriptionOrder> {
    // this is a simulation of order processing.
    const orderId = this.generateOrderId();

    const order: PrescriptionOrder = {
      orderId,
      status: OrderStatus.PENDING,
      createdAt: new Date().toISOString(),
      patientName: dto.patientName,
      patientEmail: dto.patientEmail,
      nhsNumber: dto.nhsNumber,
      pharmacyId: dto.pharmacyId,
      medications: dto.medications,
      deliveryMethod: dto.deliveryMethod,
      deliveryAddress: dto.deliveryAddress,
      notes: dto.notes,
      country: dto.country,
    };

    this.orders.set(orderId, order);
    this.logger.log(
      `[step-2-service] Created prescription order: ${orderId} for patient: ${dto.patientName}`,
    );

    return order;
  }

  private generateOrderId(): string {
    return randomUUID();
  }
}
