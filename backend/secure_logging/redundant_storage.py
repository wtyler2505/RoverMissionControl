"""
Redundant storage across multiple locations with automatic failover
"""
import os
import shutil
import hashlib
import json
import threading
import time
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime, timezone
from dataclasses import dataclass
from concurrent.futures import ThreadPoolExecutor, as_completed
import sqlite3
from pathlib import Path
import boto3
from azure.storage.blob import BlobServiceClient
import paramiko


@dataclass
class StorageLocation:
    """Represents a storage location"""
    id: str
    type: str  # 'local', 's3', 'azure', 'sftp', 'network'
    config: Dict[str, Any]
    priority: int
    is_active: bool = True
    last_check: Optional[datetime] = None
    last_error: Optional[str] = None


class StorageBackend:
    """Base class for storage backends"""
    
    def write(self, path: str, data: bytes) -> bool:
        raise NotImplementedError
        
    def read(self, path: str) -> Optional[bytes]:
        raise NotImplementedError
        
    def delete(self, path: str) -> bool:
        raise NotImplementedError
        
    def exists(self, path: str) -> bool:
        raise NotImplementedError
        
    def list_files(self, prefix: str) -> List[str]:
        raise NotImplementedError
        
    def health_check(self) -> bool:
        raise NotImplementedError


class LocalStorageBackend(StorageBackend):
    """Local filesystem storage"""
    
    def __init__(self, base_path: str):
        self.base_path = base_path
        os.makedirs(base_path, exist_ok=True)
        
    def write(self, path: str, data: bytes) -> bool:
        try:
            full_path = os.path.join(self.base_path, path)
            os.makedirs(os.path.dirname(full_path), exist_ok=True)
            with open(full_path, 'wb') as f:
                f.write(data)
            return True
        except Exception:
            return False
            
    def read(self, path: str) -> Optional[bytes]:
        try:
            full_path = os.path.join(self.base_path, path)
            with open(full_path, 'rb') as f:
                return f.read()
        except Exception:
            return None
            
    def delete(self, path: str) -> bool:
        try:
            full_path = os.path.join(self.base_path, path)
            os.unlink(full_path)
            return True
        except Exception:
            return False
            
    def exists(self, path: str) -> bool:
        return os.path.exists(os.path.join(self.base_path, path))
        
    def list_files(self, prefix: str) -> List[str]:
        results = []
        base = Path(self.base_path)
        for p in base.rglob(f"{prefix}*"):
            if p.is_file():
                results.append(str(p.relative_to(base)))
        return results
        
    def health_check(self) -> bool:
        try:
            test_file = os.path.join(self.base_path, '.health_check')
            with open(test_file, 'w') as f:
                f.write('ok')
            os.unlink(test_file)
            return True
        except Exception:
            return False


class S3StorageBackend(StorageBackend):
    """AWS S3 storage"""
    
    def __init__(self, bucket: str, prefix: str = "", region: str = "us-east-1",
                 access_key: Optional[str] = None, secret_key: Optional[str] = None):
        self.bucket = bucket
        self.prefix = prefix
        
        if access_key and secret_key:
            self.s3 = boto3.client(
                's3',
                region_name=region,
                aws_access_key_id=access_key,
                aws_secret_access_key=secret_key
            )
        else:
            self.s3 = boto3.client('s3', region_name=region)
            
    def _full_key(self, path: str) -> str:
        return f"{self.prefix}/{path}" if self.prefix else path
        
    def write(self, path: str, data: bytes) -> bool:
        try:
            self.s3.put_object(
                Bucket=self.bucket,
                Key=self._full_key(path),
                Body=data,
                ServerSideEncryption='AES256'
            )
            return True
        except Exception:
            return False
            
    def read(self, path: str) -> Optional[bytes]:
        try:
            response = self.s3.get_object(
                Bucket=self.bucket,
                Key=self._full_key(path)
            )
            return response['Body'].read()
        except Exception:
            return None
            
    def delete(self, path: str) -> bool:
        try:
            self.s3.delete_object(
                Bucket=self.bucket,
                Key=self._full_key(path)
            )
            return True
        except Exception:
            return False
            
    def exists(self, path: str) -> bool:
        try:
            self.s3.head_object(
                Bucket=self.bucket,
                Key=self._full_key(path)
            )
            return True
        except:
            return False
            
    def list_files(self, prefix: str) -> List[str]:
        try:
            results = []
            paginator = self.s3.get_paginator('list_objects_v2')
            
            for page in paginator.paginate(
                Bucket=self.bucket,
                Prefix=self._full_key(prefix)
            ):
                if 'Contents' in page:
                    for obj in page['Contents']:
                        key = obj['Key']
                        if self.prefix:
                            key = key[len(self.prefix)+1:]
                        results.append(key)
            return results
        except Exception:
            return []
            
    def health_check(self) -> bool:
        try:
            self.s3.head_bucket(Bucket=self.bucket)
            return True
        except Exception:
            return False


