import fs from "fs/promises";
import path from "path";

/**
 * Core file processing module for splitting multi-source documents
 */
export class FileProcessor {
  constructor() {
    this.dividerPattern = /^---:\s*$/;
  }

  /**
   * Read and parse a multi-source document
   * @param {string} filePath - Path to the input file
   * @returns {Promise<Array>} Array of document sections
   */
  async readAndSplit(filePath) {
    // Validate input parameters
    if (!filePath || typeof filePath !== "string") {
      throw new Error("File path must be a non-empty string");
    }

    if (filePath.trim().length === 0) {
      throw new Error("File path cannot be empty");
    }

    try {
      // Check if file exists and is readable
      const isValid = await this.validateInputFile(filePath);
      if (!isValid) {
        throw new Error(`File does not exist or is not readable: ${filePath}`);
      }

      const content = await fs.readFile(filePath, "utf-8");

      // Validate content
      if (typeof content !== "string") {
        throw new Error("File content is not valid text");
      }

      return this.splitContent(content);
    } catch (error) {
      if (error.code === "ENOENT") {
        throw new Error(`File not found: ${filePath}`);
      } else if (error.code === "EACCES") {
        throw new Error(`Permission denied reading file: ${filePath}`);
      } else if (error.code === "EISDIR") {
        throw new Error(`Path is a directory, not a file: ${filePath}`);
      } else if (
        error.message.startsWith("File") ||
        error.message.startsWith("Permission")
      ) {
        // Re-throw our custom errors
        throw error;
      } else {
        throw new Error(`Failed to read file ${filePath}: ${error.message}`);
      }
    }
  }

  /**
   * Split content into sections based on ---: dividers
   * @param {string} content - The full document content
   * @returns {Array} Array of section objects
   */
  splitContent(content) {
    // Validate input
    if (typeof content !== "string") {
      throw new Error("Content must be a string");
    }

    if (content.length === 0) {
      return [];
    }

    try {
      const lines = content.split("\n");
      const sections = [];
      let currentSection = [];
      let sectionIndex = 0;
      let currentSectionStartsWithDivider = false;
      let currentSectionDividerLine = null;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        if (this.dividerPattern.test(line)) {
          // If we have content before this divider, save it as a section
          if (currentSection.length > 0) {
            sections.push({
              index: sectionIndex++,
              content: currentSection.join("\n"),
              hasDivider: currentSectionStartsWithDivider,
              originalDividerLine: currentSectionDividerLine,
              lineStart: i - currentSection.length + 1,
              lineEnd: i,
            });
            currentSection = [];
            // Reset the divider tracking for the next section
            currentSectionStartsWithDivider = false;
            currentSectionDividerLine = null;
          }

          // Start new section with the divider line
          currentSection.push(line);
          currentSectionStartsWithDivider = true;
          currentSectionDividerLine = line;

          // Continue collecting content after the divider
          continue;
        }

        currentSection.push(line);
      }

      // Add the final section if there's remaining content
      if (currentSection.length > 0) {
        sections.push({
          index: sectionIndex,
          content: currentSection.join("\n"),
          hasDivider: currentSectionStartsWithDivider,
          originalDividerLine: currentSectionDividerLine,
          lineStart: lines.length - currentSection.length + 1,
          lineEnd: lines.length,
        });
      }

      // Validate sections
      this.validateSections(sections);

      return sections;
    } catch (error) {
      throw new Error(`Failed to split content: ${error.message}`);
    }
  }

  /**
   * Validate sections array
   * @param {Array} sections - Array of section objects
   */
  validateSections(sections) {
    if (!Array.isArray(sections)) {
      throw new Error("Sections must be an array");
    }

    sections.forEach((section, index) => {
      if (!section || typeof section !== "object") {
        throw new Error(`Section ${index} is not a valid object`);
      }

      if (typeof section.content !== "string") {
        throw new Error(`Section ${index} content must be a string`);
      }

      if (typeof section.index !== "number") {
        throw new Error(`Section ${index} must have a numeric index`);
      }

      if (typeof section.hasDivider !== "boolean") {
        throw new Error(`Section ${index} hasDivider must be a boolean`);
      }
    });
  }

  /**
   * Validate that the input file exists and is readable
   * @param {string} filePath - Path to validate
   * @returns {Promise<boolean>} True if file is valid
   */
  async validateInputFile(filePath) {
    try {
      const stats = await fs.stat(filePath);
      return stats.isFile();
    } catch (error) {
      return false;
    }
  }

  /**
   * Get file extension from path
   * @param {string} filePath - File path
   * @returns {string} File extension
   */
  getFileExtension(filePath) {
    return path.extname(filePath) || ".md";
  }
}
