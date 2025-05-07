import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { CellOptions, Action, Workflow } from '../types';
import { debounce, sanitizeHtml, truncate } from '../utils/helpers';
import PatternEngine from '../core/PatternEngine';
import WorkflowAutomation from '../core/WorkflowAutomation';
import OpenAIIntegration from '../ai/OpenAIIntegration';
import { getActions, getWorkflows } from '../utils/storage';

// Command bar styles
const styles = `
.cell-command-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: flex-start;
  z-index: 9999;
  padding-top: 100px;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.cell-command-overlay.visible {
  opacity: 1;
}

.cell-command-bar {
  width: 600px;
  max-width: 90%;
  background-color: #fff;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.cell-command-input-wrapper {
  padding: 16px;
  border-bottom: 1px solid #eee;
  position: relative;
}

.cell-command-input {
  width: 100%;
  font-size: 16px;
  border: none;
  outline: none;
  padding: 8px 40px 8px 8px;
  background-color: #f5f5f5;
  border-radius: 4px;
}

.cell-command-icon {
  position: absolute;
  right: 24px;
  top: 24px;
  color: #888;
  font-size: 20px;
}

.cell-command-results {
  max-height: 400px;
  overflow-y: auto;
}

.cell-command-result {
  padding: 12px 16px;
  cursor: pointer;
  display: flex;
  align-items: center;
  border-bottom: 1px solid #f0f0f0;
}

.cell-command-result:hover, .cell-command-result.selected {
  background-color: #f0f7ff;
}

.cell-command-result-icon {
  margin-right: 12px;
  color: #666;
  font-size: 18px;
  width: 20px;
  display: flex;
  justify-content: center;
}

.cell-command-result-content {
  flex: 1;
}

.cell-command-result-title {
  font-weight: 500;
  margin-bottom: 2px;
}

.cell-command-result-description {
  font-size: 13px;
  color: #666;
}

.cell-command-shortcut {
  color: #999;
  font-size: 12px;
  display: inline-block;
  padding: 2px 6px;
  background-color: #f0f0f0;
  border-radius: 4px;
  margin-left: 8px;
}

.cell-command-category {
  padding: 8px 16px;
  font-size: 12px;
  font-weight: 600;
  color: #888;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  background-color: #f9f9f9;
}

.cell-command-autocomplete {
  position: absolute;
  left: 24px;
  right: 40px;
  top: 24px;
  pointer-events: none;
  overflow: hidden;
  white-space: nowrap;
  color: #aaa;
  font-size: 16px;
  padding: 8px;
}

.cell-command-typing {
  opacity: 0;
}

.cell-command-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  color: #666;
  font-size: 14px;
}

.cell-command-spinner {
  display: inline-block;
  width: 16px;
  height: 16px;
  border: 2px solid rgba(0, 0, 0, 0.1);
  border-radius: 50%;
  border-top-color: #666;
  animation: cell-spin 1s linear infinite;
  margin-right: 8px;
}

@keyframes cell-spin {
  to { transform: rotate(360deg); }
}
`;

// Add styles to document head
const addStyles = () => {
  if (!document.getElementById('cell-command-styles')) {
    const styleElement = document.createElement('style');
    styleElement.id = 'cell-command-styles';
    styleElement.textContent = styles;
    document.head.appendChild(styleElement);
  }
};

// Create the container element
const createContainer = () => {
  let container = document.getElementById('cell-command-container');
  
  if (!container) {
    container = document.createElement('div');
    container.id = 'cell-command-container';
    document.body.appendChild(container);
  }
  
  return container;
};

// Available command types
type CommandType = 'action' | 'workflow' | 'system';

// Command interface
interface Command {
  id: string;
  type: CommandType;
  title: string;
  description: string;
  shortcut?: string;
  icon?: string;
  execute: () => void;
  originalItem?: Action | Workflow;
}

// The CommandBar component
interface CommandBarProps {
  options: CellOptions;
  patternEngine: PatternEngine;
  workflowAutomation: WorkflowAutomation;
  aiIntegration: OpenAIIntegration | null;
  onClose: () => void;
}

