export interface IMfaTransactionStore {
    /**
     * Create a new MFA transaction.
     * @returns The generated short-lived transaction token.
     */
    createTransaction(userId: string, rememberMe?: boolean): Promise<string>;

    /**
     * Retrieve the transaction details.
     */
    getTransaction(token: string): Promise<{ userId: string; rememberMe?: boolean } | null>;

    /**
     * Mark the transaction as verified.
     */
    markVerified(token: string): Promise<void>;

    /**
     * Check if the transaction is verified.
     */
    isVerified(token: string): Promise<boolean>;

    /**
     * Delete the transaction from store.
     */
    deleteTransaction(token: string): Promise<void>;
}
