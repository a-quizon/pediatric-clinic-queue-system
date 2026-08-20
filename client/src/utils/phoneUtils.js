/**
 * Formats a local 10-digit Philippine phone number to E.164 format.
 * Example: "9171234567" -> "+639171234567"
 * @param {string} localNumber - The 10-digit local number (e.g., starting with 9)
 * @returns {string} The E.164 formatted number
 */
export const formatToE164 = (localNumber) => {
  if (!localNumber) return "";
  const cleaned = localNumber.replace(/\D/g, "");
  // Ensure it's exactly 10 digits
  if (cleaned.length === 10) {
    return `+63${cleaned}`;
  }
  return cleaned; // Fallback to raw if invalid length (should be caught by UI validation anyway)
};

/**
 * Parses a database phone number (E.164 or legacy 09XX) to a local 10-digit number.
 * Example: "+639171234567" -> "9171234567"
 * Example: "09171234567" -> "9171234567"
 * @param {string} dbNumber - The phone number from the database
 * @returns {string} The 10-digit local number for UI
 */
export const parseToLocal = (dbNumber) => {
  if (!dbNumber) return "";
  
  // Handle E.164 (+639XXXXXXXXX)
  if (dbNumber.startsWith("+63")) {
    return dbNumber.substring(3).replace(/\D/g, "");
  }
  
  // Handle legacy local (09XXXXXXXXX)
  if (dbNumber.startsWith("09") && dbNumber.length === 11) {
    return dbNumber.substring(1).replace(/\D/g, "");
  }

  // Handle just 10 digits already or weird legacy format
  const cleaned = dbNumber.replace(/\D/g, "");
  if (cleaned.length === 11 && cleaned.startsWith("09")) {
    return cleaned.substring(1);
  }
  if (cleaned.length === 12 && cleaned.startsWith("639")) {
    return cleaned.substring(2);
  }
  
  return cleaned;
};
