import { changeUserPassword } from "../services/authService";

export const validatePasswordRequirements = (password) => {
  // Shared password policy
  const policyMet = password.length >= 8 && 
                    /[A-Z]/.test(password) && 
                    /[a-z]/.test(password) && 
                    /[0-9]/.test(password) && 
                    /[!@#$%^&*(),.?":{}|<>]/.test(password);
  return policyMet;
};

export const handlePasswordChangeRequest = async (currentPassword, newPassword, confirmPassword) => {
  if (!currentPassword) {
    return { success: false, error: "Current Password is required." };
  }
  
  if (!validatePasswordRequirements(newPassword)) {
    return { success: false, error: "New password does not meet requirements (minimum 8 characters, uppercase, lowercase, number, special character)." };
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
