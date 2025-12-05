import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { ThrottlerGuard } from '@nestjs/throttler';
import helmet from 'helmet';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/api-error.filter';

async function bootstrap() {
    const logger = new Logger('Bootstrap');

    // Fix BigInt serialization for JSON responses
    // @ts-ignore
    BigInt.prototype.toJSON = function () {
        return this.toString();
    };

    const app = await NestFactory.create(AppModule, {
        logger: ['error', 'warn', 'log', 'debug', 'verbose'],
    });

    const configService = app.get(ConfigService);
    const port = configService.get('API_PORT', 3001);

    // Security
    app.use(helmet());

    // Increase body limit
    app.use(json({ limit: '50mb' }));
    app.use(urlencoded({ extended: true, limit: '50mb' }));

    // CORS
    app.enableCors({
        origin: configService.get('WEB_URL', 'http://localhost:3000'),
        credentials: true,
    });

    // Global prefix
    app.setGlobalPrefix('api');

    // Global exception filter for consistent error responses
    app.useGlobalFilters(new GlobalExceptionFilter());

    // Global rate limiting guard
    app.useGlobalGuards(app.get(ThrottlerGuard));

    // Validation
    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true,
            transform: true,
            forbidNonWhitelisted: true,
            transformOptions: {
                enableImplicitConversion: true,
            },
        }),
    );

    // Swagger documentation
    const config = new DocumentBuilder()
        .setTitle('StockBoom API')
        .setDescription('Stock Trading Automation System API')
        .setVersion('1.0')
        .addBearerAuth()
        .addTag('auth', 'Authentication endpoints')
        .addTag('users', 'User management')
        .addTag('stocks', 'Stock data and quotes')
        .addTag('portfolios', 'Portfolio management')
        .addTag('trades', 'Trading operations')
        .addTag('strategies', 'Trading strategies')
        .addTag('analysis', 'Technical and AI analysis')
        .addTag('alerts', 'Alert configuration')
        .addTag('notifications', 'Notification management')
        .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);

    // Health check
    app.use('/health', (req, res) => {
        res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });

    await app.listen(port);
    logger.log(`🚀 API server is running on: http://localhost:${port}`);
    logger.log(`📚 API documentation: http://localhost:${port}/api/docs`);
}

bootstrap();
