import {
  RoutingStrategy,
  RoutingDecision,
} from '../../queue/interfaces/routing-strategy.interface';

export const prescriptionRoutingStrategy: RoutingStrategy = (
  message: any,
): RoutingDecision => {
  const country = message.country?.toUpperCase();

  // Rule 1: Turkish data residency (national compliance scenario)
  if (country === 'TR') {
    return {
      destination: 'rabbitmq',
      reason:
        'Assuming the rabbitmq is hosted in Turkey, it is used for Turkish data residency (GDPR-TR compliance)',
    };
  }

  // Rule 3: Default - standard processing via SQS
  return {
    destination: 'sqs',
    reason: 'Standard prescription processing',
  };
};
