import { changeUserPassword } from "../services/authService";
import { auth } from "../firebase/auth";
import { validatePassword } from "firebase/auth";
import { useState, useEffect } from "react";

/**
 * Validates a password against the active Firebase project's password policy.
 * @param {string} password - The password to validate
 * @returns {Promise<{isValid: boolean, errors: string[]}>}
 */
export const validatePasswordAgainstFirebase = async (password) => {
  if (!password) {
    return { isValid: false, errors: [] }; // No errors when empty
  }

  try {
    const status = await validatePassword(auth, password);
    
    if (status.isValid) {
      return { isValid: true, errors: [] };
    }
    
    const errors = [];
    const policy = status.passwordPolicy || {};
    
    // Safely extract configured min/max lengths, falling back to 12/64
    // customStrengthOptions was added in recent Firebase SDKs
    const minLen = policy.customStrengthOptions?.minPasswordLength || 12;
    const maxLen = policy.customStrengthOptions?.maxPasswordLength || 64;

    if (!status.meetsMinPasswordLength) {
      errors.push(`Password must be at least ${minLen} characters.`);
    }
    if (!status.meetsMaxPasswordLength) {
      errors.push(`Password must not exceed ${maxLen} characters.`);
    }
    
    if (status.containsUppercaseLetter === false && policy.customStrengthOptions?.containsUppercaseLetter) {
      errors.push(`Password must contain an uppercase letter.`);
    }
    if (status.containsLowercaseLetter === false && policy.customStrengthOptions?.containsLowercaseLetter) {
      errors.push(`Password must contain a lowercase letter.`);
    }
    if (status.containsNumericCharacter === false && policy.customStrengthOptions?.containsNumericCharacter) {
      errors.push(`Password must contain a number.`);
    }
    if (status.containsNonAlphanumericCharacter === false && policy.customStrengthOptions?.containsNonAlphanumericCharacter) {
      errors.push(`Password must contain a special character.`);
    }
    
    // Fallback if we couldn't map the exact error
    if (errors.length === 0) {
      errors.push("Password does not meet the required security policy.");
    }
    
    return { isValid: false, errors };
  } catch (err) {
    console.error("Firebase validatePassword failed:", err);
    // If API fails (e.g., offline), fallback to a basic local check (12 char min)
    if (password.length < 12) {
      return { isValid: false, errors: ["Password must be at least 12 characters."] };
    }
    if (password.length > 64) {
      return { isValid: false, errors: ["Password must not exceed 64 characters."] };
    }
    return { isValid: true, errors: [] };
  }
};

/**
 * Custom React hook for real-time Firebase password validation with debouncing.
 * @param {string} password 
 * @returns {{ isValid: boolean, errors: string[], isChecking: boolean }}
 */
export const usePasswordValidation = (password) => {
  const [status, setStatus] = useState({ isValid: false, errors: [], isChecking: false });

  useEffect(() => {
    if (!password) {
      setStatus({ isValid: false, errors: [], isChecking: false });
      return;
    }

    setStatus(prev => ({ ...prev, isChecking: true }));
    
    // Debounce the validation to prevent spamming the Firebase API while typing
    const timer = setTimeout(async () => {
      const result = await validatePasswordAgainstFirebase(password);
      setStatus({
        isValid: result.isValid,
        errors: result.errors,
        isChecking: false
      });
    }, 400);

    return () => clearTimeout(timer);
  }, [password]);

  return status;
};

export const handlePasswordChangeRequest = async (currentPassword, newPassword, confirmPassword) => {
  if (!currentPassword) {
    return { success: false, error: "Current Password is required." };
  }
  
  const validationResult = await validatePasswordAgainstFirebase(newPassword);
  if (!validationResult.isValid) {
    return { success: false, error: validationResult.errors[0] || "New password does not meet requirements." };
  }
  
  if (newPassword !== confirmPassword) {
    return { success: false, error: "Passwords do not match." };
  }

  if (currentPassword === newPassword) {
    return { success: false, error: "New password must be different from current password." };
  }

  try {
    await changeUserPassword(currentPassword, newPassword);
    return { success: true };
  } catch (err) {
    console.error("Failed to change password:", err);
    let errorMessage = "Failed to update password. Please try again.";
    
    if (err.code === "auth/wrong-password" || err.code === "auth/invalid-credential") {
      errorMessage = "Current password is incorrect.";
    } else if (err.code === "auth/too-many-requests") {
      errorMessage = "Too many attempts. Please try again later.";
    }
    
    return { success: false, error: errorMessage };
  }
};
