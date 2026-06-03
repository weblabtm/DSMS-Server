import type { Request, Response, NextFunction } from 'express';
import { PermissionGuard } from '../PermissionGuard.js';
import { ForbiddenError } from '../../../../shared/errors/ForbiddenError.js';

export class AuthorizationMiddleware {
    public constructor(private readonly permissionGuard: PermissionGuard) { }

    /**
     * Reusable middleware factory to assert permission keys on routes.
     */
    public require(permissionKey: string) {
        return (request: Request, response: Response, next: NextFunction): void => {
            const authContext = request.authContext;

            if (!authContext) {
                response.status(401).json({ message: 'Unauthorized' });
                return;
            }

            // Super Admin bypasses all checks
            if (authContext.isSuperAdmin()) {
                next();
                return;
            }

            let hasPermission = false;
            for (const role of authContext.roles) {
                if (this.permissionGuard.can(role, permissionKey)) {
                    hasPermission = true;
                    break;
                }
            }

            if (!hasPermission) {
                throw new ForbiddenError(`Forbidden: missing required permission "${permissionKey}"`);
            }

            next();
        };
    }
}
