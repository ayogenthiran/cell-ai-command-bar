/**
 * Simplified Cell AI Command Bar
 * This is a standalone version that doesn't depend on external modules
 */

class Cell {
  constructor(options = {}) {
    // Load configuration from config.js if available
    const config = window.CELL_CONFIG || {};
    
    this.options = {
      appId: options.appId || config.app?.id || 'default',
      enableAI: options.enableAI ?? true,
      openAIApiKey: options.openAIApiKey || config.openai?.apiKey || null,
      openAIModel: options.openAIModel || config.openai?.model || 'gpt-4o-mini',
      suggestionThreshold: options.suggestionThreshold || config.app?.suggestionThreshold || 0.7
    };
    
    this.isRunning = false;
    this.requests = [];
    this.commandBarVisible = false;
    
    // Pattern recognition
    this.patterns = this.loadPatterns();
    this.currentSequence = [];
    this.patternThreshold = 2; // Minimum occurrences to recognize a pattern
    
    // Workflows
    this.workflows = this.loadWorkflows();
    this.recordingWorkflow = false;
    this.currentWorkflow = [];
    
    console.log('Cell initialized with options:', JSON.stringify({
      ...this.options,
      openAIApiKey: this.options.openAIApiKey ? '[REDACTED]' : null
    }));
  }
  
  start() {
    if (this.isRunning) return;
    
    console.log('Starting Cell...');
    
    // Set up basic interception
    this.setupNetworkInterception();
    
    // Set up command bar keyboard shortcut
    this.setupCommandBarShortcut();
    
    // Set up suggestion display
    this.setupSuggestionUI();
    
    this.isRunning = true;
    console.log('Cell started successfully!');
    
    // Make a test API call if OpenAI is enabled
    if (this.options.enableAI && this.options.openAIApiKey) {
      this.testAIIntegration();
    }
    
    // Start pattern analysis
    this.startPatternAnalysis();
  }
  
  stop() {
    if (!this.isRunning) return;
    this.isRunning = false;
    
    // Stop pattern analysis
    if (this.patternAnalysisInterval) {
      clearInterval(this.patternAnalysisInterval);
    }
    
    console.log('Cell stopped');
  }
  
  setupNetworkInterception() {
    // Store original fetch
    this.originalFetch = window.fetch;
    
    // Override fetch
    const self = this;
    window.fetch = function(...args) {
      // Create unique request signature
      const url = typeof args[0] === 'string' ? args[0] : args[0].url;
      const method = args[1]?.method || 'GET';
      
      // Validate URL
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        console.error('Invalid URL:', url);
        return self.originalFetch.apply(this, args);
      }
      
      // Capture request details
      const request = {
        id: self.generateId(),
        url,
        method,
        timestamp: Date.now(),
        signature: `${method}:${url}`
      };
      
      self.requests.push(request);
      console.log('Cell intercepted request to:', request.url);
      
      // Add to current sequence for pattern recognition
      self.addToSequence(request);
      
      // Add to workflow if recording
      if (self.recordingWorkflow) {
        self.addToWorkflow(request);
      }
      
      // Call original fetch
      return self.originalFetch.apply(this, args).then(response => {
        // Clone the response so we can still use it
        let responseClone = response.clone();
        
        // Try to get response body if it's JSON
        responseClone.json().catch(() => {}).then(body => {
          if (body) {
            request.responseBody = body;
          }
        });
        
        return response;
      });
    };
    
