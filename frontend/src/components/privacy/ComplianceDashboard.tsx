/**
 * Compliance Dashboard Component
 * Administrative dashboard for monitoring privacy compliance status
 */

import React, { useState, useEffect, useCallback } from 'react';
import styled from '@emotion/styled';
import { useTheme } from '@emotion/react';
import { 
  ComplianceDashboard as ComplianceDashboardData,
  ComplianceMetric,
  privacyPolicyService 
} from '../../services/privacy/PrivacyPolicyService';
import { Card } from '../ui/core/Card';
import { Button } from '../ui/core/Button';

interface ComplianceDashboardProps {
  className?: string;
  onMetricClick?: (metric: ComplianceMetric) => void;
  refreshInterval?: number; // Auto-refresh interval in milliseconds
}

const Container = styled.div`
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
`;

const Header = styled.div`
  margin-bottom: 3rem;
`;

const Title = styled.h1`
  font-size: 2.5rem;
  font-weight: 700;
  color: ${props => props.theme.colors.text.primary};
  margin-bottom: 0.5rem;
`;

const Subtitle = styled.p`
  font-size: 1.125rem;
  color: ${props => props.theme.colors.text.secondary};
  margin-bottom: 1.5rem;
`;

const RefreshBar = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  background: ${props => props.theme.colors.background.tertiary};
  border: 1px solid ${props => props.theme.colors.border.secondary};
  border-radius: 8px;
  margin-bottom: 2rem;
`;

const LastUpdated = styled.span`
  font-size: 0.875rem;
  color: ${props => props.theme.colors.text.secondary};
`;

const OverviewGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1.5rem;
  margin-bottom: 3rem;
`;

const MetricCard = styled(Card)<{ status?: string }>`
  position: relative;
  overflow: hidden;
  
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 4px;
    background: ${props => {
      const colors = {
        'compliant': props.theme.colors.status.success,
        'partial': props.theme.colors.status.warning,
        'non_compliant': props.theme.colors.status.error,
        'pending_review': props.theme.colors.status.info
      };
      return colors[props.status as keyof typeof colors] || props.theme.colors.border.secondary;
    }};
  }
`;

const MetricHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1rem;
`;

const MetricTitle = styled.h3`
  font-size: 1rem;
  font-weight: 600;
  color: ${props => props.theme.colors.text.primary};
  margin: 0;
`;

const MetricIcon = styled.div<{ status?: string }>`
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.125rem;
  background: ${props => {
    const colors = {
      'compliant': props.theme.colors.status.success + '20',
      'partial': props.theme.colors.status.warning + '20',
      'non_compliant': props.theme.colors.status.error + '20',
      'pending_review': props.theme.colors.status.info + '20'
    };
    return colors[props.status as keyof typeof colors] || props.theme.colors.background.tertiary;
  }};
  color: ${props => {
    const colors = {
      'compliant': props.theme.colors.status.success,
      'partial': props.theme.colors.status.warning,
      'non_compliant': props.theme.colors.status.error,
      'pending_review': props.theme.colors.status.info
    };
    return colors[props.status as keyof typeof colors] || props.theme.colors.text.secondary;
  }};
`;

const MetricValue = styled.div`
  font-size: 2rem;
  font-weight: 700;
  color: ${props => props.theme.colors.text.primary};
  margin-bottom: 0.25rem;
`;

const MetricLabel = styled.div`
  font-size: 0.875rem;
  color: ${props => props.theme.colors.text.secondary};
`;

const StatusBadge = styled.span<{ status?: string }>`
  padding: 0.25rem 0.75rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 500;
  text-transform: uppercase;
  background: ${props => privacyPolicyService.getComplianceStatusColor(props.status || 'compliant') + '20'};
  color: ${props => privacyPolicyService.getComplianceStatusColor(props.status || 'compliant')};
`;

const DetailSection = styled.div`
  margin-bottom: 3rem;
