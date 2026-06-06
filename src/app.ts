import express, { type Express, type NextFunction, type Request, type Response } from 'express';

import { EnvironmentConfig } from './config/environment.js';
import { AuthController } from './modules/Auth/presentation/controllers/AuthController.js';
import { AuthService } from './modules/Auth/application/services/AuthService.js';
import { SessionService } from './modules/Auth/application/services/SessionService.js';
import { MfaTransactionStore } from './modules/Auth/application/services/MfaTransactionStore.js';
import { PrismaSessionService } from './modules/Auth/infrastructure/PrismaSessionService.js';
import { TokenService } from './modules/Auth/application/services/TokenService.js';
import { InMemoryAuthDao } from './modules/Auth/infrastructure/InMemoryAuthDao.js';
import { PrismaAuthDao } from './modules/Auth/infrastructure/PrismaAuthDao.js';
import { createAuthRouter } from './modules/Auth/presentation/routes/authRoutes.js';
import { AuthenticationMiddleware } from './modules/Auth/application/middleware/AuthenticationMiddleware.js';
import { PermissionGuard } from './modules/Auth/application/PermissionGuard.js';
import { AuthorizationMiddleware } from './modules/Auth/application/middleware/AuthorizationMiddleware.js';
import { createTenantRouter } from './modules/Tenant/presentation/routes/tenantRoutes.js';
import { InMemoryTenantDao } from './modules/Tenant/infrastructure/InMemoryTenantDao.js';
import { ForbiddenError } from './shared/errors/ForbiddenError.js';
import { TenantService } from './modules/Tenant/application/services/TenantService.js';
import { TenantController } from './modules/Tenant/presentation/controllers/TenantController.js';
import type { PrismaClient } from './generated/prisma/client.js';
import { registerSwaggerDocs } from './docs/swagger.js';
import { RedisConnection } from './infrastructure/redis/redis-connection.js';
import { BruteForceProtectionService } from './modules/Auth/application/services/BruteForceProtectionService.js';
import { RedisBruteForceStore } from './modules/Auth/infrastructure/RedisBruteForceStore.js';
import { TurnstileCaptchaValidator } from './modules/Auth/infrastructure/captcha/TurnstileCaptchaValidator.js';
import { GoogleCaptchaValidator } from './modules/Auth/infrastructure/captcha/GoogleCaptchaValidator.js';
import { OtpService } from './modules/Auth/application/services/OtpService.js';
import { type IOtpNotificationService } from './modules/Auth/application/services/IOtpNotificationService.js';
import { CronScheduler } from './shared/infrastructure/cron/CronScheduler.js';
import { OtpCleanupCronJob } from './modules/Auth/application/services/OtpCleanupCronJob.js';

// SMS Notification Module Imports
import { ConsoleSmsProvider } from './modules/Notification/infrastructure/sms/ConsoleSmsProvider.js';
import { TwilioSmsProvider } from './modules/Notification/infrastructure/sms/TwilioSmsProvider.js';
import { TextLkSmsProvider } from './modules/Notification/infrastructure/sms/TextLkSmsProvider.js';
import { SmsNotificationService, buildAlphaSenderId } from './modules/Notification/application/services/SmsNotificationService.js';
import type { ITenantNameResolver } from './modules/Notification/application/services/ITenantNameResolver.js';
import { SmsNotificationController } from './modules/Notification/presentation/controllers/SmsNotificationController.js';
// import { createNotificationRouter } from './modules/Notification/presentation/routes/notificationRoutes.js';
import { SmsRetryWorker } from './modules/Notification/application/workers/SmsRetryWorker.js';

