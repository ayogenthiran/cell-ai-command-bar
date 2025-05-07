// Configuration options for Cell
export interface CellOptions {
  appId?: string;
  enableAI?: boolean;
  suggestionThreshold?: number;
  commandBarKey?: string;
  storagePrefix?: string;
  maxPatternLength?: number;
  maxStoredPatterns?: number;
  openAIApiKey?: string;
  openAIModel?: string;
}

// Represents a network request
export interface NetworkRequest {
  id: string;
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: any;
  timestamp: number;
  source: 'xhr' | 'fetch';
}

// Represents an action prediction
export interface Prediction {
  confidence: number;
  action: Action;
  context?: string;
}

// Represents an action that can be executed
export interface Action {
  id: string;
  type: 'api' | 'ui' | 'workflow';
  description: string;
  url?: string;
  options?: RequestInit;
  selector?: string;
  event?: string;
}

// Represents a workflow of multiple actions
export interface Workflow {
  id: string;
  name: string;
  description: string;
  actions: Action[];
  frequency: number;
  lastExecuted?: number;
}

// Callback for request interception
export type RequestCallback = (request: NetworkRequest) => void;

// Callback for prediction events
export type PredictionCallback = (prediction: Prediction) => void;

// Callback for action execution
export type ActionCallback = () => void; 