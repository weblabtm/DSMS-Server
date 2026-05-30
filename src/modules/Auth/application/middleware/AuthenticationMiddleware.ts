/**
 * Express middleware that authenticates bearer tokens and builds request auth context.
 * Keep this thin so it only handles HTTP translation and delegation.
 */
import type { NextFunction, Request, Response } from 'express';

import { AccessContext } from '../../domain/AccessContext.js';
import { TokenService } from '../services/TokenService.js';

declare module 'express-serve-static-core' {
    interface Request {
        authContext?: AccessContext;
    }
}

export class AuthenticationMiddleware {
    public constructor(private readonly tokenService: TokenService) { }

    public async handle(request: Request, response: Response, next: NextFunction): Promise<void> {
        const token = this.extractBearerToken(request.headers.authorization);

        if (!token) {
            response.status(401).json({ message: 'Unauthorized' });
            return;
        }

        try {
            const claims = this.tokenService.verifyAccessToken(token);
            request.authContext = new AccessContext({
                userId: claims.sub,
                roles: claims.roles,
                tenantId: claims.tenantId,
                branchId: claims.branchId,
                tokenVersion: claims.tokenVersion,
            });
            next();
        } catch {
            response.status(401).json({ message: 'Unauthorized' });
        }
    }

    public async handleOptional(request: Request, response: Response, next: NextFunction): Promise<void> {
        if (!request.headers.authorization) {
            next();
            return;
        }

        const token = this.extractBearerToken(request.headers.authorization);

        if (!token) {
            response.status(401).json({ message: 'Unauthorized' });
            return;
        }

        try {
            const claims = this.tokenService.verifyAccessToken(token);
            request.authContext = new AccessContext({
                userId: claims.sub,
                roles: claims.roles,
                tenantId: claims.tenantId,
                branchId: claims.branchId,
                tokenVersion: claims.tokenVersion,
            });
            next();
        } catch {
            response.status(401).json({ message: 'Unauthorized' });
        }
    }

    private extractBearerToken(authorizationHeader: string | undefined): string | undefined {
        if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) {
            return undefined;
        }

        const token = authorizationHeader.slice('Bearer '.length).trim();

        return token.length > 0 ? token : undefined;
    }
}