import { describe, expect, it, vi } from 'vitest';
import { AuthorizationMiddleware } from '../../../../src/modules/Auth/application/middleware/AuthorizationMiddleware.js';
import { PermissionGuard } from '../../../../src/modules/Auth/application/PermissionGuard.js';
import { AccessContext } from '../../../../src/modules/Auth/domain/AccessContext.js';
import { ForbiddenError } from '../../../../src/shared/errors/ForbiddenError.js';

describe('AuthorizationMiddleware', () => {
    it('allows access to Super Admin', async () => {
        const guard = new PermissionGuard();
        const middleware = new AuthorizationMiddleware(guard);
        const req = {
            authContext: new AccessContext({
                userId: 'admin-1',
                roles: ['Super Admin'],
            }),
        };
        const res = {};
        const next = vi.fn();

        middleware.require('tenant.manage')(req as never, res as never, next);

        expect(next).toHaveBeenCalledOnce();
    });

    it('allows access to role with permission', async () => {
        const guard = new PermissionGuard();
        const middleware = new AuthorizationMiddleware(guard);
        const req = {
            authContext: new AccessContext({
                userId: 'manager-1',
                roles: ['Branch Manager'],
            }),
        };
        const res = {};
        const next = vi.fn();

        // Branch Manager has student.manage
        middleware.require('student.manage')(req as never, res as never, next);

        expect(next).toHaveBeenCalledOnce();
    });

    it('throws ForbiddenError when role lacks permission', async () => {
        const guard = new PermissionGuard();
        const middleware = new AuthorizationMiddleware(guard);
        const req = {
            authContext: new AccessContext({
                userId: 'student-1',
                roles: ['Student'],
            }),
        };
        const res = {};
        const next = vi.fn();

        // Student does not have student.manage
        expect(() => {
            middleware.require('student.manage')(req as never, res as never, next);
        }).toThrow(ForbiddenError);

        expect(next).not.toHaveBeenCalled();
    });
});
