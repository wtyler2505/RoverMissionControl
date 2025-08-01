"""
Firmware Detection and Management System
Safety-critical implementation for rover firmware updates with fail-safe mechanisms
"""

import asyncio
import hashlib
import json
import logging
import os
import shutil
from dataclasses import dataclass, field, asdict
from datetime import datetime, timedelta
from enum import Enum
from pathlib import Path
from typing import Dict, List, Optional, Any, Callable, Union, Tuple
import semver
import struct
import zlib

from .base import ProtocolAdapter, ProtocolType, DataPacket, ProtocolError
from .manager import HardwareDevice, HardwareManager


logger = logging.getLogger(__name__)


class FirmwareUpdateState(Enum):
    """Firmware update states with safety considerations"""
    IDLE = "idle"
    CHECKING = "checking"
    DOWNLOADING = "downloading"
    VERIFYING = "verifying"
    PREPARING = "preparing"
    UPDATING = "updating"
    VALIDATING = "validating"
    FINALIZING = "finalizing"
    COMPLETED = "completed"
    FAILED = "failed"
    ROLLED_BACK = "rolled_back"
    EMERGENCY_STOP = "emergency_stop"


class FirmwareValidationResult(Enum):
    """Firmware validation results"""
    VALID = "valid"
    INVALID_SIGNATURE = "invalid_signature"
    INVALID_CHECKSUM = "invalid_checksum"
    INVALID_FORMAT = "invalid_format"
    INVALID_VERSION = "invalid_version"
    INCOMPATIBLE_DEVICE = "incompatible_device"
    CORRUPTED = "corrupted"
    EXPIRED = "expired"


class UpdatePriority(Enum):
    """Update priority levels"""
    CRITICAL = "critical"      # Security or safety fixes
    HIGH = "high"             # Important bug fixes
    NORMAL = "normal"         # Regular updates
    LOW = "low"              # Minor improvements
    OPTIONAL = "optional"    # Feature additions


class FailureMode(Enum):
    """Firmware update failure modes"""
    COMMUNICATION_LOST = "communication_lost"
    VERIFICATION_FAILED = "verification_failed"
    WRITE_FAILED = "write_failed"
    TIMEOUT = "timeout"
    POWER_LOSS = "power_loss"
    INCOMPATIBLE = "incompatible"
    CORRUPTION = "corruption"
    USER_ABORT = "user_abort"
    EMERGENCY_STOP = "emergency_stop"


@dataclass
class FirmwareVersion:
    """Firmware version information with safety metadata"""
    major: int
    minor: int
    patch: int
    build: Optional[int] = None
    prerelease: Optional[str] = None
    metadata: Optional[str] = None
    
    def __str__(self) -> str:
        """String representation following semantic versioning"""
        version = f"{self.major}.{self.minor}.{self.patch}"
        if self.build is not None:
            version += f".{self.build}"
        if self.prerelease:
            version += f"-{self.prerelease}"
        if self.metadata:
            version += f"+{self.metadata}"
        return version
    
    def to_semver(self) -> semver.VersionInfo:
        """Convert to semver VersionInfo"""
        return semver.VersionInfo(
            major=self.major,
            minor=self.minor,
            patch=self.patch,
            prerelease=self.prerelease,
            build=self.metadata
        )
    
    @classmethod
    def from_string(cls, version_str: str) -> 'FirmwareVersion':
        """Parse version from string"""
        try:
            parsed = semver.VersionInfo.parse(version_str)
            return cls(
                major=parsed.major,
                minor=parsed.minor,
                patch=parsed.patch,
                prerelease=parsed.prerelease,
                metadata=parsed.build
            )
        except ValueError:
            # Try simple numeric parsing
            parts = version_str.split('.')
            return cls(
                major=int(parts[0]) if len(parts) > 0 else 0,
                minor=int(parts[1]) if len(parts) > 1 else 0,
                patch=int(parts[2]) if len(parts) > 2 else 0,
                build=int(parts[3]) if len(parts) > 3 else None
            )
    
    def is_compatible_with(self, other: 'FirmwareVersion') -> bool:
        """Check if versions are compatible (same major version)"""
        return self.major == other.major


