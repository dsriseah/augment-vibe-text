import fs from "fs/promises";
import { FileProcessor } from "./fileProcessor.js";
import { StreamingFileProcessor } from "./streamingFileProcessor.js";

/**
 * Hybrid file processor that chooses optimal strategy based on file size
 * Uses streaming for large files, in-memory for small files
 */
export class HybridFileProcessor {
  constructor(options = {}) {
    this.streamingThreshold = options.streamingThreshold || 10 * 1024 * 1024; // 10MB
    this.memoryProcessor = new FileProcessor();
    this.streamingProcessor = new StreamingFileProcessor(options);
  }

  /**
   * Automatically choose processing strategy based on file size
   * @param {string} filePath - Path to the input file
   * @returns {Promise<Array>} Array of document sections
   */
  async readAndSplit(filePath) {
    const stats = await fs.stat(filePath);

    if (stats.size > this.streamingThreshold) {
      console.log(
        `📊 Large file detected (${this.formatBytes(
          stats.size
        )}), using streaming processor`
      );
      return await this.streamingProcessor.streamSplit(filePath);
    } else {
      console.log(
        `📊 Small file (${this.formatBytes(
          stats.size
        )}), using memory processor`
      );
      return await this.memoryProcessor.readAndSplit(filePath);
    }
  }

  /**
   * Get file analysis with optimal strategy
   * @param {string} filePath - Path to the file
   * @returns {Promise<Object>} File analysis
   */
  async analyzeFile(filePath) {
    const stats = await fs.stat(filePath);

    if (stats.size > this.streamingThreshold) {
      return await this.streamingProcessor.analyzeFile(filePath);
    } else {
      // For small files, we can afford to load into memory for analysis
      const sections = await this.memoryProcessor.readAndSplit(filePath);
      return {
        filePath,
        totalSize: stats.size,
        sectionCount: sections.length,
        lastModified: stats.mtime,
        processingMethod: "memory",
        sections: sections.map((content, index) => ({
          index,
          content,
          size: Buffer.byteLength(content, "utf-8"),
          hash: this.streamingProcessor.hashGenerator.generateSectionHash({
            content,
          }),
        })),
      };
    }
  }

  /**
   * Get file statistics
   * @param {string} filePath - Path to the file
   * @returns {Promise<Object>} File statistics
   */
  async getFileStats(filePath) {
    const stats = await fs.stat(filePath);

    if (stats.size > this.streamingThreshold) {
      return await this.streamingProcessor.getFileStats(filePath);
    } else {
      const sections = await this.memoryProcessor.readAndSplit(filePath);
      return {
        totalSize: stats.size,
        sectionCount: sections.length,
        averageSectionSize:
          sections.length > 0 ? Math.round(stats.size / sections.length) : 0,
        lastModified: stats.mtime,
        processingMethod: "memory",
        streamingThreshold: this.streamingThreshold,
        useStreaming: false,
      };
    }
  }

  /**
   * Find section by hash (delegates to appropriate processor)
   * @param {string} filePath - Path to the file
   * @param {string} hash - Hash to search for
   * @returns {Promise<Object|null>} Section data or null
   */
  async findSectionByHash(filePath, hash) {
    const stats = await fs.stat(filePath);

    if (stats.size > this.streamingThreshold) {
      return await this.streamingProcessor.findSectionByHash(filePath, hash);
    } else {
      // For small files, load and search in memory
      const sections = await this.memoryProcessor.readAndSplit(filePath);
      for (let i = 0; i < sections.length; i++) {
        const sectionHash =
          this.streamingProcessor.hashGenerator.generateSectionHash({
            content: sections[i],
          });
        if (sectionHash === hash) {
          return {
            index: i,
            content: sections[i],
            hash: sectionHash,
            size: Buffer.byteLength(sections[i], "utf-8"),
          };
        }
      }
      return null;
    }
  }

