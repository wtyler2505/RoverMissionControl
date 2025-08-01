/**
 * DPIA Template Viewer Component
 * Displays and manages Data Protection Impact Assessment templates
 */

import React, { useState, useEffect, useCallback } from 'react';
import styled from '@emotion/styled';
import { useTheme } from '@emotion/react';
import { 
  DPIATemplate,
  privacyPolicyService 
} from '../../services/privacy/PrivacyPolicyService';
import { Card } from '../ui/core/Card';
import { Button } from '../ui/core/Button';
import { Modal } from '../ui/core/Modal';

interface DPIATemplateViewerProps {
  templateId?: string;
  language?: string;
  showTemplateSelector?: boolean;
  onTemplateSelect?: (templateId: string) => void;
  className?: string;
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
  font-weight: 700;
  color: ${props => props.theme.colors.text.primary};
  margin-bottom: 0.5rem;
`;

const Subtitle = styled.p`
  font-size: 1rem;
  color: ${props => props.theme.colors.text.secondary};
  margin-bottom: 1.5rem;
`;

const TemplateSelector = styled.div`
  margin-bottom: 2rem;
`;

const TemplateGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1.5rem;
  margin-top: 1rem;
`;

const TemplateCard = styled(Card)<{ isSelected?: boolean }>`
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

const TemplateHeader = styled.div`
  display: flex;
  justify-content: between;
  align-items: flex-start;
  margin-bottom: 1rem;
`;

const TemplateName = styled.h3`
  font-size: 1.125rem;
  font-weight: 600;
  color: ${props => props.theme.colors.text.primary};
  margin: 0;
  flex: 1;
`;

const TemplateVersion = styled.span`
  padding: 0.25rem 0.75rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 500;
  background: ${props => props.theme.colors.primary}20;
  color: ${props => props.theme.colors.primary};
`;

const TemplateDescription = styled.p`
  font-size: 0.875rem;
  color: ${props => props.theme.colors.text.secondary};
  line-height: 1.5;
  margin-bottom: 1rem;
`;

const TemplateRegulations = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 1rem;
`;

const RegulationBadge = styled.span`
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 500;
  background: ${props => props.theme.colors.status.info}20;
  color: ${props => props.theme.colors.status.info};
`;

const TemplateViewer = styled.div`
  margin-top: 2rem;
`;

const TemplateContent = styled.div`
  background: ${props => props.theme.colors.background.secondary};
  border: 1px solid ${props => props.theme.colors.border.secondary};
  border-radius: 8px;
  padding: 2rem;
`;

const SectionContainer = styled.div`
  margin-bottom: 3rem;

  &:last-child {
    margin-bottom: 0;
  }
`;

const SectionTitle = styled.h2`
  font-size: 1.5rem;
  font-weight: 600;
  color: ${props => props.theme.colors.text.primary};
  margin-bottom: 1.5rem;
  padding-bottom: 0.5rem;
  border-bottom: 2px solid ${props => props.theme.colors.border.primary};
`;

const QuestionsList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;

const QuestionItem = styled.div`
  padding: 1rem;
  background: ${props => props.theme.colors.background.primary};
  border: 1px solid ${props => props.theme.colors.border.secondary};
  border-radius: 8px;
`;

const QuestionText = styled.div`
  font-weight: 500;
  color: ${props => props.theme.colors.text.primary};
  margin-bottom: 0.5rem;
`;

const AnswerSpace = styled.div`
  padding: 1rem;
  background: ${props => props.theme.colors.background.tertiary};
  border: 1px dashed ${props => props.theme.colors.border.secondary};
  border-radius: 4px;
  min-height: 3rem;
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${props => props.theme.colors.text.tertiary};
  font-style: italic;
`;

const ActionBar = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 2rem;
  padding-top: 2rem;
  border-top: 1px solid ${props => props.theme.colors.border.secondary};
`;

const ActionButtons = styled.div`
  display: flex;
  gap: 1rem;
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

const HelpText = styled.div`
  background: ${props => props.theme.colors.background.tertiary};
  border: 1px solid ${props => props.theme.colors.border.secondary};
  border-radius: 8px;
  padding: 1.5rem;
  margin-bottom: 2rem;
`;

const HelpTitle = styled.h3`
  font-size: 1.125rem;
  font-weight: 600;
  color: ${props => props.theme.colors.text.primary};
  margin-bottom: 0.75rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

export const DPIATemplateViewer: React.FC<DPIATemplateViewerProps> = ({
  templateId,
  language = 'en',
  showTemplateSelector = true,
  onTemplateSelect,
  className
}) => {
  const theme = useTheme();
  const [templates, setTemplates] = useState<DPIATemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<DPIATemplate | null>(null);
  const [templateContent, setTemplateContent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showHelpModal, setShowHelpModal] = useState(false);

  // Load templates
  useEffect(() => {
    const loadTemplates = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const templatesData = await privacyPolicyService.getDPIATemplates(language);
        setTemplates(templatesData);
        
        // Auto-select template if templateId provided
        if (templateId) {
          const template = templatesData.find(t => t.id === templateId);
          if (template) {
            await handleTemplateSelect(template);
          }
        } else if (templatesData.length > 0) {
          await handleTemplateSelect(templatesData[0]);
        }
      } catch (err) {
        console.error('Failed to load DPIA templates:', err);
        setError('Failed to load DPIA templates. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    loadTemplates();
  }, [templateId, language]);

  // Handle template selection
  const handleTemplateSelect = useCallback(async (template: DPIATemplate) => {
    try {
      setSelectedTemplate(template);
      
      // In a real implementation, you'd fetch the full template content
      // For now, we'll use mock data structure
      const mockContent = {
        sections: [
          {
            title: "System Overview",
            questions: [
              "What is the purpose of the data processing?",
              "What types of personal data are processed?",
              "Who are the data subjects?",
              "What is the legal basis for processing?",
              "How long will the data be retained?"
            ]
          },
          {
            title: "Risk Assessment", 
            questions: [
              "What are the potential privacy risks to individuals?",
              "How likely are these risks to occur?",
              "What would be the severity of impact on individuals?",
              "Are there any special categories of data involved?",
              "Are there any automated decision-making processes?"
            ]
          },
          {
            title: "Mitigation Measures",
            questions: [
              "What technical safeguards are implemented?",
              "What organizational measures are in place?",
              "How is data minimization ensured?",
              "What access controls are implemented?",
              "How is data subject consent managed?"
            ]
          },
          {
            title: "Monitoring and Review",
            questions: [
              "How will the effectiveness of safeguards be monitored?",
              "What procedures are in place for regular review?",
              "How will incidents be detected and responded to?",
              "What metrics will be used to measure compliance?",
              "How often will this DPIA be reviewed and updated?"
            ]
          }
        ]
      };
      
      setTemplateContent(mockContent);
      onTemplateSelect?.(template.id);
    } catch (err) {
      console.error('Failed to load template content:', err);
      setError('Failed to load template content.');
    }
  }, [onTemplateSelect]);

  // Generate PDF report
  const handleGenerateReport = useCallback(() => {
    if (!selectedTemplate) return;
    
    // In a real implementation, this would generate a PDF
    console.log('Generating DPIA report for template:', selectedTemplate.name);
    
    // For now, create a simple HTML representation
    const reportContent = `
      <h1>Data Protection Impact Assessment</h1>
      <h2>Template: ${selectedTemplate.name}</h2>
      <p><strong>Version:</strong> ${selectedTemplate.version}</p>
      <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
      <p><strong>Regulations:</strong> ${selectedTemplate.applicable_regulations.join(', ')}</p>
      