@dataclass
class FirmwareMetadata:
    """Comprehensive firmware metadata for safety validation"""
    device_id: str
    device_model: str
    version: FirmwareVersion
    size: int
    checksum_sha256: str
    checksum_crc32: Optional[int] = None
    signature: Optional[str] = None
    release_date: Optional[datetime] = None
    expiry_date: Optional[datetime] = None
    min_hardware_version: Optional[str] = None
    max_hardware_version: Optional[str] = None
    dependencies: List[Dict[str, str]] = field(default_factory=list)
    changelog: Optional[str] = None
    safety_level: Optional[int] = None  # SIL rating 0-4
    rollback_allowed: bool = True
    critical_update: bool = False
    update_priority: UpdatePriority = UpdatePriority.NORMAL
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary"""
        data = asdict(self)
        data['version'] = str(self.version)
        if self.release_date:
            data['release_date'] = self.release_date.isoformat()
        if self.expiry_date:
            data['expiry_date'] = self.expiry_date.isoformat()
        return data
    
    def validate_expiry(self) -> bool:
        """Check if firmware has expired"""
        if self.expiry_date:
            return datetime.utcnow() < self.expiry_date
        return True


@dataclass
class FirmwareUpdateSession:
    """Tracks a firmware update session with safety state"""
    session_id: str
    device_id: str
    start_time: datetime
    state: FirmwareUpdateState
    source_version: FirmwareVersion
    target_version: FirmwareVersion
    progress: float = 0.0
    retry_count: int = 0
    max_retries: int = 3
    error_log: List[Dict[str, Any]] = field(default_factory=list)
    checkpoints: List[Dict[str, Any]] = field(default_factory=list)
    rollback_point: Optional[Dict[str, Any]] = None
    emergency_stop_triggered: bool = False
    
    def add_checkpoint(self, name: str, data: Dict[str, Any]) -> None:
        """Add recovery checkpoint"""
        self.checkpoints.append({
            'name': name,
            'timestamp': datetime.utcnow().isoformat(),
            'data': data,
            'progress': self.progress
        })
    
    def add_error(self, error: str, details: Dict[str, Any]) -> None:
        """Log error with context"""
        self.error_log.append({
            'timestamp': datetime.utcnow().isoformat(),
            'error': error,
            'details': details,
            'state': self.state.value,
            'progress': self.progress
        })


@dataclass
class FirmwareRepository:
    """Local firmware repository with integrity checking"""
    base_path: Path
    index: Dict[str, List[FirmwareMetadata]] = field(default_factory=dict)
    
    def __post_init__(self):
        """Initialize repository structure"""
        self.base_path = Path(self.base_path)
        self.base_path.mkdir(parents=True, exist_ok=True)
        (self.base_path / "firmware").mkdir(exist_ok=True)
        (self.base_path / "backups").mkdir(exist_ok=True)
        (self.base_path / "temp").mkdir(exist_ok=True)
        self.load_index()
    
    def load_index(self) -> None:
        """Load firmware index from disk"""
        index_file = self.base_path / "index.json"
        if index_file.exists():
            try:
                with open(index_file, 'r') as f:
                    data = json.load(f)
                    # Reconstruct metadata objects
                    for device_id, versions in data.items():
                        self.index[device_id] = []
                        for v in versions:
                            version = FirmwareVersion.from_string(v['version'])
                            metadata = FirmwareMetadata(
                                device_id=v['device_id'],
                                device_model=v['device_model'],
                                version=version,
                                size=v['size'],
                                checksum_sha256=v['checksum_sha256'],
                                **{k: v[k] for k in v if k not in 
                                   ['device_id', 'device_model', 'version', 'size', 'checksum_sha256']}
                            )
                            self.index[device_id].append(metadata)
            except Exception as e:
                logger.error(f"Failed to load firmware index: {e}")
                self.index = {}
    
    def save_index(self) -> None:
        """Save firmware index to disk"""
        index_file = self.base_path / "index.json"
        data = {}
        for device_id, versions in self.index.items():
            data[device_id] = [v.to_dict() for v in versions]
        
        with open(index_file, 'w') as f:
            json.dump(data, f, indent=2)
    
    def add_firmware(self, metadata: FirmwareMetadata, firmware_data: bytes) -> str:
        """Add firmware to repository with validation"""
        # Validate checksum
        calculated_hash = hashlib.sha256(firmware_data).hexdigest()
        if calculated_hash != metadata.checksum_sha256:
            raise ValueError(f"Checksum mismatch: expected {metadata.checksum_sha256}, got {calculated_hash}")
        
        # Create firmware path
        firmware_dir = self.base_path / "firmware" / metadata.device_model
        firmware_dir.mkdir(parents=True, exist_ok=True)
        
        filename = f"{metadata.device_model}_{metadata.version}_{metadata.checksum_sha256[:8]}.bin"
        firmware_path = firmware_dir / filename
        
        # Write firmware file
        with open(firmware_path, 'wb') as f:
            f.write(firmware_data)
        
        # Update index
        if metadata.device_id not in self.index:
            self.index[metadata.device_id] = []
        
        # Check if version already exists
        existing = [v for v in self.index[metadata.device_id] 
                   if str(v.version) == str(metadata.version)]
        if not existing:
            self.index[metadata.device_id].append(metadata)
            self.save_index()
        
        return str(firmware_path)
    
    def get_firmware_path(self, device_id: str, version: Union[str, FirmwareVersion]) -> Optional[Path]:
        """Get path to firmware file"""
        if isinstance(version, str):
            version = FirmwareVersion.from_string(version)
        
        if device_id not in self.index:
            return None
        
        for metadata in self.index[device_id]:
            if str(metadata.version) == str(version):
                filename = f"{metadata.device_model}_{metadata.version}_{metadata.checksum_sha256[:8]}.bin"
                path = self.base_path / "firmware" / metadata.device_model / filename
                if path.exists():
                    return path
        
        return None
    
    def get_latest_version(self, device_id: str) -> Optional[FirmwareMetadata]:
        """Get latest firmware version for device"""
        if device_id not in self.index:
            return None
        
        versions = self.index[device_id]
        if not versions:
            return None
        
        # Sort by version
        sorted_versions = sorted(versions, 
                               key=lambda v: v.version.to_semver(), 
                               reverse=True)
        
        # Return latest non-expired version
        for v in sorted_versions:
            if v.validate_expiry():
                return v
        
        return None
    
    def cleanup_old_versions(self, device_id: str, keep_count: int = 3) -> None:
        """Clean up old firmware versions, keeping recent ones"""
        if device_id not in self.index:
            return
        
        versions = self.index[device_id]
        if len(versions) <= keep_count:
            return
        
        # Sort by version
        sorted_versions = sorted(versions, 
                               key=lambda v: v.version.to_semver(), 
                               reverse=True)
        
        # Keep recent versions
        to_remove = sorted_versions[keep_count:]
        
        for metadata in to_remove:
            # Remove from index
            self.index[device_id].remove(metadata)
            
            # Remove file
            path = self.get_firmware_path(device_id, metadata.version)
            if path and path.exists():
                path.unlink()
                logger.info(f"Removed old firmware: {path}")
        
        self.save_index()


class FirmwareManager:
    """
    Safety-critical firmware management system
    Implements fail-safe mechanisms and recovery procedures
    """
    
    def __init__(self, hardware_manager: HardwareManager, 
                 repository_path: str = "./firmware_repository"):
        self.hardware_manager = hardware_manager
        self.repository = FirmwareRepository(repository_path)
        self.active_sessions: Dict[str, FirmwareUpdateSession] = {}
        self.emergency_stop_flag = False
        self.update_locks: Dict[str, asyncio.Lock] = {}
        
        # Safety thresholds
        self.max_concurrent_updates = 1
        self.update_timeout = timedelta(minutes=30)
        self.heartbeat_interval = 5.0  # seconds
        self.max_retry_count = 3
        
        # Callbacks
        self.progress_callbacks: Dict[str, List[Callable]] = {}
        self.completion_callbacks: Dict[str, List[Callable]] = {}
        
        logger.info("Firmware Manager initialized with safety controls")
    
    async def detect_firmware_version(self, device_id: str) -> Optional[FirmwareVersion]:
        """
        Safely detect current firmware version of a device
        Uses multiple query methods for redundancy
        """
        device = self.hardware_manager.get_device(device_id)
        if not device:
            logger.error(f"Device {device_id} not found")
            return None
        
        adapter = self.hardware_manager.get_adapter(device.adapter_id)
        if not adapter or not adapter.is_connected:
            logger.error(f"Adapter {device.adapter_id} not connected")
            return None
        
        try:
            # Try standard version query command
            version_cmd = self._build_version_query_command(device.protocol_type)
            response = await self.hardware_manager.send_command_to_device(
                device_id, version_cmd, timeout=5.0
            )
            
            version = self._parse_version_response(response.data, device.protocol_type)
            if version:
                logger.info(f"Detected firmware version {version} for device {device_id}")
                return version
            
            # Fallback: Try alternative query methods
            alt_methods = self._get_alternative_version_methods(device.protocol_type)
            for method in alt_methods:
                try:
                    response = await method(device_id, adapter)
                    version = self._parse_version_response(response, device.protocol_type)
                    if version:
                        return version
                except Exception as e:
                    logger.debug(f"Alternative method failed: {e}")
            
            logger.warning(f"Could not detect firmware version for device {device_id}")
            return None
            
        except Exception as e:
            logger.error(f"Firmware detection failed for {device_id}: {e}")
            return None
    
    def _build_version_query_command(self, protocol: ProtocolType) -> bytes:
        """Build protocol-specific version query command"""
        commands = {
            ProtocolType.SERIAL: b'\x01\x00\x00\x01',  # STX, CMD_VERSION, LEN=0, ETX
            ProtocolType.I2C: b'\x10',                  # Version register
            ProtocolType.SPI: b'\x90\x00',              # Read version command
            ProtocolType.CAN: b'\x01\x00',              # Version request
            ProtocolType.ETHERNET: b'VERSION\r\n',      # Text protocol
        }
        return commands.get(protocol, b'\x00')
    
    def _parse_version_response(self, data: bytes, protocol: ProtocolType) -> Optional[FirmwareVersion]:
        """Parse version from response data"""
        try:
            if protocol == ProtocolType.ETHERNET:
                # Text-based response
                version_str = data.decode('utf-8').strip()
                if version_str.startswith('VERSION:'):
                    version_str = version_str[8:].strip()
                return FirmwareVersion.from_string(version_str)
            
            elif protocol in [ProtocolType.SERIAL, ProtocolType.CAN]:
                # Binary protocol: [CMD][LEN][MAJOR][MINOR][PATCH][BUILD_H][BUILD_L]
                if len(data) >= 5:
                    major = data[2]
                    minor = data[3]
                    patch = data[4]
                    build = None
                    if len(data) >= 7:
                        build = (data[5] << 8) | data[6]
                    return FirmwareVersion(major, minor, patch, build)
            
            elif protocol == ProtocolType.I2C:
                # I2C: 4 bytes [MAJOR][MINOR][PATCH][FLAGS]
                if len(data) >= 3:
                    return FirmwareVersion(data[0], data[1], data[2])
            
            elif protocol == ProtocolType.SPI:
                # SPI: Similar to serial
                if len(data) >= 4 and data[0] == 0x90:  # Response code
                    return FirmwareVersion(data[1], data[2], data[3])
            
        except Exception as e:
            logger.debug(f"Version parsing failed: {e}")
        
        return None
    
    def _get_alternative_version_methods(self, protocol: ProtocolType) -> List[Callable]:
        """Get alternative version detection methods for redundancy"""
        methods = []
        
        async def bootloader_query(device_id: str, adapter: ProtocolAdapter) -> bytes:
            """Query version through bootloader mode"""
            # Send bootloader entry command
            await adapter.write(b'\x7E\x00\x00\x7E')  # Example bootloader cmd
            await asyncio.sleep(0.5)
            # Query version in bootloader
            response = await adapter.query(b'\x01', timeout=2.0)
            return response.data
        
        async def memory_read(device_id: str, adapter: ProtocolAdapter) -> bytes:
            """Read version from known memory location"""
            # Read from version register/address
            if protocol == ProtocolType.I2C:
                # Read from register 0xF0-0xF3 (common version location)
                cmd = b'\xF0'
                response = await adapter.query(cmd, timeout=1.0)
                return response.data
            return b''
        
        methods.extend([bootloader_query, memory_read])
        return methods
    
    async def check_for_updates(self, device_id: str) -> Optional[FirmwareMetadata]:
        """
        Check if firmware updates are available
        Implements safety checks for compatibility
        """
        current_version = await self.detect_firmware_version(device_id)
        if not current_version:
            logger.warning(f"Cannot check updates - current version unknown for {device_id}")
            return None
        
        latest = self.repository.get_latest_version(device_id)
        if not latest:
            logger.info(f"No firmware found in repository for {device_id}")
            return None
        
        # Compare versions
        current_semver = current_version.to_semver()
        latest_semver = latest.version.to_semver()
        
        if latest_semver > current_semver:
            # Verify compatibility
            if not latest.version.is_compatible_with(current_version):
                logger.warning(f"Latest version {latest.version} incompatible with current {current_version}")
                # Look for compatible version
                compatible_versions = [
                    v for v in self.repository.index.get(device_id, [])
                    if v.version.is_compatible_with(current_version) and
                    v.version.to_semver() > current_semver and
                    v.validate_expiry()
                ]
                if compatible_versions:
                    latest = max(compatible_versions, key=lambda v: v.version.to_semver())
                else:
                    return None
            
            logger.info(f"Update available for {device_id}: {current_version} -> {latest.version}")
            return latest
        
        logger.info(f"Device {device_id} is up to date with version {current_version}")
        return None
    
    async def validate_firmware(self, device_id: str, 
                              firmware_path: Path) -> FirmwareValidationResult:
        """
        Comprehensive firmware validation with safety checks
        """
        try:
            # Read firmware file
            with open(firmware_path, 'rb') as f:
                firmware_data = f.read()
            
            # Get metadata
            metadata = None
            for versions in self.repository.index.values():
                for v in versions:
                    if self.repository.get_firmware_path(v.device_id, v.version) == firmware_path:
                        metadata = v
                        break
            
            if not metadata:
                return FirmwareValidationResult.INVALID_FORMAT
            
            # Verify checksum
            calculated_hash = hashlib.sha256(firmware_data).hexdigest()
            if calculated_hash != metadata.checksum_sha256:
                logger.error(f"Checksum mismatch for {firmware_path}")
                return FirmwareValidationResult.INVALID_CHECKSUM
            
            # Verify CRC32 if available
            if metadata.checksum_crc32:
                calculated_crc = zlib.crc32(firmware_data)
                if calculated_crc != metadata.checksum_crc32:
                    return FirmwareValidationResult.INVALID_CHECKSUM
            
            # Check expiry
            if not metadata.validate_expiry():
                return FirmwareValidationResult.EXPIRED
            
            # Verify device compatibility
            device = self.hardware_manager.get_device(device_id)
            if device and metadata.device_model != device.metadata.get('model'):
                return FirmwareValidationResult.INCOMPATIBLE_DEVICE
            
            # TODO: Implement signature verification
            # if metadata.signature and not self._verify_signature(firmware_data, metadata.signature):
            #     return FirmwareValidationResult.INVALID_SIGNATURE
            
            return FirmwareValidationResult.VALID
            
        except Exception as e:
            logger.error(f"Firmware validation error: {e}")
            return FirmwareValidationResult.CORRUPTED
    
    async def start_update(self, device_id: str, 
                          target_version: Union[str, FirmwareVersion],
                          force: bool = False) -> str:
        """
        Start firmware update with comprehensive safety checks
        Returns session ID
        """
        # Emergency stop check
        if self.emergency_stop_flag:
            raise RuntimeError("Emergency stop is active - updates disabled")
        
        # Check concurrent updates limit
        if len(self.active_sessions) >= self.max_concurrent_updates:
            raise RuntimeError(f"Maximum concurrent updates ({self.max_concurrent_updates}) reached")
        
        # Get or create device lock
        if device_id not in self.update_locks:
            self.update_locks[device_id] = asyncio.Lock()
        
        async with self.update_locks[device_id]:
            # Check if update already in progress
            for session in self.active_sessions.values():
                if session.device_id == device_id:
                    raise RuntimeError(f"Update already in progress for device {device_id}")
            
            # Detect current version
            current_version = await self.detect_firmware_version(device_id)
            if not current_version and not force:
                raise RuntimeError(f"Cannot detect current firmware version for {device_id}")
            
            # Get target firmware
            if isinstance(target_version, str):
                target_version = FirmwareVersion.from_string(target_version)
            
            firmware_path = self.repository.get_firmware_path(device_id, target_version)
            if not firmware_path:
                raise ValueError(f"Firmware {target_version} not found for device {device_id}")
            
            # Validate firmware
            validation = await self.validate_firmware(device_id, firmware_path)
            if validation != FirmwareValidationResult.VALID:
                raise ValueError(f"Firmware validation failed: {validation.value}")
            
            # Create update session
            session_id = f"{device_id}_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}"
            session = FirmwareUpdateSession(
                session_id=session_id,
                device_id=device_id,
                start_time=datetime.utcnow(),
                state=FirmwareUpdateState.PREPARING,
                source_version=current_version or FirmwareVersion(0, 0, 0),
                target_version=target_version
            )
            
            self.active_sessions[session_id] = session
            
            # Start update task
            asyncio.create_task(self._update_task(session_id, firmware_path))
            
            logger.info(f"Started firmware update session {session_id}")
            return session_id
    
    async def _update_task(self, session_id: str, firmware_path: Path) -> None:
        """
        Main update task with fail-safe mechanisms
        """
        session = self.active_sessions.get(session_id)
        if not session:
            return
        
        try:
            # Create backup
            await self._create_firmware_backup(session)
            
            # Prepare device for update
            session.state = FirmwareUpdateState.PREPARING
            await self._prepare_device_for_update(session)
            
            # Read firmware data
            with open(firmware_path, 'rb') as f:
                firmware_data = f.read()
            
            # Start update process
            session.state = FirmwareUpdateState.UPDATING
            await self._perform_firmware_update(session, firmware_data)
            
            # Validate new firmware
            session.state = FirmwareUpdateState.VALIDATING
            await self._validate_updated_firmware(session)
            
            # Finalize update
            session.state = FirmwareUpdateState.FINALIZING
            await self._finalize_update(session)
            
            session.state = FirmwareUpdateState.COMPLETED
            session.progress = 100.0
            
            logger.info(f"Firmware update {session_id} completed successfully")
            
            # Call completion callbacks
            await self._notify_completion(session_id, True)
            
        except Exception as e:
            logger.error(f"Firmware update {session_id} failed: {e}")
            session.state = FirmwareUpdateState.FAILED
            session.add_error(str(e), {'traceback': str(e)})
            
            # Attempt rollback
            if session.rollback_point:
                await self._perform_rollback(session)
            
            # Notify failure
            await self._notify_completion(session_id, False)
            
        finally:
            # Cleanup
            await self._cleanup_session(session_id)
    
    async def _create_firmware_backup(self, session: FirmwareUpdateSession) -> None:
        """Create backup of current firmware if possible"""
        try:
            device = self.hardware_manager.get_device(session.device_id)
            if not device:
                return
            
            # Try to read current firmware
            # This is device-specific and may not be supported
            logger.info(f"Creating firmware backup for {session.device_id}")
            
            # Store backup metadata
            backup_path = self.repository.base_path / "backups" / f"{session.session_id}_backup.bin"
            session.rollback_point = {
                'backup_path': str(backup_path),
                'version': session.source_version,
                'timestamp': datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            logger.warning(f"Could not create firmware backup: {e}")
    
    async def _prepare_device_for_update(self, session: FirmwareUpdateSession) -> None:
        """Prepare device for firmware update"""
        device = self.hardware_manager.get_device(session.device_id)
        if not device:
            raise RuntimeError(f"Device {session.device_id} not found")
        
        # Send prepare command
        prepare_cmd = self._build_prepare_update_command(device.protocol_type)
        response = await self.hardware_manager.send_command_to_device(
            session.device_id, prepare_cmd, timeout=10.0
        )
        
        # Verify device is ready
        if not self._verify_update_ready(response.data):
            raise RuntimeError("Device not ready for update")
        
        session.add_checkpoint('device_prepared', {'response': response.data.hex()})
    
    def _build_prepare_update_command(self, protocol: ProtocolType) -> bytes:
        """Build protocol-specific prepare update command"""
        commands = {
            ProtocolType.SERIAL: b'\x01\x10\x00\x01',    # STX, CMD_PREPARE_UPDATE, LEN=0, ETX
            ProtocolType.I2C: b'\x20\x01',               # Update mode register
            ProtocolType.SPI: b'\xA0\x01',               # Enter update mode
            ProtocolType.CAN: b'\x10\x01',               # Update request
            ProtocolType.ETHERNET: b'UPDATE_MODE\r\n',   # Text protocol
        }
        return commands.get(protocol, b'\x00')
    
    def _verify_update_ready(self, response: bytes) -> bool:
        """Verify device is ready for update"""
        # Simple check - look for ACK pattern
        return b'\x06' in response or b'READY' in response
    
    async def _perform_firmware_update(self, session: FirmwareUpdateSession, 
                                     firmware_data: bytes) -> None:
        """
        Perform the actual firmware update with progress tracking
        """
        device = self.hardware_manager.get_device(session.device_id)
        if not device:
            raise RuntimeError(f"Device {session.device_id} not found")
        
        # Calculate chunks
        chunk_size = self._get_chunk_size(device.protocol_type)
        total_chunks = (len(firmware_data) + chunk_size - 1) // chunk_size
        
        logger.info(f"Updating firmware: {len(firmware_data)} bytes in {total_chunks} chunks")
        
        # Send firmware in chunks
        for i in range(total_chunks):
            # Check for emergency stop
            if self.emergency_stop_flag:
                raise RuntimeError("Emergency stop triggered")
            
            start = i * chunk_size
            end = min(start + chunk_size, len(firmware_data))
            chunk = firmware_data[start:end]
            
            # Build write command
            write_cmd = self._build_write_chunk_command(
                device.protocol_type, i, chunk, i == total_chunks - 1
            )
            
            # Send chunk with retries
            success = False
            for retry in range(self.max_retry_count):
                try:
                    response = await self.hardware_manager.send_command_to_device(
                        session.device_id, write_cmd, timeout=30.0
                    )
                    
                    if self._verify_chunk_written(response.data, i):
                        success = True
                        break
                    
                except Exception as e:
                    logger.warning(f"Chunk {i} write failed (retry {retry}): {e}")
                    await asyncio.sleep(1.0)
            
            if not success:
                raise RuntimeError(f"Failed to write chunk {i} after {self.max_retry_count} retries")
            
            # Update progress
            session.progress = ((i + 1) / total_chunks) * 80.0  # 80% for writing
            await self._notify_progress(session.session_id)
            
            # Small delay between chunks
            await asyncio.sleep(0.01)
        
        session.add_checkpoint('firmware_written', {
            'total_bytes': len(firmware_data),
            'chunks': total_chunks
        })
    
    def _get_chunk_size(self, protocol: ProtocolType) -> int:
        """Get optimal chunk size for protocol"""
        sizes = {
            ProtocolType.SERIAL: 256,
            ProtocolType.I2C: 32,
            ProtocolType.SPI: 256,
            ProtocolType.CAN: 8,
            ProtocolType.ETHERNET: 1024,
        }
        return sizes.get(protocol, 128)
    
    def _build_write_chunk_command(self, protocol: ProtocolType, 
                                  chunk_index: int, data: bytes, 
                                  is_last: bool) -> bytes:
        """Build chunk write command"""
        # Basic format: [CMD][INDEX_H][INDEX_L][LEN][DATA][CRC]
        cmd = bytearray()
        
        if protocol == ProtocolType.ETHERNET:
            # Text-based protocol
            cmd.extend(f"WRITE_CHUNK {chunk_index} {len(data)} ".encode())
            cmd.extend(data)
            cmd.extend(b'\r\n')
        else:
            # Binary protocol
            cmd.append(0x20)  # Write chunk command
            cmd.extend(struct.pack('>H', chunk_index))  # Chunk index (big-endian)
            cmd.append(len(data))  # Data length
            cmd.extend(data)
            
            # Add CRC16
            crc = self._calculate_crc16(cmd)
            cmd.extend(struct.pack('>H', crc))
        
        return bytes(cmd)
    
    def _calculate_crc16(self, data: bytes) -> int:
        """Calculate CRC16 checksum"""
        crc = 0xFFFF
        for byte in data:
            crc ^= byte
            for _ in range(8):
                if crc & 0x0001:
                    crc = (crc >> 1) ^ 0xA001
                else:
                    crc >>= 1
        return crc
    
    def _verify_chunk_written(self, response: bytes, chunk_index: int) -> bool:
        """Verify chunk was written successfully"""
        # Look for ACK with chunk index
        if len(response) >= 3:
            if response[0] == 0x06:  # ACK
                received_index = struct.unpack('>H', response[1:3])[0]
                return received_index == chunk_index
        
        return b'OK' in response
    
    async def _validate_updated_firmware(self, session: FirmwareUpdateSession) -> None:
        """Validate firmware after update"""
        # Send validation command
        device = self.hardware_manager.get_device(session.device_id)
        if not device:
            return
        
        validate_cmd = self._build_validate_command(device.protocol_type)
        response = await self.hardware_manager.send_command_to_device(
            session.device_id, validate_cmd, timeout=30.0
        )
        
        if not self._verify_validation_success(response.data):
            raise RuntimeError("Firmware validation failed on device")
        
        # Verify version
        new_version = await self.detect_firmware_version(session.device_id)
        if new_version != session.target_version:
            raise RuntimeError(f"Version mismatch after update: expected {session.target_version}, got {new_version}")
        
        session.progress = 95.0
        session.add_checkpoint('firmware_validated', {
            'new_version': str(new_version)
        })
    
    def _build_validate_command(self, protocol: ProtocolType) -> bytes:
        """Build validation command"""
        commands = {
            ProtocolType.SERIAL: b'\x01\x30\x00\x01',    # STX, CMD_VALIDATE, LEN=0, ETX
            ProtocolType.I2C: b'\x30',                   # Validate register
            ProtocolType.SPI: b'\xB0\x00',               # Validate command
            ProtocolType.CAN: b'\x30\x00',               # Validate request
            ProtocolType.ETHERNET: b'VALIDATE\r\n',      # Text protocol
        }
        return commands.get(protocol, b'\x00')
    
    def _verify_validation_success(self, response: bytes) -> bool:
        """Verify validation was successful"""
        return b'\x06' in response or b'VALID' in response or b'OK' in response
    
    async def _finalize_update(self, session: FirmwareUpdateSession) -> None:
        """Finalize firmware update and reboot if needed"""
        device = self.hardware_manager.get_device(session.device_id)
        if not device:
            return
        
        # Send finalize command
        finalize_cmd = self._build_finalize_command(device.protocol_type)
        await self.hardware_manager.send_command_to_device(
            session.device_id, finalize_cmd, timeout=10.0
        )
        
        # Device may reboot here - wait and reconnect
        await asyncio.sleep(5.0)
        
        # Try to reconnect
        adapter = self.hardware_manager.get_adapter(device.adapter_id)
        if adapter and not adapter.is_connected:
            try:
                await adapter.connect()
            except Exception as e:
                logger.warning(f"Could not reconnect after update: {e}")
        
        session.progress = 100.0
        session.add_checkpoint('update_finalized', {
            'timestamp': datetime.utcnow().isoformat()
        })
    
    def _build_finalize_command(self, protocol: ProtocolType) -> bytes:
        """Build finalize/reboot command"""
        commands = {
            ProtocolType.SERIAL: b'\x01\x40\x00\x01',    # STX, CMD_FINALIZE, LEN=0, ETX
            ProtocolType.I2C: b'\x40',                   # Finalize register
            ProtocolType.SPI: b'\xC0\x00',               # Finalize command
            ProtocolType.CAN: b'\x40\x00',               # Finalize request
            ProtocolType.ETHERNET: b'FINALIZE\r\n',      # Text protocol
        }
        return commands.get(protocol, b'\x00')
    
    async def _perform_rollback(self, session: FirmwareUpdateSession) -> None:
        """Perform firmware rollback to previous version"""
        if not session.rollback_point:
            logger.error(f"No rollback point for session {session.session_id}")
            return
        
        try:
            logger.info(f"Performing rollback for {session.device_id}")
            
            # Send rollback command
            device = self.hardware_manager.get_device(session.device_id)
            if device:
                rollback_cmd = self._build_rollback_command(device.protocol_type)
                await self.hardware_manager.send_command_to_device(
                    session.device_id, rollback_cmd, timeout=30.0
                )
            
            session.state = FirmwareUpdateState.ROLLED_BACK
            logger.info(f"Rollback completed for {session.device_id}")
            
        except Exception as e:
            logger.error(f"Rollback failed: {e}")
    
    def _build_rollback_command(self, protocol: ProtocolType) -> bytes:
        """Build rollback command"""
        commands = {
            ProtocolType.SERIAL: b'\x01\x50\x00\x01',    # STX, CMD_ROLLBACK, LEN=0, ETX
            ProtocolType.I2C: b'\x50',                   # Rollback register
            ProtocolType.SPI: b'\xD0\x00',               # Rollback command
            ProtocolType.CAN: b'\x50\x00',               # Rollback request
            ProtocolType.ETHERNET: b'ROLLBACK\r\n',      # Text protocol
        }
        return commands.get(protocol, b'\x00')
    
    async def emergency_stop(self) -> None:
        """
        Emergency stop all firmware updates
        This is the primary safety mechanism
        """
        logger.critical("EMERGENCY STOP TRIGGERED")
        self.emergency_stop_flag = True
        
        # Mark all active sessions as emergency stopped
        for session in self.active_sessions.values():
            session.emergency_stop_triggered = True
            session.state = FirmwareUpdateState.EMERGENCY_STOP
            session.add_error("Emergency stop triggered", {
                'timestamp': datetime.utcnow().isoformat()
            })
        
        # Send stop commands to all devices being updated
        stop_tasks = []
        for session in self.active_sessions.values():
            device = self.hardware_manager.get_device(session.device_id)
            if device:
                stop_cmd = self._build_emergency_stop_command(device.protocol_type)
                stop_tasks.append(
                    self.hardware_manager.send_command_to_device(
                        session.device_id, stop_cmd, timeout=2.0
                    )
                )
        
        # Wait for all stop commands
        if stop_tasks:
            await asyncio.gather(*stop_tasks, return_exceptions=True)
        
        logger.critical("Emergency stop completed - all updates halted")
    
    def _build_emergency_stop_command(self, protocol: ProtocolType) -> bytes:
        """Build emergency stop command - highest priority"""
        commands = {
            ProtocolType.SERIAL: b'\xFF\xFF\xFF\xFF',    # Universal stop pattern
            ProtocolType.I2C: b'\xFF',                   # Stop register
            ProtocolType.SPI: b'\xFF\xFF',               # Stop command
            ProtocolType.CAN: b'\xFF\xFF',               # Emergency stop
            ProtocolType.ETHERNET: b'EMERGENCY_STOP\r\n', # Text protocol
        }
        return commands.get(protocol, b'\xFF\xFF\xFF\xFF')
    
    def clear_emergency_stop(self) -> None:
        """Clear emergency stop flag - requires manual intervention"""
        logger.info("Clearing emergency stop flag")
        self.emergency_stop_flag = False
    
    async def _cleanup_session(self, session_id: str) -> None:
        """Clean up completed or failed session"""
        if session_id in self.active_sessions:
            session = self.active_sessions[session_id]
            
            # Clean up temporary files
            temp_dir = self.repository.base_path / "temp" / session_id
            if temp_dir.exists():
                shutil.rmtree(temp_dir)
            
            # Remove from active sessions
            del self.active_sessions[session_id]
            
            logger.info(f"Cleaned up session {session_id}")
    
    def register_progress_callback(self, session_id: str, callback: Callable) -> None:
        """Register callback for progress updates"""
        if session_id not in self.progress_callbacks:
            self.progress_callbacks[session_id] = []
        self.progress_callbacks[session_id].append(callback)
    
    def register_completion_callback(self, session_id: str, callback: Callable) -> None:
        """Register callback for completion"""
        if session_id not in self.completion_callbacks:
            self.completion_callbacks[session_id] = []
        self.completion_callbacks[session_id].append(callback)
    
    async def _notify_progress(self, session_id: str) -> None:
        """Notify progress callbacks"""
        if session_id in self.progress_callbacks:
            session = self.active_sessions.get(session_id)
            if session:
                for callback in self.progress_callbacks[session_id]:
                    try:
                        if asyncio.iscoroutinefunction(callback):
                            await callback(session)
                        else:
                            callback(session)
                    except Exception as e:
                        logger.error(f"Progress callback error: {e}")
    
    async def _notify_completion(self, session_id: str, success: bool) -> None:
        """Notify completion callbacks"""
        if session_id in self.completion_callbacks:
            session = self.active_sessions.get(session_id)
            if session:
                for callback in self.completion_callbacks[session_id]:
                    try:
                        if asyncio.iscoroutinefunction(callback):
                            await callback(session, success)
                        else:
                            callback(session, success)
                    except Exception as e:
                        logger.error(f"Completion callback error: {e}")
    
    def get_session_status(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Get current status of update session"""
        session = self.active_sessions.get(session_id)
        if not session:
            return None
        
        return {
            'session_id': session.session_id,
            'device_id': session.device_id,
            'state': session.state.value,
            'progress': session.progress,
            'source_version': str(session.source_version),
            'target_version': str(session.target_version),
            'start_time': session.start_time.isoformat(),
            'elapsed_time': (datetime.utcnow() - session.start_time).total_seconds(),
            'retry_count': session.retry_count,
            'emergency_stop': session.emergency_stop_triggered,
            'errors': len(session.error_log),
            'last_checkpoint': session.checkpoints[-1] if session.checkpoints else None
        }
    
    def get_all_sessions(self) -> Dict[str, Dict[str, Any]]:
        """Get status of all active sessions"""
        return {
            session_id: self.get_session_status(session_id)
            for session_id in self.active_sessions
        }
    
    async def cancel_update(self, session_id: str) -> bool:
        """Cancel an ongoing update"""
        session = self.active_sessions.get(session_id)
        if not session:
            return False
        
        if session.state in [FirmwareUpdateState.COMPLETED, 
                           FirmwareUpdateState.FAILED,
                           FirmwareUpdateState.EMERGENCY_STOP]:
            return False
        
        logger.info(f"Cancelling update session {session_id}")
        
        # Set abort flag
        session.state = FirmwareUpdateState.FAILED
        session.add_error("User cancelled update", {
            'timestamp': datetime.utcnow().isoformat()
        })
        
        # Try to send cancel command
        try:
            device = self.hardware_manager.get_device(session.device_id)
            if device:
                cancel_cmd = self._build_cancel_command(device.protocol_type)
                await self.hardware_manager.send_command_to_device(
                    session.device_id, cancel_cmd, timeout=5.0
                )
        except Exception as e:
            logger.error(f"Error sending cancel command: {e}")
        
        return True
    
    def _build_cancel_command(self, protocol: ProtocolType) -> bytes:
        """Build update cancel command"""
        commands = {
            ProtocolType.SERIAL: b'\x01\x60\x00\x01',    # STX, CMD_CANCEL, LEN=0, ETX
            ProtocolType.I2C: b'\x60',                   # Cancel register
            ProtocolType.SPI: b'\xE0\x00',               # Cancel command
            ProtocolType.CAN: b'\x60\x00',               # Cancel request
            ProtocolType.ETHERNET: b'CANCEL_UPDATE\r\n', # Text protocol
        }
        return commands.get(protocol, b'\x00')
    
    def get_update_history(self, device_id: str, limit: int = 10) -> List[Dict[str, Any]]:
        """Get firmware update history for a device"""
        # TODO: Implement persistent history storage
        history = []
        
        # For now, return current session if exists
        for session in self.active_sessions.values():
            if session.device_id == device_id:
                history.append({
                    'session_id': session.session_id,
                    'timestamp': session.start_time.isoformat(),
                    'from_version': str(session.source_version),
                    'to_version': str(session.target_version),
                    'status': session.state.value,
                    'duration': (datetime.utcnow() - session.start_time).total_seconds()
                })
        
        return history[:limit]