# Multi-Source Document Processor

A Node.js program that reads documents with `---:` dividers and splits them into separate files with hash-based names and timestamps.

## Features

- **Document Splitting**: Automatically splits documents based on `---:` divider lines
- **Smart Naming**: First file keeps original source name, other files use SHA-256 hash names
- **Timestamp Integration**: Adds timestamps to divider lines in format `HH:MM:SS YYYY/MM/DD`
- **Reference Generation**: Automatically adds reference lines to the first file pointing to all other generated files
- **Content Preservation**: Maintains all original formatting and content
- **Error Handling**: Comprehensive validation and error reporting
- **CLI Interface**: Easy-to-use command line interface with multiple options

## Installation

```bash
# Clone or download the project
cd multi-source-processor

# Install dependencies (none required - uses Node.js built-ins)
npm install

# Make executable (optional)
chmod +x src/index.js
```

## Usage

### Basic Usage

```bash
# Process multi-source.md and output to _out directory
node src/index.js

# Process a specific file
node src/index.js --input document.md

# Use custom output directory
node src/index.js --output results
```

### Command Line Options

```bash
node src/index.js [options]

Options:
  --input, -i <file>     Input file path (default: multi-source.md)
  --output, -o <dir>     Output directory (default: _out)
  --hash-length <num>    Hash length in characters (default: 8)
  --overwrite           Overwrite existing files
  --clean               Clean output directory before processing
  --shared-timestamp    Use same timestamp for all files
  --no-references       Don't add reference lines to first file
  --verbose, -v         Verbose output
  --help, -h            Show help
```

### Examples

```bash
# Basic processing with verbose output
node src/index.js --verbose

# Clean output directory and overwrite existing files
node src/index.js --clean --overwrite

# Use longer hashes and custom directories
node src/index.js -i document.md -o results --hash-length 12

# Process with shared timestamp for all sections
node src/index.js --shared-timestamp --verbose
```

## How It Works

### Input Format

The program looks for `---:` divider lines in your document:

```markdown
First section content
Some text here

---:

Second section content
More text here

---:

Third section content
Final content
```

### Output

Each section becomes a separate file:

- `multi-source.md` - First section (keeps original filename, with references to other files)
- `E5F6G7H8.md` - Second section (hash-based filename)
- `I9J0K1L2.md` - Third section (hash-based filename)

### Divider Line Transformation

Original divider lines are enhanced with hash and timestamp:

```markdown
---: A1B2C3D4 16:12:30 2025/08/16
```

### Reference Generation

The first file (which keeps the original source filename) automatically gets reference lines added at the end:

```markdown
Original content...

---: E5F6G7H8
---: I9J0K1L2
```

These references point to all other generated files, creating a navigation system from the main document to its sections.

## API Reference

### Core Classes

#### FileProcessor

Handles document reading and section splitting.

```javascript
import { FileProcessor } from "./src/lib/fileProcessor.js";

const processor = new FileProcessor();
const sections = await processor.readAndSplit("document.md");
```

#### HashGenerator

Generates consistent hashes for content identification.

```javascript
import { HashGenerator } from "./src/lib/hashGenerator.js";

const hashGen = new HashGenerator({ length: 8 });
const hash = hashGen.generateHash("content");
```

#### TimestampUtils

Handles timestamp generation and formatting.

```javascript
import { TimestampUtils } from "./src/lib/timestampUtils.js";

const timestampUtils = new TimestampUtils();
const timestamp = timestampUtils.generateTimestamp();
```

#### FileWriter

Manages output file creation and directory handling.

```javascript
import { FileWriter } from "./src/lib/fileWriter.js";

const writer = new FileWriter({ outputDir: "_out" });
await writer.writeSections(sections);
```

## Testing

Run the comprehensive test suite:

```bash
# Run all tests
npm test

# Run specific test file
npm test tests/fileProcessor.test.js
```

Test coverage includes:

- File processing and splitting logic
- Hash generation and validation
- Timestamp formatting and parsing
- File writing and directory management
- Error handling and edge cases

## Configuration

### Hash Options

- **Algorithm**: SHA-256 (default), SHA-1, MD5
- **Length**: 4-16 characters (default: 8)
- **Encoding**: Hex (uppercase)

### Timestamp Options

- **Format**: `HH:MM:SS YYYY/MM/DD` (24-hour format)
- **Timezone**: Local (default), UTC, or specific timezone

### File Options

- **Extension**: `.md` (default) or custom
- **Overwrite**: Control existing file handling
- **Directory**: Custom output directory

## Error Handling

The program includes comprehensive error handling for:

- **File Access**: Missing files, permission errors
- **Content Validation**: Invalid file formats, encoding issues
- **Directory Operations**: Creation failures, write permissions
- **Hash Generation**: Content validation, algorithm errors
- **Timestamp Processing**: Format validation, timezone handling

## Requirements

- **Node.js**: Version 18.0.0 or higher
- **Operating System**: Cross-platform (Windows, macOS, Linux)
- **Dependencies**: None (uses Node.js built-in modules only)

## License

MIT License - see LICENSE file for details.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

## Changelog

### v1.0.0

- Initial release
- Document splitting functionality
- Hash-based file naming
- Timestamp integration
- CLI interface
- Comprehensive test suite
