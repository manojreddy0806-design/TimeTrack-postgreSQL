# backend/routes/managers.py
from flask import Blueprint, request, jsonify
from ..models import get_all_managers, create_manager, update_manager, get_manager_by_username
from ..config import Config
from ..auth import generate_token, validate_password_strength, require_auth

bp = Blueprint("managers", __name__)

@bp.get("/")
@require_auth(roles=['super-admin'])
def list_managers():
    """List all managers (super-admin only)"""
    managers = get_all_managers()
    return jsonify(managers)

@bp.post("/")
@require_auth(roles=['super-admin'])
def add_manager():
    """Create a new manager (super-admin only)"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "Request body is required"}), 400
        
        name = data.get("name")
        if not name:
            return jsonify({"error": "Manager name is required"}), 400
        if len(name) > 100:
            return jsonify({"error": "Manager name is too long (max 100 characters)"}), 400
        
        username = data.get("username")
        if not username:
            return jsonify({"error": "Username is required"}), 400
        if len(username) > 50:
            return jsonify({"error": "Username is too long (max 50 characters)"}), 400
        
        password = data.get("password")
        if not password:
            return jsonify({"error": "Password is required"}), 400
        if len(password) > 200:
            return jsonify({"error": "Password is too long (max 200 characters)"}), 400
        
        # Validate password strength
        is_valid, error_msg = validate_password_strength(password)
        if not is_valid:
            return jsonify({"error": error_msg}), 400
        
        manager_info = create_manager(name, username, password)
        return jsonify(manager_info), 201
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": f"Failed to create manager: {str(e)}"}), 500

@bp.put("/<username>")
@require_auth(roles=['super-admin'])
def edit_manager(username):
    """Update an existing manager (super-admin only)"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "Request body is required"}), 400
        
        name = data.get("name")
        new_username = data.get("username")
        password = data.get("password")
        
        # Validate inputs
        if name is not None and len(name) > 100:
            return jsonify({"error": "Manager name is too long (max 100 characters)"}), 400
        if new_username is not None and len(new_username) > 50:
            return jsonify({"error": "Username is too long (max 50 characters)"}), 400
        if password is not None:
            if len(password) > 200:
                return jsonify({"error": "Password is too long (max 200 characters)"}), 400
            # Validate password strength
            is_valid, error_msg = validate_password_strength(password)
            if not is_valid:
                return jsonify({"error": error_msg}), 400
        
        updated_manager = update_manager(username, name=name, new_username=new_username, password=password)
        return jsonify(updated_manager), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": f"Failed to update manager: {str(e)}"}), 500

@bp.get("/<username>")
@require_auth(roles=['super-admin'])
def get_manager(username):
    """Get a specific manager by username (super-admin only)"""
    manager = get_manager_by_username(username)
    if not manager:
        return jsonify({"error": "Manager not found"}), 404
    # Don't return password
    manager.pop("password", None)
    return jsonify(manager)

@bp.post("/super-admin/login")
def super_admin_login():
    """Super-admin login endpoint"""
    data = request.get_json()
    username = data.get("username", "").strip()
    password = data.get("password", "")
    
    if not username or not password:
        return jsonify({"error": "Username and password required"}), 400
    
    # Check super-admin credentials from config
    if username == Config.SUPER_ADMIN_USERNAME and password == Config.SUPER_ADMIN_PASSWORD:
        # Generate JWT token
        token = generate_token({
            "role": "super-admin",
            "name": "Super Admin",
            "username": username
        })
        return jsonify({
            "role": "super-admin",
            "name": "Super Admin",
            "username": username,
            "token": token
        }), 200
    else:
        return jsonify({"error": "Invalid credentials"}), 401

