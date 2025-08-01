"""
Enhanced signing service with configuration management
"""
import uuid
import time
import hmac
import hashlib
import base64
import json
from typing import Dict, Optional, Tuple, List, Any
from datetime import datetime, timedelta
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa, padding, ec
from cryptography.hazmat.backends import default_backend
from cryptography.fernet import Fernet
from jose import jwt, JWTError
import urllib.parse
from sqlalchemy.orm import Session
from sqlalchemy import and_

from .signing import RequestSigner as BaseRequestSigner, SignatureVerifier as BaseSignatureVerifier
from .signing_models import SigningConfiguration, SignatureVerificationLog, SigningSampleCode, NonceCache
from .models import APIKey
from ..rbac.audit import AuditLogger


class SigningService:
    """Service for managing request signing configurations"""
    
    def __init__(self, db: Session, audit_logger: AuditLogger):
        self.db = db
        self.audit_logger = audit_logger
        self._encryption_key = Fernet.generate_key()  # In production, use KMS
        self._fernet = Fernet(self._encryption_key)
    
    def create_configuration(
        self,
        user,
        name: str,
        algorithm: str,
        description: Optional[str] = None,
        **options
    ) -> SigningConfiguration:
        """Create a new signing configuration"""
        config = SigningConfiguration(
            name=name,
            description=description,
            algorithm=algorithm,
            created_by=user.id,
            **options
        )
        
        # Generate keys for asymmetric algorithms
        if algorithm in ["RSA-SHA256", "JWT-RS256"]:
            private_key, public_key = self._generate_rsa_keypair(
                options.get("key_size", 2048)
            )
            config.public_key = public_key
            config.private_key_encrypted = self._encrypt_key(private_key)
        elif algorithm == "ECDSA-SHA256":
            private_key, public_key = self._generate_ecdsa_keypair()
            config.public_key = public_key
            config.private_key_encrypted = self._encrypt_key(private_key)
        
        self.db.add(config)
        self.db.commit()
        
        # Audit log
        self.audit_logger.log(
            user=user,
            action="create_signing_configuration",
            resource="signing_configuration",
            resource_id=config.id,
            details={"name": name, "algorithm": algorithm}
        )
        
        return config
    
    def update_configuration(
        self,
        user,
        config_id: str,
        **updates
    ) -> SigningConfiguration:
        """Update signing configuration"""
        config = self.db.query(SigningConfiguration).filter(
            SigningConfiguration.id == config_id
        ).first()
        
        if not config:
            raise ValueError("Configuration not found")
        
        # Update fields
        for field, value in updates.items():
            if hasattr(config, field):
                setattr(config, field, value)
        
        config.updated_at = datetime.utcnow()
        self.db.commit()
        
        # Audit log
        self.audit_logger.log(
            user=user,
            action="update_signing_configuration",
            resource="signing_configuration",
            resource_id=config.id,
            details={"updates": list(updates.keys())}
        )
        
        return config
    
    def sign_request(
        self,
        api_key: APIKey,
        config: SigningConfiguration,
        method: str,
        url: str,
        headers: Dict[str, str],
        body: Optional[bytes] = None
    ) -> Dict[str, str]:
        """Sign a request using the specified configuration"""
        # Create signer
        signer = EnhancedRequestSigner(config, self._decrypt_key)
        
        # Get secret key based on algorithm
        if config.algorithm in ["HMAC-SHA256", "HMAC-SHA512", "JWT-HS256"]:
            # Use API key hash as secret
            secret_key = api_key.key_hash[:32]
        else:
            # Use private key from config
            secret_key = self._decrypt_key(config.private_key_encrypted)
        
        # Sign request
        return signer.sign_request(
            method=method,
            url=url,
            headers=headers,
            body=body,
            api_key=api_key.id,
            secret_key=secret_key
        )
    
    def verify_request(
        self,
        method: str,
        url: str,
        headers: Dict[str, str],
        body: Optional[bytes] = None
    ) -> Tuple[bool, Optional[str], Optional[APIKey]]:
        """Verify a request signature"""
        start_time = time.time()
        
        # Get API key ID from headers
        api_key_id = headers.get("X-API-Key", headers.get("x-api-key"))
        if not api_key_id:
            return False, "Missing API key header", None
        
        # Get API key
        api_key = self.db.query(APIKey).filter(
            APIKey.id == api_key_id,
            APIKey.status == "active"
        ).first()
        
        if not api_key:
            return False, "Invalid or inactive API key", None
        
        # Get algorithm from headers
        algorithm = headers.get("X-Signature-Algorithm", headers.get("x-signature-algorithm"))
        if not algorithm:
            return False, "Missing signature algorithm header", None
        
        # Find matching configuration
        config = self.db.query(SigningConfiguration).filter(
            SigningConfiguration.algorithm == algorithm,
            SigningConfiguration.is_active == True
        ).first()
        
        if not config:
            return False, f"No active configuration for algorithm {algorithm}", None
        
        # Create verifier
        verifier = EnhancedSignatureVerifier(self.db, config, self._decrypt_key)
        
        # Verify signature
        is_valid, error_message = verifier.verify_request(
            method=method,
            url=url,
            headers=headers,
            body=body,
            api_key=api_key
        )
        
        # Log verification attempt
        verification_time = int((time.time() - start_time) * 1000)
        self._log_verification(
            api_key_id=api_key.id,
            config_id=config.id,
            method=method,
            url=url,
            headers=headers,
            is_valid=is_valid,
            error_message=error_message,
            verification_time_ms=verification_time
        )
        
        return is_valid, error_message, api_key if is_valid else None
    
    def get_sample_code(
        self,
        language: str,
        algorithm: str,
        framework: Optional[str] = None
    ) -> Optional[SigningSampleCode]:
        """Get sample code for a language/algorithm combination"""
        query = self.db.query(SigningSampleCode).filter(
            SigningSampleCode.language == language,
            SigningSampleCode.algorithm == algorithm,
            SigningSampleCode.is_active == True
        )
        
        if framework:
            query = query.filter(SigningSampleCode.framework == framework)
        
        return query.first()
    
    def create_sample_code(
        self,
        language: str,
        algorithm: str,
        title: str,
        code: str,
        **kwargs
    ) -> SigningSampleCode:
        """Create a new sample code entry"""
        sample = SigningSampleCode(
            language=language,
            algorithm=algorithm,
            title=title,
            code=code,
            **kwargs
        )
        
        self.db.add(sample)
        self.db.commit()
        
        return sample
    
    def get_verification_errors(
        self,
        api_key_id: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        limit: int = 100
    ) -> List[SignatureVerificationLog]:
        """Get signature verification errors for troubleshooting"""
        query = self.db.query(SignatureVerificationLog).filter(
            SignatureVerificationLog.is_valid == False
        )
        
        if api_key_id:
            query = query.filter(SignatureVerificationLog.api_key_id == api_key_id)
        
        if start_date:
            query = query.filter(SignatureVerificationLog.verified_at >= start_date)
        
        if end_date:
            query = query.filter(SignatureVerificationLog.verified_at <= end_date)
        
        return query.order_by(SignatureVerificationLog.verified_at.desc()).limit(limit).all()
    
    def get_verification_stats(
        self,
        api_key_id: Optional[str] = None,
        config_id: Optional[str] = None,
        days_back: int = 30
    ) -> Dict[str, Any]:
        """Get verification statistics"""
        start_date = datetime.utcnow() - timedelta(days=days_back)
        
        query = self.db.query(SignatureVerificationLog).filter(
            SignatureVerificationLog.verified_at >= start_date
        )
        
        if api_key_id:
            query = query.filter(SignatureVerificationLog.api_key_id == api_key_id)
        
        if config_id:
            query = query.filter(SignatureVerificationLog.configuration_id == config_id)
        
        logs = query.all()
        
        # Calculate statistics
        total = len(logs)
        valid = sum(1 for log in logs if log.is_valid)
        invalid = total - valid
        
        # Group errors by type
        error_types = {}
        for log in logs:
            if not log.is_valid and log.error_code:
                error_types[log.error_code] = error_types.get(log.error_code, 0) + 1
        
        # Average verification time
        avg_time = sum(log.verification_time_ms or 0 for log in logs) / total if total > 0 else 0
        
        return {
            "period_days": days_back,
            "total_verifications": total,
            "valid_signatures": valid,
            "invalid_signatures": invalid,
            "success_rate": (valid / total * 100) if total > 0 else 0,
            "error_breakdown": error_types,
            "average_verification_time_ms": avg_time,
            "calculated_at": datetime.utcnow().isoformat()
        }
    
    def cleanup_nonce_cache(self, older_than: Optional[datetime] = None):
        """Clean up expired nonces"""
        if not older_than:
            older_than = datetime.utcnow()
        
        deleted = self.db.query(NonceCache).filter(
            NonceCache.expires_at < older_than
        ).delete()
        
        self.db.commit()
        
        return deleted
    
    def _generate_rsa_keypair(self, key_size: int = 2048) -> Tuple[str, str]:
        """Generate RSA key pair"""
        private_key = rsa.generate_private_key(
            public_exponent=65537,
            key_size=key_size,
            backend=default_backend()
        )
        
        private_pem = private_key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=serialization.NoEncryption()
        ).decode()
        
        public_pem = private_key.public_key().public_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PublicFormat.SubjectPublicKeyInfo
        ).decode()
        
        return private_pem, public_pem
    
    def _generate_ecdsa_keypair(self) -> Tuple[str, str]:
        """Generate ECDSA key pair"""
        private_key = ec.generate_private_key(
            ec.SECP256R1(),
            backend=default_backend()
        )
        
        private_pem = private_key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=serialization.NoEncryption()
        ).decode()
        
        public_pem = private_key.public_key().public_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PublicFormat.SubjectPublicKeyInfo
        ).decode()
        
        return private_pem, public_pem
    
    def _encrypt_key(self, key: str) -> str:
        """Encrypt a private key for storage"""
        return self._fernet.encrypt(key.encode()).decode()
    
    def _decrypt_key(self, encrypted_key: str) -> str:
        """Decrypt a private key"""
        return self._fernet.decrypt(encrypted_key.encode()).decode()
    
    def _log_verification(
        self,
        api_key_id: str,
        config_id: str,
        method: str,
        url: str,
        headers: Dict[str, str],
        is_valid: bool,
        error_message: Optional[str],
        verification_time_ms: int
    ):
        """Log verification attempt"""
        parsed_url = urllib.parse.urlparse(url)
        
        log = SignatureVerificationLog(
            api_key_id=api_key_id,
            configuration_id=config_id,
            method=method,
            endpoint=parsed_url.path,
            ip_address=headers.get("X-Forwarded-For", headers.get("Remote-Addr", "unknown")),
            user_agent=headers.get("User-Agent", "unknown"),
            algorithm_used=headers.get("X-Signature-Algorithm"),
            timestamp_provided=datetime.fromtimestamp(
                int(headers.get("X-Timestamp", 0))
            ) if headers.get("X-Timestamp") else None,
            nonce=headers.get("X-Nonce"),
            signature_provided=headers.get("Authorization", "")[:100],  # Truncate
            is_valid=is_valid,
            error_code=error_message.split(":")[0] if error_message else None,
            error_message=error_message,
            verification_time_ms=verification_time_ms
        )
        
        self.db.add(log)
        self.db.commit()


