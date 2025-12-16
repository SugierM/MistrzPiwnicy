# app.py
from flask import Flask, render_template, request, session, redirect, url_for, flash
from routes.admin import bp as admin_bp
from routes.locations import bp as locations_bp
from routes.vis import bp as vis_bp
from routes.drive import bp as drive_bp
from routes.map_tool import bp as map_tool_bp
import os
import json
from dotenv import load_dotenv
from pathlib import Path

load_dotenv()

app = Flask(
    __name__,
    template_folder="templates",
    static_folder="static",
)

# Secret key for session management
app.secret_key = os.getenv("SECRET_KEY", "dev_secret_key_123")

app.register_blueprint(drive_bp, url_prefix="/api")
app.register_blueprint(admin_bp)
app.register_blueprint(locations_bp, url_prefix="/api")
app.register_blueprint(vis_bp)
app.register_blueprint(map_tool_bp)

def load_admin_password():
    try:
        if os.path.exists("admin.json"):
            with open("admin.json", "r") as f:
                data = json.load(f)
                return data.get("password")
    except Exception as e:
        print(f"Error loading admin password: {e}")
    return "admin" # Default fallbak

@app.before_request
def require_login():
    # Public routes that don't require login
    allowed_routes = [
        'login', 
        'static', 
        'vis.index', 
        'map_tool.map_editor', # Map checks inside route for admin vs guest
        'site_rules' # If exists
    ]
    
    # Check if request is for static file or allowed route
    if request.endpoint and (
        request.endpoint in allowed_routes or 
        request.endpoint.startswith('static') or 
        request.endpoint.startswith('vis.') or
        (request.endpoint == 'map_tool.sync_map' and request.method == 'GET') # Sync GET is public
    ):
        return None

    # Check if logged in
    if not session.get('logged_in'):
        return redirect(url_for('login', next=request.url))

@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        password = request.form.get("password")
        stored_password = load_admin_password()
        
        if password == stored_password:
            session['logged_in'] = True
            next_url = request.args.get("next")
            return redirect(next_url or url_for('index'))
        else:
            return render_template("login.html", error="Nieprawidłowe hasło")
            
    return render_template("login.html")

@app.route("/logout")
def logout():
    session.clear()
    return redirect(url_for('login'))

@app.route("/")
def index():
    """Strona powitalna w stylu aplikacji"""
    return render_template("admin/dashboard.html", welcome=True)


REQUIRED_ASSET_DIRS = [
    Path("static/assets"),
    Path("static/assets/characters"),
    Path("static/assets/map"),
    Path("static/assets/map/houses"),
    Path("static/assets/map/landmarks"),
    Path("static/assets/map/nature"),
]

def ensure_asset_dirs() -> None:
    for d in REQUIRED_ASSET_DIRS:
        d.mkdir(parents=True, exist_ok=True)

@app.errorhandler(404)
def not_found(e):
    return render_template("error.html", code=404, message="Strona nie została znaleziona"), 404

@app.errorhandler(500)
def internal_error(e):
    return render_template("error.html", code=500, message="Błąd serwera"), 500

if __name__ == "__main__":
    os.makedirs("data", exist_ok=True)
    ensure_asset_dirs()
    app.run(host="0.0.0.0", port=5000, debug=True)