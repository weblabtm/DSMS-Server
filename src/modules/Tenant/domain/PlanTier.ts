export const PlanTier = {
    BASIC: 'BASIC',
    STANDARD: 'STANDARD',
    PREMIUM: 'PREMIUM',
} as const;

export type PlanTier = typeof PlanTier[keyof typeof PlanTier];

/**
 * Static mapping from plan tier to the list of feature flags available.
 * Feature flags are computed at runtime from this map — they are NOT stored in the DB.
 * To add/remove a feature from a plan, update this map and redeploy.
 */
export const PLAN_FEATURE_FLAGS: Record<PlanTier, string[]> = {
    BASIC: [
        'scheduling',
        'attendance',
        'students',
    ],
    STANDARD: [
        'scheduling',
        'attendance',
        'students',
        'exams',
        'instructors',
    ],
    PREMIUM: [
        'scheduling',
        'attendance',
        'students',
        'exams',
        'instructors',
        'payroll',
        'reports',
        'batches',
    ],
};

/**
 * Returns the feature flags for the given plan tier string.
 * Falls back to BASIC if the tier is unrecognised.
 */
export function getFeaturesForPlan(tier: string): string[] {
    return PLAN_FEATURE_FLAGS[tier as PlanTier] ?? PLAN_FEATURE_FLAGS.BASIC;
}

/**
 * Returns true if the given string is a valid PlanTier value.
 */
export function isValidPlanTier(tier: string): tier is PlanTier {
    return Object.values(PlanTier).includes(tier as PlanTier);
}
