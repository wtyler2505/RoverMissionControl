/**
 * Accessible Privacy Demo Component
 * Showcases all accessible privacy controls with testing capabilities
 */

import React, { useState, useCallback } from 'react';
import styled from '@emotion/styled';
import { css } from '@emotion/react';
import { useTheme } from '@emotion/react';
import { Button } from '../ui/core/Button';
import { Toggle } from '../ui/core/Toggle';
import { Card } from '../ui/core/Card';
import { AccessiblePrivacyControls } from './AccessiblePrivacyControls';
import { AccessibleConsentDialog } from './AccessibleConsentDialog';
import { AccessiblePrivacyForm } from './AccessiblePrivacyForm';
import { AccessibilityTestHelper } from './AccessibilityTestHelper';
import { ConsentCategory } from '../../services/privacy/ConsentManager';

interface AccessiblePrivacyDemoProps {
  className?: string;
}

const DemoContainer = styled.div`
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
`;

const DemoHeader = styled.header`
  margin-bottom: 3rem;
  text-align: center;
`;

const DemoTitle = styled.h1`
  font-size: 2.5rem;
  font-weight: 700;
  color: ${props => props.theme.colors.text.primary};
  margin: 0 0 1rem 0;
  line-height: 1.2;
`;

const DemoSubtitle = styled.p`
  font-size: 1.25rem;
  color: ${props => props.theme.colors.text.secondary};
  line-height: 1.6;
  margin: 0 0 2rem 0;
  max-width: 800px;
  margin-left: auto;
  margin-right: auto;
`;

const ControlPanel = styled.div`
  background: ${props => props.theme.colors.background.secondary};
  border: 1px solid ${props => props.theme.colors.border.secondary};
  border-radius: ${props => props.theme.borderRadius.lg};
  padding: 2rem;
  margin-bottom: 3rem;
`;

const ControlPanelTitle = styled.h2`
  font-size: 1.5rem;
  font-weight: 600;
  color: ${props => props.theme.colors.text.primary};
  margin: 0 0 1.5rem 0;
`;

const ControlRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 2rem;
  align-items: center;
  margin-bottom: 1.5rem;
  
  &:last-child {
    margin-bottom: 0;
  }
`;

const ControlGroup = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
`;

const ControlLabel = styled.label`
  font-size: 0.875rem;
  font-weight: 500;
  color: ${props => props.theme.colors.text.primary};
  cursor: pointer;
  min-width: 120px;
`;

const ButtonGroup = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  margin-top: 1rem;
`;

const DemoSection = styled.section`
  margin-bottom: 4rem;
  
  &:last-child {
    margin-bottom: 0;
  }
`;

const SectionTitle = styled.h2`
  font-size: 2rem;
  font-weight: 600;
  color: ${props => props.theme.colors.text.primary};
  margin: 0 0 1rem 0;
  line-height: 1.3;
`;

const SectionDescription = styled.p`
  font-size: 1rem;
  color: ${props => props.theme.colors.text.secondary};
  line-height: 1.6;
  margin: 0 0 2rem 0;
`;

const DemoCard = styled(Card)`
  padding: 0;
  overflow: hidden;
`;

const CardHeader = styled.div`
  padding: 1.5rem 2rem;
  background: ${props => props.theme.colors.background.tertiary};
  border-bottom: 1px solid ${props => props.theme.colors.border.secondary};
`;

const CardTitle = styled.h3`
  font-size: 1.25rem;
  font-weight: 600;
  color: ${props => props.theme.colors.text.primary};
  margin: 0 0 0.5rem 0;
`;

const CardDescription = styled.p`
  font-size: 0.875rem;
  color: ${props => props.theme.colors.text.secondary};
  margin: 0;
  line-height: 1.5;
`;

const CardContent = styled.div`
  padding: 2rem;
`;

const FeatureList = styled.ul`
  list-style: none;
  padding: 0;
  margin: 1rem 0;
`;

const FeatureItem = styled.li`
  display: flex;
  align-items: center;
  padding: 0.5rem 0;
  font-size: 0.875rem;
  color: ${props => props.theme.colors.text.secondary};
  
  &::before {
    content: '✓';
    color: ${props => props.theme.colors.success.main};
    font-weight: bold;
    margin-right: 0.75rem;
    width: 16px;
    text-align: center;
  }
