# backend/routes/employees.py
from flask import Blueprint, request, jsonify, g
from ..models import get_employees, create_employee, delete_employee
from ..auth import require_auth

bp = Blueprint("employees", __name__)

@bp.get("/")
@require_auth()
def list_employees():
    tenant_id = g.tenant_id
    store_id = request.args.get("store_id")
    employees = get_employees(tenant_id=tenant_id, store_id=store_id)
    return jsonify(employees)

@bp.post("/")
@require_auth()
def add_employee():
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "Request body is required"}), 400
        
        name = data.get("name")
        if not name or not name.strip():
            return jsonify({"error": "Employee name is required"}), 400
        
        tenant_id = g.tenant_id
        emp_id = create_employee(
            tenant_id=tenant_id,
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
