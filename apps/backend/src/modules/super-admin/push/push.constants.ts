import { QUEUE_NAMES } from '../../queue/queues';

/** BullMQ queue + job name for bulk push delivery. */
export const PUSH_QUEUE = QUEUE_NAMES.PUSH_DELIVERY;
export const PUSH_DELIVERY_JOB = 'deliver-push-notification';

/** Per-recipient batch size sent to the push provider per call. */
export const PUSH_RECIPIENT_BATCH = 500;

/** Payload schema for the BullMQ job. */
export interface PushDeliveryJobData {
  pushNotificationId: string;
}
