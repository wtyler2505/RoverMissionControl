"""
API endpoints for CORS policy management
"""
from typing import List, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field

from .cors_service import CORSService
from .cors_models import CORSPolicy, CORSPolicyType, CORSViolation, CORSPreset
from ..database import get_db
from ..auth.dependencies import get_current_user
from ..auth.models import User

router = APIRouter(prefix="/api/cors", tags=["CORS Management"])

# Pydantic models
class CORSPolicyCreate(BaseModel):
    """Create a new CORS policy"""
    name: str = Field(..., description="Unique policy name")
    description: Optional[str] = Field(None, description="Policy description")
    policy_type: CORSPolicyType = Field(CORSPolicyType.GLOBAL, description="Policy type")
    endpoint_pattern: Optional[str] = Field(None, description="Regex pattern for endpoints")
    api_key_id: Optional[str] = Field(None, description="API key ID for key-specific policies")
    priority: int = Field(0, description="Policy priority (higher overrides lower)")
    
    # Configuration
    allowed_origins: Optional[List[str]] = Field(None, description="Allowed origins")
    allow_all_origins: bool = Field(False, description="Allow all origins")
    allowed_methods: Optional[List[str]] = Field(None, description="Allowed HTTP methods")
    allow_all_methods: bool = Field(False, description="Allow all methods")
    allowed_headers: Optional[List[str]] = Field(None, description="Allowed request headers")
    allow_all_headers: bool = Field(False, description="Allow all headers")
    expose_headers: Optional[List[str]] = Field(None, description="Headers to expose")
    allow_credentials: bool = Field(False, description="Allow credentials")
    max_age: int = Field(3600, description="Preflight cache duration (seconds)")
    validate_origin_regex: bool = Field(False, description="Use regex for origin matching")
    case_sensitive_origins: bool = Field(False, description="Case-sensitive origin matching")

class CORSPolicyUpdate(BaseModel):
    """Update CORS policy"""
    name: Optional[str] = None
    description: Optional[str] = None
    endpoint_pattern: Optional[str] = None
    priority: Optional[int] = None
    is_active: Optional[bool] = None
    
    # Configuration updates
    allowed_origins: Optional[List[str]] = None
    allow_all_origins: Optional[bool] = None
    allowed_methods: Optional[List[str]] = None
    allow_all_methods: Optional[bool] = None
    allowed_headers: Optional[List[str]] = None
    allow_all_headers: Optional[bool] = None
    expose_headers: Optional[List[str]] = None
    allow_credentials: Optional[bool] = None
    max_age: Optional[int] = None
    validate_origin_regex: Optional[bool] = None
    case_sensitive_origins: Optional[bool] = None

class CORSPolicyResponse(BaseModel):
    """CORS policy response"""
    id: str
    name: str
    description: Optional[str]
    policy_type: str
    endpoint_pattern: Optional[str]
    api_key_id: Optional[str]
    priority: int
    
    # Configuration
    allowed_origins: Optional[List[str]]
    allow_all_origins: bool
    allowed_methods: Optional[List[str]]
    allow_all_methods: bool
    allowed_headers: Optional[List[str]]
    allow_all_headers: bool
    expose_headers: Optional[List[str]]
    allow_credentials: bool
    max_age: int
    validate_origin_regex: bool
    case_sensitive_origins: bool
    
    # Status
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime]
    
    # Testing
    test_results: Optional[dict]
    last_tested_at: Optional[datetime]
    
    class Config:
        from_attributes = True

class CORSTestRequest(BaseModel):
    """Test a CORS policy"""
    test_origin: str = Field(..., description="Origin to test")
    test_method: str = Field(..., description="HTTP method to test")
    test_headers: Optional[List[str]] = Field(None, description="Headers to test")

class CORSViolationResponse(BaseModel):
    """CORS violation response"""
    id: str
    timestamp: datetime
    origin: str
    method: str
    path: str
    violation_type: str
    violation_details: dict
    was_blocked: bool
    override_reason: Optional[str]
    ip_address: Optional[str]
    api_key_id: Optional[str]
    
    class Config:
        from_attributes = True

