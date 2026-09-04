/**
 * Prospectus - License Service
 * Handles user license activation (Gumroad & ZIP distribution format validation)
 * and local license state management. (No free trial).
 */

const ACTIVATION_KEYS = [
  'PRS-8F2A-4D9C-7B1E',
  'PRS-5E3B-9A7D-2C6F'
];

class LicenseService {
  constructor(storageService) {
    this.storage = storageService || (typeof window !== 'undefined' ? window.ProspectusStorage : null);
  }

  static get VALID_KEYS() {
    return ACTIVATION_KEYS;
  }

  static isKeyValid(key) {
    if (!key || typeof key !== 'string') return false;
    return ACTIVATION_KEYS.includes(key.trim().toUpperCase());
  }

  /**
   * Validate an activation key.
   * Only the authorized activation keys are accepted.
   */
  async verifyLicenseKey(licenseKey) {
    const key = (licenseKey || '').trim().toUpperCase();
    if (!key) {
      return { valid: false, message: 'Please enter an activation key.' };
    }

    if (LicenseService.isKeyValid(key)) {
      return {
        valid: true,
        message: 'License key activated successfully!',
        details: { key, activatedAt: new Date().toISOString() },
      };
    }

    return {
      valid: false,
      message: 'Invalid activation key. Please check your key and try again.',
    };
  }

  /**
   * Activate the extension with a user license key
   */
  async activate(licenseKey) {
    const result = await this.verifyLicenseKey(licenseKey);
    if (result.valid) {
      await this.storage.saveSettings({
        licenseKey: licenseKey.trim().toUpperCase(),
        isLicensed: true,
      });
    } else {
      await this.storage.saveSettings({
        licenseKey: '',
        isLicensed: false,
      });
    }
    return result;
  }

  /**
   * Deactivate license
   */
  async deactivate() {
    await this.storage.saveSettings({
      licenseKey: '',
      isLicensed: false,
    });
    return { success: true, message: 'License deactivated.' };
  }

  /**
   * Check whether the user has an active license to analyze
   */
  async checkCanAnalyze() {
    const usage = await this.storage.getUsageInfo();
    if (usage.isLicensed && LicenseService.isKeyValid(usage.licenseKey)) {
      return { allowed: true, isLicensed: true };
    }
    return {
      allowed: false,
      isLicensed: false,
      message: 'License required. Please enter a valid activation key in Settings to use Prospectus.',
    };
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { LicenseService };
}
if (typeof window !== 'undefined') {
  window.ProspectusLicense = new LicenseService(window.ProspectusStorage);
}