    console.log('Network interception set up');
  }
  
  setupCommandBarShortcut() {
    // Set up keyboard shortcut (Cmd+K / Ctrl+K)
    const self = this;
    document.addEventListener('keydown', function(e) {
      if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        self.showCommandBar();
      } else if (e.key === 'Tab' && !e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey) {
        // Check if we have an active suggestion
        if (self.activeSuggestion) {
          e.preventDefault();
          self.executeActiveSuggestion();
        }
      }
    });
    
    console.log('Command bar shortcut set up (Cmd+K / Ctrl+K)');
  }
  
  showCommandBar() {
    if (this.commandBarVisible) return;
    
    console.log('Showing command bar...');
    
    // Create a simple command bar interface
    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.top = '20%';
    container.style.left = '50%';
    container.style.transform = 'translateX(-50%)';
    container.style.width = '500px';
    container.style.backgroundColor = 'white';
    container.style.borderRadius = '8px';
    container.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
    container.style.padding = '16px';
    container.style.zIndex = '9999';
    
    // Input
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Type a command...';
    input.style.width = '100%';
    input.style.padding = '8px 12px';
    input.style.borderRadius = '4px';
    input.style.border = '1px solid #ddd';
    input.style.fontSize = '16px';
    container.appendChild(input);
    
    // Autocomplete suggestions
    const suggestions = document.createElement('div');
    suggestions.style.position = 'absolute';
    suggestions.style.top = '100%';
    suggestions.style.left = '0';
    suggestions.style.right = '0';
    suggestions.style.backgroundColor = 'white';
    suggestions.style.border = '1px solid #ddd';
    suggestions.style.borderTop = 'none';
    suggestions.style.borderRadius = '0 0 4px 4px';
    suggestions.style.maxHeight = '200px';
    suggestions.style.overflowY = 'auto';
    suggestions.style.display = 'none';
    container.appendChild(suggestions);
    
    // Status text
    const status = document.createElement('div');
    status.style.marginTop = '8px';
    status.style.fontSize = '14px';
    status.style.color = '#666';
    if (this.options.enableAI) {
      status.textContent = 'AI-enabled command bar is ready. Try typing a command.';
    } else {
      status.textContent = 'Command bar ready. AI enhancement is disabled.';
    }
    container.appendChild(status);
    
    // Results container
    const results = document.createElement('div');
    results.style.marginTop = '12px';
    results.style.maxHeight = '200px';
    results.style.overflowY = 'auto';
    container.appendChild(results);
    
    // Add to document
    document.body.appendChild(container);
    
    // Handle input events
    const self = this;
    input.addEventListener('input', function(e) {
      const value = input.value.trim().toLowerCase();
      if (value) {
        // Get matching commands
        const matches = self.getMatchingCommands(value);
        if (matches.length > 0) {
          // Show suggestions
          suggestions.innerHTML = '';
          matches.forEach(match => {
            const div = document.createElement('div');
            div.style.padding = '8px 12px';
            div.style.cursor = 'pointer';
            div.textContent = match;
            div.addEventListener('mouseover', () => {
              div.style.backgroundColor = '#f3f4f6';
            });
            div.addEventListener('mouseout', () => {
              div.style.backgroundColor = 'white';
            });
            div.addEventListener('click', () => {
              input.value = match;
              suggestions.style.display = 'none';
              input.focus();
            });
            suggestions.appendChild(div);
          });
          suggestions.style.display = 'block';
        } else {
          suggestions.style.display = 'none';
        }
      } else {
        suggestions.style.display = 'none';
      }
    });
    
    input.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        const command = input.value.trim();
        if (command) {
          // Clear the input
          input.value = '';
          suggestions.style.display = 'none';
          
          // Show a loading message
          status.textContent = 'Processing command...';
          
          // Process the command
          self.processCommand(command, results, status);
        }
      } else if (e.key === 'Escape') {
        suggestions.style.display = 'none';
      }
    });
    
    // Handle click outside
    document.addEventListener('click', function closeCommandBar(e) {
      if (!container.contains(e.target)) {
        document.body.removeChild(container);
        document.removeEventListener('click', closeCommandBar);
        self.commandBarVisible = false;
      }
    });
    
    // Handle escape key
    document.addEventListener('keydown', function closeOnEscape(e) {
      if (e.key === 'Escape') {
        document.body.removeChild(container);
        document.removeEventListener('keydown', closeOnEscape);
        self.commandBarVisible = false;
      }
    });
    
    this.commandBarVisible = true;
    
    // Focus the input
    setTimeout(() => input.focus(), 100);
  }
  
  /**
   * Get matching commands based on input
   * @param {string} input Current input text
   * @returns {Array} List of matching commands
   */
  getMatchingCommands(input) {
    const commands = [
      'help',
      'add user',
      'make api call',
      'record workflow',
      'stop recording',
      'list workflows',
      'run workflow',
      'show workflows'
    ];
    
    return commands.filter(cmd => cmd.toLowerCase().includes(input));
  }
  
  /**
   * Process a command entered in the command bar
   * @param {string} command The command to process
   * @param {HTMLElement} resultsElement Element to display results
   * @param {HTMLElement} statusElement Element to display status
   */
  processCommand(command, resultsElement, statusElement) {
    console.log('Processing command:', command);
    
    // Check if command matches known patterns without AI
    const lowerCommand = command.toLowerCase();
    
    // Workflow commands
    if (lowerCommand === 'start recording' || lowerCommand === 'record workflow') {
      if (this.recordingWorkflow) {
        this.showMessage(resultsElement, 'Already recording a workflow. Use "stop recording" to save it first.', 'warning');
        statusElement.textContent = 'Already recording.';
        return;
      }
      this.startWorkflowRecording();
      this.showWorkflowMessage(resultsElement, 'Started recording a new workflow. Perform the actions you want to record, then use "stop recording" to save the workflow.');
      statusElement.textContent = 'Recording workflow...';
      return;
    }
    
    if (lowerCommand === 'stop recording' || lowerCommand === 'save workflow') {
      if (!this.recordingWorkflow) {
        this.showMessage(resultsElement, 'No workflow is currently being recorded.', 'warning');
        statusElement.textContent = 'Not recording.';
        return;
      }
      const workflow = this.stopWorkflowRecording();
      if (workflow) {
        this.showWorkflowSaved(resultsElement, workflow);
        statusElement.textContent = 'Workflow saved successfully.';
      } else {
        this.showMessage(resultsElement, 'No workflow was being recorded or the workflow was empty.', 'warning');
        statusElement.textContent = 'No workflow to save.';
      }
      return;
    }
    
    if (lowerCommand.startsWith('run workflow') || lowerCommand.startsWith('execute workflow')) {
      const workflows = this.getWorkflows();
      if (workflows.length === 0) {
        this.showMessage(resultsElement, 'No workflows available. Create a workflow first by using "record workflow".', 'warning');
        statusElement.textContent = 'No workflows available.';
        return;
      }
      
      this.showWorkflowList(resultsElement, workflows);
      statusElement.textContent = 'Select a workflow to run.';
      return;
    }
    
    if (lowerCommand.startsWith('list workflows') || lowerCommand === 'workflows' || lowerCommand === 'show workflows') {
      const workflows = this.getWorkflows();
      if (workflows.length === 0) {
        this.showMessage(resultsElement, 'No workflows available. Create a workflow first by using "record workflow".', 'warning');
        statusElement.textContent = 'No workflows available.';
      } else {
        this.showWorkflowList(resultsElement, workflows);
        statusElement.textContent = 'Workflows listed.';
      }
      return;
    }
    
    // Regular commands
    if (lowerCommand.includes('add user')) {
      this.executeAddUserCommand(resultsElement, statusElement);
      return;
    }
    
    if (lowerCommand.includes('make api call') || lowerCommand.includes('api request')) {
      this.executeMakeApiCallCommand(resultsElement, statusElement);
      return;
    }
    
    if (lowerCommand === 'help') {
      this.showHelp(resultsElement);
      statusElement.textContent = 'Showing available commands.';
      return;
    }
    
    // If no pattern matches and AI is enabled, use OpenAI
    if (this.options.enableAI && this.options.openAIApiKey) {
      this.processWithAI(command, resultsElement, statusElement);
    } else {
      statusElement.textContent = 'Command not recognized. Try "help" to see available commands.';
      this.showMessage(resultsElement, 'Command not recognized. Try "help" to see available commands.', 'error');
    }
  }
  
  /**
   * Display a message in the results area
   * @param {HTMLElement} resultsElement Element to display results
   * @param {string} message Message to display
   * @param {string} type Message type (info, success, warning, error)
   */
  showMessage(resultsElement, message, type = 'info') {
    // Create a result element
    const resultElement = document.createElement('div');
    resultElement.style.padding = '12px';
    resultElement.style.borderRadius = '4px';
    resultElement.style.marginBottom = '8px';
    
    // Set style based on type
    switch (type) {
      case 'success':
        resultElement.style.backgroundColor = '#f0fff4';
        resultElement.style.border = '1px solid #c6f6d5';
        break;
      case 'warning':
        resultElement.style.backgroundColor = '#fffbeb';
        resultElement.style.border = '1px solid #feebc8';
        break;
      case 'error':
        resultElement.style.backgroundColor = '#fff5f5';
        resultElement.style.border = '1px solid #fed7d7';
        break;
      default: // info
        resultElement.style.backgroundColor = '#ebf8ff';
        resultElement.style.border = '1px solid #bee3f8';
    }
    
    // Add message
    resultElement.textContent = message;
    
    // Add to results
    resultsElement.appendChild(resultElement);
  }
  
  /**
   * Show a message about workflow recording
   * @param {HTMLElement} resultsElement Element to display results
   * @param {string} message Message to display
   */
  showWorkflowMessage(resultsElement, message) {
    // Create a result element
    const resultElement = document.createElement('div');
    resultElement.style.padding = '12px';
    resultElement.style.borderRadius = '4px';
    resultElement.style.backgroundColor = '#ebf8ff';
    resultElement.style.border = '1px solid #bee3f8';
    resultElement.style.marginBottom = '8px';
    
    // Add recording indicator
    const recordingIndicator = document.createElement('div');
    recordingIndicator.style.display = 'flex';
    recordingIndicator.style.alignItems = 'center';
    recordingIndicator.style.marginBottom = '8px';
    
    const recordingDot = document.createElement('span');
    recordingDot.style.width = '10px';
    recordingDot.style.height = '10px';
    recordingDot.style.borderRadius = '50%';
    recordingDot.style.backgroundColor = '#e53e3e';
    recordingDot.style.marginRight = '8px';
    recordingDot.style.animation = 'cell-recording-pulse 1.5s ease infinite';
    
    // Add animation keyframes
    if (!document.getElementById('cell-recording-animation')) {
      const style = document.createElement('style');
      style.id = 'cell-recording-animation';
      style.textContent = `
        @keyframes cell-recording-pulse {
          0% { opacity: 1; }
          50% { opacity: 0.4; }
          100% { opacity: 1; }
        }
      `;
      document.head.appendChild(style);
    }
    
    recordingIndicator.appendChild(recordingDot);
    
    const recordingText = document.createElement('span');
    recordingText.style.fontWeight = 'bold';
    recordingText.textContent = 'Recording Workflow';
    recordingIndicator.appendChild(recordingText);
    
    resultElement.appendChild(recordingIndicator);
    
    // Add message
    const messageElement = document.createElement('div');
    messageElement.textContent = message;
    resultElement.appendChild(messageElement);
    
    // Add to results
    resultsElement.appendChild(resultElement);
  }
  
  /**
   * Show workflow saved message
   * @param {HTMLElement} resultsElement Element to display results
   * @param {Object} workflow The saved workflow
   */
  showWorkflowSaved(resultsElement, workflow) {
    // Create a result element
    const resultElement = document.createElement('div');
    resultElement.style.padding = '12px';
    resultElement.style.borderRadius = '4px';
    resultElement.style.backgroundColor = '#f0fff4';
    resultElement.style.border = '1px solid #c6f6d5';
    resultElement.style.marginBottom = '8px';
    
    // Add success message
    const header = document.createElement('div');
    header.style.fontWeight = 'bold';
    header.style.marginBottom = '8px';
    header.textContent = 'Workflow Saved Successfully';
    resultElement.appendChild(header);
    
    // Add workflow details
    const details = document.createElement('div');
    details.innerHTML = `
      <div><strong>Name:</strong> ${workflow.name}</div>
      <div><strong>Steps:</strong> ${workflow.steps.length}</div>
      <div><strong>Description:</strong> ${workflow.description}</div>
    `;
    resultElement.appendChild(details);
    
    // Add execute button
    const button = document.createElement('button');
    button.textContent = 'Execute Workflow';
    button.style.marginTop = '10px';
    button.style.padding = '6px 12px';
    button.style.backgroundColor = '#4f46e5';
    button.style.color = 'white';
    button.style.border = 'none';
    button.style.borderRadius = '4px';
    button.style.cursor = 'pointer';
    button.onclick = () => this.executeWorkflow(workflow.id);
    
    resultElement.appendChild(button);
    
    // Add to results
    resultsElement.appendChild(resultElement);
  }
  
  /**
   * Show a list of available workflows
   * @param {HTMLElement} resultsElement Element to display results
   * @param {Array} workflows List of workflows
   */
  showWorkflowList(resultsElement, workflows) {
    // Create a result element
    const resultElement = document.createElement('div');
    resultElement.style.padding = '12px';
    resultElement.style.borderRadius = '4px';
    resultElement.style.backgroundColor = '#f9fafb';
    resultElement.style.border = '1px solid #e5e7eb';
    resultElement.style.marginBottom = '8px';
    
    // Add header
    const header = document.createElement('div');
    header.style.fontWeight = 'bold';
    header.style.marginBottom = '8px';
    header.textContent = 'Available Workflows';
    resultElement.appendChild(header);
    
    // Create workflow list
    const list = document.createElement('div');
    
    workflows.forEach(workflow => {
      const item = document.createElement('div');
      item.style.padding = '8px';
      item.style.borderBottom = '1px solid #e5e7eb';
      item.style.display = 'flex';
      item.style.justifyContent = 'space-between';
      item.style.alignItems = 'center';
      
      const info = document.createElement('div');
      info.innerHTML = `
        <div><strong>${workflow.name}</strong></div>
        <div style="font-size: 12px; color: #6b7280;">${workflow.description}</div>
      `;
      
      const button = document.createElement('button');
      button.textContent = 'Execute';
      button.style.padding = '4px 8px';
      button.style.backgroundColor = '#4f46e5';
      button.style.color = 'white';
      button.style.border = 'none';
      button.style.borderRadius = '4px';
      button.style.cursor = 'pointer';
      button.style.fontSize = '12px';
      button.onclick = () => {
        this.executeWorkflow(workflow.id);
        
        // Add execution message
        const execMessage = document.createElement('div');
        execMessage.style.padding = '8px';
        execMessage.style.backgroundColor = '#f0fff4';
        execMessage.style.borderRadius = '4px';
        execMessage.style.marginTop = '8px';
        execMessage.textContent = `Executing workflow: ${workflow.name}`;
        item.appendChild(execMessage);
      };
      
      item.appendChild(info);
      item.appendChild(button);
      list.appendChild(item);
    });
    
    resultElement.appendChild(list);
    
    // Add to results
    resultsElement.appendChild(resultElement);
  }
  
  showHelp(resultsElement) {
    console.log('Showing help');
    
    // Create a result element
    const resultElement = document.createElement('div');
    resultElement.style.padding = '12px';
    resultElement.style.borderRadius = '4px';
    resultElement.style.backgroundColor = '#f5f7fa';
    resultElement.style.marginBottom = '8px';
    
    // Add help information
    resultElement.innerHTML = `
      <div style="font-weight: bold; margin-bottom: 12px;">Available Commands</div>
      
      <div style="font-weight: bold; margin-top: 10px;">Basic Commands</div>
      <ul style="margin: 4px 0; padding-left: 20px;">
        <li><strong>add user</strong> - Creates a new user</li>
        <li><strong>make api call</strong> - Makes a test API call</li>
        <li><strong>help</strong> - Shows this help information</li>
      </ul>
      
      <div style="font-weight: bold; margin-top: 10px;">Workflow Commands</div>
      <ul style="margin: 4px 0; padding-left: 20px;">
        <li><strong>record workflow</strong> - Start recording a new workflow</li>
        <li><strong>stop recording</strong> - Stop recording and save the workflow</li>
        <li><strong>list workflows</strong> - Display all available workflows</li>
        <li><strong>run workflow</strong> - Execute a saved workflow</li>
      </ul>
      
      <div style="font-weight: bold; margin-top: 10px;">Navigation</div>
      <ul style="margin: 4px 0; padding-left: 20px;">
        <li><strong>Tab key</strong> - Execute the current suggestion when shown</li>
        <li><strong>Cmd+K / Ctrl+K</strong> - Open the command bar</li>
        <li><strong>Escape</strong> - Close the command bar</li>
      </ul>
      
      <div style="font-style: italic; margin-top: 10px; font-size: 12px;">
        You can also use natural language to express commands.
      </div>
    `;
    
    // Add to results
    resultsElement.appendChild(resultElement);
  }
  
  /**
   * Process a command using OpenAI
   * @param {string} command The command to process
   * @param {HTMLElement} resultsElement Element to display results
   * @param {HTMLElement} statusElement Element to display status
   */
  processWithAI(command, resultsElement, statusElement) {
    console.log('Processing with AI:', command);
    
    // Create a simple prompt for OpenAI
    fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.options.openAIApiKey}`
      },
      body: JSON.stringify({
        model: this.options.openAIModel,
        messages: [
          {
            role: 'system',
            content: `You are an AI assistant integrated with Cell, a command bar for SaaS applications.
            