class CORSPresetResponse(BaseModel):
    """CORS preset response"""
    id: str
    name: str
    description: Optional[str]
    category: Optional[str]
    configuration: dict
    usage_count: int
    is_system: bool
    
    class Config:
        from_attributes = True

class CreatePolicyFromPresetRequest(BaseModel):
    """Create policy from preset request"""
    policy_name: str = Field(..., description="Name for the new policy")
    customizations: Optional[dict] = Field(None, description="Custom configuration overrides")

# Endpoints
@router.post("/policies", response_model=CORSPolicyResponse)
async def create_cors_policy(
    policy: CORSPolicyCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new CORS policy"""
    service = CORSService(db)
    
    # Extract configuration
    config = {
        "allowed_origins": policy.allowed_origins,
        "allow_all_origins": policy.allow_all_origins,
        "allowed_methods": policy.allowed_methods,
        "allow_all_methods": policy.allow_all_methods,
        "allowed_headers": policy.allowed_headers,
        "allow_all_headers": policy.allow_all_headers,
        "expose_headers": policy.expose_headers,
        "allow_credentials": policy.allow_credentials,
        "max_age": policy.max_age,
        "validate_origin_regex": policy.validate_origin_regex,
        "case_sensitive_origins": policy.case_sensitive_origins
    }
    
    return service.create_policy(
        name=policy.name,
        policy_type=policy.policy_type,
        configuration=config,
        current_user=current_user,
        description=policy.description,
        endpoint_pattern=policy.endpoint_pattern,
        api_key_id=policy.api_key_id,
        priority=policy.priority
    )

@router.get("/policies", response_model=List[CORSPolicyResponse])
async def get_cors_policies(
    policy_type: Optional[CORSPolicyType] = None,
    is_active: Optional[bool] = None,
    search: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all CORS policies"""
    service = CORSService(db)
    return service.get_policies(
        policy_type=policy_type,
        is_active=is_active,
        search=search
    )

@router.get("/policies/{policy_id}", response_model=CORSPolicyResponse)
async def get_cors_policy(
    policy_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a specific CORS policy"""
    service = CORSService(db)
    policy = service.get_policy(policy_id)
    
    if not policy:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Policy not found"
        )
    
    return policy

@router.put("/policies/{policy_id}", response_model=CORSPolicyResponse)
async def update_cors_policy(
    policy_id: str,
    updates: CORSPolicyUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a CORS policy"""
    service = CORSService(db)
    
    # Convert to dict and remove None values
    update_dict = updates.dict(exclude_unset=True)
    
    return service.update_policy(
        policy_id=policy_id,
        updates=update_dict,
        current_user=current_user
    )

@router.delete("/policies/{policy_id}")
async def delete_cors_policy(
    policy_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a CORS policy"""
    service = CORSService(db)
    success = service.delete_policy(policy_id, current_user)
    
    return {"success": success, "message": "Policy deleted successfully"}

@router.post("/policies/{policy_id}/test")
async def test_cors_policy(
    policy_id: str,
    test_request: CORSTestRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Test a CORS policy with sample request"""
    service = CORSService(db)
    
    return service.test_policy(
        policy_id=policy_id,
        test_origin=test_request.test_origin,
        test_method=test_request.test_method,
        test_headers=test_request.test_headers,
        current_user=current_user
    )

@router.get("/violations", response_model=List[CORSViolationResponse])
async def get_cors_violations(
    policy_id: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    was_blocked: Optional[bool] = None,
    limit: int = Query(100, ge=1, le=1000),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get CORS policy violations"""
    service = CORSService(db)
    
    violations = service.get_violations(
        policy_id=policy_id,
        start_date=start_date,
        end_date=end_date,
        was_blocked=was_blocked
    )
    
    # Apply limit
    return violations[:limit]

@router.get("/presets", response_model=List[CORSPresetResponse])
async def get_cors_presets(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all CORS presets"""
    service = CORSService(db)
    return service.get_presets()

@router.post("/presets/{preset_id}/create-policy", response_model=CORSPolicyResponse)
async def create_policy_from_preset(
    preset_id: str,
    request: CreatePolicyFromPresetRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new CORS policy from a preset"""
    service = CORSService(db)
    
    return service.create_policy_from_preset(
        preset_id=preset_id,
        policy_name=request.policy_name,
        current_user=current_user,
        customizations=request.customizations
    )

@router.get("/check")
async def check_cors_request(
    origin: str = Query(..., description="Request origin"),
    method: str = Query(..., description="HTTP method"),
    path: str = Query(..., description="Request path"),
    api_key_id: Optional[str] = Query(None, description="API key ID"),
    db: Session = Depends(get_db)
):
    """Check if a CORS request would be allowed"""
    service = CORSService(db)
    
    # Find applicable policy
    policy = service.get_applicable_policy(
        origin=origin,
        method=method,
        path=path,
        api_key_id=api_key_id
    )
    
    if not policy:
        return {
            "allowed": False,
            "reason": "No applicable CORS policy found",
            "policy": None
        }
    
    # Test the policy
    test_result = service.test_policy(
        policy_id=policy.id,
        test_origin=origin,
        test_method=method
    )
    
    return {
        "allowed": test_result["results"]["would_allow_request"],
        "policy_id": policy.id,
        "policy_name": policy.name,
        "test_result": test_result
    }

@router.get("/sample-code/{language}")
async def get_cors_sample_code(
    language: str,
    origin: str = Query(..., description="Your application origin"),
    api_key: Optional[str] = Query(None, description="Your API key"),
    current_user: User = Depends(get_current_user)
):
    """Get sample code for making CORS requests"""
    samples = {
        "javascript": f"""
// JavaScript/Fetch example
const apiKey = '{api_key or "YOUR_API_KEY"}';
const apiUrl = 'https://your-api.com/api/endpoint';

fetch(apiUrl, {{
    method: 'GET',
    headers: {{
        'X-API-Key': apiKey,
        'Content-Type': 'application/json'
    }},
    credentials: 'include'  // If cookies/auth needed
}})
.then(response => {{
    if (!response.ok) {{
        throw new Error(`HTTP error! status: ${{response.status}}`);
    }}
    return response.json();
}})
.then(data => console.log(data))
.catch(error => console.error('Error:', error));
""",
        "axios": f"""
// Axios example
import axios from 'axios';

const apiKey = '{api_key or "YOUR_API_KEY"}';
const apiUrl = 'https://your-api.com/api/endpoint';

axios.get(apiUrl, {{
    headers: {{
        'X-API-Key': apiKey,
        'Content-Type': 'application/json'
    }},
    withCredentials: true  // If cookies/auth needed
}})
.then(response => console.log(response.data))
.catch(error => console.error('Error:', error));
""",
        "jquery": f"""
// jQuery example
$.ajax({{
    url: 'https://your-api.com/api/endpoint',
    method: 'GET',
    headers: {{
        'X-API-Key': '{api_key or "YOUR_API_KEY"}'
    }},
    xhrFields: {{
        withCredentials: true  // If cookies/auth needed
    }},
    success: function(data) {{
        console.log(data);
    }},
    error: function(xhr, status, error) {{
        console.error('Error:', error);
    }}
}});
""",
        "python": f"""
# Python/requests example
import requests

api_key = '{api_key or "YOUR_API_KEY"}'
api_url = 'https://your-api.com/api/endpoint'

headers = {{
    'X-API-Key': api_key,
    'Origin': '{origin}'
}}

response = requests.get(api_url, headers=headers)

if response.status_code == 200:
    print(response.json())
else:
    print(f'Error: {{response.status_code}}')
""",
        "curl": f"""
# cURL example
curl -X GET https://your-api.com/api/endpoint \\
  -H "X-API-Key: {api_key or 'YOUR_API_KEY'}" \\
  -H "Origin: {origin}" \\
  -H "Content-Type: application/json"
"""
    }
    
    if language not in samples:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Language '{language}' not supported. Available: {list(samples.keys())}"
        )
    
    return {
        "language": language,
        "code": samples[language],
        "note": "Replace 'https://your-api.com' with your actual API URL"
    }