// Email Notification Module Imports
import { ConsoleEmailProvider } from './modules/Notification/infrastructure/email/ConsoleEmailProvider.js';
import { SendGridEmailProvider } from './modules/Notification/infrastructure/email/SendGridEmailProvider.js';
import { NodemailerEmailProvider } from './modules/Notification/infrastructure/email/NodemailerEmailProvider.js';
import { EmailNotificationService } from './modules/Notification/application/services/EmailNotificationService.js';
import { EmailRetryWorker } from './modules/Notification/application/workers/EmailRetryWorker.js';
import { NotificationService } from './modules/Notification/application/services/NotificationService.js';

type ServiceHealth = {
    status: 'connected' | 'disconnected';
    error?: string;
};

type DependencyHealth = {
    postgresql: ServiceHealth;
    redis: ServiceHealth;
};

export type DependencyHealthProvider = () => Promise<DependencyHealth>;

export class ServerApplication {
    private readonly app: Express;

    private readonly allowedOrigins: Set<string>;

    private readonly authController: AuthController;
    private readonly tenantController: TenantController;
    private readonly smsNotificationController: SmsNotificationController;
    private readonly authenticationMiddleware: AuthenticationMiddleware;
    private readonly authorizationMiddleware: AuthorizationMiddleware;
    private readonly bruteForceService: BruteForceProtectionService;