class EnhancedRequestSigner(BaseRequestSigner):
    """Enhanced request signer with configuration support"""
    
    def __init__(self, config: SigningConfiguration, key_decryptor):
        super().__init__(config.algorithm)
        self.config = config
        self.key_decryptor = key_decryptor
    
    def sign_request(self, **kwargs) -> Dict[str, str]:
        """Sign request with configuration options"""
        # Apply configuration options
        if self.config.jwt_expires_in_seconds and "expires_in" not in kwargs:
            kwargs["expires_in"] = self.config.jwt_expires_in_seconds
        
        if self.config.jwt_custom_claims and "claims" not in kwargs:
            kwargs["claims"] = self.config.jwt_custom_claims
        
        # Filter headers based on configuration
        if "headers" in kwargs and self.config.include_headers:
            filtered_headers = {
                k: v for k, v in kwargs["headers"].items()
                if k.lower() in [h.lower() for h in self.config.include_headers]
            }
            kwargs["headers"] = filtered_headers
        
        return super().sign_request(**kwargs)
    
    def _create_canonical_request(self, *args, **kwargs) -> str:
        """Create canonical request with configuration options"""
        # Call parent method
        canonical = super()._create_canonical_request(*args, **kwargs)
        
        # Apply configuration options
        if not self.config.require_body_hash and "\n" in canonical:
            # Remove body hash if not required
            parts = canonical.split("\n")
            if len(parts) > 6:  # Has body hash
                parts = parts[:-1]  # Remove last element (body hash)
                canonical = "\n".join(parts)
        
        return canonical


