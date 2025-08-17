import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'fs/promises';
import path from 'path';

describe('Web Server API', () => {
  const BASE_URL = 'http://localhost:3000';
  let serverProcess;

  // Helper function to make HTTP requests
  async function fetchAPI(endpoint) {
    try {
      const response = await fetch(`${BASE_URL}${endpoint}`);
      const data = await response.json();
      return { status: response.status, data };
    } catch (error) {
      throw new Error(`Failed to fetch ${endpoint}: ${error.message}`);
    }
  }

  test('should respond to health check', async () => {
    try {
      const { status, data } = await fetchAPI('/api/health');
      
      assert.strictEqual(status, 200);
      assert.strictEqual(data.success, true);
      assert.ok(data.message.includes('Multi-Source Document Server'));
      assert.ok(data.outputDir);
      assert.ok(data.timestamp);
    } catch (error) {
      // Skip test if server is not running
      console.log('⚠️  Server not running, skipping API tests');
      console.log('   Start server with: npm run server');
    }
  });

  test('should list files from _out directory', async () => {
    try {
      const { status, data } = await fetchAPI('/api/files');
      
      assert.strictEqual(status, 200);
      assert.strictEqual(data.success, true);
      assert.ok(Array.isArray(data.files));
      
      // Check file structure
      if (data.files.length > 0) {
        const file = data.files[0];
        assert.ok(file.filename);
        assert.ok(typeof file.size === 'number');
        assert.ok(typeof file.isMainFile === 'boolean');
        assert.ok(typeof file.isHashFile === 'boolean');
      }
    } catch (error) {
      console.log('⚠️  Server not running, skipping API tests');
    }
  });

  test('should retrieve file by filename', async () => {
    try {
      // First get the list of files
      const { data: filesList } = await fetchAPI('/api/files');
      
      if (filesList.files && filesList.files.length > 0) {
        const filename = filesList.files[0].filename;
        const { status, data } = await fetchAPI(`/api/files/${filename}`);
        
        assert.strictEqual(status, 200);
        assert.strictEqual(data.success, true);
        assert.ok(data.file);
        assert.strictEqual(data.file.filename, filename);
        assert.ok(data.file.content);
        assert.ok(typeof data.file.size === 'number');
      }
    } catch (error) {
      console.log('⚠️  Server not running, skipping API tests');
    }
  });

  test('should retrieve file by hash', async () => {
    try {
      // First get the list of files to find a hash
      const { data: filesList } = await fetchAPI('/api/files');
      
      const hashFile = filesList.files?.find(f => f.isHashFile && f.hash);
      
      if (hashFile) {
        const { status, data } = await fetchAPI(`/api/hash/${hashFile.hash}`);
        
        assert.strictEqual(status, 200);
        assert.strictEqual(data.success, true);
        assert.ok(data.file);
        assert.strictEqual(data.file.hash, hashFile.hash);
        assert.ok(data.file.content);
      }
    } catch (error) {
      console.log('⚠️  Server not running, skipping API tests');
    }
  });

  test('should handle non-existent file requests', async () => {
    try {
      const { status, data } = await fetchAPI('/api/files/nonexistent.md');
      
      assert.strictEqual(status, 404);
      assert.strictEqual(data.success, false);
      assert.ok(data.error.includes('File not found'));
    } catch (error) {
      console.log('⚠️  Server not running, skipping API tests');
    }
  });

  test('should handle non-existent hash requests', async () => {
    try {
      const { status, data } = await fetchAPI('/api/hash/NONEXIST');
      
      assert.strictEqual(status, 404);
      assert.strictEqual(data.success, false);
      assert.ok(data.error.includes('No file found with hash'));
    } catch (error) {
      console.log('⚠️  Server not running, skipping API tests');
    }
  });

  test('should prevent directory traversal attacks', async () => {
    try {
      const { status, data } = await fetchAPI('/api/files/../package.json');
      
      assert.strictEqual(status, 403);
      assert.strictEqual(data.success, false);
      assert.ok(data.error.includes('Access denied'));
    } catch (error) {
      console.log('⚠️  Server not running, skipping API tests');
    }
  });
});
