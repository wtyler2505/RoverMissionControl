/**
 * Enhanced Consent Settings Component
 * Provides granular consent management with detailed explanations, history, and contextual controls
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import styled from '@emotion/styled';
import { useTheme } from '@emotion/react';
import { 
  ConsentManager, 
  ConsentCategory, 
  ConsentConfiguration,
  ConsentPreference,
  consentManager 
} from '../../services/privacy/ConsentManager';
import { Card } from '../ui/core/Card';
import { Button } from '../ui/core/Button';
import { Toggle } from '../ui/core/Toggle';
import { Modal } from '../ui/core/Modal';

interface EnhancedConsentSettingsProps {
  className?: string;
  onConsentChange?: (category: ConsentCategory, granted: boolean) => void;
  showHistoryByDefault?: boolean;
  enableContextualRequests?: boolean;
}

const Container = styled.div`
  max-width: 1000px;
  margin: 0 auto;
  padding: 2rem;
`;

const Header = styled.div`
  margin-bottom: 2rem;
`;

const Title = styled.h1`
  font-size: 2rem;
  font-weight: 600;
  color: ${props => props.theme.colors.text.primary};
  margin-bottom: 0.5rem;
`;

const Subtitle = styled.p`
  font-size: 1rem;
  color: ${props => props.theme.colors.text.secondary};
  line-height: 1.6;
`;

const TabBar = styled.div`
  display: flex;
  border-bottom: 2px solid ${props => props.theme.colors.border.secondary};
  margin-bottom: 2rem;
`;

const Tab = styled.button<{ active: boolean }>`
  padding: 1rem 1.5rem;
  background: none;
  border: none;
  font-size: 1rem;
  font-weight: 500;
  color: ${props => props.active ? props.theme.colors.primary : props.theme.colors.text.secondary};
  border-bottom: 2px solid ${props => props.active ? props.theme.colors.primary : 'transparent'};
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    color: ${props => props.theme.colors.primary};
  }
`;

const GroupContainer = styled.div`
  margin-bottom: 2rem;
`;

const GroupTitle = styled.h2`
  font-size: 1.25rem;
  font-weight: 500;
  color: ${props => props.theme.colors.text.primary};
  margin-bottom: 1rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const GroupDescription = styled.p`
  font-size: 0.875rem;
  color: ${props => props.theme.colors.text.secondary};
  margin-bottom: 1.5rem;
  line-height: 1.5;
`;

const ConsentItem = styled.div<{ required?: boolean; sensitive?: boolean }>`
  padding: 1.5rem;
  border: 1px solid ${props => {
    if (props.sensitive) return props.theme.colors.status.warning;
    if (props.required) return props.theme.colors.border.secondary;
    return props.theme.colors.border.secondary;
  }};
  border-radius: 8px;
  margin-bottom: 1rem;
  background: ${props => props.theme.colors.background.secondary};
  opacity: ${props => props.required ? 0.8 : 1};
  
  &:hover {
    border-color: ${props => props.theme.colors.border.primary};
  }
`;

const ConsentHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 0.75rem;
`;

const ConsentName = styled.h3`
  font-size: 1.125rem;
  font-weight: 500;
  color: ${props => props.theme.colors.text.primary};
  margin: 0;
  flex: 1;
`;

const BadgeContainer = styled.div`
  display: flex;
  gap: 0.5rem;
  margin-left: 1rem;
`;

const Badge = styled.span<{ variant: 'required' | 'sensitive' | 'third-party' }>`
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 500;
  background: ${props => {
    switch (props.variant) {
      case 'required': return props.theme.colors.status.warning;
      case 'sensitive': return props.theme.colors.status.error;
      case 'third-party': return props.theme.colors.status.info;
      default: return props.theme.colors.border.secondary;
    }
  }};
  color: ${props => props.theme.colors.text.primary};
`;

const ConsentDescription = styled.p`
  font-size: 0.875rem;
  color: ${props => props.theme.colors.text.secondary};
  line-height: 1.5;
  margin: 0 0 1rem 0;
`;

const DetailedDescription = styled.div`
  font-size: 0.75rem;
  color: ${props => props.theme.colors.text.tertiary};
  line-height: 1.4;
  padding: 0.75rem;
  background: ${props => props.theme.colors.background.tertiary};
  border-radius: 4px;
  margin-bottom: 1rem;
`;

const ConsentDetails = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin-bottom: 1rem;
`;

const DetailItem = styled.div`
  font-size: 0.75rem;
  color: ${props => props.theme.colors.text.tertiary};
`;

const DetailLabel = styled.span`
  font-weight: 500;
  display: block;
  margin-bottom: 0.25rem;
`;

const DetailValue = styled.span`
  color: ${props => props.theme.colors.text.secondary};
`;

const ConsentToggle = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 1rem;
`;

const ToggleContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
`;

const ToggleLabel = styled.label`
  font-size: 0.875rem;
  color: ${props => props.theme.colors.text.primary};
  cursor: pointer;
`;

const ConsentActions = styled.div`
  display: flex;
  gap: 0.5rem;
`;

const ActionButton = styled.button`
  padding: 0.25rem 0.5rem;
  font-size: 0.75rem;
  background: none;
  border: 1px solid ${props => props.theme.colors.border.secondary};
  border-radius: 4px;
  color: ${props => props.theme.colors.text.secondary};
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    border-color: ${props => props.theme.colors.primary};
    color: ${props => props.theme.colors.primary};
  }
`;

const HistoryContainer = styled.div`
  margin-top: 2rem;
`;

const HistoryItem = styled.div`
  padding: 1rem;
  border: 1px solid ${props => props.theme.colors.border.secondary};
  border-radius: 6px;
  margin-bottom: 0.75rem;
  background: ${props => props.theme.colors.background.secondary};
`;

const HistoryHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
`;

const HistoryAction = styled.span<{ granted: boolean }>`
  font-weight: 500;
  color: ${props => props.granted ? props.theme.colors.status.success : props.theme.colors.status.error};
`;

const HistoryDate = styled.span`
  font-size: 0.75rem;
  color: ${props => props.theme.colors.text.tertiary};
`;

const HistoryDetails = styled.div`
  font-size: 0.75rem;
  color: ${props => props.theme.colors.text.secondary};
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 0.5rem;
`;

const HistoryMeta = styled.div`
  margin-top: 0.5rem;
`;

const ReasonText = styled.div`
  font-style: italic;
  color: ${props => props.theme.colors.text.tertiary};
  margin-top: 0.25rem;
`;

const LoadingSpinner = styled.div`
  display: inline-block;
  width: 20px;
  height: 20px;
  border: 2px solid ${props => props.theme.colors.border.secondary};
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
`;

const SuccessMessage = styled.div`
  padding: 1rem;
  background: ${props => props.theme.colors.status.success}20;
  border: 1px solid ${props => props.theme.colors.status.success};
  border-radius: 4px;
  color: ${props => props.theme.colors.status.success};
  margin: 1rem 0;
`;

const StatCard = styled.div`
  padding: 1rem;
  background: ${props => props.theme.colors.background.tertiary};
  border-radius: 6px;
  text-align: center;
`;

const StatValue = styled.div`
  font-size: 1.5rem;
  font-weight: 600;
  color: ${props => props.theme.colors.primary};
`;

const StatLabel = styled.div`
  font-size: 0.75rem;
  color: ${props => props.theme.colors.text.secondary};
  margin-top: 0.25rem;
`;

const ReviewNotice = styled.div`
  padding: 1rem;
  background: ${props => props.theme.colors.status.warning}20;
  border: 1px solid ${props => props.theme.colors.status.warning};
  border-radius: 8px;
  margin-bottom: 2rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const ReviewText = styled.div`
  flex: 1;
`;

const ReviewTitle = styled.h3`
  font-size: 1rem;
  font-weight: 500;
  color: ${props => props.theme.colors.text.primary};
  margin: 0 0 0.25rem 0;
`;

const ReviewDescription = styled.p`
  font-size: 0.875rem;
  color: ${props => props.theme.colors.text.secondary};
  margin: 0;
`;

const groupDescriptions = {
  essential: "These permissions are required for the application to function properly and cannot be disabled.",
  functional: "These permissions enhance your experience but are not strictly required for basic functionality.",
  analytics: "These permissions help us understand how you use the application to improve it for everyone.",
  telemetry: "These permissions collect technical data from the rover system for monitoring and analysis.",
};

export const EnhancedConsentSettings: React.FC<EnhancedConsentSettingsProps> = ({
  className,
  onConsentChange,
  showHistoryByDefault = false,
  enableContextualRequests = true
}) => {
  const theme = useTheme();
  const [activeTab, setActiveTab] = useState<'settings' | 'history' | 'analytics'>(
    showHistoryByDefault ? 'history' : 'settings'
  );
  const [consents, setConsents] = useState<Record<ConsentCategory, boolean>>({} as any);
  const [configurations, setConfigurations] = useState<ConsentConfiguration[]>([]);
  const [consentHistory, setConsentHistory] = useState<ConsentPreference[]>([]);
  const [statistics, setStatistics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showDetailedView, setShowDetailedView] = useState<ConsentCategory | null>(null);
  const [reviewStatus, setReviewStatus] = useState<any>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['essential']));

  // Group configurations by grouping
  const groupedConfigurations = useMemo(() => {
    return configurations.reduce((groups, config) => {
      const group = config.grouping || 'functional';
      if (!groups[group]) groups[group] = [];
      groups[group].push(config);
      return groups;
    }, {} as Record<string, ConsentConfiguration[]>);
  }, [configurations]);

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        await consentManager.initialize();
        
        const [currentConsents, configs, history, stats, review] = await Promise.all([
          consentManager.getAllConsents(),
          Promise.resolve(consentManager.getAllConsentConfigurations()),
          consentManager.getConsentHistory(),
          consentManager.getConsentStatistics(),
          consentManager.isConsentReviewDue()
        ]);
        
        setConsents(currentConsents);
        setConfigurations(configs);
        setConsentHistory(history);
        setStatistics(stats);
        setReviewStatus(review);
        setError(null);
      } catch (err) {
        console.error('Failed to load enhanced consent settings:', err);
        setError('Failed to load privacy settings. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Handle consent toggle with reason
  const handleConsentToggle = useCallback(async (
    category: ConsentCategory, 
    granted: boolean, 
    reason?: string
  ) => {
    const config = configurations.find(c => c.category === category);
    
    // Don't allow toggling required consents
    if (config?.required) {
      return;
    }

    try {
      setSaving(true);
      setError(null);
      
      await consentManager.updateConsent(category, granted, 'update', reason);
      
      // Update local state
      setConsents(prev => ({
        ...prev,
        [category]: granted
      }));
      
      // Refresh history
      const newHistory = await consentManager.getConsentHistory();
      setConsentHistory(newHistory);
      
      // Call callback if provided
      onConsentChange?.(category, granted);
      
      setSuccessMessage(`Privacy preference for "${config?.name}" updated successfully.`);
      setTimeout(() => setSuccessMessage(null), 3000);
      
    } catch (err) {
      console.error('Failed to update consent:', err);
      setError('Failed to update privacy preference. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [configurations, onConsentChange]);

  // Handle complete review
  const handleCompleteReview = useCallback(async () => {
    try {
      await consentManager.completeConsentReview();
      const newReview = await consentManager.isConsentReviewDue();
      setReviewStatus(newReview);
      setSuccessMessage('Privacy review completed successfully. Thank you for keeping your preferences up to date.');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      console.error('Failed to complete review:', err);
      setError('Failed to complete privacy review. Please try again.');
    }
  }, []);

  // Format retention period
  const formatRetentionPeriod = (days?: number): string => {
    if (days === undefined) return 'Not specified';
    if (days === -1) return 'Indefinite';
    if (days === 0) return 'Session only';
    if (days < 30) return `${days} days`;
    if (days < 365) return `${Math.round(days / 30)} months`;
    return `${Math.round(days / 365)} years`;
  };

  // Format date
  const formatDate = (date: Date | string): string => {
    const d = new Date(date);
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Toggle group expansion
  const toggleGroup = (groupName: string) => {
    setExpandedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(groupName)) {
        newSet.delete(groupName);
      } else {
        newSet.add(groupName);
      }
      return newSet;
    });
  };

  if (loading) {
    return (
      <Container className={className}>
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <LoadingSpinner />
          <p style={{ marginTop: '1rem', color: theme.colors.text.secondary }}>
            Loading enhanced privacy settings...
          </p>
        </div>
      </Container>
    );
  }

  return (
    <Container className={className}>
      <Header>
        <Title>Enhanced Privacy Settings</Title>
        <Subtitle>
          Comprehensive control over your data collection preferences with detailed explanations, 
          consent history, and granular options for different types of data.
        </Subtitle>
      </Header>

      {/* Review Notice */}
      {reviewStatus?.isDue && (
        <ReviewNotice>
          <ReviewText>
            <ReviewTitle>Privacy Review Due</ReviewTitle>
            <ReviewDescription>
              It's time to review your privacy settings. 
              {reviewStatus.daysOverdue > 0 && ` You're ${reviewStatus.daysOverdue} days overdue.`}
            </ReviewDescription>
          </ReviewText>
          <Button
            variant="primary"
            size="small"
            onClick={handleCompleteReview}
          >
            Review Now
          </Button>
        </ReviewNotice>
      )}

      {error && <ErrorMessage role="alert">{error}</ErrorMessage>}
      {successMessage && <SuccessMessage role="alert">{successMessage}</SuccessMessage>}

      <TabBar>
        <Tab 
          active={activeTab === 'settings'} 
          onClick={() => setActiveTab('settings')}
        >
          Privacy Settings
        </Tab>
        <Tab 
          active={activeTab === 'history'} 
          onClick={() => setActiveTab('history')}
        >
          Consent History
        </Tab>
        <Tab 
          active={activeTab === 'analytics'} 
          onClick={() => setActiveTab('analytics')}
        >
          Analytics & Insights
        </Tab>
      </TabBar>

      {/* Settings Tab */}
      {activeTab === 'settings' && (
        <div>
          {Object.entries(groupedConfigurations).map(([groupName, configs]) => (
            <GroupContainer key={groupName}>
              <GroupTitle>
                <button
                  onClick={() => toggleGroup(groupName)}
                  style={{ 
                    background: 'none', 
                    border: 'none', 
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    color: theme.colors.text.primary,
                    fontSize: '1.25rem',
                    fontWeight: 500
                  }}
                >
                  {expandedGroups.has(groupName) ? '▼' : '▶'} 
                  {groupName.charAt(0).toUpperCase() + groupName.slice(1)} 
                  ({configs.length})
                </button>
              </GroupTitle>
              
              <GroupDescription>
                {groupDescriptions[groupName as keyof typeof groupDescriptions]}
              </GroupDescription>

              {expandedGroups.has(groupName) && configs.map(config => (
                <ConsentItem 
                  key={config.category} 
                  required={config.required}
                  sensitive={config.sensitive}
                >
                  <ConsentHeader>
                    <ConsentName>{config.name}</ConsentName>
                    <BadgeContainer>
                      {config.required && <Badge variant="required">Required</Badge>}
                      {config.sensitive && <Badge variant="sensitive">Sensitive</Badge>}
                      {config.thirdParties && config.thirdParties.length > 0 && (
                        <Badge variant="third-party">Third Party</Badge>
                      )}
                    </BadgeContainer>
                  </ConsentHeader>
                  
                  <ConsentDescription>{config.description}</ConsentDescription>
                  
                  {showDetailedView === config.category && (
                    <DetailedDescription>
                      <strong>Detailed Information:</strong><br />
                      {config.detailedDescription}
                      <br /><br />
                      <strong>Data Types:</strong> {config.dataTypes.join(', ')}<br />
                      <strong>Purposes:</strong> {config.purposes.join(', ')}<br />
                      {config.benefits && (
                        <>
                          <strong>Benefits:</strong> {config.benefits}<br />
                        </>
                      )}
                      {config.consequences && (
                        <>
                          <strong>If disabled:</strong> {config.consequences}
                        </>
                      )}
                    </DetailedDescription>
                  )}
                  
                  <ConsentDetails>
                    <DetailItem>
                      <DetailLabel>Legal Basis</DetailLabel>
                      <DetailValue>{config.legalBasis.replace('_', ' ')}</DetailValue>
                    </DetailItem>
                    <DetailItem>
                      <DetailLabel>Data Retention</DetailLabel>
                      <DetailValue>{formatRetentionPeriod(config.dataRetentionDays)}</DetailValue>
                    </DetailItem>
                    <DetailItem>
                      <DetailLabel>Child Safe</DetailLabel>
                      <DetailValue>{config.childSafe ? 'Yes' : 'No'}</DetailValue>
                    </DetailItem>
                    {config.thirdParties && config.thirdParties.length > 0 && (
                      <DetailItem>
                        <DetailLabel>Third Parties</DetailLabel>
                        <DetailValue>{config.thirdParties.join(', ')}</DetailValue>
                      </DetailItem>
                    )}
                  </ConsentDetails>
                  
                  <ConsentToggle>
                    <ToggleContainer>
                      <ToggleLabel htmlFor={`consent-${config.category}`}>
                        {config.required ? 'Required for operation' : 'Enable data collection'}
                      </ToggleLabel>
                      
                      <Toggle
                        id={`consent-${config.category}`}
                        checked={consents[config.category] || false}
                        onChange={(checked) => handleConsentToggle(config.category, checked)}
                        disabled={config.required || saving}
                        aria-describedby={`consent-${config.category}-description`}
                      />
                    </ToggleContainer>
                    
                    <ConsentActions>
                      <ActionButton
                        onClick={() => setShowDetailedView(
                          showDetailedView === config.category ? null : config.category
                        )}
                      >
                        {showDetailedView === config.category ? 'Hide Details' : 'Show Details'}
                      </ActionButton>
                    </ConsentActions>
                  </ConsentToggle>
                </ConsentItem>
              ))}
            </GroupContainer>
          ))}
        </div>
      )}

      {/* History Tab */}
      {activeTab === 'history' && (
        <HistoryContainer>
          <h2>Consent Change History</h2>
          <p style={{ color: theme.colors.text.secondary, marginBottom: '1.5rem' }}>
            A complete record of all changes to your privacy preferences.
          </p>
          
          {consentHistory.length === 0 ? (
            <p style={{ color: theme.colors.text.secondary, textAlign: 'center', padding: '2rem' }}>
              No consent changes recorded yet.
            </p>
          ) : (
            consentHistory.map(item => {
              const config = configurations.find(c => c.category === item.category);
              return (
                <HistoryItem key={item.id}>
                  <HistoryHeader>
                    <div>
                      <strong>{config?.name || item.category}</strong> - {' '}
                      <HistoryAction granted={item.granted}>
                        {item.granted ? 'Granted' : 'Withdrawn'}
                      </HistoryAction>
                    </div>
                    <HistoryDate>{formatDate(item.timestamp)}</HistoryDate>
                  </HistoryHeader>
                  
                  <HistoryDetails>
                    <div><strong>Source:</strong> {item.source.replace('_', ' ')}</div>
                    <div><strong>Policy Version:</strong> {item.version}</div>
                    {item.userAgent && (
                      <div><strong>Browser:</strong> {item.userAgent.substring(0, 50)}...</div>
                    )}
                  </HistoryDetails>
                  
                  {item.reasonForChange && (
                    <HistoryMeta>
                      <ReasonText>Reason: {item.reasonForChange}</ReasonText>
                    </HistoryMeta>
                  )}
                </HistoryItem>
              );
            })
          )}
        </HistoryContainer>
      )}

      {/* Analytics Tab */}
      {activeTab === 'analytics' && statistics && (
        <div>
          <h2>Privacy Analytics</h2>
          <p style={{ color: theme.colors.text.secondary, marginBottom: '1.5rem' }}>
            Insights into your privacy preferences and consent patterns.
          </p>
          
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
            gap: '1rem',
            marginBottom: '2rem'
          }}>
            <StatCard>
              <StatValue>{statistics.totalChanges}</StatValue>
              <StatLabel>Total Changes</StatLabel>
            </StatCard>
            <StatCard>
              <StatValue>{statistics.categoriesWithConsent}</StatValue>
              <StatLabel>Categories Enabled</StatLabel>
            </StatCard>
            <StatCard>
              <StatValue>{statistics.categoriesWithoutConsent}</StatValue>
              <StatLabel>Categories Disabled</StatLabel>
            </StatCard>
            <StatCard>
              <StatValue>
                {statistics.lastChanged ? formatDate(statistics.lastChanged).split(' ')[0] : 'Never'}
              </StatValue>
              <StatLabel>Last Updated</StatLabel>
            </StatCard>
          </div>

          {statistics.mostChangedCategory && (
            <Card style={{ marginBottom: '1rem' }}>
              <h3>Most Frequently Changed</h3>
              <p>
                <strong>{configurations.find(c => c.category === statistics.mostChangedCategory)?.name}</strong>
                {' '}has been modified the most times.
              </p>
            </Card>
          )}

          <Card>
            <h3>Changes by Source</h3>
            {Object.entries(statistics.changesBySource).map(([source, count]) => (
              <div key={source} style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                padding: '0.5rem 0',
                borderBottom: `1px solid ${theme.colors.border.secondary}`
              }}>
                <span>{source.replace('_', ' ')}</span>
                <span>{count as number}</span>
              </div>
            ))}
          </Card>
        </div>
      )}

      {/* Detailed View Modal */}
      {showDetailedView && (
        <Modal
          isOpen={!!showDetailedView}
          onClose={() => setShowDetailedView(null)}
          title="Consent Details"
          size="large"
        >
          {(() => {
            const config = configurations.find(c => c.category === showDetailedView);
            if (!config) return null;
            
            return (
              <div>
                <h2>{config.name}</h2>
                <p>{config.detailedDescription}</p>
                
                <h3>Data Collection Details</h3>
                <ul>
                  {config.dataTypes.map(type => (
                    <li key={type}>{type}</li>
                  ))}
                </ul>
                
                <h3>Purposes</h3>
                <ul>
                  {config.purposes.map(purpose => (
                    <li key={purpose}>{purpose}</li>
                  ))}
                </ul>
                
                {config.benefits && (
                  <>
                    <h3>Benefits to You</h3>
                    <p>{config.benefits}</p>
                  </>
                )}
                
                {config.consequences && (
                  <>
                    <h3>If You Decline</h3>
                    <p>{config.consequences}</p>
                  </>
                )}
              </div>
            );
          })()}
        </Modal>
      )}
    </Container>
  );
};