class EnhancedSignatureVerifier(BaseSignatureVerifier):
    """Enhanced signature verifier with configuration support"""
    
    def __init__(self, db: Session, config: SigningConfiguration, key_decryptor):
        self.db = db
        self.config = config
        self.key_decryptor = key_decryptor
        super().__init__(db)
    
    def verify_request(
        self,
        method: str,
        url: str,
        headers: Dict[str, str],
        body: Optional[bytes],
        api_key: APIKey
    ) -> Tuple[bool, Optional[str]]:
        """Verify request with configuration options"""
        # Check endpoint restrictions
        parsed_url = urllib.parse.urlparse(url)
        endpoint = parsed_url.path
        
        # Check allowed endpoints
        if self.config.allowed_endpoints:
            allowed = any(
                self._matches_pattern(endpoint, pattern)
                for pattern in self.config.allowed_endpoints
            )
            if not allowed:
                return False, "Endpoint not allowed for signing"
        
        # Check blocked endpoints
        if self.config.blocked_endpoints:
            blocked = any(
                self._matches_pattern(endpoint, pattern)
                for pattern in self.config.blocked_endpoints
            )
            if blocked:
                return False, "Endpoint blocked from signing"
        
        # Check secure transport
        if self.config.require_secure_transport and parsed_url.scheme != "https":
            return False, "Secure transport (HTTPS) required"
        
        # Check nonce if required
        if self.config.require_nonce:
            nonce = headers.get("X-Nonce", headers.get("x-nonce"))
            if not nonce:
                return False, "Nonce required but not provided"
            
            # Check nonce uniqueness
            existing = self.db.query(NonceCache).filter(
                NonceCache.api_key_id == api_key.id,
                NonceCache.nonce == nonce
            ).first()
            
            if existing:
                return False, "Duplicate nonce (replay attack)"
            
            # Store nonce
            nonce_entry = NonceCache(
                api_key_id=api_key.id,
                nonce=nonce,
                timestamp=datetime.utcnow(),
                expires_at=datetime.utcnow() + timedelta(
                    seconds=self.config.timestamp_tolerance_seconds * 2
                )
            )
            self.db.add(nonce_entry)
            self.db.commit()
        
        # Use parent verification with custom time window
        self._time_window = self.config.timestamp_tolerance_seconds
        
        return super().verify_request(
            method=method,
            url=url,
            headers=headers,
            body=body,
            time_window=self.config.timestamp_tolerance_seconds
        )
    
    def _matches_pattern(self, endpoint: str, pattern: str) -> bool:
        """Check if endpoint matches pattern (supports wildcards)"""
        import fnmatch
        return fnmatch.fnmatch(endpoint, pattern)