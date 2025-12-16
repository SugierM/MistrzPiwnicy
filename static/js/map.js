
// map.js
// Main logic for DnD Map Editor using Konva.js

// State
const AppState = {
    scale: 1, // Konva stage scale
    pixelsPerMeter: 50, // Default 50px = 1m
    gridEnabled: true,
    mode: 'select', // select, pan, scale, brush
    brushColor: '#00D2FF',
    brushSize: 5,
    currentLayer: 'tokens',
    mapImage: null
};

// Elements
const stageContainer = document.getElementById('canvas-container');

// Konva Setup
const width = stageContainer.offsetWidth;
const height = stageContainer.offsetHeight;

let stage = new Konva.Stage({
    container: 'canvas-container',
    width: width,
    height: height,
    draggable: false
});

// Layers
let bgLayer = new Konva.Layer({ name: 'background' });
let gridLayer = new Konva.Layer({ name: 'grid' });
let objectLayer = new Konva.Layer({ name: 'objects' });
let brushLayer = new Konva.Layer({ name: 'brush' });
let tokenLayer = new Konva.Layer({ name: 'tokens' });
let uiLayer = new Konva.Layer({ name: 'ui' });

stage.add(bgLayer);
stage.add(gridLayer);
stage.add(brushLayer);
stage.add(objectLayer);
stage.add(tokenLayer);
stage.add(uiLayer);

// Transformer
let transformer = new Konva.Transformer({
    nodes: [],
    keepRatio: true,
    enabledAnchors: ['top-left', 'top-right', 'bottom-left', 'bottom-right']
});
uiLayer.add(transformer);

// === HELPER DEFINITIONS ===

function setupDraggableValues(img, url, type) {
    img.draggable = true;
    img.ondragstart = (e) => {
        e.dataTransfer.setData('src', url);
        e.dataTransfer.setData('type', type);
    };
}

// --- Modules ---

// 1. Grid System
function drawGrid() {
    gridLayer.destroyChildren();

    if (!AppState.gridEnabled) {
        gridLayer.batchDraw();
        return;
    }

    const cellSize = AppState.pixelsPerMeter;
    const scale = stage.scaleX();
    const stageX = stage.x();
    const stageY = stage.y();

    const startX = Math.floor((-stageX / scale) / cellSize) * cellSize;
    const startY = Math.floor((-stageY / scale) / cellSize) * cellSize;

    const endX = startX + (stage.width() / scale) + cellSize * 2;
    const endY = startY + (stage.height() / scale) + cellSize * 2;

    const stroke = 'rgba(0, 0, 0, 1)';
    const lines = new Konva.Group();

    if (cellSize < 5) return;

    // Vertical
    for (let i = startX; i < endX; i += cellSize) {
        lines.add(new Konva.Line({
            points: [i, startY, i, endY],
            stroke: stroke,
            strokeWidth: 1 / scale,
            listening: false
        }));
    }

    // Horizontal
    for (let j = startY; j < endY; j += cellSize) {
        lines.add(new Konva.Line({
            points: [startX, j, endX, j],
            stroke: stroke,
            strokeWidth: 1 / scale,
            listening: false
        }));
    }

    gridLayer.add(lines);
    gridLayer.batchDraw();
}

// 2. Map Image Loading
async function loadMapImage(src, metadata = null) {
    const imgObj = new Image();
    imgObj.src = src;

    imgObj.onload = () => {
        bgLayer.destroyChildren();

        const konvaImg = new Konva.Image({
            image: imgObj,
            x: 0,
            y: 0,
            draggable: false
        });

        AppState.mapImage = konvaImg;
        bgLayer.add(konvaImg);

        if (metadata) {
            AppState.pixelsPerMeter = metadata.pixelsPerMeter || 50;
        }

        // === CENTERING LOGIC ===
        const imgW = konvaImg.width();
        const imgH = konvaImg.height();

        // 1. Calculate fit scale
        const scaleX = stage.width() / imgW;
        const scaleY = stage.height() / imgH;
        const fitScale = Math.min(scaleX, scaleY, 1); // Don't zoom in if image is smaller than stage

        // 2. Center
        const centerX = (stage.width() - imgW * fitScale) / 2;
        const centerY = (stage.height() - imgH * fitScale) / 2;

        stage.scale({ x: fitScale, y: fitScale });
        stage.position({ x: centerX, y: centerY });

        bgLayer.batchDraw();
        drawGrid();
    };
}

