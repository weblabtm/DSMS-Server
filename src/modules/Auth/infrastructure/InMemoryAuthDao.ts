/**
 * Simple in-memory Auth DAO used for local development and tests.
 * Replace this with a database-backed implementation when persistence is ready.
 */
import { type AuthDao } from '../application/dao/AuthDao.js';
import { type AuthLoginRequestDto, type AuthPrincipalDto, type AuthRegisterRequestDto } from '../application/dtos/AuthDtos.js';

type AuthSeed = AuthPrincipalDto & {
    identifier: string;
    password: string;
};

export class InMemoryAuthDao implements AuthDao {
    private readonly usersByIdentifier = new Map<string, AuthSeed>();

    public constructor(seedUsers: AuthSeed[] = []) {
        for (const user of seedUsers) {
            this.usersByIdentifier.set(user.identifier, user);
        }
    }

    public async authenticate(credentials: AuthLoginRequestDto): Promise<AuthPrincipalDto | null> {
        const user = this.usersByIdentifier.get(credentials.identifier);

        if (!user || user.password !== credentials.password) {
            return null;
        }

        if (credentials.tenantId && user.tenantId && credentials.tenantId !== user.tenantId) {
            return null;
        }

        if (credentials.branchId && user.branchId && credentials.branchId !== user.branchId) {
            return null;
        }

        const { identifier: _identifier, password: _password, ...principal } = user;

        return principal;
    }

    public async register(account: AuthRegisterRequestDto): Promise<AuthPrincipalDto> {
        if (this.usersByIdentifier.has(account.identifier)) {
            throw new Error('Account already exists');
        }

        const principal: AuthSeed = {
            identifier: account.identifier,
            password: account.password,
            userId: `user-${this.usersByIdentifier.size + 1}`,
            roles: ['Student'],
            ...(account.tenantId ? { tenantId: account.tenantId } : {}),
            ...(account.branchId ? { branchId: account.branchId } : {}),
        };

        this.usersByIdentifier.set(account.identifier, principal);

        const { identifier: _identifier, password: _password, ...authPrincipal } = principal;

        return authPrincipal;
    }
}