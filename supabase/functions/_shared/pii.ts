/**
 * Shared PII Redaction utility.
 * Protects client confidentiality by masking sensitive data before it hits external APIs.
 */

interface RedactionConfig {
  maskEmail?: boolean;
  maskPhone?: boolean;
  maskAadhar?: boolean;
  maskPan?: boolean;
  maskString?: string;
}

const DEFAULT_CONFIG: RedactionConfig = {
  maskEmail: true,
  maskPhone: true,
  maskAadhar: true,
  maskPan: true,
  maskString: "[REDACTED]",
};

// Basic regex patterns for common Indian and Global PII
const REGEX_EMAIL = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
// Matches 10 digit Indian phones, with optional +91 or 0 prefix
const REGEX_PHONE = /(?:\+91|0)?[ -]?\d{10}\b/g;
// Matches 12 digit Aadhar numbers (with optional spaces)
const REGEX_AADHAR = /\b\d{4}[ -]?\d{4}[ -]?\d{4}\b/g;
// Matches 10 character PAN cards (5 letters, 4 digits, 1 letter)
const REGEX_PAN = /\b[A-Z]{5}[0-9]{4}[A-Z]{1}\b/g;

/**
 * Redact common PII from a given text string.
 */
export function redactPII(text: string, config: RedactionConfig = DEFAULT_CONFIG): string {
  if (!text) return text;
  
  let redactedText = text;
  const mask = config.maskString || "[REDACTED]";

  if (config.maskEmail) {
    redactedText = redactedText.replace(REGEX_EMAIL, `[EMAIL ${mask}]`);
  }

  if (config.maskAadhar) {
    redactedText = redactedText.replace(REGEX_AADHAR, `[AADHAR ${mask}]`);
  }

  if (config.maskPan) {
    redactedText = redactedText.replace(REGEX_PAN, `[PAN ${mask}]`);
  }

  if (config.maskPhone) {
    // Phone regex can sometimes catch random 10 digit numbers, 
    // but in a legal/enterprise context, over-redaction is safer than under-redaction.
    redactedText = redactedText.replace(REGEX_PHONE, `[PHONE ${mask}]`);
  }

  return redactedText;
}
