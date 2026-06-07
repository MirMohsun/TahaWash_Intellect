import {
  Injectable,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { ANONYMOUS_ACTOR, type Actor } from './actor.types';
import { RequestContext } from './request-context';

/**
 * Wraps every HTTP request in an AsyncLocalStorage context populated with the
 * authenticated Actor (or anonymous).
 *
 * Registered globally in AppModule via APP_INTERCEPTOR. Must run AFTER any
 * auth guard so `request.user` is set; NestJS runs guards before interceptors
 * so this ordering is correct by default.
 *
 * The actor read by the Prisma scoping extension comes from RequestContext —
 * this is what makes it Just Work without prop-drilling through every service.
 */
@Injectable()
export class RequestContextInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<{ user?: Actor }>();
    const actor: Actor = request.user ?? ANONYMOUS_ACTOR;

    return new Observable((subscriber) => {
      RequestContext.run(actor, () => {
        const sub = next.handle().subscribe({
          next: (v) => subscriber.next(v),
          error: (e) => subscriber.error(e),
          complete: () => subscriber.complete(),
        });
        return () => sub.unsubscribe();
      });
    });
  }
}
