# backend/routes/inventory_history.py
from flask import Blueprint, request, jsonify
from datetime import datetime
from backend.database import db
from backend.models import Inventory, InventoryHistory

bp = Blueprint("inventory_history", __name__)

@bp.get("/")
def list_inventory_history():
    """Get inventory history snapshots for a store"""
    store_id = request.args.get("store_id")
    
    if not store_id:
        return jsonify({"error": "store_id is required"}), 400
    
    # Get all snapshots for this store, sorted by date (newest first)
    snapshots = InventoryHistory.query.filter_by(store_id=store_id).order_by(InventoryHistory.snapshot_date.desc()).all()
    
    return jsonify([snapshot.to_dict() for snapshot in snapshots])

@bp.post("/snapshot")
def create_inventory_snapshot():
    """Create a new inventory snapshot for a store"""
    data = request.get_json()
    
    store_id = data.get("store_id")
    snapshot_date = data.get("snapshot_date")  # Should be YYYY-MM-DD format (device's local date)
    today_date = data.get("today_date")  # Today's date from device's local time
    
    if not store_id:
        return jsonify({"error": "store_id is required"}), 400
    
    # Get current inventory for this store
    items = Inventory.query.filter_by(store_id=store_id).all()
    
    # Parse snapshot date - use the date string directly (no timezone conversion)
    if snapshot_date:
        try:
            # If snapshot_date is just YYYY-MM-DD, parse it directly
            if len(snapshot_date) == 10:  # YYYY-MM-DD format
                date_parts = snapshot_date.split('-')
                snapshot_dt = datetime(int(date_parts[0]), int(date_parts[1]), int(date_parts[2]), 0, 0, 0)
            else:
                snapshot_dt = datetime.fromisoformat(snapshot_date.replace('Z', '+00:00'))
                # Normalize to midnight
                snapshot_dt = datetime(snapshot_dt.year, snapshot_dt.month, snapshot_dt.day, 0, 0, 0)
        except Exception as parse_err:
            print(f"Error parsing snapshot_date '{snapshot_date}': {parse_err}")
            # Fallback: use today_date if provided, otherwise use current date
            if today_date and len(today_date) == 10:
                date_parts = today_date.split('-')
                snapshot_dt = datetime(int(date_parts[0]), int(date_parts[1]), int(date_parts[2]), 0, 0, 0)
            else:
                snapshot_dt = datetime.now()  # Use local server time as fallback
                snapshot_dt = datetime(snapshot_dt.year, snapshot_dt.month, snapshot_dt.day, 0, 0, 0)
    else:
        # Use today_date if provided, otherwise use current date
        if today_date and len(today_date) == 10:
            date_parts = today_date.split('-')
            snapshot_dt = datetime(int(date_parts[0]), int(date_parts[1]), int(date_parts[2]), 0, 0, 0)
        else:
            snapshot_dt = datetime.now()  # Use local server time as fallback
            snapshot_dt = datetime(snapshot_dt.year, snapshot_dt.month, snapshot_dt.day, 0, 0, 0)
    
    # Normalize item field names for consistency
    normalized_items = []
    for item in items:
        normalized = {
            "sku": item.sku,
            "name": item.name,
            "quantity": item.quantity,
            "price": 0
        }
        normalized_items.append(normalized)
    
    # Get today's date from device's local time for comparison
    if today_date and len(today_date) == 10:
        try:
            date_parts = today_date.split('-')
            today_dt = datetime(int(date_parts[0]), int(date_parts[1]), int(date_parts[2]), 0, 0, 0)
        except:
            # Fallback to server local time
            today_dt = datetime.now()
            today_dt = datetime(today_dt.year, today_dt.month, today_dt.day, 0, 0, 0)
    else:
        # Fallback to server local time if today_date not provided
        today_dt = datetime.now()
        today_dt = datetime(today_dt.year, today_dt.month, today_dt.day, 0, 0, 0)
    
    # Check if snapshot already exists for this date
    existing = InventoryHistory.query.filter_by(store_id=store_id, snapshot_date=snapshot_dt).first()
    
    if existing:
        # Only allow updating today's snapshot - prevent editing past days
        if snapshot_dt < today_dt:
            return jsonify({
                "error": f"Cannot update inventory history for past dates. Snapshot date ({snapshot_dt.date()}) is before today ({today_dt.date()})."
            }), 403
        
        # Update existing snapshot (only allowed for today)
        existing.set_items(normalized_items)
        existing.updated_at = datetime.now()
        db.session.commit()
        
        return jsonify({"message": "Snapshot updated", "id": str(existing.id)}), 200
    else:
        # Prevent creating snapshots for past dates
        if snapshot_dt < today_dt:
            return jsonify({
                "error": f"Cannot create inventory snapshot for past dates. Snapshot date ({snapshot_dt.date()}) is before today ({today_dt.date()})."
            }), 403
        
        # Create new snapshot (only for today or future dates)
        snapshot = InventoryHistory(
            store_id=store_id,
            snapshot_date=snapshot_dt
        )
        snapshot.set_items(normalized_items)
        
        db.session.add(snapshot)
        db.session.commit()
        
        return jsonify({"message": "Snapshot created", "id": str(snapshot.id)}), 201