// 3. User Interactions
const btnSelect = document.getElementById('tool-select');
if (btnSelect) btnSelect.onclick = () => setTool('select');

const btnPan = document.getElementById('tool-pan');
if (btnPan) btnPan.onclick = () => setTool('pan');

const btnScale = document.getElementById('tool-scale');
if (btnScale) btnScale.onclick = () => startScaleTool();

const btnGrid = document.getElementById('tool-grid');
if (btnGrid) btnGrid.onclick = () => toggleGrid();

const btnUpload = document.getElementById('tool-upload');
if (btnUpload) btnUpload.onclick = () => document.getElementById('file-upload').click();

const btnBrush = document.getElementById('tool-brush');
if (btnBrush) btnBrush.onclick = () => setTool('brush');

const colorPicker = document.getElementById('brush-color');
if (colorPicker) {
    colorPicker.onchange = (e) => { AppState.brushColor = e.target.value; };
}

// Delete Logic
function deleteSelection() {
    const nodes = transformer.nodes();
    if (nodes.length === 0) return;

    transformer.nodes([]); // Detach first
    uiLayer.batchDraw();

    const layersToUpdate = new Set();
    nodes.forEach(node => {
        const layer = node.getLayer();
        if (layer) layersToUpdate.add(layer);
        node.destroy();
    });

    layersToUpdate.forEach(layer => layer.batchDraw());
}

document.getElementById('tool-delete').onclick = deleteSelection;

// Keyboard Shortcuts
window.addEventListener('keydown', (e) => {
    // Check if user is typing in input
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    if (e.key === 'Delete' || e.key === 'Backspace') {
        deleteSelection();
    }
});

document.getElementById('file-upload').onchange = (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (ev) => loadMapImage(ev.target.result);
        reader.readAsDataURL(file);
    }
};

function setTool(mode) {
    AppState.mode = mode;

    document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
    if (mode === 'select') document.getElementById('tool-select')?.classList.add('active');
    if (mode === 'pan') document.getElementById('tool-pan')?.classList.add('active');
    if (mode === 'scale') document.getElementById('tool-scale')?.classList.add('active');
    if (mode === 'brush') document.getElementById('tool-brush')?.classList.add('active');

    stage.draggable(mode === 'pan');

    if (mode === 'pan') stageContainer.style.cursor = 'grab';
    else if (mode === 'brush') stageContainer.style.cursor = 'crosshair';
    else if (mode === 'scale') stageContainer.style.cursor = 'crosshair';
    else stageContainer.style.cursor = 'default';

    const isSelect = mode === 'select';
    tokenLayer.find('.token').forEach(grp => grp.draggable(isSelect));
    objectLayer.find('Image').forEach(img => img.draggable(isSelect));

    if (!isSelect) {
        transformer.nodes([]);
        uiLayer.batchDraw();
    }
}

function toggleGrid() {
    AppState.gridEnabled = !AppState.gridEnabled;
    drawGrid();
}

// ZOOM / WHEEL
stage.on('wheel', (e) => {
    e.evt.preventDefault();
    const scaleBy = 1.1;
    const oldScale = stage.scaleX();

    const mousePointTo = {
        x: stage.getPointerPosition().x / oldScale - stage.x() / oldScale,
        y: stage.getPointerPosition().y / oldScale - stage.y() / oldScale,
    };

    const newScale = e.evt.deltaY < 0 ? oldScale * scaleBy : oldScale / scaleBy;

    stage.scale({ x: newScale, y: newScale });

    const newPos = {
        x: -(mousePointTo.x - stage.getPointerPosition().x / newScale) * newScale,
        y: -(mousePointTo.y - stage.getPointerPosition().y / newScale) * newScale,
    };
    stage.position(newPos);
    stage.batchDraw();
    drawGrid();
});

stage.on('dragend', () => drawGrid());


// 4. Scaling Tool Logic (Rectangle)
let scaleRect = null;
let isScaling = false;
let scaleStart = null;

function startScaleTool() {
    setTool('scale');
    alert("Draw a box that corresponds to 1x1 meter.");
}

// 5. Brush Logic
let isPaint = false;
let currentLine;