  /**
   * Extract specific section (delegates to appropriate processor)
   * @param {string} filePath - Path to the file
   * @param {number} sectionIndex - Section index (0-based)
   * @returns {Promise<string>} Section content
   */
  async extractSection(filePath, sectionIndex) {
    const stats = await fs.stat(filePath);

    if (stats.size > this.streamingThreshold) {
      const metadata = await this.streamingProcessor.analyzeFile(filePath);
      if (sectionIndex >= metadata.sections.length) {
        throw new Error(`Section index ${sectionIndex} out of range`);
      }

      const section = metadata.sections[sectionIndex];
      return await this.streamingProcessor.extractSection(
        filePath,
        section.startLine,
        section.endLine
      );
    } else {
      const sections = await this.memoryProcessor.readAndSplit(filePath);
      if (sectionIndex >= sections.length) {
        throw new Error(`Section index ${sectionIndex} out of range`);
      }
      return sections[sectionIndex];
    }
  }

  /**
   * Check if file should use streaming based on size
   * @param {string} filePath - Path to the file
   * @returns {Promise<boolean>} True if should use streaming
   */
  async shouldUseStreaming(filePath) {
    const stats = await fs.stat(filePath);
    return stats.size > this.streamingThreshold;
  }

  /**
   * Get processing recommendation for a file
   * @param {string} filePath - Path to the file
   * @returns {Promise<Object>} Processing recommendation
   */
  async getProcessingRecommendation(filePath) {
    const stats = await fs.stat(filePath);
    const useStreaming = stats.size > this.streamingThreshold;

    return {
      filePath,
      fileSize: stats.size,
      fileSizeFormatted: this.formatBytes(stats.size),
      streamingThreshold: this.streamingThreshold,
      streamingThresholdFormatted: this.formatBytes(this.streamingThreshold),
      recommendedMethod: useStreaming ? "streaming" : "memory",
      useStreaming,
      estimatedMemoryUsage: useStreaming
        ? "Low (streaming)"
        : this.formatBytes(stats.size * 2), // Rough estimate
      benefits: useStreaming
        ? [
            "Low memory usage",
            "Handles very large files",
            "Scalable for server use",
          ]
        : [
            "Faster processing",
            "Simpler error handling",
            "Better for small files",
          ],
    };
  }

  /**
   * Validate input file (delegates to streaming processor)
   * @param {string} filePath - Path to validate
   * @returns {Promise<boolean>} True if valid
   */
  async validateInputFile(filePath) {
    return await this.streamingProcessor.validateInputFile(filePath);
  }

  /**
   * Get file extension (delegates to streaming processor)
   * @param {string} filePath - File path
   * @returns {string} File extension
   */
  getFileExtension(filePath) {
    return this.streamingProcessor.getFileExtension(filePath);
  }

  /**
   * Split content (delegates to memory processor for compatibility)
   * @param {string} content - Content to split
   * @returns {Array} Array of sections
   */
  splitContent(content) {
    return this.memoryProcessor.splitContent(content);
  }

  /**
   * Format bytes into human readable format
   * @param {number} bytes - Number of bytes
   * @returns {string} Formatted string
   */
  formatBytes(bytes) {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  }

  /**
   * Get current configuration
   * @returns {Object} Current configuration
   */
  getConfig() {
    return {
      streamingThreshold: this.streamingThreshold,
      streamingThresholdFormatted: this.formatBytes(this.streamingThreshold),
      hasMemoryProcessor: !!this.memoryProcessor,
      hasStreamingProcessor: !!this.streamingProcessor,
      chunkSize: this.streamingProcessor.chunkSize,
      maxLineLength: this.streamingProcessor.maxLineLength,
    };
  }

  /**
   * Update configuration
   * @param {Object} options - New configuration options
   */
  updateConfig(options = {}) {
    if (options.streamingThreshold !== undefined) {
      this.streamingThreshold = options.streamingThreshold;
    }

    if (options.chunkSize !== undefined) {
      this.streamingProcessor.chunkSize = options.chunkSize;
    }

    if (options.maxLineLength !== undefined) {
      this.streamingProcessor.maxLineLength = options.maxLineLength;
    }
  }
}
