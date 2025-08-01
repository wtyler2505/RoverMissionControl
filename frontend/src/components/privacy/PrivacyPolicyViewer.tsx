/**
 * Privacy Policy Viewer Component
 * Displays privacy policies with version comparison and acknowledgment features
 */

import React, { useState, useEffect, useCallback } from 'react';
import styled from '@emotion/styled';
import { useTheme } from '@emotion/react';
import { 
  PrivacyPolicy, 
  PolicyComparison, 
  PolicySection,
  privacyPolicyService 
} from '../../services/privacy/PrivacyPolicyService';
import { Card } from '../ui/core/Card';
import { Button } from '../ui/core/Button';
import { Modal } from '../ui/core/Modal';

interface PrivacyPolicyViewerProps {
  policyId?: string;
  showVersionSelector?: boolean;
  showAcknowledgmentButton?: boolean;
  userId?: string;
  onAcknowledgment?: (policyId: string) => void;
  className?: string;
}

const Container = styled.div`
  max-width: 900px;
  margin: 0 auto;
  padding: 2rem;
`;

const Header = styled.div`
  margin-bottom: 2rem;
  padding-bottom: 1rem;
  border-bottom: 2px solid ${props => props.theme.colors.border.primary};
`;

const PolicyTitle = styled.h1`
  font-size: 2.5rem;
  font-weight: 700;
  color: ${props => props.theme.colors.text.primary};
  margin-bottom: 0.5rem;
`;

const PolicyMeta = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  align-items: center;
  margin-bottom: 1rem;
`;

const MetaItem = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: ${props => props.theme.colors.text.secondary};
`;

const MetaLabel = styled.span`
  font-weight: 500;
`;

const VersionBadge = styled.span<{ isActive?: boolean }>`
  padding: 0.25rem 0.75rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 500;
  background: ${props => props.isActive 
    ? props.theme.colors.status.success 
    : props.theme.colors.background.tertiary};
  color: ${props => props.isActive 
    ? props.theme.colors.text.primary 
    : props.theme.colors.text.secondary};
`;

const RequiredBadge = styled.span`
  padding: 0.25rem 0.75rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 500;
  background: ${props => props.theme.colors.status.warning};
  color: ${props => props.theme.colors.text.primary};
`;

const VersionSelector = styled.div`
  margin-bottom: 2rem;
`;

const VersionGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 1rem;
  margin-top: 1rem;
`;

const VersionCard = styled(Card)<{ isSelected?: boolean }>`
  cursor: pointer;
  border: 2px solid ${props => props.isSelected 
    ? props.theme.colors.primary 
    : 'transparent'};
  transition: all 0.2s ease;
  
  &:hover {
    border-color: ${props => props.theme.colors.primary};
    transform: translateY(-2px);
  }
`;

const PlainLanguageSummary = styled.div`
  background: ${props => props.theme.colors.background.tertiary};
  border: 1px solid ${props => props.theme.colors.border.secondary};
  border-radius: 8px;
  padding: 1.5rem;
  margin-bottom: 2rem;
`;

const SummaryTitle = styled.h3`
  font-size: 1.125rem;
  font-weight: 600;
  color: ${props => props.theme.colors.text.primary};
  margin-bottom: 0.75rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const SummaryIcon = styled.span`
  font-size: 1.25rem;
`;

const PolicyContent = styled.div`
  line-height: 1.7;
  color: ${props => props.theme.colors.text.primary};
  
  h1, h2, h3, h4, h5, h6 {
    margin-top: 2rem;
    margin-bottom: 1rem;
    font-weight: 600;
    color: ${props => props.theme.colors.text.primary};
  }
  
  h1 { font-size: 2rem; }
  h2 { font-size: 1.5rem; }
  h3 { font-size: 1.25rem; }
  
  p {
    margin-bottom: 1rem;
  }
  
  ul, ol {
    margin-bottom: 1rem;
    padding-left: 1.5rem;
  }
  
  li {
    margin-bottom: 0.5rem;
  }
  
  strong {
    font-weight: 600;
  }
  
  em {
    font-style: italic;
  }
`;

const SectionNavigation = styled.nav`
  position: sticky;
  top: 2rem;
  background: ${props => props.theme.colors.background.secondary};
  border: 1px solid ${props => props.theme.colors.border.secondary};
  border-radius: 8px;
  padding: 1rem;
  margin-bottom: 2rem;
`;

const SectionNavTitle = styled.h3`
  font-size: 1rem;
  font-weight: 600;
  color: ${props => props.theme.colors.text.primary};
  margin-bottom: 0.75rem;
`;