    public constructor(
        private readonly environment: EnvironmentConfig,
        prismaClient?: PrismaClient | null,
        redisConnection?: RedisConnection | null
    ) {
        this.app = express();
        this.app.set('trust proxy', true);
        this.allowedOrigins = new Set(environment.allowedOrigins);

        // Email Gateway Module (initialized early for dependency injection in AuthService)
        let emailProvider;
        if (environment.defaultEmailService === 'sendgrid') {
            emailProvider = new SendGridEmailProvider({
                apiKey: environment.sendgridApiKey,
                fromEmail: environment.sendgridFromEmail,
                fromName: environment.sendgridFromName || environment.defaultSenderName,
            });
        } else if (environment.defaultEmailService === 'nodemailer') {
            emailProvider = new NodemailerEmailProvider({
                host: environment.smtpHost,
                port: environment.smtpPort,
                secure: environment.smtpSecure,
                auth: (environment.smtpUser && environment.smtpPass) ? {
                    user: environment.smtpUser,
                    pass: environment.smtpPass,
                } : undefined,
                fromEmail: environment.smtpFromEmail,
                fromName: environment.smtpFromName || environment.defaultSenderName,
            });
        } else {
            emailProvider = new ConsoleEmailProvider();
        }

        const emailService = new EmailNotificationService(
            prismaClient as any,
            emailProvider,
            environment.enableEmail,
            environment.defaultEmailService,
            environment.defaultSenderName
        );

        const bruteForceStore = new RedisBruteForceStore(redisConnection);
        this.bruteForceService = new BruteForceProtectionService(bruteForceStore);
        const captchaValidator = new TurnstileCaptchaValidator(environment.turnstileSecretKey, environment.disableCaptcha);

        const authDao = prismaClient ? new PrismaAuthDao(prismaClient) : new InMemoryAuthDao();
        const tokenService = new TokenService(environment.authSecret ?? 'dev-secret');
        const sessionService = prismaClient ? new PrismaSessionService(prismaClient, environment.authSecret ?? 'dev-secret', redisConnection) : new SessionService();
        const permissionGuard = new PermissionGuard();
        
        const mfaTransactionStore = new MfaTransactionStore(redisConnection ? redisConnection.getClient() : null);

        const authService = new AuthService({
            tokenService,
            sessionService,
            authDao,
            permissionGuard,
            bruteForceService: this.bruteForceService,
            captchaValidator,
            emailService,
            mfaTransactionStore,
        });
        this.authenticationMiddleware = new AuthenticationMiddleware(tokenService);
        this.authorizationMiddleware = new AuthorizationMiddleware(permissionGuard);

        // tenant module
        const tenantDao = new InMemoryTenantDao();
        const tenantService = new TenantService(tenantDao as any, prismaClient ?? undefined);
        this.tenantController = new TenantController(tenantService);

        // SMS Gateway Module
        let smsProvider;
        if (environment.defaultSmsService === 'twilio') {
            smsProvider = new TwilioSmsProvider({
                accountSid: environment.twilioAccountSid,
                authToken: environment.twilioAuthToken,
                fromNumber: environment.twilioFromNumber,
                alphaId: buildAlphaSenderId(environment.defaultSenderName) || undefined,
            });
        } else if (environment.defaultSmsService === 'textlk') {
            smsProvider = new TextLkSmsProvider({
                apiToken: environment.textLkApiToken,
                defaultSenderId: environment.defaultSenderName,
            });
        } else {
            smsProvider = new ConsoleSmsProvider();
        }

        // Thin adapter: implements ITenantNameResolver (owned by Notification module)
        // wrapping TenantService (owned by Tenant module).
        // The Notification module never imports TenantService — only this interface.
        const tenantNameResolver: ITenantNameResolver = {
            async resolveNameById(tenantId: string): Promise<string | undefined> {
                try {
                    // Try by ID first, then by slug
                    const byId   = await tenantService.getTenant(tenantId);
                    if (byId?.name) return byId.name;
                    const bySlug = await tenantService.getTenantBySlug(tenantId);
                    return bySlug?.name ?? undefined;
                } catch {
                    return undefined;
                }
            },
        };

        const smsService = new SmsNotificationService(
            prismaClient as any,
            smsProvider,
            environment.smsCallbackBaseUrl,
            environment.defaultSenderName,  // system-level fallback
            tenantNameResolver,                          // Pattern 1: DIP adapter
            environment.enableSms,
            environment.defaultSmsService
        );

        this.smsNotificationController = new SmsNotificationController(
            smsService,
            environment.twilioAuthToken,
            environment.twilioValidateSignature,
            environment.smsCallbackBaseUrl
        );

        if (prismaClient) {
            const smsRetryWorker = new SmsRetryWorker(smsService);
            smsRetryWorker.start();
            this.app.locals.smsRetryWorker = smsRetryWorker;
        }

        if (prismaClient) {
            const emailRetryWorker = new EmailRetryWorker(emailService);
            emailRetryWorker.start();
            this.app.locals.emailRetryWorker = emailRetryWorker;
        }

        const notificationService = new NotificationService(
            emailService,
            smsService
        );

        // OTP notification logic (decoupled bridging wrapper using text-lk/email notification services via unified NotificationService)
        const otpNotificationService: IOtpNotificationService = {
            sendOtp: async (recipient, otp, channel, tenantId, branchId) => {
                const recipientObj = channel === 'email'
                    ? { email: recipient }
                    : { phoneNumber: recipient };

                await notificationService.sendNotification(
                    recipientObj,
                    {
                        subject: 'Your Verification Code',
                        body: `Your OTP verification code is ${otp}. It is valid for 5 minutes.`,
                    },
                    {
                        tenantId,
                        branchId,
                        channels: [channel],
                    }
                );
            }
        };

        const googleCaptchaValidator = new GoogleCaptchaValidator(
            environment.recaptchaSecretKey,
            environment.disableCaptcha
        );

        const otpService = new OtpService(authDao, otpNotificationService);
        this.authController = new AuthController(authService, otpService, googleCaptchaValidator, mfaTransactionStore);

        // Application-level scheduler for background tasks (e.g. OTP cleanup)
        const cronScheduler = new CronScheduler();
        cronScheduler.register(new OtpCleanupCronJob(authDao));
        this.app.locals.cronScheduler = cronScheduler;

        this.registerMiddleware();
        this.registerRoutes();
        this.registerDocumentation();
        this.registerNotFoundHandler();
        this.registerErrorHandler();
    }

    public getApp(): Express {
        return this.app;
    }

