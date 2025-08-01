/**
 * Privacy Policy Service
 * Frontend service for managing privacy policies, compliance, and documentation
 */

export interface PolicyLanguage {
  ENGLISH: 'en';
  SPANISH: 'es';
  FRENCH: 'fr';
  GERMAN: 'de';
  PORTUGUESE: 'pt';
  ITALIAN: 'it';
  DUTCH: 'nl';
  RUSSIAN: 'ru';
  CHINESE: 'zh';
  JAPANESE: 'ja';
}

export interface PolicySection {
  section_key: string;
  title: string;
  content: string;
  plain_language_summary?: string;
  gdpr_article?: string;
  legal_basis?: string;
  order_index: number;
}

export interface PolicyChange {
  section_key?: string;
  change_type: string;
  change_description: string;
  plain_language_description?: string;
  impact_level: 'low' | 'medium' | 'high';
  requires_consent: boolean;
  effective_date: string;
}

export interface PrivacyPolicy {
  id: string;
  version: string;
  language: string;
  title: string;
  content: string;
  plain_language_summary?: string;
  effective_date: string;
  created_date: string;
  is_active: boolean;
  requires_acknowledgment: boolean;
  change_type: string;
  sections: PolicySection[];
  changes: PolicyChange[];
}

export interface PolicyComparison {
  from_version: string;
  to_version: string;
  total_changes: number;
  changes_by_type: Record<string, number>;
  changes_by_impact: Record<string, number>;
  requires_acknowledgment: boolean;
  detailed_changes: PolicyChange[];
  sections_modified: string[];
}

export interface ContextualHelp {
  id: string;
  context_key: string;
  title: string;
  content: string;
  plain_language_content?: string;
  related_sections: PolicySection[];
  language: string;
}

export interface ComplianceMetric {
  id: string;
  metric_name: string;
  metric_category: string;
  current_value: string;
  target_value?: string;
  status: 'compliant' | 'partial' | 'non_compliant' | 'pending_review';
  last_updated: string;
  metadata?: Record<string, any>;
}

export interface ComplianceDashboard {
  overall_status: 'compliant' | 'partial' | 'non_compliant' | 'pending_review';
  total_metrics: number;
  compliant_metrics: number;
  non_compliant_metrics: number;
  pending_reviews: number;
  last_updated: string;
  metrics_by_category: Record<string, Record<string, number>>;
  recent_policy_changes: PolicyChange[];
  pending_acknowledgments: number;
  user_acknowledgment_rate: number;
}

export interface AcknowledgmentStatus {
  required: boolean;
  policy?: PrivacyPolicy;
  days_since_effective?: number;
  grace_period_expired?: boolean;
  acknowledged_date?: string;
}

export interface DPIATemplate {
  id: string;
  name: string;
  description?: string;
  applicable_regulations: string[];
  version: string;
  created_date: string;
}

export interface PrivacyChangelog {
  generated_date: string;
  language: string;
  since_version?: string;
  total_versions: number;
  versions: {
    version: string;
    title: string;
    effective_date: string;
    change_type: string;
    requires_acknowledgment: boolean;
    summary?: string;
    changes: {
      section: string;
      description: string;
      impact: string;
      requires_consent: boolean;
    }[];
  }[];
}

