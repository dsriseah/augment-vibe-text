class MultiSourceViewer {
    constructor() {
        this.files = [];
        this.init();
    }

    init() {
        this.bindEvents();
        this.loadFiles();
    }

    bindEvents() {
        // Refresh button
        document.getElementById('refreshBtn').addEventListener('click', () => {
            this.loadFiles();
        });

        // Search functionality
        document.getElementById('searchBtn').addEventListener('click', () => {
            this.searchByHash();
        });

        document.getElementById('hashSearch').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.searchByHash();
            }
        });

        // Modal events
        document.getElementById('modalClose').addEventListener('click', () => {
            this.closeModal();
        });

        document.getElementById('modal').addEventListener('click', (e) => {
            if (e.target.id === 'modal') {
                this.closeModal();
            }
        });

        document.getElementById('copyContentBtn').addEventListener('click', () => {
            this.copyContent();
        });

        document.getElementById('downloadBtn').addEventListener('click', () => {
            this.downloadFile();
        });

        // Escape key to close modal
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeModal();
            }
        });
    }

    async loadFiles() {
        try {
            this.showLoading();
            const response = await fetch('/api/files');
            const data = await response.json();

            if (data.success) {
                this.files = data.files;
                this.renderFiles();
                this.updateStats();
            } else {
                this.showError('Failed to load files: ' + data.error);
            }
        } catch (error) {
            this.showError('Network error: ' + error.message);
        }
    }

    async searchByHash() {
        const hash = document.getElementById('hashSearch').value.trim();
        if (!hash) {
            alert('Please enter a hash to search for');
            return;
        }

        try {
            const response = await fetch(`/api/hash/${hash}`);
            const data = await response.json();

            if (data.success) {
                this.showFileModal(data.file);
            } else {
                alert('File not found: ' + data.error);
            }
        } catch (error) {
            alert('Search error: ' + error.message);
        }
    }

    showLoading() {
        document.getElementById('filesContainer').innerHTML = '<div class="loading">Loading files...</div>';
    }

    showError(message) {
        document.getElementById('filesContainer').innerHTML = `<div class="error">${message}</div>`;
    }

    renderFiles() {
        const container = document.getElementById('filesContainer');
        
        if (this.files.length === 0) {
            container.innerHTML = '<div class="loading">No files found in _out directory</div>';
            return;
        }

        const html = this.files.map(file => this.renderFileCard(file)).join('');
        container.innerHTML = html;

        // Bind click events for file cards
        container.querySelectorAll('.file-card').forEach((card, index) => {
            card.addEventListener('click', () => {
                this.loadAndShowFile(this.files[index].filename);
            });
        });
    }

    renderFileCard(file) {
        const badge = file.isMainFile 
            ? '<span class="file-badge badge-main">Main</span>'
            : '<span class="file-badge badge-hash">Hash</span>';

        const hashInfo = file.hash 
            ? `<span>Hash: ${file.hash}</span>`
            : '';

        return `
            <div class="file-card" data-filename="${file.filename}">
                <div class="file-header">
                    <div class="file-title">
                        ${file.filename} ${badge}
                    </div>
                    <div class="file-meta">
                        <span>Size: ${this.formatBytes(file.size)}</span>
                        ${hashInfo}
                        <span>Modified: ${this.formatDate(file.modified)}</span>
                    </div>
                </div>
                <div class="file-content">
                    <div class="file-preview">${this.escapeHtml(file.preview)}</div>
                    <div class="file-actions">
                        <button class="btn btn-secondary btn-small" onclick="event.stopPropagation(); app.loadAndShowFile('${file.filename}')">
                            👁️ View Full
                        </button>
                        ${file.hash ? `<button class="btn btn-primary btn-small" onclick="event.stopPropagation(); app.searchForHash('${file.hash}')">🔗 Find by Hash</button>` : ''}
                    </div>
                </div>
            </div>
        `;
    }

    async loadAndShowFile(filename) {
        try {
            const response = await fetch(`/api/files/${filename}`);
            const data = await response.json();

            if (data.success) {
                this.showFileModal(data.file);
            } else {
                alert('Failed to load file: ' + data.error);
            }
        } catch (error) {
            alert('Error loading file: ' + error.message);
        }
    }

    showFileModal(file) {
        document.getElementById('modalTitle').textContent = file.filename;
        document.getElementById('fileContent').value = file.content;
        
        const fileInfo = `
            <strong>Filename:</strong> ${file.filename}<br>
            <strong>Size:</strong> ${this.formatBytes(file.size)}<br>
            <strong>Modified:</strong> ${this.formatDate(file.modified)}<br>
            ${file.hash ? `<strong>Hash:</strong> ${file.hash}<br>` : ''}
            ${file.foundBy ? `<strong>Found by:</strong> ${file.foundBy}<br>` : ''}
        `;
        document.getElementById('fileInfo').innerHTML = fileInfo;
        
        // Store current file for download
        this.currentFile = file;
        
        document.getElementById('modal').style.display = 'block';
    }

    closeModal() {
        document.getElementById('modal').style.display = 'none';
        this.currentFile = null;
    }

    copyContent() {
        const content = document.getElementById('fileContent').value;
        navigator.clipboard.writeText(content).then(() => {
            alert('Content copied to clipboard!');
        }).catch(err => {
            alert('Failed to copy content: ' + err.message);
        });
    }

    downloadFile() {
        if (!this.currentFile) return;

        const blob = new Blob([this.currentFile.content], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = this.currentFile.filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    searchForHash(hash) {
        document.getElementById('hashSearch').value = hash;
        this.searchByHash();
    }

    updateStats() {
        const totalFiles = this.files.length;
        const mainFiles = this.files.filter(f => f.isMainFile).length;
        const hashFiles = this.files.filter(f => f.isHashFile).length;

        document.getElementById('totalFiles').textContent = totalFiles;
        document.getElementById('mainFiles').textContent = mainFiles;
        document.getElementById('hashFiles').textContent = hashFiles;
    }

    formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    formatDate(dateString) {
        return new Date(dateString).toLocaleString();
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize the application
const app = new MultiSourceViewer();
