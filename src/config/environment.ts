const parseList = (value: string | undefined): string[] => {
    if (!value) {
        return [];
    }

    return value
        .split(',')
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0);
};

const parsePort = (value: string | undefined, fallback: number): number => {
    const parsed = Number(value);

    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const parseBoolean = (value: string | undefined, fallback = false): boolean => {
    if (value === undefined) {
        return fallback;
    }

    return String(value).trim().toLowerCase() === 'true';
};

export class EnvironmentConfig {
    public readonly port: number;

    public readonly allowedOrigins: string[];

    public readonly authSecret: string;

    public readonly databaseUrl: string;

    public readonly redisUrl: string;

    public readonly minioEndpoint: string;

    public readonly minioPort: number;

    public readonly minioUseSSL: boolean;

    public readonly minioAccessKey: string;

    public readonly minioSecretKey: string;

    public readonly minioBucket: string;

    public readonly minioRegion: string;

    public readonly minioBucketPolicy: 'private' | 'public-read';

    public readonly enableSwaggerDocs: boolean;

    public readonly smsProviderType: 'twilio' | 'console';

    public readonly smsCallbackBaseUrl: string;

    public readonly twilioAccountSid: string;

    public readonly twilioAuthToken: string;

    public readonly twilioFromNumber: string;

    public readonly twilioValidateSignature: boolean;

    public readonly emailProviderType: 'sendgrid' | 'console';

    public readonly sendgridApiKey: string;

    public readonly sendgridFromEmail: string;

    public readonly sendgridFromName: string;

    public readonly turnstileSecretKey: string;

    public readonly disableCaptcha: boolean;

    public constructor(env: NodeJS.ProcessEnv = process.env) {
        this.port = parsePort(env.PORT, 3000);
        this.allowedOrigins = parseList(env.ALLOWED_ORIGINS);
        this.authSecret = env.AUTH_SECRET ?? 'dev-secret';
        this.databaseUrl = env.DATABASE_URL ?? '';
        this.redisUrl = env.REDIS_URL ?? '';
        this.minioEndpoint = env.MINIO_ENDPOINT ?? '';
        this.minioPort = parsePort(env.MINIO_PORT, 9000);
        this.minioUseSSL = parseBoolean(env.MINIO_USE_SSL, false);
        this.minioAccessKey = env.MINIO_ACCESS_KEY ?? '';
        this.minioSecretKey = env.MINIO_SECRET_KEY ?? '';
        this.minioBucket = env.MINIO_BUCKET ?? '';
        this.minioRegion = env.MINIO_REGION ?? 'us-east-1';
        this.minioBucketPolicy = env.MINIO_BUCKET_POLICY === 'public-read' ? 'public-read' : 'private';
        this.enableSwaggerDocs = String(env.ENABLE_SWAGGER_DOCS ?? '').toLowerCase() === 'true';

        // Outbound SMS & Twilio Setup
        this.smsProviderType = (env.SMS_PROVIDER_TYPE === 'twilio' ? 'twilio' : 'console') as 'twilio' | 'console';
        this.smsCallbackBaseUrl = env.SMS_CALLBACK_BASE_URL ?? 'http://localhost:3000';
        this.twilioAccountSid = env.TWILIO_ACCOUNT_SID ?? '';
        this.twilioAuthToken = env.TWILIO_AUTH_TOKEN ?? '';
        this.twilioFromNumber = env.TWILIO_FROM_NUMBER ?? '';
        this.twilioValidateSignature = parseBoolean(env.TWILIO_VALIDATE_SIGNATURE, false);

        // Outbound Email & SendGrid Setup
        this.emailProviderType = (env.EMAIL_PROVIDER_TYPE === 'sendgrid' ? 'sendgrid' : 'console') as 'sendgrid' | 'console';
        this.sendgridApiKey = env.SENDGRID_API_KEY ?? '';
        this.sendgridFromEmail = env.SENDGRID_FROM_EMAIL ?? '';
        this.sendgridFromName = env.SENDGRID_FROM_NAME ?? 'DSMS';

        // CAPTCHA Setup
        this.turnstileSecretKey = env.TURNSTILE_SECRET_KEY ?? '';
        this.disableCaptcha = parseBoolean(env.DISABLE_CAPTCHA, true);
    }

    public static fromProcessEnv(env: NodeJS.ProcessEnv = process.env): EnvironmentConfig {
        return new EnvironmentConfig(env);
    }
}