const SectionNavList = styled.ul`
  list-style: none;
  padding: 0;
  margin: 0;
`;

const SectionNavItem = styled.li<{ isActive?: boolean }>`
  margin-bottom: 0.25rem;
`;

const SectionNavLink = styled.button<{ isActive?: boolean }>`
  display: block;
  width: 100%;
  text-align: left;
  padding: 0.5rem 0.75rem;
  border: none;
  background: ${props => props.isActive 
    ? props.theme.colors.primary + '20' 
    : 'transparent'};
  color: ${props => props.isActive 
    ? props.theme.colors.primary 
    : props.theme.colors.text.secondary};
  border-radius: 4px;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    background: ${props => props.theme.colors.primary + '20'};
    color: ${props => props.theme.colors.primary};
  }
`;

const PolicySection = styled.section`
  margin-bottom: 3rem;
  scroll-margin-top: 2rem;
`;

const SectionHeader = styled.div`
  margin-bottom: 1rem;
`;

const SectionTitle = styled.h2`
  font-size: 1.5rem;
  font-weight: 600;
  color: ${props => props.theme.colors.text.primary};
  margin-bottom: 0.5rem;
`;

const SectionMeta = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  font-size: 0.75rem;
  color: ${props => props.theme.colors.text.tertiary};
`;

const AcknowledgmentSection = styled.div`
  margin-top: 3rem;
  padding: 2rem;
  background: ${props => props.theme.colors.background.tertiary};
  border: 1px solid ${props => props.theme.colors.border.secondary};
  border-radius: 8px;
  text-align: center;
`;

const ComparisonButton = styled(Button)`
  margin-left: 1rem;
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