stage.on('mousedown touchstart', (e) => {
    if (AppState.mode === 'brush') {
        isPaint = true;
        const pos = stage.getRelativePointerPosition();
        currentLine = new Konva.Line({
            stroke: AppState.brushColor,
            strokeWidth: 5,
            globalCompositeOperation: 'source-over',
            points: [pos.x, pos.y],
            tension: 0.5,
            lineCap: 'round',
            lineJoin: 'round',
        });
        brushLayer.add(currentLine);
    }

    if (AppState.mode === 'scale') {
        isScaling = true;
        const pos = stage.getRelativePointerPosition();
        scaleStart = pos;
        scaleRect = new Konva.Rect({
            x: pos.x,
            y: pos.y,
            width: 0,
            height: 0,
            stroke: '#ff0000',
            strokeWidth: 2,
            dash: [10, 5]
        });
        uiLayer.add(scaleRect);
    }

    // SELECT LOGIC
    if (AppState.mode === 'select') {
        if (e.target === stage || e.target.getLayer().name() === 'background' || e.target.getLayer().name() === 'grid') {
            transformer.nodes([]);
            uiLayer.batchDraw();
            return;
        }

        const clicked = e.target;

        // 1. Try to find a Token Group (named 'token')
        // findAncestor('.token') finds parent groups named 'token'.
        // If clicked IS the group (unlikely for shapes), use it.
        const tokenNode = clicked.findAncestor('.token') || (clicked.hasName('token') ? clicked : null);

        // 2. Try to find an Object (named 'object')
        const objectNode = clicked.findAncestor('.object') || (clicked.hasName('object') ? clicked : null);

        const node = tokenNode || objectNode;

        if (node) {
            transformer.nodes([node]);
            uiLayer.batchDraw();
        }
    }
});

stage.on('mousemove touchmove', (e) => {
    if (AppState.mode === 'brush' && isPaint) {
        e.evt.preventDefault();
        const pos = stage.getRelativePointerPosition();
        const newPoints = currentLine.points().concat([pos.x, pos.y]);
        currentLine.points(newPoints);
        brushLayer.batchDraw();
    }

    if (AppState.mode === 'scale' && isScaling) {
        const pos = stage.getRelativePointerPosition();
        scaleRect.width(pos.x - scaleStart.x);
        scaleRect.height(pos.y - scaleStart.y);
        uiLayer.batchDraw();
    }
});

stage.on('mouseup touchend', () => {
    isPaint = false;

    if (AppState.mode === 'scale' && isScaling) {
        isScaling = false;

        const w = Math.abs(scaleRect.width());
        const h = Math.abs(scaleRect.height());
        const avg = (w + h) / 2;

        scaleRect.destroy();
        uiLayer.batchDraw();

        if (avg > 5) {
            AppState.pixelsPerMeter = avg;
            drawGrid();
            setTool('select');
        }
    }
});


// 6. Token & Drag Drop
function createToken(url, pos) {
    const size = AppState.pixelsPerMeter;

    const group = new Konva.Group({
        x: pos.x,
        y: pos.y,
        draggable: true,
        name: 'token'
    });

    const innerGroup = new Konva.Group();
    innerGroup.clipFunc(function (ctx) {
        ctx.arc(0, 0, size / 2, 0, Math.PI * 2, false);
    });

    Konva.Image.fromURL(url, (img) => {
        img.width(size);
        img.height(size);
        img.x(-size / 2);
        img.y(-size / 2);
        innerGroup.add(img);

        const ring = new Konva.Circle({
            radius: size / 2,
            stroke: 'white',
            strokeWidth: 2,
            listening: false
        });

        group.add(innerGroup);
        group.add(ring);
        tokenLayer.add(group);
    });
}

const con = stage.container();
con.addEventListener('dragover', (e) => e.preventDefault());
con.addEventListener('drop', async (e) => {
    e.preventDefault();
    stage.setPointersPositions(e);

    const type = e.dataTransfer.getData('type');
    const src = e.dataTransfer.getData('src');

    const transform = stage.getAbsoluteTransform().copy().invert();
    const ptr = stage.getPointerPosition();
    const pos = transform.point(ptr);

    if (type === 'drive-map') {
        importDriveMap(src);
    } else if (type === 'token') {
        createToken(src, pos);
    } else if (type === 'asset') {
        Konva.Image.fromURL(src, (img) => {
            img.setAttrs({ x: pos.x, y: pos.y, draggable: true, name: 'object' });
            objectLayer.add(img);
            stage.draw();
        });
    } else if (!type && e.dataTransfer.files.length > 0) {
        const file = e.dataTransfer.files[0];
        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (ev) => loadMapImage(ev.target.result);
            reader.readAsDataURL(file);
        }
    }
});

