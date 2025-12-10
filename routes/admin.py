# routes/admin.py
from flask import Blueprint, render_template
import os

bp = Blueprint(
    "admin",
    __name__,
    template_folder=os.path.join(os.path.dirname(__file__), "../templates"),
    static_folder=os.path.join(os.path.dirname(__file__), "../static"),
)

@bp.route("/admin/dashboard")
def dashboard():
    return render_template("admin/dashboard.html")

@bp.route("/admin/locations")
def locations():
    return render_template("admin/locations.html")

@bp.route("/admin/npcs")
def npcs():
    return render_template("admin/npcs.html")

@bp.route("/admin/fractions")
def factions():
    return render_template("admin/fractions.html")