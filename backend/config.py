import os
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent  # project root
ENV_PATH = BASE_DIR / ".env"
load_dotenv(ENV_PATH if ENV_PATH.exists() else None)

# Initialize Stripe early to avoid initialization issues
# Import and set API key as early as possible
try:
    import stripe
    STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY", "").strip()
    if STRIPE_SECRET_KEY:
        stripe.api_key = STRIPE_SECRET_KEY
        # Force Stripe to initialize its internal modules by accessing them
        # This ensures all modules are loaded before we try to use them
        try:
            # Test that Stripe is properly initialized by checking a simple attribute
            _ = stripe.api_key
            # Try to access a module to ensure it's loaded
            # This will fail if Stripe isn't properly initialized
            _ = stripe.Customer
            print(f"INFO: Stripe initialized with API key (length: {len(STRIPE_SECRET_KEY)}, starts with: {STRIPE_SECRET_KEY[:7]}...)")
        except (AttributeError, TypeError) as init_error:
            print(f"WARNING: Stripe initialized but internal modules may not be loaded: {init_error}")
            print(f"WARNING: This may cause issues when using Stripe API. Try reinstalling stripe: pip install --upgrade stripe")
    else:
        print("WARNING: STRIPE_SECRET_KEY not found in environment variables")
except ImportError:
    print("WARNING: Stripe library not installed")
    print("WARNING: Install with: pip install stripe")
    stripe = None
except Exception as e:
    print(f"WARNING: Error initializing Stripe: {e}")
    import traceback
    traceback.print_exc()
    stripe = None


class Config:
    BASE_DIR = BASE_DIR
    
    # PostgreSQL Database Configuration
    # Format: postgresql://username:password@localhost:5432/database_name
    # Default falls back to SQLite for easy setup
    SQLALCHEMY_DATABASE_URI = os.getenv(
        "DATABASE_URL",
        os.getenv("POSTGRESQL_URI", f"sqlite:///{BASE_DIR / 'timetrack.db'}")
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {
        "pool_pre_ping": True,  # Enable connection health checks
        "pool_recycle": 300,    # Recycle connections after 5 minutes
    }
    
    # SECURITY WARNING: Never use the default "dev-key" in production!
    # Set SECRET_KEY environment variable to a strong random string (min 32 chars)
    SECRET_KEY = os.getenv("SECRET_KEY")
    
    # Super Admin credentials (for managing managers)
    SUPER_ADMIN_USERNAME = os.getenv('SUPER_ADMIN_USERNAME', 'superadmin')
    SUPER_ADMIN_PASSWORD = os.getenv('SUPER_ADMIN_PASSWORD', 'superadmin123')
    
    # Stripe configuration
    STRIPE_SECRET_KEY = STRIPE_SECRET_KEY
    
    # Upload directories
    UPLOAD_DIR = BASE_DIR / "uploads"
    UPLOAD_DIR.mkdir(exist_ok=True)
    
    # Note: Legacy YubiKey environment variables are ignored
    