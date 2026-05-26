/**
 * Auth data access contract.
 * Implementations can authenticate users from memory, database, or external identity stores.
 */
import { type AuthLoginRequestDto, type AuthPrincipalDto } from '../dtos/AuthDtos.js';

export interface AuthDao {
    authenticate(credentials: AuthLoginRequestDto): Promise<AuthPrincipalDto | null>;
}