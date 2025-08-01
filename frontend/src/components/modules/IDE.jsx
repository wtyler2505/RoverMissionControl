import React from 'react';
import Editor from '@monaco-editor/react';
import { Panel } from '../shared';

const IDE = ({
  // Arduino editor props
  arduinoCode,
  setArduinoCode,
  editorRef,
  compileArduinoCode,
  uploadArduinoCode,
  connectSerialMonitor,
  
  // Port management
  selectedPort,
  setSelectedPort,
  availablePorts,
  
  // Library management
  libraries,
  installedLibraries,
  searchLibraries,
  installLibrary,
  
  // Serial monitor
  serialMonitor,
  setSerialMonitor,
  
  // Compilation output
  compilationOutput,
  
  // Panel states
  panelStates,
  togglePanel
}) => {
  return (
    <article className="ide-workspace" aria-labelledby="ide-heading">
      <header className="module-header">
        <h2 id="ide-heading" className="sr-only">Arduino IDE</h2>
      </header>
      <div className="ide-grid" role="region" aria-label="IDE panels">
        {/* Enhanced Code Editor */}
        <Panel 
          title="💻 ARDUINO IDE" 
          className="arduino-panel"
          isMinimized={panelStates.arduino}
          onToggleMinimize={() => togglePanel('arduino')}
        >
          <div className="editor-container">
            <div className="editor-toolbar">
              <button 
                onClick={compileArduinoCode} 
                className="toolbar-btn compile"
                aria-label="Compile Arduino code - check for syntax errors and build"
              >
                🔨 Compile
              </button>
              <button 
                onClick={uploadArduinoCode} 
                className="toolbar-btn upload"
                aria-label="Upload compiled code to Arduino board"
              >
                📤 Upload
              </button>
              <select 
                value={selectedPort} 
                onChange={(e) => setSelectedPort(e.target.value)}
                className="port-select"
                aria-label={`Select Arduino communication port - currently ${selectedPort || 'none selected'}`}
              >
                {availablePorts.map(port => (
                  <option key={port.device} value={port.device}>
                    {port.device} - {port.description}
                  </option>
                ))}
              </select>
              <button 
                onClick={connectSerialMonitor} 
                className="toolbar-btn serial"
                aria-label="Open serial monitor to view Arduino output and communication"
              >
                📺 Serial Monitor
              </button>
              <div className="toolbar-spacer"></div>
              <div className="ai-hint">
                💡 Select code + Ctrl+Shift+E to explain, Ctrl+Shift+O to optimize
              </div>
            </div>
            
            <Editor
              height="450px"
              language="arduino"
              theme="vs-dark"
              value={arduinoCode}
              onChange={(value) => setArduinoCode(value)}
              onMount={(editor) => { editorRef.current = editor; }}
              options={{
                minimap: { enabled: false },
                fontSize: 14,
                wordWrap: 'on',
                automaticLayout: true,
                contextmenu: true,
                selectOnLineNumbers: true,
                scrollBeyondLastLine: false,
                folding: true,
                lineNumbers: 'on',
                matchBrackets: 'always',
                autoIndent: 'full'
              }}
            />
          </div>
        </Panel>

        {/* Library Manager */}
        <Panel 
          title="📚 LIBRARY MANAGER" 
          className="libraries-panel"
          isMinimized={panelStates.libraries}
          onToggleMinimize={() => togglePanel('libraries')}
        >
          <div className="library-manager">
            <div className="library-search">
              <input
                type="text"
                placeholder="Search Arduino libraries..."
                onChange={(e) => searchLibraries(e.target.value)}
              />
            </div>
            <div className="library-sections">
              <div className="library-section">
                <h4>Installed Libraries</h4>
                <div className="library-list">
                  {installedLibraries.map((lib, index) => (
                    <div key={index} className="library-item installed">
                      <span className="library-name">{lib.name}</span>
                      <span className="library-version">v{lib.version}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="library-section">
                <h4>Available Libraries</h4>
                <div className="library-list">
                  {libraries.slice(0, 10).map((lib, index) => (
                    <div key={index} className="library-item">
                      <span className="library-name">{lib.name}</span>
                      <span className="library-version">v{lib.latest.version}</span>
                      <button 
                        className="install-btn"
                        onClick={() => installLibrary(lib.name)}
                        aria-label={`Install ${lib.name} library version ${lib.latest.version}`}
                      >
                        Install
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </Panel>

        {/* Enhanced Serial Monitor */}
        <Panel 
          title="📺 SERIAL MONITOR" 
          className="serial-panel"
          isMinimized={panelStates.serial}
          onToggleMinimize={() => togglePanel('serial')}
        >
          <div className="serial-monitor">
            <div className="serial-controls">
              <button onClick={connectSerialMonitor}>Connect</button>
              <button onClick={() => setSerialMonitor('')}>Clear</button>
              <span className="serial-status">
                Port: {selectedPort}
              </span>
            </div>
            <textarea
              className="serial-output"
              value={serialMonitor}
              readOnly
              placeholder="Serial output with JSON parsing will appear here..."
            />
          </div>
        </Panel>

        {/* Compilation Output */}
        <Panel 
          title="🔨 COMPILATION OUTPUT" 
          className="compilation-panel"
          isMinimized={panelStates.compilation}
          onToggleMinimize={() => togglePanel('compilation')}
        >
          <div className="compilation-output">
            <textarea
              value={compilationOutput}
              readOnly
              placeholder="Compilation results will appear here..."
            />
          </div>
        </Panel>
      </div>
    </article>
  );
};

export default IDE;