/**
 * Rich Content Demo Component
 * Demonstrates all rich content capabilities with examples
 */

import React, { useState, useCallback } from 'react';
import styled from '@emotion/styled';
import { Theme } from '../../../../theme/themes';
import { PriorityAlert } from './PriorityAlert';
import { 
  RichContent, 
  RichContentConfig,
  AlertAction,
  AlertActionGroup
} from './types/RichContentTypes';

const DemoContainer = styled.div<{ theme: Theme }>`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing[6]};
  padding: ${({ theme }) => theme.spacing[6]};
  max-width: 1200px;
  margin: 0 auto;
`;

const DemoSection = styled.div<{ theme: Theme }>`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing[4]};
`;

const SectionTitle = styled.h2<{ theme: Theme }>`
  font-size: ${({ theme }) => theme.typography.fontSize.xl};
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  color: ${({ theme }) => theme.colors.text.primary};
  margin: 0;
  border-bottom: 2px solid ${({ theme }) => theme.colors.primary.main};
  padding-bottom: ${({ theme }) => theme.spacing[2]};
`;

const DemoDescription = styled.p<{ theme: Theme }>`
  color: ${({ theme }) => theme.colors.text.secondary};
  font-size: ${({ theme }) => theme.typography.fontSize.base};
  line-height: ${({ theme }) => theme.typography.lineHeight.relaxed};
  margin: 0;
`;

const ConfigPanel = styled.div<{ theme: Theme }>`
  background: ${({ theme }) => theme.colors.background.elevated};
  border: 1px solid ${({ theme }) => theme.colors.divider};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  padding: ${({ theme }) => theme.spacing[4]};
  display: flex;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.spacing[3]};
  align-items: center;
`;

const ConfigLabel = styled.label<{ theme: Theme }>`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing[2]};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  color: ${({ theme }) => theme.colors.text.primary};
  cursor: pointer;
`;

const ConfigInput = styled.input<{ theme: Theme }>`
  accent-color: ${({ theme }) => theme.colors.primary.main};
`;

const ConfigSelect = styled.select<{ theme: Theme }>`
  padding: ${({ theme }) => theme.spacing[1]} ${({ theme }) => theme.spacing[2]};
  border: 1px solid ${({ theme }) => theme.colors.divider};
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  background: ${({ theme }) => theme.colors.background.paper};
  color: ${({ theme }) => theme.colors.text.primary};
`;