`;

const StatusIndicator = styled.div<{ active: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.25rem 0.75rem;
  border-radius: ${props => props.theme.borderRadius.full};
  font-size: 0.75rem;
  font-weight: 600;
  
  ${({ active, theme }) => active ? css`
    background: ${theme.colors.success.light};
    color: ${theme.colors.success.dark};
    
    &::before {
      content: '●';
      color: ${theme.colors.success.main};
    }
  ` : css`
    background: ${theme.colors.neutral[200]};
    color: ${theme.colors.text.secondary};
    
    &::before {
      content: '○';
      color: ${theme.colors.neutral[400]};
    }
  `}
`;

// Sample form configuration
const privacyFormFields = [
  {
    name: 'firstName',
    label: 'First Name',
    type: 'text' as const,
    required: true,
    helpText: 'Enter your first name as it appears on official documents'
  },
  {
    name: 'lastName',
    label: 'Last Name',
    type: 'text' as const,
    required: true,
    helpText: 'Enter your last name as it appears on official documents'
  },
  {
    name: 'email',
    label: 'Email Address',
    type: 'email' as const,
    required: true,
    helpText: 'We will use this email to send you privacy-related updates',
    validation: {
      pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    }
  },
  {
    name: 'phone',
    label: 'Phone Number',
    type: 'tel' as const,
    required: false,
    helpText: 'Optional: We may use this for urgent privacy notifications'
  },
  {
    name: 'dataProcessing',
    label: 'I consent to the processing of my personal data for privacy management purposes',
    type: 'checkbox' as const,
    required: true
  },
  {
    name: 'communicationPreference',
    label: 'Communication Preference',
    type: 'select' as const,
    required: true,
    options: [
      { value: 'email', label: 'Email only' },
      { value: 'phone', label: 'Phone only' },
      { value: 'both', label: 'Both email and phone' },
      { value: 'none', label: 'No communications' }
    ],
    helpText: 'Choose how you would like to receive privacy updates'
  }
];

