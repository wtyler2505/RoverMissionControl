/**
 * Privacy Documentation Hub
 * Central hub for all privacy-related documentation and compliance resources
 */

import React, { useState, useEffect, useCallback } from 'react';
import styled from '@emotion/styled';
import { useTheme } from '@emotion/react';
import { 
  PrivacyPolicy,
  ComplianceDashboard as ComplianceDashboardData,
  PrivacyChangelog,
  privacyPolicyService 
} from '../../services/privacy/PrivacyPolicyService';
import { Card } from '../ui/core/Card';
import { Button } from '../ui/core/Button';
import { Modal } from '../ui/core/Modal';
import { PrivacyPolicyViewer } from './PrivacyPolicyViewer';
import { ComplianceDashboard } from './ComplianceDashboard';
import { DPIATemplateViewer } from './DPIATemplateViewer';
import { ContextualHelpWidget } from './ContextualHelpWidget';

interface PrivacyDocumentationHubProps {
  userRole?: 'user' | 'admin' | 'dpo'; // Data Protection Officer
  userId?: string;
  language?: string;
  className?: string;
}

type ActiveTab = 'overview' | 'policy' | 'compliance' | 'dpia' | 'changelog' | 'resources';

const Container = styled.div`
  max-width: 1400px;
  margin: 0 auto;
  padding: 2rem;
`;

const Header = styled.div`
  text-align: center;
  margin-bottom: 3rem;
`;

const Title = styled.h1`
  font-size: 3rem;
  font-weight: 700;
  color: ${props => props.theme.colors.text.primary};
  margin-bottom: 1rem;
`;

const Subtitle = styled.p`
  font-size: 1.25rem;
  color: ${props => props.theme.colors.text.secondary};
  max-width: 600px;
  margin: 0 auto;
  line-height: 1.6;
`;

const Navigation = styled.nav`
  display: flex;
  justify-content: center;
  margin-bottom: 3rem;
  border-bottom: 1px solid ${props => props.theme.colors.border.secondary};
`;

const NavButton = styled.button<{ isActive?: boolean }>`
  background: none;
  border: none;
  padding: 1rem 1.5rem;
  font-size: 1rem;
  font-weight: 500;
  color: ${props => props.isActive 
    ? props.theme.colors.primary 
    : props.theme.colors.text.secondary};
  cursor: pointer;
  border-bottom: 2px solid ${props => props.isActive 
    ? props.theme.colors.primary 
    : 'transparent'};
  transition: all 0.2s ease;
  
  &:hover {
    color: ${props => props.theme.colors.primary};
    background: ${props => props.theme.colors.primary}10;
  }
`;

const TabContent = styled.div`
  min-height: 500px;
`;

const OverviewGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
  gap: 2rem;
  margin-bottom: 3rem;
`;

const QuickActionCard = styled(Card)`
  padding: 2rem;
  text-align: center;
  position: relative;
  overflow: hidden;
  
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 4px;
    background: ${props => props.theme.colors.primary};
  }
`;

const QuickActionIcon = styled.div`
  font-size: 3rem;
  margin-bottom: 1rem;
`;

const QuickActionTitle = styled.h3`
  font-size: 1.25rem;
  font-weight: 600;
  color: ${props => props.theme.colors.text.primary};
  margin-bottom: 0.75rem;
`;

const QuickActionDescription = styled.p`
  font-size: 0.875rem;
  color: ${props => props.theme.colors.text.secondary};
  line-height: 1.5;
  margin-bottom: 1.5rem;
`;

const StatsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1.5rem;
  margin-bottom: 3rem;
`;

const StatCard = styled(Card)`
  padding: 1.5rem;
  text-align: center;
`;

const StatValue = styled.div`
  font-size: 2.5rem;
  font-weight: 700;
  color: ${props => props.theme.colors.primary};
  margin-bottom: 0.5rem;
`;

const StatLabel = styled.div`
  font-size: 0.875rem;
  color: ${props => props.theme.colors.text.secondary};
  font-weight: 500;
`;

const ResourceSection = styled.div`
  margin-bottom: 3rem;
`;

const SectionTitle = styled.h2`
  font-size: 1.75rem;
  font-weight: 600;
  color: ${props => props.theme.colors.text.primary};
  margin-bottom: 1.5rem;
  display: flex;
  align-items: center;
  gap: 0.75rem;
`;

const ResourceGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1.5rem;
`;

const ResourceCard = styled(Card)`
  padding: 1.5rem;
  transition: transform 0.2s ease;
  
  &:hover {
    transform: translateY(-2px);
  }
