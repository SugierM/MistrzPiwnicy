let currentFolderId = "root";

// ===================== INIT =====================

document.addEventListener("DOMContentLoaded", () => {
  console.log("Dashboard loaded.");
  console.log("Dashboard loaded.");

  const params = new URLSearchParams(window.location.search);
  const startFolder = params.get("folder") || "root";
  loadFolder(startFolder);
  loadFolder("root");

  // Sidebar: Navigation

  document.getElementById("refresh-tree").addEventListener("click", () => loadFolder(currentFolderId));

  // Sidebar: Add Folder Inline
  document.getElementById("sidebar-add-folder-btn").addEventListener("click", addFolder);
  // Allow Enter key in the input
  document.getElementById("sidebar-new-folder-name").addEventListener("keypress", (e) => {
    if (e.key === "Enter") addFolder();
  });

  // Sidebar: Add Entity Inline
  document.getElementById("sidebar-add-entity-btn").addEventListener("click", addEntity);
  document.getElementById("sidebar-new-entity-name").addEventListener("keypress", (e) => {
    if (e.key === "Enter") addEntity();
  });

  // Sidebar: Action Buttons (Global context of currently edited file)
  document.getElementById("save-btn").addEventListener("click", saveMetadata);
  document.getElementById("set-vis-btn").addEventListener("click", () => setVis(document.getElementById("editor-image").value));
  document.getElementById("set-music-btn").addEventListener("click", () => setMusic(document.getElementById("editor-music").value));

  // Editor: Uploads
  const btnUpImg = document.getElementById("upload-image-btn");
  if (btnUpImg) btnUpImg.addEventListener("click", () => triggerFileInput("image"));

  const btnUpMusic = document.getElementById("upload-music-btn");
  if (btnUpMusic) btnUpMusic.addEventListener("click", () => triggerFileInput("music"));

  // File inputs (Hidden)
  document.getElementById("file-input-image").addEventListener("change", (e) => handleFileUpload(e, "image"));
  document.getElementById("file-input-music").addEventListener("change", (e) => handleFileUpload(e, "music"));

  // Live Preview Updates (when user types in input)
  document.getElementById("editor-image").addEventListener("change", updatePreview);
  document.getElementById("editor-notes").addEventListener("change", updateNotesPreview);
});

// ===================== FOLDER NAVIGATION =====================

async function loadFolder(folderId) {
  currentFolderId = folderId;
  const treeContainer = document.getElementById("file-tree");
  treeContainer.innerHTML = '<div class="loading">Ładowanie...</div>';

  try {
    const res = await fetch(`/api/drive/list?folder_id=${folderId}`);
    const data = await res.json();
    renderFolderList(data);
  } catch (e) {
    treeContainer.innerHTML = '<div style="color:red">Błąd ładowania.</div>';
  }
}

function renderFolderList(data) {
  const treeContainer = document.getElementById("file-tree");
  treeContainer.innerHTML = "";

  // Navigation Header (Back/Root)
  const navHeader = document.createElement("div");
  navHeader.className = "folder-nav-header";

  // Truncate folder name if too long
  let dName = data.folder_name;
  if (dName.length > 15) dName = dName.substring(0, 15) + "...";

  navHeader.innerHTML = `<span>📂 ${dName}</span>`;

  const btnGroup = document.createElement("div");
  btnGroup.style.display = "flex";
  btnGroup.style.gap = "4px";

  // Root Button
  const rootBtn = document.createElement("button");
  rootBtn.innerText = "🏠";
  rootBtn.className = "btn-nav-small";
  rootBtn.title = "Główny katalog";
  rootBtn.onclick = () => loadFolder("root");
  rootBtn.onclick = () => loadFolder("root");
  btnGroup.appendChild(rootBtn);

  btnGroup.appendChild(rootBtn);

  // Up Button
  if (data.parent_id) {
    const upBtn = document.createElement("button");
    upBtn.innerText = "⬆️";
    upBtn.className = "btn-nav-small";
    upBtn.title = "W górę";
    upBtn.onclick = () => loadFolder(data.parent_id);
    btnGroup.appendChild(upBtn);
  }

  navHeader.appendChild(btnGroup);
  treeContainer.appendChild(navHeader);

  // Render Folders
  if (data.folders) {
    data.folders.forEach(folder => {
      const div = document.createElement("div");
      div.className = "tree-item folder";
      div.innerHTML = `<span>📁</span> ${folder.name}`;
      div.onclick = () => loadFolder(folder.id);
      treeContainer.appendChild(div);
    });
  }

  // Render Entities
  if (data.entities) {
    data.entities.forEach(entity => {
      const div = document.createElement("div");
      div.className = "tree-item entity";
      div.innerHTML = `<span class="entity-icon">🟢</span> ${entity.name}`;
      div.onclick = () => loadEntity(entity);
      treeContainer.appendChild(div);
    });
  }

  // Auto-record visit
  reportVisitedFolder(data);
}