export const RichContentDemo: React.FC = () => {
  const [securityLevel, setSecurityLevel] = useState<'trusted' | 'sanitized' | 'restricted'>('sanitized');
  const [sandboxMode, setSandboxMode] = useState(false);
  const [allowExternalLinks, setAllowExternalLinks] = useState(true);
  const [showInteractionLog, setShowInteractionLog] = useState(false);
  const [interactionLog, setInteractionLog] = useState<string[]>([]);

  // Rich content configuration
  const richContentConfig: RichContentConfig = {
    maxContentHeight: '400px',
    allowScrolling: true,
    sandboxMode,
    securityPolicy: {
      allowScripts: false,
      allowExternalLinks,
      allowFormSubmissions: true,
      allowFileUploads: false,
      trustedDomains: ['example.com', 'trusted-domain.org']
    },
    accessibility: {
      announceChanges: true,
      supportScreenReader: true,
      enforceColorContrast: true,
      requireAltText: true
    }
  };

  // Handle rich content interactions
  const handleRichContentInteraction = useCallback((contentId: string, action: string, data?: any) => {
    const logEntry = `[${new Date().toLocaleTimeString()}] ${contentId}: ${action} ${data ? JSON.stringify(data) : ''}`;
    setInteractionLog(prev => [logEntry, ...prev.slice(0, 9)]); // Keep last 10 entries
  }, []);

  // Example 1: Rich Text Content
  const richTextContent: RichContent[] = [
    {
      id: 'rich-text-markdown',
      type: 'markdown',
      securityLevel,
      content: `# System Alert
      
This is a **markdown** formatted message with:
- *Italic text*
- **Bold text**
- \`inline code\`
- [Links](https://example.com)

> This is a blockquote with important information.

\`\`\`javascript
console.log('Code block example');
\`\`\``,
      constraints: {
        maxWidth: '100%'
      }
    }
  ];

  // Example 2: Mixed Content Types
  const mixedContent: RichContent[] = [
    {
      id: 'alert-image',
      type: 'image',
      securityLevel,
      src: 'https://via.placeholder.com/400x200/3B82F6/FFFFFF?text=System+Status',
      alt: 'System status dashboard screenshot',
      constraints: {
        maxWidth: '400px'
      },
      loading: 'lazy'
    },
    {
      id: 'status-progress',
      type: 'progress',
      securityLevel,
      value: 75,
      max: 100,
      label: 'System Recovery Progress',
      showPercentage: true,
      color: 'success',
      variant: 'linear',
      size: 'medium'
    },
    {
      id: 'external-link',
      type: 'link',
      securityLevel,
      href: 'https://docs.example.com/troubleshooting',
      text: 'View Troubleshooting Guide',
      external: true,
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.11 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/>
        </svg>
      )
    }
  ];

  // Example 3: Form Content
  const formContent: RichContent[] = [
    {
      id: 'incident-form',
      type: 'form',
      securityLevel,
      fields: [
        {
          id: 'incident-type',
          name: 'incidentType',
          type: 'select',
          label: 'Incident Type',
          required: true,
          options: [
            { value: 'hardware', label: 'Hardware Failure' },
            { value: 'software', label: 'Software Error' },
            { value: 'network', label: 'Network Issue' },
            { value: 'security', label: 'Security Incident' }
          ]
        },
        {
          id: 'description',
          name: 'description',
          type: 'text',
          label: 'Description',
          required: true,
          multiline: true,
          rows: 3,
          placeholder: 'Provide detailed description of the incident...',
          validation: {
            minLength: 10,
            maxLength: 500
          }
        },
        {
          id: 'priority',
          name: 'priority',
          type: 'radio',
          label: 'Priority Level',
          required: true,
          options: [
            { value: 'low', label: 'Low' },
            { value: 'medium', label: 'Medium' },
            { value: 'high', label: 'High' },
            { value: 'critical', label: 'Critical' }
          ]
        }
      ],
      onSubmit: async (data) => {
        console.log('Form submitted:', data);
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1000));
        return { success: true };
      },
      submitText: 'Report Incident',
      cancelText: 'Cancel'
    }
  ];

  // Example 4: Table Content
  const tableContent: RichContent[] = [
    {
      id: 'system-metrics',
      type: 'table',
      securityLevel,
      columns: [
        { id: 'metric', label: 'Metric', align: 'left', sortable: true },
        { id: 'value', label: 'Value', align: 'right', sortable: true },
        { id: 'status', label: 'Status', align: 'center', sortable: true },
        { id: 'trend', label: 'Trend', align: 'center' }
      ],
      data: [
        { metric: 'CPU Usage', value: '45%', status: 'Normal', trend: '↑' },
        { metric: 'Memory Usage', value: '78%', status: 'Warning', trend: '↑' },
        { metric: 'Disk Space', value: '23%', status: 'Normal', trend: '→' },
        { metric: 'Network Load', value: '12%', status: 'Low', trend: '↓' },
        { metric: 'Temperature', value: '62°C', status: 'Normal', trend: '→' }
      ],
      sortable: true,
      searchable: true,
      maxRows: 10
    }
  ];

  // Alert actions
  const alertActions: AlertAction[] = [
    {
      id: 'acknowledge',
      type: 'acknowledge',
      label: 'Acknowledge',
      priority: 'primary',
      variant: 'primary',
      acknowledgeOperation: async () => ({ success: true }),
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
        </svg>
      )
    },
    {
      id: 'dismiss',
      type: 'dismiss',
      label: 'Dismiss',
      priority: 'secondary',
      variant: 'tertiary'
    }
  ];

  return (
    <DemoContainer>
      <DemoSection>
        <SectionTitle>Rich Content Alert System Demo</SectionTitle>
        <DemoDescription>
          This demo showcases the rich content capabilities of the alert system, including markdown text,
          images, forms, progress bars, tables, and interactive elements with various security levels.
        </DemoDescription>
        
        {/* Configuration Panel */}
        <ConfigPanel>
          <ConfigLabel>
            Security Level:
            <ConfigSelect 
              value={securityLevel} 
              onChange={(e) => setSecurityLevel(e.target.value as any)}
            >
              <option value="trusted">Trusted</option>
              <option value="sanitized">Sanitized</option>
              <option value="restricted">Restricted</option>
            </ConfigSelect>
          </ConfigLabel>
          
          <ConfigLabel>
            <ConfigInput 
              type="checkbox" 
              checked={sandboxMode}
              onChange={(e) => setSandboxMode(e.target.checked)}
            />
            Sandbox Mode
          </ConfigLabel>
          
          <ConfigLabel>
            <ConfigInput 
              type="checkbox" 
              checked={allowExternalLinks}
              onChange={(e) => setAllowExternalLinks(e.target.checked)}
            />
            Allow External Links
          </ConfigLabel>
          
          <ConfigLabel>
            <ConfigInput 
              type="checkbox" 
              checked={showInteractionLog}
              onChange={(e) => setShowInteractionLog(e.target.checked)}
            />
            Show Interaction Log
          </ConfigLabel>
        </ConfigPanel>
        
        {/* Interaction Log */}
        {showInteractionLog && interactionLog.length > 0 && (
          <div style={{ 
            background: '#f0f0f0', 
            padding: '12px', 
            borderRadius: '8px',
            fontFamily: 'monospace',
            fontSize: '12px',
            maxHeight: '150px',
            overflow: 'auto'
          }}>
            <strong>Interaction Log:</strong>
            {interactionLog.map((entry, index) => (
              <div key={index}>{entry}</div>
            ))}
          </div>
        )}
      </DemoSection>

      {/* Rich Text Example */}
      <DemoSection>
        <SectionTitle>Rich Text Content</SectionTitle>
        <PriorityAlert
          priority="info"
          title="System Documentation Update"
          message="New documentation has been published with markdown formatting:"
          richContent={richTextContent}
          richContentConfig={richContentConfig}
          actions={alertActions}
          onRichContentInteraction={handleRichContentInteraction}
          closable
        />
      </DemoSection>

      {/* Mixed Content Example */}
      <DemoSection>
        <SectionTitle>Mixed Content Types</SectionTitle>
        <PriorityAlert
          priority="medium"
          title="System Recovery in Progress"
          message="The system is currently recovering from the recent outage. Monitor progress below:"
          richContent={mixedContent}
          richContentConfig={richContentConfig}
          actions={alertActions}
          onRichContentInteraction={handleRichContentInteraction}
          closable
        />
      </DemoSection>

      {/* Form Content Example */}
      <DemoSection>
        <SectionTitle>Interactive Form Content</SectionTitle>
        <PriorityAlert
          priority="high"
          title="Incident Reporting Required"
          message="Please provide details about the incident to help our team investigate:"
          richContent={formContent}
          richContentConfig={richContentConfig}
          onRichContentInteraction={handleRichContentInteraction}
          closable
        />
      </DemoSection>

      {/* Table Content Example */}
      <DemoSection>
        <SectionTitle>Data Table Content</SectionTitle>
        <PriorityAlert
          priority="low"
          title="System Metrics Report"
          message="Current system performance metrics:"
          richContent={tableContent}
          richContentConfig={richContentConfig}
          actions={alertActions}
          onRichContentInteraction={handleRichContentInteraction}
          closable
        />
      </DemoSection>
    </DemoContainer>
  );
};