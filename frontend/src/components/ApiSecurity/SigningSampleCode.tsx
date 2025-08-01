import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Chip,
  IconButton,
  Alert,
  Paper,
  Button,
  Tooltip,
  CircularProgress,
  ToggleButton,
  ToggleButtonGroup
} from '@mui/material';
import {
  ContentCopy as CopyIcon,
  Code as CodeIcon,
  Language as LanguageIcon,
  Download as DownloadIcon
} from '@mui/icons-material';
import { Light as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vs2015 } from 'react-syntax-highlighter/dist/esm/styles/hljs';
import python from 'react-syntax-highlighter/dist/esm/languages/hljs/python';
import javascript from 'react-syntax-highlighter/dist/esm/languages/hljs/javascript';
import java from 'react-syntax-highlighter/dist/esm/languages/hljs/java';
import csharp from 'react-syntax-highlighter/dist/esm/languages/hljs/csharp';
import go from 'react-syntax-highlighter/dist/esm/languages/hljs/go';
import ruby from 'react-syntax-highlighter/dist/esm/languages/hljs/ruby';
import php from 'react-syntax-highlighter/dist/esm/languages/hljs/php';
import bash from 'react-syntax-highlighter/dist/esm/languages/hljs/bash';
import { signingService } from '../../services/signingService';

// Register languages
SyntaxHighlighter.registerLanguage('python', python);
SyntaxHighlighter.registerLanguage('javascript', javascript);
SyntaxHighlighter.registerLanguage('java', java);
SyntaxHighlighter.registerLanguage('csharp', csharp);
SyntaxHighlighter.registerLanguage('go', go);
SyntaxHighlighter.registerLanguage('ruby', ruby);
SyntaxHighlighter.registerLanguage('php', php);
SyntaxHighlighter.registerLanguage('bash', bash);

interface SigningSampleCodeProps {
  algorithms: any[];
}

