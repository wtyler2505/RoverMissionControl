"""
Initialize authentication database tables and create default admin user
"""
import os
import sys
import sqlite3
import uuid
from pathlib import Path

# Import hash_password directly to avoid circular imports
from passlib.context import CryptContext
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto", bcrypt__rounds=12)

def hash_password(password: str) -> str:
    """Hash a password using bcrypt"""
    return pwd_context.hash(password)

def init_auth_tables(db_path: str = None):
    """Initialize authentication tables in the database"""
    if db_path is None:
        # Default path
        db_path = os.path.join(
            os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
            'shared', 'data', 'rover_platform.db'
        )
    
    # Ensure directory exists
    os.makedirs(os.path.dirname(db_path), exist_ok=True)
    
    # Connect to database
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Read and execute SQL file
    sql_file = os.path.join(os.path.dirname(__file__), 'create_tables.sql')
    with open(sql_file, 'r') as f:
        sql_script = f.read()
    
    # Execute the script
    cursor.executescript(sql_script)
    
    # Create default admin user
    admin_id = str(uuid.uuid4())
    admin_password = "Admin@123"  # Change this in production!
    admin_password_hash = hash_password(admin_password)
    
    try:
        cursor.execute("""
            INSERT INTO users (
                id, email, username, password_hash, full_name, 
                is_active, is_verified, email_verified_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        """, (
            admin_id,
            "admin@rovermissioncontrol.local",
            "admin",
            admin_password_hash,
            "System Administrator",
            1,  # is_active
            1   # is_verified
        ))
        
        # Assign admin role
        cursor.execute("""
            INSERT INTO user_roles (user_id, role_id)
            SELECT ?, id FROM roles WHERE name = 'admin'
        """, (admin_id,))
        
        print("✅ Authentication tables created successfully!")
        print(f"✅ Default admin user created:")
        print(f"   Username: admin")
        print(f"   Password: {admin_password}")
        print(f"   Email: admin@rovermissioncontrol.local")
        print("⚠️  IMPORTANT: Change the admin password after first login!")
        
    except sqlite3.IntegrityError:
        print("ℹ️  Admin user already exists, skipping creation.")
    
    # Commit and close
    conn.commit()
    conn.close()
    
    print(f"\n📁 Database location: {db_path}")
    
    # Verify tables were created
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Check tables
    cursor.execute("""
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name IN ('users', 'roles', 'permissions', 'refresh_tokens', 'login_history')
        ORDER BY name
    """)
    tables = cursor.fetchall()
    
    print(f"\n📊 Created tables: {[t[0] for t in tables]}")
    
    # Check roles
    cursor.execute("SELECT name FROM roles ORDER BY name")
    roles = cursor.fetchall()
    print(f"👥 Available roles: {[r[0] for r in roles]}")
    
    conn.close()

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Initialize authentication database")
    parser.add_argument(
        "--db-path", 
        help="Path to database file",
        default=None
    )
    
    args = parser.parse_args()
    init_auth_tables(args.db_path)