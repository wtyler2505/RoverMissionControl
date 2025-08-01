"""
AES-256 encrypted log storage with key management
"""
import os
import json
import base64
import hashlib
from typing import Dict, Any, Optional, List, Tuple
from datetime import datetime, timezone, timedelta
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.primitives import padding as sym_padding
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.fernet import Fernet
import secrets
import threading
from dataclasses import dataclass, asdict
import sqlite3


@dataclass
class EncryptedLogEntry:
    """Encrypted log entry with metadata"""
    id: str
    timestamp: str
    encrypted_data: bytes
    iv: bytes
    tag: bytes
    key_version: int
    metadata: Dict[str, Any]


class KeyManager:
    """Manages encryption keys with rotation support"""
    
    def __init__(self, key_store_path: str):
        self.key_store_path = key_store_path
        self.current_key_version = 1
        self.keys: Dict[int, bytes] = {}
        self.lock = threading.Lock()
        
        # Create key store directory
        os.makedirs(os.path.dirname(key_store_path), exist_ok=True)
        
        # Load or generate master key
        self._load_or_generate_keys()
        
    def _load_or_generate_keys(self):
        """Load existing keys or generate new ones"""
        if os.path.exists(self.key_store_path):
            with open(self.key_store_path, 'rb') as f:
                key_data = json.loads(f.read().decode())
                self.current_key_version = key_data['current_version']
                self.keys = {
                    int(k): base64.b64decode(v) 
                    for k, v in key_data['keys'].items()
                }
        else:
            # Generate initial key
            self.keys[1] = secrets.token_bytes(32)  # 256-bit key
            self._save_keys()
            
    def _save_keys(self):
        """Save keys to secure storage"""
        key_data = {
            'current_version': self.current_key_version,
            'keys': {
                str(k): base64.b64encode(v).decode()
                for k, v in self.keys.items()
            }
        }
        
        # Save with restricted permissions
        with open(self.key_store_path, 'wb') as f:
            f.write(json.dumps(key_data).encode())
        os.chmod(self.key_store_path, 0o600)
        
    def get_current_key(self) -> Tuple[int, bytes]:
        """Get current encryption key"""
        with self.lock:
            return self.current_key_version, self.keys[self.current_key_version]
            
    def get_key(self, version: int) -> Optional[bytes]:
        """Get specific key version"""
        with self.lock:
            return self.keys.get(version)
            
    def rotate_key(self) -> int:
        """Generate new key version"""
        with self.lock:
            self.current_key_version += 1
            self.keys[self.current_key_version] = secrets.token_bytes(32)
            self._save_keys()
            return self.current_key_version


