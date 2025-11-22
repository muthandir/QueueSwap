import {
  IsString,
  IsNotEmpty,
  IsEmail,
  IsArray,
  ValidateNested,
  IsEnum,
  IsOptional,
  Length,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum OrderStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  READY_FOR_COLLECTION = 'ready_for_collection',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled',
}

export enum DeliveryMethod {
  COLLECTION = 'collection',
  DELIVERY = 'delivery',
}

export class MedicationItem {
  @IsString()
  @IsNotEmpty()
  medicationName: string;

  @IsString()
  @IsNotEmpty()
  dosage: string;

  @IsString()
  @IsNotEmpty()
  quantity: string;
}

export class CreatePrescriptionOrderDto {
  @IsString()
  @IsNotEmpty()
  patientName: string;

  @IsEmail()
  patientEmail: string;

  @IsString()
  @IsNotEmpty()
  nhsNumber: string;

  @IsString()
  @IsNotEmpty()
  pharmacyId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MedicationItem)
  medications: MedicationItem[];

  @IsEnum(DeliveryMethod)
  deliveryMethod: DeliveryMethod;

  @IsOptional()
  @IsString()
  deliveryAddress?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  @Length(2, 2)
  country?: string; // ISO 3166-1 alpha-2 country code (e.g., 'TR', 'US', 'DE')

  @IsOptional()
  @IsString()
  priority?: string;
}