`;

const SectionTitle = styled.h2`
  font-size: 1.5rem;
  font-weight: 600;
  color: ${props => props.theme.colors.text.primary};
  margin-bottom: 1.5rem;
`;

const CategoryGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1.5rem;
  margin-bottom: 3rem;
`;

const CategoryCard = styled(Card)`
  padding: 1.5rem;
`;

const CategoryHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
`;

const CategoryTitle = styled.h3`
  font-size: 1.125rem;
  font-weight: 600;
  color: ${props => props.theme.colors.text.primary};
  margin: 0;
  text-transform: uppercase;
`;

const CategoryStats = styled.div`
  display: flex;
  gap: 0.5rem;
`;

const StatItem = styled.div<{ status?: string }>`
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 500;
  background: ${props => privacyPolicyService.getComplianceStatusColor(props.status || 'compliant') + '20'};
  color: ${props => privacyPolicyService.getComplianceStatusColor(props.status || 'compliant')};
`;

const RecentChanges = styled.div`
  margin-bottom: 3rem;
`;

const ChangesList = styled.div`
  max-height: 400px;
  overflow-y: auto;
`;

const ChangeItem = styled.div`
  padding: 1rem;
  border: 1px solid ${props => props.theme.colors.border.secondary};
  border-radius: 8px;
  margin-bottom: 1rem;
  background: ${props => props.theme.colors.background.secondary};
`;

const ChangeHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 0.5rem;
`;

const ChangeDescription = styled.div`
  flex: 1;
`;

const ChangeTitle = styled.div`
  font-weight: 600;
  color: ${props => props.theme.colors.text.primary};
  margin-bottom: 0.25rem;
`;

const ChangeDate = styled.div`
  font-size: 0.875rem;
  color: ${props => props.theme.colors.text.secondary};
`;

const ChangeMeta = styled.div`
  display: flex;
  gap: 1rem;
  margin-top: 0.5rem;
`;

const ImpactBadge = styled.span<{ impact?: string }>`
  padding: 0.25rem 0.5rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 500;
  background: ${props => privacyPolicyService.getImpactLevelColor(props.impact || 'low') + '20'};
  color: ${props => privacyPolicyService.getImpactLevelColor(props.impact || 'low')};
`;

const ConsentRequired = styled.span`
  padding: 0.25rem 0.5rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 500;
  background: ${props => props.theme.colors.status.warning + '20'};
  color: ${props => props.theme.colors.status.warning};
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

const EmptyState = styled.div`
  text-align: center;
  padding: 3rem;
  color: ${props => props.theme.colors.text.secondary};
