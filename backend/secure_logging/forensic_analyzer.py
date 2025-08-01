"""
Forensic analysis tools for security investigations
"""
import os
import json
import hashlib
import sqlite3
from typing import Dict, Any, List, Optional, Tuple, Set
from datetime import datetime, timezone, timedelta
from dataclasses import dataclass, asdict
import pandas as pd
import numpy as np
from collections import defaultdict, Counter
import networkx as nx
import matplotlib.pyplot as plt
import seaborn as sns
from sklearn.ensemble import IsolationForest
from sklearn.cluster import DBSCAN
from sklearn.preprocessing import StandardScaler
import re
import ipaddress


@dataclass
class ForensicTimeline:
    """Timeline entry for forensic analysis"""
    timestamp: str
    source: str
    event_type: str
    actor: str
    target: str
    action: str
    result: str
    metadata: Dict[str, Any]
    anomaly_score: float = 0.0


@dataclass
class ForensicIncident:
    """Security incident for investigation"""
    id: str
    title: str
    severity: str
    detected_at: str
    reported_by: str
    status: str
    timeline: List[ForensicTimeline]
    artifacts: List[Dict[str, Any]]
    analysis: Dict[str, Any]
    recommendations: List[str]


class ForensicAnalyzer:
    """
    Provides forensic analysis capabilities for security investigations:
    - Timeline reconstruction
    - Anomaly detection
    - Pattern analysis
    - User behavior analytics
    - Network analysis
    - Evidence correlation
    """
    
    def __init__(self,
                 db_path: str = "/var/log/rover/forensics.db",
                 artifacts_path: str = "/var/log/rover/forensics/artifacts"):
        """
        Initialize forensic analyzer
        
        Args:
            db_path: Path to forensics database
            artifacts_path: Path for artifact storage
        """
        self.db_path = db_path
        self.artifacts_path = artifacts_path
        
        # Create directories
        os.makedirs(os.path.dirname(db_path), exist_ok=True)
        os.makedirs(artifacts_path, exist_ok=True)
        
        # Initialize database
        self._init_database()
        
        # ML models for anomaly detection
        self.isolation_forest = IsolationForest(contamination=0.1, random_state=42)
        self.scaler = StandardScaler()
        
    def _init_database(self):
        """Initialize forensics database"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # Incidents table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS forensic_incidents (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                severity TEXT NOT NULL,
                detected_at TEXT NOT NULL,
                reported_by TEXT NOT NULL,
                status TEXT NOT NULL,
                analysis TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
        """)
        
        # Timeline table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS forensic_timeline (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                incident_id TEXT NOT NULL,
                timestamp TEXT NOT NULL,
                source TEXT NOT NULL,
                event_type TEXT NOT NULL,
                actor TEXT,
                target TEXT,
                action TEXT NOT NULL,
                result TEXT,
                metadata TEXT,
                anomaly_score REAL DEFAULT 0.0,
                FOREIGN KEY (incident_id) REFERENCES forensic_incidents(id)
            )
        """)
        
        # Artifacts table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS forensic_artifacts (
                id TEXT PRIMARY KEY,
                incident_id TEXT NOT NULL,
                artifact_type TEXT NOT NULL,
                description TEXT,
                file_path TEXT,
                hash_value TEXT,
                collected_at TEXT NOT NULL,
                collector TEXT NOT NULL,
                metadata TEXT,
                FOREIGN KEY (incident_id) REFERENCES forensic_incidents(id)
            )
        """)
        
        # IOCs (Indicators of Compromise) table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS iocs (
                id TEXT PRIMARY KEY,
                ioc_type TEXT NOT NULL,
                value TEXT NOT NULL,
                confidence REAL NOT NULL,
                first_seen TEXT NOT NULL,
                last_seen TEXT NOT NULL,
                severity TEXT NOT NULL,
                source TEXT,
                metadata TEXT
            )
        """)
        
        # Indexes
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_timeline_incident 
            ON forensic_timeline(incident_id)
        """)
        
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_timeline_timestamp 
            ON forensic_timeline(timestamp)
        """)
        
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_timeline_actor 
            ON forensic_timeline(actor)
        """)
        
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_iocs_value 
            ON iocs(value)
        """)
        
        conn.commit()
        conn.close()
        
    def create_incident(self,
                       title: str,
                       severity: str,
                       reported_by: str) -> str:
        """
        Create new forensic incident
        
        Args:
            title: Incident title
            severity: Severity level
            reported_by: Reporter
            
        Returns:
            Incident ID
        """
        incident_id = f"INC-{datetime.now().timestamp()}"
        now = datetime.now(timezone.utc).isoformat()
        
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute("""
            INSERT INTO forensic_incidents
            (id, title, severity, detected_at, reported_by, status, 
             created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            incident_id, title, severity, now, reported_by,
            'open', now, now
        ))
        
        conn.commit()
        conn.close()
        
        return incident_id
        
    def analyze_logs(self,
                    log_sources: List[str],
                    start_time: datetime,
                    end_time: datetime,
                    incident_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Analyze logs for forensic evidence
        
        Args:
            log_sources: List of log file paths or database connections
            start_time: Analysis start time
            end_time: Analysis end time
            incident_id: Optional incident to associate with
            
        Returns:
            Analysis results
        """
        timeline = []
        anomalies = []
        patterns = []
        
        # Process each log source
        for source in log_sources:
            if os.path.isfile(source):
                entries = self._parse_log_file(source, start_time, end_time)
            else:
                # Assume database connection string
                entries = self._query_log_database(source, start_time, end_time)
                
            timeline.extend(entries)
            
        # Sort timeline
        timeline.sort(key=lambda x: x['timestamp'])
        
        # Detect anomalies
        if len(timeline) > 10:
            anomalies = self._detect_anomalies(timeline)
            
        # Find patterns
        patterns = self._find_patterns(timeline)
        
        # Build user activity profile
        user_profiles = self._build_user_profiles(timeline)
        
        # Network analysis
        network_analysis = self._analyze_network_activity(timeline)
        
        # Store results if incident ID provided
        if incident_id:
            self._store_timeline(incident_id, timeline)
            
        return {
            'timeline_entries': len(timeline),
            'time_range': {
                'start': start_time.isoformat(),
                'end': end_time.isoformat()
            },
            'anomalies': anomalies,
            'patterns': patterns,
            'user_profiles': user_profiles,
            'network_analysis': network_analysis,
            'key_events': self._extract_key_events(timeline, anomalies)
        }
        
    def _parse_log_file(self, file_path: str, 
                       start_time: datetime, 
                       end_time: datetime) -> List[Dict[str, Any]]:
        """Parse log file for entries"""
        entries = []
        
        # Common log patterns
        patterns = {
            'syslog': re.compile(
                r'(\w+\s+\d+\s+\d+:\d+:\d+)\s+(\w+)\s+(\w+)\[(\d+)\]:\s+(.+)'
            ),
            'apache': re.compile(
                r'(\d+\.\d+\.\d+\.\d+)\s+-\s+-\s+\[(.*?)\]\s+"(.*?)"\s+(\d+)\s+(\d+)'
            ),
            'json': re.compile(r'^{.*}$')
        }
        
        with open(file_path, 'r') as f:
            for line in f:
                # Try JSON first
                if patterns['json'].match(line.strip()):
                    try:
                        entry = json.loads(line)
                        if 'timestamp' in entry:
                            timestamp = datetime.fromisoformat(
                                entry['timestamp'].replace('Z', '+00:00')
                            )
                            if start_time <= timestamp <= end_time:
                                entries.append(entry)
                    except:
                        pass
                        
                # Try other patterns
                # Implementation would depend on log format
                
        return entries
        
    def _query_log_database(self, connection_string: str,
                          start_time: datetime,
                          end_time: datetime) -> List[Dict[str, Any]]:
        """Query log database"""
        # Implementation depends on database type
        # This is a placeholder
        return []
        
    def _detect_anomalies(self, timeline: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Detect anomalies in timeline using ML"""
        anomalies = []
        
        # Feature extraction
        features = []
        for entry in timeline:
            feature_vector = self._extract_features(entry)
            features.append(feature_vector)
            
        if not features:
            return anomalies
            
        # Convert to numpy array
        X = np.array(features)
        
        # Scale features
        X_scaled = self.scaler.fit_transform(X)
        
        # Detect anomalies
        predictions = self.isolation_forest.fit_predict(X_scaled)
        anomaly_scores = self.isolation_forest.score_samples(X_scaled)
        
        # Collect anomalies
        for i, (pred, score) in enumerate(zip(predictions, anomaly_scores)):
            if pred == -1:  # Anomaly
                anomaly = {
                    'entry': timeline[i],
                    'anomaly_score': abs(score),
                    'reasons': self._explain_anomaly(timeline[i], features[i])
                }
                anomalies.append(anomaly)
                
        return sorted(anomalies, key=lambda x: x['anomaly_score'], reverse=True)
        
    def _extract_features(self, entry: Dict[str, Any]) -> List[float]:
        """Extract numerical features from log entry"""
        features = []
        
        # Time-based features
        timestamp = datetime.fromisoformat(
            entry.get('timestamp', '').replace('Z', '+00:00')
        )
        features.append(timestamp.hour)
        features.append(timestamp.weekday())
        
        # Event type encoding
        event_type = entry.get('event_type', 'unknown')
        event_types = ['login', 'logout', 'access', 'error', 'change', 'delete']
        for et in event_types:
            features.append(1.0 if event_type == et else 0.0)
            
        # Severity encoding
        severity = entry.get('severity', 'info')
        severities = ['critical', 'high', 'medium', 'low', 'info']
        severity_value = severities.index(severity) if severity in severities else 4
        features.append(severity_value)
        
        # Add more features based on your log structure
        
        return features
        
    def _explain_anomaly(self, entry: Dict[str, Any], 
                        features: List[float]) -> List[str]:
        """Explain why entry is anomalous"""
        reasons = []
        
        # Time anomaly
        hour = int(features[0])
        if hour < 6 or hour > 22:
            reasons.append(f"Unusual time: {hour}:00")
            
        # Frequency anomaly
        # Would need to calculate based on historical data
        
        # Pattern anomaly
        event_type = entry.get('event_type', '')
        if event_type in ['delete', 'change'] and hour < 8:
            reasons.append(f"Suspicious {event_type} during off-hours")
            
        return reasons
        
    def _find_patterns(self, timeline: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Find patterns in timeline"""
        patterns = []
        
        # Sequential pattern mining
        sequences = self._extract_sequences(timeline)
        frequent_sequences = self._find_frequent_sequences(sequences)
        
        # Time-based patterns
        time_patterns = self._find_time_patterns(timeline)
        
        # Actor patterns
        actor_patterns = self._find_actor_patterns(timeline)
        
        patterns.extend([
            {'type': 'sequence', 'pattern': seq, 'count': count}
            for seq, count in frequent_sequences
        ])
        
        patterns.extend(time_patterns)
        patterns.extend(actor_patterns)
        
        return patterns
        
    def _extract_sequences(self, timeline: List[Dict[str, Any]]) -> List[List[str]]:
        """Extract event sequences"""
        sequences = []
        
        # Group by actor
        actor_events = defaultdict(list)
        for entry in timeline:
            actor = entry.get('actor', 'unknown')
            event = entry.get('event_type', 'unknown')
            actor_events[actor].append(event)
            
        # Create sequences
        for actor, events in actor_events.items():
            # Sliding window
            for i in range(len(events) - 2):
                sequences.append(events[i:i+3])
                
        return sequences
        
    def _find_frequent_sequences(self, sequences: List[List[str]],
                               min_support: int = 3) -> List[Tuple[str, int]]:
        """Find frequent sequences"""
        seq_counts = Counter()
        
        for seq in sequences:
            seq_str = ' -> '.join(seq)
            seq_counts[seq_str] += 1
            
        return [(seq, count) for seq, count in seq_counts.items() 
                if count >= min_support]
        
    def _find_time_patterns(self, timeline: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Find time-based patterns"""
        patterns = []
        
        # Hour distribution
        hour_counts = Counter()
        for entry in timeline:
            timestamp = datetime.fromisoformat(
                entry.get('timestamp', '').replace('Z', '+00:00')
            )
            hour_counts[timestamp.hour] += 1
            
        # Find unusual hours
        avg_count = sum(hour_counts.values()) / 24
        for hour, count in hour_counts.items():
            if count > avg_count * 2:
                patterns.append({
                    'type': 'time_spike',
                    'hour': hour,
                    'count': count,
                    'average': avg_count
                })
                
        return patterns
        
    def _find_actor_patterns(self, timeline: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Find actor behavior patterns"""
        patterns = []
        
        # Actor activity
        actor_stats = defaultdict(lambda: {
            'events': 0,
            'event_types': Counter(),
            'targets': set(),
            'hours': Counter()
        })
        
        for entry in timeline:
            actor = entry.get('actor', 'unknown')
            stats = actor_stats[actor]
            
            stats['events'] += 1
            stats['event_types'][entry.get('event_type', 'unknown')] += 1
            stats['targets'].add(entry.get('target', 'unknown'))
            
            timestamp = datetime.fromisoformat(
                entry.get('timestamp', '').replace('Z', '+00:00')
            )
            stats['hours'][timestamp.hour] += 1
            
        # Identify suspicious actors
        for actor, stats in actor_stats.items():
            # High diversity of targets
            if len(stats['targets']) > 20:
                patterns.append({
                    'type': 'high_target_diversity',
                    'actor': actor,
                    'target_count': len(stats['targets'])
                })
                
            # Unusual event distribution
            total_events = sum(stats['event_types'].values())
            for event_type, count in stats['event_types'].items():
                if count / total_events > 0.8:
                    patterns.append({
                        'type': 'dominant_event_type',
                        'actor': actor,
                        'event_type': event_type,
                        'percentage': count / total_events * 100
                    })
                    
        return patterns
        
    def _build_user_profiles(self, timeline: List[Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
        """Build user behavior profiles"""
        profiles = {}
        
        # Group by user
        user_events = defaultdict(list)
        for entry in timeline:
            actor = entry.get('actor', 'unknown')
            user_events[actor].append(entry)
            
        # Build profiles
        for user, events in user_events.items():
            profile = {
                'total_events': len(events),
                'first_seen': events[0]['timestamp'],
                'last_seen': events[-1]['timestamp'],
                'event_types': Counter([e.get('event_type', 'unknown') for e in events]),
                'active_hours': self._get_active_hours(events),
                'accessed_resources': set([e.get('target', 'unknown') for e in events]),
                'anomaly_score': self._calculate_user_anomaly_score(events)
            }
            profiles[user] = profile
            
        return profiles
        
    def _get_active_hours(self, events: List[Dict[str, Any]]) -> List[int]:
        """Get user's active hours"""
        hour_counts = Counter()
        
        for event in events:
            timestamp = datetime.fromisoformat(
                event.get('timestamp', '').replace('Z', '+00:00')
            )
            hour_counts[timestamp.hour] += 1
            
        # Return hours with activity
        return sorted([hour for hour, count in hour_counts.items() if count > 0])
        
    def _calculate_user_anomaly_score(self, events: List[Dict[str, Any]]) -> float:
        """Calculate user anomaly score"""
        score = 0.0
        
        # Off-hours activity
        off_hours = 0
        for event in events:
            timestamp = datetime.fromisoformat(
                event.get('timestamp', '').replace('Z', '+00:00')
            )
            if timestamp.hour < 6 or timestamp.hour > 22:
                off_hours += 1
                
        if events:
            score += (off_hours / len(events)) * 0.3
            
        # High-risk actions
        high_risk_events = ['delete', 'modify_permissions', 'export_data']
        risk_count = sum(1 for e in events if e.get('event_type') in high_risk_events)
        if events:
            score += (risk_count / len(events)) * 0.4
            
        # Failed actions
        failed_count = sum(1 for e in events if e.get('result') == 'failed')
        if events:
            score += (failed_count / len(events)) * 0.3
            
        return min(score, 1.0)
        
    def _analyze_network_activity(self, timeline: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Analyze network connections and data flows"""
        # Build network graph
        G = nx.DiGraph()
        
        # Add edges for interactions
        for entry in timeline:
            source = entry.get('actor', 'unknown')
            target = entry.get('target', 'unknown')
            event_type = entry.get('event_type', 'unknown')
            
            if source and target:
                if G.has_edge(source, target):
                    G[source][target]['weight'] += 1
                    G[source][target]['events'].append(event_type)
                else:
                    G.add_edge(source, target, weight=1, events=[event_type])
                    
        # Calculate metrics
        analysis = {
            'nodes': G.number_of_nodes(),
            'edges': G.number_of_edges(),
            'density': nx.density(G) if G.number_of_nodes() > 0 else 0,
            'central_nodes': [],
            'suspicious_paths': [],
            'communities': []
        }
        
        if G.number_of_nodes() > 0:
            # Find central nodes
            centrality = nx.degree_centrality(G)
            analysis['central_nodes'] = sorted(
                centrality.items(),
                key=lambda x: x[1],
                reverse=True
            )[:10]
            
            # Find suspicious paths
            # Look for paths to sensitive resources
            sensitive_targets = [n for n in G.nodes() if 'admin' in n.lower() or 'root' in n.lower()]
            for target in sensitive_targets[:5]:
                for source in G.nodes():
                    if source != target and nx.has_path(G, source, target):
                        path = nx.shortest_path(G, source, target)
                        if len(path) > 2:  # Indirect access
                            analysis['suspicious_paths'].append({
                                'source': source,
                                'target': target,
                                'path': path,
                                'length': len(path)
                            })
                            
        return analysis
        
    def _extract_key_events(self, timeline: List[Dict[str, Any]], 
                          anomalies: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Extract key events from timeline"""
        key_events = []
        
        # High severity events
        for entry in timeline:
            if entry.get('severity') in ['critical', 'high']:
                key_events.append({
                    'type': 'high_severity',
                    'event': entry
                })
                
        # Anomalous events
        for anomaly in anomalies[:10]:  # Top 10 anomalies
            key_events.append({
                'type': 'anomaly',
                'event': anomaly['entry'],
                'score': anomaly['anomaly_score'],
                'reasons': anomaly['reasons']
            })
            
        # Failed authentication
        for entry in timeline:
            if (entry.get('event_type') == 'login' and 
                entry.get('result') == 'failed'):
                key_events.append({
                    'type': 'failed_auth',
                    'event': entry
                })
                
        # Privilege escalation
        for entry in timeline:
            if 'privilege' in entry.get('event_type', '').lower():
                key_events.append({
                    'type': 'privilege_change',
                    'event': entry
                })
                
        return sorted(key_events, 
                     key=lambda x: x['event'].get('timestamp', ''))
        
    def _store_timeline(self, incident_id: str, timeline: List[Dict[str, Any]]):
        """Store timeline in database"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        for entry in timeline:
            cursor.execute("""
                INSERT INTO forensic_timeline
                (incident_id, timestamp, source, event_type, actor, 
                 target, action, result, metadata, anomaly_score)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                incident_id,
                entry.get('timestamp', ''),
                entry.get('source', 'unknown'),
                entry.get('event_type', 'unknown'),
                entry.get('actor'),
                entry.get('target'),
                entry.get('action', 'unknown'),
                entry.get('result'),
                json.dumps(entry.get('metadata', {})),
                entry.get('anomaly_score', 0.0)
            ))
            
        conn.commit()
        conn.close()
        
    def add_ioc(self,
               ioc_type: str,
               value: str,
               confidence: float,
               severity: str,
               source: Optional[str] = None,
               metadata: Optional[Dict[str, Any]] = None):
        """
        Add Indicator of Compromise
        
        Args:
            ioc_type: Type of IOC (ip, domain, hash, etc.)
            value: IOC value
            confidence: Confidence level (0-1)
            severity: Severity level
            source: Source of IOC
            metadata: Additional metadata
        """
        ioc_id = f"IOC-{hashlib.md5(value.encode()).hexdigest()[:8]}"
        now = datetime.now(timezone.utc).isoformat()
        
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute("""
            INSERT OR REPLACE INTO iocs
            (id, ioc_type, value, confidence, first_seen, last_seen,
             severity, source, metadata)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            ioc_id, ioc_type, value, confidence, now, now,
            severity, source, json.dumps(metadata or {})
        ))
        
        conn.commit()
        conn.close()
        
    def check_iocs(self, data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Check data against known IOCs"""
        matches = []
        
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # Extract potential IOCs from data
        potential_iocs = self._extract_potential_iocs(data)
        
        # Check each potential IOC
        for ioc_type, values in potential_iocs.items():
            for value in values:
                cursor.execute("""
                    SELECT * FROM iocs
                    WHERE ioc_type = ? AND value = ?
                """, (ioc_type, value))
                
                result = cursor.fetchone()
                if result:
                    matches.append({
                        'ioc_id': result[0],
                        'type': result[1],
                        'value': result[2],
                        'confidence': result[3],
                        'severity': result[6],
                        'source': result[7]
                    })
                    
        conn.close()
        return matches
        
    def _extract_potential_iocs(self, data: Dict[str, Any]) -> Dict[str, Set[str]]:
        """Extract potential IOCs from data"""
        iocs = defaultdict(set)
        
        # Convert to string for pattern matching
        data_str = json.dumps(data)
        
        # IP addresses
        ip_pattern = re.compile(r'\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b')
        for match in ip_pattern.findall(data_str):
            try:
                ipaddress.ip_address(match)
                iocs['ip'].add(match)
            except:
                pass
                
        # Domains
        domain_pattern = re.compile(
            r'\b(?:[a-zA-Z0-9](?:[a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}\b'
        )
        for match in domain_pattern.findall(data_str):
            iocs['domain'].add(match.lower())
            
        # File hashes (MD5, SHA1, SHA256)
        hash_patterns = {
            'md5': re.compile(r'\b[a-fA-F0-9]{32}\b'),
            'sha1': re.compile(r'\b[a-fA-F0-9]{40}\b'),
            'sha256': re.compile(r'\b[a-fA-F0-9]{64}\b')
        }
        
        for hash_type, pattern in hash_patterns.items():
            for match in pattern.findall(data_str):
                iocs[hash_type].add(match.lower())
                
        # Email addresses
        email_pattern = re.compile(
            r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'
        )
        for match in email_pattern.findall(data_str):
            iocs['email'].add(match.lower())
            
        return dict(iocs)
        
    def generate_forensic_report(self,
                               incident_id: str,
                               output_format: str = 'html') -> bytes:
        """Generate forensic analysis report"""
        # Get incident data
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT * FROM forensic_incidents WHERE id = ?
        """, (incident_id,))
        
        incident = cursor.fetchone()
        if not incident:
            raise ValueError(f"Incident {incident_id} not found")
            
        # Get timeline
        cursor.execute("""
            SELECT * FROM forensic_timeline 
            WHERE incident_id = ? 
            ORDER BY timestamp
        """, (incident_id,))
        
        timeline = cursor.fetchall()
        
        # Get artifacts
        cursor.execute("""
            SELECT * FROM forensic_artifacts
            WHERE incident_id = ?
        """, (incident_id,))
        
        artifacts = cursor.fetchall()
        
        conn.close()
        
        # Build report data
        report_data = {
            'incident': {
                'id': incident[0],
                'title': incident[1],
                'severity': incident[2],
                'detected_at': incident[3],
                'reported_by': incident[4],
                'status': incident[5]
            },
            'timeline_count': len(timeline),
            'artifact_count': len(artifacts),
            'key_findings': self._summarize_findings(timeline),
            'recommendations': self._generate_recommendations(timeline)
        }
        
        if output_format == 'json':
            return json.dumps(report_data, indent=2).encode()
        else:
            return self._generate_html_forensic_report(report_data)
            
    def _summarize_findings(self, timeline: List[Tuple]) -> List[str]:
        """Summarize key findings from timeline"""
        findings = []
        
        # Count by event type
        event_counts = Counter([row[4] for row in timeline])
        for event_type, count in event_counts.most_common(5):
            findings.append(f"{count} {event_type} events detected")
            
        # Unique actors
        actors = set([row[5] for row in timeline if row[5]])
        findings.append(f"{len(actors)} unique actors identified")
        
        # High anomaly scores
        high_anomaly = [row for row in timeline if row[10] > 0.7]
        if high_anomaly:
            findings.append(f"{len(high_anomaly)} highly anomalous events detected")
            
        return findings
        
    def _generate_recommendations(self, timeline: List[Tuple]) -> List[str]:
        """Generate security recommendations"""
        recommendations = []
        
        # Based on event types
        event_types = [row[4] for row in timeline]
        
        if 'failed_login' in event_types:
            count = event_types.count('failed_login')
            if count > 10:
                recommendations.append(
                    "Implement account lockout policy after repeated failed logins"
                )
                
        if 'privilege_escalation' in event_types:
            recommendations.append(
                "Review and restrict privilege escalation procedures"
            )
            
        if 'data_export' in event_types:
            recommendations.append(
                "Implement DLP controls for sensitive data exports"
            )
            
        # Based on time patterns
        night_events = [row for row in timeline 
                       if datetime.fromisoformat(row[2]).hour < 6 or 
                          datetime.fromisoformat(row[2]).hour > 22]
        if len(night_events) > len(timeline) * 0.3:
            recommendations.append(
                "Monitor and restrict after-hours system access"
            )
            
        return recommendations
        
    def _generate_html_forensic_report(self, report_data: Dict[str, Any]) -> bytes:
        """Generate HTML forensic report"""
        html = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <title>Forensic Analysis Report - {report_data['incident']['id']}</title>
            <style>
                body {{ font-family: Arial, sans-serif; margin: 40px; }}
                h1 {{ color: #d32f2f; }}
                .incident-info {{ background: #f5f5f5; padding: 20px; border-radius: 5px; }}
                .finding {{ margin: 10px 0; padding: 10px; background: #fff3e0; }}
                .recommendation {{ margin: 10px 0; padding: 10px; background: #e8f5e9; }}
            </style>
        </head>
        <body>
            <h1>Forensic Analysis Report</h1>
            
            <div class="incident-info">
                <h2>Incident Details</h2>
                <p><strong>ID:</strong> {report_data['incident']['id']}</p>
                <p><strong>Title:</strong> {report_data['incident']['title']}</p>
                <p><strong>Severity:</strong> {report_data['incident']['severity']}</p>
                <p><strong>Detected:</strong> {report_data['incident']['detected_at']}</p>
                <p><strong>Status:</strong> {report_data['incident']['status']}</p>
            </div>
            
            <h2>Analysis Summary</h2>
            <p>Timeline Events: {report_data['timeline_count']}</p>
            <p>Artifacts Collected: {report_data['artifact_count']}</p>
            
            <h2>Key Findings</h2>
            {"".join([f'<div class="finding">{f}</div>' for f in report_data['key_findings']])}
            
            <h2>Recommendations</h2>
            {"".join([f'<div class="recommendation">{r}</div>' for r in report_data['recommendations']])}
            
            <p><small>Generated at: {datetime.now(timezone.utc).isoformat()}</small></p>
        </body>
        </html>
        """
        
        return html.encode()