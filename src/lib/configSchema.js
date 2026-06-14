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

  // Validate sync group settings
  if (group === 'sync') {
    switch (setting) {
      case 'thresholdPercent':
        if (typeof value !== 'number' || value < 1 || value > 100) {
          return `sync.thresholdPercent must be a number between 1 and 100`;
        }
        return null;
      case 'thresholdAbsolute':
        // Allow 0 (meaning not set) or a positive number
        if (typeof value !== 'number' || (value < 0 || value > 10000)) {
          return `sync.thresholdAbsolute must be a number between 0 and 10000 (0 means use percent)`;
        }
        return null;
      default:
        // Unknown setting under sync - allow for forward compatibility
        return null;
    }
  }

  // Validate masking group
  if (group === 'masking') {
    switch (setting) {
      case 'autoMask':
        if (typeof value !== 'boolean') {
          return `masking.autoMask must be a boolean (true/false)`;
        }
        return null;
      case 'maskChar':
        if (typeof value !== 'string' || value.length !== 1) {
          return `masking.maskChar must be a single character string`;
        }
        return null;
      case 'showStart':
      case 'showEnd':
        if (typeof value !== 'number' || value < 0 || value > 10) {
          return `${group}.${setting} must be a number between 0 and 10`;
        }
        return null;
      case 'customPatterns':
        if (!Array.isArray(value)) {
          return `masking.customPatterns must be an array of strings`;
        }
        // Validate each pattern is string
        for (let i = 0; i < value.length; i++) {
          if (typeof value[i] !== 'string') {
            return `masking.customPatterns[${i}] must be a string`;
          }
        }
        return null;
      default:
        // Unknown setting - allow for forward compatibility
        return null;
    }
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
