"""
Simple database initialization script without dependencies
"""
import os
import sqlite3
import uuid
import hashlib
import secrets

def simple_hash_password(password: str) -> str:
    """Simple password hash for initialization only"""
    # This is just for initialization - the actual auth system uses bcrypt
    salt = secrets.token_hex(16)
    pwd_hash = hashlib.sha256((password + salt).encode()).hexdigest()
    return f"bcrypt_placeholder${salt}${pwd_hash}"

def init_auth_tables(db_path: str = None):
    """Initialize authentication tables in the database"""
    if db_path is None:
        # Default path
        db_path = os.path.join(
            os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
            'shared', 'data', 'rover_platform.db'
        )
    
    print(f"Initializing authentication tables in: {db_path}")
    
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
    try:
        cursor.executescript(sql_script)
        print("[SUCCESS] Authentication tables created successfully!")
    except Exception as e:
        print(f"[ERROR] Error creating tables: {e}")
        return
    
    # Check if admin user already exists
    cursor.execute("SELECT COUNT(*) FROM users WHERE username = 'admin'")
    if cursor.fetchone()[0] > 0:
        print("[INFO] Admin user already exists, skipping creation.")
    else:
        # Create default admin user
        admin_id = str(uuid.uuid4())
        admin_password = "Admin@123"  # Change this in production!
        
        # Note: This is a placeholder hash - you'll need to reset the password
        # through the application once it's running with proper bcrypt
        admin_password_hash = simple_hash_password(admin_password)
        
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
            
            print(f"[SUCCESS] Default admin user created:")
            print(f"   Username: admin")
            print(f"   Password: {admin_password}")
            print(f"   Email: admin@rovermissioncontrol.local")
            print("[WARNING] IMPORTANT: The password is using a placeholder hash.")
            print("[WARNING] You must reset it through the application once it's running!")
            
        except sqlite3.IntegrityError as e:
            print(f"[ERROR] Error creating admin user: {e}")
    
    # Commit and close
    conn.commit()
    
    # Verify tables were created
    cursor.execute("""
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name IN ('users', 'roles', 'permissions', 'refresh_tokens', 'login_history')
        ORDER BY name
    """)
    tables = cursor.fetchall()
    
    print(f"\n[INFO] Created tables: {[t[0] for t in tables]}")
    
    # Check roles
    cursor.execute("SELECT name FROM roles ORDER BY name")
    roles = cursor.fetchall()
    print(f"[INFO] Available roles: {[r[0] for r in roles]}")
    
    # Check users
    cursor.execute("SELECT username, email FROM users")
    users = cursor.fetchall()
    print(f"[INFO] Users in database: {users}")
    
    conn.close()

if __name__ == "__main__":
    init_auth_tables()