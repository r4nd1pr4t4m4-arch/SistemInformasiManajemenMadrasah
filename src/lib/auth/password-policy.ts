export interface PasswordRuleResult {
  key: string;
  label: string;
  passed: boolean;
}

export interface PasswordValidationResult {
  isValid: boolean;
  score: number; // 0 - 7
  strengthLabel: 'Sangat Lemah' | 'Lemah' | 'Sedang' | 'Kuat' | 'Sangat Kuat';
  rules: PasswordRuleResult[];
  errors: string[];
}

/**
 * Mengekstrak potongan kata nama pengguna (>= 3 huruf) untuk mencegah kata sandi mengandung nama.
 */
function extractNameTokens(fullName?: string | null): string[] {
  if (!fullName) return [];
  return fullName
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 3);
}

/**
 * Validasi kebijakan kata sandi:
 * - Minimal 8 karakter
 * - Minimal 1 huruf kecil & 1 huruf besar
 * - Minimal 1 angka
 * - Minimal 1 karakter khusus / tanda baca
 * - Tidak boleh 3 karakter sama berdekatan (mis. 111, ddd)
 * - Tidak boleh mengandung unsur nama pengguna
 */
export function validatePasswordStrength(
  password: string,
  fullName?: string | null
): PasswordValidationResult {
  const lowerPwd = password.toLowerCase();
  const nameTokens = extractNameTokens(fullName);

  const hasMinLength = password.length >= 8;
  const hasLowercase = /[a-z]/.test(password);
  const hasUppercase = /[A-Z]/.test(password);
  const hasDigit = /[0-9]/.test(password);
  const hasSpecial = /[^a-zA-Z0-9\s]/.test(password);
  const noTripleRepeat = password.length > 0 && !/(.)\1\1/.test(password);
  const noNameElement =
    password.length > 0 &&
    !nameTokens.some((token) => lowerPwd.includes(token));

  const rules: PasswordRuleResult[] = [
    { key: 'length', label: 'Minimal 8 karakter', passed: hasMinLength },
    { key: 'lower', label: 'Minimal 1 huruf kecil (a-z)', passed: hasLowercase },
    { key: 'upper', label: 'Minimal 1 huruf besar (A-Z)', passed: hasUppercase },
    { key: 'digit', label: 'Minimal 1 angka (0-9)', passed: hasDigit },
    {
      key: 'special',
      label: 'Minimal 1 karakter khusus / tanda baca (!@#$...)',
      passed: hasSpecial,
    },
    {
      key: 'repeat',
      label: 'Tidak ada 3 karakter sama berdekatan (mis. 111, ddd)',
      passed: noTripleRepeat,
    },
    {
      key: 'name',
      label: 'Tidak mengandung unsur nama pengguna',
      passed: noNameElement,
    },
  ];

  const score = rules.filter((r) => r.passed).length;
  const errors = rules.filter((r) => !r.passed).map((r) => r.label);

  let strengthLabel: PasswordValidationResult['strengthLabel'] = 'Sangat Lemah';
  if (password.length === 0) {
    strengthLabel = 'Sangat Lemah';
  } else if (score <= 2) {
    strengthLabel = 'Sangat Lemah';
  } else if (score <= 4) {
    strengthLabel = 'Lemah';
  } else if (score <= 5) {
    strengthLabel = 'Sedang';
  } else if (score === 6) {
    strengthLabel = 'Kuat';
  } else {
    strengthLabel = 'Sangat Kuat';
  }

  return {
    isValid: errors.length === 0,
    score,
    strengthLabel,
    rules,
    errors,
  };
}
