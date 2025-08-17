import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Configuration
const OUTPUT_DIR = path.join(__dirname, '..', '_out');
const PUBLIC_DIR = path.join(__dirname, 'public');

// Middleware
app.use(express.json());
app.use(express.static(PUBLIC_DIR));

/**
 * Get all files in the output directory
 */
async function getOutputFiles() {
  try {
    const files = await fs.readdir(OUTPUT_DIR);
    const fileInfos = [];

    for (const file of files) {
      if (file.endsWith('.md')) {
        const filePath = path.join(OUTPUT_DIR, file);
        const stats = await fs.stat(filePath);
        const content = await fs.readFile(filePath, 'utf-8');
        
        // Extract hash from filename (if it's a hash-based name)
        const baseName = path.basename(file, '.md');
        const isHashFile = /^[A-F0-9]{8}$/i.test(baseName);
        
        // Extract hash from content if it has a divider line
        let contentHash = null;
        const dividerMatch = content.match(/^---:\s+([A-F0-9]+)(?:\s+.*)?$/m);
        if (dividerMatch) {
          contentHash = dividerMatch[1];
        }

        fileInfos.push({
          filename: file,
          basename: baseName,
          hash: isHashFile ? baseName : contentHash,
          isHashFile,
          isMainFile: !isHashFile,
          size: stats.size,
          modified: stats.mtime,
          content: content,
          preview: content.substring(0, 200) + (content.length > 200 ? '...' : '')
        });
      }
    }

    // Sort: main file first, then hash files
    return fileInfos.sort((a, b) => {
      if (a.isMainFile && !b.isMainFile) return -1;
      if (!a.isMainFile && b.isMainFile) return 1;
      return a.filename.localeCompare(b.filename);
    });
  } catch (error) {
    console.error('Error reading output directory:', error);
    return [];
  }
}

/**
 * API Routes
 */

// Get all files
app.get('/api/files', async (req, res) => {
  try {
    const files = await getOutputFiles();
    res.json({
      success: true,
      files: files.map(f => ({
        filename: f.filename,
        basename: f.basename,
        hash: f.hash,
        isHashFile: f.isHashFile,
        isMainFile: f.isMainFile,
        size: f.size,
        modified: f.modified,
        preview: f.preview
      }))
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get file by filename
app.get('/api/files/:filename', async (req, res) => {
  try {
    const filename = req.params.filename;
    const filePath = path.join(OUTPUT_DIR, filename);
    
    // Security check - ensure file is within output directory
    const resolvedPath = path.resolve(filePath);
    const resolvedOutputDir = path.resolve(OUTPUT_DIR);
    if (!resolvedPath.startsWith(resolvedOutputDir)) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    const content = await fs.readFile(filePath, 'utf-8');
    const stats = await fs.stat(filePath);

    res.json({
      success: true,
      file: {
        filename,
        content,
        size: stats.size,
        modified: stats.mtime
      }
    });
  } catch (error) {
    if (error.code === 'ENOENT') {
      res.status(404).json({
        success: false,
        error: 'File not found'
      });
    } else {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
});

// Get file by hash
app.get('/api/hash/:hash', async (req, res) => {
  try {
    const hash = req.params.hash.toUpperCase();
    
    // First try to find a file with the hash as filename
    const hashFilename = `${hash}.md`;
    const hashFilePath = path.join(OUTPUT_DIR, hashFilename);
    
    try {
      const content = await fs.readFile(hashFilePath, 'utf-8');
      const stats = await fs.stat(hashFilePath);
      
      return res.json({
        success: true,
        file: {
          filename: hashFilename,
          hash,
          content,
          size: stats.size,
          modified: stats.mtime,
          foundBy: 'filename'
        }
      });
    } catch (error) {
      // File not found by hash filename, search in content
    }

    // Search for hash in file content
    const files = await getOutputFiles();
    const fileWithHash = files.find(f => f.hash === hash);
    
    if (fileWithHash) {
      res.json({
        success: true,
        file: {
          filename: fileWithHash.filename,
          hash,
          content: fileWithHash.content,
          size: fileWithHash.size,
          modified: fileWithHash.modified,
          foundBy: 'content'
        }
      });
    } else {
      res.status(404).json({
        success: false,
        error: `No file found with hash: ${hash}`
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Multi-Source Document Server is running',
    outputDir: OUTPUT_DIR,
    timestamp: new Date().toISOString()
  });
});

// Serve the main page
app.get('/', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Multi-Source Document Server running on http://localhost:${PORT}`);
  console.log(`📁 Serving files from: ${OUTPUT_DIR}`);
  console.log(`🌐 Web interface: http://localhost:${PORT}`);
  console.log(`📡 API endpoints:`);
  console.log(`   GET /api/files - List all files`);
  console.log(`   GET /api/files/:filename - Get file by name`);
  console.log(`   GET /api/hash/:hash - Get file by hash`);
  console.log(`   GET /api/health - Health check`);
});

export default app;
