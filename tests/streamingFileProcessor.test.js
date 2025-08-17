import { test, describe } from "node:test";
import assert from "node:assert";
import fs from "fs/promises";
import path from "path";
import { StreamingFileProcessor } from "../src/lib/streamingFileProcessor.js";

describe("StreamingFileProcessor", () => {
  let processor;
  let testDir;
  let testFile;

  // Setup before tests
  async function setup() {
    processor = new StreamingFileProcessor();
    testDir = path.join(process.cwd(), "tests", "temp");

    try {
      await fs.mkdir(testDir, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }
  }

  // Cleanup after tests
  async function cleanup() {
    try {
      if (testFile) {
        await fs.unlink(testFile);
      }
    } catch (error) {
      // File might not exist
    }
  }

  test("should create StreamingFileProcessor instance", async () => {
    await setup();

    assert.ok(processor instanceof StreamingFileProcessor);
    assert.ok(processor.dividerPattern);
    assert.ok(processor.hashGenerator);

    await cleanup();
  });

  test("should analyze file structure without loading full content", async () => {
    await setup();

    const content = `First section content
Some more content

---:

Second section content
More content here

---:

Third section content
Final content`;

    testFile = path.join(testDir, "test-analyze.md");
    await fs.writeFile(testFile, content, "utf-8");

    const metadata = await processor.analyzeFile(testFile);

    assert.strictEqual(metadata.sections.length, 3);
    assert.strictEqual(metadata.dividerLines.length, 2);
    assert.strictEqual(metadata.totalLines, 12);
    assert.ok(metadata.totalSize > 0);
    assert.ok(metadata.hashIndex.size === 3);

    // Check section metadata
    const firstSection = metadata.sections[0];
    assert.strictEqual(firstSection.startLine, 1);
    assert.strictEqual(firstSection.endLine, 3);
    assert.ok(firstSection.hash);

    await cleanup();
  });

  test("should extract specific sections by line range", async () => {
    await setup();

    const content = `Line 1
Line 2
Line 3
---:
Line 5
Line 6`;

    testFile = path.join(testDir, "test-extract.md");
    await fs.writeFile(testFile, content, "utf-8");

    const section1 = await processor.extractSection(testFile, 1, 3);
    const section2 = await processor.extractSection(testFile, 5, 6);

    assert.strictEqual(section1, "Line 1\nLine 2\nLine 3");
    assert.strictEqual(section2, "Line 5\nLine 6");

    await cleanup();
  });

  test("should generate hashes for sections efficiently", async () => {
    await setup();

    const content = `Section 1 content
More content

---:

Section 2 content
Different content`;

    testFile = path.join(testDir, "test-hash.md");
    await fs.writeFile(testFile, content, "utf-8");

    const hash1 = await processor.generateSectionHash(testFile, 1, 2);
    const hash2 = await processor.generateSectionHash(testFile, 5, 6);

    assert.ok(hash1);
    assert.ok(hash2);
    assert.notStrictEqual(hash1, hash2);
    assert.ok(/^[A-F0-9]+$/i.test(hash1));
    assert.ok(/^[A-F0-9]+$/i.test(hash2));

    await cleanup();
  });

  test("should find sections by hash", async () => {
    await setup();

    const content = `First section
Content here

---:

Second section
More content`;

    testFile = path.join(testDir, "test-find.md");
    await fs.writeFile(testFile, content, "utf-8");

    const metadata = await processor.analyzeFile(testFile);
    const firstHash = metadata.sections[0].hash;

    const foundSection = await processor.findSectionByHash(testFile, firstHash);

    assert.ok(foundSection);
    assert.strictEqual(foundSection.startLine, 1);
    assert.strictEqual(foundSection.endLine, 3);
    assert.strictEqual(foundSection.hash, firstHash);

    await cleanup();
  });

  test("should provide file statistics without loading content", async () => {
    await setup();

    const content = `Section 1

---:

Section 2

---:

Section 3`;

    testFile = path.join(testDir, "test-stats.md");
    await fs.writeFile(testFile, content, "utf-8");

    const stats = await processor.getFileStats(testFile);

    assert.strictEqual(stats.sectionCount, 3);
    assert.strictEqual(stats.dividerCount, 2);
    assert.strictEqual(stats.totalLines, 9);
    assert.ok(stats.totalSize > 0);
    assert.ok(stats.averageSectionSize > 0);
    assert.ok(stats.lastModified instanceof Date);
    assert.strictEqual(stats.hashIndex.length, 3);

    await cleanup();
  });

  test("should handle large files efficiently", async () => {
    await setup();

    // Create a larger test file
    const sections = [];
    for (let i = 0; i < 100; i++) {
      sections.push(
        `Section ${i} content\nLine 2 of section ${i}\nLine 3 of section ${i}`
      );
    }
    const content = sections.join("\n\n---:\n\n");

    testFile = path.join(testDir, "test-large.md");
    await fs.writeFile(testFile, content, "utf-8");

    const startTime = Date.now();
    const metadata = await processor.analyzeFile(testFile);
    const endTime = Date.now();

    assert.strictEqual(metadata.sections.length, 100);
    assert.ok(endTime - startTime < 5000); // Should complete in under 5 seconds
    assert.ok(metadata.hashIndex.size === 100);

    await cleanup();
  });

  test("should stream-split file into sections", async () => {
    await setup();

    const content = `First section
Content

---:

Second section
More content`;

    testFile = path.join(testDir, "test-stream-split.md");
    await fs.writeFile(testFile, content, "utf-8");

    const sections = await processor.streamSplit(testFile);

    assert.strictEqual(sections.length, 2);
    assert.ok(sections[0].content.includes("First section"));
    assert.ok(sections[1].content.includes("Second section"));
    assert.ok(sections[0].hash);
    assert.ok(sections[1].hash);
    assert.ok(sections[0].metadata);

    await cleanup();
  });

  test("should handle files without dividers", async () => {
    await setup();

    const content = `Single section content
No dividers here
Just plain content`;

    testFile = path.join(testDir, "test-no-dividers.md");
    await fs.writeFile(testFile, content, "utf-8");

    const metadata = await processor.analyzeFile(testFile);

    assert.strictEqual(metadata.sections.length, 1);
    assert.strictEqual(metadata.dividerLines.length, 0);
    assert.ok(metadata.sections[0].hash);

    await cleanup();
  });

  test("should validate input files properly", async () => {
    await setup();

    // Test non-existent file
    await assert.rejects(
      () => processor.validateInputFile("/non/existent/file.md"),
      /File not found/
    );

    // Test empty path
    await assert.rejects(
      () => processor.validateInputFile(""),
      /File path must be a non-empty string/
    );

    // Test directory instead of file
    await assert.rejects(
      () => processor.validateInputFile(testDir),
      /Path is not a file/
    );

    await cleanup();
  });

  test("should handle edge cases gracefully", async () => {
    await setup();

    // Empty file
    testFile = path.join(testDir, "test-empty.md");
    await fs.writeFile(testFile, "", "utf-8");

    const metadata = await processor.analyzeFile(testFile);
    assert.strictEqual(metadata.sections.length, 0);
    assert.strictEqual(metadata.totalLines, 0);

    // File with only dividers
    const dividersOnly = "---:\n---:\n---:";
    testFile = path.join(testDir, "test-dividers-only.md");
    await fs.writeFile(testFile, dividersOnly, "utf-8");

    const metadata2 = await processor.analyzeFile(testFile);
    assert.strictEqual(metadata2.sections.length, 0);
    assert.strictEqual(metadata2.dividerLines.length, 3);

    await cleanup();
  });

  test("should maintain backward compatibility with splitContent", async () => {
    await setup();

    const content = `Section 1

---:

Section 2`;

    const sections = processor.splitContent(content);

    assert.strictEqual(sections.length, 2);
    assert.ok(sections[0].includes("Section 1"));
    assert.ok(sections[1].includes("Section 2"));

    await cleanup();
  });
});
