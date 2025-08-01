"""
Request signing and verification for critical API operations
"""
import hmac
import hashlib
import time
import json
from typing import Dict, Optional, Tuple
from datetime import datetime, timezone

class RequestSigner:
    """Sign requests using HMAC-SHA256"""
    
    def __init__(self, secret_key: str, algorithm: str = "SHA256"):
        self.secret_key = secret_key.encode()
        self.algorithm = algorithm
        
    def sign_request(
        self,
        method: str,
        path: str,
        headers: Dict[str, str],
        body: Optional[str] = None,
        timestamp: Optional[int] = None
    ) -> Dict[str, str]:
        """Sign a request and return signature headers"""
        # Use current timestamp if not provided
        if timestamp is None:
            timestamp = int(time.time())
        
        # Create canonical request
        canonical_request = self._create_canonical_request(
            method, path, headers, body, timestamp
        )
        
        # Generate signature
        signature = self._generate_signature(canonical_request)
        
        # Return signature headers
        return {
            "X-Signature": signature,
            "X-Signature-Timestamp": str(timestamp),
            "X-Signature-Algorithm": self.algorithm
        }
    
    def _create_canonical_request(
        self,
        method: str,
        path: str,
        headers: Dict[str, str],
        body: Optional[str],
        timestamp: int
    ) -> str:
        """Create canonical request string for signing"""
        # Sort headers
        sorted_headers = sorted(headers.items())
        headers_string = "\n".join([f"{k.lower()}:{v}" for k, v in sorted_headers])
        
        # Calculate body hash
        body_hash = ""
        if body:
            body_hash = hashlib.sha256(body.encode()).hexdigest()
        
        # Build canonical request
        parts = [
            method.upper(),
            path,
            str(timestamp),
            headers_string,
            body_hash
        ]
        
        return "\n".join(parts)
    
    def _generate_signature(self, canonical_request: str) -> str:
        """Generate HMAC signature"""
        if self.algorithm == "SHA256":
            h = hmac.new(
                self.secret_key,
                canonical_request.encode(),
                hashlib.sha256
            )
        else:
            raise ValueError(f"Unsupported algorithm: {self.algorithm}")
        
        return h.hexdigest()


class SignatureVerifier:
    """Verify request signatures"""
    
    def __init__(
        self,
        secret_key: str,
        max_time_diff_seconds: int = 300,  # 5 minutes
        algorithm: str = "SHA256"
    ):
        self.signer = RequestSigner(secret_key, algorithm)
        self.max_time_diff = max_time_diff_seconds
        
    def verify_request(
        self,
        method: str,
        path: str,
        headers: Dict[str, str],
        body: Optional[str] = None,
        provided_signature: Optional[str] = None,
        provided_timestamp: Optional[str] = None
    ) -> Tuple[bool, Optional[str]]:
        """Verify request signature"""
        # Extract signature info from headers if not provided
        if not provided_signature:
            provided_signature = headers.get("X-Signature")
        if not provided_timestamp:
            provided_timestamp = headers.get("X-Signature-Timestamp")
        
        # Check required headers
        if not provided_signature or not provided_timestamp:
            return False, "Missing signature headers"
        
        # Verify timestamp
        try:
            signature_timestamp = int(provided_timestamp)
            current_timestamp = int(time.time())
            
            # Check timestamp is not too old or in future
            time_diff = abs(current_timestamp - signature_timestamp)
            if time_diff > self.max_time_diff:
                return False, f"Signature timestamp too old (diff: {time_diff}s)"
        except ValueError:
            return False, "Invalid signature timestamp"
        
        # Generate expected signature
        signature_headers = self.signer.sign_request(
            method, path, headers, body, signature_timestamp
        )
        expected_signature = signature_headers["X-Signature"]
        
        # Compare signatures (constant time)
        if not hmac.compare_digest(provided_signature, expected_signature):
            return False, "Invalid signature"
        
        return True, None


class WebhookSigner:
    """Sign webhook payloads"""
    
    def __init__(self, secret: str):
        self.secret = secret.encode()
        
    def sign_payload(self, payload: Dict) -> str:
        """Sign a webhook payload"""
        # Serialize payload
        payload_bytes = json.dumps(payload, sort_keys=True).encode()
        
        # Generate signature
        signature = hmac.new(
            self.secret,
            payload_bytes,
            hashlib.sha256
        ).hexdigest()
        
        return f"sha256={signature}"
    
    def verify_webhook(
        self,
        payload: Dict,
        signature_header: str
    ) -> bool:
        """Verify a webhook signature"""
        expected_signature = self.sign_payload(payload)
        return hmac.compare_digest(signature_header, expected_signature)


class APIKeyRotationNotifier:
    """Handle notifications for API key rotation"""
    
    def __init__(self, webhook_url: Optional[str] = None):
        self.webhook_url = webhook_url
        
    async def notify_rotation(
        self,
        api_key_name: str,
        old_key_hint: str,
        new_key_hint: str,
        grace_period_end: datetime,
        user_email: str
    ):
        """Send rotation notification"""
        notification_data = {
            "event": "api_key_rotation",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "details": {
                "key_name": api_key_name,
                "old_key_hint": f"***{old_key_hint}",
                "new_key_hint": f"***{new_key_hint}",
                "grace_period_end": grace_period_end.isoformat(),
                "user_email": user_email
            }
        }
        
        # Send webhook if configured
        if self.webhook_url:
            await self._send_webhook(notification_data)
        
        # Could also send email, SMS, etc.
        return notification_data
    
    async def _send_webhook(self, data: Dict):
        """Send webhook notification"""
        # Implementation would use httpx or similar
        # to POST to webhook URL
        pass