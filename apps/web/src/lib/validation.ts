'use client';

// Form validation utilities

export interface ValidationRule<T = string> {
    validate: (value: T) => boolean;
    message: string;
}

export interface FieldValidation<T = string> {
    value: T;
    rules: ValidationRule<T>[];
}

export interface ValidationResult {
    isValid: boolean;
    errors: Record<string, string>;
}

// Common validation rules
export const required = (message = '필수 입력 항목입니다'): ValidationRule<string> => ({
    validate: (value) => value.trim().length > 0,
    message,
});

export const minLength = (min: number, message?: string): ValidationRule<string> => ({
    validate: (value) => value.length >= min,
    message: message || `최소 ${min}자 이상 입력해주세요`,
});

export const maxLength = (max: number, message?: string): ValidationRule<string> => ({
    validate: (value) => value.length <= max,
    message: message || `최대 ${max}자까지 입력 가능합니다`,
});

export const pattern = (regex: RegExp, message: string): ValidationRule<string> => ({
    validate: (value) => regex.test(value),
    message,
});

export const email = (message = '올바른 이메일 형식이 아닙니다'): ValidationRule<string> => ({
    validate: (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
    message,
});

export const numeric = (message = '숫자만 입력 가능합니다'): ValidationRule<string> => ({
    validate: (value) => /^\d+$/.test(value),
    message,
});

export const stockSymbol = (message = '올바른 종목 코드 형식이 아닙니다'): ValidationRule<string> => ({
    validate: (value) => /^[0-9A-Z]{4,10}$/.test(value.toUpperCase()),
    message,
});

// Validate single field
export function validateField<T>(value: T, rules: ValidationRule<T>[]): string | null {
    for (const rule of rules) {
        if (!rule.validate(value)) {
            return rule.message;
        }
    }
    return null;
}

// Validate form
export function validateForm(
    fields: Record<string, FieldValidation<any>>
): ValidationResult {
    const errors: Record<string, string> = {};
    let isValid = true;

    for (const [fieldName, field] of Object.entries(fields)) {
        const error = validateField(field.value, field.rules);
        if (error) {
            errors[fieldName] = error;
            isValid = false;
        }
    }

    return { isValid, errors };
}

// Hook for form validation
import { useState, useCallback } from 'react';

export interface UseFormValidationOptions<T extends Record<string, any>> {
    initialValues: T;
    validationRules: Partial<Record<keyof T, ValidationRule<any>[]>>;
    onSubmit: (values: T) => void | Promise<void>;
}

export function useFormValidation<T extends Record<string, any>>({
    initialValues,
    validationRules,
    onSubmit,
}: UseFormValidationOptions<T>) {
    const [values, setValues] = useState<T>(initialValues);
    const [errors, setErrors] = useState<Partial<Record<keyof T, string>>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    const setValue = useCallback(
        <K extends keyof T>(field: K, value: T[K]) => {
            setValues((prev) => ({ ...prev, [field]: value }));
            // Clear error on change
            if (errors[field]) {
                setErrors((prev) => {
                    const newErrors = { ...prev };
                    delete newErrors[field];
                    return newErrors;
                });
            }
        },
        [errors]
    );

    const validate = useCallback((): boolean => {
        const newErrors: Partial<Record<keyof T, string>> = {};
        let isValid = true;

        for (const [field, rules] of Object.entries(validationRules)) {
            if (rules) {
                const error = validateField(values[field as keyof T], rules);
                if (error) {
                    newErrors[field as keyof T] = error;
                    isValid = false;
                }
            }
        }

        setErrors(newErrors);
        return isValid;
    }, [values, validationRules]);

    const handleSubmit = useCallback(
        async (e?: React.FormEvent) => {
            e?.preventDefault();

            if (!validate()) {
                return;
            }

            setIsSubmitting(true);
            try {
                await onSubmit(values);
            } finally {
                setIsSubmitting(false);
            }
        },
        [validate, onSubmit, values]
    );

    const reset = useCallback(() => {
        setValues(initialValues);
        setErrors({});
    }, [initialValues]);

    return {
        values,
        errors,
        isSubmitting,
        setValue,
        validate,
        handleSubmit,
        reset,
    };
}
