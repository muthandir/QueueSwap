## Quick overview

- **TL-DR**: I created a POC to showcase queue swapping abilities. In the solution you can find:
  - A small NestJS API that publishes prescription orders to a queue and processes them with a background consumer.
  - A pluggable `IQueueService` abstraction with SQS, RabbitMQ, composite (dual-write / primary-read), and conditional routing implementations, selected via environment variables (no code changes required).
  - A prescription-specific routing rule: Turkish orders (country = `TR`) are sent to RabbitMQ (more on that later), others go to SQS.
  - A `@PublishToQueue` decorator and `QueuePublishInterceptor` that publish messages.
  - A `QueueReadinessService` that checks queue connectivity on startup, plus a `scripts/demo-prescriptions.sh` script that boots LocalStack + RabbitMQ, runs the app, sends US/TR example orders, and prints a clear, step-tagged log of the full flow.
  - I used Cursor (gpt 5.1 model) when I built this solution. 
    - Mainly in the initial setup
    - Jest tests
    - README.md 
    - Building [interceptor](src/queue/interceptors/queue-publish.interceptor.ts), [decorator](src/queue/decorators/publish-to-queue.decorator.ts),  [demo-prescriptions.sh](scripts/demo-prescriptions.sh) and some parts of Queue Services.
  - I spent roughly 3-4 hours on the solution.

- **Demo script (`scripts/demo-prescriptions.sh`)**
  - Demo scenario assumes a business rule to make the solution closer to a real world example: All queue messages for prescription requests coming from Turkey (country = TR) should be pushed to RabbitMQ (maybe because the RabbitMQ instance is hosted in Turkey and Turkey has strict data residency rules stating all data (even queue messages) should be saved within Turkey geographically).
  - The script will then do the following:
  - Starts LocalStack + RabbitMQ with Docker Compose (⚠️ Important: Docker process should be running locally)
  - Builds and runs the Nest app, 
  - Sends one US order (→ the message should end up in SQS)  
  - The notification consumer grabs the message and notification service sends a confirmation email (not an actual email but a simulation)
  - Sends one TR order (→ RabbitMQ)
  - The notification consumer grabs the message again (this time from RabbitMQ) and processes it similar to the one above.
  - Then the script filters the relevant logs and prints them. (I basically grepped specific logs to show the flow in a clean way).
  - Finally stops the app.
  - ⚠️ Important: To run ==> `chmod +x scripts/demo-prescriptions.sh` (once), then `./scripts/demo-prescriptions.sh` (again, Docker must be running).

## Solution highlights

- **Pluggable queues**: Single `IQueueService` abstraction with SQS, RabbitMQ, composite, and conditional implementations, wired via `QueueModule.forRoot/forFeature` and environment variables (no code changes to swap providers).
- **Content-based routing**: `ConditionalQueueService` + routing strategies (e.g. `prescriptionRoutingStrategy`) route messages to SQS or RabbitMQ based on `country`
- **Migration-friendly dual write**: `CompositeQueueService` dual-writes to primary + secondary queues, but reads/deletes only from the primary—useful for side-by-side migrations and DR.
- **Non-invasive publishing**: `@PublishToQueue` decorator + `QueuePublishInterceptor` publish messages at the controller boundary without coupling domain services to queue infrastructure.
- **Startup safety**: `QueueReadinessService` checks queue health with retries on app startup, failing fast if queues are not reachable.
- **End-to-end demo**: `scripts/demo-prescriptions.sh` boots infra (LocalStack + RabbitMQ), runs the app with conditional routing, sends US/TR sample orders, shows step-by-step logs, and shuts the app down.

## Running the app locally

- ⚠️ Note: The `scripts/demo-prescriptions.sh` script already takes care of building the app, starting LocalStack and RabbitMQ, sending sample requests, and showing the logs.
- The commands below are for running the application manually if you prefer not to use the script.

- **Install dependencies**

```bash
npm install
```

- **Set up environment**

```bash
cp env.example .env
```

- **Start infrastructure (LocalStack + RabbitMQ)**

```bash
docker-compose up -d localstack rabbitmq
```

- **Run the Nest app in dev mode**

```bash
npm run start:dev
# App will be on http://localhost:3000
```

- **Hit the prescriptions endpoint manually**

```bash
curl -s -X POST http://localhost:3000/prescriptions \
  -H "Content-Type: application/json" \
  -d '{
        "patientName": "John Smith",
        "patientEmail": "john.smith@example.com",
        "nhsNumber": "US-987-654-3210",
        "pharmacyId": "PHARM-US-001",
        "medications": [
          { "medicationName": "Amoxicillin", "dosage": "250mg", "quantity": "14 capsules" }
        ],
        "deliveryMethod": "delivery",
        "deliveryAddress": "123 Main St, New York, USA",
        "country": "US"
      }'
```

- **Run tests**

```bash
npm run test:e2e      # e2e routing + decorator tests
```

## Queue module and providers

- **Queue abstraction**
  - `IQueueService` defines `publishMessage`, `subscribeToMessages`, `deleteMessage`, `getQueueAttributes`.
  - Concrete implementations: SQS, RabbitMQ, Composite (both), Conditional (routing based on message).

