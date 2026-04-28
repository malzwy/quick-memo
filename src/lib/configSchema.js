/**
 * Configuration schema and validation for Quick Memo.
 * Provides validation rules for known configuration keys.
 */

const validSortFields = ['created', 'updated', 'content'];

/**
 * Validate a single configuration key-value pair.
 * @param {string} key - Configuration key in dot notation (e.g., 'list.sortBy')
 * @param {*} value - Value to validate (already parsed from JSON if applicable)
 * @returns {string|null} - Error message if invalid, null if valid
 */
function validateConfigKey(key, value) {
  const parts = key.split('.');
  if (parts.length !== 2) {
    return `Only single-level dot notation supported (e.g., list.sortBy). Got: ${key}`;
  }

  const [group, setting] = parts;

  // Validate list group settings
  if (group === 'list') {
    switch (setting) {
      case 'sortBy':
        if (typeof value !== 'string') {
          return `list.sortBy must be a string`;
        }
        if (!validSortFields.includes(value)) {
          return `list.sortBy must be one of: ${validSortFields.join(', ')}`;
        }
        return null;
      case 'sortAsc':
      case 'detailed':
      case 'json':
        if (typeof value !== 'boolean') {
          return `${group}.${setting} must be a boolean (true/false)`;
        }
        return null;
      default:
        // Unknown setting under list - allow for forward compatibility
        return null;
    }
  }

  // Validate delete, trash-empty, purge groups (confirmDelete)
  if (['delete', 'trash-empty', 'purge'].includes(group)) {
    if (setting === 'confirmDelete') {
      if (typeof value !== 'boolean') {
        return `${group}.confirmDelete must be a boolean (true/false)`;
      }
      return null;
    }
    // Unknown setting - allow
    return null;
  }

  // Unknown top-level group (e.g., future feature) - allow permissively
  return null;
}

/**
 * Validate an entire config object.
 * @param {Object} config - The configuration object
 * @returns {Array<{key: string, error: string}>} - List of validation errors
 */
function validateFullConfig(config) {
  const errors = [];
  for (const [key, value] of Object.entries(config)) {
    // For nested groups, validate each sub-key
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      for (const [subKey, subValue] of Object.entries(value)) {
        const fullKey = `${key}.${subKey}`;
        const err = validateConfigKey(fullKey, subValue);
        if (err) {
          errors.push({ key: fullKey, error: err });
        }
      }
    } else {
      // Top-level key (not an object) - currently no such config, but validate if needed
      // Currently we don't have any top-level non-object configs, so we just skip unknown
    }
  }
  return errors;
}

module.exports = {
  validateConfigKey,
  validateFullConfig,
  validSortFields
};
