/**
 * @tahawash/shared-types
 *
 * Single source of truth for domain types across mobile + admin + backend.
 * Phase 0: hand-typed stubs. Phase 1: replaced/augmented with Prisma-inferred
 * types so backend and frontends stay in lockstep with the DB schema.
 *
 * Locked product reference: project memory `project_yubox_MASTER_SPEC.md`.
 */

export * from './app-version';
export * from './bay';
export * from './customer';
export * from './location';
export * from './promo';
export * from './push';
export * from './tenant';
export * from './transaction';
