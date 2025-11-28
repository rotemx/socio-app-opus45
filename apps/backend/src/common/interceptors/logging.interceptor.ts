import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  Logger,
  type NestInterceptor,
} from '@nestjs/common';
import { type Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

/**
 * Interceptor for logging HTTP requests and responses
 * Logs request method, URL, execution time, and response status
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const { method, url, ip } = request;
    const userAgent = request.get('user-agent') || '';
    const now = Date.now();

    this.logger.log(`[${method}] ${url} - ${ip} - ${userAgent}`);

    return next.handle().pipe(
      tap({
        next: () => {
          const response = context.switchToHttp().getResponse();
          const { statusCode } = response;
          const contentLength =
            response.getHeader?.('content-length') ?? response.get?.('content-length');
          const duration = Date.now() - now;

          this.logger.log(
            `[${method}] ${url} - ${statusCode} - ${contentLength || 0}B - ${duration}ms`
          );
        },
        error: (error: Error) => {
          const duration = Date.now() - now;
          this.logger.error(`[${method}] ${url} - ERROR - ${duration}ms - ${error.message}`);
        },
      })
    );
  }
}
