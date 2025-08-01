"""
Blockchain-style hash chain implementation for tamper-proof logging
"""
import hashlib
import json
import time
import hmac
import base64
from typing import Dict, Any, Optional, List, Tuple
from datetime import datetime, timezone
from dataclasses import dataclass, asdict
import threading
import pickle
import os
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import rsa, padding
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.backends import default_backend
from cryptography.exceptions import InvalidSignature


@dataclass
class LogEntry:
    """Represents a single log entry in the hash chain"""
    index: int
    timestamp: str
    event_type: str
    severity: str
    data: Dict[str, Any]
    actor: Optional[str]
    correlation_id: Optional[str]
    previous_hash: str
    nonce: int
    hash: Optional[str] = None
    signature: Optional[str] = None


class HashChainLogger:
    """
    Implements a blockchain-style hash chain for tamper-proof logging.
    Each log entry contains a hash of the previous entry, creating an 
    immutable chain that can detect any tampering attempts.
    """
    
    def __init__(self, 
                 chain_id: str,
                 storage_path: str = "/var/log/rover/hashchain",
                 private_key_path: Optional[str] = None,
                 difficulty: int = 4):
        """
        Initialize hash chain logger
        
        Args:
            chain_id: Unique identifier for this hash chain
            storage_path: Base path for storing chain data
            private_key_path: Path to RSA private key for signing
            difficulty: Proof-of-work difficulty (number of leading zeros)
        """
        self.chain_id = chain_id
        self.storage_path = storage_path
        self.difficulty = difficulty
        self.chain: List[LogEntry] = []
        self.index_counter = 0
        self.lock = threading.Lock()
        
        # Create storage directory
        os.makedirs(storage_path, exist_ok=True)
        
        # Load or generate signing keys
        self.private_key = None
        self.public_key = None
        if private_key_path:
            self._load_signing_keys(private_key_path)
        else:
            self._generate_signing_keys()
            
        # Initialize or load existing chain
        self._load_chain()
        
    def _generate_signing_keys(self):
        """Generate RSA key pair for signing log entries"""
        self.private_key = rsa.generate_private_key(
            public_exponent=65537,
            key_size=2048,
            backend=default_backend()
        )
        self.public_key = self.private_key.public_key()
        
        # Save keys
        private_path = os.path.join(self.storage_path, f"{self.chain_id}_private.pem")
        public_path = os.path.join(self.storage_path, f"{self.chain_id}_public.pem")
        
        # Save private key
        with open(private_path, 'wb') as f:
            f.write(self.private_key.private_bytes(
                encoding=serialization.Encoding.PEM,
                format=serialization.PrivateFormat.PKCS8,
                encryption_algorithm=serialization.NoEncryption()
            ))
            
        # Save public key
        with open(public_path, 'wb') as f:
            f.write(self.public_key.public_bytes(
                encoding=serialization.Encoding.PEM,
                format=serialization.PublicFormat.SubjectPublicKeyInfo
            ))
            
    def _load_signing_keys(self, private_key_path: str):
        """Load RSA keys from files"""
        with open(private_key_path, 'rb') as f:
            self.private_key = serialization.load_pem_private_key(
                f.read(),
                password=None,
                backend=default_backend()
            )
        self.public_key = self.private_key.public_key()
        
    def _calculate_hash(self, entry: LogEntry) -> str:
        """Calculate SHA-256 hash of log entry"""
        # Create deterministic JSON representation
        entry_dict = {
            'index': entry.index,
            'timestamp': entry.timestamp,
            'event_type': entry.event_type,
            'severity': entry.severity,
            'data': entry.data,
            'actor': entry.actor,
            'correlation_id': entry.correlation_id,
            'previous_hash': entry.previous_hash,
            'nonce': entry.nonce
        }
        
        # Sort keys for deterministic ordering
        entry_json = json.dumps(entry_dict, sort_keys=True)
        return hashlib.sha256(entry_json.encode()).hexdigest()
        
    def _proof_of_work(self, entry: LogEntry) -> int:
        """
        Find nonce that produces hash with required difficulty
        (leading zeros)
        """
        nonce = 0
        target = '0' * self.difficulty
        
        while True:
            entry.nonce = nonce
            hash_value = self._calculate_hash(entry)
            if hash_value.startswith(target):
                return nonce
            nonce += 1
            
    def _sign_entry(self, entry: LogEntry) -> str:
        """Sign log entry with private key"""
        if not self.private_key:
            return ""
            
        # Create message from entry hash
        message = entry.hash.encode()
        
        # Sign the message
        signature = self.private_key.sign(
            message,
            padding.PSS(
                mgf=padding.MGF1(hashes.SHA256()),
                salt_length=padding.PSS.MAX_LENGTH
            ),
            hashes.SHA256()
        )
        
        return base64.b64encode(signature).decode()
        
    def add_entry(self,
                  event_type: str,
                  severity: str,
                  data: Dict[str, Any],
                  actor: Optional[str] = None,
                  correlation_id: Optional[str] = None) -> LogEntry:
        """
        Add new entry to the hash chain
        
        Args:
            event_type: Type of event (e.g., 'emergency_stop', 'auth_failure')
            severity: Severity level ('critical', 'high', 'medium', 'low')
            data: Event data dictionary
            actor: User or system that triggered the event
            correlation_id: ID to correlate related events
            
        Returns:
            Created log entry
        """
        with self.lock:
            # Get previous hash
            previous_hash = "0" * 64  # Genesis block
            if self.chain:
                previous_hash = self.chain[-1].hash
                
            # Create new entry
            entry = LogEntry(
                index=self.index_counter,
                timestamp=datetime.now(timezone.utc).isoformat(),
                event_type=event_type,
                severity=severity,
                data=data,
                actor=actor,
                correlation_id=correlation_id,
                previous_hash=previous_hash,
                nonce=0
            )
            
            # Proof of work
            self._proof_of_work(entry)
            
            # Calculate final hash
            entry.hash = self._calculate_hash(entry)
            
            # Sign the entry
            entry.signature = self._sign_entry(entry)
            
            # Add to chain
            self.chain.append(entry)
            self.index_counter += 1
            
            # Persist to disk
            self._save_entry(entry)
            
            return entry
            
    def _save_entry(self, entry: LogEntry):
        """Save entry to disk"""
        filename = os.path.join(
            self.storage_path,
            f"{self.chain_id}_{entry.index:08d}.log"
        )
        
        with open(filename, 'wb') as f:
            pickle.dump(asdict(entry), f)
            
    def _load_chain(self):
        """Load existing chain from disk"""
        entries = []
        
        # Find all log files
        for filename in sorted(os.listdir(self.storage_path)):
            if filename.startswith(f"{self.chain_id}_") and filename.endswith(".log"):
                filepath = os.path.join(self.storage_path, filename)
                try:
                    with open(filepath, 'rb') as f:
                        entry_dict = pickle.load(f)
                        entry = LogEntry(**entry_dict)
                        entries.append(entry)
                except Exception as e:
                    print(f"Error loading {filename}: {e}")
                    
        # Rebuild chain
        if entries:
            self.chain = sorted(entries, key=lambda x: x.index)
            self.index_counter = self.chain[-1].index + 1
            
    def verify_chain(self, start_index: int = 0) -> Tuple[bool, List[str]]:
        """
        Verify integrity of the hash chain
        
        Args:
            start_index: Index to start verification from
            
        Returns:
            Tuple of (is_valid, list_of_errors)
        """
        errors = []
        
        with self.lock:
            for i in range(start_index, len(self.chain)):
                entry = self.chain[i]
                
                # Verify hash
                calculated_hash = self._calculate_hash(entry)
                if calculated_hash != entry.hash:
                    errors.append(f"Entry {i}: Hash mismatch")
                    
                # Verify proof of work
                if not entry.hash.startswith('0' * self.difficulty):
                    errors.append(f"Entry {i}: Invalid proof of work")
                    
                # Verify chain linkage
                if i > 0:
                    if entry.previous_hash != self.chain[i-1].hash:
                        errors.append(f"Entry {i}: Chain linkage broken")
                else:
                    # Genesis block
                    if entry.previous_hash != "0" * 64:
                        errors.append(f"Entry {i}: Invalid genesis block")
                        
                # Verify signature if present
                if entry.signature and self.public_key:
                    try:
                        self.public_key.verify(
                            base64.b64decode(entry.signature),
                            entry.hash.encode(),
                            padding.PSS(
                                mgf=padding.MGF1(hashes.SHA256()),
                                salt_length=padding.PSS.MAX_LENGTH
                            ),
                            hashes.SHA256()
                        )
                    except InvalidSignature:
                        errors.append(f"Entry {i}: Invalid signature")
                        
        return len(errors) == 0, errors
        
    def get_entries(self,
                   start_time: Optional[datetime] = None,
                   end_time: Optional[datetime] = None,
                   event_type: Optional[str] = None,
                   severity: Optional[str] = None,
                   actor: Optional[str] = None) -> List[LogEntry]:
        """
        Query log entries with filters
        
        Args:
            start_time: Start time filter
            end_time: End time filter
            event_type: Event type filter
            severity: Severity filter
            actor: Actor filter
            
        Returns:
            Filtered list of log entries
        """
        with self.lock:
            results = []
            
            for entry in self.chain:
                # Time filter
                entry_time = datetime.fromisoformat(entry.timestamp.replace('Z', '+00:00'))
                if start_time and entry_time < start_time:
                    continue
                if end_time and entry_time > end_time:
                    continue
                    
                # Type filter
                if event_type and entry.event_type != event_type:
                    continue
                    
                # Severity filter
                if severity and entry.severity != severity:
                    continue
                    
                # Actor filter
                if actor and entry.actor != actor:
                    continue
                    
                results.append(entry)
                
            return results
            
    def export_chain(self, output_path: str, format: str = 'json'):
        """
        Export entire chain for backup or analysis
        
        Args:
            output_path: Path to export file
            format: Export format ('json', 'csv', 'binary')
        """
        with self.lock:
            if format == 'json':
                with open(output_path, 'w') as f:
                    chain_data = [asdict(entry) for entry in self.chain]
                    json.dump({
                        'chain_id': self.chain_id,
                        'difficulty': self.difficulty,
                        'entries': chain_data
                    }, f, indent=2)
                    
            elif format == 'csv':
                import csv
                with open(output_path, 'w', newline='') as f:
                    if self.chain:
                        writer = csv.DictWriter(f, fieldnames=asdict(self.chain[0]).keys())
                        writer.writeheader()
                        for entry in self.chain:
                            writer.writerow(asdict(entry))
                            
            elif format == 'binary':
                with open(output_path, 'wb') as f:
                    pickle.dump({
                        'chain_id': self.chain_id,
                        'difficulty': self.difficulty,
                        'chain': self.chain
                    }, f)
                    
    def get_merkle_root(self) -> str:
        """Calculate Merkle root of the current chain"""
        if not self.chain:
            return "0" * 64
            
        # Get all hashes
        hashes = [entry.hash for entry in self.chain]
        
        # Build Merkle tree
        while len(hashes) > 1:
            # Pad with last hash if odd number
            if len(hashes) % 2 == 1:
                hashes.append(hashes[-1])
                
            # Combine pairs
            new_hashes = []
            for i in range(0, len(hashes), 2):
                combined = hashes[i] + hashes[i+1]
                new_hash = hashlib.sha256(combined.encode()).hexdigest()
                new_hashes.append(new_hash)
                
            hashes = new_hashes
            
        return hashes[0]