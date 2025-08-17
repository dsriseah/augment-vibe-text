import fs from "fs";
import { createReadStream } from "fs";
import { createInterface } from "readline";
import path from "path";
import { HashGenerator } from "./hashGenerator.js";

/**
 * Memory-efficient streaming file processor for large multi-source documents
 * Processes files line-by-line and builds hash reference dictionaries
 */
export class StreamingFileProcessor {
  constructor(options = {}) {
    this.dividerPattern = /^---:\s*$/;
    this.hashGenerator = new HashGenerator(options.hashOptions);
    this.chunkSize = options.chunkSize || 64 * 1024; // 64KB chunks
    this.maxLineLength = options.maxLineLength || 10000; // Prevent memory attacks
  }

  /**
   * Stream-process a file and build section metadata without loading full content
   * @param {string} filePath - Path to the input file
   * @returns {Promise<Object>} File metadata with section references
   */
  async analyzeFile(filePath) {
    await this.validateInputFile(filePath);

    const metadata = {
      filePath,
      totalLines: 0,
      totalSize: 0,
      sections: [],
      hashIndex: new Map(), // hash -> section metadata
      dividerLines: [],
      encoding: "utf-8",
      lastModified: null,
    };

    // Get file stats
    const stats = await fs.promises.stat(filePath);
    metadata.totalSize = stats.size;
    metadata.lastModified = stats.mtime;

    let currentSection = {
      startLine: 1,
      endLine: null,
      lineCount: 0,
      estimatedSize: 0,
      hash: null,
      hasDivider: false,
    };

    const fileStream = createReadStream(filePath, {
      encoding: "utf-8",
      highWaterMark: this.chunkSize,
    });

    const rl = createInterface({
      input: fileStream,
      crlfDelay: Infinity, // Handle Windows line endings
    });

    let lineNumber = 0;
    let bytesProcessed = 0;

    for await (const line of rl) {
      lineNumber++;

      // Security check for extremely long lines
      if (line.length > this.maxLineLength) {
        throw new Error(
          `Line ${lineNumber} exceeds maximum length (${this.maxLineLength} chars)`
        );
      }

      bytesProcessed += Buffer.byteLength(line, "utf-8") + 1; // +1 for newline
      currentSection.lineCount++;
      currentSection.estimatedSize += Buffer.byteLength(line, "utf-8") + 1;

      // Check for divider
      if (this.dividerPattern.test(line)) {
        // End current section
        currentSection.endLine = lineNumber - 1;

        if (currentSection.lineCount > 1) {
          // Don't create empty sections
          // Generate hash for this section (we'll need to re-read for this)
          currentSection.hash = await this.generateSectionHash(
            filePath,
            currentSection.startLine,
            currentSection.endLine
          );

          metadata.sections.push({ ...currentSection });
          metadata.hashIndex.set(currentSection.hash, { ...currentSection });
        }

        metadata.dividerLines.push(lineNumber);

        // Start new section
        currentSection = {
          startLine: lineNumber + 1,
          endLine: null,
          lineCount: 0,
          estimatedSize: 0,
          hash: null,
          hasDivider: true,
        };
      }
    }

    // Handle final section
    if (currentSection.lineCount > 0) {
      currentSection.endLine = lineNumber;
      currentSection.hash = await this.generateSectionHash(
        filePath,
        currentSection.startLine,
        currentSection.endLine
      );

      metadata.sections.push({ ...currentSection });
      metadata.hashIndex.set(currentSection.hash, { ...currentSection });
    }

    metadata.totalLines = lineNumber;

    return metadata;
  }

