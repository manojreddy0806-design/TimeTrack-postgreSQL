# backend/routes/eod.py
from flask import Blueprint, request, jsonify, g
from datetime import datetime
from ..models import get_eods, create_eod
from ..auth import require_auth

bp = Blueprint("eod", __name__)

@bp.get("/")
@require_auth()
def list_eod():
    tenant_id = g.tenant_id
    store_id = request.args.get("store_id")
    reports = get_eods(tenant_id=tenant_id, store_id=store_id)
    return jsonify(reports)

@bp.post("/")
@require_auth()
def add_eod():
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "Request body is required"}), 400
        
        store_id = data.get("store_id")
        if not store_id:
            return jsonify({"error": "store_id is required"}), 400
        
        report_date = data.get("report_date")
        if not report_date:
            return jsonify({"error": "report_date is required"}), 400
        
        # Extract values with explicit defaults and validation
        try:
            cash_amount = float(data.get("cash_amount", 0) or 0)
            credit_amount = float(data.get("credit_amount", 0) or 0)
            qpay_amount = float(data.get("qpay_amount", 0) or 0)
            boxes_count = int(data.get("boxes_count", 0) or 0)
            total1 = float(data.get("total1", 0) or 0)
            
            # Validate non-negative values
            if cash_amount < 0 or credit_amount < 0 or qpay_amount < 0 or boxes_count < 0 or total1 < 0:
                return jsonify({"error": "All amounts and counts must be non-negative"}), 400
        except (ValueError, TypeError) as e:
            return jsonify({"error": f"Invalid numeric value: {str(e)}"}), 400
        
        # Debug logging
        print(f"EOD Submission received: cash_amount={cash_amount}, credit_amount={credit_amount}, "
              f"qpay_amount={qpay_amount}, boxes_count={boxes_count}, total1={total1}, "
              f"notes={data.get('notes', '')[:50]}")
        
        tenant_id = g.tenant_id
        eod_id = create_eod(
            tenant_id=tenant_id,
            store_id=store_id,
            report_date=report_date,
            notes=data.get("notes"),
            cash_amount=cash_amount,
            credit_amount=credit_amount,
            qpay_amount=qpay_amount,
            boxes_count=boxes_count,
            total1=total1,
            submitted_by=data.get("submitted_by")
        )
        
        return jsonify({"id": eod_id}), 201
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": f"Failed to create EOD report: {str(e)}"}), 500
