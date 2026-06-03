/**
 * Stateless token issuer/verifier for RBAC-aware access tokens.
 * This service owns token signing, validation, and claim shaping.
 */
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';

import { type RoleName } from '../../domain/Role.js';

type TokenClock = () => number;

export type AccessTokenClaims = {
    iss: string;
    issuer: string;
    jti: string;
    sub: string;
    iat: number;
    exp: number;
    roles: RoleName[];
    tenantId?: string;
    branchId?: string;
    tokenVersion: number;
};

export type IssueAccessTokenInput = {
    subject: string;
    roles: readonly RoleName[];
    tenantId?: string;
    branchId?: string;
    tokenVersion?: number;
    issuedAt?: number;
};

export type TokenServiceOptions = {
    issuer?: string;
    accessTokenTtlSeconds?: number;
    clock?: TokenClock;
};

export class TokenService {
    private readonly issuer: string;

    private readonly accessTokenTtlSeconds: number;

    private readonly clock: TokenClock;

    public constructor(private readonly secret: string, options: TokenServiceOptions = {}) {
        this.issuer = options.issuer ?? 'dsms-server';
        this.accessTokenTtlSeconds = options.accessTokenTtlSeconds ?? 15 * 60;
        this.clock = options.clock ?? (() => Math.floor(Date.now() / 1000));
    }

    public issueAccessToken(input: IssueAccessTokenInput): string {
        const issuedAt = input.issuedAt ?? this.clock();
        const claims: AccessTokenClaims = {
            iss: this.issuer,
            issuer: this.issuer,
            jti: randomUUID(),
            sub: input.subject,
            iat: issuedAt,
            exp: issuedAt + this.accessTokenTtlSeconds,
            roles: [...input.roles],
            tokenVersion: input.tokenVersion ?? 0,
            ...(input.tenantId ? { tenantId: input.tenantId } : {}),
            ...(input.branchId ? { branchId: input.branchId } : {}),
        };

        return this.signClaims(claims);
    }

    public verifyAccessToken(token: string): AccessTokenClaims {
        const parts = token.split('.');

        if (parts.length !== 3) {
            throw new Error('Invalid access token');
        }

        const [headerPart, payloadPart, signaturePart] = parts;
        if (!headerPart || !payloadPart || !signaturePart) {
            throw new Error('Invalid access token');
        }

        const expectedSignature = this.signPayload(`${headerPart}.${payloadPart}`);
        const providedSignature = Buffer.from(signaturePart, 'utf8');
        const computedSignature = Buffer.from(expectedSignature, 'utf8');

        if (providedSignature.length !== computedSignature.length || !timingSafeEqual(providedSignature, computedSignature)) {
            throw new Error('Invalid access token signature');
        }

        const claims = JSON.parse(this.base64UrlDecode(payloadPart)) as AccessTokenClaims;

        if (claims.iss !== this.issuer && claims.issuer !== this.issuer) {
            throw new Error('Invalid token issuer');
        }

        if (claims.exp <= this.clock()) {
            throw new Error('Access token has expired');
        }

        return claims;
    }

    private signClaims(claims: AccessTokenClaims): string {
        const header = this.base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
        const payload = this.base64UrlEncode(JSON.stringify(claims));
        const signature = this.signPayload(`${header}.${payload}`);

        return `${header}.${payload}.${signature}`;
    }

    private signPayload(payload: string): string {
        return createHmac('sha256', this.secret).update(payload).digest('base64url');
    }

    private base64UrlEncode(value: string): string {
        return Buffer.from(value, 'utf8').toString('base64url');
    }

    private base64UrlDecode(value: string): string {
        return Buffer.from(value, 'base64url').toString('utf8');
    }
}