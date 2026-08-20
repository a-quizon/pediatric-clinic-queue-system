/**
 * Formats a name to Capitalized Each Word, correctly handling hyphens and apostrophes.
 * @param {string} name - The name to format
 * @returns {string} The formatted name
 */
export const formatName = (name) => {
  if (!name) return "";
  return name
    .trim()
    .toLowerCase()
    .replace(/(?:^|[\s-'])\w/g, (match) => match.toUpperCase());
};
