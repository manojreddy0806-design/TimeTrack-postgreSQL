# backend/routes/inventory.py
from flask import Blueprint, request, jsonify, g
from ..models import get_inventory, add_inventory_item, update_inventory_item, delete_inventory_item
from ..auth import require_auth

bp = Blueprint("inventory", __name__)

@bp.route("/", methods=["GET"])
@require_auth()
def list_inventory():
    tenant_id = g.tenant_id
    store_id = request.args.get("store_id")
    items = get_inventory(tenant_id=tenant_id, store_id=store_id)
    return jsonify(items)

@bp.route("/", methods=["POST"])
@require_auth()
def add_item():
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "Request body is required"}), 400
        
        store_id = data.get("store_id")
        sku = data.get("sku")
        name = data.get("name")
        
        if not store_id:
            return jsonify({"error": "store_id is required"}), 400
        if not sku or not sku.strip():
            return jsonify({"error": "SKU is required"}), 400
        if not name or not name.strip():
            return jsonify({"error": "Item name is required"}), 400
        
        quantity = data.get("quantity", 0)
        try:
            quantity = int(quantity) if quantity is not None else 0
            if quantity < 0:
                return jsonify({"error": "Quantity must be non-negative"}), 400
        except (ValueError, TypeError):
            return jsonify({"error": "Quantity must be a valid integer"}), 400
        
        tenant_id = g.tenant_id
        item_id = add_inventory_item(
            tenant_id=tenant_id,
            store_id=store_id,
            sku=sku.strip(),
            name=name.strip(),
            quantity=quantity
        )
        return jsonify({"id": item_id}), 201
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": f"Failed to add inventory item: {str(e)}"}), 500

@bp.route("/", methods=["PUT"], strict_slashes=False)
@require_auth()
def update_item():
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "Request body is required"}), 400
        tenant_id = g.tenant_id
        store_id = data.get("store_id")
        item_id = data.get("_id") or data.get("id")  # Support both _id and id
        sku = data.get("sku")  # Old SKU for finding the item (used if item_id not provided)
        quantity = data.get("quantity")
        name = data.get("name")
        new_sku = data.get("new_sku")
        
        # Require either item_id OR (store_id and sku)
        if not item_id and (not store_id or not sku):
            return jsonify({"error": "Either _id or both store_id and sku are required"}), 400
        
        success = update_inventory_item(tenant_id=tenant_id, store_id=store_id, sku=sku, item_id=item_id, quantity=quantity, name=name, new_sku=new_sku)
        if success:
            return jsonify({"message": "Inventory item updated successfully"}), 200
        else:
            # Check if it's because new SKU already exists
            if new_sku:
                from ..models import Inventory
                query = Inventory.query.filter_by(tenant_id=tenant_id, store_id=store_id, sku=new_sku)
                if item_id:
                    try:
                        query = query.filter(Inventory.id != int(item_id))
                    except (ValueError, TypeError):
                        return jsonify({"error": "Invalid item_id format"}), 400
                existing = query.first()
                if existing:
                    return jsonify({"error": f"SKU '{new_sku}' already exists for this store"}), 409
            return jsonify({"error": "Inventory item not found or update failed"}), 404
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": f"Failed to update inventory item: {str(e)}"}), 500

@bp.route("/", methods=["DELETE"])
@require_auth()
def remove_item():
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "Request body is required"}), 400
        
        tenant_id = g.tenant_id
        store_id = data.get("store_id")
        sku = data.get("sku")
        
        if not store_id or not sku:
            return jsonify({"error": "store_id and sku are required"}), 400
        
        success = delete_inventory_item(tenant_id=tenant_id, store_id=store_id, sku=sku)
        if success:
            return jsonify({"message": "Inventory item deleted successfully"}), 200
        else:
            return jsonify({"error": "Inventory item not found"}), 404
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": f"Failed to delete inventory item: {str(e)}"}), 500
