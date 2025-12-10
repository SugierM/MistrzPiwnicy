from flask import Blueprint, request, jsonify
from werkzeug.utils import secure_filename
import os
from utils.file_ops import load_state, save_state, ensure_node
from utils.schema import Metadata, CampaignState
from utils.drive import get_drive_service
from googleapiclient.http import MediaFileUpload

bp = Blueprint("locations", __name__)
STATE_PATH = "data/state.json"
UPLOAD_FOLDER_ID = "<DRIVE_FOLDER_ID>"  # <-- folder na Drive, np. ID kampanii


@bp.route("/tree", methods=["GET"])
def get_tree():
    """Zwraca drzewo całej kampanii (lokalnie z state.json)"""
    state = load_state(STATE_PATH)
    tree = build_tree_from_state(state)
    return jsonify(tree)


def build_tree_from_state(state):
    """Buduje drzewo katalogów z metadanych"""
    nodes = state.root
    tree = {}

    def get_children(base_path="/"):
        current = state.get(base_path)
        children = []
        for sub in current.sub:
            sub_path = f"{base_path.rstrip('/')}/{sub}" if base_path != "/" else f"/{sub}"
            children.append({
                "name": sub,
                "path": sub_path,
                "children": get_children(sub_path)
            })
        return children

    root = state.get("/")
    tree = {
        "name": root.name,
        "path": "/",
        "children": get_children("/")
    }
    return tree


@bp.route("/upload", methods=["POST"])
def upload_asset():
    """Upload pliku (np. obrazu) do Google Drive"""
    if "file" not in request.files:
        return jsonify({"error": "Brak pliku do przesłania"}), 400
    
    file = request.files["file"]
    if file.filename == "":
        return jsonify({"error": "Nieprawidłowa nazwa pliku"}), 400
    
    filename = secure_filename(file.filename)
    temp_path = os.path.join("data", filename)
    file.save(temp_path)

    service = get_drive_service()
    file_metadata = {
        "name": filename,
        "parents": [UPLOAD_FOLDER_ID],
    }

    media = MediaFileUpload(temp_path, resumable=True, mimetype="image/jpeg")

    upload = (
        service.files()
        .create(body=file_metadata, media_body=media, fields="id, webViewLink, webContentLink")
        .execute()
    )

    # sprzątanie lokalnego pliku tymczasowego
    os.remove(temp_path)

    return jsonify({"ok": True, "file_id": upload["id"], "link": upload["webContentLink"]})