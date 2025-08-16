import fs from "fs/promises";
import path from "path";
import { HashGenerator } from "./hashGenerator.js";
import { TimestampUtils } from "./timestampUtils.js";

/**
 * File writing and output directory management
 */
export class FileWriter {
  constructor(options = {}) {
    this.outputDir = options.outputDir || "_out";
    this.fileExtension = options.fileExtension || ".md";
    this.hashGenerator = new HashGenerator(options.hashOptions);
    this.timestampUtils = new TimestampUtils(options.timestampOptions);
    this.overwriteExisting = options.overwriteExisting || false;
  }

  /**
   * Ensure output directory exists
   * @returns {Promise<void>}
   */
  async ensureOutputDirectory() {
    try {
      await fs.access(this.outputDir);
    } catch (error) {
      // Directory doesn't exist, create it
      try {
        await fs.mkdir(this.outputDir, { recursive: true });
        console.log(`Created output directory: ${this.outputDir}`);
      } catch (createError) {
        throw new Error(
          `Failed to create output directory ${this.outputDir}: ${createError.message}`
        );
      }
    }
  }

  /**
   * Write a section to a file
   * @param {Object} section - Section object with content and metadata
   * @param {Object} options - Writing options
   * @returns {Promise<Object>} Result object with file info
   */
  async writeSection(section, options = {}) {
    await this.ensureOutputDirectory();

    // Generate hash for the section
    const hash = this.hashGenerator.generateSectionHash(section);

    // Create filename - use original source name for first section, hash for others
    let filename;
    if (section.index === 0 && !section.hasDivider && options.sourceFilename) {
      // Use original source filename for the first section
      const baseName = path.basename(
        options.sourceFilename,
        path.extname(options.sourceFilename)
      );
      filename = `${baseName}${this.fileExtension}`;
    } else {
      // Use hash for other sections
      filename = `${hash}${this.fileExtension}`;
    }

    const filePath = path.join(this.outputDir, filename);

    // Check if file already exists
    if (!this.overwriteExisting) {
      try {
        await fs.access(filePath);
        console.warn(`File ${filename} already exists, skipping...`);
        return {
          success: false,
          reason: "file_exists",
          hash,
          filename,
          filePath,
        };
      } catch (error) {
        // File doesn't exist, continue with writing
      }
    }

    // Prepare content with modified divider
    const modifiedContent = this.modifyDividerInContent(
      section,
      hash,
      options.timestamp
    );

    try {
      await fs.writeFile(filePath, modifiedContent, "utf-8");

      const stats = await fs.stat(filePath);

      return {
        success: true,
        hash,
        filename,
        filePath,
        size: stats.size,
        timestamp: options.timestamp || new Date(),
        section: {
          index: section.index,
          hasDivider: section.hasDivider,
        },
      };
    } catch (error) {
      throw new Error(`Failed to write file ${filePath}: ${error.message}`);
    }
  }

  /**
   * Modify divider line in content to include hash and timestamp
   * @param {Object} section - Section object
   * @param {string} hash - Generated hash
   * @param {Date} [timestamp] - Optional timestamp
   * @returns {string} Modified content
   */
  modifyDividerInContent(section, hash, timestamp = null) {
    if (!section.hasDivider || !section.originalDividerLine) {
      return section.content;
    }

    const newDividerLine = this.timestampUtils.createDividerLine(
      hash,
      timestamp
    );

    // Replace the original divider line with the new one
    return section.content.replace(section.originalDividerLine, newDividerLine);
  }

  /**
   * Write multiple sections to files
   * @param {Array} sections - Array of section objects
   * @param {Object} options - Writing options
   * @returns {Promise<Array>} Array of write results
   */
  async writeSections(sections, options = {}) {
    const results = [];
    const timestamp = options.useSharedTimestamp ? new Date() : null;

    // First pass: write all sections and collect results
    for (const section of sections) {
      try {
        const writeOptions = {
          ...options,
          timestamp: options.useSharedTimestamp ? timestamp : new Date(),
          sourceFilename: options.sourceFilename,
        };

        const result = await this.writeSection(section, writeOptions);
        results.push(result);

        if (result.success) {
          console.log(`✓ Written: ${result.filename} (${result.size} bytes)`);
        } else {
          console.log(`⚠ Skipped: ${result.filename} (${result.reason})`);
        }
      } catch (error) {
        console.error(
          `✗ Failed to write section ${section.index}: ${error.message}`
        );
        results.push({
          success: false,
          reason: "write_error",
          error: error.message,
          section: { index: section.index },
        });
      }
    }

    // Second pass: add references to the first file if enabled and it exists and doesn't have a divider
    if (options.addReferences !== false) {
      await this.addReferencesToFirstFile(results, options);
    }

    return results;
  }

