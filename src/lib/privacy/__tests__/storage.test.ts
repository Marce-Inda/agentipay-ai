import type { UserProfile } from '@/lib/types';
import { mergeStoredProfile, splitProfileForStorage } from '../storage';

const profile: UserProfile = {
  id: 'usr-1',
  name: 'Acme Global',
  role: 'BUSINESS',
  accountType: 'BUSINESS',
  companyOrTitle: 'Treasury',
  email: 'billing@acme.example',
  payPalAccountEmail: 'buyer@acme.example',
  taxId: 'US-EIN-94-2849102',
  legalCompanyName: 'Acme Global Inc.',
  billingAddress: '500 Financial Center Blvd',
  complianceStatus: 'VERIFIED',
};

describe('privacy storage helpers', () => {
  it('separates sensitive profile fields from the long-lived payload', () => {
    const { persistable, sensitive } = splitProfileForStorage(profile);

    expect(persistable).not.toHaveProperty('taxId');
    expect(persistable).not.toHaveProperty('billingAddress');
    expect(persistable.email).toBe(profile.email);
    expect(sensitive).toEqual({
      taxId: profile.taxId,
      billingAddress: profile.billingAddress,
    });
  });

  it('restores sensitive fields for the current browser session', () => {
    const { persistable, sensitive } = splitProfileForStorage(profile);
    const restored = mergeStoredProfile(persistable, sensitive);

    expect(restored.taxId).toBe(profile.taxId);
    expect(restored.billingAddress).toBe(profile.billingAddress);
  });

  it('ignores malformed or non-string sensitive values', () => {
    const { persistable } = splitProfileForStorage(profile);

    expect(mergeStoredProfile(persistable, null).taxId).toBeUndefined();
    expect(mergeStoredProfile(persistable, { taxId: 42 }).taxId).toBeUndefined();
    expect(mergeStoredProfile(persistable, 'invalid').billingAddress).toBeUndefined();
  });
});
