export function mapAuthError(errorCode) {
  switch (errorCode) {
    case 'auth/invalid-credential':
      return 'Incorrect email or password.';
    case 'auth/user-not-found':
      return 'No account was found with this email or phone number.';
    case 'user_not_found':
      return 'No account was found with this email or phone number.';
    case 'auth/wrong-password':
      return 'Incorrect email or password.';
    case 'auth/email-already-in-use':
      return 'This email address is already registered.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/weak-password':
      return 'Password must be at least 6 characters long.';
    case 'auth/network-request-failed':
      return 'Network error. Please check your internet connection.';
    case 'auth/requires-recent-login':
      return 'Please enter your password again to continue.';
    case 'auth/too-many-requests':
      return 'Too many failed login attempts. Please try again later.';
    case 'auth/phone-not-verified':
      return 'Please verify your phone number before creating an account.';
    case 'phone_not_verified':
      return 'Please verify your phone number before creating an account.';
    default:
      return 'Something went wrong. Please try again.';
  }
}

const PASSWORD_RESET_LIMIT_MESSAGE =
  "You've reached today's password reset limit. Please try again tomorrow.";

/** User-facing message for Forgot Password / Admin reset failures (never the raw Firebase text). */
export function mapPasswordResetError(err) {
  switch (err?.code) {
    case 'rate_limited':
      return err.message || PASSWORD_RESET_LIMIT_MESSAGE;
    case 'auth/user-not-found':
    case 'user_not_found':
      return 'No account was found with this email address.';
    case 'auth/invalid-email':
    case 'invalid_email':
      return 'Please enter a valid email address.';
    case 'auth/missing-email':
      return 'Please enter your email address.';
    case 'auth/too-many-requests':
      return 'Too many requests. Please wait a moment before trying again.';
    case 'auth/unauthorized-continue-uri':
    case 'auth/invalid-continue-uri':
    case 'auth/unauthorized-domain':
      return 'Password reset is temporarily unavailable. Please contact the clinic.';
    case 'auth/network-request-failed':
    case 'network_error':
      return 'Network error. Please check your internet connection and try again.';
    case 'invalid_response':
      return 'The password reset service is unavailable right now. Please try again later.';
    default:
      return 'Unable to send the password reset email. Please try again.';
  }
}