export const AccessiblePrivacyDemo: React.FC<AccessiblePrivacyDemoProps> = ({
  className
}) => {
  const theme = useTheme();
  
  // Demo state
  const [verboseMode, setVerboseMode] = useState(false);
  const [highContrastMode, setHighContrastMode] = useState(false);
  const [showTestControls, setShowTestControls] = useState(false);
  const [activeDemo, setActiveDemo] = useState<string | null>(null);
  
  // Dialog states
  const [showConsentDialog, setShowConsentDialog] = useState(false);
  const [showPrivacyForm, setShowPrivacyForm] = useState(false);

  // Handlers
  const handleConsentChange = useCallback((category: ConsentCategory, granted: boolean) => {
    console.log(`Consent changed: ${category} = ${granted}`);
  }, []);

  const handleDataExport = useCallback(() => {
    console.log('Data export requested');
  }, []);

  const handleDataDeletion = useCallback(() => {
    console.log('Data deletion requested');
  }, []);

  const handleConsentUpdate = useCallback((consents: Record<ConsentCategory, boolean>) => {
    console.log('Consents updated:', consents);
    setShowConsentDialog(false);
  }, []);

  const handleFormSubmit = useCallback(async (data: Record<string, any>) => {
    console.log('Form submitted:', data);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    setShowPrivacyForm(false);
  }, []);

  const handleTestResult = useCallback((result) => {
    console.log('Accessibility test result:', result);
  }, []);

  return (
    <DemoContainer className={className}>
      <DemoHeader>
        <DemoTitle>Accessible Privacy Controls Demo</DemoTitle>
        <DemoSubtitle>
          Comprehensive demonstration of WCAG 2.1 AA compliant privacy components 
          with full keyboard navigation, screen reader support, and accessibility testing tools.
        </DemoSubtitle>
      </DemoHeader>

      {/* Control Panel */}
      <ControlPanel>
        <ControlPanelTitle>Accessibility Testing Controls</ControlPanelTitle>
        
        <ControlRow>
          <ControlGroup>
            <ControlLabel htmlFor="verbose-mode">Verbose Mode:</ControlLabel>
            <Toggle
              id="verbose-mode"
              checked={verboseMode}
              onChange={setVerboseMode}
              size="small"
              aria-describedby="verbose-mode-help"
            />
            <StatusIndicator active={verboseMode}>
              {verboseMode ? 'Enabled' : 'Disabled'}
            </StatusIndicator>
          </ControlGroup>
          
          <ControlGroup>
            <ControlLabel htmlFor="high-contrast">High Contrast:</ControlLabel>
            <Toggle
              id="high-contrast"
              checked={highContrastMode}
              onChange={setHighContrastMode}
              size="small"
              aria-describedby="high-contrast-help"
            />
            <StatusIndicator active={highContrastMode}>
              {highContrastMode ? 'Enabled' : 'Disabled'}
            </StatusIndicator>
          </ControlGroup>
          
          <ControlGroup>
            <ControlLabel htmlFor="test-controls">Test Controls:</ControlLabel>
            <Toggle
              id="test-controls"
              checked={showTestControls}
              onChange={setShowTestControls}
              size="small"
              aria-describedby="test-controls-help"
            />
            <StatusIndicator active={showTestControls}>
              {showTestControls ? 'Visible' : 'Hidden'}
            </StatusIndicator>
          </ControlGroup>
        </ControlRow>

        <div style={{ marginTop: '1rem' }}>
          <p id="verbose-mode-help" style={{ fontSize: '0.75rem', color: theme.colors.text.secondary, margin: '0.5rem 0' }}>
            Verbose mode provides additional instructions and feedback for screen reader users.
          </p>
          <p id="high-contrast-help" style={{ fontSize: '0.75rem', color: theme.colors.text.secondary, margin: '0.5rem 0' }}>
            High contrast mode enhances visual accessibility with increased contrast ratios and border thickness.
          </p>
          <p id="test-controls-help" style={{ fontSize: '0.75rem', color: theme.colors.text.secondary, margin: '0.5rem 0' }}>
            Test controls provide accessibility testing tools including keyboard-only mode and automated scanning.
          </p>
        </div>

        <ButtonGroup>
          <Button
            variant="primary"
            size="small"
            onClick={() => setShowConsentDialog(true)}
          >
            Show Consent Dialog
          </Button>
          <Button
            variant="secondary"
            size="small"
            onClick={() => setShowPrivacyForm(true)}
          >
            Show Privacy Form
          </Button>
        </ButtonGroup>
      </ControlPanel>

      {/* Privacy Controls Demo */}
      <DemoSection>
        <SectionTitle>Privacy Controls Interface</SectionTitle>
        <SectionDescription>
          Main privacy settings interface with comprehensive consent management, 
          data rights controls, and accessibility features.
        </SectionDescription>

        <DemoCard>
          <CardHeader>
            <CardTitle>AccessiblePrivacyControls</CardTitle>
            <CardDescription>
              Full-featured privacy interface with keyboard navigation, screen reader support, 
              and high contrast mode.
            </CardDescription>
          </CardHeader>
          
          <CardContent>
            <FeatureList>
              <FeatureItem>Complete keyboard navigation support</FeatureItem>
              <FeatureItem>Screen reader announcements for all actions</FeatureItem>
              <FeatureItem>High contrast mode with enhanced visuals</FeatureItem>
              <FeatureItem>Live regions for dynamic content updates</FeatureItem>
              <FeatureItem>Proper ARIA attributes and semantic structure</FeatureItem>
              <FeatureItem>Focus management and restoration</FeatureItem>
            </FeatureList>

            <AccessibilityTestHelper
              testLabel="Privacy Controls"
              showControls={showTestControls}
              onTestResult={handleTestResult}
            >
              <AccessiblePrivacyControls
                verboseMode={verboseMode}
                highContrastMode={highContrastMode}
                onConsentChange={handleConsentChange}
                onExportData={handleDataExport}
                onDeleteData={handleDataDeletion}
              />
            </AccessibilityTestHelper>
          </CardContent>
        </DemoCard>
      </DemoSection>

      {/* Consent Dialog */}
      <AccessibleConsentDialog
        open={showConsentDialog}
        onClose={() => setShowConsentDialog(false)}
        onConsentUpdate={handleConsentUpdate}
        title="Privacy Preferences"
        description="Please review and configure your privacy preferences. You can change these settings at any time."
        verboseMode={verboseMode}
        highContrastMode={highContrastMode}
      />

      {/* Privacy Form */}
      {showPrivacyForm && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '2rem'
        }}>
          <div style={{
            background: theme.colors.background.paper,
            borderRadius: theme.borderRadius.lg,
            maxWidth: '600px',
            width: '100%',
            maxHeight: '90vh',
            overflow: 'auto'
          }}>
            <AccessibilityTestHelper
              testLabel="Privacy Form"
              showControls={showTestControls}
              onTestResult={handleTestResult}
            >
              <AccessiblePrivacyForm
                title="Privacy Information Form"
                description="Please provide your information for privacy preference management."
                fields={privacyFormFields}
                onSubmit={handleFormSubmit}
                onCancel={() => setShowPrivacyForm(false)}
                verboseMode={verboseMode}
                highContrastMode={highContrastMode}
              />
            </AccessibilityTestHelper>
          </div>
        </div>
      )}

      {/* Keyboard Navigation Instructions */}
      <DemoSection>
        <SectionTitle>Keyboard Navigation Guide</SectionTitle>
        <SectionDescription>
          All privacy components support complete keyboard navigation. Here are the key commands:
        </SectionDescription>

        <DemoCard>
          <CardContent>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '2rem' }}>
              <div>
                <h4 style={{ margin: '0 0 0.75rem 0', color: theme.colors.text.primary }}>
                  Basic Navigation
                </h4>
                <ul style={{ margin: 0, paddingLeft: '1.5rem', fontSize: '0.875rem', color: theme.colors.text.secondary }}>
                  <li><strong>Tab:</strong> Move forward</li>
                  <li><strong>Shift + Tab:</strong> Move backward</li>
                  <li><strong>Enter/Space:</strong> Activate buttons</li>
                  <li><strong>Escape:</strong> Close dialogs</li>
                </ul>
              </div>
              
              <div>
                <h4 style={{ margin: '0 0 0.75rem 0', color: theme.colors.text.primary }}>
                  Privacy Controls
                </h4>
                <ul style={{ margin: 0, paddingLeft: '1.5rem', fontSize: '0.875rem', color: theme.colors.text.secondary }}>
                  <li><strong>Space:</strong> Toggle consent switches</li>
                  <li><strong>Enter:</strong> Activate action buttons</li>
                  <li><strong>Arrow Keys:</strong> Navigate dropdown menus</li>
                  <li><strong>Home/End:</strong> Jump to first/last option</li>
                </ul>
              </div>
              
              <div>
                <h4 style={{ margin: '0 0 0.75rem 0', color: theme.colors.text.primary }}>
                  Form Navigation
                </h4>
                <ul style={{ margin: 0, paddingLeft: '1.5rem', fontSize: '0.875rem', color: theme.colors.text.secondary }}>
                  <li><strong>Tab:</strong> Move between form fields</li>
                  <li><strong>Arrow Keys:</strong> Navigate radio buttons</li>
                  <li><strong>Space:</strong> Check/uncheck checkboxes</li>
                  <li><strong>Enter:</strong> Submit forms</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </DemoCard>
      </DemoSection>

      {/* Screen Reader Instructions */}
      <DemoSection>
        <SectionTitle>Screen Reader Testing</SectionTitle>
        <SectionDescription>
          All components have been tested with major screen readers and provide comprehensive announcements.
        </SectionDescription>

        <DemoCard>
          <CardContent>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
              <div>
                <h4 style={{ margin: '0 0 0.75rem 0', color: theme.colors.text.primary }}>
                  Supported Screen Readers
                </h4>
                <ul style={{ margin: 0, paddingLeft: '1.5rem', fontSize: '0.875rem', color: theme.colors.text.secondary }}>
                  <li><strong>NVDA</strong> (Windows) - Free</li>
                  <li><strong>JAWS</strong> (Windows) - Commercial</li>
                  <li><strong>VoiceOver</strong> (macOS/iOS) - Built-in</li>
                  <li><strong>TalkBack</strong> (Android) - Built-in</li>
                </ul>
              </div>
              
              <div>
                <h4 style={{ margin: '0 0 0.75rem 0', color: theme.colors.text.primary }}>
                  Announcement Types
                </h4>
                <ul style={{ margin: 0, paddingLeft: '1.5rem', fontSize: '0.875rem', color: theme.colors.text.secondary }}>
                  <li>Privacy setting changes</li>
                  <li>Form validation errors</li>
                  <li>Dialog state changes</li>
                  <li>Loading and success messages</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </DemoCard>
      </DemoSection>
    </DemoContainer>
  );
};