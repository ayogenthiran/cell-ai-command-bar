import { Action, Workflow } from '../types';
import { config } from '../config';

/**
 * Configuration for OpenAI integration
 */
interface OpenAIConfig {
  apiKey?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

/**
 * OpenAIIntegration provides natural language understanding
 * capabilities to enhance the command bar functionality.
 */
class OpenAIIntegration {
  private apiKey: string | null = null;
  private model: string;
  private temperature: number;
  private maxTokens: number;
  private isEnabled: boolean = false;

  constructor(configOptions: OpenAIConfig = {}) {
    // Use provided API key or fallback to global config
    this.apiKey = configOptions.apiKey || config.openai.apiKey || null;
    this.model = configOptions.model || config.openai.model;
    this.temperature = configOptions.temperature || 0.7;
    this.maxTokens = configOptions.maxTokens || 256;
    
    // Check if API key is available
    this.isEnabled = !!this.apiKey;
    
    if (!this.isEnabled) {
      console.warn('OpenAI integration disabled: No API key provided');
    } else {
      console.log(`OpenAI integration enabled with model: ${this.model}`);
    }

    localStorage.removeItem('standalone-test_patterns');
    localStorage.removeItem('standalone-test_workflows');
  }

  /**
   * Process a natural language command and find matching actions
   * @param query User's natural language query
   * @param availableActions List of available actions
   * @param availableWorkflows List of available workflows
   * @returns Promise with matching actions/workflows or null if unable to process
   */
  public async processCommand(
    query: string, 
    availableActions: Action[], 
    availableWorkflows: Workflow[]
  ): Promise<(Action | Workflow)[]> {
    if (!this.isEnabled || !query.trim()) {
      return [];
    }
    
    try {
      // Simple keyword matching when no API key is available
      if (!this.apiKey) {
        return this.performKeywordMatching(query, availableActions, availableWorkflows);
      }
      
      // Create context for the AI
      const actionsContext = availableActions.map(action => (
        `- ${action.description} (ID: ${action.id}, Type: ${action.type})`
      )).join('\n');
      
      const workflowsContext = availableWorkflows.map(workflow => (
        `- ${workflow.name}: ${workflow.description} (ID: ${workflow.id})`
      )).join('\n');
      
      // Create the prompt
      const prompt = `
You are an AI assistant helping a user find the right action or workflow based on their request.
The user is looking for: "${query}"

Available Actions:
${actionsContext || 'No actions available.'}

Available Workflows:
${workflowsContext || 'No workflows available.'}

Return up to 3 most relevant matches in JSON format:
[
  {
    "id": "the-id",
    "type": "action or workflow",
    "confidence": 0.95 // 0-1 score of match confidence
  }
]
`;
      
      // Call OpenAI API
      const response = await this.callOpenAI(prompt);
      
      // Parse response to get action/workflow IDs
      const matches = this.parseOpenAIResponse(response);
      
      // Find the actual actions/workflows
      return matches.map(match => {
        if (match.type === 'action') {
          return availableActions.find(a => a.id === match.id);
        } else {
          return availableWorkflows.find(w => w.id === match.id);
        }
      }).filter(item => !!item) as (Action | Workflow)[];
      
    } catch (error) {
      console.error('Error processing command with OpenAI:', error);
      return [];
    }
  }

  /**
   * Generate action descriptions for new workflows
   * @param actions The sequence of actions to describe
   * @returns Promise with a generated name and description
   */
  public async generateWorkflowDescription(
    actions: Action[]
  ): Promise<{ name: string; description: string } | null> {
    if (!this.isEnabled || actions.length === 0) {
      return null;
    }
    
    try {
      // Simple description generation when no API key is available
      if (!this.apiKey) {
        return {
          name: `Workflow with ${actions.length} actions`,
          description: `${actions[0].description} → ${actions[actions.length - 1].description}`
        };
      }
      
      // Create context for the AI
      const actionsContext = actions.map((action, index) => (
        `${index + 1}. ${action.description} (Type: ${action.type})`
      )).join('\n');
      
      // Create the prompt
      const prompt = `
You are an AI assistant helping name and describe a new workflow based on its actions.

The workflow consists of these actions in sequence:
${actionsContext}

Create a short name and description for this workflow. Return in JSON format:
{
  "name": "A concise name (max 5 words)",
  "description": "A brief description (max 15 words)"
}
`;
      
      // Call OpenAI API
      const response = await this.callOpenAI(prompt);
      
      // Parse response to get workflow name and description
      return this.parseWorkflowDescription(response);
      
    } catch (error) {
      console.error('Error generating workflow description with OpenAI:', error);
      return null;
    }
  }

  /**
   * Perform simple keyword matching when OpenAI API is not available
   */
  private performKeywordMatching(
    query: string, 
    availableActions: Action[], 
    availableWorkflows: Workflow[]
  ): (Action | Workflow)[] {
    const results: (Action | Workflow)[] = [];
    const keywords = query.toLowerCase().split(/\s+/);
    
    // Score actions
    const actionScores = availableActions.map(action => {
      const text = `${action.description} ${action.type}`.toLowerCase();
      let score = 0;
      
      keywords.forEach(keyword => {
        if (text.includes(keyword)) {
          score += 1;
        }
      });
      
      return { item: action, score, type: 'action' as const };
    });
    
    // Score workflows
    const workflowScores = availableWorkflows.map(workflow => {
      const text = `${workflow.name} ${workflow.description}`.toLowerCase();
      let score = 0;
      
      keywords.forEach(keyword => {
        if (text.includes(keyword)) {
          score += 1;
        }
      });
      
      return { item: workflow, score, type: 'workflow' as const };
    });
    
    // Combine and sort by score
    const allScores = [...actionScores, ...workflowScores]
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score);
    
    // Take top 3 results
    return allScores.slice(0, 3).map(item => item.item);
  }

  /**
   * Call the OpenAI API with a prompt
   */
  private async callOpenAI(prompt: string): Promise<string> {
    if (!this.apiKey) {
      throw new Error('OpenAI API key is required');
    }
    
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: this.model,
          messages: [{ role: 'user', content: prompt }],
          temperature: this.temperature,
          max_tokens: this.maxTokens
        })
      });
      
      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      return data.choices?.[0]?.message?.content || '';
      
    } catch (error) {
      console.error('Error calling OpenAI API:', error);
      throw error;
    }
  }

  /**
   * Parse OpenAI response for command matching
   */
  private parseOpenAIResponse(response: string): Array<{ id: string; type: string; confidence: number }> {
    try {
      // Extract JSON from response (in case there's additional text)
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (!jsonMatch) return [];
      
      const jsonStr = jsonMatch[0];
      const matches = JSON.parse(jsonStr);
      
      return matches.filter((match: any) => 
        match && match.id && match.type && typeof match.confidence === 'number'
      );
    } catch (error) {
      console.error('Error parsing OpenAI response:', error);
      return [];
    }
  }

  /**
   * Parse OpenAI response for workflow description
   */
  private parseWorkflowDescription(response: string): { name: string; description: string } | null {
    try {
      // Extract JSON from response (in case there's additional text)
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return null;
      
      const jsonStr = jsonMatch[0];
      const result = JSON.parse(jsonStr);
      
      if (result && result.name && result.description) {
        return {
          name: result.name,
          description: result.description
        };
      }
      
      return null;
    } catch (error) {
      console.error('Error parsing OpenAI workflow description:', error);
      return null;
    }
  }
}

export default OpenAIIntegration; 