// ===================== DYNAMIC TREE BUILDING =====================
async function reportVisitedFolder(data) {
  // data: { folder_id, folder_name, parent_id, ... }
  // We send this to backend to build the tree structure
  try {
    await fetch("/api/drive/visit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: data.folder_id,
        name: data.folder_name,
        parent_id: data.parent_id
      })
    });
  } catch (e) {
    console.warn("Failed to report folder visit", e);
  }
}

// ===================== EDITOR LOGIC =====================

async function loadEntity(entity) {
  // 1. Highlight in sidebar (optional todo)

  // 2. Fetch Data
  const res = await fetch(`/api/drive/entity?file_id=${entity.id}`);
  const meta = await res.json();

  // 3. Show Editor
  document.getElementById("empty-state").classList.add("hidden");
  const editor = document.getElementById("editor-container");
  editor.classList.remove("hidden");

  // 4. Fill Data
  // Metadata for saving
  editor.dataset.fileId = entity.id;
  editor.dataset.entityName = entity.name;

  document.getElementById("editor-title").innerText = meta.name || entity.name;
  document.getElementById("editor-description").value = meta.description || "";
  document.getElementById("editor-image").value = meta.image || "";
  document.getElementById("editor-music").value = meta.music || "";
  document.getElementById("editor-music").value = meta.music || "";
  document.getElementById("editor-notes").value = meta.notes || "";
  document.getElementById("editor-type").value = meta.type || "OTHER";
  document.getElementById("editor-fraction").value = meta.fraction || "";

  updatePreview();
  updateNotesPreview();
}

function updatePreview() {
  const url = document.getElementById("editor-image").value.trim();
  const imgEl = document.getElementById("main-preview-img");
  const placeholderText = document.querySelector(".placeholder-text");

  if (url) {
    // Use the same proxy as the visualizer to ensure it works
    imgEl.src = `/vis/proxy_image?url=${encodeURIComponent(url)}`;
    imgEl.classList.remove("hidden");
    if (placeholderText) placeholderText.style.display = 'none';
  } else {
    imgEl.src = "";
    imgEl.classList.add("hidden");
    if (placeholderText) placeholderText.style.display = 'block';
  }
}

function updateNotesPreview() {
  let url = document.getElementById("editor-notes").value.trim();
  const container = document.getElementById("notes-preview-container");
  const iframe = document.getElementById("notes-iframe");

  if (url && (url.includes("docs.google.com") || url.includes("drive.google.com"))) {
    // Convert /edit to /preview for cleaner embedding
    if (url.includes("/edit")) {
      url = url.replace(/\/edit.*/, "/preview");
    }
    // Handle view links too
    if (url.includes("/view")) {
      url = url.replace(/\/view.*/, "/preview");
    }

    iframe.src = url;
    container.classList.remove("hidden");
  } else {
    iframe.src = "";
    container.classList.add("hidden");
  }
}

function clearEditor() {
  document.getElementById("editor-container").classList.add("hidden");
  document.getElementById("empty-state").classList.remove("hidden");
}

// ===================== ACTIONS =====================