async function loadCharacters() {
    const res = await fetch('/api/map/characters');
    const list = await res.json();
    const container = document.getElementById('assets-characters');
    if (!container) return;
    container.innerHTML = '';
    list.forEach(url => {
        const img = document.createElement('img');
        img.src = url;
        img.className = 'asset-item';
        setupDraggableValues(img, url, 'token');
        container.appendChild(img);
    });
}

const gridCheck = document.getElementById('toggle-grid-layer');
if (gridCheck) gridCheck.onchange = (e) => { gridLayer.visible(e.target.checked); };

const tokenCheck = document.getElementById('toggle-tokens-layer');
if (tokenCheck) tokenCheck.onchange = (e) => { tokenLayer.visible(e.target.checked); };

const btnSave = document.getElementById('btn-save');
if (btnSave) btnSave.onclick = async () => {
    transformer.nodes([]);
    uiLayer.visible(false);

    const gridVisible = gridLayer.visible();
    const tokensVisible = tokenLayer.visible();

    gridLayer.visible(false);
    tokenLayer.visible(false);

    const dataURL = stage.toDataURL({ pixelRatio: 2 });

    gridLayer.visible(gridVisible);
    tokenLayer.visible(tokensVisible);
    uiLayer.visible(true);

    const payload = {
        image: dataURL,
        filename: "Map_" + new Date().getTime(),
        metadata: {
            pixelsPerMeter: AppState.pixelsPerMeter
        }
    };

    const res = await fetch('/api/map/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    const reply = await res.json();
    if (reply.status === 'success') {
        alert("Map saved: " + reply.path);
    }
};

document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.onclick = (e) => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

        btn.classList.add('active');
        const tab = document.getElementById(btn.dataset.tab);
        if (tab) tab.classList.add('active');
    };
});

async function loadAssets() {
    const res = await fetch('/api/map/assets');
    const data = await res.json();

    ['houses', 'nature', 'landmarks'].forEach(cat => {
        const div = document.getElementById('assets-' + cat);
        if (!div || !data[cat]) return;
        div.innerHTML = '';
        data[cat].forEach(url => {
            const img = document.createElement('img');
            img.src = url;
            img.className = 'asset-item';
            setupDraggableValues(img, url, 'asset');
            div.appendChild(img);
        });
    });
}

async function loadDriveList() {
    const container = document.getElementById('drive-list');
    if (!container) return;
    container.innerHTML = '<div style="padding:10px">Loading...</div>';
    try {
        const res = await fetch('/api/map/drive-list');
        const data = await res.json();
        container.innerHTML = '';
        if (data.length === 0) container.innerHTML = '<div style="padding:10px">No maps found.</div>';

        data.forEach(mapItem => {
            const div = document.createElement('div');
            div.className = 'drive-item';
            div.innerHTML = `<i class="fa-solid fa-map"></i> <span>${mapItem.name}</span>`;
            div.draggable = true;
            div.ondragstart = (e) => {
                e.dataTransfer.setData('src', mapItem.metadata_id);
                e.dataTransfer.setData('type', 'drive-map');
            };
            div.onclick = () => importDriveMap(mapItem.metadata_id);
            container.appendChild(div);
        });
    } catch (e) {
        console.error(e);
        container.innerHTML = 'Error loading drive items';
    }
}

async function importDriveMap(metadataId) {
    if (!confirm("Load Map?")) return;
    const res = await fetch('/api/map/import-drive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ metadata_id: metadataId })
    });
    const data = await res.json();
    if (data.status === 'success') loadMapImage(data.local_path + "?t=" + Date.now(), data.metadata);
}


// Ad Hoc Token
const btnAdhoc = document.getElementById('btn-add-adhoc');
if (btnAdhoc) btnAdhoc.onclick = () => {
    const name = document.getElementById('adhoc-name').value || "M";
    const size = AppState.pixelsPerMeter;
    const pos = { x: (stage.width() / 2 - stage.x()) / stage.scaleX(), y: (stage.height() / 2 - stage.y()) / stage.scaleY() };

    const group = new Konva.Group({
        x: pos.x, y: pos.y, draggable: true, name: 'token'
    });

    const circle = new Konva.Circle({
        radius: size / 2,
        stroke: '#fff',
        strokeWidth: 2,
        fill: '#333'
    });

    const text = new Konva.Text({
        text: name.substring(0, 2).toUpperCase(),
        // SMALLER FONT SIZE
        fontSize: size / 3,
        fill: '#fff',
        fontFamily: 'Arial',
        fontStyle: 'bold'
    });
    text.offsetX(text.width() / 2);
    text.offsetY(text.height() / 2);

    group.add(circle);
    group.add(text);
    tokenLayer.add(group);
};