    private registerMiddleware(): void {
        this.app.use(this.createGlobalRateLimiterMiddleware(this.bruteForceService));
        this.app.use(express.json());
        this.app.use(express.urlencoded({ extended: true }));
        this.app.use(this.createCorsMiddleware());
    }

    private createGlobalRateLimiterMiddleware(bruteForceService: BruteForceProtectionService) {
        return async (request: Request, response: Response, next: NextFunction): Promise<void> => {
            const ip = request.ip || request.socket.remoteAddress || 'unknown';

            try {
                // 1. Check if IP is blocked
                const isBlocked = await bruteForceService.isIpBlocked(ip);
                if (isBlocked) {
                    response.status(403).json({ message: 'Access denied. IP is temporarily blocked.' });
                    return;
                }

                // 2. Enforce global request rate limits (e.g. 100 requests per minute)
                const key = `rate:ip:global:${ip}`;
                const now = Date.now();
                const limit = 100;
                await (bruteForceService as any).store.logAttempt(key, now, 60);
                const count = await (bruteForceService as any).store.getAttemptCount(key, now - 60000);

                if (count > limit) {
                    response.status(429).json({ message: 'Too many requests. Please try again later.' });
                    return;
                }

                next();
            } catch (error) {
                // Fail-safe: continue on error
                next();
            }
        };
    }

    private createOtpRateLimiterMiddleware(bruteForceService: BruteForceProtectionService) {
        return async (request: Request, response: Response, next: NextFunction): Promise<void> => {
            const ip = request.ip || request.socket.remoteAddress || 'unknown';
            try {
                const isBlocked = await bruteForceService.isIpBlocked(ip);
                if (isBlocked) {
                    response.status(403).json({ message: 'Access denied. IP is temporarily blocked.' });
                    return;
                }

                const key = `rate:ip:otp-generate:${ip}`;
                const now = Date.now();
                const windowSeconds = 600; // 10 minutes sliding window
                const limit = 5; // max 5 requests per 10 minutes

                await (bruteForceService as any).store.logAttempt(key, now, windowSeconds);
                const count = await (bruteForceService as any).store.getAttemptCount(key, now - windowSeconds * 1000);

                if (count > limit) {
                    response.status(429).json({ message: 'Too many OTP generation requests. Please try again after 10 minutes.' });
                    return;
                }

                next();
            } catch (error) {
                next();
            }
        };
    }

    private createNotFoundHandler(bruteForceService: BruteForceProtectionService) {
        return async (request: Request, response: Response): Promise<void> => {
            const ip = request.ip || request.socket.remoteAddress || 'unknown';
            try {
                const blocked = await bruteForceService.register404(ip);
                if (blocked) {
                    response.status(403).json({ message: 'Access denied. IP is blocked due to path scanning.' });
                    return;
                }
            } catch (error) {
                console.error('[notFoundHandler] 404 logging error:', error);
            }

            response.status(404).json({
                message: 'Route not found',
            });
        };
    }

    private registerRoutes(): void {
        this.app.get('/', (_request, response) => {
            response.status(200).json({
                status: 'ok',
                message: 'Server is live',
            });
        });

        this.app.get('/config', this.clientConfigHandler.bind(this));

        this.app.get('/health', this.healthCheckHandler);

        // Public slug availability check so registration can probe before authentication exists.
        this.app.get('/tenant/slug/:slug/availability', this.tenantController.checkSlugAvailability.bind(this.tenantController));

        const otpRateLimiter = this.createOtpRateLimiterMiddleware(this.bruteForceService);
        const authRouter = createAuthRouter(this.authController, this.authenticationMiddleware, otpRateLimiter);
        this.app.use('/auth', authRouter);

        const tenantRouter = createTenantRouter(this.tenantController, this.authorizationMiddleware);
        this.app.use('/tenant', this.authenticationMiddleware.handle.bind(this.authenticationMiddleware), tenantRouter);

        // CRITICAL WARNING: Notification endpoints must NOT be exposed at any cost by mounting them in the app.
        // As per the architecture (refer to developer-guide.md in the Notification module), notifications 
        // must be triggered exclusively via in-app polymorphic NotificationSender method calls.
        // DO NOT mount the notificationRouter or its associated middlewares.
        //
        // const notificationRouter = createNotificationRouter(this.smsNotificationController, this.authenticationMiddleware, this.authorizationMiddleware);
        // this.app.use('/notifications', notificationRouter);
    }