export const PrivacyPolicyViewer: React.FC<PrivacyPolicyViewerProps> = ({
  policyId,
  showVersionSelector = true,
  showAcknowledgmentButton = false,
  userId,
  onAcknowledgment,
  className
}) => {
  const theme = useTheme();
  const [policy, setPolicy] = useState<PrivacyPolicy | null>(null);
  const [allVersions, setAllVersions] = useState<PrivacyPolicy[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acknowledging, setAcknowledging] = useState(false);
  const [showComparison, setShowComparison] = useState(false);
  const [comparisonData, setComparisonData] = useState<PolicyComparison | null>(null);

  // Load policy data
  useEffect(() => {
    const loadPolicy = async () => {
      try {
        setLoading(true);
        setError(null);

        if (policyId) {
          const policyData = await privacyPolicyService.getPolicyById(policyId);
          setPolicy(policyData);
          setSelectedVersion(policyData.version);
        } else {
          const activePolicy = await privacyPolicyService.getActivePolicy();
          if (activePolicy) {
            setPolicy(activePolicy);
            setSelectedVersion(activePolicy.version);
          }
        }

        if (showVersionSelector) {
          const versions = await privacyPolicyService.getPolicyVersions();
          setAllVersions(versions);
        }
      } catch (err) {
        console.error('Failed to load policy:', err);
        setError('Failed to load privacy policy. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    loadPolicy();
  }, [policyId, showVersionSelector]);

  // Handle version selection
  const handleVersionSelect = useCallback(async (version: string) => {
    const selectedPolicy = allVersions.find(p => p.version === version);
    if (selectedPolicy) {
      setPolicy(selectedPolicy);
      setSelectedVersion(version);
      privacyPolicyService.setLastViewedPolicyVersion(version);
    }
  }, [allVersions]);

  // Handle section navigation
  const handleSectionClick = useCallback((sectionKey: string) => {
    setActiveSection(sectionKey);
    privacyPolicyService.scrollToSection(sectionKey);
  }, []);

  // Handle policy acknowledgment
  const handleAcknowledgment = useCallback(async () => {
    if (!policy || !userId) return;

    try {
      setAcknowledging(true);
      const success = await privacyPolicyService.acknowledgePolicy(
        policy.id, 
        'privacy_viewer', 
        userId
      );
      
      if (success) {
        onAcknowledgment?.(policy.id);
        privacyPolicyService.announceToScreenReader(
          'Privacy policy acknowledged successfully'
        );
      }
    } catch (err) {
      console.error('Failed to acknowledge policy:', err);
      setError('Failed to acknowledge policy. Please try again.');
    } finally {
      setAcknowledging(false);
    }
  }, [policy, userId, onAcknowledgment]);

  // Handle policy comparison
  const handleCompareVersions = useCallback(async () => {
    if (!policy || allVersions.length < 2) return;

    try {
      const activeVersion = allVersions.find(v => v.is_active)?.version;
      if (!activeVersion || activeVersion === policy.version) return;

      const comparison = await privacyPolicyService.comparePolicies(
        activeVersion,
        policy.version
      );
      setComparisonData(comparison);
      setShowComparison(true);
    } catch (err) {
      console.error('Failed to compare policies:', err);
      setError('Failed to compare policy versions.');
    }
  }, [policy, allVersions]);

  // Scroll spy for active section
  useEffect(() => {
    const handleScroll = () => {
      if (!policy?.sections) return;

      const sections = policy.sections.map(s => s.section_key);
      const currentSection = sections.find(sectionKey => {
        const element = document.getElementById(sectionKey);
        if (element) {
          const rect = element.getBoundingClientRect();
          return rect.top <= 100 && rect.bottom > 100;
        }
        return false;
      });

      if (currentSection && currentSection !== activeSection) {
        setActiveSection(currentSection);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [policy, activeSection]);

  if (loading) {
    return (
      <Container className={className}>
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <LoadingSpinner />
          <p style={{ marginTop: '1rem', color: theme.colors.text.secondary }}>
            Loading privacy policy...
          </p>
        </div>
      </Container>
    );
  }

  if (error) {
    return (
      <Container className={className}>
        <ErrorMessage role="alert">{error}</ErrorMessage>
      </Container>
    );
  }

  if (!policy) {
    return (
      <Container className={className}>
        <p style={{ textAlign: 'center', color: theme.colors.text.secondary }}>
          No privacy policy found.
        </p>
      </Container>
    );
  }

  return (
    <Container className={className}>
      <Header>
        <PolicyTitle>{policy.title}</PolicyTitle>
        
        <PolicyMeta>
          <MetaItem>
            <MetaLabel>Version:</MetaLabel>
            <VersionBadge isActive={policy.is_active}>
              {policy.version}
            </VersionBadge>
          </MetaItem>
          
          <MetaItem>
            <MetaLabel>Effective Date:</MetaLabel>
            {privacyPolicyService.formatDate(policy.effective_date)}
          </MetaItem>
          
          <MetaItem>
            <MetaLabel>Language:</MetaLabel>
            {policy.language.toUpperCase()}
          </MetaItem>
          
          {policy.requires_acknowledgment && (
            <RequiredBadge>Acknowledgment Required</RequiredBadge>
          )}
        </PolicyMeta>

        {showVersionSelector && allVersions.length > 1 && (
          <ComparisonButton
            variant="secondary"
            size="small"
            onClick={handleCompareVersions}
          >
            Compare Versions
          </ComparisonButton>
        )}
      </Header>

      {showVersionSelector && allVersions.length > 1 && (
        <VersionSelector>
          <h3 style={{ marginBottom: '1rem' }}>Available Versions</h3>
          <VersionGrid>
            {allVersions.map((version) => (
              <VersionCard
                key={version.id}
                isSelected={selectedVersion === version.version}
                onClick={() => handleVersionSelect(version.version)}
              >
                <div style={{ padding: '1rem' }}>
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    marginBottom: '0.5rem'
                  }}>
                    <strong>{version.version}</strong>
                    {version.is_active && <VersionBadge isActive>Active</VersionBadge>}
                  </div>
                  <p style={{ 
                    fontSize: '0.875rem', 
                    color: theme.colors.text.secondary,
                    margin: 0
                  }}>
                    {privacyPolicyService.formatDate(version.effective_date)}
                  </p>
                </div>
              </VersionCard>
            ))}
          </VersionGrid>
        </VersionSelector>
      )}

      {policy.plain_language_summary && (
        <PlainLanguageSummary>
          <SummaryTitle>
            <SummaryIcon>📝</SummaryIcon>
            Summary in Plain Language
          </SummaryTitle>
          <p style={{ margin: 0, color: theme.colors.text.primary }}>
            {policy.plain_language_summary}
          </p>
        </PlainLanguageSummary>
      )}

      {policy.sections && policy.sections.length > 0 && (
        <SectionNavigation>
          <SectionNavTitle>Contents</SectionNavTitle>
          <SectionNavList>
            {policy.sections
              .sort((a, b) => a.order_index - b.order_index)
              .map((section) => (
                <SectionNavItem key={section.section_key}>
                  <SectionNavLink
                    isActive={activeSection === section.section_key}
                    onClick={() => handleSectionClick(section.section_key)}
                  >
                    {section.title}
                  </SectionNavLink>
                </SectionNavItem>
              ))}
          </SectionNavList>
        </SectionNavigation>
      )}

      <PolicyContent>
        {policy.sections && policy.sections.length > 0 ? (
          policy.sections
            .sort((a, b) => a.order_index - b.order_index)
            .map((section) => (
              <PolicySection
                key={section.section_key}
                id={section.section_key}
              >
                <SectionHeader>
                  <SectionTitle>{section.title}</SectionTitle>
                  <SectionMeta>
                    {section.gdpr_article && (
                      <span>GDPR {section.gdpr_article}</span>
                    )}
                    {section.legal_basis && (
                      <span>Legal Basis: {section.legal_basis.replace('_', ' ')}</span>
                    )}
                  </SectionMeta>
                </SectionHeader>
                
                {section.plain_language_summary && (
                  <div style={{ 
                    background: theme.colors.background.tertiary,
                    padding: '1rem',
                    borderRadius: '4px',
                    marginBottom: '1rem',
                    fontStyle: 'italic'
                  }}>
                    <strong>In simple terms:</strong> {section.plain_language_summary}
                  </div>
                )}
                
                <div
                  dangerouslySetInnerHTML={{
                    __html: privacyPolicyService.parseMarkdown(section.content)
                  }}
                />
              </PolicySection>
            ))
        ) : (
          <div
            dangerouslySetInnerHTML={{
              __html: privacyPolicyService.parseMarkdown(policy.content)
            }}
          />
        )}
      </PolicyContent>

      {showAcknowledgmentButton && userId && policy.requires_acknowledgment && (
        <AcknowledgmentSection>
          <h3 style={{ marginBottom: '1rem' }}>
            Acknowledgment Required
          </h3>
          <p style={{ 
            marginBottom: '1.5rem', 
            color: theme.colors.text.secondary 
          }}>
            By clicking "I Acknowledge", you confirm that you have read and 
            understood this privacy policy.
          </p>
          <Button
            variant="primary"
            size="large"
            onClick={handleAcknowledgment}
            disabled={acknowledging}
          >
            {acknowledging ? <LoadingSpinner /> : 'I Acknowledge'}
          </Button>
        </AcknowledgmentSection>
      )}

      {/* Policy Comparison Modal */}
      <Modal
        isOpen={showComparison}
        onClose={() => setShowComparison(false)}
        title="Policy Version Comparison"
        maxWidth="800px"
      >
        {comparisonData && (
          <div>
            <div style={{ marginBottom: '2rem' }}>
              <h4>Comparing {comparisonData.from_version} → {comparisonData.to_version}</h4>
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '1rem',
                marginTop: '1rem'
              }}>
                <div>
                  <strong>Total Changes:</strong> {comparisonData.total_changes}
                </div>
                <div>
                  <strong>Requires Acknowledgment:</strong> {comparisonData.requires_acknowledgment ? 'Yes' : 'No'}
                </div>
                <div>
                  <strong>Sections Modified:</strong> {comparisonData.sections_modified.length}
                </div>
              </div>
            </div>

            <div style={{ marginBottom: '2rem' }}>
              <h5>Changes by Impact Level</h5>
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                {Object.entries(comparisonData.changes_by_impact).map(([impact, count]) => (
                  <span
                    key={impact}
                    style={{
                      padding: '0.25rem 0.75rem',
                      borderRadius: '9999px',
                      fontSize: '0.875rem',
                      background: privacyPolicyService.getImpactLevelColor(impact) + '20',
                      color: privacyPolicyService.getImpactLevelColor(impact)
                    }}
                  >
                    {impact}: {count}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <h5>Detailed Changes</h5>
              <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                {comparisonData.detailed_changes.map((change, index) => (
                  <div
                    key={index}
                    style={{
                      padding: '1rem',
                      border: `1px solid ${theme.colors.border.secondary}`,
                      borderRadius: '4px',
                      marginBottom: '1rem'
                    }}
                  >
                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '0.5rem'
                    }}>
                      <strong>{change.section_key || 'General'}</strong>
                      <span
                        style={{
                          padding: '0.25rem 0.5rem',
                          borderRadius: '9999px',
                          fontSize: '0.75rem',
                          background: privacyPolicyService.getImpactLevelColor(change.impact_level) + '20',
                          color: privacyPolicyService.getImpactLevelColor(change.impact_level)
                        }}
                      >
                        {change.impact_level}
                      </span>
                    </div>
                    <p style={{ margin: 0 }}>
                      {change.plain_language_description || change.change_description}
                    </p>
                    {change.requires_consent && (
                      <div style={{ 
                        marginTop: '0.5rem',
                        color: theme.colors.status.warning,
                        fontSize: '0.875rem'
                      }}>
                        ⚠️ This change requires your consent
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </Container>
  );
};