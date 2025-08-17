import fs from "fs/promises";
import path from "path";

/**
 * Document reconstruction utility for combining referenced files back into original source
 */
export class DocumentReconstructor {
  constructor(options = {}) {
    this.inputDir = options.inputDir || "_out";
    this.fileExtension = options.fileExtension || ".md";
    this.referencePattern =
      /^---:\s+([A-F0-9]+)(?:\s+\d{2}:\d{2}:\d{2}\s+\d{4}\/\d{2}\/\d{2})?$/i;
  }

  /**
   * Reconstruct original document from a file with references
   * @param {string} mainFilePath - Path to the main file containing references
   * @param {Object} options - Options for reconstruction
   * @returns {Promise<string>} Reconstructed document content
   */
  async reconstructDocument(mainFilePath, options = {}) {
    // Validate input file
    if (!mainFilePath || typeof mainFilePath !== "string") {
      throw new Error("Main file path must be a non-empty string");
    }

    try {
      // Read the main file
      const mainContent = await fs.readFile(mainFilePath, "utf-8");

      // Extract references from the main file
      const { baseContent, references } = this.extractReferences(mainContent);

      if (references.length === 0) {
        console.log("No references found in main file");
        return baseContent;
      }

      console.log(`Found ${references.length} references to reconstruct`);

      // Read referenced files and combine
      // Use configured inputDir if available, otherwise use the directory of the main file
      const searchDir =
        this.inputDir !== "_out" ? this.inputDir : path.dirname(mainFilePath);
      const reconstructedContent = await this.combineReferencedFiles(
        baseContent,
        references,
        searchDir
      );

      return reconstructedContent;
    } catch (error) {
      if (error.code === "ENOENT") {
        throw new Error(`Main file not found: ${mainFilePath}`);
      } else if (error.code === "EACCES") {
        throw new Error(`Permission denied reading file: ${mainFilePath}`);
      } else {
        throw new Error(`Failed to reconstruct document: ${error.message}`);
      }
    }
  }

  /**
   * Extract reference lines from content
   * @param {string} content - File content
   * @returns {Object} Object with baseContent and references array
   */
  extractReferences(content) {
    const lines = content.split("\n");
    const references = [];
    const baseContentLines = [];
    let referenceStartIndex = -1;

    // First pass: find all references and determine where they start
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const match = line.match(this.referencePattern);

      if (match) {
        // Found a reference line
        const hash = match[1].toUpperCase();
        references.push({
          hash,
          originalLine: line,
          lineNumber: i + 1,
        });

        // Mark the start of reference section if this is the first reference
        if (referenceStartIndex === -1) {
          referenceStartIndex = i;
        }
      }
    }

    // Second pass: extract base content (everything before references)
    if (referenceStartIndex === -1) {
      // No references found, return all content as base
      return {
        baseContent: content.trim(),
        references: [],
      };
    }

    // Find the actual start of references (skip empty lines before first reference)
    let actualReferenceStart = referenceStartIndex;
    while (
      actualReferenceStart > 0 &&
      lines[actualReferenceStart - 1].trim() === ""
    ) {
      actualReferenceStart--;
    }

    // Extract base content (everything before the reference section)
    for (let i = 0; i < actualReferenceStart; i++) {
      baseContentLines.push(lines[i]);
    }

    return {
      baseContent: baseContentLines.join("\n").trim(),
      references,
    };
  }

  /**
   * Combine referenced files with base content
   * @param {string} baseContent - Main file content without references
   * @param {Array} references - Array of reference objects
   * @param {string} searchDir - Directory to search for referenced files
   * @returns {Promise<string>} Combined content
   */
  async combineReferencedFiles(baseContent, references, searchDir) {
    const sections = [baseContent];

    for (const reference of references) {
      try {
        const referencedFilePath = path.join(
          searchDir,
          `${reference.hash}${this.fileExtension}`
        );

        // Check if referenced file exists
        try {
          await fs.access(referencedFilePath);
        } catch (error) {
          console.warn(
            `⚠️  Referenced file not found: ${reference.hash}${this.fileExtension}`
          );
          continue;
        }

        // Read referenced file content
        const referencedContent = await fs.readFile(
          referencedFilePath,
          "utf-8"
        );

        // Remove the enhanced divider line (with hash and timestamp) and restore original
        const cleanedContent = this.cleanReferencedContent(referencedContent);

        sections.push(cleanedContent);
        console.log(
          `✓ Added content from: ${reference.hash}${this.fileExtension}`
        );
      } catch (error) {
        console.error(
          `✗ Failed to read referenced file ${reference.hash}: ${error.message}`
        );
      }
    }

    return sections.join("\n\n");
  }

  /**
   * Clean referenced content by removing enhanced divider and restoring original
   * @param {string} content - Content from referenced file
   * @returns {string} Cleaned content with original divider
   */
  cleanReferencedContent(content) {
    const lines = content.split("\n");

    // Check if first line is an enhanced divider (with hash and timestamp)
    if (lines.length > 0) {
      const firstLine = lines[0];
      const enhancedDividerPattern =
        /^---:\s+[A-F0-9]+\s+\d{2}:\d{2}:\d{2}\s+\d{4}\/\d{2}\/\d{2}$/i;

      if (enhancedDividerPattern.test(firstLine)) {
        // Replace enhanced divider with simple divider
        lines[0] = "---:";
      }
    }

    return lines.join("\n");
  }

  /**
   * Validate that all referenced files exist
   * @param {Array} references - Array of reference objects
   * @param {string} searchDir - Directory to search for files
   * @returns {Promise<Object>} Validation result with found and missing files
   */
  async validateReferences(references, searchDir) {
    const found = [];
    const missing = [];

    for (const reference of references) {
      const filePath = path.join(
        searchDir,
        `${reference.hash}${this.fileExtension}`
      );

      try {
        await fs.access(filePath);
        found.push(reference);
      } catch (error) {
        missing.push(reference);
      }
    }

    return { found, missing };
  }

  /**
   * Get information about a file with references
   * @param {string} filePath - Path to file to analyze
   * @returns {Promise<Object>} Analysis result
   */
  async analyzeFile(filePath) {
    try {
      const content = await fs.readFile(filePath, "utf-8");
      const { baseContent, references } = this.extractReferences(content);

      const stats = await fs.stat(filePath);
      const searchDir = path.dirname(filePath);
      const validation = await this.validateReferences(references, searchDir);

      return {
        filePath,
        fileSize: stats.size,
        baseContentLength: baseContent.length,
        totalReferences: references.length,
        foundReferences: validation.found.length,
        missingReferences: validation.missing.length,
        references: references,
        missingFiles: validation.missing.map(
          (ref) => `${ref.hash}${this.fileExtension}`
        ),
      };
    } catch (error) {
      throw new Error(`Failed to analyze file ${filePath}: ${error.message}`);
    }
  }
}
