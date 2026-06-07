import { AsyncLocalStorage } from 'node:async_hooks';
import { ANONYMOUS_ACTOR, type Actor } from './actor.types';

interface ContextStore {
  actor: Actor;
  /**
   * When true, Prisma extension SKIPS auto-scoping. Used very sparingly —
   * super-admin endpoints, scheduled jobs, system operations.
   */
  bypassScoping: boolean;
}

/**
 * Request-scoped context backed by Node's AsyncLocalStorage.
 *
 * Set by RequestContextInterceptor at the start of every HTTP request.
 * Read by the Prisma scoping extension (and any service that needs to
 * know "who am I currently serving?") without prop-drilling.
 *
 * AsyncLocalStorage propagates correctly across async/await boundaries,
 * so this is safe to read from deep inside Prisma callbacks.
 */
export class RequestContext {
  private static readonly als = new AsyncLocalStorage<ContextStore>();

  /** Run `fn` with the given actor set as current context. */
  static run<T>(actor: Actor, fn: () => T): T {
    return this.als.run({ actor, bypassScoping: false }, fn);
  }

  /**
   * Run `fn` in a context with no actor — used by background jobs that have
   * no end-user actor (cron, queue workers, etc.). Combine with `withBypass`
   * if the job legitimately needs to read across tenants.
   */
  static runSystem<T>(fn: () => T): T {
    return this.als.run({ actor: ANONYMOUS_ACTOR, bypassScoping: false }, fn);
  }

  /**
   * Temporarily bypass tenant scoping inside the callback. Use sparingly
   * and ONLY in code paths that have already verified the caller's
   * authority (e.g. super-admin endpoints).
   */
  static async withBypass<T>(fn: () => Promise<T>): Promise<T> {
    const store = this.als.getStore();
    if (!store) {
      // No request context yet — start a fresh anonymous + bypass context.
      return this.als.run({ actor: ANONYMOUS_ACTOR, bypassScoping: true }, fn);
    }
    const prev = store.bypassScoping;
    store.bypassScoping = true;
    try {
      return await fn();
    } finally {
      store.bypassScoping = prev;
    }
  }

  /** The current actor, or anonymous if no context is active. */
  static current(): Actor {
    return this.als.getStore()?.actor ?? ANONYMOUS_ACTOR;
  }

  /** The current actor, or throw if anonymous. Useful inside guarded handlers. */
  static currentOrThrow(): Actor {
    const actor = this.current();
    if (actor.type === 'anonymous') {
      throw new Error('RequestContext.currentOrThrow() called with no authenticated actor.');
    }
    return actor;
  }

  static isScopingBypassed(): boolean {
    return this.als.getStore()?.bypassScoping ?? false;
  }
}
