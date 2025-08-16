import { test, describe } from "node:test";
import assert from "node:assert";
import { HashGenerator } from "../src/lib/hashGenerator.js";

describe("HashGenerator", () => {
  let hashGen;

  test("should create HashGenerator instance with defaults", () => {
    hashGen = new HashGenerator();
    assert.ok(hashGen instanceof HashGenerator);
    assert.strictEqual(hashGen.algorithm, "sha256");
    assert.strictEqual(hashGen.length, 8);
    assert.strictEqual(hashGen.encoding, "hex");
  });

  test("should create HashGenerator with custom options", () => {
    hashGen = new HashGenerator({
      algorithm: "sha1",
      length: 10,
      encoding: "hex",
    });
    assert.strictEqual(hashGen.algorithm, "sha1");
    assert.strictEqual(hashGen.length, 10);
  });

  test("should generate consistent hashes", () => {
    hashGen = new HashGenerator();

    const content = "test content";
    const hash1 = hashGen.generateHash(content);
    const hash2 = hashGen.generateHash(content);

    assert.strictEqual(hash1, hash2);
    assert.strictEqual(hash1.length, 8);
    assert.match(hash1, /^[0-9A-F]{8}$/);
  });

  test("should generate different hashes for different content", () => {
    hashGen = new HashGenerator();

    const hash1 = hashGen.generateHash("content 1");
    const hash2 = hashGen.generateHash("content 2");

    assert.notStrictEqual(hash1, hash2);
  });

  test("should normalize content consistently", () => {
    hashGen = new HashGenerator();

    const content1 = "test\ncontent\n";
    const content2 = "test\r\ncontent\r\n";
    const content3 = "  test\ncontent  \n\n";

    const normalized1 = hashGen.normalizeContent(content1);
    const normalized2 = hashGen.normalizeContent(content2);
    const normalized3 = hashGen.normalizeContent(content3);

    assert.strictEqual(normalized1, normalized2);
    assert.strictEqual(normalized1, "test\ncontent");
    assert.strictEqual(normalized3, "test\ncontent");
  });

  test("should generate section hash correctly", () => {
    hashGen = new HashGenerator();

    const section = {
      content: "test content",
      hasDivider: false,
      originalDividerLine: null,
    };

    const hash = hashGen.generateSectionHash(section);
    assert.strictEqual(hash.length, 8);
    assert.match(hash, /^[0-9A-F]{8}$/);
  });

  test("should generate section hash excluding divider", () => {
    hashGen = new HashGenerator();

    const sectionWithDivider = {
      content: "---:\ntest content\nmore content",
      hasDivider: true,
      originalDividerLine: "---:",
    };

    const sectionWithoutDivider = {
      content: "test content\nmore content",
      hasDivider: false,
      originalDividerLine: null,
    };

    const hash1 = hashGen.generateSectionHash(sectionWithDivider);
    const hash2 = hashGen.generateSectionHash(sectionWithoutDivider);

    // Hashes should be the same since divider is excluded
    assert.strictEqual(hash1, hash2);
  });

  test("should validate hash format", () => {
    hashGen = new HashGenerator();

    assert.strictEqual(hashGen.isValidHash("ABCD1234"), true);
    assert.strictEqual(hashGen.isValidHash("abcd1234"), true); // case insensitive
    assert.strictEqual(hashGen.isValidHash("ABCD123"), false); // wrong length
    assert.strictEqual(hashGen.isValidHash("ABCDXYZ1"), false); // invalid characters
    assert.strictEqual(hashGen.isValidHash(null), false);
    assert.strictEqual(hashGen.isValidHash(""), false);
  });

  test("should handle invalid input", () => {
    hashGen = new HashGenerator();

    assert.throws(() => hashGen.generateHash(null), /Content must be a string/);
    assert.throws(() => hashGen.generateHash(123), /Content must be a string/);
    assert.throws(() => hashGen.generateHash({}), /Content must be a string/);
  });

  test("should handle invalid section input", () => {
    hashGen = new HashGenerator();

    assert.throws(
      () => hashGen.generateSectionHash(null),
      /Section must have content property/
    );
    assert.throws(
      () => hashGen.generateSectionHash({}),
      /Section must have content property/
    );
    assert.throws(
      () => hashGen.generateSectionHash({ content: null }),
      /Section must have content property/
    );
  });

  test("should generate multiple hashes", () => {
    hashGen = new HashGenerator();

    const content = "test content";
    const hashes = hashGen.generateMultipleHashes(content);

    assert.ok(hashes.sha256);
    assert.ok(hashes.sha1);
    assert.ok(hashes.md5);

    assert.strictEqual(hashes.sha256.length, 8);
    assert.match(hashes.sha256, /^[0-9A-F]{8}$/);
  });

  test("should handle different hash lengths", () => {
    const shortHashGen = new HashGenerator({ length: 4 });
    const longHashGen = new HashGenerator({ length: 16 });

    const content = "test content";
    const shortHash = shortHashGen.generateHash(content);
    const longHash = longHashGen.generateHash(content);

    assert.strictEqual(shortHash.length, 4);
    assert.strictEqual(longHash.length, 16);

    // Short hash should be prefix of long hash (same algorithm)
    assert.strictEqual(longHash.startsWith(shortHash), true);
  });
});
