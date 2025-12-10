# app.py
from flask import Flask, render_template
from routes.admin import bp as admin_bp
from routes.locations import bp as locations_bp
from routes.vis import bp as vis_bp
from routes.drive import bp as drive_bp
import os
from dotenv import load_dotenv

load_dotenv()

app = Flask(
    __name__,
    template_folder="templates",
    static_folder="static",
)


app.register_blueprint(drive_bp, url_prefix="/api")
app.register_blueprint(admin_bp)
app.register_blueprint(locations_bp, url_prefix="/api")
app.register_blueprint(vis_bp)

@app.route("/")
def index():
    """Strona powitalna w stylu aplikacji"""
    return render_template("admin/dashboard.html", welcome=True)

@app.errorhandler(404)
def not_found(e):
    return render_template("error.html", code=404, message="Strona nie została znaleziona"), 404

@app.errorhandler(500)
def internal_error(e):
    return render_template("error.html", code=500, message="Błąd serwera"), 500

if __name__ == "__main__":
    os.makedirs("data", exist_ok=True)
    app.run(host="0.0.0.0", port=5000, debug=True)