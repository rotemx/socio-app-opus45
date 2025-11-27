import { type ArgumentsHost, Catch, Logger } from '@nestjs/common';
import { BaseWsExceptionFilter, WsException } from '@nestjs/websockets';
import { type Socket } from 'socket.io';

/**
 * Standard WebSocket error response structure
 */
export interface WsErrorResponse {
  event: 'error';
  data: {
    code: string;
    message: string;
    details?: unknown;
  };
}

/**
 * Exception filter for WebSocket connections
 * Emits errors to the client in a standard format
 */
@Catch(WsException)
export class WsExceptionFilter extends BaseWsExceptionFilter {
  private readonly logger = new Logger(WsExceptionFilter.name);

  catch(exception: WsException, host: ArgumentsHost): void {
    const client: Socket = host.switchToWs().getClient();
    const error = exception.getError();

    let message = 'WebSocket error';
    let code = 'WS_ERROR';
    let details: unknown = undefined;

    if (typeof error === 'string') {
      message = error;
    } else if (typeof error === 'object') {
      const errorObj = error as Record<string, unknown>;
      message = (errorObj.message as string) || message;
      code = (errorObj.code as string) || code;
      details = errorObj.details;
    }

    this.logger.error(`WebSocket error for client ${client.id}: ${message}`);

    const errorResponse: WsErrorResponse = {
      event: 'error',
      data: details
        ? { code, message, details }
        : { code, message },
    };

    client.emit('error', errorResponse);
  }
}
