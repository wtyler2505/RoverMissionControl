"""
Protocol-specific analyzers for communication logging
Provides deep packet inspection and protocol-aware analysis
"""

import struct
import json
from abc import ABC, abstractmethod
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple, Union
from dataclasses import dataclass, field
from enum import Enum
import re

from .base import ProtocolType, DataPacket, DataDirection
from .communication_logger import CommunicationLogEntry, LogLevel


class AnalysisResult:
    """Result of protocol analysis"""
    def __init__(self,
                 protocol_type: ProtocolType,
                 summary: str,
                 details: Dict[str, Any],
                 warnings: Optional[List[str]] = None,
                 errors: Optional[List[str]] = None):
        self.protocol_type = protocol_type
        self.summary = summary
        self.details = details
        self.warnings = warnings or []
        self.errors = errors or []
        self.timestamp = datetime.utcnow()


class ProtocolAnalyzer(ABC):
    """Base class for protocol analyzers"""
    
    def __init__(self):
        self.statistics = {
            'packets_analyzed': 0,
            'errors_found': 0,
            'warnings_found': 0
        }
    
    @abstractmethod
    def analyze_packet(self, packet: DataPacket) -> AnalysisResult:
        """Analyze a single packet"""
        pass
    
    @abstractmethod
    def analyze_stream(self, packets: List[DataPacket]) -> AnalysisResult:
        """Analyze a stream of packets"""
        pass
    
    @abstractmethod
    def get_protocol_type(self) -> ProtocolType:
        """Get the protocol type this analyzer handles"""
        pass
    
    def update_statistics(self, result: AnalysisResult) -> None:
        """Update analyzer statistics"""
        self.statistics['packets_analyzed'] += 1
        self.statistics['errors_found'] += len(result.errors)
        self.statistics['warnings_found'] += len(result.warnings)