  /**
   * Extract a specific section by line range without loading full file
   * @param {string} filePath - Path to the file
   * @param {number} startLine - Starting line number (1-based)
   * @param {number} endLine - Ending line number (1-based, inclusive)
   * @returns {Promise<string>} Section content
   */
  async extractSection(filePath, startLine, endLine) {
    if (startLine < 1 || endLine < startLine) {
      throw new Error("Invalid line range");
    }

    const fileStream = createReadStream(filePath, { encoding: "utf-8" });
    const rl = createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    });

    const lines = [];
    let lineNumber = 0;

    for await (const line of rl) {
      lineNumber++;

      if (lineNumber >= startLine && lineNumber <= endLine) {
        lines.push(line);
      }

      // Stop reading once we've passed the end line
      if (lineNumber > endLine) {
        break;
      }
    }

    return lines.join("\n");
  }

  /**
   * Generate hash for a specific section without loading full file
   * @param {string} filePath - Path to the file
   * @param {number} startLine - Starting line number
   * @param {number} endLine - Ending line number
   * @returns {Promise<string>} Section hash
   */
  async generateSectionHash(filePath, startLine, endLine) {
    const content = await this.extractSection(filePath, startLine, endLine);
    return this.hashGenerator.generateSectionHash({ content });
  }

  /**
   * Stream-split a file into sections and write them efficiently
   * @param {string} filePath - Input file path
   * @param {Object} options - Processing options
   * @returns {Promise<Array>} Array of section metadata
   */
  async streamSplit(filePath, options = {}) {
    const metadata = await this.analyzeFile(filePath);
    const sections = [];

    for (const sectionMeta of metadata.sections) {
      const content = await this.extractSection(
        filePath,
        sectionMeta.startLine,
        sectionMeta.endLine
      );

      sections.push({
        content,
        hash: sectionMeta.hash,
        lineRange: [sectionMeta.startLine, sectionMeta.endLine],
        size: sectionMeta.estimatedSize,
        hasDivider: sectionMeta.hasDivider,
        metadata: sectionMeta,
      });
    }

    return sections;
  }

  /**
   * Find sections by hash without loading full content
   * @param {string} filePath - Path to the file
   * @param {string} hash - Hash to search for
   * @returns {Promise<Object|null>} Section metadata or null
   */
  async findSectionByHash(filePath, hash) {
    const metadata = await this.analyzeFile(filePath);
    return metadata.hashIndex.get(hash) || null;
  }

  /**
   * Get file statistics without loading content
   * @param {string} filePath - Path to the file
   * @returns {Promise<Object>} File statistics
   */
  async getFileStats(filePath) {
    const metadata = await this.analyzeFile(filePath);

    return {
      totalLines: metadata.totalLines,
      totalSize: metadata.totalSize,
      sectionCount: metadata.sections.length,
      dividerCount: metadata.dividerLines.length,
      averageSectionSize:
        metadata.sections.length > 0
          ? Math.round(metadata.totalSize / metadata.sections.length)
          : 0,
      lastModified: metadata.lastModified,
      encoding: metadata.encoding,
      hashIndex: Array.from(metadata.hashIndex.keys()),
    };
  }

  /**
   * Validate input file exists and is readable
   * @param {string} filePath - Path to validate
   * @returns {Promise<boolean>} True if valid
   */
  async validateInputFile(filePath) {
    if (
      !filePath ||
      typeof filePath !== "string" ||
      filePath.trim().length === 0
    ) {
      throw new Error("File path must be a non-empty string");
    }

    try {
      const stats = await fs.promises.stat(filePath);

      if (!stats.isFile()) {
        throw new Error(`Path is not a file: ${filePath}`);
      }

      // Check if file is readable
      await fs.promises.access(filePath, fs.constants.R_OK);

      return true;
    } catch (error) {
      if (error.code === "ENOENT") {
        throw new Error(`File not found: ${filePath}`);
      } else if (error.code === "EACCES") {
        throw new Error(`Permission denied reading file: ${filePath}`);
      } else if (error.code === "EISDIR") {
        throw new Error(`Path is a directory, not a file: ${filePath}`);
      }
      throw error;
    }
  }

  /**
   * Get file extension
   * @param {string} filePath - File path
   * @returns {string} File extension
   */
  getFileExtension(filePath) {
    return path.extname(filePath);
  }

  /**
   * Legacy compatibility method - splits content like original
   * @param {string} content - Content to split
   * @returns {Array} Array of sections
   */
  splitContent(content) {
    if (!content || typeof content !== "string") {
      throw new Error("Content must be a non-empty string");
    }

    const lines = content.split(/\r?\n/);
    const sections = [];
    let currentSection = [];

    for (const line of lines) {
      if (this.dividerPattern.test(line)) {
        if (currentSection.length > 0) {
          sections.push(currentSection.join("\n"));
          currentSection = [];
        }
      } else {
        currentSection.push(line);
      }
    }

    // Add final section if it exists
    if (currentSection.length > 0) {
      sections.push(currentSection.join("\n"));
    }

    return sections.length > 0 ? sections : [content];
  }
}