`;

export const ComplianceDashboard: React.FC<ComplianceDashboardProps> = ({
  className,
  onMetricClick,
  refreshInterval = 300000 // 5 minutes default
}) => {
  const theme = useTheme();
  const [dashboard, setDashboard] = useState<ComplianceDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Load dashboard data
  const loadDashboard = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const data = await privacyPolicyService.getComplianceDashboard();
      setDashboard(data);
    } catch (err) {
      console.error('Failed to load compliance dashboard:', err);
      setError('Failed to load compliance dashboard. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  // Auto-refresh
  useEffect(() => {
    if (refreshInterval <= 0) return;

    const interval = setInterval(() => {
      loadDashboard(true);
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [loadDashboard, refreshInterval]);

  // Manual refresh
  const handleRefresh = useCallback(() => {
    loadDashboard(true);
  }, [loadDashboard]);

  // Get status icon
  const getStatusIcon = (status: string): string => {
    const icons = {
      'compliant': '✅',
      'partial': '⚠️',
      'non_compliant': '❌',
      'pending_review': '📋'
    };
    return icons[status as keyof typeof icons] || '❓';
  };

  // Get status label
  const getStatusLabel = (status: string): string => {
    const labels = {
      'compliant': 'Compliant',
      'partial': 'Partially Compliant',
      'non_compliant': 'Non-Compliant',
      'pending_review': 'Pending Review'
    };
    return labels[status as keyof typeof labels] || status;
  };

  if (loading) {
    return (
      <Container className={className}>
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <LoadingSpinner />
          <p style={{ marginTop: '1rem', color: theme.colors.text.secondary }}>
            Loading compliance dashboard...
          </p>
        </div>
      </Container>
    );
  }

  if (error) {
    return (
      <Container className={className}>
        <ErrorMessage role="alert">{error}</ErrorMessage>
        <Button onClick={() => loadDashboard()}>Retry</Button>
      </Container>
    );
  }

  if (!dashboard) {
    return (
      <Container className={className}>
        <EmptyState>No compliance data available.</EmptyState>
      </Container>
    );
  }

  return (
    <Container className={className}>
      <Header>
        <Title>Compliance Dashboard</Title>
        <Subtitle>
          Monitor privacy compliance status and recent changes
        </Subtitle>
        
        <RefreshBar>
          <LastUpdated>
            Last updated: {privacyPolicyService.formatDateTime(dashboard.last_updated)}
          </LastUpdated>
          <Button
            variant="secondary"
            size="small"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            {refreshing ? <LoadingSpinner /> : 'Refresh'}
          </Button>
        </RefreshBar>
      </Header>

      {/* Overall Status Overview */}
      <OverviewGrid>
        <MetricCard status={dashboard.overall_status}>
          <div style={{ padding: '1.5rem' }}>
            <MetricHeader>
              <MetricTitle>Overall Status</MetricTitle>
              <MetricIcon status={dashboard.overall_status}>
                {getStatusIcon(dashboard.overall_status)}
              </MetricIcon>
            </MetricHeader>
            <StatusBadge status={dashboard.overall_status}>
              {getStatusLabel(dashboard.overall_status)}
            </StatusBadge>
          </div>
        </MetricCard>

        <MetricCard status="compliant">
          <div style={{ padding: '1.5rem' }}>
            <MetricHeader>
              <MetricTitle>Total Metrics</MetricTitle>
              <MetricIcon status="compliant">📊</MetricIcon>
            </MetricHeader>
            <MetricValue>{dashboard.total_metrics}</MetricValue>
            <MetricLabel>Monitored metrics</MetricLabel>
          </div>
        </MetricCard>

        <MetricCard status="compliant">
          <div style={{ padding: '1.5rem' }}>
            <MetricHeader>
              <MetricTitle>Compliant</MetricTitle>
              <MetricIcon status="compliant">✅</MetricIcon>
            </MetricHeader>
            <MetricValue>{dashboard.compliant_metrics}</MetricValue>
            <MetricLabel>
              {dashboard.total_metrics > 0 
                ? `${Math.round((dashboard.compliant_metrics / dashboard.total_metrics) * 100)}% of total`
                : 'No metrics'
              }
            </MetricLabel>
          </div>
        </MetricCard>

        <MetricCard status="non_compliant">
          <div style={{ padding: '1.5rem' }}>
            <MetricHeader>
              <MetricTitle>Non-Compliant</MetricTitle>
              <MetricIcon status="non_compliant">❌</MetricIcon>
            </MetricHeader>
            <MetricValue>{dashboard.non_compliant_metrics}</MetricValue>
            <MetricLabel>Require attention</MetricLabel>
          </div>
        </MetricCard>

        <MetricCard status="pending_review">
          <div style={{ padding: '1.5rem' }}>
            <MetricHeader>
              <MetricTitle>Pending Reviews</MetricTitle>
              <MetricIcon status="pending_review">📋</MetricIcon>
            </MetricHeader>
            <MetricValue>{dashboard.pending_reviews}</MetricValue>
            <MetricLabel>Awaiting review</MetricLabel>
          </div>
        </MetricCard>

        <MetricCard status="compliant">
          <div style={{ padding: '1.5rem' }}>
            <MetricHeader>
              <MetricTitle>Acknowledgment Rate</MetricTitle>
              <MetricIcon status="compliant">📝</MetricIcon>
            </MetricHeader>
            <MetricValue>{Math.round(dashboard.user_acknowledgment_rate)}%</MetricValue>
            <MetricLabel>User compliance</MetricLabel>
          </div>
        </MetricCard>
      </OverviewGrid>

      {/* Metrics by Category */}
      <DetailSection>
        <SectionTitle>Compliance by Category</SectionTitle>
        <CategoryGrid>
          {Object.entries(dashboard.metrics_by_category).map(([category, stats]) => (
            <CategoryCard key={category}>
              <CategoryHeader>
                <CategoryTitle>{category}</CategoryTitle>
                <CategoryStats>
                  {Object.entries(stats).map(([status, count]) => (
                    <StatItem key={status} status={status}>
                      {count}
                    </StatItem>
                  ))}
                </CategoryStats>
              </CategoryHeader>
              
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))',
                gap: '0.5rem',
                fontSize: '0.875rem'
              }}>
                {Object.entries(stats).map(([status, count]) => (
                  <div key={status} style={{ textAlign: 'center' }}>
                    <div style={{ 
                      fontWeight: 600,
                      color: privacyPolicyService.getComplianceStatusColor(status)
                    }}>
                      {count}
                    </div>
                    <div style={{ 
                      fontSize: '0.75rem',
                      color: theme.colors.text.secondary,
                      textTransform: 'capitalize'
                    }}>
                      {status.replace('_', ' ')}
                    </div>
                  </div>
                ))}
              </div>
            </CategoryCard>
          ))}
        </CategoryGrid>
      </DetailSection>

      {/* Recent Policy Changes */}
      <RecentChanges>
        <SectionTitle>Recent Policy Changes</SectionTitle>
        {dashboard.recent_policy_changes.length > 0 ? (
          <ChangesList>
            {dashboard.recent_policy_changes.map((change, index) => (
              <ChangeItem key={index}>
                <ChangeHeader>
                  <ChangeDescription>
                    <ChangeTitle>
                      {change.section_key ? `${change.section_key}: ` : ''}
                      {change.description}
                    </ChangeTitle>
                    <ChangeDate>
                      Effective: {privacyPolicyService.formatDate(change.effective_date)}
                    </ChangeDate>
                  </ChangeDescription>
                </ChangeHeader>
                
                <ChangeMeta>
                  <ImpactBadge impact={change.impact_level}>
                    {change.impact_level} impact
                  </ImpactBadge>
                  {change.requires_consent && (
                    <ConsentRequired>Consent Required</ConsentRequired>
                  )}
                </ChangeMeta>
              </ChangeItem>
            ))}
          </ChangesList>
        ) : (
          <EmptyState>No recent policy changes found.</EmptyState>
        )}
      </RecentChanges>

      {/* Pending Acknowledgments Alert */}
      {dashboard.pending_acknowledgments > 0 && (
        <MetricCard status="pending_review" style={{ marginTop: '2rem' }}>
          <div style={{ padding: '1.5rem' }}>
            <MetricHeader>
              <MetricTitle>Action Required</MetricTitle>
              <MetricIcon status="pending_review">🔔</MetricIcon>
            </MetricHeader>
            <p style={{ margin: '0.5rem 0', color: theme.colors.text.secondary }}>
              {dashboard.pending_acknowledgments} policy update{dashboard.pending_acknowledgments !== 1 ? 's' : ''} 
              {' '}require{dashboard.pending_acknowledgments === 1 ? 's' : ''} user acknowledgment.
            </p>
            <Button
              variant="primary"
              size="small"
              onClick={() => {
                // This would typically navigate to a notification management page
                console.log('Navigate to pending acknowledgments');
              }}
            >
              Review Pending Acknowledgments
            </Button>
          </div>
        </MetricCard>
      )}
    </Container>
  );
};