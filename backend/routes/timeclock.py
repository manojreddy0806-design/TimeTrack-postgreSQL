# backend/routes/timeclock.py
from flask import Blueprint, request, jsonify
from datetime import datetime, timedelta
from backend.database import db
from backend.models import Employee, TimeClock
from backend.services.face_service import (
    find_best_match,
    validate_face_descriptor,
    compress_image,
    euclidean_distance
)

bp = Blueprint("timeclock", __name__)


@bp.post("/clock-in")
def clock_in_route():
    """Legacy clock-in endpoint (kept for compatibility)"""
    data = request.get_json()
    employee_id = data.get("employee_id")
    
    entry = TimeClock(
        employee_id=int(employee_id),
        clock_in=datetime.utcnow(),
        clock_out=None
    )
    db.session.add(entry)
    db.session.commit()
    
    return jsonify({"entry_id": str(entry.id)}), 201


@bp.post("/clock-out")
def clock_out_route():
    """Legacy clock-out endpoint (kept for compatibility)"""
    data = request.get_json()
    entry_id = data.get("entry_id")
    
    try:
        entry = TimeClock.query.get(int(entry_id))
        if entry:
            entry.clock_out = datetime.utcnow()
            db.session.commit()
            return jsonify({"ok": True})
        else:
            return jsonify({"error": "Invalid or already clocked out entry"}), 400
    except:
        return jsonify({"error": "Invalid entry_id format"}), 400