`;

const ResourceHeader = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  margin-bottom: 1rem;
`;

const ResourceIcon = styled.div`
  font-size: 1.5rem;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${props => props.theme.colors.primary}20;
  border-radius: 8px;
  color: ${props => props.theme.colors.primary};
`;

const ResourceContent = styled.div`
  flex: 1;
`;

const ResourceTitle = styled.h4`
  font-size: 1rem;
  font-weight: 600;
  color: ${props => props.theme.colors.text.primary};
  margin-bottom: 0.5rem;
`;

const ResourceDescription = styled.p`
  font-size: 0.875rem;
  color: ${props => props.theme.colors.text.secondary};
  line-height: 1.4;
  margin: 0;
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 4rem;
  color: ${props => props.theme.colors.text.secondary};
`;

const LoadingSpinner = styled.div`
  display: inline-block;
  width: 32px;
  height: 32px;
  border: 3px solid ${props => props.theme.colors.border.secondary};
  border-radius: 50%;
  border-top-color: ${props => props.theme.colors.primary};
  animation: spin 1s ease-in-out infinite;

  @keyframes spin {
    to { transform: rotate(360deg); }
  }
`;

const ErrorMessage = styled.div`
  padding: 1rem;
  background: ${props => props.theme.colors.status.error}20;
  border: 1px solid ${props => props.theme.colors.status.error};
  border-radius: 4px;
  color: ${props => props.theme.colors.status.error};
  margin: 1rem 0;
  text-align: center;
`;