class PrivacyPolicyService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = process.env.REACT_APP_API_URL || 'http://localhost:8000';
  }

  // Policy Management
  
  async getActivePolicy(language: string = 'en'): Promise<PrivacyPolicy | null> {
    try {
      const response = await fetch(`${this.baseUrl}/api/privacy/policies/active?language=${language}`);
      if (response.status === 404) return null;
      if (!response.ok) throw new Error('Failed to fetch active policy');
      return await response.json();
    } catch (error) {
      console.error('Error fetching active policy:', error);
      throw error;
    }
  }

  async getPolicyById(policyId: string): Promise<PrivacyPolicy> {
    try {
      const response = await fetch(`${this.baseUrl}/api/privacy/policies/${policyId}`);
      if (!response.ok) throw new Error('Failed to fetch policy');
      return await response.json();
    } catch (error) {
      console.error('Error fetching policy:', error);
      throw error;
    }
  }

  async getPolicyVersions(language: string = 'en'): Promise<PrivacyPolicy[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/privacy/policies?language=${language}`);
      if (!response.ok) throw new Error('Failed to fetch policy versions');
      return await response.json();
    } catch (error) {
      console.error('Error fetching policy versions:', error);
      throw error;
    }
  }

  async comparePolicies(fromVersion: string, toVersion: string): Promise<PolicyComparison> {
    try {
      const response = await fetch(
        `${this.baseUrl}/api/privacy/policies/compare?from_version=${fromVersion}&to_version=${toVersion}`
      );
      if (!response.ok) throw new Error('Failed to compare policies');
      return await response.json();
    } catch (error) {
      console.error('Error comparing policies:', error);
      throw error;
    }
  }

  // Acknowledgments

  async acknowledgePolicy(policyId: string, method: string = 'modal', userId?: string): Promise<boolean> {
    try {
      const params = userId ? `?user_id=${userId}` : '';
      const response = await fetch(`${this.baseUrl}/api/privacy/acknowledgments${params}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          policy_id: policyId,
          acknowledgment_method: method
        })
      });
      
      if (!response.ok) throw new Error('Failed to acknowledge policy');
      const result = await response.json();
      return result.success;
    } catch (error) {
      console.error('Error acknowledging policy:', error);
      throw error;
    }
  }

  async checkAcknowledgmentStatus(userId: string, language: string = 'en'): Promise<AcknowledgmentStatus> {
    try {
      const response = await fetch(
        `${this.baseUrl}/api/privacy/acknowledgments/${userId}/status?language=${language}`
      );
      if (!response.ok) throw new Error('Failed to check acknowledgment status');
      return await response.json();
    } catch (error) {
      console.error('Error checking acknowledgment status:', error);
      throw error;
    }
  }

  async getUserAcknowledgments(userId: string): Promise<any[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/privacy/acknowledgments/${userId}`);
      if (!response.ok) throw new Error('Failed to fetch user acknowledgments');
      return await response.json();
    } catch (error) {
      console.error('Error fetching user acknowledgments:', error);
      throw error;
    }
  }

  // Contextual Help

  async getContextualHelp(contextKey: string, language: string = 'en'): Promise<ContextualHelp | null> {
    try {
      const response = await fetch(
        `${this.baseUrl}/api/privacy/help/${contextKey}?language=${language}`
      );
      if (response.status === 404) return null;
      if (!response.ok) throw new Error('Failed to fetch contextual help');
      return await response.json();
    } catch (error) {
      console.error('Error fetching contextual help:', error);
      return null; // Return null instead of throwing to prevent UI breaks
    }
  }

  // Compliance Dashboard

  async getComplianceDashboard(): Promise<ComplianceDashboard> {
    try {
      const response = await fetch(`${this.baseUrl}/api/privacy/compliance/dashboard`);
      if (!response.ok) throw new Error('Failed to fetch compliance dashboard');
      return await response.json();
    } catch (error) {
      console.error('Error fetching compliance dashboard:', error);
      throw error;
    }
  }

  // DPIA Templates

  async getDPIATemplates(language: string = 'en'): Promise<DPIATemplate[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/privacy/dpia/templates?language=${language}`);
      if (!response.ok) throw new Error('Failed to fetch DPIA templates');
      return await response.json();
    } catch (error) {
      console.error('Error fetching DPIA templates:', error);
      throw error;
    }
  }

  // Data Export

  async exportUserPrivacyData(userId: string): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/api/privacy/export/${userId}`);
      if (!response.ok) throw new Error('Failed to export privacy data');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `privacy-export-${userId}-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting privacy data:', error);
      throw error;
    }
  }

  // Changelog

  async getPrivacyChangelog(sinceVersion?: string, language: string = 'en'): Promise<PrivacyChangelog> {
    try {
      const params = new URLSearchParams({ language });
      if (sinceVersion) params.append('since_version', sinceVersion);
      
      const response = await fetch(`${this.baseUrl}/api/privacy/changelog?${params}`);
      if (!response.ok) throw new Error('Failed to fetch privacy changelog');
      return await response.json();
    } catch (error) {
      console.error('Error fetching privacy changelog:', error);
      throw error;
    }
  }

  // Utility Methods

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  formatDateTime(dateString: string): string {
    return new Date(dateString).toLocaleString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  getChangeTypeLabel(changeType: string): string {
    const labels: Record<string, string> = {
      'major': 'Major Change',
      'minor': 'Minor Update',
      'technical': 'Technical Update',
      'compliance': 'Compliance Update'
    };
    return labels[changeType] || changeType;
  }

  getImpactLevelColor(impact: string): string {
    const colors: Record<string, string> = {
      'low': '#10B981',    // Green
      'medium': '#F59E0B', // Yellow
      'high': '#EF4444'    // Red
    };
    return colors[impact] || '#6B7280';
  }

  getComplianceStatusColor(status: string): string {
    const colors: Record<string, string> = {
      'compliant': '#10B981',      // Green
      'partial': '#F59E0B',        // Yellow
      'non_compliant': '#EF4444',  // Red
      'pending_review': '#8B5CF6'  // Purple
    };
    return colors[status] || '#6B7280';
  }

  parseMarkdown(content: string): string {
    // Simple markdown parser for basic formatting
    return content
      .replace(/^# (.*$)/gim, '<h1>$1</h1>')
      .replace(/^## (.*$)/gim, '<h2>$1</h2>')
      .replace(/^### (.*$)/gim, '<h3>$1</h3>')
      .replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>')
      .replace(/\*(.*)\*/gim, '<em>$1</em>')
      .replace(/\n\n/gim, '</p><p>')
      .replace(/\n/gim, '<br>')
      .replace(/^(.+)/gim, '<p>$1</p>');
  }

  // Policy Notification Management

  async showPolicyUpdateNotification(policy: PrivacyPolicy): Promise<boolean> {
    return new Promise((resolve) => {
      // This would typically integrate with your notification system
      // For now, return true to indicate notification was shown
      console.log('Policy update notification shown:', policy.version);
      resolve(true);
    });
  }

  // Local Storage Helpers for Client-side State

  getStoredLanguagePreference(): string {
    return localStorage.getItem('privacy_policy_language') || 'en';
  }

  setStoredLanguagePreference(language: string): void {
    localStorage.setItem('privacy_policy_language', language);
  }

  getLastViewedPolicyVersion(): string | null {
    return localStorage.getItem('last_viewed_policy_version');
  }

  setLastViewedPolicyVersion(version: string): void {
    localStorage.setItem('last_viewed_policy_version', version);
  }

  // Accessibility Helpers

  announceToScreenReader(message: string): void {
    const announcement = document.createElement('div');
    announcement.setAttribute('aria-live', 'polite');
    announcement.setAttribute('aria-atomic', 'true');
    announcement.setAttribute('class', 'sr-only');
    announcement.textContent = message;
    
    document.body.appendChild(announcement);
    
    setTimeout(() => {
      document.body.removeChild(announcement);
    }, 1000);
  }

  // Deep linking for policy sections

  generatePolicySectionUrl(policyId: string, sectionKey: string): string {
    return `${window.location.origin}/privacy/policy/${policyId}#${sectionKey}`;
  }

  scrollToSection(sectionKey: string): void {
    const element = document.getElementById(sectionKey);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      element.focus({ preventScroll: true });
    }
  }
}

// Singleton instance
export const privacyPolicyService = new PrivacyPolicyService();
export default privacyPolicyService;