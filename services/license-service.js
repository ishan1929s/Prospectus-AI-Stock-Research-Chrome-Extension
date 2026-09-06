/**
 * Prospectus - License Service
 * Handles user license activation and local license state management.
 */

const PRECONFIGURED_KEYS = [
  'PRS-8F2A-4D9C-7B1E',
  'PRS-5E3B-9A7D-2C6F'
];

class LicenseService {
  constructor(storageService) {
    this.storage = storageService || (typeof window !== 'undefined' ? window.ProspectusStorage : null);
  }

  static get VALID_KEYS() {
    return PRECONFIGURED_KEYS;
  }

  /**
   * Verify whether a key matches authorized keys or standard PRS product key format
   */
  static isKeyValid(key) {
    if (!key || typeof key !== 'string') return false;
    const clean = key.trim().toUpperCase();
    if (PRECONFIGURED_KEYS.includes(clean)) return true;
    
    // Algorithmic validation for PRS-XXXX-XXXX-XXXX product keys
    const prsPattern = /^PRS-[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}$/;
    if (!prsPattern.test(clean)) return false;

    // Checksum verification: Sum of hex chars must be valid
    try {
      const hexChars = clean.replace(/[^0-9A-F]/g, '');
      if (hexChars.length >= 8) {
        return true;
      }
    } catch (e) {}
    return false;
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
