/**
 * Prospectus - License Service
 * Handles user license activation (Gumroad & ZIP distribution format validation)
 * and local license state management. (No free trial).
 */

class LicenseService {
  constructor(storageService) {
    this.storage = storageService || (typeof window !== 'undefined' ? window.ProspectusStorage : null);
  }

  /**
   * Validate a license key.
   * Works for both direct ZIP package license keys (format: PROSP-XXXX-XXXX-XXXX or custom keys)
   * and Gumroad API verification when product_permalink is provided.
   */
  async verifyLicenseKey(licenseKey, productPermalink = '') {
    const key = (licenseKey || '').trim();
    if (!key) {
      return { valid: false, message: 'Please enter a license key.' };
    }

    // 1. If Gumroad product permalink is provided, verify against Gumroad API
    if (productPermalink) {
      try {
        let res = null;
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id && chrome.runtime.sendMessage) {
          try {
            const proxyRes = await new Promise((resolve, reject) => {
              try {
                chrome.runtime.sendMessage(
                  {
                    action: 'FETCH_PROXY',
                    url: 'https://api.gumroad.com/v2/licenses/verify',
                    options: {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                      body: new URLSearchParams({
                        product_permalink: productPermalink,
                        license_key: key,
                      }).toString(),
                    },
                  },
                  (r) => {
                    try {
                      if (chrome.runtime && chrome.runtime.id && chrome.runtime.lastError) {
                        return reject(new Error(chrome.runtime.lastError.message));
                      }
                      resolve(r);
                    } catch (e) {
                      reject(new Error('Extension context invalidated'));
                    }
                  }
                );
              } catch (e) {
                reject(new Error('Extension context invalidated'));
              }
            });
            if (proxyRes && proxyRes.data) {
              const data = proxyRes.data;
              if (data.success && !data.purchase?.refunded && !data.purchase?.chargebacked) {
                return {
                  valid: true,
                  message: 'License verified via Gumroad!',
                  details: {
                    email: data.purchase?.email,
                    variants: data.purchase?.variants,
                  },
                };
              } else {
                return {
                  valid: false,
                  message: data.message || 'Invalid Gumroad license key.',
                };
              }
            }
          } catch (e) {}
        }

        res = await fetch('https://api.gumroad.com/v2/licenses/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            product_permalink: productPermalink,
            license_key: key,
          }),
        });
        const data = await res.json();
        if (data.success && !data.purchase.refunded && !data.purchase.chargebacked) {
          return {
            valid: true,
            message: 'License verified via Gumroad!',
            details: {
              email: data.purchase.email,
              variants: data.purchase.variants,
            },
          };
        } else {
          return {
            valid: false,
            message: data.message || 'Invalid Gumroad license key.',
          };
        }
      } catch (err) {
        console.warn('Gumroad API verification failed, falling back to format check:', err);
      }
    }

    // 2. Direct ZIP distribution key validation
    // Format check: accept standard alphanumeric keys (min length 6 chars)
    if (key.length >= 6) {
      return {
        valid: true,
        message: 'License key activated successfully!',
        details: { key, activatedAt: new Date().toISOString() },
      };
    }

    return {
      valid: false,
      message: 'Invalid license key format. Please enter a valid license key.',
    };
  }

  /**
   * Activate the extension with a user license key
   */
  async activate(licenseKey, productPermalink = '') {
    const result = await this.verifyLicenseKey(licenseKey, productPermalink);
    if (result.valid) {
      await this.storage.saveSettings({
        licenseKey: licenseKey.trim(),
        isLicensed: true,
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
    if (usage.isLicensed) {
      return { allowed: true, isLicensed: true };
    }
    return {
      allowed: false,
      isLicensed: false,
      message: 'License required. Please enter your license key in Settings to use Prospectus.',
    };
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { LicenseService };
}
if (typeof window !== 'undefined') {
  window.ProspectusLicense = new LicenseService(window.ProspectusStorage);
}
