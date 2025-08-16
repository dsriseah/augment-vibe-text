import { test, describe } from "node:test";
import assert from "node:assert";
import fs from "fs/promises";
import path from "path";
import { FileProcessor } from "../src/lib/fileProcessor.js";

describe("FileProcessor", () => {
  let processor;
  let testDir;

  // Setup before tests
  async function setup() {
    processor = new FileProcessor();
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
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  }

  test("should create FileProcessor instance", async () => {
    await setup();
    assert.ok(processor instanceof FileProcessor);
    assert.ok(processor.dividerPattern instanceof RegExp);
    await cleanup();
  });

  test("should split content with dividers correctly", async () => {
    await setup();

    const content = `First section
Some content here

---:

Second section
More content

---:

Third section
Final content`;

    const sections = processor.splitContent(content);

    assert.strictEqual(sections.length, 3);
    assert.strictEqual(sections[0].hasDivider, false);
    assert.strictEqual(sections[1].hasDivider, true); // This section starts with divider
    assert.strictEqual(sections[2].hasDivider, true);
    assert.strictEqual(sections[1].originalDividerLine, "---:");
    assert.strictEqual(sections[2].originalDividerLine, "---:");

    await cleanup();
  });

  test("should handle content without dividers", async () => {
    await setup();

    const content = `Just some content
No dividers here
Multiple lines`;

    const sections = processor.splitContent(content);

    assert.strictEqual(sections.length, 1);
    assert.strictEqual(sections[0].hasDivider, false);
    assert.strictEqual(sections[0].originalDividerLine, null);

    await cleanup();
  });

  test("should handle empty content", async () => {
    await setup();

    const sections = processor.splitContent("");
    assert.strictEqual(sections.length, 0);

    await cleanup();
  });

  test("should validate input parameters", async () => {
    await setup();

    // Test invalid content types
    assert.throws(
      () => processor.splitContent(null),
      /Content must be a string/
    );
    assert.throws(
      () => processor.splitContent(123),
      /Content must be a string/
    );
    assert.throws(() => processor.splitContent({}), /Content must be a string/);

    await cleanup();
  });

  test("should read and split file correctly", async () => {
    await setup();

    const testFile = path.join(testDir, "test.md");
    const content = `Section 1
Content here

---:

Section 2
More content`;

    await fs.writeFile(testFile, content, "utf-8");

    const sections = await processor.readAndSplit(testFile);
    assert.strictEqual(sections.length, 2);
    assert.strictEqual(sections[0].hasDivider, false);
    assert.strictEqual(sections[1].hasDivider, true);

    await cleanup();
  });

  test("should handle file read errors", async () => {
    await setup();

    const nonExistentFile = path.join(testDir, "nonexistent.md");

    await assert.rejects(
      () => processor.readAndSplit(nonExistentFile),
      /File does not exist or is not readable/
    );

    // Test invalid file path
    await assert.rejects(
      () => processor.readAndSplit(""),
      /File path must be a non-empty string/
    );

    await assert.rejects(
      () => processor.readAndSplit(null),
      /File path must be a non-empty string/
    );

    await cleanup();
  });

  test("should validate file existence", async () => {
    await setup();

    const testFile = path.join(testDir, "exists.md");
    await fs.writeFile(testFile, "test content", "utf-8");

    const exists = await processor.validateInputFile(testFile);
    assert.strictEqual(exists, true);

    const notExists = await processor.validateInputFile(
      path.join(testDir, "notexists.md")
    );
    assert.strictEqual(notExists, false);

    await cleanup();
  });

  test("should get correct file extension", async () => {
    await setup();

    assert.strictEqual(processor.getFileExtension("file.md"), ".md");
    assert.strictEqual(processor.getFileExtension("file.txt"), ".txt");
    assert.strictEqual(processor.getFileExtension("file"), ".md"); // default

    await cleanup();
  });

  test("should validate sections correctly", async () => {
    await setup();

    const validSections = [
      {
        index: 0,
        content: "test",
        hasDivider: false,
        originalDividerLine: null,
      },
    ];

    // Should not throw for valid sections
    processor.validateSections(validSections);

    // Should throw for invalid sections
    assert.throws(
      () => processor.validateSections("not array"),
      /Sections must be an array/
    );
    assert.throws(
      () => processor.validateSections([null]),
      /Section 0 is not a valid object/
    );
    assert.throws(
      () => processor.validateSections([{ index: "not number" }]),
      /Section 0 content must be a string/
    );

    await cleanup();
  });
});