class SerialAnalyzer(ProtocolAnalyzer):
    """Analyzer for serial communication (UART/RS232/RS485)"""
    
    def __init__(self):
        super().__init__()
        self.frame_patterns = {
            'modbus_rtu': re.compile(rb'^[\x01-\xF7][\x01-\x7F].+[\x00-\xFF]{2}$'),
            'nmea': re.compile(rb'^\$[A-Z]{2}[A-Z0-9]{3},.+\*[0-9A-F]{2}\r\n$'),
            'at_command': re.compile(rb'^AT.+\r\n$'),
        }
    
    def get_protocol_type(self) -> ProtocolType:
        return ProtocolType.SERIAL
    
    def analyze_packet(self, packet: DataPacket) -> AnalysisResult:
        """Analyze serial packet for common protocols and issues"""
        data = packet.data
        details = {
            'size': len(data),
            'direction': packet.direction.value
        }
        warnings = []
        errors = []
        
        # Check for common serial protocols
        protocol_detected = None
        for protocol, pattern in self.frame_patterns.items():
            if pattern.match(data):
                protocol_detected = protocol
                break
        
        if protocol_detected:
            details['detected_protocol'] = protocol_detected
            
            if protocol_detected == 'modbus_rtu':
                details.update(self._analyze_modbus_rtu(data))
            elif protocol_detected == 'nmea':
                details.update(self._analyze_nmea(data))
            elif protocol_detected == 'at_command':
                details.update(self._analyze_at_command(data))
        else:
            # Generic serial analysis
            details['hex'] = data.hex()
            details['ascii'] = data.decode('ascii', errors='replace')
            
            # Check for common issues
            if b'\x00' in data:
                warnings.append("Null bytes detected in data")
            
            if len(data) > 1024:
                warnings.append(f"Large packet size: {len(data)} bytes")
        
        # Check for parity/framing errors in metadata
        if 'parity_error' in packet.metadata and packet.metadata['parity_error']:
            errors.append("Parity error detected")
        
        if 'framing_error' in packet.metadata and packet.metadata['framing_error']:
            errors.append("Framing error detected")
        
        summary = f"Serial packet: {len(data)} bytes"
        if protocol_detected:
            summary += f" ({protocol_detected})"
        
        result = AnalysisResult(
            protocol_type=ProtocolType.SERIAL,
            summary=summary,
            details=details,
            warnings=warnings,
            errors=errors
        )
        
        self.update_statistics(result)
        return result
    
    def _analyze_modbus_rtu(self, data: bytes) -> Dict[str, Any]:
        """Analyze Modbus RTU frame"""
        if len(data) < 4:
            return {'error': 'Invalid Modbus RTU frame size'}
        
        slave_addr = data[0]
        function_code = data[1]
        crc = struct.unpack('<H', data[-2:])[0]
        
        # Calculate CRC
        calculated_crc = self._calculate_modbus_crc(data[:-2])
        crc_valid = crc == calculated_crc
        
        return {
            'modbus': {
                'slave_address': slave_addr,
                'function_code': function_code,
                'function_name': self._get_modbus_function_name(function_code),
                'crc': f"0x{crc:04X}",
                'crc_valid': crc_valid,
                'payload': data[2:-2].hex()
            }
        }
    
    def _calculate_modbus_crc(self, data: bytes) -> int:
        """Calculate Modbus CRC16"""
        crc = 0xFFFF
        for byte in data:
            crc ^= byte
            for _ in range(8):
                if crc & 0x0001:
                    crc = (crc >> 1) ^ 0xA001
                else:
                    crc >>= 1
        return crc
    
    def _get_modbus_function_name(self, code: int) -> str:
        """Get Modbus function name from code"""
        functions = {
            1: "Read Coils",
            2: "Read Discrete Inputs",
            3: "Read Holding Registers",
            4: "Read Input Registers",
            5: "Write Single Coil",
            6: "Write Single Register",
            15: "Write Multiple Coils",
            16: "Write Multiple Registers"
        }
        return functions.get(code, f"Unknown (0x{code:02X})")
    
    def _analyze_nmea(self, data: bytes) -> Dict[str, Any]:
        """Analyze NMEA sentence"""
        try:
            sentence = data.decode('ascii').strip()
            parts = sentence.split(',')
            
            talker_id = parts[0][1:3]
            sentence_type = parts[0][3:6]
            checksum = sentence.split('*')[1] if '*' in sentence else None
            
            # Calculate checksum
            if checksum:
                calc_checksum = 0
                for char in sentence[1:sentence.index('*')]:
                    calc_checksum ^= ord(char)
                checksum_valid = int(checksum, 16) == calc_checksum
            else:
                checksum_valid = None
            
            return {
                'nmea': {
                    'talker_id': talker_id,
                    'sentence_type': sentence_type,
                    'fields': parts[1:],
                    'checksum': checksum,
                    'checksum_valid': checksum_valid
                }
            }
        except Exception as e:
            return {'nmea_error': str(e)}
    
    def _analyze_at_command(self, data: bytes) -> Dict[str, Any]:
        """Analyze AT command"""
        try:
            command = data.decode('ascii').strip()
            
            # Parse command type
            if command.startswith('AT+'):
                cmd_type = 'Extended'
                cmd_name = command[3:].split('=')[0].split('?')[0]
            elif command == 'AT':
                cmd_type = 'Basic'
                cmd_name = 'AT'
            else:
                cmd_type = 'Basic'
                cmd_name = command[2:]
            
            # Check if it's a query, set, or execute
            if '?' in command:
                operation = 'Query'
            elif '=' in command:
                operation = 'Set'
            else:
                operation = 'Execute'
            
            return {
                'at_command': {
                    'type': cmd_type,
                    'command': cmd_name,
                    'operation': operation,
                    'full_command': command
                }
            }
        except Exception as e:
            return {'at_error': str(e)}
    
    def analyze_stream(self, packets: List[DataPacket]) -> AnalysisResult:
        """Analyze a stream of serial packets"""
        if not packets:
            return AnalysisResult(
                protocol_type=ProtocolType.SERIAL,
                summary="No packets to analyze",
                details={}
            )
        
        # Analyze timing between packets
        timings = []
        for i in range(1, len(packets)):
            if hasattr(packets[i], 'timestamp') and hasattr(packets[i-1], 'timestamp'):
                delta = (packets[i].timestamp - packets[i-1].timestamp).total_seconds()
                timings.append(delta)
        
        # Detect protocols in stream
        protocols_detected = set()
        total_bytes = 0
        tx_bytes = 0
        rx_bytes = 0
        
        for packet in packets:
            result = self.analyze_packet(packet)
            if 'detected_protocol' in result.details:
                protocols_detected.add(result.details['detected_protocol'])
            
            total_bytes += len(packet.data)
            if packet.direction == DataDirection.TX:
                tx_bytes += len(packet.data)
            else:
                rx_bytes += len(packet.data)
        
        details = {
            'packet_count': len(packets),
            'total_bytes': total_bytes,
            'tx_bytes': tx_bytes,
            'rx_bytes': rx_bytes,
            'protocols_detected': list(protocols_detected),
            'timing': {
                'min_interval': min(timings) if timings else None,
                'max_interval': max(timings) if timings else None,
                'avg_interval': sum(timings) / len(timings) if timings else None
            }
        }
        
        warnings = []
        if timings and max(timings) > 1.0:
            warnings.append(f"Long delay detected: {max(timings):.2f}s")
        
        summary = f"Serial stream: {len(packets)} packets, {total_bytes} bytes"
        
        return AnalysisResult(
            protocol_type=ProtocolType.SERIAL,
            summary=summary,
            details=details,
            warnings=warnings
        )


