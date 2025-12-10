// static/js/locations.js

document.addEventListener("DOMContentLoaded", () => {
    loadLocations();
});

async function loadLocations() {
    const container = document.getElementById("location-tree");
    container.innerHTML = '<div class="loading">Ładowanie...</div>';

    // Add Refresh Button (only useful if we want to force-scan everything, 
    // otherwise the tree builds passively)
    const refreshBtn = document.createElement("button");
    refreshBtn.innerText = "🔄 Skanuj cały Drive (może potrwać)";
    refreshBtn.className = "btn-secondary small";
    refreshBtn.style.marginBottom = "10px";
    refreshBtn.onclick = refreshTree;

    // Wrapper for tree
    const treeWrapper = document.createElement("div");
    treeWrapper.id = "tree-root";

    try {
        let res = await fetch("/api/drive/tree");
        let tree = await res.json();

        container.innerHTML = "";
        container.appendChild(refreshBtn);
        container.appendChild(treeWrapper);

        if (tree.length === 0) {
            treeWrapper.innerHTML = '<div class="empty">Brak danych. Przeglądaj dashboard aby zbudować mapę.</div>';
        } else {
            renderTree(tree, treeWrapper);
        }

    } catch (e) {
        container.innerHTML = '<div class="error">Błąd pobierania drzewa.</div>';
        container.prepend(refreshBtn);
    }
}

async function refreshTree() {
    const container = document.getElementById("tree-root");
    if (container) container.innerHTML = '<div class="loading">Skanowanie Drive...</div>';

    try {
        const res = await fetch("/api/drive/tree/refresh", { method: "POST" });
        const tree = await res.json();
        if (container) {
            container.innerHTML = "";
            renderTree(tree, container);
        }
    } catch (e) {
        alert("Błąd odświeżania");
        loadLocations();
    }
}

function renderTree(nodes, container) {
    if (!nodes || nodes.length === 0) return;

    const ul = document.createElement("ul");
    ul.className = "tree-list";

    nodes.forEach(node => {
        const li = document.createElement("li");

        const content = document.createElement("div");
        content.className = "tree-node-content";

        const toggle = document.createElement("span");
        toggle.className = "tree-toggle";
        // If has children, show arrow
        if (node.children && node.children.length > 0) {
            toggle.innerText = "▶";
            toggle.onclick = (e) => {
                e.stopPropagation();
                li.classList.toggle("open");
                toggle.innerText = li.classList.contains("open") ? "▼" : "▶";
            };
        } else {
            toggle.innerHTML = "&nbsp;";
        }

        const label = document.createElement("span");
        label.className = "tree-label";
        label.innerText = node.name;
        label.onclick = () => showLocationDetails(node);

        content.appendChild(toggle);
        content.appendChild(label);
        li.appendChild(content);

        if (node.children && node.children.length > 0) {
            const childrenContainer = document.createElement("div");
            childrenContainer.className = "tree-children";
            renderTree(node.children, childrenContainer);
            li.appendChild(childrenContainer);
        }

        ul.appendChild(li);
    });

    container.appendChild(ul);
}

function showLocationDetails(loc) {
    const panel = document.getElementById("details");
    panel.innerHTML = `
        <h3>${loc.name}</h3>
        <p><strong>ID:</strong> ${loc.id}</p>
        <div style="margin-top:20px;">
            <a href="/admin/dashboard?folder=${loc.id}" class="btn-primary">📂 Przejdź do folderu</a>
            <hr>
            <p><small>Rodzic: ${loc.parent_id || 'Brak'}</small></p>
        </div>
    `;
}
