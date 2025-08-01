/**
 * Privacy Provider Component
 * Manages privacy consent flow and integrates with the application
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import { usePrivacyConsent, PrivacyConsentState, PrivacyConsentActions } from '../../hooks/usePrivacyConsent';
import { InitialConsentDialog } from './InitialConsentDialog';
import { ConsentCategory } from '../../services/privacy/ConsentManager';

interface PrivacyContextValue extends PrivacyConsentState, PrivacyConsentActions {
  showInitialConsent: boolean;
  dismissInitialConsent: () => void;
}

const PrivacyContext = createContext<PrivacyContextValue | null>(null);

interface PrivacyProviderProps {
  children: React.ReactNode;
  /**
   * Whether to automatically show the initial consent dialog for new users
   */
  autoShowInitialConsent?: boolean;
  /**
   * Called when the user completes the initial consent process
   */
  onInitialConsentComplete?: (consents: Record<ConsentCategory, boolean>) => void;
  /**
   * Called when privacy consent changes
   */
  onConsentChange?: (category: ConsentCategory, granted: boolean) => void;
}

export const PrivacyProvider: React.FC<PrivacyProviderProps> = ({
  children,
  autoShowInitialConsent = true,
  onInitialConsentComplete,
  onConsentChange
}) => {
  const privacy = usePrivacyConsent();
  const [showInitialConsent, setShowInitialConsent] = useState(false);
  const [hasCheckedInitialConsent, setHasCheckedInitialConsent] = useState(false);

  // Check if we need to show initial consent dialog
  useEffect(() => {
    if (
      !privacy.loading && 
      !hasCheckedInitialConsent && 
      autoShowInitialConsent
    ) {
      setHasCheckedInitialConsent(true);
      
      if (privacy.needsInitialConsent) {
        setShowInitialConsent(true);
      }
    }
  }, [privacy.loading, privacy.needsInitialConsent, hasCheckedInitialConsent, autoShowInitialConsent]);

  // Handle initial consent completion
  const handleInitialConsentComplete = (consents: Record<ConsentCategory, boolean>) => {
    setShowInitialConsent(false);
    privacy.markInitialConsentComplete();
    
    // Notify parent component
    onInitialConsentComplete?.(consents);
    
    console.log('Initial privacy consent completed:', consents);
  };

  // Handle consent dismissal (shouldn't happen in normal flow)
  const dismissInitialConsent = () => {
    setShowInitialConsent(false);
    console.warn('Initial consent dialog dismissed without completion');
  };

  // Handle consent changes and notify parent
  const handleConsentChange = async (category: ConsentCategory, granted: boolean) => {
    try {
      await privacy.updateConsent(category, granted);
      onConsentChange?.(category, granted);
    } catch (error) {
      console.error('Failed to update consent:', error);
      // The error is already handled in the hook
    }
  };

  // Create enhanced context value
  const contextValue: PrivacyContextValue = {
    ...privacy,
    showInitialConsent,
    dismissInitialConsent,
    // Override updateConsent to include parent notification
    updateConsent: handleConsentChange
  };

  return (
    <PrivacyContext.Provider value={contextValue}>
      {children}
      
      {/* Initial Consent Dialog */}
      <InitialConsentDialog
        isOpen={showInitialConsent}
        onConsentComplete={handleInitialConsentComplete}
        onClose={dismissInitialConsent}
      />
    </PrivacyContext.Provider>
  );
};

/**
 * Hook to access privacy context
 */
export const usePrivacyContext = (): PrivacyContextValue => {
  const context = useContext(PrivacyContext);
  
  if (!context) {
    throw new Error('usePrivacyContext must be used within a PrivacyProvider');
  }
  
  return context;
};

/**
 * Higher-order component to require privacy consent for certain features
 */
export function withPrivacyConsent<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  requiredConsents: ConsentCategory[],
  fallbackComponent?: React.ComponentType<P>
) {
  const WithPrivacyConsentComponent: React.FC<P> = (props) => {
    const privacy = usePrivacyContext();
    
    // Check if all required consents are granted
    const hasAllConsents = requiredConsents.every(category => 
      privacy.hasConsent(category)
    );
    
    if (!hasAllConsents) {
      if (fallbackComponent) {
        const FallbackComponent = fallbackComponent;
        return <FallbackComponent {...props} />;
      }
      
      return (
        <div style={{ 
          padding: '1rem', 
          textAlign: 'center',
          color: '#666',
          fontStyle: 'italic'
        }}>
          This feature requires additional privacy permissions. 
          Please check your privacy settings.
        </div>
      );
    }
    
    return <WrappedComponent {...props} />;
  };
  
  WithPrivacyConsentComponent.displayName = 
    `withPrivacyConsent(${WrappedComponent.displayName || WrappedComponent.name})`;
  
  return WithPrivacyConsentComponent;
}

/**
 * Component to conditionally render content based on privacy consent
 */
interface ConditionalPrivacyProps {
  children: React.ReactNode;
  requiredConsents: ConsentCategory[];
  fallback?: React.ReactNode;
  loading?: React.ReactNode;
}

export const ConditionalPrivacy: React.FC<ConditionalPrivacyProps> = ({
  children,
  requiredConsents,
  fallback,
  loading
}) => {
  const privacy = usePrivacyContext();
  
  if (privacy.loading) {
    return <>{loading || null}</>;
  }
  
  const hasAllConsents = requiredConsents.every(category => 
    privacy.hasConsent(category)
  );
  
  if (hasAllConsents) {
    return <>{children}</>;
  }
  
  return <>{fallback || null}</>;
};

/**
 * Privacy status indicator component
 */
interface PrivacyStatusProps {
  className?: string;
  showDetails?: boolean;
}

export const PrivacyStatus: React.FC<PrivacyStatusProps> = ({
  className,
  showDetails = false
}) => {
  const privacy = usePrivacyContext();
  
  if (privacy.loading) {
    return <div className={className}>Loading privacy status...</div>;
  }
  
  const consentCount = Object.values(privacy.consents).filter(Boolean).length;
  const totalCount = Object.keys(privacy.consents).length;
  
  return (
    <div className={className}>
      <div>
        Privacy: {consentCount} of {totalCount} permissions granted
      </div>
      
      {showDetails && (
        <div style={{ fontSize: '0.875em', marginTop: '0.5rem' }}>
          {Object.entries(privacy.consents).map(([category, granted]) => (
            <div key={category} style={{ 
              color: granted ? '#10b981' : '#6b7280',
              margin: '0.25rem 0'
            }}>
              {category.replace('_', ' ')}: {granted ? 'Granted' : 'Denied'}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};