class I2CAnalyzer(ProtocolAnalyzer):
    """Analyzer for I2C communication"""
    
    def get_protocol_type(self) -> ProtocolType:
        return ProtocolType.I2C
    
    def analyze_packet(self, packet: DataPacket) -> AnalysisResult:
        """Analyze I2C packet"""
        data = packet.data
        metadata = packet.metadata
        
        details = {
            'size': len(data),
            'direction': packet.direction.value
        }
        warnings = []
        errors = []
        
        # Extract I2C-specific metadata
        if 'address' in metadata:
            addr = metadata['address']
            details['address'] = f"0x{addr:02X}"
            details['address_type'] = '10-bit' if addr > 0x7F else '7-bit'
            
            # Check for reserved addresses
            if addr in [0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07]:
                warnings.append(f"Reserved I2C address used: 0x{addr:02X}")
        
        if 'ack' in metadata:
            details['acknowledged'] = metadata['ack']
            if not metadata['ack']:
                errors.append("NACK received")
        
        if 'clock_stretching' in metadata and metadata['clock_stretching']:
            details['clock_stretching'] = True
            warnings.append("Clock stretching detected")
        
        # Analyze common I2C patterns
        if len(data) >= 1:
            # Check for register read/write pattern
            if packet.direction == DataDirection.TX and len(data) == 1:
                details['possible_operation'] = 'Register address set'
                details['register'] = f"0x{data[0]:02X}"
            elif packet.direction == DataDirection.TX and len(data) == 2:
                details['possible_operation'] = 'Register write'
                details['register'] = f"0x{data[0]:02X}"
                details['value'] = f"0x{data[1]:02X}"
            elif packet.direction == DataDirection.RX:
                details['possible_operation'] = 'Data read'
                details['data_hex'] = data.hex()
        
        summary = f"I2C {'Write' if packet.direction == DataDirection.TX else 'Read'}: {len(data)} bytes"
        if 'address' in metadata:
            summary += f" @ 0x{metadata['address']:02X}"
        
        result = AnalysisResult(
            protocol_type=ProtocolType.I2C,
            summary=summary,
            details=details,
            warnings=warnings,
            errors=errors
        )
        
        self.update_statistics(result)
        return result
    
    def analyze_stream(self, packets: List[DataPacket]) -> AnalysisResult:
        """Analyze I2C transaction stream"""
        if not packets:
            return AnalysisResult(
                protocol_type=ProtocolType.I2C,
                summary="No packets to analyze",
                details={}
            )
        
        # Group packets into transactions
        transactions = []
        current_transaction = []
        
        for packet in packets:
            if 'start_condition' in packet.metadata and packet.metadata['start_condition']:
                if current_transaction:
                    transactions.append(current_transaction)
                current_transaction = [packet]
            else:
                current_transaction.append(packet)
        
        if current_transaction:
            transactions.append(current_transaction)
        
        # Analyze transactions
        device_addresses = set()
        total_bytes = 0
        failed_transactions = 0
        
        transaction_types = {
            'read': 0,
            'write': 0,
            'read_write': 0
        }
        
        for transaction in transactions:
            has_write = any(p.direction == DataDirection.TX for p in transaction)
            has_read = any(p.direction == DataDirection.RX for p in transaction)
            
            if has_write and has_read:
                transaction_types['read_write'] += 1
            elif has_write:
                transaction_types['write'] += 1
            elif has_read:
                transaction_types['read'] += 1
            
            # Check for failures
            for packet in transaction:
                if 'address' in packet.metadata:
                    device_addresses.add(packet.metadata['address'])
                if 'ack' in packet.metadata and not packet.metadata['ack']:
                    failed_transactions += 1
                    break
                total_bytes += len(packet.data)
        
        details = {
            'transaction_count': len(transactions),
            'total_bytes': total_bytes,
            'unique_devices': len(device_addresses),
            'device_addresses': [f"0x{addr:02X}" for addr in sorted(device_addresses)],
            'transaction_types': transaction_types,
            'failed_transactions': failed_transactions,
            'success_rate': (len(transactions) - failed_transactions) / len(transactions) * 100 if transactions else 0
        }
        
        warnings = []
        if failed_transactions > 0:
            warnings.append(f"{failed_transactions} failed transactions detected")
        
        if len(device_addresses) > 10:
            warnings.append(f"High number of devices on bus: {len(device_addresses)}")
        
        summary = f"I2C stream: {len(transactions)} transactions, {len(device_addresses)} devices"
        
        return AnalysisResult(
            protocol_type=ProtocolType.I2C,
            summary=summary,
            details=details,
            warnings=warnings
        )


