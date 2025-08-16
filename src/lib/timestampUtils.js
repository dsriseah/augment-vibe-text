/**
 * Timestamp utilities for generating formatted timestamps
 */
export class TimestampUtils {
  constructor(options = {}) {
    this.timezone = options.timezone || 'local'; // 'local', 'utc', or specific timezone
    this.format = options.format || 'HH:MM:SS YYYY/MM/DD';
  }

  /**
   * Generate current timestamp in the specified format
   * @param {Date} [date] - Optional date object, defaults to current time
   * @returns {string} Formatted timestamp string
   */
  generateTimestamp(date = null) {
    const now = date || new Date();
    
    switch (this.timezone) {
      case 'utc':
        return this.formatTimestamp(now, true);
      case 'local':
      default:
        return this.formatTimestamp(now, false);
    }
  }

  /**
   * Format a date object into HH:MM:SS YYYY/MM/DD format
   * @param {Date} date - Date object to format
   * @param {boolean} useUTC - Whether to use UTC time
   * @returns {string} Formatted timestamp
   */
  formatTimestamp(date, useUTC = false) {
    const getDateValue = (method) => useUTC ? date[`getUTC${method}`]() : date[`get${method}`]();
    
    const hours = getDateValue('Hours').toString().padStart(2, '0');
    const minutes = getDateValue('Minutes').toString().padStart(2, '0');
    const seconds = getDateValue('Seconds').toString().padStart(2, '0');
    
    const year = getDateValue('FullYear');
    const month = (getDateValue('Month') + 1).toString().padStart(2, '0'); // Month is 0-indexed
    const day = getDateValue('Date').toString().padStart(2, '0');
    
    return `${hours}:${minutes}:${seconds} ${year}/${month}/${day}`;
  }

  /**
   * Parse a timestamp string back to a Date object
   * @param {string} timestampStr - Timestamp in HH:MM:SS YYYY/MM/DD format
   * @returns {Date|null} Date object or null if parsing fails
   */
  parseTimestamp(timestampStr) {
    try {
      // Match the pattern: HH:MM:SS YYYY/MM/DD
      const pattern = /^(\d{2}):(\d{2}):(\d{2})\s+(\d{4})\/(\d{2})\/(\d{2})$/;
      const match = timestampStr.match(pattern);
      
      if (!match) {
        return null;
      }
      
      const [, hours, minutes, seconds, year, month, day] = match;
      
      // Create date object (month is 0-indexed in Date constructor)
      const date = new Date(
        parseInt(year, 10),
        parseInt(month, 10) - 1,
        parseInt(day, 10),
        parseInt(hours, 10),
        parseInt(minutes, 10),
        parseInt(seconds, 10)
      );
      
      // Validate the date
      if (isNaN(date.getTime())) {
        return null;
      }
      
      return date;
    } catch (error) {
      return null;
    }
  }

  /**
   * Validate timestamp format
   * @param {string} timestampStr - Timestamp string to validate
   * @returns {boolean} True if format is valid
   */
  isValidTimestamp(timestampStr) {
    if (typeof timestampStr !== 'string') {
      return false;
    }
    
    const pattern = /^\d{2}:\d{2}:\d{2}\s+\d{4}\/\d{2}\/\d{2}$/;
    if (!pattern.test(timestampStr)) {
      return false;
    }
    
    // Try to parse it to ensure it's a valid date
    const parsed = this.parseTimestamp(timestampStr);
    return parsed !== null;
  }

  /**
   * Generate a timestamp for a specific timezone
   * @param {string} timezone - Timezone identifier (e.g., 'America/New_York')
   * @param {Date} [date] - Optional date object
   * @returns {string} Formatted timestamp
   */
  generateTimestampForTimezone(timezone, date = null) {
    const now = date || new Date();
    
    try {
      // Use Intl.DateTimeFormat for timezone conversion
      const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });
      
      const parts = formatter.formatToParts(now);
      const partsMap = {};
      parts.forEach(part => {
        partsMap[part.type] = part.value;
      });
      
      return `${partsMap.hour}:${partsMap.minute}:${partsMap.second} ${partsMap.year}/${partsMap.month}/${partsMap.day}`;
    } catch (error) {
      // Fallback to local time if timezone is invalid
      return this.generateTimestamp(date);
    }
  }

  /**
   * Create a divider line with hash and timestamp
   * @param {string} hash - Content hash
   * @param {Date} [date] - Optional date object
   * @returns {string} Complete divider line
   */
  createDividerLine(hash, date = null) {
    const timestamp = this.generateTimestamp(date);
    return `---: ${hash} ${timestamp}`;
  }

  /**
   * Parse a divider line to extract hash and timestamp
   * @param {string} dividerLine - Complete divider line
   * @returns {Object|null} Object with hash and timestamp, or null if parsing fails
   */
  parseDividerLine(dividerLine) {
    try {
      // Match pattern: ---: HASH HH:MM:SS YYYY/MM/DD
      const pattern = /^---:\s+([A-F0-9]+)\s+(\d{2}:\d{2}:\d{2}\s+\d{4}\/\d{2}\/\d{2})$/i;
      const match = dividerLine.match(pattern);
      
      if (!match) {
        return null;
      }
      
      const [, hash, timestampStr] = match;
      const timestamp = this.parseTimestamp(timestampStr);
      
      if (!timestamp) {
        return null;
      }
      
      return {
        hash: hash.toUpperCase(),
        timestamp: timestamp,
        timestampStr: timestampStr
      };
    } catch (error) {
      return null;
    }
  }
}
