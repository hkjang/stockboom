import {
  isValidEmail,
  isStrongPassword,
  isValidQuantity,
  isValidPrice,
  isValidPercent,
} from './validators';

describe('Validators', () => {
  describe('isValidEmail', () => {
    it('should return true for valid emails', () => {
      expect(isValidEmail('test@example.com')).toBe(true);
      expect(isValidEmail('user.name@domain.co.kr')).toBe(true);
      expect(isValidEmail('user+tag@example.org')).toBe(true);
    });

    it('should return false for invalid emails', () => {
      expect(isValidEmail('')).toBe(false);
      expect(isValidEmail('invalid')).toBe(false);
      expect(isValidEmail('invalid@')).toBe(false);
      expect(isValidEmail('@domain.com')).toBe(false);
      expect(isValidEmail('test@.com')).toBe(false);
      expect(isValidEmail('test @example.com')).toBe(false);
    });
  });

  describe('isStrongPassword', () => {
    it('should validate strong passwords', () => {
      const result = isStrongPassword('SecurePass123');
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject passwords shorter than 8 characters', () => {
      const result = isStrongPassword('Short1A');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must be at least 8 characters');
    });

    it('should reject passwords without uppercase letters', () => {
      const result = isStrongPassword('password123');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one uppercase letter');
    });

    it('should reject passwords without lowercase letters', () => {
      const result = isStrongPassword('PASSWORD123');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one lowercase letter');
    });

    it('should reject passwords without numbers', () => {
      const result = isStrongPassword('PasswordOnly');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one number');
    });

    it('should return multiple errors for weak passwords', () => {
      const result = isStrongPassword('weak');
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
    });
  });

  describe('isValidQuantity', () => {
    it('should return true for positive integers', () => {
      expect(isValidQuantity(1)).toBe(true);
      expect(isValidQuantity(100)).toBe(true);
      expect(isValidQuantity(1000000)).toBe(true);
    });

    it('should return false for zero', () => {
      expect(isValidQuantity(0)).toBe(false);
    });

    it('should return false for negative numbers', () => {
      expect(isValidQuantity(-1)).toBe(false);
      expect(isValidQuantity(-100)).toBe(false);
    });

    it('should return false for non-integers', () => {
      expect(isValidQuantity(1.5)).toBe(false);
      expect(isValidQuantity(0.1)).toBe(false);
    });
  });

  describe('isValidPrice', () => {
    it('should return true for positive numbers', () => {
      expect(isValidPrice(100)).toBe(true);
      expect(isValidPrice(0.01)).toBe(true);
      expect(isValidPrice(99999.99)).toBe(true);
    });

    it('should return false for zero', () => {
      expect(isValidPrice(0)).toBe(false);
    });

    it('should return false for negative numbers', () => {
      expect(isValidPrice(-1)).toBe(false);
      expect(isValidPrice(-100.5)).toBe(false);
    });

    it('should return false for NaN', () => {
      expect(isValidPrice(NaN)).toBe(false);
    });
  });

  describe('isValidPercent', () => {
    it('should return true for percentages between 0 and 100', () => {
      expect(isValidPercent(0)).toBe(true);
      expect(isValidPercent(50)).toBe(true);
      expect(isValidPercent(100)).toBe(true);
      expect(isValidPercent(33.33)).toBe(true);
    });

    it('should return false for negative numbers', () => {
      expect(isValidPercent(-1)).toBe(false);
      expect(isValidPercent(-0.01)).toBe(false);
    });

    it('should return false for numbers greater than 100', () => {
      expect(isValidPercent(100.01)).toBe(false);
      expect(isValidPercent(150)).toBe(false);
    });

    it('should return false for NaN', () => {
      expect(isValidPercent(NaN)).toBe(false);
    });
  });
});