class SPIAnalyzer(ProtocolAnalyzer):
    """Analyzer for SPI communication"""
    
    def get_protocol_type(self) -> ProtocolType:
        return ProtocolType.SPI
    
    def analyze_packet(self, packet: DataPacket) -> AnalysisResult:
        """Analyze SPI packet"""
        data = packet.data
        metadata = packet.metadata
        
        details = {
            'size': len(data),
            'direction': packet.direction.value
        }
        warnings = []
        errors = []
        
        # Extract SPI-specific metadata
        if 'chip_select' in metadata:
            details['chip_select'] = metadata['chip_select']
        
        if 'clock_speed' in metadata:
            details['clock_speed'] = f"{metadata['clock_speed'] / 1e6:.2f} MHz"
        
        if 'mode' in metadata:
            details['spi_mode'] = metadata['mode']
        
        # Since SPI is full-duplex, we might have MOSI and MISO data
        if 'mosi' in metadata and 'miso' in metadata:
            details['mosi_data'] = metadata['mosi'].hex() if isinstance(metadata['mosi'], bytes) else str(metadata['mosi'])
            details['miso_data'] = metadata['miso'].hex() if isinstance(metadata['miso'], bytes) else str(metadata['miso'])
        else:
            details['data_hex'] = data.hex()
        
        # Analyze common SPI patterns
        if len(data) >= 1:
            first_byte = data[0]
            
            # Check for common command patterns
            if first_byte & 0x80:
                details['possible_operation'] = 'Read command' if first_byte & 0x80 else 'Write command'
            
            # Check for register-based protocols
            if len(data) >= 2:
                details['possible_register'] = f"0x{data[0] & 0x7F:02X}"
                details['register_data'] = data[1:].hex()
        
        summary = f"SPI transfer: {len(data)} bytes"
        if 'chip_select' in metadata:
            summary += f" (CS{metadata['chip_select']})"
        
        result = AnalysisResult(
            protocol_type=ProtocolType.SPI,
            summary=summary,
            details=details,
            warnings=warnings,
            errors=errors
        )
        
        self.update_statistics(result)
        return result
    
    def analyze_stream(self, packets: List[DataPacket]) -> AnalysisResult:
        """Analyze SPI communication stream"""
        if not packets:
            return AnalysisResult(
                protocol_type=ProtocolType.SPI,
                summary="No packets to analyze",
                details={}
            )
        
        # Group by chip select
        cs_groups = {}
        total_bytes = 0
        
        for packet in packets:
            cs = packet.metadata.get('chip_select', 'unknown')
            if cs not in cs_groups:
                cs_groups[cs] = []
            cs_groups[cs].append(packet)
            total_bytes += len(packet.data)
        
        # Analyze each chip select separately
        cs_stats = {}
        for cs, cs_packets in cs_groups.items():
            cs_stats[f"CS{cs}"] = {
                'packet_count': len(cs_packets),
                'total_bytes': sum(len(p.data) for p in cs_packets),
                'avg_packet_size': sum(len(p.data) for p in cs_packets) / len(cs_packets)
            }
        
        # Check for clock speed variations
        clock_speeds = set()
        for packet in packets:
            if 'clock_speed' in packet.metadata:
                clock_speeds.add(packet.metadata['clock_speed'])
        
        details = {
            'packet_count': len(packets),
            'total_bytes': total_bytes,
            'chip_selects': len(cs_groups),
            'cs_statistics': cs_stats,
            'clock_speeds': [f"{speed/1e6:.2f} MHz" for speed in sorted(clock_speeds)]
        }
        
        warnings = []
        if len(clock_speeds) > 1:
            warnings.append("Multiple clock speeds detected")
        
        summary = f"SPI stream: {len(packets)} packets, {len(cs_groups)} chip selects"
        
        return AnalysisResult(
            protocol_type=ProtocolType.SPI,
            summary=summary,
            details=details,
            warnings=warnings
        )