  /**
   * Add reference lines to the first file (the one without a divider)
   * @param {Array} results - Array of write results
   * @param {Object} options - Writing options
   * @returns {Promise<void>}
   */
  async addReferencesToFirstFile(results, options = {}) {
    // Find the first file (section index 0) that doesn't have a divider
    const firstFileResult = results.find(
      (result) =>
        result.success &&
        result.section &&
        result.section.index === 0 &&
        !result.section.hasDivider
    );

    if (!firstFileResult) {
      return; // No first file without divider found
    }

    // Get all other successful files to reference
    const otherFiles = results.filter(
      (result) => result.success && result.section && result.section.index !== 0
    );

    if (otherFiles.length === 0) {
      return; // No other files to reference
    }

    try {
      // Read the current content of the first file
      const currentContent = await fs.readFile(
        firstFileResult.filePath,
        "utf-8"
      );

      // Create reference lines
      const referenceLines = otherFiles.map((file) => {
        const hash = path.basename(file.filename, this.fileExtension);
        return `---: ${hash}`;
      });

      // Add references at the end of the file
      const updatedContent =
        currentContent.trim() + "\n\n" + referenceLines.join("\n") + "\n";

      // Write the updated content back
      await fs.writeFile(firstFileResult.filePath, updatedContent, "utf-8");

      // Update the file size in the result
      const stats = await fs.stat(firstFileResult.filePath);
      firstFileResult.size = stats.size;

      console.log(
        `✓ Added ${otherFiles.length} references to: ${firstFileResult.filename}`
      );
    } catch (error) {
      console.error(
        `✗ Failed to add references to ${firstFileResult.filename}: ${error.message}`
      );
    }
  }

  /**
   * Clean output directory (remove all files)
   * @returns {Promise<void>}
   */
  async cleanOutputDirectory() {
    try {
      const files = await fs.readdir(this.outputDir);

      for (const file of files) {
        const filePath = path.join(this.outputDir, file);
        const stats = await fs.stat(filePath);

        if (stats.isFile()) {
          await fs.unlink(filePath);
          console.log(`Removed: ${file}`);
        }
      }

      console.log(`Cleaned output directory: ${this.outputDir}`);
    } catch (error) {
      if (error.code === "ENOENT") {
        console.log(`Output directory ${this.outputDir} does not exist`);
      } else {
        throw new Error(`Failed to clean output directory: ${error.message}`);
      }
    }
  }

  /**
   * Get information about existing output files
   * @returns {Promise<Array>} Array of file information objects
   */
  async getOutputFileInfo() {
    try {
      await this.ensureOutputDirectory();
      const files = await fs.readdir(this.outputDir);
      const fileInfos = [];

      for (const file of files) {
        const filePath = path.join(this.outputDir, file);
        const stats = await fs.stat(filePath);

        if (stats.isFile() && file.endsWith(this.fileExtension)) {
          // Try to extract hash from filename
          const hash = path.basename(file, this.fileExtension);

          fileInfos.push({
            filename: file,
            filePath,
            hash,
            size: stats.size,
            created: stats.birthtime,
            modified: stats.mtime,
          });
        }
      }

      return fileInfos.sort((a, b) => a.filename.localeCompare(b.filename));
    } catch (error) {
      throw new Error(`Failed to get output file info: ${error.message}`);
    }
  }

  /**
   * Validate that a hash-based filename is valid
   * @param {string} filename - Filename to validate
   * @returns {boolean} True if filename format is valid
   */
  isValidHashFilename(filename) {
    const baseName = path.basename(filename, this.fileExtension);
    return this.hashGenerator.isValidHash(baseName);
  }
}