- **QueueModule.forRoot**
  - Reads config to decide provider: `sqs` | `rabbitmq` | `all` | `conditional`.
  - Always registers:
    - `SQS_QUEUE_SERVICE` → `SqsQueueService`
    - `RABBITMQ_QUEUE_SERVICE` → `RabbitMqQueueService`
  - Exposes a root `IQueueService`:
    - `sqs` → SQS only
    - `rabbitmq` → RabbitMQ only
    - `all` → `CompositeQueueService` (dual‑write + dual‑read) Could be used in:
      - Migration / side‑by‑side cutover
      - Disaster recovery etc
    - `conditional` → `ConditionalQueueService` (routes to SQS or Rabbit based on payload).

- **QueueModule.forFeature**
  - Reuses the SQS/RabbitMQ instances via DI.
  - Per‑module `IQueueService`:
    - `sqs` → shared SQS
    - `rabbitmq` → shared Rabbit
    - `all` → `CompositeQueueService` over both
    - `conditional` → `ConditionalQueueService` with a module‑specific routing strategy.

## Routing

- **ConditionalQueueService**
  - Takes SQS + RabbitMQ services and a routing strategy function.
  - On `publishMessage`, uses the strategy to decide which queue to send to.
  - On `subscribeToMessages`, reads from both and returns a merged list.
  - On `getQueueAttributes`, returns `{ sqs, rabbitmq }`.

- **CompositeQueueService**
  - On `publishMessage`, sends to both SQS and Rabbit in parallel.
  - On `subscribeToMessages`, reads from both and merges results.
  - On `getQueueAttributes`, returns `{ primary, secondary }` from both queues.

- **Prescription routing rules**
  - Country `TR` → RabbitMQ (data residency).
  - All other cases → SQS (default / global).

## Prescriptions module

- **Queue configuration**
  - `PrescriptionsModule` imports `QueueModule.forFeature` with:
    - `provider: 'conditional'`
    - `routingStrategy: prescriptionRoutingStrategy`
  - This means prescriptions always use conditional routing, even if the root provider is something else.

- **Service**
  - `PrescriptionsService` only contains a dummy business logic.

- **Controller**
  - `POST /prescriptions`:
    - Validates `CreatePrescriptionOrderDto`.
    - Calls `createPrescriptionOrder` on the service.
    - Returns:
      - `success`
      - `message`
      - `data: { orderId, status, createdAt }`
  - The handler is decorated with `@PublishToQueue({ messageAttributes: { orderType: 'prescription' } })`.

## Decorator and interceptor

- **@PublishToQueue**
  - Implemented with `applyDecorators`:
    - Sets metadata under `PUBLISH_TO_QUEUE_KEY`.
    - Applies `QueuePublishInterceptor` using `UseInterceptors`.
  - Attached to controller methods rather than service methods, so the interceptor has HTTP context.

- **QueuePublishInterceptor**
  - Reads metadata for options (eventType, messageAttributes).
  - For HTTP requests:
    - Reads the request body (incoming DTO).
    - Reads the response payload (either `response.data` or `response`).
    - Merges both, so the message contains:
      - Input fields (e.g. `country`, `priority`, etc.).
      - Output fields (e.g. `orderId`, `status`, `createdAt`).
    - Optionally adds `eventType`.
  - Calls `IQueueService.publishMessage(mergedPayload, { messageAttributes })`.
  - Logs a short message and does not throw on failure (so queue issues do not break the HTTP response).
  - If the controller/service throws an error or returns a failed Promise, next.handle() errors out and the callback is not executed, so publishMessage is never called.

## Notifications and consumers

- **NotificationService**
  - Has a `sendOrderConfirmation` method.
  - Logs an email‑like message to stdout to simulate sending email.

- **OrderNotificationConsumer**
  - Extends `BaseQueueConsumer`.
  - Runs on a schedule and polls the queue.
  - For each message:
    - Parses the order.
    - Calls `NotificationService.sendOrderConfirmation`.
    - Decides whether to delete or keep the message, based on processing result.

## Queue readiness on startup

- **QueueReadinessService**
  - Injects `IQueueService`.
  - Implements `OnModuleInit` and runs during app startup.
  - Calls `getQueueAttributes()` in a retry loop:
    - `QUEUE_READINESS_MAX_ATTEMPTS` (default 5).
    - `QUEUE_READINESS_DELAY_MS` in ms (default 2000).
  - If all attempts fail:
    - Logs an error.
    - Throws, which causes Nest to fail startup.
  - Can be disabled with `QUEUE_READINESS_ENABLED=false`.

- **Placement**
  - Registered as a provider in `QueueModule.forRoot`, so this check runs once when the root queue module is initialized.

## Tests

- **Routing tests (`test/queue-routing.e2e-spec.ts`)**
  - Use mocked SQS and RabbitMQ services.
  - Verify that:
    - TR → RabbitMQ.
    - US → SQS.
    - default case → SQS.
    - composite (“all”) provider publishes and subscribes to both queues.

- **Decorator + routing tests (`test/decorator.e2e-spec.ts`)**
  - Build a small test module:
    - `PrescriptionsController` (real, with `@PublishToQueue` on `POST /prescriptions`).
    - `PrescriptionsService` (real).
    - `QueuePublishInterceptor` and `Reflector`.
    - `IQueueService` wired to `ConditionalQueueService(mockSqs, mockRabbit, prescriptionRoutingStrategy)`.
  - Send HTTP requests to `/prescriptions` with different payloads and assert:
    - Turkish payloads cause only RabbitMQ mock to receive `publishMessage`.
    - US payloads cause only SQS mock to receive `publishMessage`.
    - Standard payloads go to SQS.
    - Invalid payloads (validation errors) do not call either mock.
