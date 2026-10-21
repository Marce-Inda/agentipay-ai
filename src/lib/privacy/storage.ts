import type { UserProfile } from '@/lib/types';

export const PROFILE_STORAGE_KEY = 'agenticpay_profile_v2';
export const SECURE_PROFILE_STORAGE_KEY = 'agenticpay_profile_secure_v1';

export type SensitiveProfileFields = Pick<UserProfile, 'taxId' | 'billingAddress'>;

export function splitProfileForStorage(profile: UserProfile): {
  persistable: UserProfile;
  sensitive: SensitiveProfileFields;
} {
  const { taxId, billingAddress, ...rest } = profile;

  return {
    persistable: rest,
    sensitive: { taxId, billingAddress },
  };
}

export function mergeStoredProfile(profile: UserProfile, sensitive: unknown): UserProfile {
  if (!sensitive || typeof sensitive !== 'object') return profile;

  const candidate = sensitive as Record<string, unknown>;

  return {
    ...profile,
    taxId: typeof candidate.taxId === 'string' ? candidate.taxId : profile.taxId,
    billingAddress:
      typeof candidate.billingAddress === 'string' ? candidate.billingAddress : profile.billingAddress,
  };
}
