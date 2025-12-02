/**
 * Validate email address
 */
export function isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

/**
 * Validate password strength
 */
export function isStrongPassword(password: string): {
    valid: boolean;
    errors: string[];
} {
    const errors: string[] = [];

    if (password.length < 8) {
        errors.push('Password must be at least 8 characters');
    }

    if (!/[A-Z]/.test(password)) {
        errors.push('Password must contain at least one uppercase letter');
    }

    if (!/[a-z]/.test(password)) {
        errors.push('Password must contain at least one lowercase letter');
    }

    if (!/[0-9]/.test(password)) {
        errors.push('Password must contain at least one number');
    }

    return {
        valid: errors.length === 0,
        errors,
    };
}

/**
 * Validate stock quantity
 */
export function isValidQuantity(quantity: number): boolean {
    return Number.isInteger(quantity) && quantity > 0;
}

/**
 * Validate price
 */
export function isValidPrice(price: number): boolean {
    return !isNaN(price) && price > 0;
}

/**
 * Validate percentage
 */
export function isValidPercent(percent: number): boolean {
    return !isNaN(percent) && percent >= 0 && percent <= 100;
}
