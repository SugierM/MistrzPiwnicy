from flask import Blueprint, jsonify, request
from utils.drive import list_folder_content, get_file_content, update_file_content, create_folder, create_file, upload_file, get_file_metadata, rename_file, ROOT_FOLDER_ID, get_all_folders
from utils.file_ops import save_json, load_json
import json
from utils.drive_utils import normalize_drive_link
import os

bp = Blueprint("drive", __name__)
STATE_FILE = "data/state.json"

@bp.route("/drive/list", methods=["GET"])
def list_drive():
    """Lists folder content and separates folders from entities (metadata_*.json)."""
    folder_id = request.args.get("folder_id", "root")
    items = list_folder_content(folder_id)
    
    # Get current folder details
    current_folder_name = "Root"
    parent_id = None
    
    if folder_id != "root":
        meta = get_file_metadata(folder_id)
        if meta:
            current_folder_name = meta.get("name", "Unknown")
            parents = meta.get("parents", [])
            if parents:
                parent_id = parents[0]
    
    folders = []
    entities = []
    
    for item in items:
        if item["mimeType"] == "application/vnd.google-apps.folder":
            folders.append(item)
        elif item["name"].startswith("metadata_") and item["name"].endswith(".json"):
            # It's an entity file
            entity_name = item["name"].replace("metadata_", "").replace(".json", "")
            entities.append({
                "id": item["id"],
                "name": entity_name,
                "file_name": item["name"],
                "type": "entity"
            })
            
    return jsonify({
        "folder_id": folder_id,
        "folder_name": current_folder_name,
        "parent_id": parent_id,
        "folders": folders,
        "entities": entities
    })

@bp.route("/drive/entity", methods=["GET"])
def get_entity():
    """Gets content of a specific entity file."""
    file_id = request.args.get("file_id")
    if not file_id:
        return jsonify({"error": "Missing file_id"}), 400
        
    content = get_file_content(file_id)
    if content:
        try:
            return jsonify(json.loads(content))
        except:
            return jsonify({"error": "Invalid JSON"}), 500
    return jsonify({"error": "File not found"}), 404

@bp.route("/drive/update", methods=["POST"])
def update_metadata():
    """Updates or creates metadata_NAME.json in the specified folder. Renames file if name changed."""
    data = request.json
    folder_id = data.get("folder_id")
    entity_name = data.get("name") # The name of the entity
    metadata = data.get("metadata")
    file_id = data.get("file_id") # Optional, if updating existing

    if not folder_id or not entity_name or not metadata:
        return jsonify({"error": "Missing folder_id, name, or metadata"}), 400

    content_str = json.dumps(metadata, indent=2, ensure_ascii=False)
    
    if file_id:
        # Check if we need to rename the file
        current_meta = get_file_metadata(file_id, fields="name")
        new_filename = f"metadata_{entity_name}.json"
        
        if current_meta and current_meta.get('name') != new_filename:
             rename_success = rename_file(file_id, new_filename)
             if not rename_success:
                 print(f"Warning: Failed to rename file {file_id} to {new_filename}")

        success = update_file_content(file_id, content_str)
    else:
        # Create new metadata file
        filename = f"metadata_{entity_name}.json"
        new_id = create_file(filename, folder_id, content_str)
        success = new_id is not None
        
    if success:
        # Update Local Cache
        final_id = file_id if file_id else new_id
        entity_type = metadata.get("type", "").upper()
        fraction = metadata.get("fraction", "").strip()
        
        cache_data = {
            "id": final_id,
            "name": entity_name,
            "folder_id": folder_id,
            "type": entity_type
        }
        
        if entity_type == "NPC":
            update_local_npc(cache_data)
            
        # Always update fraction registry to handle removals/changes
        update_local_fraction(cache_data, fraction)

        return jsonify({"status": "success", "id": final_id})
    else:
        return jsonify({"error": "Failed to save metadata"}), 500

@bp.route("/drive/add_folder", methods=["POST"])
def add_folder():
    """Creates a new folder."""
    data = request.json
    parent_id = data.get("parent_id")
    name = data.get("name")
    
    if not parent_id or not name:
        return jsonify({"error": "Missing parent_id or name"}), 400
        
    new_id = create_folder(name, parent_id)
    if new_id:
        return jsonify({"status": "success", "id": new_id})
    else:
        return jsonify({"error": "Failed to create folder"}), 500

@bp.route("/upload", methods=["POST"])
def upload():
    """Uploads a file to the specified folder."""
    if 'file' not in request.files:
        return jsonify({"error": "No file part"}), 400
    file = request.files['file']
    folder_id = request.form.get("folder_id")
    
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400
    if not folder_id:
        return jsonify({"error": "Missing folder_id"}), 400
        
    result = upload_file(file, folder_id)
    if result:
        file_id = result.get("id")
        link = result.get("webContentLink", "")
        
        # Construct direct link for images to ensure they display in <img> tags
        if result.get("mimeType", "").startswith("image/"):
             link = f"https://drive.google.com/uc?export=view&id={file_id}"
             
        return jsonify({"ok": True, "link": link, "id": file_id})
    else:
        return jsonify({"error": "Upload failed"}), 500

@bp.route("/set_vis", methods=["GET"])
def set_vis():
    """Updates the current image in state.json."""
    image_url = request.args.get("url", "")
    if not image_url:
        return jsonify({"error": "Missing url"}), 400

    # 🧠 Nowe: zamieniamy link zanim trafi do pliku
    final_link = normalize_drive_link(image_url)

    state = load_json("data/state.json")
    state["current_image"] = final_link
    save_json("data/state.json", state)

    return jsonify({"status": "success", "current_image": final_link})

