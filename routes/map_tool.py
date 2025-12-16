from flask import Blueprint, render_template, jsonify, request, send_file, session
import os
import json
import base64
from utils.drive import get_file_content, get_drive_service
from routes.drive import get_tree as get_drive_tree, get_local_folders, save_local_folders

bp = Blueprint("map_tool", __name__)

ASSETS_DIR = "static/assets"
MAP_ASSETS_DIR = os.path.join(ASSETS_DIR, "map")
CHARACTERS_DIR = os.path.join(ASSETS_DIR, "characters")
SAVED_MAPS_DIR = "data/maps"

# Global state for map synchronization
# In-memory storage. Reset on server restart.
CURRENT_MAP_STATE = {
    "data": None,
    "timestamp": 0
}

# Ensure directories exist
os.makedirs(SAVED_MAPS_DIR, exist_ok=True)
os.makedirs(MAP_ASSETS_DIR, exist_ok=True)
os.makedirs(CHARACTERS_DIR, exist_ok=True)

@bp.route("/map")
def map_editor():
    """Renders the standalone map editor."""
    is_admin = session.get('logged_in', False)
    return render_template("map.html", is_admin=is_admin)

@bp.route("/api/map/sync", methods=["GET", "POST"])
def sync_map():
    """Handles map synchronization between Admin and Guests."""
    global CURRENT_MAP_STATE
    
    if request.method == "POST":
        # Only Admin can push updates
        if not session.get('logged_in'):
            return jsonify({"error": "Unauthorized"}), 403
            
        data = request.json
        CURRENT_MAP_STATE["data"] = data
        CURRENT_MAP_STATE["timestamp"] = os.times().system # Simple timestamp
        return jsonify({"status": "success"})
    
    else: # GET
        # Guests can pull updates
        return jsonify(CURRENT_MAP_STATE)

@bp.route("/api/map/assets")
def list_assets():
    """Lists available map assets organized by category."""
    assets = {}
    
    # List subdirectories in map assets
    for category in os.listdir(MAP_ASSETS_DIR):
        cat_path = os.path.join(MAP_ASSETS_DIR, category)
        if os.path.isdir(cat_path):
            files = [
                f"/static/assets/map/{category}/{f}" 
                for f in os.listdir(cat_path) 
                if f.lower().endswith(('.png', '.jpg', '.jpeg', '.webp'))
            ]
            assets[category] = files
            
    return jsonify(assets)

@bp.route("/api/map/characters")
def list_characters():
    """Lists available character tokens."""
    files = [
        f"/static/assets/characters/{f}" 
        for f in os.listdir(CHARACTERS_DIR) 
        if f.lower().endswith(('.png', '.jpg', '.jpeg', '.webp'))
    ]
    return jsonify(files)

@bp.route("/api/map/save", methods=["POST"])
def save_map():
    """Saves the map image and metadata."""
    data = request.json
    image_data = data.get("image")  # Base64 string
    metadata = data.get("metadata") # Scale, grid info, etc.
    filename = data.get("filename", "untitled_map")
    
    if not image_data:
        return jsonify({"error": "No image data provided"}), 400
        
    # Remove header of base64 string
    if "," in image_data:
        header, encoded = image_data.split(",", 1)
        data_content = base64.b64decode(encoded)
    else:
        data_content = base64.b64decode(image_data)
        
    # Save Image
    clean_filename = "".join([c for c in filename if c.isalpha() or c.isdigit() or c in (' ', '-', '_')]).strip()
    image_path = os.path.join(SAVED_MAPS_DIR, f"{clean_filename}.png")
    
    with open(image_path, "wb") as f:
        f.write(data_content)
        
    # Save Metadata
    meta_path = os.path.join(SAVED_MAPS_DIR, f"{clean_filename}_meta.json")
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)
        
    return jsonify({"status": "success", "path": image_path})

# ===================== DRIVE IMPORT LOGIC =====================