const CommandBar: React.FC<CommandBarProps> = ({ 
  options, 
  patternEngine, 
  workflowAutomation, 
  aiIntegration,
  onClose 
}) => {
  const [visible, setVisible] = useState(false);
  const [query, setQuery] = useState('');
  const [autocomplete, setAutocomplete] = useState('');
  const [commands, setCommands] = useState<Command[]>([]);
  const [filteredCommands, setFilteredCommands] = useState<Command[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isAILoading, setIsAILoading] = useState(false);
  
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Load available commands
  useEffect(() => {
    loadCommands();
  }, []);
  
  // Show animation
  useEffect(() => {
    setTimeout(() => {
      setVisible(true);
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }, 50);
  }, []);
  
  // Filter commands when query changes
  useEffect(() => {
    if (aiIntegration && query.length > 1) {
      // Debounce AI processing to avoid too many requests
      const debounceAIProcessing = debounce(async () => {
        setIsAILoading(true);
        try {
          const actions = Object.values(getActions());
          const workflows = Object.values(getWorkflows());
          
          const aiResults = await aiIntegration.processCommand(
            query,
            actions,
            workflows
          );
          
          if (aiResults.length > 0) {
            // Convert to commands
            const aiCommands = aiResults.map(item => createCommandFromItem(item));
            setFilteredCommands(aiCommands);
          } else {
            // Fall back to regular filtering
            filterCommands(query);
          }
        } catch (error) {
          console.error('Error processing AI command:', error);
          filterCommands(query);
        } finally {
          setIsAILoading(false);
        }
      }, 300);
      
      debounceAIProcessing();
    } else {
      // Regular filtering for short queries or when AI is not available
      filterCommands(query);
    }
  }, [query, commands, aiIntegration]);
  
  // Set autocomplete suggestion
  useEffect(() => {
    if (query.length > 0 && filteredCommands.length > 0 && !isAILoading) {
      const firstResult = filteredCommands[0];
      if (firstResult.title.toLowerCase().startsWith(query.toLowerCase())) {
        setAutocomplete(firstResult.title);
      } else {
        setAutocomplete('');
      }
    } else {
      setAutocomplete('');
    }
  }, [query, filteredCommands, isAILoading]);
  
  // Create a command from an Action or Workflow
  const createCommandFromItem = (item: Action | Workflow): Command => {
    if ('actions' in item) {
      // It's a workflow
      return {
        id: `workflow-${item.id}`,
        type: 'workflow',
        title: item.name,
        description: item.description,
        icon: '⚡',
        execute: () => {
          workflowAutomation.executeWorkflow(item.id);
          onClose();
        },
        originalItem: item
      };
    } else {
      // It's an action
      return {
        id: `action-${item.id}`,
        type: 'action',
        title: item.description,
        description: `Execute ${item.type} action`,
        icon: item.type === 'api' ? '🌐' : '🖱️',
        execute: () => {
          // TODO: Implement action execution
          console.log(`Executing action: ${item.description}`);
          onClose();
        },
        originalItem: item
      };
    }
  };
  
  // Load available commands from various sources
  const loadCommands = () => {
    const allCommands: Command[] = [];
    
    // System commands
    allCommands.push({
      id: 'system-record-workflow',
      type: 'system',
      title: 'Start Recording Workflow',
      description: 'Begin recording a sequence of actions as a workflow',
      icon: '🔴',
      execute: () => {
        workflowAutomation.startDetection();
        onClose();
      }
    });
    
    allCommands.push({
      id: 'system-stop-recording',
      type: 'system',
      title: 'Stop Recording Workflow',
      description: 'Stop recording and save the current workflow',
      icon: '⏹️',
      execute: () => {
        workflowAutomation.stopDetection();
        onClose();
      }
    });
    
    // Add actions from history
    const actions = getActions();
    Object.values(actions).forEach(action => {
      allCommands.push(createCommandFromItem(action));
    });
    
    // Add workflows
    const workflows = getWorkflows();
    Object.values(workflows).forEach(workflow => {
      allCommands.push(createCommandFromItem(workflow));
    });
    
    setCommands(allCommands);
    setFilteredCommands(allCommands);
  };
  
  // Filter commands based on query
  const filterCommands = (query: string) => {
    if (!query) {
      setFilteredCommands(commands);
      setSelectedIndex(0);
      return;
    }
    
    const lowerQuery = query.toLowerCase();
    const filtered = commands.filter(command => {
      return (
        command.title.toLowerCase().includes(lowerQuery) ||
        command.description.toLowerCase().includes(lowerQuery)
      );
    });
    
    // Sort results by relevance
    filtered.sort((a, b) => {
      const aTitle = a.title.toLowerCase();
      const bTitle = b.title.toLowerCase();
      
      // Exact matches first
      const aExactMatch = aTitle === lowerQuery;
      const bExactMatch = bTitle === lowerQuery;
      
      if (aExactMatch && !bExactMatch) return -1;
      if (!aExactMatch && bExactMatch) return 1;
      
      // Starts with query next
      const aStartsWith = aTitle.startsWith(lowerQuery);
      const bStartsWith = bTitle.startsWith(lowerQuery);
      
      if (aStartsWith && !bStartsWith) return -1;
      if (!aStartsWith && bStartsWith) return 1;
      
      // Then alphabetical
      return aTitle.localeCompare(bTitle);
    });
    
    setFilteredCommands(filtered);
    setSelectedIndex(0);
  };
  
  // Handle key down events
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => 
        prev < filteredCommands.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => prev > 0 ? prev - 1 : 0);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      // Use autocomplete suggestion
      if (autocomplete) {
        setQuery(autocomplete);
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredCommands.length > 0) {
        const selectedCommand = filteredCommands[selectedIndex];
        selectedCommand.execute();
      }
    }
  };
  
  // Handle input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
  };
  
  // Handle command selection
  const handleCommandClick = (command: Command) => {
    command.execute();
  };
  
  return (
    <div className={`cell-command-overlay ${visible ? 'visible' : ''}`} onClick={onClose}>
      <div className="cell-command-bar" onClick={e => e.stopPropagation()}>
        <div className="cell-command-input-wrapper">
          <input
            ref={inputRef}
            type="text"
            className="cell-command-input"
            placeholder="Type a command..."
            value={query}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
          />
          {autocomplete && (
            <div className="cell-command-autocomplete">
              <span className="cell-command-typing">{query}</span>
              {autocomplete}
            </div>
          )}
          <div className="cell-command-icon">⌘</div>
        </div>
        
        <div className="cell-command-results">
          {isAILoading ? (
            <div className="cell-command-loading">
              <div className="cell-command-spinner"></div>
              <span>Searching...</span>
            </div>
          ) : filteredCommands.length === 0 ? (
            <div className="cell-command-category">No results found</div>
          ) : (
            <>
              {query === '' && (
                <div className="cell-command-category">Suggested Commands</div>
              )}
              
              {filteredCommands.map((command, index) => (
                <div
                  key={command.id}
                  className={`cell-command-result ${index === selectedIndex ? 'selected' : ''}`}
                  onClick={() => handleCommandClick(command)}
                >
                  <div className="cell-command-result-icon">{command.icon || '•'}</div>
                  <div className="cell-command-result-content">
                    <div className="cell-command-result-title">{command.title}</div>
                    <div className="cell-command-result-description">{command.description}</div>
                  </div>
                  {command.shortcut && (
                    <div className="cell-command-shortcut">{command.shortcut}</div>
                  )}
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// Track keyboard events
let commandBarVisible = false;

/**
 * Setup the command bar
 * @param options Cell options
 * @param patternEngine Pattern engine instance
 * @param workflowAutomation Workflow automation instance
 * @param aiIntegration OpenAI integration instance (optional)
 */
export const setupCommandBar = (
  options: CellOptions, 
  patternEngine: PatternEngine, 
  workflowAutomation: WorkflowAutomation,
  aiIntegration: OpenAIIntegration | null = null
): void => {
  // Add styles to the document
  addStyles();
  
  // Setup keyboard shortcut
  const handleKeyDown = (e: KeyboardEvent) => {
    // Check for Cmd+K or Ctrl+K
    if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey) {
      e.preventDefault();
      
      if (!commandBarVisible) {
        showCommandBar(options, patternEngine, workflowAutomation, aiIntegration);
      }
    }
  };
  
  window.addEventListener('keydown', handleKeyDown);
  
  console.log(`CommandBar: Ready (use ${navigator.platform.includes('Mac') ? 'Cmd+K' : 'Ctrl+K'} to open)`);
  
  if (aiIntegration) {
    console.log('CommandBar: AI enhancement enabled');
  }
};

/**
 * Show the command bar
 */
const showCommandBar = (
  options: CellOptions, 
  patternEngine: PatternEngine, 
  workflowAutomation: WorkflowAutomation,
  aiIntegration: OpenAIIntegration | null = null
): void => {
  if (commandBarVisible) return;
  
  commandBarVisible = true;
  
  // Create or get the container element
  const container = createContainer();
  
  // Dismiss function
  const dismiss = () => {
    ReactDOM.unmountComponentAtNode(container);
    commandBarVisible = false;
  };
  
  // Render the component
  ReactDOM.render(
    <CommandBar 
      options={options} 
      patternEngine={patternEngine}
      workflowAutomation={workflowAutomation}
      aiIntegration={aiIntegration}
      onClose={dismiss} 
    />,
    container
  );
}; 