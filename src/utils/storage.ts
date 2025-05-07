import { NetworkRequest, Action, Workflow } from '../types';

// Storage keys
let REQUEST_HISTORY_KEY = 'cell_request_history';
let PATTERN_STORE_KEY = 'cell_patterns';
let WORKFLOW_STORE_KEY = 'cell_workflows';
let ACTION_STORE_KEY = 'cell_actions';

/**
 * Initialize storage with a prefix
 * @param prefix Storage prefix to prevent conflicts
 */
export const initStorage = (prefix: string = 'cell'): void => {
  REQUEST_HISTORY_KEY = `${prefix}_request_history`;
  PATTERN_STORE_KEY = `${prefix}_patterns`;
  WORKFLOW_STORE_KEY = `${prefix}_workflows`;
  ACTION_STORE_KEY = `${prefix}_actions`;
};

/**
 * Save request to history
 * @param request The network request to save
 * @param maxItems Maximum items to store
 */
export const saveRequest = (request: NetworkRequest, maxItems: number = 1000): void => {
  const history = getRequestHistory();
  history.push(request);
  
  // Trim history if needed
  if (history.length > maxItems) {
    history.splice(0, history.length - maxItems);
  }
  
  localStorage.setItem(REQUEST_HISTORY_KEY, JSON.stringify(history));
};

/**
 * Get request history
 * @returns Array of network requests
 */
export const getRequestHistory = (): NetworkRequest[] => {
  try {
    const data = localStorage.getItem(REQUEST_HISTORY_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Error getting request history:', error);
    return [];
  }
};

/**
 * Save a pattern of requests
 * @param pattern Array of request IDs forming a pattern
 * @param frequency How often this pattern occurs
 */
export const savePattern = (pattern: string[], frequency: number = 1): void => {
  const patterns = getPatterns();
  const patternKey = pattern.join(',');
  
  if (patterns[patternKey]) {
    patterns[patternKey] += frequency;
  } else {
    patterns[patternKey] = frequency;
  }
  
  localStorage.setItem(PATTERN_STORE_KEY, JSON.stringify(patterns));
};

/**
 * Get all stored patterns
 * @returns Object mapping pattern strings to frequencies
 */
export const getPatterns = (): Record<string, number> => {
  try {
    const data = localStorage.getItem(PATTERN_STORE_KEY);
    return data ? JSON.parse(data) : {};
  } catch (error) {
    console.error('Error getting patterns:', error);
    return {};
  }
};

/**
 * Save an action
 * @param action The action to save
 */
export const saveAction = (action: Action): void => {
  const actions = getActions();
  actions[action.id] = action;
  localStorage.setItem(ACTION_STORE_KEY, JSON.stringify(actions));
};

/**
 * Get all stored actions
 * @returns Map of action IDs to actions
 */
export const getActions = (): Record<string, Action> => {
  try {
    const data = localStorage.getItem(ACTION_STORE_KEY);
    return data ? JSON.parse(data) : {};
  } catch (error) {
    console.error('Error getting actions:', error);
    return {};
  }
};

/**
 * Get action by ID
 * @param id Action ID
 * @returns Action or undefined if not found
 */
export const getActionById = (id: string): Action | undefined => {
  const actions = getActions();
  return actions[id];
};

/**
 * Save a workflow
 * @param workflow The workflow to save
 */
export const saveWorkflow = (workflow: Workflow): void => {
  const workflows = getWorkflows();
  workflows[workflow.id] = workflow;
  localStorage.setItem(WORKFLOW_STORE_KEY, JSON.stringify(workflows));
};

/**
 * Get all stored workflows
 * @returns Map of workflow IDs to workflows
 */
export const getWorkflows = (): Record<string, Workflow> => {
  try {
    const data = localStorage.getItem(WORKFLOW_STORE_KEY);
    return data ? JSON.parse(data) : {};
  } catch (error) {
    console.error('Error getting workflows:', error);
    return {};
  }
};

/**
 * Get workflow by ID
 * @param id Workflow ID
 * @returns Workflow or undefined if not found
 */
export const getWorkflowById = (id: string): Workflow | undefined => {
  const workflows = getWorkflows();
  return workflows[id];
};

/**
 * Increment workflow frequency
 * @param id Workflow ID
 */
export const incrementWorkflowFrequency = (id: string): void => {
  const workflows = getWorkflows();
  if (workflows[id]) {
    workflows[id].frequency += 1;
    workflows[id].lastExecuted = Date.now();
    localStorage.setItem(WORKFLOW_STORE_KEY, JSON.stringify(workflows));
  }
};

/**
 * Clear all stored data
 */
export const clearAllData = (): void => {
  localStorage.removeItem(REQUEST_HISTORY_KEY);
  localStorage.removeItem(PATTERN_STORE_KEY);
  localStorage.removeItem(WORKFLOW_STORE_KEY);
  localStorage.removeItem(ACTION_STORE_KEY);
}; 