    private registerDocumentation(): void {
        if (!this.environment.enableSwaggerDocs) {
            return;
        }

        registerSwaggerDocs(this.app);
    }

    private registerNotFoundHandler(): void {
        this.app.use(this.createNotFoundHandler(this.bruteForceService));
    }

    private registerErrorHandler(): void {
        this.app.use(this.errorHandler);
    }

    private isOriginAllowed(origin: string): boolean {
        if (this.allowedOrigins.has('*') || this.allowedOrigins.has(origin)) {
            return true;
        }

        for (const allowedOrigin of this.allowedOrigins) {
            if (!allowedOrigin.includes('*')) {
                continue;
            }

            const escapedPattern = allowedOrigin.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\*/g, '.*');
            const originPattern = new RegExp(`^${escapedPattern}$`);

            if (originPattern.test(origin)) {
                return true;
            }
        }

        return false;
    }

    private createCorsMiddleware() {
        return (request: Request, response: Response, next: NextFunction) => {
            const origin = request.headers.origin;

            if (typeof origin === 'string' && this.isOriginAllowed(origin)) {
                response.setHeader('Access-Control-Allow-Origin', origin);
                response.setHeader('Vary', 'Origin');
            }

            response.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS');
            response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
            response.setHeader('Access-Control-Allow-Credentials', 'true');

            if (request.method === 'OPTIONS') {
                response.sendStatus(204);
                return;
            }

            next();
        };
    }

    private async healthCheckHandler(request: Request, response: Response): Promise<void> {
        const provider = request.app.locals.dependencyHealthProvider as DependencyHealthProvider | undefined;

        if (!provider) {
            response.status(200).json({
                status: 'ok',
                message: 'Server is running',
            });
            return;
        }

        try {
            const dependencies = await provider();
            const hasError = dependencies.postgresql.status !== 'connected' || dependencies.redis.status !== 'connected';

            response.status(hasError ? 503 : 200).json({
                status: hasError ? 'error' : 'ok',
                message: hasError ? 'One or more dependencies are unavailable' : 'Server is running',
                dependencies,
            });
        } catch (error) {
            response.status(503).json({
                status: 'error',
                message: 'Unable to determine dependency status',
                dependencies: {
                    postgresql: {
                        status: 'disconnected',
                        error: 'Health check failed',
                    },
                    redis: {
                        status: 'disconnected',
                        error: 'Health check failed',
                    },
                },
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }

    private clientConfigHandler(request: Request, response: Response): void {
        response.status(200).json({
            apiBaseUrl: `${request.protocol}://${request.get('host') ?? 'localhost'}`,
            hostname: request.hostname,
        });
    }

    private errorHandler(error: unknown, _request: Request, response: Response, _next: NextFunction): void {
        const prismaError = typeof error === 'object' && error !== null ? (error as { code?: string; message?: string }) : undefined;

        if (error instanceof ForbiddenError) {
            response.status(error.statusCode).json({
                message: error.message,
            });
            return;
        }

        if (prismaError?.code === 'P2021') {
            response.status(503).json({
                message: 'Database schema is not initialized. Run Prisma migrations for the configured DATABASE_URL.',
                code: prismaError.code,
            });
            return;
        }

        response.status(500).json({
            message: 'Internal Server Error',
            ...(prismaError?.code ? { code: prismaError.code } : {}),
            ...(prismaError?.message ? { error: prismaError.message } : {}),
        });
    }
}
