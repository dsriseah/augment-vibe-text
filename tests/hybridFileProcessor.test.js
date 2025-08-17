import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'fs/promises';
import path from 'path';
import { HybridFileProcessor } from '../src/lib/hybridFileProcessor.js';

describe('HybridFileProcessor', () => {
  let processor;
  let testDir;
  let smallFile;
  let largeFile;

  // Setup before tests
  async function setup() {
    processor = new HybridFileProcessor({
      streamingThreshold: 1024 // 1KB for testing
    });
    testDir = path.join(process.cwd(), 'tests', 'temp');
    
    try {
      await fs.mkdir(testDir, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }
  }

  // Cleanup after tests
  async function cleanup() {
    try {
      if (smallFile) await fs.unlink(smallFile);
      if (largeFile) await fs.unlink(largeFile);
    } catch (error) {
      // Files might not exist
    }
  }

  test('should create HybridFileProcessor instance', async () => {
    await setup();
    
    assert.ok(processor instanceof HybridFileProcessor);
    assert.ok(processor.memoryProcessor);
    assert.ok(processor.streamingProcessor);
    assert.strictEqual(processor.streamingThreshold, 1024);
    
    await cleanup();
  });

  test('should choose memory processor for small files', async () => {
    await setup();
    
    const smallContent = `Small section 1

---:

Small section 2`;

    smallFile = path.join(testDir, 'small-test.md');
    await fs.writeFile(smallFile, smallContent, 'utf-8');

    const shouldStream = await processor.shouldUseStreaming(smallFile);
    assert.strictEqual(shouldStream, false);

    const sections = await processor.readAndSplit(smallFile);
    assert.strictEqual(sections.length, 2);
    
    await cleanup();
  });

  test('should choose streaming processor for large files', async () => {
    await setup();
    
    // Create a file larger than threshold (1KB)
    const largeSections = [];
    for (let i = 0; i < 50; i++) {
      largeSections.push(`Large section ${i} with lots of content to make it bigger than the threshold`);
    }
    const largeContent = largeSections.join('\n\n---:\n\n');

    largeFile = path.join(testDir, 'large-test.md');
    await fs.writeFile(largeFile, largeContent, 'utf-8');

    const shouldStream = await processor.shouldUseStreaming(largeFile);
    assert.strictEqual(shouldStream, true);

    const sections = await processor.readAndSplit(largeFile);
    assert.strictEqual(sections.length, 50);
    
    await cleanup();
  });

  test('should provide processing recommendations', async () => {
    await setup();
    
    const content = `Test content`;
    smallFile = path.join(testDir, 'recommendation-test.md');
    await fs.writeFile(smallFile, content, 'utf-8');

    const recommendation = await processor.getProcessingRecommendation(smallFile);
    
    assert.ok(recommendation.filePath);
    assert.ok(recommendation.fileSize >= 0);
    assert.ok(recommendation.fileSizeFormatted);
    assert.strictEqual(recommendation.recommendedMethod, 'memory');
    assert.strictEqual(recommendation.useStreaming, false);
    assert.ok(Array.isArray(recommendation.benefits));
    
    await cleanup();
  });

  test('should analyze files with appropriate method', async () => {
    await setup();
    
    const content = `Section 1

---:

Section 2`;

    smallFile = path.join(testDir, 'analyze-test.md');
    await fs.writeFile(smallFile, content, 'utf-8');

    const analysis = await processor.analyzeFile(smallFile);
    
    assert.ok(analysis.sectionCount >= 0);
    assert.ok(analysis.totalSize >= 0);
    assert.ok(analysis.lastModified);
    
    await cleanup();
  });

  test('should get file statistics', async () => {
    await setup();
    
    const content = `Section 1

---:

Section 2

---:

Section 3`;

    smallFile = path.join(testDir, 'stats-test.md');
    await fs.writeFile(smallFile, content, 'utf-8');

    const stats = await processor.getFileStats(smallFile);
    
    assert.strictEqual(stats.sectionCount, 3);
    assert.ok(stats.totalSize > 0);
    assert.ok(stats.averageSectionSize > 0);
    assert.ok(stats.lastModified);
    assert.strictEqual(stats.useStreaming, false);
    
    await cleanup();
  });

  test('should find sections by hash', async () => {
    await setup();
    
    const content = `First section content

---:

Second section content`;

    smallFile = path.join(testDir, 'hash-test.md');
    await fs.writeFile(smallFile, content, 'utf-8');

    const analysis = await processor.analyzeFile(smallFile);
    const firstHash = analysis.sections[0].hash;
    
    const foundSection = await processor.findSectionByHash(smallFile, firstHash);
    
    assert.ok(foundSection);
    assert.strictEqual(foundSection.hash, firstHash);
    assert.ok(foundSection.content.includes('First section'));
    
    await cleanup();
  });

  test('should extract specific sections', async () => {
    await setup();
    
    const content = `Section 0

---:

Section 1

---:

Section 2`;

    smallFile = path.join(testDir, 'extract-test.md');
    await fs.writeFile(smallFile, content, 'utf-8');

    const section1 = await processor.extractSection(smallFile, 1);
    
    assert.ok(section1.includes('Section 1'));
    
    await cleanup();
  });

  test('should handle configuration updates', async () => {
    await setup();
    
    const originalConfig = processor.getConfig();
    assert.strictEqual(originalConfig.streamingThreshold, 1024);

    processor.updateConfig({
      streamingThreshold: 2048,
      chunkSize: 128 * 1024
    });

    const newConfig = processor.getConfig();
    assert.strictEqual(newConfig.streamingThreshold, 2048);
    assert.strictEqual(newConfig.chunkSize, 128 * 1024);
    
    await cleanup();
  });

  test('should format bytes correctly', async () => {
    await setup();
    
    assert.strictEqual(processor.formatBytes(0), '0 Bytes');
    assert.strictEqual(processor.formatBytes(1024), '1 KB');
    assert.strictEqual(processor.formatBytes(1024 * 1024), '1 MB');
    assert.strictEqual(processor.formatBytes(1024 * 1024 * 1024), '1 GB');
    
    await cleanup();
  });

  test('should validate input files', async () => {
    await setup();
    
    // Test non-existent file
    await assert.rejects(
      () => processor.validateInputFile('/non/existent/file.md'),
      /File not found/
    );

    // Test valid file
    const content = 'Test content';
    smallFile = path.join(testDir, 'validate-test.md');
    await fs.writeFile(smallFile, content, 'utf-8');

    const isValid = await processor.validateInputFile(smallFile);
    assert.strictEqual(isValid, true);
    
    await cleanup();
  });

  test('should maintain backward compatibility', async () => {
    await setup();
    
    const content = `Section 1

---:

Section 2`;

    const sections = processor.splitContent(content);
    assert.strictEqual(sections.length, 2);
    assert.ok(sections[0].includes('Section 1'));
    assert.ok(sections[1].includes('Section 2'));
    
    await cleanup();
  });

  test('should handle edge cases', async () => {
    await setup();
    
    // Empty file
    smallFile = path.join(testDir, 'empty-test.md');
    await fs.writeFile(smallFile, '', 'utf-8');

    const stats = await processor.getFileStats(smallFile);
    assert.strictEqual(stats.sectionCount, 1); // Empty file creates one empty section
    assert.strictEqual(stats.totalSize, 0);

    // File with only dividers
    const dividersOnly = '---:\n---:\n---:';
    smallFile = path.join(testDir, 'dividers-only-test.md');
    await fs.writeFile(smallFile, dividersOnly, 'utf-8');

    const stats2 = await processor.getFileStats(smallFile);
    assert.ok(stats2.sectionCount >= 0);
    
    await cleanup();
  });
});