class AzureStorageBackend(StorageBackend):
    """Azure Blob storage"""
    
    def __init__(self, account_name: str, container: str, prefix: str = "",
                 account_key: Optional[str] = None, sas_token: Optional[str] = None):
        self.container = container
        self.prefix = prefix
        
        if account_key:
            conn_str = f"DefaultEndpointsProtocol=https;AccountName={account_name};AccountKey={account_key};EndpointSuffix=core.windows.net"
        elif sas_token:
            conn_str = f"BlobEndpoint=https://{account_name}.blob.core.windows.net/;SharedAccessSignature={sas_token}"
        else:
            raise ValueError("Either account_key or sas_token required")
            
        self.blob_service = BlobServiceClient.from_connection_string(conn_str)
        self.container_client = self.blob_service.get_container_client(container)
        
    def _full_key(self, path: str) -> str:
        return f"{self.prefix}/{path}" if self.prefix else path
        
    def write(self, path: str, data: bytes) -> bool:
        try:
            blob_client = self.container_client.get_blob_client(self._full_key(path))
            blob_client.upload_blob(data, overwrite=True)
            return True
        except Exception:
            return False
            
    def read(self, path: str) -> Optional[bytes]:
        try:
            blob_client = self.container_client.get_blob_client(self._full_key(path))
            return blob_client.download_blob().readall()
        except Exception:
            return None
            
    def delete(self, path: str) -> bool:
        try:
            blob_client = self.container_client.get_blob_client(self._full_key(path))
            blob_client.delete_blob()
            return True
        except Exception:
            return False
            
    def exists(self, path: str) -> bool:
        try:
            blob_client = self.container_client.get_blob_client(self._full_key(path))
            blob_client.get_blob_properties()
            return True
        except:
            return False
            
    def list_files(self, prefix: str) -> List[str]:
        try:
            results = []
            for blob in self.container_client.list_blobs(
                name_starts_with=self._full_key(prefix)
            ):
                name = blob.name
                if self.prefix:
                    name = name[len(self.prefix)+1:]
                results.append(name)
            return results
        except Exception:
            return []
            
    def health_check(self) -> bool:
        try:
            self.container_client.get_container_properties()
            return True
        except Exception:
            return False


