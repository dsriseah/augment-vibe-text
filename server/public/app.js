class DocumentCanvas {
  constructor() {
    this.files = [];
    this.nodes = new Map();
    this.connections = [];
    this.selectedNode = null;
    this.isDragging = false;
    this.isPanning = false;
    this.isConnecting = false;
    this.connectionStart = null;
    this.canvasOffset = { x: 0, y: 0 };
    this.scale = 1;
    this.nodeIdCounter = 0;

    this.init();
  }

  init() {
    this.canvas = document.getElementById("canvas");
    this.connectionsLayer = document.getElementById("connectionsLayer");
    this.loadingOverlay = document.getElementById("loadingOverlay");

    this.bindEvents();
    this.loadFiles();
    this.setupCanvas();
  }

  bindEvents() {
    // Toolbar buttons
    document.getElementById("refreshBtn").addEventListener("click", () => {
      this.loadFiles();
    });

    document.getElementById("autoLayoutBtn").addEventListener("click", () => {
      this.autoLayout();
    });

    document.getElementById("addNodeBtn").addEventListener("click", () => {
      this.createNewNode();
    });

    document.getElementById("saveLayoutBtn").addEventListener("click", () => {
      this.saveLayout();
    });

    // Search functionality
    document.getElementById("searchBtn").addEventListener("click", () => {
      this.searchByHash();
    });

    document.getElementById("hashSearch").addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        this.searchByHash();
      }
    });

    // Canvas events
    this.setupCanvasEvents();

    // Keyboard shortcuts
    document.addEventListener("keydown", (e) => {
      this.handleKeyboard(e);
    });
  }

  async loadFiles() {
    try {
      this.showLoading();
      const response = await fetch("/api/files");
      const data = await response.json();

      if (data.success) {
        this.files = data.files;
        this.createNodesFromFiles();
        this.hideLoading();
      } else {
        this.showError("Failed to load files: " + data.error);
      }
    } catch (error) {
      this.showError("Network error: " + error.message);
    }
  }

  setupCanvas() {
    // Load saved layout if exists
    this.loadLayout();

    // Update connections layer size
    this.updateConnectionsLayer();
  }

  setupCanvasEvents() {
    let startX, startY, startCanvasX, startCanvasY;

    this.canvas.addEventListener("mousedown", (e) => {
      if (e.target === this.canvas) {
        this.isPanning = true;
        this.canvas.classList.add("panning");
        startX = e.clientX;
        startY = e.clientY;
        startCanvasX = this.canvasOffset.x;
        startCanvasY = this.canvasOffset.y;
      }
    });

    document.addEventListener("mousemove", (e) => {
      if (this.isPanning) {
        const deltaX = e.clientX - startX;
        const deltaY = e.clientY - startY;
        this.canvasOffset.x = startCanvasX + deltaX;
        this.canvasOffset.y = startCanvasY + deltaY;
        this.updateCanvasTransform();
      }
    });

    document.addEventListener("mouseup", () => {
      if (this.isPanning) {
        this.isPanning = false;
        this.canvas.classList.remove("panning");
      }
    });

    // Zoom with mouse wheel
    this.canvas.addEventListener("wheel", (e) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      this.scale = Math.max(0.1, Math.min(3, this.scale * delta));
      this.updateCanvasTransform();
    });
  }

  async searchByHash() {
    const hash = document.getElementById("hashSearch").value.trim();
    if (!hash) {
      alert("Please enter a hash to search for");
      return;
    }

    // Find and highlight node with this hash
    const node = Array.from(this.nodes.values()).find(
      (n) => n.data.hash === hash.toUpperCase()
    );
    if (node) {
      this.selectNode(node);
      this.centerOnNode(node);
    } else {
      // Try to load from API
      try {
        const response = await fetch(`/api/hash/${hash}`);
        const data = await response.json();

        if (data.success) {
          const newNode = this.createNodeFromFile(data.file);
          this.selectNode(newNode);
          this.centerOnNode(newNode);
        } else {
          alert("File not found: " + data.error);
        }
      } catch (error) {
        alert("Search error: " + error.message);
      }
    }
  }

  createNodesFromFiles() {
    // Clear existing nodes
    this.nodes.clear();
    this.canvas.querySelectorAll(".text-node").forEach((node) => node.remove());

    // Create nodes from files
    this.files.forEach((file, index) => {
      const node = this.createNodeFromFile(file, {
        x: 100 + (index % 3) * 400,
        y: 100 + Math.floor(index / 3) * 300,
      });
    });

    this.updateConnectionsLayer();
  }

  createNodeFromFile(file, position = null) {
    const nodeId = `node-${this.nodeIdCounter++}`;
    const template = document.getElementById("nodeTemplate");
    const nodeElement = template.content.cloneNode(true);
    const node = nodeElement.querySelector(".text-node");

    node.dataset.nodeId = nodeId;
    node.style.left = (position?.x || Math.random() * 500 + 100) + "px";
    node.style.top = (position?.y || Math.random() * 300 + 100) + "px";

    // Populate node content
    const filename = node.querySelector(".node-filename");
    const badge = node.querySelector(".node-badge");
    const text = node.querySelector(".node-text");
    const hash = node.querySelector(".node-hash");
    const size = node.querySelector(".node-size");

    filename.textContent = file.filename;
    badge.textContent = file.isMainFile ? "MAIN" : "HASH";
    badge.className = `node-badge ${file.isMainFile ? "main" : "hash"}`;
    text.value = file.content || "";
    hash.textContent = file.hash || "";
    size.textContent = this.formatBytes(file.size);

    // Setup node events
    this.setupNodeEvents(node);

    // Add to canvas
    this.canvas.appendChild(node);

    // Store node data
    const nodeData = {
      id: nodeId,
      element: node,
      data: file,
      position: {
        x: parseInt(node.style.left),
        y: parseInt(node.style.top),
      },
    };
    this.nodes.set(nodeId, nodeData);

    return nodeData;
  }

  showLoading() {
    this.loadingOverlay.classList.remove("hidden");
  }

  hideLoading() {
    this.loadingOverlay.classList.add("hidden");
  }

  showError(message) {
    this.hideLoading();
    alert(message); // Simple error handling for now
  }

  setupNodeEvents(node) {
    const header = node.querySelector(".node-header");
    const editBtn = node.querySelector(".edit-btn");
    const linkBtn = node.querySelector(".link-btn");
    const closeBtn = node.querySelector(".close-btn");
    const textarea = node.querySelector(".node-text");

    let isDragging = false;
    let startX, startY, startLeft, startTop;

    // Dragging
    header.addEventListener("mousedown", (e) => {
      isDragging = true;
      this.selectNode(this.nodes.get(node.dataset.nodeId));
      node.classList.add("dragging");

      startX = e.clientX;
      startY = e.clientY;
      startLeft = parseInt(node.style.left);
      startTop = parseInt(node.style.top);

      e.preventDefault();
    });

    document.addEventListener("mousemove", (e) => {
      if (isDragging) {
        const deltaX = e.clientX - startX;
        const deltaY = e.clientY - startY;
        node.style.left = startLeft + deltaX + "px";
        node.style.top = startTop + deltaY + "px";

        // Update stored position
        const nodeData = this.nodes.get(node.dataset.nodeId);
        if (nodeData) {
          nodeData.position.x = parseInt(node.style.left);
          nodeData.position.y = parseInt(node.style.top);
        }

        this.updateConnections();
      }
    });

    document.addEventListener("mouseup", () => {
      if (isDragging) {
        isDragging = false;
        node.classList.remove("dragging");
      }
    });

    // Edit button
    editBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      textarea.readOnly = !textarea.readOnly;
      if (!textarea.readOnly) {
        textarea.focus();
        editBtn.textContent = "💾";
      } else {
        editBtn.textContent = "✏️";
        this.saveNodeContent(node.dataset.nodeId, textarea.value);
      }
    });

    // Link button
    linkBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.startConnection(node.dataset.nodeId);
    });

    // Close button
    closeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.removeNode(node.dataset.nodeId);
    });

    // Node selection
    node.addEventListener("click", (e) => {
      if (e.target === textarea) return;
      this.selectNode(this.nodes.get(node.dataset.nodeId));
    });
  }

  selectNode(nodeData) {
    // Clear previous selection
    this.canvas.querySelectorAll(".text-node.selected").forEach((node) => {
      node.classList.remove("selected");
    });

    if (nodeData) {
      nodeData.element.classList.add("selected");
      this.selectedNode = nodeData;
    } else {
      this.selectedNode = null;
    }
  }

  centerOnNode(nodeData) {
    const rect = this.canvas.getBoundingClientRect();
    const nodeRect = nodeData.element.getBoundingClientRect();

    this.canvasOffset.x = rect.width / 2 - nodeRect.left - nodeRect.width / 2;
    this.canvasOffset.y = rect.height / 2 - nodeRect.top - nodeRect.height / 2;

    this.updateCanvasTransform();
  }

  removeNode(nodeId) {
    const nodeData = this.nodes.get(nodeId);
    if (nodeData) {
      nodeData.element.remove();
      this.nodes.delete(nodeId);

      // Remove connections involving this node
      this.connections = this.connections.filter(
        (conn) => conn.from !== nodeId && conn.to !== nodeId
      );
      this.updateConnections();
    }
  }

  startConnection(nodeId) {
    this.isConnecting = true;
    this.connectionStart = nodeId;
    // Visual feedback could be added here
  }

  createConnection(fromNodeId, toNodeId) {
    if (fromNodeId === toNodeId) return; // No self-connections

    // Check if connection already exists
    const exists = this.connections.some(
      (conn) =>
        (conn.from === fromNodeId && conn.to === toNodeId) ||
        (conn.from === toNodeId && conn.to === fromNodeId)
    );

    if (!exists) {
      this.connections.push({ from: fromNodeId, to: toNodeId });
      this.updateConnections();
    }
  }

  updateConnections() {
    // Clear existing connections
    this.connectionsLayer.innerHTML =
      '<defs><marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0, 10 3.5, 0 7" fill="#666" /></marker></defs>';

    // Draw connections
    this.connections.forEach((conn) => {
      const fromNode = this.nodes.get(conn.from);
      const toNode = this.nodes.get(conn.to);

      if (fromNode && toNode) {
        const fromRect = fromNode.element.getBoundingClientRect();
        const toRect = toNode.element.getBoundingClientRect();
        const canvasRect = this.canvas.getBoundingClientRect();

        const x1 = fromRect.left + fromRect.width / 2 - canvasRect.left;
        const y1 = fromRect.top + fromRect.height / 2 - canvasRect.top;
        const x2 = toRect.left + toRect.width / 2 - canvasRect.left;
        const y2 = toRect.top + toRect.height / 2 - canvasRect.top;

        const path = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "path"
        );
        const d = `M ${x1} ${y1} Q ${(x1 + x2) / 2} ${y1 - 50} ${x2} ${y2}`;
        path.setAttribute("d", d);
        path.setAttribute("class", "connection-line");

        this.connectionsLayer.appendChild(path);
      }
    });
  }

  updateConnectionsLayer() {
    const rect = this.canvas.getBoundingClientRect();
    this.connectionsLayer.setAttribute("width", rect.width);
    this.connectionsLayer.setAttribute("height", rect.height);
  }

  updateCanvasTransform() {
    // Apply transform to all nodes
    this.nodes.forEach((nodeData) => {
      const element = nodeData.element;
      element.style.transform = `translate(${this.canvasOffset.x}px, ${this.canvasOffset.y}px) scale(${this.scale})`;
    });

    this.updateConnections();
  }

  autoLayout() {
    const nodes = Array.from(this.nodes.values());
    const cols = Math.ceil(Math.sqrt(nodes.length));

    nodes.forEach((nodeData, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);

      nodeData.position.x = 100 + col * 400;
      nodeData.position.y = 100 + row * 300;

      nodeData.element.style.left = nodeData.position.x + "px";
      nodeData.element.style.top = nodeData.position.y + "px";
    });

    this.updateConnections();
  }

  createNewNode() {
    const newFile = {
      filename: `new-node-${Date.now()}.md`,
      content: "# New Node\n\nEnter your content here...",
      size: 0,
      isMainFile: false,
      isHashFile: false,
      hash: null,
    };

    const node = this.createNodeFromFile(newFile, {
      x: 200 + Math.random() * 300,
      y: 200 + Math.random() * 200,
    });

    // Enable editing immediately
    const textarea = node.element.querySelector(".node-text");
    const editBtn = node.element.querySelector(".edit-btn");
    textarea.readOnly = false;
    textarea.focus();
    editBtn.textContent = "💾";
  }

  saveNodeContent(nodeId, content) {
    const nodeData = this.nodes.get(nodeId);
    if (nodeData) {
      nodeData.data.content = content;
      nodeData.data.size = content.length;

      // Update size display
      const sizeElement = nodeData.element.querySelector(".node-size");
      sizeElement.textContent = this.formatBytes(content.length);
    }
  }

  saveLayout() {
    const layout = {
      nodes: Array.from(this.nodes.entries()).map(([id, nodeData]) => ({
        id,
        filename: nodeData.data.filename,
        position: nodeData.position,
        content: nodeData.data.content,
      })),
      connections: this.connections,
      canvasOffset: this.canvasOffset,
      scale: this.scale,
    };

    localStorage.setItem("documentCanvasLayout", JSON.stringify(layout));
    alert("Layout saved!");
  }

  loadLayout() {
    const saved = localStorage.getItem("documentCanvasLayout");
    if (saved) {
      try {
        const layout = JSON.parse(saved);
        this.canvasOffset = layout.canvasOffset || { x: 0, y: 0 };
        this.scale = layout.scale || 1;
        this.connections = layout.connections || [];

        // Apply saved positions when nodes are created
        this.savedLayout = layout;
      } catch (error) {
        console.error("Failed to load layout:", error);
      }
    }
  }

  handleKeyboard(e) {
    if (e.key === "Delete" && this.selectedNode) {
      this.removeNode(this.selectedNode.id);
    } else if (e.key === "Escape") {
      this.selectNode(null);
      this.isConnecting = false;
      this.connectionStart = null;
    } else if (e.ctrlKey || e.metaKey) {
      if (e.key === "s") {
        e.preventDefault();
        this.saveLayout();
      } else if (e.key === "a") {
        e.preventDefault();
        this.autoLayout();
      }
    }
  }

  formatBytes(bytes) {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  }

  formatDate(dateString) {
    return new Date(dateString).toLocaleString();
  }

  escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }
}

// Initialize the application
const app = new DocumentCanvas();