      ${templateContent?.sections.map((section: any) => `
        <h3>${section.title}</h3>
        <ol>
          ${section.questions.map((question: string) => `
            <li>${question}</li>
            <div style="border: 1px solid #ccc; padding: 10px; margin: 10px 0; min-height: 50px;">
              [Response area]
            </div>
          `).join('')}
        </ol>
      `).join('')}
    `;
    
    const blob = new Blob([reportContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `dpia-template-${selectedTemplate.name.toLowerCase().replace(/\s+/g, '-')}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [selectedTemplate, templateContent]);

  if (loading) {
    return (
      <Container className={className}>
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <LoadingSpinner />
          <p style={{ marginTop: '1rem', color: theme.colors.text.secondary }}>
            Loading DPIA templates...
          </p>
        </div>
      </Container>
    );
  }

  if (error) {
    return (
      <Container className={className}>
        <ErrorMessage role="alert">{error}</ErrorMessage>
        <Button onClick={() => window.location.reload()}>Retry</Button>
      </Container>
    );
  }

  if (templates.length === 0) {
    return (
      <Container className={className}>
        <EmptyState>
          <h3>No DPIA Templates Available</h3>
          <p>No Data Protection Impact Assessment templates are currently available.</p>
        </EmptyState>
      </Container>
    );
  }

  return (
    <Container className={className}>
      <Header>
        <Title>DPIA Templates</Title>
        <Subtitle>
          Data Protection Impact Assessment templates to help ensure compliance 
          with privacy regulations like GDPR.
        </Subtitle>
        
        <Button
          variant="secondary"
          size="small"
          onClick={() => setShowHelpModal(true)}
        >
          What is a DPIA?
        </Button>
      </Header>

      {showTemplateSelector && templates.length > 1 && (
        <TemplateSelector>
          <h3 style={{ marginBottom: '1rem' }}>Available Templates</h3>
          <TemplateGrid>
            {templates.map((template) => (
              <TemplateCard
                key={template.id}
                isSelected={selectedTemplate?.id === template.id}
                onClick={() => handleTemplateSelect(template)}
              >
                <div style={{ padding: '1.5rem' }}>
                  <TemplateHeader>
                    <TemplateName>{template.name}</TemplateName>
                    <TemplateVersion>{template.version}</TemplateVersion>
                  </TemplateHeader>
                  
                  {template.description && (
                    <TemplateDescription>{template.description}</TemplateDescription>
                  )}
                  
                  <TemplateRegulations>
                    {template.applicable_regulations.map((reg) => (
                      <RegulationBadge key={reg}>{reg}</RegulationBadge>
                    ))}
                  </TemplateRegulations>
                  
                  <div style={{ 
                    fontSize: '0.875rem', 
                    color: theme.colors.text.secondary 
                  }}>
                    Created: {privacyPolicyService.formatDate(template.created_date)}
                  </div>
                </div>
              </TemplateCard>
            ))}
          </TemplateGrid>
        </TemplateSelector>
      )}

      {selectedTemplate && templateContent && (
        <TemplateViewer>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: '2rem'
          }}>
            <div>
              <h2 style={{ margin: 0 }}>{selectedTemplate.name}</h2>
              <p style={{ 
                margin: '0.5rem 0 0 0', 
                color: theme.colors.text.secondary 
              }}>
                Version {selectedTemplate.version} • {selectedTemplate.applicable_regulations.join(', ')}
              </p>
            </div>
            
            <ActionButtons>
              <Button
                variant="secondary"
                onClick={handleGenerateReport}
              >
                Generate Report
              </Button>
            </ActionButtons>
          </div>

          <HelpText>
            <HelpTitle>
              <span>💡</span>
              How to Use This Template
            </HelpTitle>
            <p style={{ margin: 0, fontSize: '0.875rem', lineHeight: 1.5 }}>
              This template provides a structured approach to conducting a Data Protection Impact Assessment. 
              Work through each section systematically, answering all questions thoroughly. Consider involving 
              relevant stakeholders including legal, technical, and business teams. Document all decisions 
              and mitigation measures clearly.
            </p>
          </HelpText>

          <TemplateContent>
            {templateContent.sections.map((section: any, sectionIndex: number) => (
              <SectionContainer key={sectionIndex}>
                <SectionTitle>{section.title}</SectionTitle>
                <QuestionsList>
                  {section.questions.map((question: string, questionIndex: number) => (
                    <QuestionItem key={questionIndex}>
                      <QuestionText>
                        {sectionIndex + 1}.{questionIndex + 1} {question}
                      </QuestionText>
                      <AnswerSpace>
                        Click to add your response...
                      </AnswerSpace>
                    </QuestionItem>
                  ))}
                </QuestionsList>
              </SectionContainer>
            ))}
          </TemplateContent>

          <ActionBar>
            <div style={{ 
              fontSize: '0.875rem', 
              color: theme.colors.text.secondary 
            }}>
              Complete all sections to generate a comprehensive DPIA report
            </div>
            
            <ActionButtons>
              <Button variant="secondary">
                Save Draft
              </Button>
              <Button variant="primary" onClick={handleGenerateReport}>
                Generate Final Report
              </Button>
            </ActionButtons>
          </ActionBar>
        </TemplateViewer>
      )}

      {/* Help Modal */}
      <Modal
        isOpen={showHelpModal}
        onClose={() => setShowHelpModal(false)}
        title="What is a DPIA?"
        maxWidth="600px"
      >
        <div>
          <h4>Data Protection Impact Assessment (DPIA)</h4>
          <p>
            A DPIA is a process designed to help identify and minimize data protection 
            risks. It's required under GDPR Article 35 when processing is likely to 
            result in high risk to individuals' rights and freedoms.
          </p>
          
          <h5>When is a DPIA Required?</h5>
          <ul>
            <li>Systematic and extensive evaluation of personal aspects</li>
            <li>Processing special categories of data on a large scale</li>
            <li>Systematic monitoring of publicly accessible areas on a large scale</li>
            <li>When recommended by your Data Protection Authority</li>
          </ul>
          
          <h5>Key Benefits</h5>
          <ul>
            <li>Identify and mitigate privacy risks early</li>
            <li>Demonstrate compliance with data protection laws</li>
            <li>Build trust with users and stakeholders</li>
            <li>Avoid potential fines and legal issues</li>
          </ul>
          
          <h5>Process Overview</h5>
          <ol>
            <li><strong>Describe the processing:</strong> What, why, how, when, where</li>
            <li><strong>Assess necessity:</strong> Is the processing necessary and proportionate?</li>
            <li><strong>Identify risks:</strong> What could go wrong for individuals?</li>
            <li><strong>Implement safeguards:</strong> How will you mitigate the risks?</li>
            <li><strong>Monitor and review:</strong> Regular assessment of effectiveness</li>
          </ol>
          
          <div style={{ 
            background: theme.colors.background.tertiary,
            padding: '1rem',
            borderRadius: '8px',
            marginTop: '1.5rem'
          }}>
            <strong>💡 Pro Tip:</strong> Involve stakeholders from different departments 
            (legal, IT, business) to ensure comprehensive risk assessment and practical 
            mitigation measures.
          </div>
        </div>
      </Modal>
    </Container>
  );
};