class CANAnalyzer(ProtocolAnalyzer):
    """Analyzer for CAN bus communication"""
    
    def get_protocol_type(self) -> ProtocolType:
        return ProtocolType.CAN
    
    def analyze_packet(self, packet: DataPacket) -> AnalysisResult:
        """Analyze CAN packet"""
        data = packet.data
        metadata = packet.metadata
        
        details = {
            'size': len(data),
            'direction': packet.direction.value
        }
        warnings = []
        errors = []
        
        # Extract CAN-specific metadata
        if 'arbitration_id' in metadata:
            arb_id = metadata['arbitration_id']
            details['arbitration_id'] = f"0x{arb_id:X}"
            details['id_type'] = 'Extended' if arb_id > 0x7FF else 'Standard'
            
            # Decode priority (for standard IDs)
            if arb_id <= 0x7FF:
                priority = (arb_id >> 7) & 0x0F
                details['priority'] = priority
        
        if 'is_error_frame' in metadata and metadata['is_error_frame']:
            errors.append("Error frame detected")
            details['frame_type'] = 'Error'
        elif 'is_remote_frame' in metadata and metadata['is_remote_frame']:
            details['frame_type'] = 'Remote'
        else:
            details['frame_type'] = 'Data'
        
        if 'dlc' in metadata:
            details['dlc'] = metadata['dlc']
            if metadata['dlc'] != len(data):
                warnings.append(f"DLC mismatch: DLC={metadata['dlc']}, actual={len(data)}")
        
        if 'timestamp' in metadata:
            details['bus_timestamp'] = metadata['timestamp']
        
        # Analyze data content
        if len(data) > 0:
            details['data_hex'] = data.hex()
            
            # Try to decode common formats
            if len(data) >= 2:
                # Check for common signal layouts
                details['possible_signals'] = {
                    'uint16_be': struct.unpack('>H', data[:2])[0],
                    'uint16_le': struct.unpack('<H', data[:2])[0],
                    'int16_be': struct.unpack('>h', data[:2])[0],
                    'int16_le': struct.unpack('<h', data[:2])[0]
                }
        
        summary = f"CAN frame: ID=0x{metadata.get('arbitration_id', 0):X}, {len(data)} bytes"
        
        result = AnalysisResult(
            protocol_type=ProtocolType.CAN,
            summary=summary,
            details=details,
            warnings=warnings,
            errors=errors
        )
        
        self.update_statistics(result)
        return result
    
    def analyze_stream(self, packets: List[DataPacket]) -> AnalysisResult:
        """Analyze CAN bus stream"""
        if not packets:
            return AnalysisResult(
                protocol_type=ProtocolType.CAN,
                summary="No packets to analyze",
                details={}
            )
        
        # Analyze message frequency by ID
        id_stats = {}
        total_bytes = 0
        error_frames = 0
        remote_frames = 0
        
        for packet in packets:
            arb_id = packet.metadata.get('arbitration_id', 0)
            if arb_id not in id_stats:
                id_stats[arb_id] = {
                    'count': 0,
                    'total_bytes': 0,
                    'timestamps': []
                }
            
            id_stats[arb_id]['count'] += 1
            id_stats[arb_id]['total_bytes'] += len(packet.data)
            if hasattr(packet, 'timestamp'):
                id_stats[arb_id]['timestamps'].append(packet.timestamp)
            
            total_bytes += len(packet.data)
            
            if packet.metadata.get('is_error_frame', False):
                error_frames += 1
            if packet.metadata.get('is_remote_frame', False):
                remote_frames += 1
        
        # Calculate message rates
        for arb_id, stats in id_stats.items():
            if len(stats['timestamps']) > 1:
                time_span = (stats['timestamps'][-1] - stats['timestamps'][0]).total_seconds()
                if time_span > 0:
                    stats['rate_hz'] = stats['count'] / time_span
                    stats['avg_interval_ms'] = time_span * 1000 / (stats['count'] - 1)
        
        # Sort by frequency
        top_ids = sorted(id_stats.items(), key=lambda x: x[1]['count'], reverse=True)[:10]
        
        details = {
            'packet_count': len(packets),
            'total_bytes': total_bytes,
            'unique_ids': len(id_stats),
            'error_frames': error_frames,
            'remote_frames': remote_frames,
            'data_frames': len(packets) - error_frames - remote_frames,
            'top_ids': [
                {
                    'id': f"0x{arb_id:X}",
                    'count': stats['count'],
                    'rate_hz': stats.get('rate_hz', 0),
                    'bytes': stats['total_bytes']
                }
                for arb_id, stats in top_ids
            ]
        }
        
        # Calculate bus load
        if packets and hasattr(packets[0], 'timestamp') and hasattr(packets[-1], 'timestamp'):
            duration = (packets[-1].timestamp - packets[0].timestamp).total_seconds()
            if duration > 0:
                # Assume 1Mbps CAN bus, 64 bits overhead per message
                bits_transmitted = len(packets) * 64 + total_bytes * 8
                bus_load = (bits_transmitted / (duration * 1_000_000)) * 100
                details['bus_load_percent'] = round(bus_load, 2)
        
        warnings = []
        if error_frames > 0:
            warnings.append(f"{error_frames} error frames detected")
        
        if 'bus_load_percent' in details and details['bus_load_percent'] > 70:
            warnings.append(f"High bus load: {details['bus_load_percent']}%")
        
        summary = f"CAN stream: {len(packets)} frames, {len(id_stats)} unique IDs"
        
        return AnalysisResult(
            protocol_type=ProtocolType.CAN,
            summary=summary,
            details=details,
            warnings=warnings
        )