@bp.route("/set_music", methods=["GET"])
def set_music():
    """Updates the current music in state.json."""
    music_url = request.args.get("url")
    if not music_url:
        return jsonify({"error": "Missing url"}), 400
        
    state = load_json(STATE_FILE)
    state["current_music"] = music_url
    save_json(STATE_FILE, state)
    
    return jsonify({"status": "success", "current_music": music_url})

# ===================== LOCAL CACHE LOGIC =====================

LOCAL_NPCS = "data/local_npcs.json"
LOCAL_FRACTIONS = "data/local_fractions.json"
LOCAL_LOCATIONS = "data/local_locations.json"

def update_local_npc(entity_data):
    """Updates the local NPC list."""
    npcs = load_json(LOCAL_NPCS)
    if not isinstance(npcs, list):
        npcs = []
        
    # Check if exists, update
    found = False
    for item in npcs:
        if item.get("id") == entity_data["id"]:
            item.update(entity_data)
            found = True
            break
            
    if not found:
        npcs.append(entity_data)
        
    save_json(LOCAL_NPCS, npcs)

def update_local_fraction(entity_data, fraction_name):
    """Updates the local Factions list. If fraction_name is empty, removes entity from all fractions."""
    fractions = load_json(LOCAL_FRACTIONS)
    if not isinstance(fractions, dict):
        fractions = {}
        
    # Remove from all fractions first (clean slate)
    for fname in list(fractions.keys()):
        fractions[fname] = [i for i in fractions[fname] if i.get("id") != entity_data["id"]]
        if not fractions[fname]:
             del fractions[fname]
             
    # If we have a new fraction, add it there
    if fraction_name:
        if fraction_name not in fractions:
            fractions[fraction_name] = []
        fractions[fraction_name].append(entity_data)

    save_json(LOCAL_FRACTIONS, fractions)

@bp.route("/local/location", methods=["POST"])
def save_local_location():
    """Saves a folder to local shortcuts."""
    data = request.json
    folder_id = data.get("id")
    name = data.get("name")
    
    if not folder_id or not name:
        return jsonify({"error": "Missing id or name"}), 400
        
    locations = load_json(LOCAL_LOCATIONS)
    if not isinstance(locations, list):
        locations = []
        
    # Avoid duplicates
    if not any(l["id"] == folder_id for l in locations):
        locations.append({"id": folder_id, "name": name})
        save_json(LOCAL_LOCATIONS, locations)
        
    return jsonify({"status": "success"})

@bp.route("/local/sidebar", methods=["GET"])
def get_sidebar_data():
    """Returns combined local data for sidebar."""
    return jsonify({
        "locations": load_json(LOCAL_LOCATIONS) or [],
        "npcs": load_json(LOCAL_NPCS) or [],
        "fractions": load_json(LOCAL_FRACTIONS) or {}
    })

# ===================== DYNAMIC TREE LOGIC =====================

# We store flat headers: ID -> {name, parent_id}
LOCAL_FOLDERS_FILE = "data/local_folders.json"

def get_local_folders():
    data = load_json(LOCAL_FOLDERS_FILE)
    if not isinstance(data, dict):
        return {}
    return data

def save_local_folders(data):
    save_json(LOCAL_FOLDERS_FILE, data)

@bp.route("/drive/visit", methods=["POST"])
def visit_folder():
    """Updates the local cache with the visited folder's info."""
    data = request.json
    folder_id = data.get("id")
    name = data.get("name")
    parent_id = data.get("parent_id")
    
    if not folder_id or not name:
        return jsonify({"error": "Missing id or name"}), 400
        
    folders = get_local_folders()
    
    # Update entry
    folders[folder_id] = {
        "id": folder_id,
        "name": name,
        "parent_id": parent_id
    }
    
    save_local_folders(folders)
    return jsonify({"status": "success"})

@bp.route("/drive/tree/refresh", methods=["POST"])
def refresh_tree():
    """Fetches ALL folders from Drive and rebuilds the flat cache."""
    all_folders = get_all_folders()
    flat_map = {}
    
    for f in all_folders:
        pid = f.get('parents', [None])[0] if f.get('parents') else None
        flat_map[f['id']] = {
            "id": f['id'],
            "name": f['name'],
            "parent_id": pid
        }
    
    # Ensure ROOT is there if configured
    if ROOT_FOLDER_ID and ROOT_FOLDER_ID not in flat_map:
         pass

    save_local_folders(flat_map)
    return get_tree() # Return the built tree

@bp.route("/drive/tree", methods=["GET"])
def get_tree():
    """Reconstructs tree from local flat cache."""
    folders = get_local_folders()
    
    # 1. Create nodes
    nodes = {
        fid: {
            "id": fid,
            "name": info["name"],
            "children": [],
            "parent_id": info.get("parent_id")
        } for fid, info in folders.items()
    }
        
    # 2. Link children
    roots = []
    
    for fid, node in nodes.items():
        pid = node["parent_id"]
        if pid and pid in nodes:
            nodes[pid]["children"].append(node)
        else:
            roots.append(node)
            
    # 3. Sort
    def sort_nodes(n_list):
        n_list.sort(key=lambda x: x["name"].lower())
        for n in n_list:
            sort_nodes(n["children"])
            
    sort_nodes(roots)
    
    return jsonify(roots)