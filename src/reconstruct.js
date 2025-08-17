#!/usr/bin/env node

import { DocumentReconstructor } from './lib/documentReconstructor.js';
import fs from 'fs/promises';
import path from 'path';

/**
 * Multi-Source Document Reconstructor
 * Combines referenced files back into original source document
 */
class MultiSourceReconstructor {
  constructor(options = {}) {
    this.options = {
      inputFile: options.inputFile || null,
      outputFile: options.outputFile || null,
      inputDir: options.inputDir || '_out',
      analyze: options.analyze || false,
      verbose: options.verbose || false,
      ...options
    };

    this.reconstructor = new DocumentReconstructor({
      inputDir: this.options.inputDir,
      fileExtension: '.md'
    });
  }

  /**
   * Main reconstruction process
   */
  async reconstruct() {
    try {
      console.log('🔄 Multi-Source Document Reconstructor');
      
      if (!this.options.inputFile) {
        throw new Error('Input file is required. Use --input or -i to specify the file.');
      }

      console.log(`📄 Input file: ${this.options.inputFile}`);
      console.log(`📁 Search directory: ${this.options.inputDir}`);
      console.log('');

      // Validate input file exists
      try {
        await fs.access(this.options.inputFile);
      } catch (error) {
        throw new Error(`Input file not found: ${this.options.inputFile}`);
      }

      if (this.options.analyze) {
        await this.analyzeFile();
        return;
      }

      // Reconstruct the document
      console.log('🔍 Analyzing references...');
      const analysis = await this.reconstructor.analyzeFile(this.options.inputFile);
      
      if (this.options.verbose) {
        this.printAnalysis(analysis);
      }

      if (analysis.missingReferences > 0) {
        console.log(`⚠️  Warning: ${analysis.missingReferences} referenced files are missing:`);
        analysis.missingFiles.forEach(file => console.log(`   - ${file}`));
        console.log('');
      }

      console.log('🔄 Reconstructing document...');
      const reconstructedContent = await this.reconstructor.reconstructDocument(this.options.inputFile);

      // Determine output file
      let outputFile = this.options.outputFile;
      if (!outputFile) {
        const inputBaseName = path.basename(this.options.inputFile, path.extname(this.options.inputFile));
        outputFile = `${inputBaseName}-reconstructed.md`;
      }

      // Write reconstructed content
      await fs.writeFile(outputFile, reconstructedContent, 'utf-8');
      
      const stats = await fs.stat(outputFile);
      console.log(`✓ Reconstructed document written to: ${outputFile} (${stats.size} bytes)`);

      // Summary
      console.log('');
      console.log('📊 Reconstruction Summary:');
      console.log(`   📄 Original sections: ${analysis.totalReferences + 1}`);
      console.log(`   ✅ Successfully combined: ${analysis.foundReferences + 1}`);
      if (analysis.missingReferences > 0) {
        console.log(`   ❌ Missing sections: ${analysis.missingReferences}`);
      }
      console.log(`   💾 Output size: ${stats.size} bytes`);

    } catch (error) {
      console.error('❌ Error:', error.message);
      process.exit(1);
    }
  }

  /**
   * Analyze file and show detailed information
   */
  async analyzeFile() {
    console.log('🔍 Analyzing file...');
    const analysis = await this.reconstructor.analyzeFile(this.options.inputFile);
    
    this.printAnalysis(analysis);

    if (analysis.missingReferences > 0) {
      console.log('\n❌ Missing Referenced Files:');
      analysis.missingFiles.forEach(file => console.log(`   - ${file}`));
    }

    if (analysis.foundReferences > 0) {
      console.log('\n✅ Found Referenced Files:');
      analysis.references
        .filter(ref => !analysis.missingFiles.includes(`${ref.hash}.md`))
        .forEach(ref => console.log(`   - ${ref.hash}.md (line ${ref.lineNumber})`));
    }
  }

  /**
   * Print analysis information
   */
  printAnalysis(analysis) {
    console.log('📊 File Analysis:');
    console.log(`   📄 File: ${analysis.filePath}`);
    console.log(`   💾 Size: ${analysis.fileSize} bytes`);
    console.log(`   📝 Base content: ${analysis.baseContentLength} characters`);
    console.log(`   🔗 Total references: ${analysis.totalReferences}`);
    console.log(`   ✅ Found files: ${analysis.foundReferences}`);
    console.log(`   ❌ Missing files: ${analysis.missingReferences}`);
  }

  /**
   * Show help information
   */
  static showHelp() {
    console.log(`
Multi-Source Document Reconstructor

Usage: node src/reconstruct.js [options]

Options:
  --input, -i <file>     Input file with references (required)
  --output, -o <file>    Output file path (default: <input>-reconstructed.md)
  --input-dir <dir>      Directory to search for referenced files (default: _out)
  --analyze              Only analyze the file, don't reconstruct
  --verbose, -v          Verbose output
  --help, -h             Show this help

Examples:
  node src/reconstruct.js -i _out/multi-source.md
  node src/reconstruct.js -i _out/multi-source.md -o original.md
  node src/reconstruct.js -i _out/multi-source.md --analyze --verbose
  node src/reconstruct.js -i document.md --input-dir results
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
      case '--help':
      case '-h':
        MultiSourceReconstructor.showHelp();
        process.exit(0);
        
      case '--input':
      case '-i':
        options.inputFile = args[++i];
        break;
        
      case '--output':
      case '-o':
        options.outputFile = args[++i];
        break;
        
      case '--input-dir':
        options.inputDir = args[++i];
        break;
        
      case '--analyze':
        options.analyze = true;
        break;
        
      case '--verbose':
      case '-v':
        options.verbose = true;
        break;
        
      default:
        if (arg.startsWith('-')) {
          console.error(`Unknown option: ${arg}`);
          console.error('Use --help for usage information');
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
    const reconstructor = new MultiSourceReconstructor(options);
    await reconstructor.reconstruct();
  } catch (error) {
    console.error('Fatal error:', error.message);
    process.exit(1);
  }
}

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { MultiSourceReconstructor };