@bp.post("/clock-in-face")
def clock_in_face():
    """
    Clock in using face recognition.
    
    Request JSON:
    {
        "face_descriptor": [0.123, -0.456, ...],
        "face_image": "data:image/jpeg;base64,...",
        "store_id": "Lawrence"
    }
    """
    try:
        data = request.get_json()
        
        face_descriptor = data.get("face_descriptor")
        face_image = data.get("face_image")
        store_id = data.get("store_id")
        
        if not face_descriptor:
            return jsonify({"error": "face_descriptor is required"}), 400
        
        # Validate face descriptor
        if not validate_face_descriptor(face_descriptor):
            return jsonify({"error": "Invalid face descriptor format"}), 400
        
        # Get all employees with registered faces
        registered_employees = Employee.query.filter_by(face_registered=True).all()
        
        if not registered_employees:
            return jsonify({
                "success": False,
                "error": "No employees with registered faces found. Please register your face first."
            }), 404
        
        # Convert to dict format for find_best_match
        employee_dicts = []
        for emp in registered_employees:
            emp_dict = emp.to_dict()
            emp_dict['_id'] = emp.id
            employee_dicts.append(emp_dict)
        
        # Find best match
        match = find_best_match(face_descriptor, employee_dicts, threshold=0.6)
        
        if not match:
            return jsonify({
                "success": False,
                "error": "Face not recognized. Please try again or contact your manager."
            }), 404
        
        employee_id = int(match["employee_id"])
        employee_name = match["employee_name"]
        confidence = match["confidence"]
        
        # Get employee object
        employee = Employee.query.get(employee_id)
        
        if employee:
            # Get existing descriptors
            existing_descriptors = employee.get_face_descriptors()
            if not existing_descriptors and employee.get_face_descriptor():
                existing_descriptors = [employee.get_face_descriptor()]
            
            # Check if this new face is different enough from existing ones
            min_distance = float('inf')
            for existing_desc in existing_descriptors:
                distance = euclidean_distance(face_descriptor, existing_desc)
                if distance < min_distance:
                    min_distance = distance
            
            # If distance > 0.3, it's a different appearance - add it to learn
            if min_distance > 0.3 and confidence > 0.7:
                existing_descriptors.append(face_descriptor)
                # Limit to last 5 registrations
                if len(existing_descriptors) > 5:
                    existing_descriptors = existing_descriptors[-5:]
                
                employee.set_face_descriptors(existing_descriptors)
                db.session.commit()
        
        # Check if employee is already clocked in today
        today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        
        existing_entry = TimeClock.query.filter(
            TimeClock.employee_id == employee_id,
            TimeClock.clock_in >= today_start,
            TimeClock.clock_out == None
        ).first()
        
        if existing_entry:
            clock_in_iso = existing_entry.clock_in.isoformat()
            if not clock_in_iso.endswith('Z') and existing_entry.clock_in.tzinfo is None:
                clock_in_iso += 'Z'
            
            return jsonify({
                "success": False,
                "error": f"{employee_name} is already clocked in today.",
                "employee_name": employee_name,
                "clock_in_time": clock_in_iso
            }), 400
        
        # Compress face image
        compressed_image = compress_image(face_image, max_size=400) if face_image else None
        
        # Create clock-in entry
        entry = TimeClock(
            employee_id=employee_id,
            employee_name=employee_name,
            store_id=store_id,
            clock_in=datetime.utcnow(),
            clock_out=None,
            clock_in_face_image=compressed_image,
            clock_in_confidence=confidence
        )
        
        db.session.add(entry)
        db.session.commit()
        
        clock_in_iso = entry.clock_in.isoformat()
        if not clock_in_iso.endswith('Z') and entry.clock_in.tzinfo is None:
            clock_in_iso += 'Z'
        
        return jsonify({
            "success": True,
            "entry_id": str(entry.id),
            "employee_id": str(employee_id),
            "employee_name": employee_name,
            "clock_in_time": clock_in_iso,
            "confidence": confidence
        }), 201
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@bp.post("/clock-out-face")
def clock_out_face():
    """
    Clock out using face recognition.
    
    Request JSON:
    {
        "face_descriptor": [0.123, -0.456, ...],
        "face_image": "data:image/jpeg;base64,...",
        "store_id": "Lawrence"
    }
    """
    try:
        data = request.get_json()
        
        face_descriptor = data.get("face_descriptor")
        face_image = data.get("face_image")
        store_id = data.get("store_id")
        
        if not face_descriptor:
            return jsonify({"error": "face_descriptor is required"}), 400
        
        # Validate face descriptor
        if not validate_face_descriptor(face_descriptor):
            return jsonify({"error": "Invalid face descriptor format"}), 400
        
        # Get all employees with registered faces
        registered_employees = Employee.query.filter_by(face_registered=True).all()
        
        if not registered_employees:
            return jsonify({
                "success": False,
                "error": "No employees with registered faces found."
            }), 404
        
        # Convert to dict format for find_best_match
        employee_dicts = []
        for emp in registered_employees:
            emp_dict = emp.to_dict()
            emp_dict['_id'] = emp.id
            employee_dicts.append(emp_dict)
        
        # Find best match
        match = find_best_match(face_descriptor, employee_dicts, threshold=0.6)
        
        if not match:
            return jsonify({
                "success": False,
                "error": "Face not recognized. Please try again or contact your manager."
            }), 404
        
        employee_id = int(match["employee_id"])
        employee_name = match["employee_name"]
        confidence = match["confidence"]
        
        # Get employee object
        employee = Employee.query.get(employee_id)
        
        if employee:
            # Get existing descriptors
            existing_descriptors = employee.get_face_descriptors()
            if not existing_descriptors and employee.get_face_descriptor():
                existing_descriptors = [employee.get_face_descriptor()]
            
            # Check if this new face is different enough from existing ones
            min_distance = float('inf')
            for existing_desc in existing_descriptors:
                distance = euclidean_distance(face_descriptor, existing_desc)
                if distance < min_distance:
                    min_distance = distance
            
            # If distance > 0.3, it's a different appearance - add it to learn
            if min_distance > 0.3 and confidence > 0.7:
                existing_descriptors.append(face_descriptor)
                # Limit to last 5 registrations
                if len(existing_descriptors) > 5:
                    existing_descriptors = existing_descriptors[-5:]
                
                employee.set_face_descriptors(existing_descriptors)
                db.session.commit()
        
        # Find active clock-in entry for today
        today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        
        active_entry = TimeClock.query.filter(
            TimeClock.employee_id == employee_id,
            TimeClock.clock_in >= today_start,
            TimeClock.clock_out == None
        ).first()
        
        if not active_entry:
            return jsonify({
                "success": False,
                "error": f"{employee_name} is not clocked in today. Please clock in first.",
                "employee_name": employee_name
            }), 400
        
        # Compress face image
        compressed_image = compress_image(face_image, max_size=400) if face_image else None
        
        # Update entry with clock-out time
        clock_out_time = datetime.utcnow()
        clock_in_time = active_entry.clock_in
        hours_worked = (clock_out_time - clock_in_time).total_seconds() / 3600
        
        active_entry.clock_out = clock_out_time
        active_entry.clock_out_face_image = compressed_image
        active_entry.clock_out_confidence = confidence
        active_entry.hours_worked = round(hours_worked, 2)
        
        db.session.commit()
        
        clock_in_iso = clock_in_time.isoformat()
        if not clock_in_iso.endswith('Z') and clock_in_time.tzinfo is None:
            clock_in_iso += 'Z'
        
        clock_out_iso = clock_out_time.isoformat()
        if not clock_out_iso.endswith('Z') and clock_out_time.tzinfo is None:
            clock_out_iso += 'Z'
        
        return jsonify({
            "success": True,
            "entry_id": str(active_entry.id),
            "employee_id": str(employee_id),
            "employee_name": employee_name,
            "clock_in_time": clock_in_iso,
            "clock_out_time": clock_out_iso,
            "hours_worked": round(hours_worked, 2),
            "confidence": confidence
        }), 200
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@bp.get("/today")
def get_today_entries():
    """
    Get all timeclock entries for today for a specific store.
    
    Query params:
    - store_id: Store identifier
    """
    try:
        store_id = request.args.get("store_id")
        
        if not store_id:
            return jsonify({"error": "store_id is required"}), 400
        
        today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        tomorrow_start = today_start + timedelta(days=1)
        
        entries = TimeClock.query.filter(
            TimeClock.store_id == store_id,
            TimeClock.clock_in >= today_start,
            TimeClock.clock_in < tomorrow_start
        ).order_by(TimeClock.clock_in.desc()).all()
        
        # Format entries for response
        formatted_entries = [entry.to_dict() for entry in entries]
        
        return jsonify({
            "date": today_start.date().isoformat(),
            "store_id": store_id,
            "employees": formatted_entries,
            "total_count": len(formatted_entries)
        }), 200
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@bp.get("/history")
def get_history():
    """
    Get timeclock history for a store.
    
    Query params:
    - store_id: Store identifier
    - days: Number of days to look back (default 30)
    """
    try:
        store_id = request.args.get("store_id")
        days = int(request.args.get("days", 30))
        
        if not store_id:
            return jsonify({"error": "store_id is required"}), 400
        
        start_date = datetime.utcnow() - timedelta(days=days)
        
        entries = TimeClock.query.filter(
            TimeClock.store_id == store_id,
            TimeClock.clock_in >= start_date
        ).order_by(TimeClock.clock_in.desc()).all()
        
        # Format entries for response
        formatted_entries = [entry.to_dict() for entry in entries]
        
        return jsonify({
            "store_id": store_id,
            "entries": formatted_entries,
            "total_count": len(formatted_entries),
            "days": days
        }), 200
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@bp.get("/employee/<employee_id>/history")
def get_employee_history(employee_id):
    """
    Get timeclock history for a specific employee.
    
    Path params:
    - employee_id: Employee identifier
    
    Query params:
    - days: Number of days to look back (default 90)
    """
    try:
        days = int(request.args.get("days", 90))
        start_date = datetime.utcnow() - timedelta(days=days)
        
        # Find all entries for this employee
        entries = TimeClock.query.filter(
            TimeClock.employee_id == int(employee_id),
            TimeClock.clock_in >= start_date
        ).order_by(TimeClock.clock_in.desc()).all()
        
        # Format entries for response
        formatted_entries = [entry.to_dict() for entry in entries]
        
        return jsonify({
            "employee_id": employee_id,
            "entries": formatted_entries,
            "total_count": len(formatted_entries),
            "days": days
        }), 200
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500
