import os
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent  # project root
ENV_PATH = BASE_DIR / ".env"
load_dotenv(ENV_PATH if ENV_PATH.exists() else None)


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
    
    # Note: Legacy YubiKey environment variables are ignored
    