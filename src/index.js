#!/usr/bin/env node

import { HybridFileProcessor } from "./lib/hybridFileProcessor.js";
import { FileWriter } from "./lib/fileWriter.js";

/**
 * Multi-Source Document Processor
 * Splits documents based on ---: dividers and creates hash-named files
 */
class MultiSourceProcessor {
  constructor(options = {}) {
    this.options = {
      inputFile: options.inputFile || "multi-source.md",
      outputDir: options.outputDir || "_out",
      hashLength: options.hashLength || 8,
      overwrite: options.overwrite || false,
      verbose: options.verbose || false,
      clean: options.clean || false,
      sharedTimestamp: options.sharedTimestamp || false,
      addReferences: options.addReferences !== false, // Default to true
      ...options,
    };

    this.fileProcessor = new HybridFileProcessor({
      streamingThreshold: options.streamingThreshold || 10 * 1024 * 1024, // 10MB default
    });
    this.fileWriter = new FileWriter({
      outputDir: this.options.outputDir,
      overwriteExisting: this.options.overwrite,
      hashOptions: { length: this.options.hashLength },
      timestampOptions: {},
    });
  }

  /**
   * Main processing function
   */
  async process() {
    try {
      console.log("🚀 Multi-Source Document Processor");
      console.log(`📄 Input file: ${this.options.inputFile}`);
      console.log(`📁 Output directory: ${this.options.outputDir}`);
      console.log("");

      // Clean output directory if requested
      if (this.options.clean) {
        console.log("🧹 Cleaning output directory...");
        await this.fileWriter.cleanOutputDirectory();
        console.log("");
      }

      // Validate input file
      const isValid = await this.fileProcessor.validateInputFile(
        this.options.inputFile
      );
      if (!isValid) {
        throw new Error(
          `Input file not found or not readable: ${this.options.inputFile}`
        );
      }

      // Read and split the document
      console.log("📖 Reading and splitting document...");
      const sections = await this.fileProcessor.readAndSplit(
        this.options.inputFile
      );

      if (sections.length === 0) {
        console.log("⚠️  No sections found in the document");
        return;
      }

      console.log(`📋 Found ${sections.length} sections`);

      if (this.options.verbose) {
        sections.forEach((section, index) => {
          console.log(
            `   Section ${index}: ${
              section.hasDivider ? "Has divider" : "No divider"
            } (${section.content.length} chars)`
          );
        });
      }
      console.log("");

      // Write sections to files
      console.log("💾 Writing sections to files...");
      const results = await this.fileWriter.writeSections(sections, {
        useSharedTimestamp: this.options.sharedTimestamp,
        addReferences: this.options.addReferences,
        sourceFilename: this.options.inputFile,
      });

      // Summary
      console.log("");
      this.printSummary(results);
    } catch (error) {
      console.error("❌ Error:", error.message);
      process.exit(1);
    }
  }

  /**
   * Print processing summary
   */
  printSummary(results) {
    const successful = results.filter((r) => r.success);
    const failed = results.filter((r) => !r.success);
    const skipped = failed.filter((r) => r.reason === "file_exists");
    const errors = failed.filter((r) => r.reason === "write_error");

    console.log("📊 Processing Summary:");
    console.log(`   ✅ Successfully written: ${successful.length} files`);

    if (skipped.length > 0) {
      console.log(`   ⏭️  Skipped (already exist): ${skipped.length} files`);
    }

    if (errors.length > 0) {
      console.log(`   ❌ Failed: ${errors.length} files`);
    }

    if (this.options.verbose && successful.length > 0) {
      console.log("\n📁 Created files:");
      successful.forEach((result) => {
        console.log(`   ${result.filename} (${result.hash})`);
      });
    }

    const totalSize = successful.reduce((sum, result) => sum + result.size, 0);
    console.log(`\n💾 Total output size: ${totalSize} bytes`);
  }

  /**
   * Show help information
   */
  static showHelp() {
    console.log(`
Multi-Source Document Processor

Usage: node src/index.js [options]

Options:
  --input, -i <file>     Input file path (default: multi-source.md)
  --output, -o <dir>     Output directory (default: _out)
  --hash-length <num>    Hash length in characters (default: 8)
  --streaming-threshold <mb>  File size threshold for streaming (default: 10MB)
  --overwrite           Overwrite existing files
  --clean               Clean output directory before processing
  --shared-timestamp    Use same timestamp for all files
  --no-references       Don't add reference lines to first file
  --verbose, -v         Verbose output
  --help, -h            Show this help

Examples:
  node src/index.js
  node src/index.js --input document.md --output results
  node src/index.js --clean --overwrite --verbose
  node src/index.js -i multi-source.md -o _out --hash-length 10
`);
  }
}

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case "--help":
      case "-h":
        MultiSourceProcessor.showHelp();
        process.exit(0);

      case "--input":
      case "-i":
        options.inputFile = args[++i];
        break;

      case "--output":
      case "-o":
        options.outputDir = args[++i];
        break;

      case "--hash-length":
        options.hashLength = parseInt(args[++i], 10);
        break;

      case "--overwrite":
        options.overwrite = true;
        break;

      case "--clean":
        options.clean = true;
        break;

      case "--shared-timestamp":
        options.sharedTimestamp = true;
        break;

      case "--no-references":
        options.addReferences = false;
        break;

      case "--streaming-threshold":
        options.streamingThreshold = parseInt(args[++i], 10) * 1024 * 1024; // Convert MB to bytes
        break;

      case "--verbose":
      case "-v":
        options.verbose = true;
        break;

      default:
        if (arg.startsWith("-")) {
          console.error(`Unknown option: ${arg}`);
          console.error("Use --help for usage information");
          process.exit(1);
        }
        break;
    }
  }

  return options;
}

/**
 * Main entry point
 */
async function main() {
  try {
    const options = parseArgs();
    const processor = new MultiSourceProcessor(options);
    await processor.process();
  } catch (error) {
    console.error("Fatal error:", error.message);
    process.exit(1);
  }
}

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { MultiSourceProcessor };
