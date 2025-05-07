import { Workflow, Action } from '../types';
import { generateId } from '../utils/helpers';
import { saveWorkflow, getWorkflows, getWorkflowById, incrementWorkflowFrequency } from '../utils/storage';
import PatternEngine from './PatternEngine';

/**
 * WorkflowAutomation detects repeated sequences of actions
 * and offers to automate them.
 */
class WorkflowAutomation {
  private patternEngine: PatternEngine;
  private workflows: Record<string, Workflow> = {};
  private detectingWorkflow: boolean = false;
  private currentWorkflow: Action[] = [];
  private executionQueue: string[] = [];
  private isExecuting: boolean = false;

  constructor(patternEngine: PatternEngine) {
    this.patternEngine = patternEngine;
    this.workflows = getWorkflows();
  }

  /**
   * Start workflow detection
   */
  public startDetection(): void {
    if (this.detectingWorkflow) return;
    
    this.detectingWorkflow = true;
    this.currentWorkflow = [];
    
    console.log('WorkflowAutomation: Started workflow detection');
  }

  /**
   * Stop workflow detection and save if applicable
   */
  public stopDetection(): Workflow | null {
    if (!this.detectingWorkflow) return null;
    
    this.detectingWorkflow = false;
    
    // Only save workflows with at least 2 actions
    if (this.currentWorkflow.length >= 2) {
      const workflow = this.createWorkflow(this.currentWorkflow);
      this.saveWorkflow(workflow);
      
      console.log(`WorkflowAutomation: Saved workflow "${workflow.name}" with ${workflow.actions.length} actions`);
      return workflow;
    }
    
    this.currentWorkflow = [];
    console.log('WorkflowAutomation: Stopped workflow detection without saving');
    return null;
  }

  /**
   * Add an action to the current workflow being recorded
   * @param action Action to add
   */
  public addAction(action: Action): void {
    if (!this.detectingWorkflow) return;
    
    this.currentWorkflow.push({ ...action });
    console.log(`WorkflowAutomation: Added action "${action.description}" to current workflow`);
  }

  /**
   * Execute a workflow by ID
   * @param workflowId ID of the workflow to execute
   */
  public executeWorkflow(workflowId: string): void {
    const workflow = getWorkflowById(workflowId);
    
    if (!workflow) {
      console.error(`WorkflowAutomation: Workflow with ID ${workflowId} not found`);
      return;
    }
    
    // Queue all actions in the workflow
    workflow.actions.forEach(action => {
      this.executionQueue.push(action.id);
    });
    
    // Start execution if not already running
    if (!this.isExecuting) {
      this.processExecutionQueue();
    }
    
    // Increment workflow usage statistics
    incrementWorkflowFrequency(workflowId);
    
    console.log(`WorkflowAutomation: Executing workflow "${workflow.name}"`);
  }

  /**
   * Get all available workflows
   * @returns Object containing all workflows
   */
  public getWorkflows(): Record<string, Workflow> {
    return { ...this.workflows };
  }

  /**
   * Check if the current sequence of actions matches any known workflow
   * @param actions Recent actions to check
   * @returns Matching workflow or null if none found
   */
  public detectWorkflowMatch(actions: Action[]): Workflow | null {
    if (actions.length < 2) return null;
    
    for (const id in this.workflows) {
      const workflow = this.workflows[id];
      
      // Skip workflows that are too long to match
      if (workflow.actions.length > actions.length) continue;
      
      // Check if the end of the actions array matches the start of the workflow
      let isMatch = true;
      
      for (let i = 0; i < workflow.actions.length; i++) {
        const actionIndex = actions.length - workflow.actions.length + i;
        
        if (actions[actionIndex].id !== workflow.actions[i].id) {
          isMatch = false;
          break;
        }
      }
      
      if (isMatch) {
        return workflow;
      }
    }
    
    return null;
  }

  /**
   * Create a new workflow from a sequence of actions
   * @param actions The actions in the workflow
   * @returns New workflow object
   */
  private createWorkflow(actions: Action[]): Workflow {
    const id = generateId();
    const name = `Workflow ${Object.keys(this.workflows).length + 1}`;
    
    // Create a description based on the first and last actions
    const description = actions.length > 0 
      ? `${actions[0].description} → ${actions[actions.length - 1].description}`
      : name;
    
    return {
      id,
      name,
      description,
      actions: [...actions],
      frequency: 1,
      lastExecuted: Date.now()
    };
  }

  /**
   * Save a workflow to storage and update the local cache
   * @param workflow The workflow to save
   */
  private saveWorkflow(workflow: Workflow): void {
    this.workflows[workflow.id] = workflow;
    saveWorkflow(workflow);
  }

  /**
   * Process the execution queue
   */
  private processExecutionQueue(): void {
    if (this.executionQueue.length === 0) {
      this.isExecuting = false;
      return;
    }
    
    this.isExecuting = true;
    const actionId = this.executionQueue.shift();
    
    if (!actionId) {
      this.processExecutionQueue();
      return;
    }
    
    // Find the action in all workflows
    let actionToExecute: Action | null = null;
    
    for (const id in this.workflows) {
      const workflow = this.workflows[id];
      const action = workflow.actions.find(a => a.id === actionId);
      
      if (action) {
        actionToExecute = action;
        break;
      }
    }
    
    if (!actionToExecute) {
      console.error(`WorkflowAutomation: Action with ID ${actionId} not found`);
      this.processExecutionQueue();
      return;
    }
    
    // Execute the action
    this.executeAction(actionToExecute).then(() => {
      // Wait a short time between actions to prevent overwhelming the system
      setTimeout(() => {
        this.processExecutionQueue();
      }, 500);
    }).catch(error => {
      console.error('WorkflowAutomation: Error executing action:', error);
      this.processExecutionQueue();
    });
  }

  /**
   * Execute a single action
   * @param action The action to execute
   * @returns Promise that resolves when the action is complete
   */
  private executeAction(action: Action): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        if (action.type === 'api' && action.url) {
          // Perform API call
          fetch(action.url, action.options)
            .then(() => resolve())
            .catch(reject);
        } else if (action.type === 'ui' && action.selector && action.event) {
          // Perform UI action
          const element = document.querySelector(action.selector);
          if (element) {
            const event = new Event(action.event);
            element.dispatchEvent(event);
            resolve();
          } else {
            reject(new Error(`UI element not found: ${action.selector}`));
          }
        } else {
          reject(new Error(`Invalid action configuration: ${JSON.stringify(action)}`));
        }
      } catch (error) {
        reject(error);
      }
    });
  }
}

export default WorkflowAutomation;

 