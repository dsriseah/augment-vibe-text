import { test, describe } from "node:test";
import assert from "node:assert";
import fs from "fs/promises";
import path from "path";
import { DocumentReconstructor } from "../src/lib/documentReconstructor.js";

describe("DocumentReconstructor", () => {
  let reconstructor;
  let testDir;

  // Setup before tests
  async function setup() {
    reconstructor = new DocumentReconstructor();
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

  test("should create DocumentReconstructor instance", async () => {
    await setup();
    assert.ok(reconstructor instanceof DocumentReconstructor);
    assert.strictEqual(reconstructor.inputDir, "_out");
    assert.strictEqual(reconstructor.fileExtension, ".md");
    await cleanup();
  });

  test("should extract references from content", async () => {
    await setup();

    const content = `Main content here
Some text

---: ABCD1234
---: EFAB5678

More content after references`;

    const result = reconstructor.extractReferences(content);

    assert.strictEqual(result.references.length, 2);
    assert.strictEqual(result.references[0].hash, "ABCD1234");
    assert.strictEqual(result.references[1].hash, "EFAB5678");
    assert.strictEqual(result.baseContent, "Main content here\nSome text");

    await cleanup();
  });

  test("should extract references with timestamps", async () => {
    await setup();

    const content = `Main content

---: ABCD1234 16:12:30 2025/08/16
---: EFAB5678 16:12:31 2025/08/16`;

    const result = reconstructor.extractReferences(content);

    assert.strictEqual(result.references.length, 2);
    assert.strictEqual(result.references[0].hash, "ABCD1234");
    assert.strictEqual(result.references[1].hash, "EFAB5678");

    await cleanup();
  });

  test("should handle content without references", async () => {
    await setup();

    const content = `Just regular content
No references here
Multiple lines`;

    const result = reconstructor.extractReferences(content);

    assert.strictEqual(result.references.length, 0);
    assert.strictEqual(result.baseContent, content);

    await cleanup();
  });

  test("should clean referenced content", async () => {
    await setup();

    const contentWithEnhancedDivider = `---: ABCD1234 16:12:30 2025/08/16

Section content here
More content`;

    const cleaned = reconstructor.cleanReferencedContent(
      contentWithEnhancedDivider
    );

    assert.ok(cleaned.startsWith("---:\n"));
    assert.ok(cleaned.includes("Section content here"));

    await cleanup();
  });

  test("should not modify content without enhanced divider", async () => {
    await setup();

    const normalContent = `Regular content
No divider here`;

    const cleaned = reconstructor.cleanReferencedContent(normalContent);

    assert.strictEqual(cleaned, normalContent);

    await cleanup();
  });

  test("should validate references correctly", async () => {
    await setup();

    // Create test files
    const file1 = path.join(testDir, "ABCD1234.md");
    const file2 = path.join(testDir, "EFAB5678.md");

    await fs.writeFile(file1, "Test content 1", "utf-8");
    // Don't create file2 to test missing file

    const references = [
      { hash: "ABCD1234", originalLine: "---: ABCD1234", lineNumber: 1 },
      { hash: "EFAB5678", originalLine: "---: EFAB5678", lineNumber: 2 },
    ];

    const validation = await reconstructor.validateReferences(
      references,
      testDir
    );

    assert.strictEqual(validation.found.length, 1);
    assert.strictEqual(validation.missing.length, 1);
    assert.strictEqual(validation.found[0].hash, "ABCD1234");
    assert.strictEqual(validation.missing[0].hash, "EFAB5678");

    await cleanup();
  });

  test("should reconstruct document from references", async () => {
    await setup();

    try {
      // Create main file with references
      const mainFile = path.join(testDir, "main.md");
      const mainContent = `Main document content
Introduction section

---: ABCD1234
---: EFAB5678`;

      await fs.writeFile(mainFile, mainContent, "utf-8");

      // Create referenced files
      const ref1File = path.join(testDir, "ABCD1234.md");
      const ref1Content = `---: ABCD1234 16:12:30 2025/08/16

Section 1 content
More content here`;

      const ref2File = path.join(testDir, "EFAB5678.md");
      const ref2Content = `---: EFAB5678 16:12:31 2025/08/16

Section 2 content
Final content`;

      await fs.writeFile(ref1File, ref1Content, "utf-8");
      await fs.writeFile(ref2File, ref2Content, "utf-8");

      // Set up reconstructor to use test directory
      const testReconstructor = new DocumentReconstructor({
        inputDir: testDir,
      });

      const reconstructed = await testReconstructor.reconstructDocument(
        mainFile
      );

      // Check that all content is present
      assert.ok(reconstructed.includes("Main document content"));
      assert.ok(reconstructed.includes("Section 1 content"));
      assert.ok(reconstructed.includes("Section 2 content"));

      // Check that dividers are restored to simple format
      const dividerMatches = reconstructed.match(/^---:$/gm);
      assert.strictEqual(dividerMatches.length, 2);
    } finally {
      await cleanup();
    }
  });

  test("should analyze file correctly", async () => {
    await setup();

    try {
      const testFile = path.join(testDir, "test.md");
      const content = `Test content

---: ABCD1234
---: EFAB5678`;

      await fs.writeFile(testFile, content, "utf-8");

      // Create one referenced file
      const refFile = path.join(testDir, "ABCD1234.md");
      await fs.writeFile(refFile, "Referenced content", "utf-8");

      const testReconstructor = new DocumentReconstructor({
        inputDir: testDir,
      });
      const analysis = await testReconstructor.analyzeFile(testFile);

      assert.strictEqual(analysis.totalReferences, 2);
      assert.strictEqual(analysis.foundReferences, 1);
      assert.strictEqual(analysis.missingReferences, 1);
      assert.ok(analysis.filePath.endsWith("test.md"));
      assert.ok(analysis.fileSize > 0);
    } finally {
      await cleanup();
    }
  });

  test("should handle missing main file", async () => {
    await setup();

    const nonExistentFile = path.join(testDir, "nonexistent.md");

    await assert.rejects(
      () => reconstructor.reconstructDocument(nonExistentFile),
      /Main file not found/
    );

    await cleanup();
  });

  test("should handle invalid input parameters", async () => {
    await setup();

    await assert.rejects(
      () => reconstructor.reconstructDocument(null),
      /Main file path must be a non-empty string/
    );

    await assert.rejects(
      () => reconstructor.reconstructDocument(""),
      /Main file path must be a non-empty string/
    );

    await cleanup();
  });

  test("should handle case insensitive hash matching", async () => {
    await setup();

    const content = `Main content

---: abcd1234
---: efab5678`;

    const result = reconstructor.extractReferences(content);

    assert.strictEqual(result.references.length, 2);
    assert.strictEqual(result.references[0].hash, "ABCD1234"); // Should be uppercase
    assert.strictEqual(result.references[1].hash, "EFAB5678");

    await cleanup();
  });
});
