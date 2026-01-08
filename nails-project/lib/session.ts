// Session management for verified phone numbers
// Uses localStorage with a session key that includes phone number for security

const SESSION_PREFIX = 'adar_nails_session_v1_';
const TRUSTED_USER_PREFIX = 'adar_nails_trusted_v1_';
const SESSION_EXPIRY_HOURS = 24; // Sessions expire after 24 hours

export interface VerifiedSession {
  phone: string;
  verifiedAt: string;
  expiresAt: string;
}

/**
 * Get verified session for a phone number
 */
export function getVerifiedSession(phone: string): VerifiedSession | null {
  try {
    const phoneDigits = phone.replace(/\D/g, '');
    const sessionKey = `${SESSION_PREFIX}${phoneDigits}`;
    const sessionData = localStorage.getItem(sessionKey);
    
    if (!sessionData) {
      return null;
    }
    
    const session: VerifiedSession = JSON.parse(sessionData);
    
    // Check if session is expired
    if (new Date(session.expiresAt) < new Date()) {
      localStorage.removeItem(sessionKey);
      return null;
    }
    
    return session;
  } catch (error) {
    console.error('Error reading session:', error);
    return null;
  }
}

/**
 * Check if a phone number has an active verified session
 */
export function isPhoneVerified(phone: string): boolean {
  const session = getVerifiedSession(phone);
  return session !== null;
}

/**
 * Create a verified session for a phone number
 */
export function createVerifiedSession(phone: string): void {
  try {
    const phoneDigits = phone.replace(/\D/g, '');
    const sessionKey = `${SESSION_PREFIX}${phoneDigits}`;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + SESSION_EXPIRY_HOURS * 60 * 60 * 1000);
    
    const session: VerifiedSession = {
      phone: phoneDigits,
      verifiedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    };
    
    localStorage.setItem(sessionKey, JSON.stringify(session));
    
    // Also update the trusted_user key for backward compatibility
    const trustedKey = `${TRUSTED_USER_PREFIX}${phoneDigits}`;
    localStorage.setItem(trustedKey, 'true');
  } catch (error) {
    console.error('Error creating session:', error);
  }
}

/**
 * Clear verified session for a phone number
 */
export function clearVerifiedSession(phone: string): void {
  try {
    const phoneDigits = phone.replace(/\D/g, '');
    const sessionKey = `${SESSION_PREFIX}${phoneDigits}`;
    localStorage.removeItem(sessionKey);
    
    // Also clear the trusted_user key
    const trustedKey = `${TRUSTED_USER_PREFIX}${phoneDigits}`;
    localStorage.removeItem(trustedKey);
  } catch (error) {
    console.error('Error clearing session:', error);
  }
}

/**
 * Clear all verified sessions (for logout/switch user)
 */
export function clearAllSessions(): void {
  try {
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith(SESSION_PREFIX) || key.startsWith(TRUSTED_USER_PREFIX)) {
        localStorage.removeItem(key);
      }
    });
  } catch (error) {
    console.error('Error clearing all sessions:', error);
  }
}

/**
 * Get all active verified phone numbers
 */
export function getAllVerifiedPhones(): string[] {
  try {
    const phones: string[] = [];
    const keys = Object.keys(localStorage);
    
    keys.forEach(key => {
      if (key.startsWith(SESSION_PREFIX)) {
        const phoneDigits = key.replace(SESSION_PREFIX, '');
        if (isPhoneVerified(phoneDigits)) {
          phones.push(phoneDigits);
        }
      }
    });
    
    return phones;
  } catch (error) {
    console.error('Error getting verified phones:', error);
    return [];
  }
}
