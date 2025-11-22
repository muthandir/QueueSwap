import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { NotificationService } from './notification.service';
import { OrderNotificationConsumer } from './consumers/order-notification.consumer';

@Module({
  imports: [ScheduleModule.forRoot()],
  providers: [NotificationService, OrderNotificationConsumer],
  exports: [NotificationService],
})
export class NotificationsModule {}