export const SigningSampleCode: React.FC<SigningSampleCodeProps> = ({ algorithms }) => {
  const [selectedLanguage, setSelectedLanguage] = useState('python');
  const [selectedAlgorithm, setSelectedAlgorithm] = useState('HMAC-SHA256');
  const [selectedFramework, setSelectedFramework] = useState<string | null>(null);
  const [sampleCode, setSampleCode] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [codeDisplay, setCodeDisplay] = useState<'formatted' | 'raw'>('formatted');

  const languages = [
    { id: 'python', name: 'Python', icon: '🐍', frameworks: ['requests', 'httpx', 'urllib'] },
    { id: 'javascript', name: 'JavaScript', icon: '📜', frameworks: ['axios', 'fetch', 'node-fetch'] },
    { id: 'java', name: 'Java', icon: '☕', frameworks: ['okhttp', 'apache-httpclient', 'spring'] },
    { id: 'csharp', name: 'C#', icon: '🔷', frameworks: ['httpclient', 'restsharp'] },
    { id: 'go', name: 'Go', icon: '🐹', frameworks: ['net/http', 'resty'] },
    { id: 'ruby', name: 'Ruby', icon: '💎', frameworks: ['net/http', 'faraday', 'httparty'] },
    { id: 'php', name: 'PHP', icon: '🐘', frameworks: ['curl', 'guzzle'] },
    { id: 'curl', name: 'cURL', icon: '🔧', frameworks: [] }
  ];

  const loadSampleCode = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const code = await signingService.getSampleCode(
        selectedLanguage,
        selectedAlgorithm,
        selectedFramework || undefined
      );
      
      setSampleCode(code);
    } catch (err: any) {
      // If no sample exists, generate a basic one
      setSampleCode(generateBasicSample());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSampleCode();
  }, [selectedLanguage, selectedAlgorithm, selectedFramework]);

  const generateBasicSample = () => {
    const algorithmInfo = algorithms.find(a => a.id === selectedAlgorithm) || {};
    
    return {
      title: `${selectedLanguage} ${selectedAlgorithm} Example`,
      description: `Basic example of request signing with ${algorithmInfo.name}`,
      code: getDefaultSampleCode(selectedLanguage, selectedAlgorithm),
      dependencies: getDefaultDependencies(selectedLanguage, selectedAlgorithm),
      language: selectedLanguage,
      algorithm: selectedAlgorithm
    };
  };

  const getDefaultSampleCode = (language: string, algorithm: string) => {
    const samples: { [key: string]: { [key: string]: string } } = {
      python: {
        'HMAC-SHA256': `import hmac
import hashlib
import time
import requests
import base64
import uuid

# Your API credentials
API_KEY = "your-api-key"
SECRET_KEY = "your-secret-key"

# Request details
url = "https://api.example.com/v1/rovers/status"
method = "GET"
headers = {
    "Host": "api.example.com",
    "Content-Type": "application/json"
}

# Generate timestamp and nonce
timestamp = str(int(time.time()))
nonce = str(uuid.uuid4())

# Create canonical request
canonical_parts = [
    method,
    url,
    "",  # query string
    "\\n".join([f"{k.lower()}:{v}" for k, v in sorted(headers.items())]),
    timestamp,
    nonce,
    ""  # body hash (empty for GET)
]
canonical_request = "\\n".join(canonical_parts)

# Generate signature
signature = base64.b64encode(
    hmac.new(
        SECRET_KEY.encode(),
        canonical_request.encode(),
        hashlib.sha256
    ).digest()
).decode()

# Add signature headers
headers.update({
    "X-API-Key": API_KEY,
    "X-Timestamp": timestamp,
    "X-Nonce": nonce,
    "X-Signature-Algorithm": "HMAC-SHA256",
    "Authorization": f"Signature {signature}"
})

# Make the request
response = requests.get(url, headers=headers)
print(f"Status: {response.status_code}")
print(f"Response: {response.json()}")`,
        'JWT-HS256': `import jwt
import time
import requests
import hashlib

# Your API credentials
API_KEY = "your-api-key"
SECRET_KEY = "your-secret-key"

# Request details
url = "https://api.example.com/v1/rovers/status"
method = "GET"

# Create canonical request
canonical_request = f"{method}\\n{url}"
request_hash = hashlib.sha256(canonical_request.encode()).hexdigest()

# Create JWT
payload = {
    "iat": int(time.time()),
    "exp": int(time.time()) + 300,  # 5 minutes
    "request_hash": request_hash,
    "jti": str(uuid.uuid4())  # JWT ID
}

token = jwt.encode(payload, SECRET_KEY, algorithm="HS256")

# Make the request
headers = {
    "X-API-Key": API_KEY,
    "X-Signature-Algorithm": "JWT-HS256",
    "Authorization": f"Signature {token}"
}

response = requests.get(url, headers=headers)
print(f"Status: {response.status_code}")
print(f"Response: {response.json()}")`
      },
      javascript: {
        'HMAC-SHA256': `const crypto = require('crypto');
const axios = require('axios');

// Your API credentials
const API_KEY = 'your-api-key';
const SECRET_KEY = 'your-secret-key';

// Request details
const url = 'https://api.example.com/v1/rovers/status';
const method = 'GET';
const headers = {
    'Host': 'api.example.com',
    'Content-Type': 'application/json'
};

// Generate timestamp and nonce
const timestamp = Math.floor(Date.now() / 1000).toString();
const nonce = crypto.randomUUID();

// Create canonical request
const sortedHeaders = Object.keys(headers)
    .sort()
    .map(key => \`\${key.toLowerCase()}:\${headers[key]}\`)
    .join('\\n');

const canonicalParts = [
    method,
    url,
    '',  // query string
    sortedHeaders,
    timestamp,
    nonce,
    ''  // body hash (empty for GET)
];
const canonicalRequest = canonicalParts.join('\\n');

// Generate signature
const signature = crypto
    .createHmac('sha256', SECRET_KEY)
    .update(canonicalRequest)
    .digest('base64');

// Add signature headers
const signedHeaders = {
    ...headers,
    'X-API-Key': API_KEY,
    'X-Timestamp': timestamp,
    'X-Nonce': nonce,
    'X-Signature-Algorithm': 'HMAC-SHA256',
    'Authorization': \`Signature \${signature}\`
};

// Make the request
axios.get(url, { headers: signedHeaders })
    .then(response => {
        console.log('Status:', response.status);
        console.log('Response:', response.data);
    })
    .catch(error => {
        console.error('Error:', error.message);
    });`
      },
      curl: {
        'HMAC-SHA256': `#!/bin/bash

# Your API credentials
API_KEY="your-api-key"
SECRET_KEY="your-secret-key"

# Request details
URL="https://api.example.com/v1/rovers/status"
METHOD="GET"
HOST="api.example.com"

# Generate timestamp and nonce
TIMESTAMP=$(date +%s)
NONCE=$(uuidgen)

# Create canonical request
CANONICAL_REQUEST="$METHOD
$URL

host:$HOST
$TIMESTAMP
$NONCE
"

# Generate signature using OpenSSL
SIGNATURE=$(echo -n "$CANONICAL_REQUEST" | \\
    openssl dgst -sha256 -hmac "$SECRET_KEY" -binary | \\
    base64)

# Make the request
curl -X $METHOD "$URL" \\
    -H "Host: $HOST" \\
    -H "X-API-Key: $API_KEY" \\
    -H "X-Timestamp: $TIMESTAMP" \\
    -H "X-Nonce: $NONCE" \\
    -H "X-Signature-Algorithm: HMAC-SHA256" \\
    -H "Authorization: Signature $SIGNATURE"`
      }
    };

    return samples[language]?.[algorithm] || `// ${language} sample for ${algorithm} coming soon...`;
  };

  const getDefaultDependencies = (language: string, algorithm: string) => {
    const deps: { [key: string]: string[] } = {
      python: ['requests', 'cryptography'],
      javascript: ['axios', 'crypto'],
      java: ['okhttp', 'commons-codec'],
      csharp: ['System.Net.Http', 'System.Security.Cryptography'],
      go: ['net/http', 'crypto/hmac'],
      ruby: ['net/http', 'openssl'],
      php: ['curl', 'hash_hmac'],
      curl: []
    };

    if (algorithm.includes('JWT')) {
      if (language === 'python') deps.python.push('pyjwt');
      if (language === 'javascript') deps.javascript.push('jsonwebtoken');
    }

    return deps[language] || [];
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const downloadCode = () => {
    if (!sampleCode) return;
    
    const extension = {
      python: 'py',
      javascript: 'js',
      java: 'java',
      csharp: 'cs',
      go: 'go',
      ruby: 'rb',
      php: 'php',
      curl: 'sh'
    }[selectedLanguage] || 'txt';
    
    const blob = new Blob([sampleCode.code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `request_signing_${selectedAlgorithm.toLowerCase()}.${extension}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getLanguageSyntax = (language: string) => {
    const syntaxMap: { [key: string]: string } = {
      python: 'python',
      javascript: 'javascript',
      java: 'java',
      csharp: 'csharp',
      go: 'go',
      ruby: 'ruby',
      php: 'php',
      curl: 'bash'
    };
    return syntaxMap[language] || 'plaintext';
  };

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Sample Code Generator
      </Typography>
      
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" gutterBottom>
              Select Language
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {languages.map((lang) => (
                <Chip
                  key={lang.id}
                  label={`${lang.icon} ${lang.name}`}
                  onClick={() => {
                    setSelectedLanguage(lang.id);
                    setSelectedFramework(null);
                  }}
                  color={selectedLanguage === lang.id ? 'primary' : 'default'}
                  variant={selectedLanguage === lang.id ? 'filled' : 'outlined'}
                />
              ))}
            </Box>
          </Box>
        </Grid>
        
        <Grid item xs={12} md={6}>
          <FormControl fullWidth>
            <InputLabel>Algorithm</InputLabel>
            <Select
              value={selectedAlgorithm}
              onChange={(e) => setSelectedAlgorithm(e.target.value)}
            >
              {algorithms.map((algo) => (
                <MenuItem key={algo.id} value={algo.id}>
                  {algo.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        
        {languages.find(l => l.id === selectedLanguage)?.frameworks.length > 0 && (
          <Grid item xs={12} md={6}>
            <FormControl fullWidth>
              <InputLabel>Framework (Optional)</InputLabel>
              <Select
                value={selectedFramework || ''}
                onChange={(e) => setSelectedFramework(e.target.value || null)}
              >
                <MenuItem value="">Default</MenuItem>
                {languages
                  .find(l => l.id === selectedLanguage)
                  ?.frameworks.map((fw: string) => (
                    <MenuItem key={fw} value={fw}>
                      {fw}
                    </MenuItem>
                  ))}
              </Select>
            </FormControl>
          </Grid>
        )}
      </Grid>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
          <CircularProgress />
        </Box>
      ) : sampleCode ? (
        <Card sx={{ mt: 3 }}>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Box>
                <Typography variant="h6">
                  {sampleCode.title}
                </Typography>
                {sampleCode.description && (
                  <Typography variant="body2" color="text.secondary">
                    {sampleCode.description}
                  </Typography>
                )}
              </Box>
              <Box>
                <ToggleButtonGroup
                  value={codeDisplay}
                  exclusive
                  onChange={(e, value) => value && setCodeDisplay(value)}
                  size="small"
                  sx={{ mr: 2 }}
                >
                  <ToggleButton value="formatted">
                    <CodeIcon fontSize="small" />
                  </ToggleButton>
                  <ToggleButton value="raw">
                    <LanguageIcon fontSize="small" />
                  </ToggleButton>
                </ToggleButtonGroup>
                <Tooltip title="Copy code">
                  <IconButton onClick={() => copyToClipboard(sampleCode.code)}>
                    <CopyIcon />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Download code">
                  <IconButton onClick={downloadCode}>
                    <DownloadIcon />
                  </IconButton>
                </Tooltip>
              </Box>
            </Box>
            
            {sampleCode.dependencies?.length > 0 && (
              <Alert severity="info" sx={{ mb: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Dependencies:
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  {sampleCode.dependencies.map((dep: string) => (
                    <Chip key={dep} label={dep} size="small" />
                  ))}
                </Box>
              </Alert>
            )}
            
            <Paper sx={{ bgcolor: 'grey.900', color: 'white', overflow: 'auto' }}>
              {codeDisplay === 'formatted' ? (
                <SyntaxHighlighter
                  language={getLanguageSyntax(selectedLanguage)}
                  style={vs2015}
                  customStyle={{
                    margin: 0,
                    padding: '16px',
                    fontSize: '14px',
                    lineHeight: '1.5'
                  }}
                  showLineNumbers
                >
                  {sampleCode.code}
                </SyntaxHighlighter>
              ) : (
                <Box
                  component="pre"
                  sx={{
                    m: 0,
                    p: 2,
                    fontSize: '14px',
                    lineHeight: '1.5',
                    fontFamily: 'monospace',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-all'
                  }}
                >
                  {sampleCode.code}
                </Box>
              )}
            </Paper>
            
            {sampleCode.version && (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                Version: {sampleCode.version}
              </Typography>
            )}
          </CardContent>
        </Card>
      ) : null}

      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      )}
    </Box>
  );
};