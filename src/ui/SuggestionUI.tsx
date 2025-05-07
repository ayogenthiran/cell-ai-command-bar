import React from 'react';
import ReactDOM from 'react-dom';
import { Prediction, ActionCallback } from '../types';
import { truncate, sanitizeHtml } from '../utils/helpers';

// CSS styles for the suggestion UI
const styles = `
.cell-suggestion {
  position: fixed;
  bottom: 20px;
  right: 20px;
  background-color: rgba(0, 0, 0, 0.8);
  color: white;
  border-radius: 6px;
  padding: 10px 15px;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 14px;
  display: flex;
  align-items: center;
  gap: 10px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  z-index: 9999;
  opacity: 0;
  transform: translateY(10px);
  transition: opacity 0.3s ease, transform 0.3s ease;
  pointer-events: none;
}

.cell-suggestion.visible {
  opacity: 1;
  transform: translateY(0);
}

.cell-suggestion-text {
  display: flex;
  flex-direction: column;
}

.cell-suggestion-action {
  font-weight: 500;
  color: #80bdff;
}

.cell-suggestion-key {
  display: inline-block;
  background-color: #222;
  color: white;
  border-radius: 4px;
  padding: 2px 6px;
  margin-right: 5px;
  font-weight: 600;
  font-size: 12px;
}

.cell-suggestion-dismiss {
  position: absolute;
  top: -8px;
  right: -8px;
  background-color: #444;
  border-radius: 50%;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  pointer-events: auto;
  font-size: 12px;
  color: #ccc;
}

.cell-suggestion-dismiss:hover {
  background-color: #555;
  color: white;
}
`;

// Add styles to document head
const addStyles = () => {
  if (!document.getElementById('cell-suggestion-styles')) {
    const styleElement = document.createElement('style');
    styleElement.id = 'cell-suggestion-styles';
    styleElement.textContent = styles;
    document.head.appendChild(styleElement);
  }
};

// Create the container element
const createContainer = () => {
  let container = document.getElementById('cell-suggestion-container');
  
  if (!container) {
    container = document.createElement('div');
    container.id = 'cell-suggestion-container';
    document.body.appendChild(container);
  }
  
  return container;
};

// The SuggestionUI component
interface SuggestionProps {
  prediction: Prediction;
  onAction: ActionCallback;
  onDismiss: () => void;
}

const SuggestionUI: React.FC<SuggestionProps> = ({ prediction, onAction, onDismiss }) => {
  React.useEffect(() => {
    // Add keyboard listener for Tab key
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab' && !e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey) {
        e.preventDefault();
        onAction();
        onDismiss();
      } else if (e.key === 'Escape') {
        onDismiss();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    
    // Show the suggestion
    setTimeout(() => {
      const element = document.querySelector('.cell-suggestion');
      if (element) {
        element.classList.add('visible');
      }
    }, 100);
    
    // Cleanup
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onAction, onDismiss]);
  
  return (
    <div className="cell-suggestion">
      <div className="cell-suggestion-text">
        <span>
          Press <span className="cell-suggestion-key">Tab</span> to
        </span>
        <span className="cell-suggestion-action">
          {truncate(prediction.action.description, 30)}
        </span>
      </div>
      <div 
        className="cell-suggestion-dismiss" 
        onClick={onDismiss}
        title="Dismiss"
      >
        ✕
      </div>
    </div>
  );
};

// Duration in milliseconds to show the suggestion
const SUGGESTION_DURATION = 8000;

// Tracking for current suggestion
let currentTimeoutId: ReturnType<typeof setTimeout> | null = null;

/**
 * Display the tab suggestion UI
 * @param prediction The prediction to suggest
 * @param onAction Callback when tab is pressed
 */
export const setupSuggestionUI = (prediction: Prediction, onAction: ActionCallback): void => {
  // Add styles to the document
  addStyles();
  
  // Create or get the container element
  const container = createContainer();
  
  // Clear any existing suggestion
  if (currentTimeoutId) {
    clearTimeout(currentTimeoutId);
    container.innerHTML = '';
  }
  
  // Dismiss function
  const dismiss = () => {
    const suggestionElement = document.querySelector('.cell-suggestion');
    if (suggestionElement) {
      suggestionElement.classList.remove('visible');
      
      // Remove after animation completes
      setTimeout(() => {
        ReactDOM.unmountComponentAtNode(container);
      }, 300);
    }
  };
  
  // Render the component
  ReactDOM.render(
    <SuggestionUI 
      prediction={prediction} 
      onAction={onAction} 
      onDismiss={dismiss} 
    />,
    container
  );
  
  // Auto-dismiss after a delay
  currentTimeoutId = setTimeout(dismiss, SUGGESTION_DURATION);
}; 