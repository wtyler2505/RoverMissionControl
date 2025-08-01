import React from 'react';
import { Panel } from '../shared';

const Knowledge = ({
  // Knowledge base props
  knowledgeModule,
  setKnowledgeModule,
  searchQuery,
  setSearchQuery,
  categories,
  parts,
  selectedPart,
  setSelectedPart,
  documents,
  selectedDocument,
  setSelectedDocument,
  searchResults,
  calculatorResults,
  panelStates,
  togglePanel
}) => {
  return (
    <article className="knowledge-workspace" aria-labelledby="knowledge-heading">
      <header className="module-header">
        <h2 id="knowledge-heading" className="sr-only">Knowledge Base</h2>
      </header>
      <div className="knowledge-grid" role="region" aria-label="Knowledge base panels">
        <Panel 
          title="📚 KNOWLEDGE BASE" 
          className="knowledge-panel"
          isMinimized={panelStates.knowledge}
          onToggleMinimize={() => togglePanel('knowledge')}
        >
          {/* Knowledge Base Navigation */}
          <nav className="knowledge-nav" role="tablist" aria-label="Knowledge base sections">
            <button 
              className={`knowledge-tab ${knowledgeModule === 'parts' ? 'active' : ''}`}
              onClick={() => setKnowledgeModule('parts')}
              role="tab"
              aria-selected={knowledgeModule === 'parts'}
              aria-controls="knowledge-content"
            >
              🔧 Parts Database
            </button>
            <button 
              className={`knowledge-tab ${knowledgeModule === 'docs' ? 'active' : ''}`}
              onClick={() => setKnowledgeModule('docs')}
              role="tab"
              aria-selected={knowledgeModule === 'docs'}
              aria-controls="knowledge-content"
            >
              📖 Documentation
            </button>
            <button 
              className={`knowledge-tab ${knowledgeModule === 'search' ? 'active' : ''}`}
              onClick={() => setKnowledgeModule('search')}
              role="tab"
              aria-selected={knowledgeModule === 'search'}
              aria-controls="knowledge-content"
            >
              🔍 Search
            </button>
            <button 
              className={`knowledge-tab ${knowledgeModule === 'calculators' ? 'active' : ''}`}
              onClick={() => setKnowledgeModule('calculators')}
              role="tab"
              aria-selected={knowledgeModule === 'calculators'}
              aria-controls="knowledge-content"
            >
              🧮 Calculators
            </button>
          </nav>

          <div className="knowledge-content" id="knowledge-content" role="tabpanel" aria-labelledby={`knowledge-tab-${knowledgeModule}`}>
            {knowledgeModule === 'parts' && (
              <div className="parts-database">
                <div className="parts-search">
                  <input
                    type="text"
                    placeholder="Search parts..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <div className="parts-categories">
                  {categories.map((category, index) => (
                    <div key={index} className="category-item">
                      {category.name} ({category.count} parts)
                    </div>
                  ))}
                </div>
                <div className="parts-list">
                  {parts.map((part, index) => (
                    <div 
                      key={index} 
                      className={`part-item ${selectedPart?.id === part.id ? 'selected' : ''}`}
                      onClick={() => setSelectedPart(part)}
                    >
                      <div className="part-name">{part.name}</div>
                      <div className="part-specs">
                        {part.specifications && typeof part.specifications === 'object' 
                          ? Object.entries(part.specifications).map(([key, value]) => (
                              <span key={key} className="part-spec">
                                {key}: {value}
                              </span>
                            ))
                          : part.specifications}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {knowledgeModule === 'docs' && (
              <div className="documentation">
                <div className="docs-list">
                  {documents.map((doc, index) => (
                    <div 
                      key={index} 
                      className={`doc-item ${selectedDocument?.id === doc.id ? 'selected' : ''}`}
                      onClick={() => setSelectedDocument(doc)}
                    >
                      <div className="doc-title">{doc.title}</div>
                      <div className="doc-type">{doc.type}</div>
                    </div>
                  ))}
                </div>
                {selectedDocument && (
                  <div className="doc-viewer">
                    <h3>{selectedDocument.title}</h3>
                    <div className="doc-content">{selectedDocument.content}</div>
                  </div>
                )}
              </div>
            )}

            {knowledgeModule === 'search' && (
              <div className="knowledge-search">
                <div className="search-input">
                  <input
                    type="text"
                    placeholder="Search knowledge base..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  <button>Search</button>
                </div>
                <div className="search-results">
                  {searchResults.map((result, index) => (
                    <div key={index} className="search-result">
                      <div className="result-title">{result.title}</div>
                      <div className="result-snippet">{result.snippet}</div>
                      <div className="result-type">{result.type}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {knowledgeModule === 'calculators' && (
              <div className="calculators">
                <div className="calculator-grid">
                  <div className="calculator-item">
                    <h4>Ohm's Law Calculator</h4>
                    <div className="calc-inputs">
                      <input type="number" placeholder="Voltage (V)" />
                      <input type="number" placeholder="Current (A)" />
                      <input type="number" placeholder="Resistance (Ω)" />
                    </div>
                    <button>Calculate</button>
                  </div>
                  <div className="calculator-item">
                    <h4>Power Calculator</h4>
                    <div className="calc-inputs">
                      <input type="number" placeholder="Voltage (V)" />
                      <input type="number" placeholder="Current (A)" />
                    </div>
                    <button>Calculate</button>
                  </div>
                  <div className="calculator-item">
                    <h4>Battery Life Calculator</h4>
                    <div className="calc-inputs">
                      <input type="number" placeholder="Capacity (mAh)" />
                      <input type="number" placeholder="Load (mA)" />
                    </div>
                    <button>Calculate</button>
                  </div>
                </div>
                <div className="calculator-results">
                  {Object.entries(calculatorResults).map(([key, value]) => (
                    <div key={key} className="calc-result">
                      {key}: {value}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Panel>
      </div>
    </article>
  );
};

export default Knowledge;