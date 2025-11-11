# backend/app.py
from flask import Flask, send_from_directory, jsonify
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
import click
import sys
import os
from pathlib import Path

# If this module is executed directly (python backend/app.py), the
# import system will set sys.path[0] to the `backend/` directory which
# prevents importing the `backend` package using absolute imports
# like `backend.config`. Insert the project root into sys.path when
# running as a script so absolute imports work.
if __package__ is None:
    project_root = str(Path(__file__).resolve().parent.parent)
    if project_root not in sys.path:
        sys.path.insert(0, project_root)

from backend.config import Config
from backend.database import db

def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)
    CORS(app)

    db.init_app(app)
    
    # Import models here to register them with SQLAlchemy before creating tables
    # This must happen after db.init_app() but before db.create_all()
    from backend import models
    
    # Create all database tables
    with app.app_context():
        db.create_all()
    
    # Initialize rate limiter
    limiter = Limiter(
        app=app,
        key_func=get_remote_address,
        default_limits=["200 per day", "50 per hour"],
        storage_uri="memory://",  # Use in-memory storage (use Redis in production)
        headers_enabled=True
    )
    # Make limiter available globally for blueprints
    app.extensions['limiter'] = limiter

    from backend.routes.employees import bp as employees_bp
    from backend.routes.timeclock import bp as timeclock_bp
    from backend.routes.inventory import bp as inventory_bp
    from backend.routes.eod import bp as eod_bp
    from backend.routes.stores import bp as stores_bp
    from backend.routes.face import bp as face_bp
    from backend.routes.inventory_history import bp as inventory_history_bp
    from backend.routes.managers import bp as managers_bp

    # Register blueprints - order matters! More specific routes first
    app.register_blueprint(inventory_history_bp, url_prefix="/api/inventory/history")
    app.register_blueprint(employees_bp, url_prefix="/api/employees")
    app.register_blueprint(timeclock_bp, url_prefix="/api/timeclock")
    app.register_blueprint(inventory_bp, url_prefix="/api/inventory")
    app.register_blueprint(eod_bp, url_prefix="/api/eod")
    app.register_blueprint(stores_bp, url_prefix="/api/stores")
    app.register_blueprint(face_bp, url_prefix="/api/face")
    app.register_blueprint(managers_bp, url_prefix="/api/managers")
    
    # Apply rate limiting to login endpoints
    # Flask-Limiter will automatically apply rate limits based on decorators
    try:
        limiter.limit("5 per minute")(stores_bp.view_functions['store_login'])
        limiter.limit("5 per minute")(stores_bp.view_functions['manager_login'])
        limiter.limit("5 per minute")(managers_bp.view_functions['super_admin_login'])
    except (KeyError, AttributeError):
        # Endpoints not found or limiter not available - this is okay during development
        pass

    @app.get("/api/health")
    def health():
        return {"status": "ok"}
    
    # Debug routes removed for production security
    # To enable debug routes, only do so in development environment
    import os
    if os.getenv("FLASK_ENV") == "development":
        @app.get("/api/debug/routes")
        def debug_routes():
            routes = []
            for rule in app.url_map.iter_rules():
                routes.append({
                    "endpoint": rule.endpoint,
                    "methods": list(rule.methods),
                    "rule": str(rule)
                })
            return jsonify({"routes": routes})

    # Project root path
    project_root = Path(__file__).resolve().parent.parent
    frontend_pages = project_root / "frontend" / "pages"
    frontend_static = project_root / "frontend" / "static"

    # Serve index.html from frontend/pages
    @app.get("/")
    def serve_index():
        return send_from_directory(frontend_pages, "index.html")

    # Serve HTML pages from frontend/pages
    @app.get("/<path:page>.html")
    def serve_page(page):
        return send_from_directory(frontend_pages, f"{page}.html")

    # Serve static CSS files
    @app.get("/static/css/<path:filename>")
    def serve_css(filename):
        return send_from_directory(frontend_static / "css", filename)

    # Serve static JS files
    @app.get("/static/js/<path:filename>")
    def serve_js(filename):
        return send_from_directory(frontend_static / "js", filename)

    # Fallback: serve any other files from frontend/pages (for backward compatibility)
    # Exclude API routes from catch-all
    @app.get("/<path:path>")
    def serve_static(path):
        # Don't interfere with API routes
        if path.startswith('api/'):
            from flask import abort
            abort(404)
        # Try frontend/pages first (for any remaining HTML)
        if path.endswith('.html'):
            return send_from_directory(frontend_pages, path)
        # Otherwise, try static folders
        if path.startswith('static/'):
            return send_from_directory(frontend_static, path[7:])  # Remove 'static/' prefix
        # Fallback to frontend/pages
        return send_from_directory(frontend_pages, path)

    # CLI command to seed default stores
    @app.cli.command("seed-stores")
    def seed_stores_command():
        from backend.models import Store, add_default_inventory_to_store, hash_password
        stores_count = Store.query.count()
        if stores_count == 0:
            store1 = Store(
                name="Lawrence",
                username="lawrence",
                password=hash_password("lawrence123"),
                total_boxes=0,
                manager_username=None
            )
            store2 = Store(
                name="Oakville",
                username="oakville",
                password=hash_password("oakville123"),
                total_boxes=0,
                manager_username=None
            )
            db.session.add(store1)
            db.session.add(store2)
            db.session.commit()
            
            # Add default inventory items for each store
            count1 = add_default_inventory_to_store("Lawrence")
            count2 = add_default_inventory_to_store("Oakville")
            
            click.echo(f"✓ Seeded default stores with inventory:")
            click.echo(f"  - Lawrence: {count1} items")
            click.echo(f"  - Oakville: {count2} items")
        else:
            click.echo("Stores already exist; skipping seed")
    
    # CLI command to add default inventory to existing stores
    @app.cli.command("add-inventory")
    @click.argument("store_name")
    def add_inventory_command(store_name):
        """Add default inventory items to a specific store"""
        from backend.models import Store, add_default_inventory_to_store
        
        store = Store.query.filter_by(name=store_name).first()
        if not store:
            click.echo(f"❌ Error: Store '{store_name}' not found")
            click.echo("\nAvailable stores:")
            for s in Store.query.all():
                click.echo(f"  - {s.name}")
            return
        
        count = add_default_inventory_to_store(store_name)
        click.echo(f"✓ Added {count} new inventory items to store '{store_name}'")
        
        # Show total inventory count
        from backend.models import Inventory
        total = Inventory.query.filter_by(store_id=store_name).count()
        click.echo(f"  Total inventory items: {total}")
    
    # CLI command to show inventory count for all stores
    @app.cli.command("check-inventory")
    def check_inventory_command():
        """Show inventory item count for all stores"""
        from backend.models import Store, Inventory
        
        stores = Store.query.all()
        if not stores:
            click.echo("No stores found")
            return
        
        click.echo("\n📦 Inventory Status:")
        click.echo("-" * 40)
        for store in stores:
            count = Inventory.query.filter_by(store_id=store.name).count()
            click.echo(f"{store.name:20} {count:3} items")
        click.echo("-" * 40)

    return app

if __name__ == "__main__":
    app = create_app()
    # Only run in debug mode if explicitly set in environment
    debug_mode = os.getenv("FLASK_DEBUG", "False").lower() == "true"
    app.run(debug=debug_mode)

