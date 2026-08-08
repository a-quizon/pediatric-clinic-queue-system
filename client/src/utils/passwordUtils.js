import { changeUserPassword } from "../services/authService";

export const getPasswordRequirements = (password) => {
  return [
    { label: "8+ characters", met: password.length >= 8 },
    { label: "Uppercase letter", met: /[A-Z]/.test(password) },
    { label: "Lowercase letter", met: /[a-z]/.test(password) },
    { label: "Number", met: /[0-9]/.test(password) },
    { label: "Special character", met: /[!@#$%^&*(),.?":{}|<>]/.test(password) }
  ];
};

export const validatePasswordRequirements = (password) => {
  return getPasswordRequirements(password).every(req => req.met);
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