export const PrivacyDocumentationHub: React.FC<PrivacyDocumentationHubProps> = ({
  userRole = 'user',
  userId,
  language = 'en',
  className
}) => {
  const theme = useTheme();
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [currentPolicy, setCurrentPolicy] = useState<PrivacyPolicy | null>(null);
  const [complianceData, setComplianceData] = useState<ComplianceDashboardData | null>(null);
  const [changelog, setChangelog] = useState<PrivacyChangelog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showLanguageModal, setShowLanguageModal] = useState(false);

  // Navigation items based on user role
  const getNavItems = useCallback(() => {
    const baseItems = [
      { key: 'overview' as ActiveTab, label: 'Overview', icon: '🏠' },
      { key: 'policy' as ActiveTab, label: 'Privacy Policy', icon: '📋' },
      { key: 'changelog' as ActiveTab, label: 'Changes', icon: '📝' },
      { key: 'resources' as ActiveTab, label: 'Resources', icon: '📚' }
    ];

    if (userRole === 'admin' || userRole === 'dpo') {
      baseItems.splice(2, 0, 
        { key: 'compliance' as ActiveTab, label: 'Compliance', icon: '✅' },
        { key: 'dpia' as ActiveTab, label: 'DPIA Templates', icon: '🛡️' }
      );
    }

    return baseItems;
  }, [userRole]);

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);

        const [policy, changelogData] = await Promise.all([
          privacyPolicyService.getActivePolicy(language),
          privacyPolicyService.getPrivacyChangelog(undefined, language)
        ]);

        setCurrentPolicy(policy);
        setChangelog(changelogData);

        // Load compliance data for admin/DPO users
        if (userRole === 'admin' || userRole === 'dpo') {
          try {
            const compliance = await privacyPolicyService.getComplianceDashboard();
            setComplianceData(compliance);
          } catch (complianceError) {
            console.warn('Failed to load compliance data:', complianceError);
          }
        }
      } catch (err) {
        console.error('Failed to load privacy documentation data:', err);
        setError('Failed to load privacy documentation. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [language, userRole]);

  // Handle export user data
  const handleExportData = useCallback(async () => {
    if (!userId) {
      alert('Please log in to export your data');
      return;
    }

    try {
      await privacyPolicyService.exportUserPrivacyData(userId);
    } catch (error) {
      console.error('Failed to export user data:', error);
      alert('Failed to export data. Please try again.');
    }
  }, [userId]);

  // Render overview tab
  const renderOverview = () => (
    <div>
      {/* Quick Stats */}
      <StatsGrid>
        <StatCard>
          <StatValue>{currentPolicy ? '1' : '0'}</StatValue>
          <StatLabel>Active Policy</StatLabel>
        </StatCard>
        <StatCard>
          <StatValue>{changelog?.total_versions || 0}</StatValue>
          <StatLabel>Policy Versions</StatLabel>
        </StatCard>
        <StatCard>
          <StatValue>
            {complianceData ? `${Math.round(complianceData.user_acknowledgment_rate)}%` : 'N/A'}
          </StatValue>
          <StatLabel>User Compliance</StatLabel>
        </StatCard>
        <StatCard>
          <StatValue>
            {complianceData ? complianceData.total_metrics : 'N/A'}
          </StatValue>
          <StatLabel>Monitored Metrics</StatLabel>
        </StatCard>
      </StatsGrid>

      {/* Quick Actions */}
      <OverviewGrid>
        <QuickActionCard>
          <QuickActionIcon>📋</QuickActionIcon>
          <QuickActionTitle>Current Privacy Policy</QuickActionTitle>
          <QuickActionDescription>
            Review our current privacy policy to understand how we collect, 
            use, and protect your personal information.
          </QuickActionDescription>
          <Button
            variant="primary"
            onClick={() => setActiveTab('policy')}
            disabled={!currentPolicy}
          >
            {currentPolicy ? 'View Policy' : 'No Policy Available'}
          </Button>
          <ContextualHelpWidget 
            contextKey="privacy_policy_overview"
            placement="top"
            iconSize="small"
            style={{ position: 'absolute', top: '1rem', right: '1rem' }}
          />
        </QuickActionCard>

        <QuickActionCard>
          <QuickActionIcon>📝</QuickActionIcon>
          <QuickActionTitle>Recent Changes</QuickActionTitle>
          <QuickActionDescription>
            Stay informed about recent updates to our privacy practices 
            and policy changes that may affect you.
          </QuickActionDescription>
          <Button
            variant="secondary"
            onClick={() => setActiveTab('changelog')}
          >
            View Changelog
          </Button>
        </QuickActionCard>

        <QuickActionCard>
          <QuickActionIcon>💾</QuickActionIcon>
          <QuickActionTitle>Export Your Data</QuickActionTitle>
          <QuickActionDescription>
            Download a copy of your privacy preferences and consent history 
            as guaranteed by data protection regulations.
          </QuickActionDescription>
          <Button
            variant="secondary"
            onClick={handleExportData}
            disabled={!userId}
          >
            {userId ? 'Export Data' : 'Login Required'}
          </Button>
          <ContextualHelpWidget 
            contextKey="data_export"
            placement="top"
            iconSize="small"
            style={{ position: 'absolute', top: '1rem', right: '1rem' }}
          />
        </QuickActionCard>

        {(userRole === 'admin' || userRole === 'dpo') && (
          <>
            <QuickActionCard>
              <QuickActionIcon>✅</QuickActionIcon>
              <QuickActionTitle>Compliance Dashboard</QuickActionTitle>
              <QuickActionDescription>
                Monitor system compliance status, metrics, and recent 
                policy changes requiring attention.
              </QuickActionDescription>
              <Button
                variant="primary"
                onClick={() => setActiveTab('compliance')}
              >
                View Dashboard
              </Button>
            </QuickActionCard>

            <QuickActionCard>
              <QuickActionIcon>🛡️</QuickActionIcon>
              <QuickActionTitle>DPIA Templates</QuickActionTitle>
              <QuickActionDescription>
                Access Data Protection Impact Assessment templates for 
                systematic privacy risk evaluation.
              </QuickActionDescription>
              <Button
                variant="secondary"
                onClick={() => setActiveTab('dpia')}
              >
                View Templates
              </Button>
            </QuickActionCard>
          </>
        )}

        <QuickActionCard>
          <QuickActionIcon>📚</QuickActionIcon>
          <QuickActionTitle>Privacy Resources</QuickActionTitle>
          <QuickActionDescription>
            Access guides, best practices, and additional resources 
            about privacy and data protection.
          </QuickActionDescription>
          <Button
            variant="secondary"
            onClick={() => setActiveTab('resources')}
          >
            Browse Resources
          </Button>
        </QuickActionCard>
      </OverviewGrid>
    </div>
  );

  // Render resources tab
  const renderResources = () => (
    <div>
      <ResourceSection>
        <SectionTitle>
          <span>📖</span>
          Privacy Guides
        </SectionTitle>
        <ResourceGrid>
          <ResourceCard>
            <ResourceHeader>
              <ResourceIcon>🔒</ResourceIcon>
              <ResourceContent>
                <ResourceTitle>Understanding Your Privacy Rights</ResourceTitle>
                <ResourceDescription>
                  Learn about your rights under GDPR, CCPA, and other privacy regulations.
                </ResourceDescription>
              </ResourceContent>
            </ResourceHeader>
            <Button variant="secondary" size="small">Read Guide</Button>
          </ResourceCard>

          <ResourceCard>
            <ResourceHeader>
              <ResourceIcon>🛡️</ResourceIcon>
              <ResourceContent>
                <ResourceTitle>Data Security Best Practices</ResourceTitle>
                <ResourceDescription>
                  Tips for protecting your personal information online.
                </ResourceDescription>
              </ResourceContent>
            </ResourceHeader>
            <Button variant="secondary" size="small">Read Guide</Button>
          </ResourceCard>

          <ResourceCard>
            <ResourceHeader>
              <ResourceIcon>🤝</ResourceIcon>
              <ResourceContent>
                <ResourceTitle>Consent Management</ResourceTitle>
                <ResourceDescription>
                  How to manage your consent preferences and what they mean.
                </ResourceDescription>
              </ResourceContent>
            </ResourceHeader>
            <Button variant="secondary" size="small">Read Guide</Button>
          </ResourceCard>
        </ResourceGrid>
      </ResourceSection>

      <ResourceSection>
        <SectionTitle>
          <span>📞</span>
          Support & Contact
        </SectionTitle>
        <ResourceGrid>
          <ResourceCard>
            <ResourceHeader>
              <ResourceIcon>📧</ResourceIcon>
              <ResourceContent>
                <ResourceTitle>Privacy Questions</ResourceTitle>
                <ResourceDescription>
                  Contact our privacy team with questions about data handling.
                </ResourceDescription>
              </ResourceContent>
            </ResourceHeader>
            <Button variant="secondary" size="small">Contact Us</Button>
          </ResourceCard>

          <ResourceCard>
            <ResourceHeader>
              <ResourceIcon>🚨</ResourceIcon>
              <ResourceContent>
                <ResourceTitle>Report Privacy Concern</ResourceTitle>
                <ResourceDescription>
                  Report potential privacy violations or data breaches.
                </ResourceDescription>
              </ResourceContent>
            </ResourceHeader>
            <Button variant="secondary" size="small">Report Issue</Button>
          </ResourceCard>

          {(userRole === 'admin' || userRole === 'dpo') && (
            <ResourceCard>
              <ResourceHeader>
                <ResourceIcon>⚖️</ResourceIcon>
                <ResourceContent>
                  <ResourceTitle>Legal Resources</ResourceTitle>
                  <ResourceDescription>
                    Access legal templates and compliance documentation.
                  </ResourceDescription>
                </ResourceContent>
              </ResourceHeader>
              <Button variant="secondary" size="small">View Resources</Button>
            </ResourceCard>
          )}
        </ResourceGrid>
      </ResourceSection>

      <ResourceSection>
        <SectionTitle>
          <span>🌍</span>
          Regulatory Information
        </SectionTitle>
        <ResourceGrid>
          <ResourceCard>
            <ResourceHeader>
              <ResourceIcon>🇪🇺</ResourceIcon>
              <ResourceContent>
                <ResourceTitle>GDPR Compliance</ResourceTitle>
                <ResourceDescription>
                  Information about our GDPR compliance measures and your EU rights.
                </ResourceDescription>
              </ResourceContent>
            </ResourceHeader>
            <Button variant="secondary" size="small">Learn More</Button>
          </ResourceCard>

          <ResourceCard>
            <ResourceHeader>
              <ResourceIcon>🇺🇸</ResourceIcon>
              <ResourceContent>
                <ResourceTitle>CCPA Information</ResourceTitle>
                <ResourceDescription>
                  Details about California Consumer Privacy Act compliance.
                </ResourceDescription>
              </ResourceContent>
            </ResourceHeader>
            <Button variant="secondary" size="small">Learn More</Button>
          </ResourceCard>

          <ResourceCard>
            <ResourceHeader>
              <ResourceIcon>🌐</ResourceIcon>
              <ResourceContent>
                <ResourceTitle>International Privacy Laws</ResourceTitle>
                <ResourceDescription>
                  Overview of privacy regulations in different countries.
                </ResourceDescription>
              </ResourceContent>
            </ResourceHeader>
            <Button variant="secondary" size="small">Learn More</Button>
          </ResourceCard>
        </ResourceGrid>
      </ResourceSection>
    </div>
  );

  if (loading) {
    return (
      <Container className={className}>
        <div style={{ textAlign: 'center', padding: '4rem' }}>
          <LoadingSpinner />
          <p style={{ marginTop: '1rem', color: theme.colors.text.secondary }}>
            Loading privacy documentation...
          </p>
        </div>
      </Container>
    );
  }

  if (error) {
    return (
      <Container className={className}>
        <ErrorMessage role="alert">{error}</ErrorMessage>
        <div style={{ textAlign: 'center', marginTop: '2rem' }}>
          <Button onClick={() => window.location.reload()}>Retry</Button>
        </div>
      </Container>
    );
  }

  return (
    <Container className={className}>
      <Header>
        <Title>Privacy Documentation</Title>
        <Subtitle>
          Your comprehensive resource for understanding our privacy practices, 
          exercising your rights, and staying informed about data protection.
        </Subtitle>
      </Header>

      <Navigation>
        {getNavItems().map((item) => (
          <NavButton
            key={item.key}
            isActive={activeTab === item.key}
            onClick={() => setActiveTab(item.key)}
          >
            <span style={{ marginRight: '0.5rem' }}>{item.icon}</span>
            {item.label}
          </NavButton>
        ))}
      </Navigation>

      <TabContent>
        {activeTab === 'overview' && renderOverview()}
        
        {activeTab === 'policy' && (
          <PrivacyPolicyViewer
            showVersionSelector={true}
            showAcknowledgmentButton={!!userId}
            userId={userId}
          />
        )}
        
        {activeTab === 'compliance' && (userRole === 'admin' || userRole === 'dpo') && (
          <ComplianceDashboard />
        )}
        
        {activeTab === 'dpia' && (userRole === 'admin' || userRole === 'dpo') && (
          <DPIATemplateViewer showTemplateSelector={true} language={language} />
        )}
        
        {activeTab === 'changelog' && changelog && (
          <div>
            <div style={{ marginBottom: '2rem' }}>
              <h2>Privacy Policy Changelog</h2>
              <p style={{ color: theme.colors.text.secondary }}>
                Generated: {privacyPolicyService.formatDateTime(changelog.generated_date)}
              </p>
            </div>
            
            {changelog.versions.map((version, index) => (
              <Card key={index} style={{ marginBottom: '2rem', padding: '2rem' }}>
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '1rem'
                }}>
                  <h3>Version {version.version}</h3>
                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <span style={{ 
                      padding: '0.25rem 0.75rem',
                      borderRadius: '9999px',
                      fontSize: '0.75rem',
                      background: privacyPolicyService.getImpactLevelColor(
                        version.requires_acknowledgment ? 'high' : 'low'
                      ) + '20',
                      color: privacyPolicyService.getImpactLevelColor(
                        version.requires_acknowledgment ? 'high' : 'low'
                      )
                    }}>
                      {privacyPolicyService.getChangeTypeLabel(version.change_type)}
                    </span>
                    <span style={{ 
                      fontSize: '0.875rem',
                      color: theme.colors.text.secondary
                    }}>
                      {privacyPolicyService.formatDate(version.effective_date)}
                    </span>
                  </div>
                </div>
                
                {version.summary && (
                  <p style={{ 
                    fontStyle: 'italic',
                    marginBottom: '1rem',
                    color: theme.colors.text.secondary
                  }}>
                    {version.summary}
                  </p>
                )}
                
                {version.changes.length > 0 && (
                  <div>
                    <h4 style={{ marginBottom: '0.75rem' }}>Changes:</h4>
                    <ul style={{ marginLeft: '1rem' }}>
                      {version.changes.map((change, changeIndex) => (
                        <li key={changeIndex} style={{ marginBottom: '0.5rem' }}>
                          <strong>{change.section}:</strong> {change.description}
                          {change.requires_consent && (
                            <span style={{ 
                              marginLeft: '0.5rem',
                              color: theme.colors.status.warning,
                              fontSize: '0.875rem'
                            }}>
                              (Requires consent)
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
        
        {activeTab === 'resources' && renderResources()}
      </TabContent>

      {/* Language Selection Modal */}
      <Modal
        isOpen={showLanguageModal}
        onClose={() => setShowLanguageModal(false)}
        title="Select Language"
      >
        <div>
          <p style={{ marginBottom: '1rem' }}>
            Choose your preferred language for privacy documentation:
          </p>
          <div style={{ display: 'grid', gap: '0.5rem' }}>
            {[
              { code: 'en', name: 'English' },
              { code: 'es', name: 'Español' },
              { code: 'fr', name: 'Français' },
              { code: 'de', name: 'Deutsch' },
              { code: 'pt', name: 'Português' }
            ].map((lang) => (
              <Button
                key={lang.code}
                variant={language === lang.code ? 'primary' : 'secondary'}
                onClick={() => {
                  // In a real implementation, this would update the language
                  console.log('Language changed to:', lang.code);
                  setShowLanguageModal(false);
                }}
              >
                {lang.name}
              </Button>
            ))}
          </div>
        </div>
      </Modal>
    </Container>
  );
};