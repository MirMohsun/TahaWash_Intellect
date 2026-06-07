/**
 * Canonical queue names. Producers and consumers must import from here so
 * there's a single source of truth for queue identifiers — typos in queue
 * names produce queues that nothing consumes (silent dead letters).
 */
export const QUEUE_NAMES = {
  /** Bulk push notification delivery (super-admin → many customers). Phase 1.10. */
  PUSH_DELIVERY: 'push-delivery',
  /** Transactional email send. Phase 1.9. */
  EMAIL: 'email',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];