// ADD FOLDER (New Inline Logic)
async function addFolder() {
  const input = document.getElementById("sidebar-new-folder-name");
  const name = input.value.trim();

  if (!name) return notify("Wpisz nazwę folderu", true);

  const res = await fetch("/api/drive/add_folder", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ parent_id: currentFolderId, name }),
  });
  const data = await res.json();

  if (data.status === "success") {
    notify("📁 Dodano folder!");
    input.value = ""; // Clear input
    loadFolder(currentFolderId); // Refresh list
  } else {
    notify("❌ " + (data.error || "Błąd"), true);
  }
}

async function addEntity() {
  const input = document.getElementById("sidebar-new-entity-name");
  const name = input.value.trim();

  if (!name) return notify("Wpisz nazwę encji", true);

  const data = {
    folder_id: currentFolderId,
    name: name,
    metadata: {
      name: name,
      description: "",
      image: "",
      music: "",
      notes: ""
    }
  };

  const res = await fetch("/api/drive/update", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  const json = await res.json();
  if (json.status === "success") {
    notify("📄 Utworzono encję!");
    input.value = "";
    loadFolder(currentFolderId);
  } else {
    notify("❌ Błąd: " + (json.error || "Nieznany błąd"), true);
  }
}


async function saveMetadata() {
  const container = document.getElementById("editor-container");
  // Check if we are actually editing something
  if (container.classList.contains("hidden")) return notify("Wybierz najpierw element!", true);

  const fileId = container.dataset.fileId;
  const entityName = document.getElementById("editor-title").innerText.trim();

  const data = {
    folder_id: currentFolderId,
    name: entityName,
    file_id: fileId,
    metadata: {
      name: entityName,
      description: document.getElementById("editor-description").value.trim(),
      image: document.getElementById("editor-image").value.trim(),
      music: document.getElementById("editor-music").value.trim(),
      image: document.getElementById("editor-image").value.trim(),
      music: document.getElementById("editor-music").value.trim(),
      notes: document.getElementById("editor-notes").value.trim(),
      type: document.getElementById("editor-type").value,
      fraction: document.getElementById("editor-fraction").value.trim(),
    }
  };

  const res = await fetch("/api/drive/update", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  const json = await res.json();
  if (json.status === "success") {
    notify("✅ Zapisano zmiany!");
    // If name changed, we should refresh the tree
    if (entityName !== container.dataset.entityName) {
      loadFolder(currentFolderId);
    }
  } else {
    notify("❌ Błąd zapisu", true);
  }
}

// ===================== UPLOAD & VIS =====================

function triggerFileInput(type) {
  if (type === "image") document.getElementById("file-input-image").click();
  if (type === "music") document.getElementById("file-input-music").click();
}

async function handleFileUpload(event, type) {
  const file = event.target.files[0];
  if (!file) return;

  // We upload to the CURRENT folder we are looking at
  const formData = new FormData();
  formData.append("file", file);
  formData.append("folder_id", currentFolderId);

  notify("⏳ Wysyłanie...");

  const res = await fetch("/api/upload", { method: "POST", body: formData });
  const result = await res.json();

  if (result.ok) {
    if (type === "image") {
      document.getElementById("editor-image").value = result.link;
      notify("📸 Wgrano obraz!");
      updatePreview();
    } else if (type === "music") {
      document.getElementById("editor-music").value = result.link;
      notify("🎵 Wgrano muzykę!");
    }
  } else {
    notify("❌ Błąd: " + (result.error || "Upload failed"), true);
  }
  event.target.value = "";
}

async function setVis(url) {
  if (!url) return notify("Brak obrazu do pokazania", true);
  await fetch(`/api/set_vis?url=${encodeURIComponent(url)}`);
  notify("👁️ Wysłano na Vis");
}

async function setMusic(url) {
  if (!url) return notify("Brak muzyki", true);
  await fetch(`/api/set_music?url=${encodeURIComponent(url)}`);
  notify("🎵 Wysłano muzykę");
}

function notify(msg, error = false) {
  const toast = document.createElement("div");
  toast.className = "toast " + (error ? "error" : "ok");
  toast.innerText = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}
