import { NetworkRequest, Prediction, Action, PredictionCallback, CellOptions } from '../types';
import { generateId, stringSimilarity } from '../utils/helpers';
import { saveRequest, getRequestHistory, savePattern, getPatterns, saveAction, getActions } from '../utils/storage';

/**
 * PatternEngine analyzes request patterns and predicts next actions
 */
class PatternEngine {
  private options: CellOptions;
  private currentSequence: NetworkRequest[] = [];
  private predictionCallbacks: PredictionCallback[] = [];
  private isRunning: boolean = false;
  private actionCache: Record<string, Action> = {};
  private patternAnalysisTimer: number | null = null;

  constructor(options: CellOptions) {
    this.options = {
      maxPatternLength: 10,
      maxStoredPatterns: 1000,
      ...options
    };
    this.actionCache = getActions();
  }

  /**
   * Start the pattern engine
   */
  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.analyzeHistoricalPatterns();
    console.log('PatternEngine: Started pattern recognition');
  }

  /**
   * Stop the pattern engine
   */
  public stop(): void {
    if (!this.isRunning) return;
    this.isRunning = false;
    if (this.patternAnalysisTimer) {
      clearTimeout(this.patternAnalysisTimer);
    }
    console.log('PatternEngine: Stopped pattern recognition');
  }

  /**
   * Add a network request to the current sequence
   * @param request The network request to add
   */
  public addRequest(request: NetworkRequest): void {
    if (!this.isRunning) return;
    
    // Save request to storage
    saveRequest(request, this.options.maxStoredPatterns || 1000);
    
    // Add to current sequence
    this.currentSequence.push(request);
    
    // Trim sequence if it exceeds max length
    const maxLength = this.options.maxPatternLength || 10;
    if (this.currentSequence.length > maxLength) {
      this.currentSequence.shift();
    }
    
    // Predict next action based on current sequence
    this.predictNextAction();
    
    // Periodically analyze patterns in the background
    if (!this.patternAnalysisTimer) {
      this.patternAnalysisTimer = setTimeout(() => {
        this.analyzeHistoricalPatterns();
        this.patternAnalysisTimer = null;
      }, 30000); // Run analysis every 30 seconds
    }
  }

  /**
   * Register callback for predictions
   * @param callback Function to call when a prediction is made
   */
  public onPrediction(callback: PredictionCallback): void {
    this.predictionCallbacks.push(callback);
  }

  /**
   * Remove prediction callback
   * @param callback The callback to remove
   */
  public offPrediction(callback: PredictionCallback): void {
    this.predictionCallbacks = this.predictionCallbacks.filter(cb => cb !== callback);
  }

  /**
   * Get the current sequence of requests
   * @returns The current sequence
   */
  public getCurrentSequence(): NetworkRequest[] {
    return [...this.currentSequence];
  }

  /**
   * Predict the next likely action based on the current sequence
   */
  private predictNextAction(): void {
    if (this.currentSequence.length < 2) return;
    
    const patterns = getPatterns();
    const sequenceIds = this.currentSequence.map(req => req.id);
    
    // Try to find matching patterns of decreasing length
    const maxPatternLength = this.options.maxPatternLength || 10;
    for (let patternLength = Math.min(this.currentSequence.length - 1, maxPatternLength); patternLength >= 2; patternLength--) {
      const lookupPattern = sequenceIds.slice(-patternLength).join(',');
      
      // Search for patterns that start with our sequence
      for (const pattern in patterns) {
        if (pattern.startsWith(lookupPattern) && pattern !== lookupPattern) {
          // We found a pattern that matches our current sequence and has a next step
          const confidence = this.calculateConfidence(pattern, patterns[pattern]);
          
          if (confidence >= 0.3) { // Minimum threshold to consider
            const nextActionId = pattern.split(',')[patternLength];
            const prediction = this.createPrediction(nextActionId, confidence);
            
            if (prediction) {
              this.notifyPredictionCallbacks(prediction);
              return;
            }
          }
        }
      }
    }
    
    // If no exact match, try fuzzy matching
    this.fuzzyMatchAction();
  }

  /**
   * Try to find similar patterns when exact match fails
   */
  private fuzzyMatchAction(): void {
    if (this.currentSequence.length < 2) return;
    
    const lastRequest = this.currentSequence[this.currentSequence.length - 1];
    const history = getRequestHistory();
    const similarRequests: NetworkRequest[] = [];
    
    // Find similar requests to the last one in the current sequence
    history.forEach(request => {
      if (request.id !== lastRequest.id) {
        const urlSimilarity = stringSimilarity(request.url, lastRequest.url);
        const methodSimilarity = request.method === lastRequest.method ? 1 : 0;
        
        const totalSimilarity = (urlSimilarity * 0.8) + (methodSimilarity * 0.2);
        
        if (totalSimilarity > 0.8) {
          similarRequests.push(request);
        }
      }
    });
    
    if (similarRequests.length === 0) return;
    
    // Find what usually follows these similar requests
    const nextActions: Record<string, number> = {};
    let totalOccurrences = 0;
    
    similarRequests.forEach(similarRequest => {
      const index = history.findIndex(req => req.id === similarRequest.id);
      
      if (index !== -1 && index < history.length - 1) {
        const nextRequest = history[index + 1];
        
        if (!nextActions[nextRequest.id]) {
          nextActions[nextRequest.id] = 0;
        }
        
        nextActions[nextRequest.id]++;
        totalOccurrences++;
      }
    });
    
    if (totalOccurrences === 0) return;
    
    // Find most common next action
    let bestActionId: string | null = null;
    let bestCount = 0;
    
    for (const actionId in nextActions) {
      if (nextActions[actionId] > bestCount) {
        bestCount = nextActions[actionId];
        bestActionId = actionId;
      }
    }
    
    if (bestActionId) {
      const confidence = bestCount / totalOccurrences;
      const prediction = this.createPrediction(bestActionId, confidence);
      
      if (prediction) {
        this.notifyPredictionCallbacks(prediction);
      }
    }
  }

  /**
   * Create a prediction object from an action ID
   * @param actionId The action ID
   * @param confidence Confidence level (0-1)
   * @returns Prediction object or null if action not found
   */
  private createPrediction(actionId: string, confidence: number): Prediction | null {
    // First, check if action exists in our cache
    if (!this.actionCache[actionId]) {
      // If not, we need to create it from the request history
      const history = getRequestHistory();
      const request = history.find(req => req.id === actionId);
      
      if (!request) return null;
      
      // Create an action from the request
      const action: Action = {
        id: actionId,
        type: 'api',
        description: `${request.method} ${request.url}`,
        url: request.url,
        options: {
          method: request.method,
          headers: request.headers,
          body: request.body
        }
      };
      
      // Save to cache and storage
      this.actionCache[actionId] = action;
      saveAction(action);
    }
    
    return {
      confidence,
      action: this.actionCache[actionId],
      context: this.getContextDescription()
    };
  }

  /**
   * Calculate prediction confidence based on pattern frequency
   * @param pattern The pattern string
   * @param frequency How often this pattern has been seen
   * @returns Confidence score (0-1)
   */
  private calculateConfidence(pattern: string, frequency: number): number {
    // Base confidence from frequency (more frequent patterns are more likely)
    const frequencyFactor = Math.min(frequency / 10, 1);
    
    // Length factor (longer matching patterns are more specific/precise)
    const lengthFactor = Math.min(pattern.split(',').length / 10, 1);
    
    // Recency factor (more recent patterns are weighted higher)
    const recencyFactor = this.calculateRecencyFactor();
    
    // Calculate final confidence score
    return (frequencyFactor * 0.6) + (lengthFactor * 0.3) + (recencyFactor * 0.1);
  }

  /**
   * Calculate recency factor based on time elapsed since actions in sequence
   * @returns Recency factor (0-1)
   */
  private calculateRecencyFactor(): number {
    if (this.currentSequence.length === 0) return 0;
    
    const now = Date.now();
    const timestamps = this.currentSequence.map(req => req.timestamp);
    const avgTime = timestamps.reduce((sum, time) => sum + time, 0) / timestamps.length;
    const timeDiff = now - avgTime;
    
    // Decay factor: 1.0 for very recent, approaches 0 for older patterns
    // 1 hour (3600000 ms) is the half-life
    return Math.exp(-timeDiff / 3600000);
  }

  /**
   * Analyze historical patterns to improve prediction
   */
  private analyzeHistoricalPatterns(): void {
    if (!this.isRunning) return;
    
    const history = getRequestHistory();
    const patterns: Record<string, number> = {};
    
    // Analyze patterns of different lengths
    const maxPatternLength = this.options.maxPatternLength || 10;
    for (let patternLength = 2; patternLength <= maxPatternLength; patternLength++) {
      for (let i = 0; i <= history.length - patternLength; i++) {
        const pattern = history.slice(i, i + patternLength).map(req => req.id).join(',');
        
        if (!patterns[pattern]) {
          patterns[pattern] = 0;
        }
        
        patterns[pattern]++;
      }
    }
    
    // Save identified patterns to storage
    for (const pattern in patterns) {
      savePattern(pattern.split(','), patterns[pattern]);
    }
    
    console.log(`PatternEngine: Analyzed ${history.length} requests and found ${Object.keys(patterns).length} patterns`);
  }

  /**
   * Create a human-readable description of the current context
   * @returns Context description
   */
  private getContextDescription(): string {
    if (this.currentSequence.length === 0) return '';
    
    const lastRequest = this.currentSequence[this.currentSequence.length - 1];
    return `After ${lastRequest.method} request to ${lastRequest.url}`;
  }

  /**
   * Notify all callbacks about a new prediction
   * @param prediction The prediction to share
   */
  private notifyPredictionCallbacks(prediction: Prediction): void {
    this.predictionCallbacks.forEach(callback => {
      try {
        callback(prediction);
      } catch (error) {
        console.error('Error in prediction callback:', error);
      }
    });
  }
}

export default PatternEngine; 