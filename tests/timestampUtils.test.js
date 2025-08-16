import { test, describe } from "node:test";
import assert from "node:assert";
import { TimestampUtils } from "../src/lib/timestampUtils.js";

describe("TimestampUtils", () => {
  let timestampUtils;

  test("should create TimestampUtils instance", () => {
    timestampUtils = new TimestampUtils();
    assert.ok(timestampUtils instanceof TimestampUtils);
    assert.strictEqual(timestampUtils.timezone, "local");
    assert.strictEqual(timestampUtils.format, "HH:MM:SS YYYY/MM/DD");
  });

  test("should generate timestamp in correct format", () => {
    timestampUtils = new TimestampUtils();

    const testDate = new Date("2025-08-16T16:12:30.000Z");
    const timestamp = timestampUtils.formatTimestamp(testDate, true); // UTC

    assert.strictEqual(timestamp, "16:12:30 2025/08/16");
  });

  test("should generate current timestamp", () => {
    timestampUtils = new TimestampUtils();

    const timestamp = timestampUtils.generateTimestamp();

    // Should match the expected format
    assert.match(timestamp, /^\d{2}:\d{2}:\d{2} \d{4}\/\d{2}\/\d{2}$/);
  });

  test("should parse timestamp correctly", () => {
    timestampUtils = new TimestampUtils();

    const timestampStr = "16:12:30 2025/08/16";
    const parsed = timestampUtils.parseTimestamp(timestampStr);

    assert.ok(parsed instanceof Date);
    assert.strictEqual(parsed.getFullYear(), 2025);
    assert.strictEqual(parsed.getMonth(), 7); // 0-indexed
    assert.strictEqual(parsed.getDate(), 16);
    assert.strictEqual(parsed.getHours(), 16);
    assert.strictEqual(parsed.getMinutes(), 12);
    assert.strictEqual(parsed.getSeconds(), 30);
  });

  test("should validate timestamp format", () => {
    timestampUtils = new TimestampUtils();

    assert.strictEqual(
      timestampUtils.isValidTimestamp("16:12:30 2025/08/16"),
      true
    );
    assert.strictEqual(
      timestampUtils.isValidTimestamp("00:00:00 2025/01/01"),
      true
    );
    assert.strictEqual(
      timestampUtils.isValidTimestamp("23:59:59 2025/12/31"),
      true
    );

    // Invalid formats
    assert.strictEqual(
      timestampUtils.isValidTimestamp("16:12 2025/08/16"),
      false
    );
    assert.strictEqual(
      timestampUtils.isValidTimestamp("16:12:30 25/08/16"),
      false
    );
    assert.strictEqual(timestampUtils.isValidTimestamp("invalid"), false);
    assert.strictEqual(timestampUtils.isValidTimestamp(""), false);
    assert.strictEqual(timestampUtils.isValidTimestamp(null), false);
  });

  test("should handle invalid timestamp parsing", () => {
    timestampUtils = new TimestampUtils();

    assert.strictEqual(timestampUtils.parseTimestamp("invalid"), null);
    assert.strictEqual(timestampUtils.parseTimestamp("16:12 2025/08/16"), null);
    // Note: Date constructor is very forgiving, so we just test clearly invalid formats
  });

  test("should create divider line correctly", () => {
    timestampUtils = new TimestampUtils();

    const hash = "ABCD1234";
    const testDate = new Date("2025-08-16T16:12:30.000Z");
    const dividerLine = timestampUtils.createDividerLine(hash, testDate);

    // Should include hash and timestamp
    assert.match(
      dividerLine,
      /^---: ABCD1234 \d{2}:\d{2}:\d{2} \d{4}\/\d{2}\/\d{2}$/
    );
  });

  test("should parse divider line correctly", () => {
    timestampUtils = new TimestampUtils();

    const dividerLine = "---: ABCD1234 16:12:30 2025/08/16";
    const parsed = timestampUtils.parseDividerLine(dividerLine);

    assert.ok(parsed);
    assert.strictEqual(parsed.hash, "ABCD1234");
    assert.strictEqual(parsed.timestampStr, "16:12:30 2025/08/16");
    assert.ok(parsed.timestamp instanceof Date);
  });

  test("should handle invalid divider line parsing", () => {
    timestampUtils = new TimestampUtils();

    assert.strictEqual(timestampUtils.parseDividerLine("invalid"), null);
    assert.strictEqual(timestampUtils.parseDividerLine("---: HASH"), null);
    assert.strictEqual(
      timestampUtils.parseDividerLine("---: HASH invalid-time"),
      null
    );
    assert.strictEqual(timestampUtils.parseDividerLine(""), null);
  });

  test("should format timestamp with padding", () => {
    timestampUtils = new TimestampUtils();

    // Test single digit values get padded
    const testDate = new Date("2025-01-01T01:01:01.000Z");
    const timestamp = timestampUtils.formatTimestamp(testDate, true);

    assert.strictEqual(timestamp, "01:01:01 2025/01/01");
  });

  test("should handle timezone conversion", () => {
    timestampUtils = new TimestampUtils();

    const testDate = new Date("2025-08-16T16:12:30.000Z");

    // Test with a specific timezone (this might vary based on system)
    const timestamp = timestampUtils.generateTimestampForTimezone(
      "UTC",
      testDate
    );
    assert.match(timestamp, /^\d{2}:\d{2}:\d{2} \d{4}\/\d{2}\/\d{2}$/);
  });

  test("should handle invalid timezone gracefully", () => {
    timestampUtils = new TimestampUtils();

    const testDate = new Date("2025-08-16T16:12:30.000Z");

    // Should fallback to local time for invalid timezone
    const timestamp = timestampUtils.generateTimestampForTimezone(
      "Invalid/Timezone",
      testDate
    );
    assert.match(timestamp, /^\d{2}:\d{2}:\d{2} \d{4}\/\d{2}\/\d{2}$/);
  });

  test("should handle UTC vs local time", () => {
    timestampUtils = new TimestampUtils();

    const testDate = new Date("2025-08-16T16:12:30.000Z");

    const utcTimestamp = timestampUtils.formatTimestamp(testDate, true);
    const localTimestamp = timestampUtils.formatTimestamp(testDate, false);

    // Both should be valid format
    assert.match(utcTimestamp, /^\d{2}:\d{2}:\d{2} \d{4}\/\d{2}\/\d{2}$/);
    assert.match(localTimestamp, /^\d{2}:\d{2}:\d{2} \d{4}\/\d{2}\/\d{2}$/);

    // UTC should be exactly what we expect
    assert.strictEqual(utcTimestamp, "16:12:30 2025/08/16");
  });
});
