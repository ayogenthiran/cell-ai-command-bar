/**
 * Cell AI Command Bar Configuration - SAMPLE FILE
 * Copy this file to config.js and add your own API key
 */
const config = {
  // OpenAI API Configuration
  openai: {
    apiKey: 'YOUR_OPENAI_API_KEY_HERE',
    model: 'gpt-4o-mini'
  },
  
  // Application Settings
  app: {
    id: 'standalone-test',
    suggestionThreshold: 0.6
  }
};

// Make config available globally
window.CELL_CONFIG = config; 