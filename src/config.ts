/**
 * Configuration for the Cell AI Command Bar
 */
export const config = {
  /**
   * OpenAI API configuration
   */
  openai: {
    /**
     * OpenAI API Key
     */
    apiKey: process.env.OPENAI_API_KEY || '', // Set your API key in environment variables
    
    /**
     * OpenAI Model to use
     */
    model: 'gpt-4o-mini'
  },
  
  /**
   * Default settings
   */
  defaults: {
    suggestionThreshold: 0.7,
    maxPatternLength: 10,
    maxStoredPatterns: 1000
  }
}; 