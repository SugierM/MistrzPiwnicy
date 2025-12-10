from flask import Blueprint, jsonify, render_template, request, Response, stream_with_context
from utils.file_ops import load_json
import os
import requests

bp = Blueprint("vis", __name__)
STATE_FILE = "data/state.json"

@bp.route("/vis")
def vis_page():
    """Render the visualization page."""
    return render_template("vis.html")

@bp.route("/vis/state")
def get_vis_state():
    """Return the current state for the visualization page to poll."""
    state = load_json(STATE_FILE)
    return jsonify(state)

@bp.route("/vis/proxy_image")
def proxy_image():
    """
    Proxies an image from an external URL (e.g., Google Drive) to bypass CORS and redirect issues.
    Usage: /vis/proxy_image?url=<ENCODED_URL>
    """
    image_url = request.args.get('url')
    if not image_url:
        return "Missing URL", 400

    try:
        # Use stream=True to avoid loading the whole file into memory
        # allow_redirects=True is crucial for Drive links (uc?export=view -> redirects to content)
        req = requests.get(image_url, stream=True, allow_redirects=True, timeout=10)

        # Basic error check
        if req.status_code != 200:
            return f"Error fetching image: {req.status_code}", 502

        # Create a generator to stream the content
        def generate():
            for chunk in req.iter_content(chunk_size=4096):
                yield chunk

        # Pass along the content type (e.g. image/jpeg)
        content_type = req.headers.get('Content-Type', 'application/octet-stream')
        
        return Response(stream_with_context(generate()), content_type=content_type)
        
    except Exception as e:
        print(f"Proxy error: {e}")
        return str(e), 500