class EthernetAnalyzer(ProtocolAnalyzer):
    """Analyzer for Ethernet/TCP/UDP communication"""
    
    def get_protocol_type(self) -> ProtocolType:
        return ProtocolType.ETHERNET
    
    def analyze_packet(self, packet: DataPacket) -> AnalysisResult:
        """Analyze Ethernet packet"""
        data = packet.data
        metadata = packet.metadata
        
        details = {
            'size': len(data),
            'direction': packet.direction.value
        }
        warnings = []
        errors = []
        
        # Extract network metadata
        if 'source_ip' in metadata:
            details['source'] = f"{metadata['source_ip']}:{metadata.get('source_port', 'N/A')}"
        
        if 'target_host' in metadata:
            details['destination'] = f"{metadata['target_host']}:{metadata.get('target_port', 'N/A')}"
        
        if 'protocol' in metadata:
            details['transport_protocol'] = metadata['protocol']
        
        # Try to detect application protocol
        if len(data) > 0:
            details['data_preview'] = data[:50].hex()
            
            # Check for common protocols
            if data.startswith(b'HTTP/'):
                details['app_protocol'] = 'HTTP Response'
                self._analyze_http(data, details)
            elif data.startswith(b'GET ') or data.startswith(b'POST ') or data.startswith(b'PUT '):
                details['app_protocol'] = 'HTTP Request'
                self._analyze_http(data, details)
            elif data.startswith(b'{') or data.startswith(b'['):
                details['app_protocol'] = 'JSON'
                try:
                    json_data = json.loads(data.decode('utf-8'))
                    details['json_preview'] = str(json_data)[:200]
                except:
                    pass
            elif b'\x00\x00\x00' in data[:4]:  # Common in binary protocols
                details['app_protocol'] = 'Binary'
        
        if metadata.get('connection_state') == 'closed':
            warnings.append("Connection closed")
        
        if metadata.get('retransmission', False):
            warnings.append("Packet retransmission")
        
        summary = f"Network packet: {len(data)} bytes"
        if 'app_protocol' in details:
            summary += f" ({details['app_protocol']})"
        
        result = AnalysisResult(
            protocol_type=ProtocolType.ETHERNET,
            summary=summary,
            details=details,
            warnings=warnings,
            errors=errors
        )
        
        self.update_statistics(result)
        return result
    
    def _analyze_http(self, data: bytes, details: Dict[str, Any]) -> None:
        """Analyze HTTP data"""
        try:
            lines = data.decode('utf-8', errors='ignore').split('\r\n')
            if lines:
                details['http_first_line'] = lines[0]
                
                # Extract headers
                headers = {}
                for line in lines[1:]:
                    if ':' in line:
                        key, value = line.split(':', 1)
                        headers[key.strip()] = value.strip()
                    elif line == '':
                        break
                
                if headers:
                    details['http_headers'] = headers
        except Exception:
            pass
    
    def analyze_stream(self, packets: List[DataPacket]) -> AnalysisResult:
        """Analyze network stream"""
        if not packets:
            return AnalysisResult(
                protocol_type=ProtocolType.ETHERNET,
                summary="No packets to analyze",
                details={}
            )
        
        # Group by connection
        connections = {}
        total_bytes = 0
        protocols_seen = set()
        
        for packet in packets:
            # Create connection key
            src = f"{packet.metadata.get('source_ip', 'unknown')}:{packet.metadata.get('source_port', 0)}"
            dst = f"{packet.metadata.get('target_host', 'unknown')}:{packet.metadata.get('target_port', 0)}"
            conn_key = tuple(sorted([src, dst]))
            
            if conn_key not in connections:
                connections[conn_key] = {
                    'packets': 0,
                    'bytes': 0,
                    'start_time': packet.timestamp if hasattr(packet, 'timestamp') else None,
                    'end_time': packet.timestamp if hasattr(packet, 'timestamp') else None
                }
            
            connections[conn_key]['packets'] += 1
            connections[conn_key]['bytes'] += len(packet.data)
            if hasattr(packet, 'timestamp'):
                connections[conn_key]['end_time'] = packet.timestamp
            
            total_bytes += len(packet.data)
            
            if 'protocol' in packet.metadata:
                protocols_seen.add(packet.metadata['protocol'])
        
        # Calculate connection statistics
        conn_stats = []
        for (endpoint1, endpoint2), stats in connections.items():
            duration = None
            if stats['start_time'] and stats['end_time']:
                duration = (stats['end_time'] - stats['start_time']).total_seconds()
            
            conn_stats.append({
                'endpoints': [endpoint1, endpoint2],
                'packets': stats['packets'],
                'bytes': stats['bytes'],
                'duration_sec': duration,
                'throughput_kbps': (stats['bytes'] * 8 / duration / 1000) if duration and duration > 0 else None
            })
        
        # Sort by bytes transferred
        conn_stats.sort(key=lambda x: x['bytes'], reverse=True)
        
        details = {
            'packet_count': len(packets),
            'total_bytes': total_bytes,
            'unique_connections': len(connections),
            'transport_protocols': list(protocols_seen),
            'top_connections': conn_stats[:5],
            'avg_packet_size': total_bytes / len(packets) if packets else 0
        }
        
        warnings = []
        if any(p.metadata.get('retransmission', False) for p in packets):
            retrans_count = sum(1 for p in packets if p.metadata.get('retransmission', False))
            warnings.append(f"{retrans_count} retransmissions detected")
        
        summary = f"Network stream: {len(packets)} packets, {len(connections)} connections"
        
        return AnalysisResult(
            protocol_type=ProtocolType.ETHERNET,
            summary=summary,
            details=details,
            warnings=warnings
        )


class ProtocolAnalyzerFactory:
    """Factory for creating protocol analyzers"""
    
    _analyzers = {
        ProtocolType.SERIAL: SerialAnalyzer,
        ProtocolType.I2C: I2CAnalyzer,
        ProtocolType.SPI: SPIAnalyzer,
        ProtocolType.CAN: CANAnalyzer,
        ProtocolType.ETHERNET: EthernetAnalyzer
    }
    
    @classmethod
    def create_analyzer(cls, protocol_type: ProtocolType) -> ProtocolAnalyzer:
        """Create analyzer for specific protocol type"""
        analyzer_class = cls._analyzers.get(protocol_type)
        if not analyzer_class:
            raise ValueError(f"No analyzer available for protocol type: {protocol_type.value}")
        return analyzer_class()
    
    @classmethod
    def get_supported_protocols(cls) -> List[ProtocolType]:
        """Get list of supported protocol types"""
        return list(cls._analyzers.keys())
