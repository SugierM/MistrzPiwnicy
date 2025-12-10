// static/js/entities.js

async function fetchLocalData() {
    const res = await fetch("/api/local/sidebar");
    return await res.json();
}

async function loadNPCs() {
    const container = document.getElementById("npc-list");
    container.innerHTML = '<div class="loading">Ładowanie...</div>';

    try {
        const data = await fetchLocalData();
        const npcs = data.npcs || [];

        container.innerHTML = "";

        if (npcs.length === 0) {
            container.innerHTML = '<div class="empty">Brak zapisanych NPC.</div>';
            return;
        }

        npcs.forEach(npc => {
            const div = document.createElement("div");
            div.className = "list-item";
            div.innerHTML = `<strong>${npc.name}</strong>`;
            div.onclick = () => showDetails(npc);
            container.appendChild(div);
        });

    } catch (e) {
        container.innerHTML = '<div class="error">Błąd danych.</div>';
    }
}

async function loadFractions() {
    const container = document.getElementById("fractions-list");
    container.innerHTML = '<div class="loading">Ładowanie...</div>';

    try {
        const data = await fetchLocalData();
        const fractions = data.fractions || {};

        container.innerHTML = "";

        if (Object.keys(fractions).length === 0) {
            container.innerHTML = '<div class="empty">Brak frakcji.</div>';
            return;
        }

        Object.keys(fractions).forEach(fracKey => {
            const group = document.createElement("div");
            group.className = "fraction-group";

            const header = document.createElement("h3");
            header.innerText = fracKey;
            group.appendChild(header);

            fractions[fracKey].forEach(npc => {
                const div = document.createElement("div");
                div.className = "list-item indented";
                div.innerText = npc.name;
                div.onclick = () => showDetails(npc);
                group.appendChild(div);
            });

            container.appendChild(group);
        });

    } catch (e) {
        container.innerHTML = '<div class="error">Błąd danych.</div>';
    }
}

function showDetails(entity) {
    // Determine where to show details
    const panel = document.getElementById("npc-details") || document.getElementById("fraction-details");
    if (!panel) return;

    panel.innerHTML = `
        <h3>${entity.name}</h3>
        <p><strong>Typ:</strong> ${entity.type || "N/A"}</p>
        <p><strong>Folder ID:</strong> ${entity.folder_id}</p>
        <div style="margin-top:20px;">
            <a href="/admin/dashboard?folder=${entity.folder_id}" class="btn-primary">📂 Przejdź do folderu</a>
            <button onclick="copyId('${entity.id}')" class="btn-secondary">📋 Kopiuj ID</button>
        </div>
    `;
    panel.classList.remove("empty-selection");
}

function copyId(id) {
    navigator.clipboard.writeText(id);
    alert("Skopiowano ID!");
}