class EncryptedLogStore:
    """
    Provides AES-256-GCM encryption for log entries with:
    - Authenticated encryption
    - Key rotation support
    - Secure key storage
    - Metadata preservation
    """
    
    def __init__(self,
                 store_id: str,
                 storage_path: str = "/var/log/rover/encrypted",
                 key_store_path: str = "/var/log/rover/keys/master.key",
                 rotation_interval_days: int = 30):
        """
        Initialize encrypted log store
        
        Args:
            store_id: Unique identifier for this store
            storage_path: Path for encrypted log storage
            key_store_path: Path for key storage
            rotation_interval_days: Days between key rotations
        """
        self.store_id = store_id
        self.storage_path = storage_path
        self.rotation_interval_days = rotation_interval_days
        
        # Initialize key manager
        self.key_manager = KeyManager(key_store_path)
        
        # Create storage directory
        os.makedirs(storage_path, exist_ok=True)
        
        # Initialize database for metadata
        self.db_path = os.path.join(storage_path, f"{store_id}_metadata.db")
        self._init_database()
        
        # Check for key rotation
        self._check_key_rotation()
        
    def _init_database(self):
        """Initialize metadata database"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS encrypted_logs (
                id TEXT PRIMARY KEY,
                timestamp TEXT NOT NULL,
                event_type TEXT,
                severity TEXT,
                actor TEXT,
                correlation_id TEXT,
                file_path TEXT NOT NULL,
                key_version INTEGER NOT NULL,
                iv TEXT NOT NULL,
                tag TEXT NOT NULL,
                metadata TEXT,
                created_at TEXT NOT NULL
            )
        """)
        
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_timestamp ON encrypted_logs(timestamp)
        """)
        
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_event_type ON encrypted_logs(event_type)
        """)
        
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_actor ON encrypted_logs(actor)
        """)
        
        conn.commit()
        conn.close()
        
    def _check_key_rotation(self):
        """Check if key rotation is needed"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # Get last rotation time
        cursor.execute("""
            SELECT MAX(created_at) FROM encrypted_logs 
            WHERE key_version = ?
        """, (self.key_manager.current_key_version,))
        
        result = cursor.fetchone()
        conn.close()
        
        if result and result[0]:
            last_use = datetime.fromisoformat(result[0].replace('Z', '+00:00'))
            if datetime.now(timezone.utc) - last_use > timedelta(days=self.rotation_interval_days):
                self.key_manager.rotate_key()
                
    def encrypt_log(self,
                   log_data: Dict[str, Any],
                   event_type: Optional[str] = None,
                   severity: Optional[str] = None,
                   actor: Optional[str] = None,
                   correlation_id: Optional[str] = None) -> str:
        """
        Encrypt and store log entry
        
        Args:
            log_data: Log data to encrypt
            event_type: Type of event
            severity: Severity level
            actor: User or system that triggered event
            correlation_id: Correlation ID
            
        Returns:
            Unique ID of encrypted entry
        """
        # Generate unique ID
        entry_id = secrets.token_urlsafe(16)
        timestamp = datetime.now(timezone.utc).isoformat()
        
        # Get current key
        key_version, key = self.key_manager.get_current_key()
        
        # Serialize log data
        plaintext = json.dumps(log_data, sort_keys=True).encode()
        
        # Generate IV
        iv = secrets.token_bytes(12)  # 96-bit IV for GCM
        
        # Encrypt using AES-GCM
        aesgcm = AESGCM(key)
        
        # Add authenticated data
        aad = json.dumps({
            'id': entry_id,
            'timestamp': timestamp,
            'event_type': event_type,
            'severity': severity,
            'actor': actor,
            'correlation_id': correlation_id
        }).encode()
        
        # Encrypt
        ciphertext = aesgcm.encrypt(iv, plaintext, aad)
        
        # Note: GCM mode includes the tag in the ciphertext
        # Last 16 bytes are the authentication tag
        encrypted_data = ciphertext[:-16]
        tag = ciphertext[-16:]
        
        # Save encrypted file
        file_name = f"{entry_id}.enc"
        file_path = os.path.join(self.storage_path, file_name)
        
        with open(file_path, 'wb') as f:
            f.write(encrypted_data)
            
        # Save metadata to database
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute("""
            INSERT INTO encrypted_logs (
                id, timestamp, event_type, severity, actor, 
                correlation_id, file_path, key_version, iv, tag, 
                metadata, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            entry_id,
            timestamp,
            event_type,
            severity,
            actor,
            correlation_id,
            file_path,
            key_version,
            base64.b64encode(iv).decode(),
            base64.b64encode(tag).decode(),
            json.dumps({'size': len(encrypted_data)}),
            datetime.now(timezone.utc).isoformat()
        ))
        
        conn.commit()
        conn.close()
        
        return entry_id
        
    def decrypt_log(self, entry_id: str) -> Optional[Dict[str, Any]]:
        """
        Decrypt log entry
        
        Args:
            entry_id: ID of entry to decrypt
            
        Returns:
            Decrypted log data or None if not found
        """
        # Get metadata
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT timestamp, event_type, severity, actor, correlation_id,
                   file_path, key_version, iv, tag
            FROM encrypted_logs
            WHERE id = ?
        """, (entry_id,))
        
        result = cursor.fetchone()
        conn.close()
        
        if not result:
            return None
            
        (timestamp, event_type, severity, actor, correlation_id,
         file_path, key_version, iv_b64, tag_b64) = result
         
        # Get decryption key
        key = self.key_manager.get_key(key_version)
        if not key:
            raise ValueError(f"Key version {key_version} not found")
            
        # Read encrypted data
        with open(file_path, 'rb') as f:
            encrypted_data = f.read()
            
        # Decode IV and tag
        iv = base64.b64decode(iv_b64)
        tag = base64.b64decode(tag_b64)
        
        # Reconstruct ciphertext with tag
        ciphertext = encrypted_data + tag
        
        # Reconstruct AAD
        aad = json.dumps({
            'id': entry_id,
            'timestamp': timestamp,
            'event_type': event_type,
            'severity': severity,
            'actor': actor,
            'correlation_id': correlation_id
        }).encode()
        
        # Decrypt
        aesgcm = AESGCM(key)
        try:
            plaintext = aesgcm.decrypt(iv, ciphertext, aad)
            return json.loads(plaintext.decode())
        except Exception as e:
            raise ValueError(f"Decryption failed: {e}")
            
    def search_logs(self,
                   start_time: Optional[datetime] = None,
                   end_time: Optional[datetime] = None,
                   event_type: Optional[str] = None,
                   severity: Optional[str] = None,
                   actor: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Search encrypted logs by metadata
        
        Args:
            start_time: Start time filter
            end_time: End time filter
            event_type: Event type filter
            severity: Severity filter
            actor: Actor filter
            
        Returns:
            List of matching log metadata (not decrypted)
        """
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        query = "SELECT id, timestamp, event_type, severity, actor, correlation_id FROM encrypted_logs WHERE 1=1"
        params = []
        
        if start_time:
            query += " AND timestamp >= ?"
            params.append(start_time.isoformat())
            
        if end_time:
            query += " AND timestamp <= ?"
            params.append(end_time.isoformat())
            
        if event_type:
            query += " AND event_type = ?"
            params.append(event_type)
            
        if severity:
            query += " AND severity = ?"
            params.append(severity)
            
        if actor:
            query += " AND actor = ?"
            params.append(actor)
            
        query += " ORDER BY timestamp DESC"
        
        cursor.execute(query, params)
        results = cursor.fetchall()
        conn.close()
        
        return [
            {
                'id': r[0],
                'timestamp': r[1],
                'event_type': r[2],
                'severity': r[3],
                'actor': r[4],
                'correlation_id': r[5]
            }
            for r in results
        ]
        
    def verify_integrity(self, entry_id: str) -> bool:
        """
        Verify integrity of encrypted log entry
        
        Args:
            entry_id: ID of entry to verify
            
        Returns:
            True if integrity is intact
        """
        try:
            # Attempt to decrypt - this verifies the authentication tag
            self.decrypt_log(entry_id)
            return True
        except:
            return False
            
    def export_logs(self,
                   output_path: str,
                   start_time: Optional[datetime] = None,
                   end_time: Optional[datetime] = None,
                   decrypt: bool = False) -> int:
        """
        Export logs to file
        
        Args:
            output_path: Path for export file
            start_time: Start time filter
            end_time: End time filter
            decrypt: Whether to decrypt logs in export
            
        Returns:
            Number of logs exported
        """
        logs = self.search_logs(start_time, end_time)
        
        export_data = []
        for log_meta in logs:
            if decrypt:
                try:
                    decrypted = self.decrypt_log(log_meta['id'])
                    log_meta['decrypted_data'] = decrypted
                except:
                    log_meta['decryption_error'] = True
                    
            export_data.append(log_meta)
            
        with open(output_path, 'w') as f:
            json.dump({
                'store_id': self.store_id,
                'export_time': datetime.now(timezone.utc).isoformat(),
                'count': len(export_data),
                'logs': export_data
            }, f, indent=2)
            
        return len(export_data)