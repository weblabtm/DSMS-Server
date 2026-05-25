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

export const environment = {
    port: parsePort(process.env.PORT, 3000),
    allowedOrigins: parseList(process.env.ALLOWED_ORIGINS),
    databaseUrl: process.env.DATABASE_URL ?? '',
    redisUrl: process.env.REDIS_URL ?? '',
};