Available commands:
- add user: Creates a new user
- make api call: Makes a test API call
- help: Shows available commands
            
Process the user command and respond with a JSON object:
{
  "action": "add_user" | "make_api_call" | "help" | "unknown",
  "response": "Human readable response explaining what will happen",
  "confidence": 0.0-1.0
}`
          },
          {
            role: 'user',
            content: command
          }
        ],
        max_tokens: 150
      })
    })
    .then(response => response.json())
    .then(data => {
      const aiResponse = data.choices?.[0]?.message?.content;
      
      if (aiResponse) {
        console.log('AI response:', aiResponse);
        
        // Try to parse the JSON response
        try {
          const parsed = JSON.parse(aiResponse);
          
          // Create a result element
          const resultElement = document.createElement('div');
          resultElement.style.padding = '12px';
          resultElement.style.borderRadius = '4px';
          resultElement.style.backgroundColor = '#f5f7fa';
          resultElement.style.marginBottom = '8px';
          
          // Add the AI response
          resultElement.textContent = parsed.response;
          
          // Add to results
          resultsElement.appendChild(resultElement);
          
          // Update status
          statusElement.textContent = 'Command processed successfully.';
          
          // Execute the matched action if confidence is high enough
          if (parsed.confidence >= 0.7) {
            switch (parsed.action) {
              case 'add_user':
                this.executeAddUserCommand(resultsElement, statusElement);
                break;
              case 'make_api_call':
                this.executeMakeApiCallCommand(resultsElement, statusElement);
                break;
              case 'help':
                this.showHelp(resultsElement);
                break;
            }
          }
        } catch (error) {
          console.error('Error parsing AI response:', error);
          statusElement.textContent = 'Could not process AI response.';
        }
      } else {
        statusElement.textContent = 'No response from AI.';
      }
    })
    .catch(error => {
      console.error('Error calling OpenAI:', error);
      statusElement.textContent = 'Error processing with AI.';
    });
  }
  
  /**
   * Execute the "add user" command
   * @param {HTMLElement} resultsElement Element to display results
   * @param {HTMLElement} statusElement Element to display status
   */
  executeAddUserCommand(resultsElement, statusElement) {
    console.log('Executing add user command');
    
    // Mock user data
    const newUser = {
      id: Date.now(),
      name: 'New User',
      email: 'user@example.com',
      role: 'user'
    };
    
    // Create a result element
    const resultElement = document.createElement('div');
    resultElement.style.padding = '12px';
    resultElement.style.borderRadius = '4px';
    resultElement.style.backgroundColor = '#f0fff4';
    resultElement.style.marginBottom = '8px';
    resultElement.style.border = '1px solid #c6f6d5';
    
    // Add success message
    resultElement.innerHTML = `
      <div style="font-weight: bold; margin-bottom: 4px;">User Added Successfully</div>
      <div>ID: ${newUser.id}</div>
      <div>Name: ${newUser.name}</div>
      <div>Email: ${newUser.email}</div>
      <div>Role: ${newUser.role}</div>
    `;
    
    // Add to results
    resultsElement.appendChild(resultElement);
    
    // Update status
    statusElement.textContent = 'User added successfully.';
  }
  
  /**
   * Execute the "make api call" command
   * @param {HTMLElement} resultsElement Element to display results
   * @param {HTMLElement} statusElement Element to display status
   */
  executeMakeApiCallCommand(resultsElement, statusElement) {
    console.log('Executing make API call command');
    
    // Update status
    statusElement.textContent = 'Making API call...';
    
    // Make a test API call
    fetch('https://jsonplaceholder.typicode.com/todos/1')
      .then(response => response.json())
      .then(data => {
        // Create a result element
        const resultElement = document.createElement('div');
        resultElement.style.padding = '12px';
        resultElement.style.borderRadius = '4px';
        resultElement.style.backgroundColor = '#ebf8ff';
        resultElement.style.marginBottom = '8px';
        resultElement.style.border = '1px solid #bee3f8';
        
        // Add success message
        resultElement.innerHTML = `
          <div style="font-weight: bold; margin-bottom: 4px;">API Call Result</div>
          <pre style="margin: 0; overflow-x: auto;">${JSON.stringify(data, null, 2)}</pre>
        `;
        
        // Add to results
        resultsElement.appendChild(resultElement);
        
        // Update status
        statusElement.textContent = 'API call completed successfully.';
      })
      .catch(error => {
        console.error('API call error:', error);
        statusElement.textContent = 'Error making API call.';
      });
  }
  
  testAIIntegration() {
    console.log('Testing OpenAI integration...');
    
    // Create a simple test with the OpenAI API
    fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.options.openAIApiKey}`
      },
      body: JSON.stringify({
        model: this.options.openAIModel,
        messages: [
          {
            role: 'system',
            content: 'You are an AI assistant integrated with Cell AI Command Bar.'
          },
          {
            role: 'user',
            content: 'Hello! Are you working correctly?'
          }
        ],
        max_tokens: 50
      })
    })
    .then(response => response.json())
    .then(data => {
      console.log('OpenAI integration test result:', data.choices?.[0]?.message?.content || 'No response');
    })
    .catch(error => {
      console.error('OpenAI integration test failed:', error);
    });
  }
  
  /**
   * Load patterns from localStorage
   * @returns {Object} Saved patterns
   */
  loadPatterns() {
    try {
      const patterns = localStorage.getItem(`${this.options.appId}_patterns`);
      return patterns ? JSON.parse(patterns) : {};
    } catch (e) {
      console.error('Error loading patterns:', e);
      return {};
    }
  }
  
  /**
   * Save patterns to localStorage
   */
  savePatterns() {
    try {
      localStorage.setItem(`${this.options.appId}_patterns`, JSON.stringify(this.patterns));
    } catch (e) {
      console.error('Error saving patterns:', e);
    }
  }
  
  /**
   * Load workflows from localStorage
   * @returns {Array} Saved workflows
   */
  loadWorkflows() {
    try {
      const workflows = localStorage.getItem(`${this.options.appId}_workflows`);
      return workflows ? JSON.parse(workflows) : [];
    } catch (e) {
      console.error('Error loading workflows:', e);
      return [];
    }
  }
  
  /**
   * Save workflows to localStorage
   */
  saveWorkflows() {
    try {
      localStorage.setItem(`${this.options.appId}_workflows`, JSON.stringify(this.workflows));
    } catch (e) {
      console.error('Error saving workflows:', e);
    }
  }
  
  /**
   * Generate a unique ID
   * @returns {string} Unique ID
   */
  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  }
  
  /**
   * Add a request to the current sequence for pattern recognition
   * @param {Object} request The request to add
   */
  addToSequence(request) {
    // Add to current sequence
    this.currentSequence.push(request);
    
    // Limit sequence length to prevent memory issues
    if (this.currentSequence.length > 20) {
      this.currentSequence.shift();
    }
    
    // Check for patterns
    this.checkPatterns();
  }
  
  /**
   * Check if the current sequence matches any known patterns
   */
  checkPatterns() {
    if (this.currentSequence.length < 2) return;
    
    // Get the last request
    const lastRequest = this.currentSequence[this.currentSequence.length - 1];
    
    // Check if we have suggestions for what might come after this request
    const signature = lastRequest.signature;
    
    if (this.patterns[signature] && this.patterns[signature].followers) {
      const followers = this.patterns[signature].followers;
      
      // Find the most likely next request
      let bestMatch = null;
      let highestConfidence = 0;
      
      for (const followerSignature in followers) {
        const count = followers[followerSignature];
        const confidence = count / this.patterns[signature].total;
        
        if (confidence > highestConfidence && confidence >= this.options.suggestionThreshold) {
          highestConfidence = confidence;
          bestMatch = followerSignature;
        }
      }
      
      // If we found a likely next request
      if (bestMatch) {
        console.log(`Pattern recognized: "${signature}" is often followed by "${bestMatch}" (${(highestConfidence * 100).toFixed(1)}% confidence)`);
        
        // Create a suggestion
        this.createSuggestion(bestMatch, highestConfidence);
      }
    }
  }
  
  /**
   * Set up regular pattern analysis
   */
  startPatternAnalysis() {
    // Run pattern analysis every 10 seconds
    this.patternAnalysisInterval = setInterval(() => {
      this.analyzePatterns();
    }, 10000);
    
    console.log('Pattern analysis started');
  }
  
  /**
   * Analyze all requests to identify patterns
   */
  analyzePatterns() {
    if (this.requests.length < 3) return;
    
    console.log('Analyzing patterns...');
    
    // Analyze sequential pairs of requests
    for (let i = 0; i < this.requests.length - 1; i++) {
      const current = this.requests[i];
      const next = this.requests[i + 1];
      
      // Initialize pattern data if needed
      if (!this.patterns[current.signature]) {
        this.patterns[current.signature] = {
          total: 0,
          followers: {}
        };
      }
      
      // Update pattern data
      this.patterns[current.signature].total++;
      
      if (!this.patterns[current.signature].followers[next.signature]) {
        this.patterns[current.signature].followers[next.signature] = 0;
      }
      
      this.patterns[current.signature].followers[next.signature]++;
      
      // Check for repetitive patterns
      this.checkForRepetitivePatterns(current, next);
    }
    
    // Save updated patterns
    this.savePatterns();
    
    console.log('Pattern analysis complete, found patterns:', Object.keys(this.patterns).length);
  }
  
  /**
   * Check for repetitive patterns and suggest automation
   * @param {Object} current Current request
   * @param {Object} next Next request
   */
  checkForRepetitivePatterns(current, next) {
    // Skip if either request is invalid
    if (!current?.url || !next?.url) return;
    // Only consider multi-step patterns (not A->A)
    if (current.signature === next.signature) return;
    
    // Look for patterns that have occurred multiple times
    const patternKey = `${current.signature}->${next.signature}`;
    
    if (!this.patterns[patternKey]) {
      this.patterns[patternKey] = {
        count: 0,
        lastSuggested: 0,
        threshold: 3, // Number of occurrences before suggesting automation
        steps: [current, next]
      };
    }
    
    this.patterns[patternKey].count++;
    console.log(`[Cell] Multi-step pattern "${patternKey}" occurred ${this.patterns[patternKey].count} times`);
    
    // Check if we should suggest automation
    if (this.patterns[patternKey].count >= this.patterns[patternKey].threshold) {
      // Only suggest if we haven't suggested recently (within last hour)
      const now = Date.now();
      if (now - this.patterns[patternKey].lastSuggested > 3600000) {
        this.patterns[patternKey].lastSuggested = now;
        this.suggestAutomation(current, next, this.patterns[patternKey].count);
      }
    }
  }
  
  /**
   * Suggest automation for a repetitive pattern
   * @param {Object} current Current request
   * @param {Object} next Next request
   * @param {number} count Number of times the pattern has occurred
   */
  suggestAutomation(current, next, count) {
    console.log('[Cell] Triggering automation suggestion UI for pattern:', current.signature, '->', next.signature, 'count:', count);
    // Create a suggestion container if it doesn't exist
    if (!document.getElementById('cell-automation-suggestion')) {
      const container = document.createElement('div');
      container.id = 'cell-automation-suggestion';
      container.style.position = 'fixed';
      container.style.bottom = '20px';
      container.style.left = '50%';
      container.style.transform = 'translateX(-50%)';
      container.style.backgroundColor = 'white';
      container.style.padding = '16px';
      container.style.borderRadius = '8px';
      container.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
      container.style.zIndex = '9999';
      container.style.maxWidth = '500px';
      container.style.width = '90%';
      document.body.appendChild(container);
    }
    
    const container = document.getElementById('cell-automation-suggestion');
    
    // Create suggestion content
    container.innerHTML = `
      <div style="margin-bottom: 12px;">
        <strong>Automation Suggestion</strong>
        <p style="margin: 8px 0; font-size: 14px;">
          I noticed you've performed this sequence ${count} times:
          <br>
          <code style="background: #f3f4f6; padding: 4px 8px; border-radius: 4px; margin: 4px 0; display: inline-block;">
            ${current.method} ${current.url}
          </code>
          <br>
          followed by
          <br>
          <code style="background: #f3f4f6; padding: 4px 8px; border-radius: 4px; margin: 4px 0; display: inline-block;">
            ${next.method} ${next.url}
          </code>
        </p>
        <p style="margin: 8px 0; font-size: 14px;">
          Would you like me to automate this sequence for you?
        </p>
      </div>
      <div style="display: flex; gap: 8px;">
        <button id="cell-automation-yes" style="
          background-color: #4f46e5;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
        ">Yes, automate this</button>
        <button id="cell-automation-no" style="
          background-color: #f3f4f6;
          color: #374151;
          border: none;
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
        ">No, thanks</button>
      </div>
    `;
    
    // Add event listeners
    document.getElementById('cell-automation-yes').addEventListener('click', () => {
      // Start recording a new workflow
      this.startWorkflowRecording();
      
      // Add the current sequence
      this.addToWorkflow(current);
      this.addToWorkflow(next);
      
      // Stop recording and save
      const workflow = this.stopWorkflowRecording();
      
      if (workflow) {
        // Show success message
        container.innerHTML = `
          <div style="color: #059669; margin-bottom: 8px;">
            <strong>✓ Workflow Created</strong>
          </div>
          <p style="margin: 8px 0; font-size: 14px;">
            I've created a workflow for this sequence. You can run it anytime using the command bar (Cmd+K / Ctrl+K) and typing "run workflow".
          </p>
        `;
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
          container.remove();
        }, 5000);
      }
    });
    
    document.getElementById('cell-automation-no').addEventListener('click', () => {
      container.remove();
    });
  }
  
  /**
   * Create a suggestion for the next likely action
   * @param {string} actionSignature Signature of the suggested next action
   * @param {number} confidence Confidence level (0-1)
   */
  createSuggestion(actionSignature, confidence) {
    // Only suggest if confidence is high enough
    if (confidence < this.options.suggestionThreshold) return;
    
    // Get action parts
    const splitIndex = actionSignature.indexOf(":");
    if (splitIndex === -1) {
      console.error('[Cell] Invalid action signature for suggestion:', actionSignature);
      return;
    }
    const method = actionSignature.slice(0, splitIndex);
    const url = actionSignature.slice(splitIndex + 1);
    
    // Validate URL
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      console.error('[Cell] Invalid URL in suggestion:', url);
      return;
    }
    
    // Create a description
    const description = `${method} ${url}`;
    
    // Store the active suggestion
    this.activeSuggestion = {
      signature: actionSignature,
      description,
      confidence,
      action: () => {
        // Execute the suggested action
        fetch(url, { method });
      }
    };
    
    // Show the suggestion UI
    this.showSuggestion(description, confidence);
  }
  
  /**
   * Set up the suggestion UI
   */
  setupSuggestionUI() {
    // Create a container for suggestions if it doesn't exist
    if (!document.getElementById('cell-suggestion-container')) {
      const container = document.createElement('div');
      container.id = 'cell-suggestion-container';
      document.body.appendChild(container);
      
      // Add suggestion styles
      const style = document.createElement('style');
      style.textContent = `
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
      `;
      document.head.appendChild(style);
    }
  }
  
  /**
   * Show a suggestion to the user
   * @param {string} description Description of the suggested action
   * @param {number} confidence Confidence level (0-1)
   */
  showSuggestion(description, confidence) {
    const container = document.getElementById('cell-suggestion-container');
    
    // Clear any existing suggestion
    container.innerHTML = '';
    
    // Create the suggestion element
    const suggestionElement = document.createElement('div');
    suggestionElement.className = 'cell-suggestion';
    suggestionElement.innerHTML = `
      <div>
        Press <span class="cell-suggestion-key">Tab</span> to 
        ${description}
        <div style="font-size: 12px; opacity: 0.8; margin-top: 4px;">
          Confidence: ${(confidence * 100).toFixed(1)}%
        </div>
      </div>
    `;
    
    // Add to the container
    container.appendChild(suggestionElement);
    
    // Show the suggestion
    setTimeout(() => {
      suggestionElement.classList.add('visible');
    }, 10);
    
    // Auto-hide after 6 seconds
    setTimeout(() => {
      this.hideSuggestion();
    }, 6000);
  }
  
  /**
   * Hide the current suggestion
   */
  hideSuggestion() {
    const container = document.getElementById('cell-suggestion-container');
    const suggestionElement = container.querySelector('.cell-suggestion');
    
    if (suggestionElement) {
      suggestionElement.classList.remove('visible');
      
      // Remove after animation completes
      setTimeout(() => {
        container.innerHTML = '';
      }, 300);
    }
    
    // Clear the active suggestion
    this.activeSuggestion = null;
  }
  
  /**
   * Execute the currently active suggestion
   */
  executeActiveSuggestion() {
    if (!this.activeSuggestion) return;
    
    console.log('Executing suggestion:', this.activeSuggestion.description);
    
    // Execute the action
    this.activeSuggestion.action();
    
    // Hide the suggestion
    this.hideSuggestion();
  }
  
  /**
   * Start recording a workflow
   */
  startWorkflowRecording() {
    if (this.recordingWorkflow) {
      console.log('Already recording a workflow');
      return;
    }
    this.recordingWorkflow = true;
    this.currentWorkflow = [];
    console.log('Started recording workflow');
  }
  
  /**
   * Stop recording a workflow and save it
   * @returns {Object} The recorded workflow
   */
  stopWorkflowRecording() {
    if (!this.recordingWorkflow) {
      console.log('No workflow is being recorded');
      return null;
    }
    
    if (this.currentWorkflow.length === 0) {
      console.log('No steps recorded in workflow');
      this.recordingWorkflow = false;
      return null;
    }
    
    // Create a new workflow
    const workflow = {
      id: this.generateId(),
      name: `Workflow ${this.workflows.length + 1}`,
      description: `${this.currentWorkflow.length} steps workflow`,
      steps: this.currentWorkflow,
      created: Date.now()
    };
    
    // Add to workflows
    this.workflows.push(workflow);
    
    // Save workflows
    this.saveWorkflows();
    
    // Stop recording
    this.recordingWorkflow = false;
    this.currentWorkflow = [];
    
    console.log('Workflow saved:', workflow.name);
    
    return workflow;
  }
  
  /**
   * Add a request to the current workflow
   * @param {Object} request The request to add
   */
  addToWorkflow(request) {
    if (!this.recordingWorkflow) return;
    
    // Add to workflow
    this.currentWorkflow.push({
      id: request.id,
      url: request.url,
      method: request.method,
      signature: request.signature
    });
    
    console.log('Added step to workflow:', request.url);
  }
  
  /**
   * Execute a workflow
   * @param {string} workflowId ID of the workflow to execute
   */
  executeWorkflow(workflowId) {
    // Find the workflow
    const workflow = this.workflows.find(w => w.id === workflowId);
    
    if (!workflow) {
      console.error('Workflow not found:', workflowId);
      return;
    }
    
    console.log(`Executing workflow "${workflow.name}" (${workflow.steps.length} steps)`);
    
    // Create a progress indicator
    const progressContainer = document.createElement('div');
    progressContainer.style.position = 'fixed';
    progressContainer.style.bottom = '20px';
    progressContainer.style.right = '20px';
    progressContainer.style.backgroundColor = 'white';
    progressContainer.style.padding = '16px';
    progressContainer.style.borderRadius = '8px';
    progressContainer.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
    progressContainer.style.zIndex = '9999';
    document.body.appendChild(progressContainer);
    
    // Execute each step with a delay
    workflow.steps.forEach((step, index) => {
      setTimeout(() => {
        // Update progress
        progressContainer.innerHTML = `
          <div style="margin-bottom: 8px;">
            <strong>Executing Workflow</strong>
          </div>
          <div style="font-size: 14px;">
            Step ${index + 1}/${workflow.steps.length}: ${step.method} ${step.url}
          </div>
        `;
        
        console.log(`Executing workflow step ${index + 1}/${workflow.steps.length}: ${step.method} ${step.url}`);
        
        // Execute the step
        fetch(step.url, { method: step.method })
          .then(response => response.json())
          .then(data => {
            console.log(`Step ${index + 1} completed:`, data);
          })
          .catch(error => {
            console.error(`Step ${index + 1} failed:`, error);
          });
        
        // Remove progress indicator after last step
        if (index === workflow.steps.length - 1) {
          setTimeout(() => {
            progressContainer.remove();
          }, 1000);
        }
      }, index * 1000); // 1 second delay between steps
    });
  }
  
  /**
   * Get all saved workflows
   * @returns {Array} All workflows
   */
  getWorkflows() {
    return [...this.workflows];
  }
}

// Make Cell available globally
window.Cell = Cell; 