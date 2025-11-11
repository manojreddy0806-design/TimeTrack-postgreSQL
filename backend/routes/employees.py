# backend/routes/employees.py
from flask import Blueprint, request, jsonify
from ..models import get_employees, create_employee, delete_employee

bp = Blueprint("employees", __name__)

@bp.get("/")
def list_employees():
    store_id = request.args.get("store_id")
    employees = get_employees(store_id)
    return jsonify(employees)

@bp.post("/")
def add_employee():
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "Request body is required"}), 400
        
        name = data.get("name")
        if not name or not name.strip():
            return jsonify({"error": "Employee name is required"}), 400
        
        emp_id = create_employee(
            store_id=data.get("store_id"),
            name=name.strip(),
            role=data.get("role"),
            phone_number=data.get("phone_number"),
            hourly_pay=data.get("hourly_pay")
        )
        return jsonify({"id": emp_id}), 201
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": f"Failed to create employee: {str(e)}"}), 500

@bp.delete("/<employee_id>")
def remove_employee(employee_id):
    success = delete_employee(employee_id)
    if success:
        return jsonify({"success": True, "message": "Employee deleted successfully"}), 200
    else:
        return jsonify({"success": False, "error": "Employee not found"}), 404
