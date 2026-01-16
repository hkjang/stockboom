import { Injectable, LoggerService as NestLoggerService } from '@nestjs/common';
import { createLogger, format, transports, Logger } from 'winston';
import * as path from 'path';

const { combine, timestamp, printf, colorize, errors, json } = format;

// Custom format for console output
const consoleFormat = printf(({ level, message, timestamp, context, trace, ...meta }) => {
  let msg = `${timestamp} [${level.toUpperCase()}]`;
  if (context) {
    msg += ` [${context}]`;
  }
  msg += ` ${message}`;
  if (Object.keys(meta).length > 0) {
    msg += ` ${JSON.stringify(meta)}`;
  }
  if (trace) {
    msg += `\n${trace}`;
  }
  return msg;
});

// Custom format for JSON logs (production)
const jsonFormat = combine(
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  errors({ stack: true }),
  json(),
);

@Injectable()
export class LoggerService implements NestLoggerService {
  private logger: Logger;
  private context: string = 'Application';

  constructor() {
    const isDevelopment = process.env.NODE_ENV !== 'production';
    const logDir = process.env.LOG_DIR || 'logs';

    this.logger = createLogger({
      level: process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info'),
      transports: [
        // Console transport
        new transports.Console({
          format: isDevelopment
            ? combine(
                colorize({ all: true }),
                timestamp({ format: 'HH:mm:ss.SSS' }),
                consoleFormat,
              )
            : jsonFormat,
        }),
        // File transport for errors
        new transports.File({
          filename: path.join(logDir, 'error.log'),
          level: 'error',
          format: jsonFormat,
          maxsize: 10 * 1024 * 1024, // 10MB
          maxFiles: 5,
        }),
        // File transport for combined logs
        new transports.File({
          filename: path.join(logDir, 'combined.log'),
          format: jsonFormat,
          maxsize: 10 * 1024 * 1024, // 10MB
          maxFiles: 10,
        }),
      ],
    });
  }

  setContext(context: string) {
    this.context = context;
    return this;
  }

  log(message: string, context?: string, ...meta: any[]) {
    this.logger.info(message, { context: context || this.context, ...this.extractMeta(meta) });
  }

  error(message: string, trace?: string, context?: string) {
    this.logger.error(message, { context: context || this.context, trace });
  }

  warn(message: string, context?: string, ...meta: any[]) {
    this.logger.warn(message, { context: context || this.context, ...this.extractMeta(meta) });
  }

  debug(message: string, context?: string, ...meta: any[]) {
    this.logger.debug(message, { context: context || this.context, ...this.extractMeta(meta) });
  }

  verbose(message: string, context?: string, ...meta: any[]) {
    this.logger.verbose(message, { context: context || this.context, ...this.extractMeta(meta) });
  }

  // Specialized logging methods for trading operations
  logTrade(action: string, data: Record<string, any>) {
    this.logger.info(`[TRADE] ${action}`, {
      context: 'Trading',
      ...data,
      timestamp: new Date().toISOString(),
    });
  }

  logApiCall(method: string, url: string, duration: number, status: number) {
    this.logger.info(`[API] ${method} ${url}`, {
      context: 'API',
      duration: `${duration}ms`,
      status,
    });
  }

  logMarketData(source: string, symbol: string, action: string) {
    this.logger.debug(`[MARKET] ${source} - ${action}`, {
      context: 'MarketData',
      symbol,
    });
  }

  logSecurityEvent(event: string, userId?: string, details?: Record<string, any>) {
    this.logger.warn(`[SECURITY] ${event}`, {
      context: 'Security',
      userId,
      ...details,
    });
  }

  private extractMeta(meta: any[]): Record<string, any> {
    if (meta.length === 0) return {};
    if (meta.length === 1 && typeof meta[0] === 'object') return meta[0];
    return { additionalInfo: meta };
  }
}

// Factory function for creating child loggers
export function createChildLogger(parentLogger: LoggerService, context: string): LoggerService {
  const childLogger = Object.create(parentLogger);
  childLogger.context = context;
  return childLogger;
}
