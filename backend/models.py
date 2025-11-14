# backend/models.py
from datetime import datetime
from flask import current_app
import bcrypt
import json

from backend.database import db

# ================== SQLAlchemy Models ==================

class Tenant(db.Model):
    __tablename__ = 'tenants'
    
    id = db.Column(db.Integer, primary_key=True)
    company_name = db.Column(db.String(200), nullable=False)
    email = db.Column(db.String(255), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(200), nullable=False)
    plan = db.Column(db.String(50), nullable=False, default='basic')  # basic, standard, premium
    max_storage_bytes = db.Column(db.BigInteger, default=1073741824)  # 1GB default
    used_storage_bytes = db.Column(db.BigInteger, default=0)
    status = db.Column(db.String(50), default='active')  # active, suspended, cancelled
    stripe_customer_id = db.Column(db.String(255), nullable=True, index=True)
    stripe_subscription_id = db.Column(db.String(255), nullable=True, index=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    managers = db.relationship('Manager', back_populates='tenant', cascade='all, delete-orphan')
    
    def to_dict(self, include_password=False):
        data = {
            'id': self.id,
            'company_name': self.company_name,
            'email': self.email,
            'plan': self.plan,
            'max_storage_bytes': self.max_storage_bytes,
            'used_storage_bytes': self.used_storage_bytes,
            'status': self.status,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
        if include_password:
            data['password_hash'] = self.password_hash
        return data
    
    def check_storage_limit(self, additional_bytes=0):
        """Check if tenant can use additional storage"""
        return (self.used_storage_bytes + additional_bytes) <= self.max_storage_bytes
    
    def get_storage_usage_percent(self):
        """Get storage usage as percentage"""
        if self.max_storage_bytes == 0:
            return 0
        return (self.used_storage_bytes / self.max_storage_bytes) * 100


class Manager(db.Model):
    __tablename__ = 'managers'
    
    id = db.Column(db.Integer, primary_key=True)
    tenant_id = db.Column(db.Integer, db.ForeignKey('tenants.id'), nullable=False, index=True)
    name = db.Column(db.String(100), nullable=False)
    username = db.Column(db.String(50), nullable=False, index=True)
    password = db.Column(db.String(200), nullable=False)
    is_super_admin = db.Column(db.Boolean, default=False)  # True for tenant's super admin
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    tenant = db.relationship('Tenant', back_populates='managers')
    # Stores relationship - composite join on tenant_id + username
    # Note: No back_populates to avoid SQLAlchemy issues with composite keys
    # Use get_stores(manager_username=..., tenant_id=...) function instead
    
    # Composite unique constraint on tenant_id + username
    __table_args__ = (
        db.UniqueConstraint('tenant_id', 'username', name='uq_tenant_manager_username'),
    )
    
    def to_dict(self, include_password=False):
        data = {
            'id': self.id,
            'tenant_id': self.tenant_id,
            'name': self.name,
            'username': self.username,
            'is_super_admin': self.is_super_admin,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
        if include_password:
            data['password'] = self.password
        return data


class Store(db.Model):
    __tablename__ = 'stores'
    
    id = db.Column(db.Integer, primary_key=True)
    tenant_id = db.Column(db.Integer, db.ForeignKey('tenants.id'), nullable=False, index=True)
    name = db.Column(db.String(100), nullable=False, index=True)
    username = db.Column(db.String(50), nullable=False, index=True)
    password = db.Column(db.String(200), nullable=False)
    total_boxes = db.Column(db.Integer, default=0)
    manager_username = db.Column(db.String(50), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    allowed_ip = db.Column(db.String(45), nullable=True)
    
    # Foreign key relationship to Manager (composite: tenant_id + username)
    # Note: We'll handle this in application logic since SQLAlchemy doesn't support composite FKs directly
    
    # Relationships
    tenant = db.relationship('Tenant')
    # Manager relationship - composite join handled in application code
    # Use get_manager_by_username(username, tenant_id=...) function instead
    # Inventory, InventoryHistory, and EOD relationships - composite join on tenant_id + store_id (name)
    # Note: Using string-based primaryjoin since store_id references Store.name, not Store.id
    # Note: Relationships to Inventory, InventoryHistory, and EOD are handled via queries
    # Using get_inventory(tenant_id=..., store_id=...) etc. functions
    # No SQLAlchemy relationships defined to avoid composite key issues
    
    # Composite unique constraint on tenant_id + name and tenant_id + username
    __table_args__ = (
        db.UniqueConstraint('tenant_id', 'name', name='uq_tenant_store_name'),
        db.UniqueConstraint('tenant_id', 'username', name='uq_tenant_store_username'),
    )
    
    def to_dict(self, include_password=False):
        data = {
            'id': self.id,
            'tenant_id': self.tenant_id,
            'name': self.name,
            'username': self.username,
            'total_boxes': self.total_boxes,
            'manager_username': self.manager_username,
            'allowed_ip': self.allowed_ip,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
        if include_password:
            data['password'] = self.password
        return data


class Employee(db.Model):
    __tablename__ = 'employees'
    
    id = db.Column(db.Integer, primary_key=True)
    tenant_id = db.Column(db.Integer, db.ForeignKey('tenants.id'), nullable=False, index=True)
    store_id = db.Column(db.String(100), nullable=True, index=True)
    name = db.Column(db.String(100), nullable=False)
    role = db.Column(db.String(50), nullable=True)
    phone_number = db.Column(db.String(20), nullable=True)
    hourly_pay = db.Column(db.Float, nullable=True)
    active = db.Column(db.Boolean, default=True)
    face_registered = db.Column(db.Boolean, default=False)
    face_descriptor = db.Column(db.Text, nullable=True)  # JSON array
    face_descriptors = db.Column(db.Text, nullable=True)  # JSON array of arrays
    face_image = db.Column(db.Text, nullable=True)  # Base64 encoded image
    face_registered_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    tenant = db.relationship('Tenant')
    
    # Relationships
    timeclock_entries = db.relationship('TimeClock', back_populates='employee', cascade='all, delete-orphan')
    
    def get_face_descriptor(self):
        """Parse JSON face_descriptor field"""
        try:
            return json.loads(self.face_descriptor) if self.face_descriptor else None
        except:
            return None
    
    def set_face_descriptor(self, descriptor):
        """Serialize face_descriptor to JSON"""
        self.face_descriptor = json.dumps(descriptor) if descriptor else None
    
    def get_face_descriptors(self):
        """Parse JSON face_descriptors field"""
        try:
            return json.loads(self.face_descriptors) if self.face_descriptors else []
        except:
            return []
    
    def set_face_descriptors(self, descriptors):
        """Serialize face_descriptors to JSON"""
        self.face_descriptors = json.dumps(descriptors) if descriptors else None
    
    def to_dict(self):
        return {
            'employee_id': str(self.id),
            'tenant_id': self.tenant_id,
            'store_id': self.store_id,
            'name': self.name,
            'role': self.role,
            'phone_number': self.phone_number,
            'hourly_pay': self.hourly_pay,
            'active': self.active,
            'face_registered': self.face_registered,
            'face_descriptor': self.get_face_descriptor(),
            'face_descriptors': self.get_face_descriptors(),
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class Inventory(db.Model):
    __tablename__ = 'inventory'
    
    id = db.Column(db.Integer, primary_key=True)
    tenant_id = db.Column(db.Integer, db.ForeignKey('tenants.id'), nullable=False, index=True)
    store_id = db.Column(db.String(100), nullable=False, index=True)
    sku = db.Column(db.String(100), nullable=False)
    name = db.Column(db.String(200), nullable=False)
    quantity = db.Column(db.Integer, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    tenant = db.relationship('Tenant')
    # Store relationship - handled via queries (no SQLAlchemy relationship)
    # Use get_store_by_name(name, tenant_id=...) function instead
    
    # Composite unique constraint on tenant_id + store_id + sku
    __table_args__ = (
        db.UniqueConstraint('tenant_id', 'store_id', 'sku', name='uq_tenant_store_sku'),
    )
    
    def to_dict(self):
        return {
            '_id': str(self.id),
            'tenant_id': self.tenant_id,
            'store_id': self.store_id,
            'sku': self.sku,
            'name': self.name,
            'quantity': self.quantity,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class InventoryHistory(db.Model):
    __tablename__ = 'inventory_history'
    
    id = db.Column(db.Integer, primary_key=True)
    tenant_id = db.Column(db.Integer, db.ForeignKey('tenants.id'), nullable=False, index=True)
    store_id = db.Column(db.String(100), nullable=False, index=True)
    snapshot_date = db.Column(db.DateTime, nullable=False, index=True)
    items = db.Column(db.Text, nullable=False)  # JSON array of inventory items
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    tenant = db.relationship('Tenant')
    # Store relationship - handled via queries (no SQLAlchemy relationship)
    # Use get_store_by_name(name, tenant_id=...) function instead
    
    # Composite unique constraint on tenant_id + store_id + snapshot_date
    __table_args__ = (
        db.UniqueConstraint('tenant_id', 'store_id', 'snapshot_date', name='uq_tenant_store_snapshot_date'),
    )
    
    def get_items(self):
        """Parse JSON items field"""
        try:
            return json.loads(self.items) if self.items else []
        except:
            return []
    
    def set_items(self, items_list):
        """Serialize items to JSON"""
        self.items = json.dumps(items_list)
    
    def to_dict(self):
        return {
            'id': str(self.id),
            'tenant_id': self.tenant_id,
            'store_id': self.store_id,
            'snapshot_date': self.snapshot_date.isoformat() if self.snapshot_date else None,
            'items': self.get_items(),
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }


class TimeClock(db.Model):
    __tablename__ = 'timeclock'
    
    id = db.Column(db.Integer, primary_key=True)
    tenant_id = db.Column(db.Integer, db.ForeignKey('tenants.id'), nullable=False, index=True)
    employee_id = db.Column(db.Integer, db.ForeignKey('employees.id'), nullable=False, index=True)
    employee_name = db.Column(db.String(100), nullable=True)
    store_id = db.Column(db.String(100), nullable=True, index=True)
    clock_in = db.Column(db.DateTime, nullable=False, index=True)
    clock_out = db.Column(db.DateTime, nullable=True)
    hours_worked = db.Column(db.Float, nullable=True)
    clock_in_face_image = db.Column(db.Text, nullable=True)  # Base64 image
    clock_out_face_image = db.Column(db.Text, nullable=True)  # Base64 image
    clock_in_confidence = db.Column(db.Float, nullable=True)
    clock_out_confidence = db.Column(db.Float, nullable=True)
    
    # Relationships
    tenant = db.relationship('Tenant')
    employee = db.relationship('Employee', back_populates='timeclock_entries')
    
    def to_dict(self):
        clock_in_iso = self.clock_in.isoformat() if self.clock_in else None
        if clock_in_iso and not clock_in_iso.endswith('Z') and self.clock_in.tzinfo is None:
            clock_in_iso += 'Z'
        
        clock_out_iso = self.clock_out.isoformat() if self.clock_out else None
        if clock_out_iso and not clock_out_iso.endswith('Z') and self.clock_out.tzinfo is None:
            clock_out_iso += 'Z'
        
        return {
            'entry_id': str(self.id),
            'tenant_id': self.tenant_id,
            'employee_id': str(self.employee_id),
            'employee_name': self.employee_name,
            'store_id': self.store_id,
            'clock_in': clock_in_iso,
            'clock_out': clock_out_iso,
            'hours_worked': self.hours_worked,
            'clock_in_confidence': self.clock_in_confidence,
            'clock_out_confidence': self.clock_out_confidence,
            'status': 'clocked_out' if self.clock_out else 'clocked_in'
        }


class EOD(db.Model):
    __tablename__ = 'eod'
    
    id = db.Column(db.Integer, primary_key=True)
    tenant_id = db.Column(db.Integer, db.ForeignKey('tenants.id'), nullable=False, index=True)
    store_id = db.Column(db.String(100), nullable=False, index=True)
    report_date = db.Column(db.String(50), nullable=False, index=True)
    notes = db.Column(db.Text, nullable=True)
    cash_amount = db.Column(db.Float, default=0)
    credit_amount = db.Column(db.Float, default=0)
    qpay_amount = db.Column(db.Float, default=0)
    boxes_count = db.Column(db.Integer, default=0)
    total1 = db.Column(db.Float, default=0)
    submitted_by = db.Column(db.String(100), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    tenant = db.relationship('Tenant')
    # Store relationship - handled via queries (no SQLAlchemy relationship)
    # Use get_store_by_name(name, tenant_id=...) function instead
    
    def to_dict(self):
        created_at_iso = self.created_at.isoformat() if self.created_at else None
        if created_at_iso and not created_at_iso.endswith('Z') and self.created_at.tzinfo is None:
            created_at_iso += 'Z'
        
        return {
            'id': str(self.id),
            'tenant_id': self.tenant_id,
            'store_id': self.store_id,
            'report_date': self.report_date,
            'notes': self.notes,
            'cash_amount': self.cash_amount,
            'credit_amount': self.credit_amount,
            'qpay_amount': self.qpay_amount,
            'boxes_count': self.boxes_count,
            'total1': self.total1,
            'submitted_by': self.submitted_by,
            'created_at': created_at_iso
        }


# ================== Helper Functions ==================

def hash_password(password):
    """Hash a password using bcrypt"""
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')


def verify_password(password, hashed):
    """
    Verify a password against a bcrypt hash.
    
    SECURITY: Plain text password fallback has been removed for security.
    All passwords must be bcrypt hashed.
    """
    if not password or not hashed:
        return False
    
    # Only accept bcrypt hashed passwords
    if not (hashed.startswith('$2b$') or hashed.startswith('$2a$')):
        # Password is not hashed - reject it for security
        return False
    
    try:
        return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))
    except Exception:
        return False


def get_default_inventory_items():
    """Returns a list of default inventory items that should be created for each new store"""
    return [
  {"sku": "Samsung", "name": "S 23 FE"},
  {"sku": "Samsung", "name": "S24 FE"},
  {"sku": "Samsung", "name": "Samsung Tab 3"},
  {"sku": "Samsung", "name": "Samsung Watch"},
  
  {"sku": "Apple", "name": "Iphone 13"},
  {"sku": "Apple", "name": "Iphone 14"},
  {"sku": "Apple", "name": "Iphone 16"},
  {"sku": "Apple", "name": "Iphone 16 e"},
  {"sku": "Apple", "name": "Iphone 16 plus"},
  {"sku": "Apple", "name": "Iphone 16 pro"},
  {"sku": "Apple", "name": "Iphone 16 pro max"},
  {"sku": "Apple", "name": "Apple Watch"},
  
  {"sku": "Motorola", "name": "Moto g 2024"},
  {"sku": "Motorola", "name": "Moto g 2025"},
  {"sku": "Motorola", "name": "Moto power 2024"},
  {"sku": "Motorola", "name": "Moto power 2025"},
  {"sku": "Motorola", "name": "Moto razr 2024"},
  {"sku": "Motorola", "name": "Moto stylus 2023"},
  {"sku": "Motorola", "name": "Moto stylus 2024"},
  {"sku": "Motorola", "name": "Moto stylus 2025"},
  {"sku": "Motorola", "name": "Moto edge 2024"},
  
  {"sku": "TCL", "name": "TCL 50 XL 3"},
  {"sku": "TCL", "name": "TCL K32"},
  {"sku": "TCL", "name": "TCL ION X"},
  {"sku": "TCL", "name": "TCL K11"},
  {"sku": "TCL", "name": "TCL Tab"},
  
  {"sku": "Revvl", "name": "Rewl 7"},
  {"sku": "Revvl", "name": "Rewl 7 pro"},
  {"sku": "Revvl", "name": "Revvl Tab"},
  {"sku": "Revvl", "name": "Revll 8"},
  
  {"sku": "Google", "name": "Google pixel"},
  {"sku": "Chromebook", "name": "Chrome book"},
  {"sku": "Flip Phone", "name": "Flip Phone 3"},
  
  {"sku": "Generic", "name": "A13"},
  {"sku": "Generic", "name": "A15"},
  {"sku": "Generic", "name": "A16"},
  {"sku": "Generic", "name": "A35"},
  {"sku": "Generic", "name": "A36"},
  {"sku": "Generic", "name": "C210"},
  {"sku": "Generic", "name": "G310"},
  {"sku": "Generic", "name": "G400"},
  {"sku": "Generic", "name": "HSI"},
  {"sku": "Simcards", "name": "Simcards"},
]


# ================== Tenant Functions ==================

def get_tenant_by_id(tenant_id):
    """Get a tenant by ID"""
    tenant = Tenant.query.get(tenant_id)
    return tenant.to_dict() if tenant else None


def get_tenant_by_email(email):
    """Get a tenant by email"""
    tenant = Tenant.query.filter_by(email=email).first()
    return tenant.to_dict(include_password=True) if tenant else None


def create_tenant(company_name, email, password_hash, plan='basic', stripe_customer_id=None, stripe_subscription_id=None):
    """Create a new tenant"""
    # Check if email already exists
    existing = Tenant.query.filter_by(email=email).first()
    if existing:
        raise ValueError(f"Tenant with email '{email}' already exists")
    
    # Set storage limits based on plan
    plan_limits = {
        'basic': 1073741824,      # 1GB
        'standard': 10737418240,   # 10GB
        'premium': 107374182400    # 100GB
    }
    max_storage = plan_limits.get(plan, 1073741824)
    
    tenant = Tenant(
        company_name=company_name,
        email=email,
        password_hash=password_hash,
        plan=plan,
        max_storage_bytes=max_storage,
        stripe_customer_id=stripe_customer_id,
        stripe_subscription_id=stripe_subscription_id
    )
    db.session.add(tenant)
    db.session.commit()
    
    return tenant.to_dict()


def update_tenant_storage(tenant_id, additional_bytes):
    """Update tenant storage usage"""
    tenant = Tenant.query.get(tenant_id)
    if not tenant:
        raise ValueError(f"Tenant with ID {tenant_id} not found")
    
    tenant.used_storage_bytes += additional_bytes
    if tenant.used_storage_bytes < 0:
        tenant.used_storage_bytes = 0
    
    db.session.commit()
    return tenant.to_dict()


def update_tenant_plan(tenant_id, plan, stripe_subscription_id=None):
    """Update tenant plan and storage limits"""
    tenant = Tenant.query.get(tenant_id)
    if not tenant:
        raise ValueError(f"Tenant with ID {tenant_id} not found")
    
    plan_limits = {
        'basic': 1073741824,      # 1GB
        'standard': 10737418240,   # 10GB
        'premium': 107374182400    # 100GB
    }
    
    tenant.plan = plan
    tenant.max_storage_bytes = plan_limits.get(plan, 1073741824)
    if stripe_subscription_id:
        tenant.stripe_subscription_id = stripe_subscription_id
    
    db.session.commit()
    return tenant.to_dict()


# ================== Manager Functions ==================

def get_manager_by_username(username, tenant_id=None):
    """Get a manager by username, optionally filtered by tenant_id"""
    query = Manager.query.filter_by(username=username)
    if tenant_id:
        query = query.filter_by(tenant_id=tenant_id)
    manager = query.first()
    return manager.to_dict(include_password=True) if manager else None


def get_all_managers(tenant_id=None):
    """Get all managers (excluding passwords), optionally filtered by tenant_id"""
    query = Manager.query
    if tenant_id:
        query = query.filter_by(tenant_id=tenant_id)
    managers = query.all()
    return [m.to_dict() for m in managers]


def create_manager(tenant_id, name, username, password, is_super_admin=False):
    """Create a new manager account"""
    # Check if username already exists for this tenant
    existing = Manager.query.filter_by(tenant_id=tenant_id, username=username).first()
    if existing:
        raise ValueError(f"Manager username '{username}' already exists for this tenant")
    
    # Hash the password
    password_hash = hash_password(password)
    
    manager = Manager(
        tenant_id=tenant_id,
        name=name,
        username=username,
        password=password_hash,
        is_super_admin=is_super_admin
    )
    db.session.add(manager)
    db.session.commit()
    
    return manager.to_dict()


def update_manager(tenant_id, username, name=None, new_username=None, password=None):
    """Update an existing manager account"""
    # Check if manager exists
    manager = Manager.query.filter_by(tenant_id=tenant_id, username=username).first()
    if not manager:
        raise ValueError(f"Manager with username '{username}' not found for this tenant")
    
    if name is not None:
        manager.name = name
    
    if new_username is not None:
        # Check if new username is already taken by another manager in the same tenant
        if new_username != username:
            username_taken = Manager.query.filter_by(tenant_id=tenant_id, username=new_username).first()
            if username_taken:
                raise ValueError(f"Manager username '{new_username}' is already taken")
        manager.username = new_username
    
    if password is not None:
        manager.password = hash_password(password)
    
    db.session.commit()
    
    return manager.to_dict()


# ================== Store Functions ==================

def create_store(tenant_id, name, username=None, password=None, total_boxes=0, manager_username=None, allowed_ip=None):
    """Create a new store"""
    # Check if store name already exists for this tenant
    existing_store = Store.query.filter_by(tenant_id=tenant_id, name=name).first()
    if existing_store:
        existing_manager = existing_store.manager_username or "unknown"
        raise ValueError(f"Store name '{name}' already exists. It was created by manager '{existing_manager}'. Store names must be unique within a tenant.")
    
    # Check if username already exists for this tenant
    if username:
        existing_by_username = Store.query.filter_by(tenant_id=tenant_id, username=username).first()
        if existing_by_username:
            raise ValueError(f"Store username '{username}' is already taken. Please choose a different username.")
    
    # Generate default username if not provided
    if username is None:
        username = name.lower().replace(" ", "")
        # Check if generated username is already taken for this tenant
        counter = 1
        base_username = username
        while Store.query.filter_by(tenant_id=tenant_id, username=username).first():
            username = f"{base_username}{counter}"
            counter += 1
    
    # Generate default password if not provided
    if password is None:
        password = username + "123"
    
    # Hash the password
    password_hash = hash_password(password)
    
    store = Store(
        tenant_id=tenant_id,
        name=name,
        username=username,
        password=password_hash,
        total_boxes=total_boxes,
        manager_username=manager_username,
        allowed_ip=allowed_ip
    )
    db.session.add(store)
    db.session.commit()
    
    # Create default inventory items for this store
    created_count = add_default_inventory_to_store(tenant_id, name)
    print(f"✓ Created store '{name}' with {created_count} inventory items")
    
    return str(store.id)


def get_store_by_username(username, tenant_id=None):
    """Get a store by username, optionally filtered by tenant_id"""
    query = Store.query.filter_by(username=username)
    if tenant_id:
        query = query.filter_by(tenant_id=tenant_id)
    store = query.first()
    return store.to_dict(include_password=True) if store else None


def get_store_by_name(name, tenant_id=None):
    """Get a store by name, optionally filtered by tenant_id"""
    query = Store.query.filter_by(name=name)
    if tenant_id:
        query = query.filter_by(tenant_id=tenant_id)
    return query.first()

def get_stores(tenant_id=None, manager_username=None):
    """Get stores, optionally filtered by tenant_id and/or manager_username"""
    query = Store.query
    if tenant_id:
        query = query.filter_by(tenant_id=tenant_id)
    if manager_username:
        query = query.filter_by(manager_username=manager_username)
    stores = query.all()
    return [s.to_dict() for s in stores]


def update_store(tenant_id, name, new_name=None, username=None, password=None, total_boxes=None, allowed_ip=None):
    """Update a store's information"""
    store = Store.query.filter_by(tenant_id=tenant_id, name=name).first()
    if not store:
        return False
    
    old_name = name
    
    if new_name is not None:
        store.name = new_name
    if username is not None:
        store.username = username
    if password is not None:
        store.password = hash_password(password)
    if total_boxes is not None:
        store.total_boxes = total_boxes
    if allowed_ip is not None:
        store.allowed_ip = allowed_ip
    
    db.session.commit()
    
    # If the store name changed, update all related data
    if new_name and new_name != old_name:
        # Update inventory items
        Inventory.query.filter_by(tenant_id=tenant_id, store_id=old_name).update({Inventory.store_id: new_name})
        
        # Update inventory history
        InventoryHistory.query.filter_by(tenant_id=tenant_id, store_id=old_name).update({InventoryHistory.store_id: new_name})
        
        # Update EOD reports
        EOD.query.filter_by(tenant_id=tenant_id, store_id=old_name).update({EOD.store_id: new_name})
        
        # Update timeclock entries
        TimeClock.query.filter_by(tenant_id=tenant_id, store_id=old_name).update({TimeClock.store_id: new_name})
        
        db.session.commit()
    
    return True


def delete_store(tenant_id, name):
    """Delete a store and all related data"""
    store = Store.query.filter_by(tenant_id=tenant_id, name=name).first()
    if not store:
        return False
    
    # SQLAlchemy will automatically delete related data due to cascade='all, delete-orphan'
    # But we also need to delete timeclock entries (no FK relationship)
    TimeClock.query.filter_by(tenant_id=tenant_id, store_id=name).delete()
    
    db.session.delete(store)
    db.session.commit()
    
    return True




# ================== Employee Functions ==================

def create_employee(tenant_id, store_id, name, role=None, phone_number=None, hourly_pay=None):
    """Create a new employee"""
    employee = Employee(
        tenant_id=tenant_id,
        store_id=store_id,
        name=name,
        role=role,
        phone_number=phone_number,
        hourly_pay=hourly_pay,
        active=True
    )
    db.session.add(employee)
    db.session.commit()
    return str(employee.id)


def get_employees(tenant_id=None, store_id=None):
    """Get employees, optionally filtered by tenant_id and/or store_id"""
    query = Employee.query
    if tenant_id:
        query = query.filter_by(tenant_id=tenant_id)
    if store_id:
        query = query.filter_by(store_id=store_id)
    employees = query.all()
    return [e.to_dict() for e in employees]


def delete_employee(employee_id):
    """Delete an employee"""
    try:
        employee = Employee.query.get(int(employee_id))
        if not employee:
            return False
        db.session.delete(employee)
        db.session.commit()
        return True
    except (ValueError, TypeError):
        return False


# ================== Inventory Functions ==================

def add_inventory_item(tenant_id, store_id, sku, name, quantity=0):
    """Add an inventory item"""
    item = Inventory(
        tenant_id=tenant_id,
        store_id=store_id,
        sku=sku,
        name=name,
        quantity=quantity
    )
    db.session.add(item)
    db.session.commit()
    return str(item.id)


def update_inventory_item(tenant_id, store_id, sku=None, item_id=None, quantity=None, name=None, new_sku=None):
    """Update an inventory item"""
    # Find the item
    if item_id:
        try:
            item = Inventory.query.filter_by(tenant_id=tenant_id, id=int(item_id)).first()
        except (ValueError, TypeError):
            return False
    elif store_id and sku:
        item = Inventory.query.filter_by(tenant_id=tenant_id, store_id=store_id, sku=sku).first()
    else:
        return False

    if not item:
        return False
    
    # If SKU is changing, check if new SKU already exists
    if new_sku is not None:
        existing = Inventory.query.filter_by(tenant_id=tenant_id, store_id=store_id, sku=new_sku).filter(Inventory.id != item.id).first()
        if existing:
            return False
        item.sku = new_sku
    
    if quantity is not None:
        item.quantity = quantity
    if name is not None:
        item.name = name
    
    db.session.commit()
    return True


def delete_inventory_item(tenant_id, store_id, sku):
    """Delete an inventory item"""
    item = Inventory.query.filter_by(tenant_id=tenant_id, store_id=store_id, sku=sku).first()
    if not item:
        return False
    db.session.delete(item)
    db.session.commit()
    return True


def get_inventory(tenant_id=None, store_id=None):
    """Get inventory items, optionally filtered by tenant_id and/or store_id"""
    query = Inventory.query
    if tenant_id:
        query = query.filter_by(tenant_id=tenant_id)
    if store_id:
        query = query.filter_by(store_id=store_id)
    items = query.all()
    return [i.to_dict() for i in items]


def add_default_inventory_to_store(tenant_id, store_name):
    """
    Add default inventory items to a store.
    Checks for existing items to avoid duplicates.
    Returns the number of items created.
    """
    default_items = get_default_inventory_items()
    created_count = 0
    
    for item in default_items:
        # Check if this tenant_id + store_id + sku combination already exists
        existing_item = Inventory.query.filter_by(
            tenant_id=tenant_id,
            store_id=store_name,
            sku=item["sku"]
        ).first()
        
        if not existing_item:
            inventory_item = Inventory(
                tenant_id=tenant_id,
                store_id=store_name,
                sku=item["sku"],
                name=item["name"],
                quantity=0
            )
            db.session.add(inventory_item)
            created_count += 1
    
    try:
        db.session.commit()
        return created_count
    except Exception as e:
        db.session.rollback()
        print(f"Warning: Could not create all inventory items: {e}")
        return 0


# ================== EOD Functions ==================

def create_eod(tenant_id, store_id, report_date, notes=None, cash_amount=0, credit_amount=0, qpay_amount=0, boxes_count=0, total1=0, submitted_by=None):
    """Create an EOD report"""
    eod = EOD(
        tenant_id=tenant_id,
        store_id=store_id,
        report_date=report_date,
        notes=notes or "",
        cash_amount=cash_amount,
        credit_amount=credit_amount,
        qpay_amount=qpay_amount,
        boxes_count=boxes_count,
        total1=total1,
        submitted_by=submitted_by or "Unknown"
    )
    db.session.add(eod)
    db.session.commit()
    return str(eod.id)


def get_eods(tenant_id=None, store_id=None):
    """Get EOD reports, optionally filtered by tenant_id and/or store_id"""
    query = EOD.query
    if tenant_id:
        query = query.filter_by(tenant_id=tenant_id)
    if store_id:
        query = query.filter_by(store_id=store_id)
    eods = query.order_by(EOD.report_date.desc()).all()
    
    results = []
    for eod in eods:
        eod_dict = eod.to_dict()
        
        # Get employees who worked on this report date
        report_date = eod.report_date
        store = eod.store_id
        tenant_id = eod.tenant_id
        if report_date and store:
            try:
                from datetime import datetime as dt, timedelta
                report_dt = dt.fromisoformat(report_date.replace('Z', '+00:00')) if isinstance(report_date, str) else report_date
                day_start = report_dt.replace(hour=0, minute=0, second=0, microsecond=0)
                day_end = day_start + timedelta(days=1)
                
                # Find all timeclock entries for this tenant/store on this date
                entries = TimeClock.query.filter(
                    TimeClock.tenant_id == tenant_id,
                    TimeClock.store_id == store,
                    TimeClock.clock_in >= day_start,
                    TimeClock.clock_in < day_end
                ).all()
                
                # Extract unique employee names
                employee_names = list(set([entry.employee_name for entry in entries if entry.employee_name]))
                employee_names.sort()
                eod_dict["employees_worked"] = employee_names
            except Exception as e:
                print(f"Error getting employees for EOD: {e}")
                eod_dict["employees_worked"] = []
        else:
            eod_dict["employees_worked"] = []
        
        results.append(eod_dict)
    
    return results


# ================== Deprecated/Legacy Functions ==================
# These are kept for backward compatibility

def get_collection(name):
    """
    Deprecated: This function is kept for backward compatibility with routes
    that directly access collections. Returns a wrapper object that provides
    MongoDB-like access patterns but uses SQLAlchemy underneath.
    """
    class CollectionWrapper:
        def __init__(self, model_class):
            self.model_class = model_class
        
        def find_one(self, query, projection=None):
            """MongoDB-like find_one"""
            obj = None
            if '_id' in query:
                try:
                    obj = self.model_class.query.get(int(query['_id']))
                except:
                    return None
            else:
                # Build SQLAlchemy query from dict
                q = self.model_class.query
                for key, value in query.items():
                    if hasattr(self.model_class, key):
                        q = q.filter(getattr(self.model_class, key) == value)
                obj = q.first()
            
            if obj:
                result = obj.to_dict() if hasattr(obj, 'to_dict') else {}
                if projection and '_id' in projection and projection['_id'] == 0:
                    result.pop('id', None)
                    result.pop('_id', None)
                return result
            return None
        
        def find(self, query, projection=None):
            """MongoDB-like find"""
            q = self.model_class.query
            for key, value in query.items():
                if hasattr(self.model_class, key):
                    if isinstance(value, dict):
                        # Handle comparison operators
                        for op, op_value in value.items():
                            if op == '$gte':
                                q = q.filter(getattr(self.model_class, key) >= op_value)
                            elif op == '$lt':
                                q = q.filter(getattr(self.model_class, key) < op_value)
                            elif op == '$ne':
                                q = q.filter(getattr(self.model_class, key) != op_value)
                    else:
                        q = q.filter(getattr(self.model_class, key) == value)
            return CollectionCursor(q, projection)
        
        def insert_one(self, document):
            """MongoDB-like insert_one"""
            obj = self.model_class(**document)
            db.session.add(obj)
            db.session.commit()
            
            class InsertResult:
                def __init__(self, obj_id):
                    self.inserted_id = obj_id
            
            return InsertResult(obj.id)
        
        def update_one(self, query, update, upsert=False):
            """MongoDB-like update_one"""
            obj = None
            if '_id' in query:
                try:
                    obj = self.model_class.query.get(int(query['_id']))
                except:
                    pass
            else:
                q = self.model_class.query
                for key, value in query.items():
                    if hasattr(self.model_class, key):
                        q = q.filter(getattr(self.model_class, key) == value)
                obj = q.first()
            
            if obj:
                if '$set' in update:
                    for key, value in update['$set'].items():
                        if hasattr(obj, key):
                            setattr(obj, key, value)
                db.session.commit()
                
                class UpdateResult:
                    def __init__(self, modified):
                        self.modified_count = 1 if modified else 0
                
                return UpdateResult(True)
            
            class UpdateResult:
                def __init__(self, modified):
                    self.modified_count = 0
            return UpdateResult(False)
        
        def update_many(self, query, update):
            """MongoDB-like update_many"""
            q = self.model_class.query
            for key, value in query.items():
                if hasattr(self.model_class, key):
                    q = q.filter(getattr(self.model_class, key) == value)
            
            count = 0
            if '$set' in update:
                count = q.update(update['$set'])
                db.session.commit()
            
            class UpdateResult:
                def __init__(self, modified):
                    self.modified_count = modified
            return UpdateResult(count)
        
        def delete_one(self, query):
            """MongoDB-like delete_one"""
            obj = None
            if '_id' in query:
                try:
                    obj = self.model_class.query.get(int(query['_id']))
                except:
                    pass
            else:
                q = self.model_class.query
                for key, value in query.items():
                    if hasattr(self.model_class, key):
                        q = q.filter(getattr(self.model_class, key) == value)
                obj = q.first()
            
            if obj:
                db.session.delete(obj)
                db.session.commit()
                
                class DeleteResult:
                    def __init__(self, deleted):
                        self.deleted_count = 1 if deleted else 0
                return DeleteResult(True)
            
            class DeleteResult:
                def __init__(self, deleted):
                    self.deleted_count = 0
            return DeleteResult(False)
        
        def delete_many(self, query):
            """MongoDB-like delete_many"""
            q = self.model_class.query
            for key, value in query.items():
                if hasattr(self.model_class, key):
                    q = q.filter(getattr(self.model_class, key) == value)
            
            count = q.count()
            q.delete()
            db.session.commit()
            
            class DeleteResult:
                def __init__(self, deleted):
                    self.deleted_count = deleted
            return DeleteResult(count)
    
    class CollectionCursor:
        def __init__(self, query, projection=None):
            self.query = query
            self.projection = projection
            self._sort_field = None
            self._sort_direction = 1
        
        def sort(self, field, direction=1):
            """MongoDB-like sort"""
            self._sort_field = field
            self._sort_direction = direction
            return self
        
        def __iter__(self):
            """Make cursor iterable"""
            q = self.query
            if self._sort_field and hasattr(q.column_descriptions[0]['type'], self._sort_field):
                attr = getattr(q.column_descriptions[0]['type'], self._sort_field)
                if self._sort_direction == -1:
                    q = q.order_by(attr.desc())
                else:
                    q = q.order_by(attr)
            
            for obj in q.all():
                result = obj.to_dict() if hasattr(obj, 'to_dict') else {}
                if self.projection and '_id' in self.projection and self.projection['_id'] == 0:
                    result.pop('id', None)
                    result.pop('_id', None)
                yield result
    
    # Map collection names to models
    collection_map = {
        'managers': Manager,
        'stores': Store,
        'employees': Employee,
        'inventory': Inventory,
        'inventory_history': InventoryHistory,
        'timeclock': TimeClock,
        'eod': EOD
    }
    
    if name in collection_map:
        return CollectionWrapper(collection_map[name])
    
    # If collection doesn't exist, return a dummy wrapper
    class DummyModel:
        pass
    return CollectionWrapper(DummyModel)
