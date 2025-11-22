import {
  RoutingStrategy,
  RoutingDecision,
} from '../interfaces/routing-strategy.interface';

export const dataResidencyRoutingStrategy: RoutingStrategy = (
  message: any,
): RoutingDecision => {
  const country = message.country?.toUpperCase();

  const localStorageCountries = ['TR'];

  if (localStorageCountries.includes(country)) {
    return {
      destination: 'rabbitmq',
      reason: `Data residency requirement for ${country}`,
    };
  }

  // Default: global processing via SQS
  return {
    destination: 'sqs',
    reason: 'Global processing (no data residency requirement)',
  };
};
