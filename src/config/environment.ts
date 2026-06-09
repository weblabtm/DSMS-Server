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

    public readonly enableSms: boolean;

    public readonly defaultSmsService: 'twilio' | 'textlk' | 'console';

    public readonly smsCallbackBaseUrl: string;

    public readonly defaultSenderName: string;

    public readonly twilioAccountSid: string;

    public readonly twilioAuthToken: string;

    public readonly twilioFromNumber: string;

    public readonly twilioValidateSignature: boolean;

    public readonly textLkApiToken: string;

    public readonly enableEmail: boolean;

    public readonly defaultEmailService: 'sendgrid' | 'nodemailer' | 'console';

    public readonly sendgridApiKey: string;

    public readonly sendgridFromEmail: string;

    public readonly sendgridFromName: string;

    public readonly smtpHost: string;

    public readonly smtpPort: number;

    public readonly smtpSecure: boolean;

    public readonly smtpUser: string;

    public readonly smtpPass: string;

    public readonly smtpFromEmail: string;

    public readonly smtpFromName: string;

    public readonly turnstileSecretKey: string;

    public readonly recaptchaSecretKey: string;

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

        // Outbound SMS & Twilio / TextLk Setup
        this.enableSms = parseBoolean(env.ENABLE_SMS, true);
        const rawProvider = env.DEFAULT_SMS_SERVICE?.toLowerCase();
        if (rawProvider === 'twilio') {
            this.defaultSmsService = 'twilio';
        } else if (rawProvider === 'textlk') {
            this.defaultSmsService = 'textlk';
        } else {
            this.defaultSmsService = 'console';
        }
        this.smsCallbackBaseUrl = env.SMS_CALLBACK_BASE_URL ?? 'http://localhost:3000';
        this.defaultSenderName = env.DEFAULT_SENDER_NAME ?? 'WEBBLAB';
        this.twilioAccountSid = env.TWILIO_ACCOUNT_SID ?? '';
        this.twilioAuthToken = env.TWILIO_AUTH_TOKEN ?? '';
        this.twilioFromNumber = env.TWILIO_FROM_NUMBER ?? '';
        this.twilioValidateSignature = parseBoolean(env.TWILIO_VALIDATE_SIGNATURE, false);

        this.textLkApiToken = env.TEXT_LK_API_TOKEN ?? '';

        // Outbound Email & SendGrid/Nodemailer Setup
        this.enableEmail = parseBoolean(env.ENABLE_EMAIL, true);
        const rawEmailProvider = (env.DEFAULT_EMAIL_SERVICE ?? env.EMAIL_PROVIDER_TYPE)?.toLowerCase();
        if (rawEmailProvider === 'sendgrid') {
            this.defaultEmailService = 'sendgrid';
        } else if (rawEmailProvider === 'nodemailer') {
            this.defaultEmailService = 'nodemailer';
        } else {
            this.defaultEmailService = 'console';
        }

        this.sendgridApiKey = env.SENDGRID_API_KEY ?? '';
        this.sendgridFromEmail = env.SENDGRID_FROM_EMAIL ?? '';
        this.sendgridFromName = env.SENDGRID_FROM_NAME ?? 'DSMS';

        this.smtpHost = env.SMTP_HOST ?? '';
        this.smtpPort = parsePort(env.SMTP_PORT, 587);
        this.smtpSecure = parseBoolean(env.SMTP_SECURE, false);
        this.smtpUser = env.SMTP_USER ?? '';
        this.smtpPass = env.SMTP_PASS ?? '';
        this.smtpFromEmail = env.SMTP_FROM_EMAIL ?? '';
        this.smtpFromName = env.SMTP_FROM_NAME ?? 'DSMS';

        // CAPTCHA Setup
        this.turnstileSecretKey = env.TURNSTILE_SECRET_KEY ?? '';
        this.recaptchaSecretKey = env.GOOGLE_reCAPTCHA_SECRET_KEY ?? '';
        this.disableCaptcha = parseBoolean(env.DISABLE_CAPTCHA, true);
    }

    public static fromProcessEnv(env: NodeJS.ProcessEnv = process.env): EnvironmentConfig {
        return new EnvironmentConfig(env);
    }
}