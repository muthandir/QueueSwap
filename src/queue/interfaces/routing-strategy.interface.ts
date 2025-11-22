export type QueueDestination = 'sqs' | 'rabbitmq';

export interface RoutingDecision {
  destination: QueueDestination;
  reason?: string;
}

export type RoutingStrategy = (message: any) => RoutingDecision;

export const defaultRoutingStrategy: RoutingStrategy = (): RoutingDecision => ({
  destination: 'sqs',
  reason: 'Default routing',
});