@bp.route("/api/map/drive-list", methods=["GET"])
def list_drive_maps():
    """Scans the local folder cache (from drive.py logic) for entities with type='MAP'."""
    # We might need to iterate over all files we know about. 
    # Since `local_folders.json` only stores folders, we might need a better source.
    # However, `drive.py`'s `get_tree` rebuilds structure. 
    # Let's rely on `local_npcs.json` / `local_fractions.json` pattern, 
    # but currently maps might not be in a dedicated local registry.
    
    # Strategy: Fetch ALL files from Drive (slow) or use `routes/drive.py` existing logic?
    # The user said: "load maps from entities that have in their metadata_NAME.json type: 'MAP'"
    # `drive.py` lists entities in a folder. 
    
    # We will iterate through ALL folders in `local_folders.json` (if we have IDs) and list their content? No, that's too many requests.
    # BETTER APPROACH: The User typically navigates the tree. 
    # BUT the request implies a specific list. 
    # Let's implement a search for type=MAP in the drive.
    
    service = get_drive_service()
    query = "name contains 'metadata_' and name contains '.json' and trashed = false"
    
    # This might be heavy if many files, but it's the most reliable way to find ALL maps.
    results = service.files().list(q=query, fields="files(id, name, parents)").execute()
    files = results.get("files", [])
    
    maps = []
    for f in files:
        # We need to peek inside to see if type="MAP". 
        # Downloading every metadata file is too slow.
        # OPTIMIZATION: Assume the user names them properly or we just list them and let user click?
        # No, we must filter.
        # Let's try to search inside content? Drive API supports `fullText contains 'MAP'`.
        pass

    # Revert to: User selects a folder in standard UI -> we see entities.
    # BUT, for this specific endpoint, let's just use the `drive.py` helper to list a specific folder if provided, 
    # OR provide a flattened list of everything we've cached?
    
    # Let's stick to what `drive.py` does: `list_drive` returns entities.
    # We will duplicate some logic or import?
    # `drive.list_drive` requires a `folder_id`.
    
    # Special search endpoint for maps:
    try:
        query = "mimeType = 'application/json' and name contains 'metadata_' and trashed = false"
        # We can't filter by content efficiently without downloading.
        # So we will fetch them.
        
        results = service.files().list(q=query, fields="files(id, name, parents)", pageSize=100).execute()
        files = results.get("files", [])
        
        # We have to check content for type="MAP"
        # To avoid downloading ALL 100 files, we rely on the name? No.
        # We'll download them. It's metadata, it's small.
        
        valid_maps = []
        for f in files:
            content = get_file_content(f['id'])
            if content:
                try:
                    data = json.loads(content)
                    if data.get("type", "").upper() == "MAP":
                        valid_maps.append({
                            "id": f['id'],
                            "name": data.get("name", f["name"]),
                            "image": data.get("image", ""),
                            "metadata_id": f['id'] # The ID of the JSON file
                        })
                except:
                    continue
                    
        return jsonify(valid_maps)
    except Exception as e:
        print(f"Error listing maps: {e}")
        return jsonify({"error": str(e)}), 500

@bp.route("/api/map/import-drive", methods=["POST"])
def import_drive_map():
    """Downloads the map image and its metadata from Drive."""
    data = request.json
    metadata_id = data.get("metadata_id")
    
    if not metadata_id:
        return jsonify({"error": "Missing metadata_id"}), 400
        
    # 1. Get Metadata
    content = get_file_content(metadata_id)
    if not content:
        return jsonify({"error": "Metadata not found"}), 404
    
    meta_json = json.loads(content)
    image_drive_link = meta_json.get("image", "")
    
    # 2. Extract File ID from the image link
    # Link usually: https://drive.google.com/uc?export=view&id=FILE_ID
    # or view?usp=sharing etc.
    if "id=" in image_drive_link:
        image_id = image_drive_link.split("id=")[1].split("&")[0]
    elif "/d/" in image_drive_link: # viewer link
        image_id = image_drive_link.split("/d/")[1].split("/")[0]
    else:
        return jsonify({"error": "Could not parse image ID from link"}), 400
        
    # 3. Download Image
    service = get_drive_service()
    try:
        image_data = service.files().get_media(fileId=image_id).execute()
    except Exception as e:
        return jsonify({"error": f"Failed to download image: {e}"}), 500
        
    # 4. Save Locally
    map_name = meta_json.get("name", "imported_map")
    clean_filename = "".join([c for c in map_name if c.isalpha() or c.isdigit() or c in (' ', '-', '_')]).strip()
    
    local_image_path = os.path.join(SAVED_MAPS_DIR, f"{clean_filename}.png")
    local_meta_path = os.path.join(SAVED_MAPS_DIR, f"{clean_filename}_meta.json")
    
    with open(local_image_path, "wb") as f:
        f.write(image_data)
        
    # Update metadata with local path?? 
    # User said: "load maps from entities... dont change them on google drive... store in proper folder"
    # We store the original metadata plus maybe extra MapTool specific data if we have it.
    
    with open(local_meta_path, "w", encoding="utf-8") as f:
        json.dump(meta_json, f, indent=2)
        
    return jsonify({
        "status": "success", 
        "local_path": f"/data/maps/{clean_filename}.png", # accessible via static route if configured or need a new route
        "metadata": meta_json
    })

# Need a route to serve saved maps if they are in 'data/maps' which is NOT static
@bp.route("/data/maps/<path:filename>")
def serve_map_image(filename):
    return send_file(os.path.join(os.getcwd(), SAVED_MAPS_DIR, filename))
