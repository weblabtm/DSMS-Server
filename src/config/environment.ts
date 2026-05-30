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

export class EnvironmentConfig {
    public readonly port: number;

    public readonly allowedOrigins: string[];

    public readonly authSecret: string;

    public readonly databaseUrl: string;

    public readonly redisUrl: string;

    public readonly enableSwaggerDocs: boolean;

    public constructor(env: NodeJS.ProcessEnv = process.env) {
        this.port = parsePort(env.PORT, 3000);
        this.allowedOrigins = parseList(env.ALLOWED_ORIGINS);
        this.authSecret = env.AUTH_SECRET ?? 'dev-secret';
        this.databaseUrl = env.DATABASE_URL ?? '';
        this.redisUrl = env.REDIS_URL ?? '';
        this.enableSwaggerDocs = String(env.ENABLE_SWAGGER_DOCS ?? '').toLowerCase() === 'true';
    }

    public static fromProcessEnv(env: NodeJS.ProcessEnv = process.env): EnvironmentConfig {
        return new EnvironmentConfig(env);
    }
}