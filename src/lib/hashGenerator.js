import crypto from 'crypto';

/**
 * Hash generation utilities for content identification
 */
export class HashGenerator {
  constructor(options = {}) {
    this.algorithm = options.algorithm || 'sha256';
    this.length = options.length || 8; // Default to 8 characters for readability
    this.encoding = options.encoding || 'hex';
  }

  /**
   * Generate a hash for the given content
   * @param {string} content - Content to hash
   * @returns {string} Truncated hash string
   */
  generateHash(content) {
    if (typeof content !== 'string') {
      throw new Error('Content must be a string');
    }

    // Normalize content by trimming whitespace and ensuring consistent line endings
    const normalizedContent = this.normalizeContent(content);
    
    const hash = crypto
      .createHash(this.algorithm)
      .update(normalizedContent, 'utf8')
      .digest(this.encoding);

    // Return truncated hash for readability
    return hash.substring(0, this.length).toUpperCase();
  }

  /**
   * Generate hash specifically for a document section
   * @param {Object} section - Section object with content and metadata
   * @returns {string} Hash for the section
   */
  generateSectionHash(section) {
    if (!section || !section.content) {
      throw new Error('Section must have content property');
    }

    // For sections with dividers, we want to hash the content without the original divider
    // so that the hash remains consistent even when we modify the divider line
    let contentToHash = section.content;
    
    if (section.hasDivider && section.originalDividerLine) {
      // Remove the original divider line and hash the rest
      const lines = section.content.split('\n');
      const dividerIndex = lines.findIndex(line => line.trim() === section.originalDividerLine.trim());
      
      if (dividerIndex !== -1) {
        // Create content without the divider line for hashing
        const contentLines = [...lines];
        contentLines.splice(dividerIndex, 1);
        contentToHash = contentLines.join('\n');
      }
    }

    return this.generateHash(contentToHash);
  }

  /**
   * Normalize content for consistent hashing
   * @param {string} content - Raw content
   * @returns {string} Normalized content
   */
  normalizeContent(content) {
    return content
      .trim()                           // Remove leading/trailing whitespace
      .replace(/\r\n/g, '\n')          // Normalize line endings to LF
      .replace(/\r/g, '\n')            // Convert CR to LF
      .replace(/\n+$/, '\n');          // Ensure single trailing newline
  }

  /**
   * Validate hash format
   * @param {string} hash - Hash to validate
   * @returns {boolean} True if hash format is valid
   */
  isValidHash(hash) {
    if (typeof hash !== 'string') {
      return false;
    }

    // Check if hash matches expected length and contains only valid hex characters
    const hexPattern = new RegExp(`^[0-9A-F]{${this.length}}$`, 'i');
    return hexPattern.test(hash);
  }

  /**
   * Generate multiple hashes with different algorithms for comparison
   * @param {string} content - Content to hash
   * @returns {Object} Object with different hash algorithms
   */
  generateMultipleHashes(content) {
    const algorithms = ['sha256', 'sha1', 'md5'];
    const hashes = {};

    algorithms.forEach(algorithm => {
      try {
        const hash = crypto
          .createHash(algorithm)
          .update(this.normalizeContent(content), 'utf8')
          .digest('hex')
          .substring(0, this.length)
          .toUpperCase();
        
        hashes[algorithm] = hash;
      } catch (error) {
        hashes[algorithm] = null;
      }
    });

    return hashes;
  }
}