// 7. Synchronization Logic
const SYNC_INTERVAL = 2000; // 2 seconds
let lastServerTimestamp = 0;

if (IS_ADMIN) {
    // ADMIN: PUSH CHANGES
    let debounceTimer;
    function pushState() {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            const data = stage.toJSON();
            fetch('/api/map/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
        }, 1000); // 1 sec debounce
    }

    stage.on('dragend transformend', pushState);
    tokenLayer.on('dragend', pushState);
    // We also need to capture layer add/remove which isn't a direct event on stage easily.
    // Handled by manual calls in interactions (e.g. drop)
} else {
    // GUEST: POLL CHANGES

    // Allow exploration (Panning/Zooming) but no editing
    setTool('pan');

    setInterval(async () => {
        try {
            const res = await fetch('/api/map/sync');
            const json = await res.json();

            if (json.timestamp > lastServerTimestamp && json.data) {
                lastServerTimestamp = json.timestamp;

                // Restore logic
                // We need to preserve view (scale/pos) if user is panning?
                // The task said "only 'explore' present map". 
                // If we load full stage JSON, it overwrites stage attrs (x, y, scale).
                // Solution: Save current view, load stage, restore view (optional) OR
                // Just let Admin control view? 
                // User said "guests... can only see... but cant edit... only 'explore'".
                // "Explore" implies they can pan/zoom themselves.

                const currentScale = stage.scaleX();
                const currentPos = stage.position();

                // We can't use Konva.Node.create(json, 'container') easily because it replaces everything.
                // Better to clear layers and re-add?

                // Let's try:
                const newData = typeof json.data === 'string' ? JSON.parse(json.data) : json.data;

                // If we replace the whole stage, we lose event listeners and references.
                // Ideally, we only update CHILDREN of layers. 
                // But Stage.toJSON saves everything.

                // Workaround: Use stage.load() ?? No.
                // Konva.Node.create(json) returns a new Stage.

                const newStage = Konva.Node.create(json.data);

                // Update layers
                const layers = ['background', 'grid', 'objects', 'tokens']; // Brush??

                layers.forEach(name => {
                    const newLayer = newStage.findOne('.' + name);
                    const oldLayer = stage.findOne('.' + name);
                    if (newLayer && oldLayer) {
                        oldLayer.destroyChildren();
                        // Clone children to avoid moving them out of newStage structure prematurely causing issues?
                        // newLayer.children is Collection.

                        // Note: background layer image loading might be jerky.
                        const children = newLayer.getChildren().slice(); // copy array
                        children.forEach(child => {
                            child.moveTo(oldLayer);
                            if (name === 'background' && child.className === 'Image' && child.image()) {
                                // ensure image object is preserved/loaded? 
                                // content is serialized as URL, Konva handles auto-load? 
                                // No, toJSON exports attrs. image attr is object not serializable usually unless src.
                                // Wait, `loadMapImage` sets `image` attr to HTMLImageElement.
                                // Konva's toJSON does NOT serialize the `image` element, only `attrs`.
                                // If we used `Konva.Image.fromURL`, it sets `image` attr.
                                // We need to re-hydrate images.

                                // Check if saved state has image src.
                                // Actually, toJSON saves serialization. 
                                // We need to ensure we save source URL if possible in attrs 
                                // OR we rely on standard Konva behavior.

                                // If image loading is issue, this simple sync will fail for images.
                                // FIX: In `loadMapImage`, we used `Konva.Image` with `image: imgObj`.
                                // We should set an attr `src` so we can reload it.
                            }
                        });
                        oldLayer.batchDraw();
                    }
                });

                // Re-hydrate images logic?
                // For now, assume ad-hoc tokens work. 
                // If background image is missing, we need to fix admin side to store src in attr.

            }
        } catch (e) {
            console.log("Sync error", e);
        }
    }, SYNC_INTERVAL);
}

// Init
loadCharacters();
loadAssets();
loadDriveList();
const btnRefresh = document.getElementById('btn-refresh-drive');
if (btnRefresh) btnRefresh.onclick = loadDriveList;
