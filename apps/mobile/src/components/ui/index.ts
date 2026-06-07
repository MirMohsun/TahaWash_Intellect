/**
 * UI primitives — single re-export so screens can do:
 *   import { Button, Card, Pill, Icon } from '@/components/ui';
 *
 * Built in Phase 2.1 from the locked design system. New primitives
 * (Sheet, Modal, Input, etc.) get added here as later phases need them.
 */

export { BackButton } from './BackButton';
export { Button, type ButtonSize, type ButtonVariant } from './Button';
export { Card } from './Card';
export { DialogProvider, useDialog } from './Dialog';
export { FilterChip, FilterSheet } from './FilterSheet';
export { Icon, type IconName } from './Icon';
export { Pill } from './Pill';
export { RemoteImage } from './RemoteImage';
export { Skeleton } from './Skeleton';
export { TenantMark } from './TenantMark';
