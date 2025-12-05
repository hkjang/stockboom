import {
    ExceptionFilter,
    Catch,
    ArgumentsHost,
    HttpException,
    HttpStatus,
    Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

export interface ApiErrorResponse {
    statusCode: number;
    message: string;
    error: string;
    code?: string;
    timestamp: string;
    path: string;
    method: string;
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
    private readonly logger = new Logger(GlobalExceptionFilter.name);

    catch(exception: unknown, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();
        const request = ctx.getRequest<Request>();

        let status = HttpStatus.INTERNAL_SERVER_ERROR;
        let message = 'Internal server error';
        let error = 'Internal Server Error';
        let code: string | undefined;

        if (exception instanceof HttpException) {
            status = exception.getStatus();
            const exceptionResponse = exception.getResponse();

            if (typeof exceptionResponse === 'string') {
                message = exceptionResponse;
            } else if (typeof exceptionResponse === 'object') {
                const responseObj = exceptionResponse as Record<string, unknown>;
                message = (responseObj.message as string) || message;
                error = (responseObj.error as string) || error;
                code = responseObj.code as string | undefined;
            }
        } else if (exception instanceof Error) {
            message = exception.message;

            // Log unhandled errors
            this.logger.error(
                `Unhandled exception: ${exception.message}`,
                exception.stack
            );
        }

        // Map status to error name
        error = this.getErrorName(status);

        const errorResponse: ApiErrorResponse = {
            statusCode: status,
            message,
            error,
            code,
            timestamp: new Date().toISOString(),
            path: request.url,
            method: request.method,
        };

        // Log error details
        if (status >= 500) {
            this.logger.error(
                `${request.method} ${request.url} - ${status} - ${message}`,
                exception instanceof Error ? exception.stack : undefined
            );
        } else if (status >= 400) {
            this.logger.warn(`${request.method} ${request.url} - ${status} - ${message}`);
        }

        response.status(status).json(errorResponse);
    }

    private getErrorName(status: number): string {
        const statusNames: Record<number, string> = {
            400: 'Bad Request',
            401: 'Unauthorized',
            403: 'Forbidden',
            404: 'Not Found',
            405: 'Method Not Allowed',
            408: 'Request Timeout',
            409: 'Conflict',
            422: 'Unprocessable Entity',
            429: 'Too Many Requests',
            500: 'Internal Server Error',
            502: 'Bad Gateway',
            503: 'Service Unavailable',
            504: 'Gateway Timeout',
        };
        return statusNames[status] || 'Error';
    }
}
