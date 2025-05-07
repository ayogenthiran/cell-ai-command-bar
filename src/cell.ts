import NetworkInterceptor from './core/NetworkInterceptor';
import PatternEngine from './core/PatternEngine';
import WorkflowAutomation from './core/WorkflowAutomation';
import { setupCommandBar } from './ui/CommandBar';
import { setupSuggestionUI } from './ui/SuggestionUI';
import { initStorage } from './utils/storage';
import OpenAIIntegration from './ai/OpenAIIntegration';
import { CellOptions, NetworkRequest, Prediction, Action } from './types';
import { config } from './config';

/**
 * Cell AI Command Bar
 * An embedded AI command bar for SaaS applications
 */
export class Cell {
  private networkInterceptor: NetworkInterceptor;
  private patternEngine: PatternEngine;
  private workflowAutomation: WorkflowAutomation;
  private aiIntegration: OpenAIIntegration | null = null;
  private options: CellOptions;
  private isRunning: boolean = false;

  constructor(options: CellOptions = {}) {
    this.options = {
      appId: options.appId || 'default',
      enableAI: options.enableAI ?? false,
      suggestionThreshold: options.suggestionThreshold || config.defaults.suggestionThreshold,
      commandBarKey: options.commandBarKey || 'k',
      storagePrefix: options.storagePrefix || 'cell',
      maxPatternLength: options.maxPatternLength || config.defaults.maxPatternLength,
      maxStoredPatterns: options.maxStoredPatterns || config.defaults.maxStoredPatterns,
      openAIApiKey: options.openAIApiKey || config.openai.apiKey,
      openAIModel: options.openAIModel || config.openai.model,
    };

    // Initialize storage
    initStorage(this.options.storagePrefix);

    // Create core components
    this.networkInterceptor = new NetworkInterceptor();
    this.patternEngine = new PatternEngine(this.options);
    this.workflowAutomation = new WorkflowAutomation(this.patternEngine);

    // Initialize AI integration if enabled
    if (this.options.enableAI && this.options.openAIApiKey) {
      this.aiIntegration = new OpenAIIntegration({
        apiKey: this.options.openAIApiKey,
        model: this.options.openAIModel
      });
    }

    // Connect components
    this.networkInterceptor.onRequest((request: NetworkRequest) => {
      this.patternEngine.addRequest(request);
    });

    this.patternEngine.onPrediction((prediction: Prediction) => {
      if (prediction.confidence >= this.options.suggestionThreshold) {
        setupSuggestionUI(prediction, () => this.executeAction(prediction.action));
      }
    });
  }

  public start(): void {
    if (this.isRunning) return;
    
    // Start intercepting network requests
    this.networkInterceptor.start();
    
    // Start pattern recognition
    this.patternEngine.start();
    
    // Setup command bar
    setupCommandBar(this.options, this.patternEngine, this.workflowAutomation, this.aiIntegration);
    
    this.isRunning = true;
    
    console.log(`Cell started for app: ${this.options.appId}`);
  }

  public stop(): void {
    if (!this.isRunning) return;
    
    this.networkInterceptor.stop();
    this.patternEngine.stop();
    
    this.isRunning = false;
    
    console.log(`Cell stopped for app: ${this.options.appId}`);
  }

  private executeAction(action: Action): void {
    // Execute the predicted action
    if (action.type === 'api' && action.url) {
      // Perform API call
      fetch(action.url, action.options);
    } else if (action.type === 'ui' && action.selector && action.event) {
      // Perform UI action
      const element = document.querySelector(action.selector);
      if (element) {
        const event = new Event(action.event);
        element.dispatchEvent(event);
      }
    } else if (action.type === 'workflow') {
      // Execute a sequence of actions
      this.workflowAutomation.executeWorkflow(action.id);
    }
  }

  /**
   * Get the AI integration instance
   * @returns The OpenAI integration instance or null if not enabled
   */
  public getAIIntegration(): OpenAIIntegration | null {
    return this.aiIntegration;
  }

  /**
   * Get the workflow automation instance
   * @returns The workflow automation instance
   */
  public getWorkflowAutomation(): WorkflowAutomation {
    return this.workflowAutomation;
  }

  /**
   * Get the pattern engine instance
   * @returns The pattern engine instance
   */
  public getPatternEngine(): PatternEngine {
    return this.patternEngine;
  }
}

// Default export for better compatibility
export default Cell;

// For Window compatibility when using UMD/IIFE build
if (typeof window !== 'undefined') {
  (window as any).Cell = Cell;
} 