class RedundantStorageManager:
    """
    Manages redundant storage across multiple locations with:
    - Automatic failover
    - Health monitoring
    - Consistency checking
    - Replication management
    """
    
    def __init__(self, 
                 manager_id: str,
                 locations: List[StorageLocation],
                 replication_factor: int = 3,
                 consistency_check_interval: int = 3600):
        """
        Initialize redundant storage manager
        
        Args:
            manager_id: Unique identifier
            locations: List of storage locations
            replication_factor: Number of copies to maintain
            consistency_check_interval: Seconds between consistency checks
        """
        self.manager_id = manager_id
        self.locations = sorted(locations, key=lambda x: x.priority)
        self.replication_factor = min(replication_factor, len(locations))
        self.consistency_check_interval = consistency_check_interval
        
        # Initialize backends
        self.backends: Dict[str, StorageBackend] = {}
        self._init_backends()
        
        # Tracking
        self.write_queue = []
        self.lock = threading.Lock()
        
        # Start health monitor
        self.health_thread = threading.Thread(
            target=self._health_monitor_loop,
            daemon=True
        )
        self.health_thread.start()
        
        # Start consistency checker
        self.consistency_thread = threading.Thread(
            target=self._consistency_check_loop,
            daemon=True
        )
        self.consistency_thread.start()
        
    def _init_backends(self):
        """Initialize storage backends"""
        for location in self.locations:
            try:
                if location.type == 'local':
                    backend = LocalStorageBackend(location.config['path'])
                elif location.type == 's3':
                    backend = S3StorageBackend(**location.config)
                elif location.type == 'azure':
                    backend = AzureStorageBackend(**location.config)
                else:
                    continue
                    
                self.backends[location.id] = backend
                location.is_active = backend.health_check()
            except Exception as e:
                location.is_active = False
                location.last_error = str(e)
                
    def write_redundant(self, path: str, data: bytes) -> Tuple[bool, List[str]]:
        """
        Write data to multiple locations
        
        Args:
            path: Storage path
            data: Data to write
            
        Returns:
            Tuple of (success, list of location IDs where written)
        """
        # Calculate checksum
        checksum = hashlib.sha256(data).hexdigest()
        
        # Get active locations
        active_locations = [
            loc for loc in self.locations 
            if loc.is_active and loc.id in self.backends
        ]
        
        if len(active_locations) < self.replication_factor:
            # Try to reactivate some locations
            self._check_health()
            active_locations = [
                loc for loc in self.locations 
                if loc.is_active and loc.id in self.backends
            ]
            
        # Write to locations
        written_locations = []
        errors = []
        
        with ThreadPoolExecutor(max_workers=self.replication_factor) as executor:
            futures = {}
            
            for i, location in enumerate(active_locations[:self.replication_factor]):
                backend = self.backends[location.id]
                future = executor.submit(self._write_with_verification, 
                                       backend, path, data, checksum)
                futures[future] = location
                
            for future in as_completed(futures):
                location = futures[future]
                try:
                    success = future.result()
                    if success:
                        written_locations.append(location.id)
                    else:
                        errors.append((location.id, "Write failed"))
                except Exception as e:
                    errors.append((location.id, str(e)))
                    
        # Record write metadata
        self._record_write(path, checksum, written_locations)
        
        return len(written_locations) >= 1, written_locations
        
    def _write_with_verification(self, backend: StorageBackend, 
                                path: str, data: bytes, checksum: str) -> bool:
        """Write and verify data"""
        if not backend.write(path, data):
            return False
            
        # Verify write
        read_data = backend.read(path)
        if not read_data:
            return False
            
        return hashlib.sha256(read_data).hexdigest() == checksum
        
    def read_redundant(self, path: str) -> Optional[bytes]:
        """
        Read data from first available location
        
        Args:
            path: Storage path
            
        Returns:
            Data or None if not found
        """
        for location in self.locations:
            if not location.is_active or location.id not in self.backends:
                continue
                
            backend = self.backends[location.id]
            try:
                data = backend.read(path)
                if data:
                    return data
            except Exception:
                continue
                
        return None
        
    def verify_redundancy(self, path: str) -> Dict[str, Any]:
        """
        Verify redundancy of a file
        
        Args:
            path: Storage path
            
        Returns:
            Verification results
        """
        results = {
            'path': path,
            'locations': {},
            'checksums': {},
            'is_consistent': True,
            'replication_count': 0
        }
        
        for location in self.locations:
            if location.id not in self.backends:
                continue
                
            backend = self.backends[location.id]
            try:
                if backend.exists(path):
                    data = backend.read(path)
                    if data:
                        checksum = hashlib.sha256(data).hexdigest()
                        results['locations'][location.id] = True
                        results['checksums'][location.id] = checksum
                        results['replication_count'] += 1
                else:
                    results['locations'][location.id] = False
            except Exception as e:
                results['locations'][location.id] = str(e)
                
        # Check consistency
        checksums = list(results['checksums'].values())
        if checksums:
            results['is_consistent'] = all(cs == checksums[0] for cs in checksums)
            
        return results
        
    def repair_redundancy(self, path: str) -> bool:
        """
        Repair redundancy by replicating to additional locations
        
        Args:
            path: Storage path
            
        Returns:
            True if repaired successfully
        """
        # Verify current state
        verification = self.verify_redundancy(path)
        
        if not verification['is_consistent']:
            # Find the most common checksum (majority vote)
            checksum_counts = {}
            for cs in verification['checksums'].values():
                checksum_counts[cs] = checksum_counts.get(cs, 0) + 1
            correct_checksum = max(checksum_counts, key=checksum_counts.get)
            
            # Find location with correct data
            source_location = None
            for loc_id, cs in verification['checksums'].items():
                if cs == correct_checksum:
                    source_location = loc_id
                    break
                    
            if not source_location:
                return False
                
            # Read correct data
            data = self.backends[source_location].read(path)
            if not data:
                return False
        else:
            # Find any location with the data
            data = self.read_redundant(path)
            if not data:
                return False
                
        # Replicate to locations that need it
        target_locations = []
        for location in self.locations:
            if (location.is_active and 
                location.id in self.backends and
                location.id not in verification['locations']):
                target_locations.append(location)
                
        # Write to additional locations
        for location in target_locations[:self.replication_factor - verification['replication_count']]:
            try:
                self.backends[location.id].write(path, data)
            except Exception:
                pass
                
        return True
        
    def _health_monitor_loop(self):
        """Monitor health of storage locations"""
        while True:
            time.sleep(60)  # Check every minute
            self._check_health()
            
    def _check_health(self):
        """Check health of all backends"""
        for location in self.locations:
            if location.id not in self.backends:
                continue
                
            try:
                backend = self.backends[location.id]
                location.is_active = backend.health_check()
                location.last_check = datetime.now(timezone.utc)
                if location.is_active:
                    location.last_error = None
            except Exception as e:
                location.is_active = False
                location.last_error = str(e)
                location.last_check = datetime.now(timezone.utc)
                
    def _consistency_check_loop(self):
        """Periodically check consistency"""
        while True:
            time.sleep(self.consistency_check_interval)
            self._check_consistency()
            
    def _check_consistency(self):
        """Check consistency of recent writes"""
        # This would check recent writes and repair if needed
        # Implementation depends on tracking mechanism
        pass
        
    def _record_write(self, path: str, checksum: str, locations: List[str]):
        """Record write metadata for tracking"""
        # This would record to a database or tracking file
        # Implementation depends on requirements
        pass
        
    def get_status(self) -> Dict[str, Any]:
        """Get current status of all storage locations"""
        return {
            'manager_id': self.manager_id,
            'replication_factor': self.replication_factor,
            'locations': [
                {
                    'id': loc.id,
                    'type': loc.type,
                    'priority': loc.priority,
                    'is_active': loc.is_active,
                    'last_check': loc.last_check.isoformat() if loc.last_check else None,
                    'last_error': loc.last_error
                }
                for loc in self.locations
            ],
            'active_count': sum(1 for loc in self.locations if loc.is_active)
        }