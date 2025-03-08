// Debug mode
const debugMode = true;

// Default settings
const DEFAULT_SETTINGS = {
  apiBaseUrl: 'https://api.deepseek.com/v1',
  apiKey: '',
  modelName: 'deepseek-chat',
  apiType: 'openai',
  chunkSize: 500,
  temperature: 0.1,
  autoProcess: false // Disable automatic processing by default
};

// Model presets
const MODEL_PRESETS = {
  deepseek: {
    apiBaseUrl: 'https://api.deepseek.com/v1',
    modelName: 'deepseek-chat',
    apiType: 'openai'
  },
  openai: {
    apiBaseUrl: 'https://api.openai.com/v1',
    modelName: 'gpt-3.5-turbo',
    apiType: 'openai'
  },
  anthropic: {
    apiBaseUrl: 'https://api.anthropic.com/v1',
    modelName: 'claude-3-haiku-20240307',
    apiType: 'anthropic'
  },
  custom: {
    apiBaseUrl: '',
    modelName: '',
    apiType: 'custom'
  }
};

// Debug logging function
function debugLog(message) {
  if (debugMode) {
    console.log(`[Entity Highlighter Options] ${message}`);
  }
}

// Save options to chrome.storage
function saveOptions() {
  const settings = {
    apiBaseUrl: document.getElementById('apiBaseUrl').value.trim(),
    apiKey: document.getElementById('apiKey').value.trim(),
    modelName: document.getElementById('modelName').value.trim(),
    apiType: document.getElementById('apiType').value,
    chunkSize: parseInt(document.getElementById('chunkSize').value.trim()) || DEFAULT_SETTINGS.chunkSize,
    temperature: parseFloat(document.getElementById('temperature').value.trim()) || DEFAULT_SETTINGS.temperature,
    autoProcess: document.getElementById('autoProcess').checked
  };
  
  if (!settings.apiKey) {
    debugLog('Empty API key, showing error');
    showStatus('Please enter a valid API key', true);
    return;
  }
  
  if (!settings.apiBaseUrl) {
    debugLog('Empty API base URL, showing error');
    showStatus('Please enter a valid API base URL', true);
    return;
  }
  
  if (!settings.modelName) {
    debugLog('Empty model name, showing error');
    showStatus('Please enter a valid model name', true);
    return;
  }
  
  debugLog('Saving settings: ' + JSON.stringify({
    ...settings,
    apiKey: settings.apiKey.substring(0, 5) + '...'
  }));
  
  chrome.storage.sync.set(
    { modelSettings: settings },
    function() {
      // Update status to let user know options were saved
      debugLog('Settings saved, notifying tabs');
      
      // Notify any active tabs that the settings have been updated
      chrome.tabs.query({}, function(tabs) {
        let notificationCount = 0;
        
        tabs.forEach(function(tab) {
          chrome.tabs.sendMessage(tab.id, {
            action: 'settingsUpdated',
            settings: settings
          }).then(() => {
            notificationCount++;
            debugLog(`Notified tab ${tab.id}`);
          }).catch(err => {
            // Ignore errors from tabs that don't have content scripts
            debugLog(`Could not send message to tab: ${tab.id} - ${err.message}`);
          });
        });
        
        debugLog(`Attempted to notify ${tabs.length} tabs, succeeded with ${notificationCount}`);
      });
      
      showStatus('Settings saved!', false);
    }
  );
}

// Show status message
function showStatus(message, isError) {
  const status = document.getElementById('status');
  status.textContent = message;
  
  if (isError) {
    status.classList.add('error');
  } else {
    status.classList.remove('error');
  }
  
  status.classList.add('show');
  
  setTimeout(function() {
    status.classList.remove('show');
  }, 3000);
}

// Restore options from chrome.storage
function restoreOptions() {
  debugLog('Restoring options');
  
  chrome.storage.sync.get(
    { modelSettings: DEFAULT_SETTINGS },
    function(items) {
      const settings = items.modelSettings;
      
      document.getElementById('apiBaseUrl').value = settings.apiBaseUrl;
      document.getElementById('apiKey').value = settings.apiKey;
      document.getElementById('modelName').value = settings.modelName;
      document.getElementById('apiType').value = settings.apiType;
      document.getElementById('chunkSize').value = settings.chunkSize;
      document.getElementById('temperature').value = settings.temperature;
      
      // Set auto-process checkbox
      if (document.getElementById('autoProcess')) {
        document.getElementById('autoProcess').checked = settings.autoProcess === true;
      }
      
      // Highlight the active preset button if it matches a preset
      highlightActivePreset(settings);
      
      if (settings.apiKey) {
        debugLog('Settings restored: ' + JSON.stringify({
          ...settings,
          apiKey: settings.apiKey.substring(0, 5) + '...'
        }));
      } else {
        debugLog('No settings found in storage, using defaults');
      }
    }
  );
}

// Reset options to defaults
function resetOptions() {
  debugLog('Resetting options to defaults');
  
  document.getElementById('apiBaseUrl').value = DEFAULT_SETTINGS.apiBaseUrl;
  document.getElementById('apiKey').value = DEFAULT_SETTINGS.apiKey;
  document.getElementById('modelName').value = DEFAULT_SETTINGS.modelName;
  document.getElementById('apiType').value = DEFAULT_SETTINGS.apiType;
  document.getElementById('chunkSize').value = DEFAULT_SETTINGS.chunkSize;
  document.getElementById('temperature').value = DEFAULT_SETTINGS.temperature;
  
  // Reset auto-process checkbox
  if (document.getElementById('autoProcess')) {
    document.getElementById('autoProcess').checked = DEFAULT_SETTINGS.autoProcess;
  }
  
  highlightActivePreset(DEFAULT_SETTINGS);
  
  showStatus('Settings reset to defaults. Click Save to apply.', false);
}

// Apply preset configuration
function applyPreset(presetName) {
  debugLog(`Applying preset: ${presetName}`);
  
  if (!MODEL_PRESETS[presetName]) {
    debugLog(`Unknown preset: ${presetName}`);
    return;
  }
  
  const preset = MODEL_PRESETS[presetName];
  
  // Keep the API key when changing presets
  const currentApiKey = document.getElementById('apiKey').value;
  
  document.getElementById('apiBaseUrl').value = preset.apiBaseUrl;
  document.getElementById('modelName').value = preset.modelName;
  document.getElementById('apiType').value = preset.apiType;
  
  // Highlight the active preset button
  highlightActivePreset(preset);
  
  showStatus(`${presetName.charAt(0).toUpperCase() + presetName.slice(1)} preset applied. Click Save to apply.`, false);
}

// Highlight the active preset button
function highlightActivePreset(settings) {
  // Remove active class from all preset buttons
  document.querySelectorAll('.preset-button').forEach(button => {
    button.classList.remove('active');
  });
  
  // Find matching preset
  for (const [presetName, preset] of Object.entries(MODEL_PRESETS)) {
    if (
      settings.apiBaseUrl === preset.apiBaseUrl &&
      settings.modelName === preset.modelName &&
      settings.apiType === preset.apiType
    ) {
      // Add active class to matching preset button
      const presetButton = document.querySelector(`.preset-button[data-preset="${presetName}"]`);
      if (presetButton) {
        presetButton.classList.add('active');
      }
      return;
    }
  }
  
  // If no match found, highlight custom
  const customButton = document.querySelector('.preset-button[data-preset="custom"]');
  if (customButton) {
    customButton.classList.add('active');
  }
}

// Test API connection
function testApiConnection() {
  const apiBaseUrl = document.getElementById('apiBaseUrl').value.trim();
  const apiKey = document.getElementById('apiKey').value.trim();
  const modelName = document.getElementById('modelName').value.trim();
  const apiType = document.getElementById('apiType').value;
  
  if (!apiKey) {
    showStatus('Please enter an API key to test', true);
    return;
  }
  
  if (!apiBaseUrl) {
    showStatus('Please enter an API base URL to test', true);
    return;
  }
  
  if (!modelName) {
    showStatus('Please enter a model name to test', true);
    return;
  }
  
  debugLog(`Testing API connection: ${apiBaseUrl} with model ${modelName}`);
  showStatus('Testing connection...', false);
  
  // Update status indicator to show testing
  const statusElement = document.getElementById('status');
  statusElement.innerHTML = '<span class="spinner"></span> Testing connection...';
  
  let endpoint = `${apiBaseUrl}/chat/completions`;
  let headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`
  };
  
  let body = {};
  
  // Adjust request based on API type
  if (apiType === 'openai') {
    body = {
      model: modelName,
      messages: [
        {
          role: 'user',
          content: 'Hello, this is a test message. Please respond with "API connection successful".'
        }
      ],
      max_tokens: 10
    };
  } else if (apiType === 'anthropic') {
    endpoint = `${apiBaseUrl}/messages`;
    headers = {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    };
    body = {
      model: modelName,
      messages: [
        {
          role: 'user',
          content: 'Hello, this is a test message. Please respond with "API connection successful".'
        }
      ],
      max_tokens: 10
    };
  } else {
    // Custom API type - use OpenAI format as default
    body = {
      model: modelName,
      messages: [
        {
          role: 'user',
          content: 'Hello, this is a test message. Please respond with "API connection successful".'
        }
      ],
      max_tokens: 10
    };
  }
  
  fetch(endpoint, {
    method: 'POST',
    headers: headers,
    body: JSON.stringify(body)
  })
  .then(response => {
    if (!response.ok) {
      return response.text().then(text => {
        throw new Error(`API request failed with status ${response.status}: ${text}`);
      });
    }
    return response.json();
  })
  .then(data => {
    debugLog('API test successful');
    debugLog('Response: ' + JSON.stringify(data));
    
    // Show success message with checkmark
    showSuccessStatus('Connection successful!');
  })
  .catch(error => {
    debugLog(`API test failed: ${error.message}`);
    showStatus(`Connection test failed: ${error.message}`, true);
  });
}

// Show success status with checkmark
function showSuccessStatus(message) {
  const status = document.getElementById('status');
  status.textContent = message;
  status.classList.remove('error');
  status.classList.add('success');
  status.classList.add('show');
  
  setTimeout(function() {
    status.classList.remove('show');
    status.classList.remove('success');
  }, 3000);
}

// Add event listeners
document.addEventListener('DOMContentLoaded', function() {
  debugLog('Options page loaded');
  restoreOptions();
  
  // Save button
  document.getElementById('saveButton').addEventListener('click', function() {
    debugLog('Save button clicked');
    saveOptions();
  });
  
  // Test button
  document.getElementById('testButton').addEventListener('click', function() {
    debugLog('Test button clicked');
    testApiConnection();
  });
  
  // Reset button
  document.getElementById('resetButton').addEventListener('click', function() {
    debugLog('Reset button clicked');
    resetOptions();
  });
  
  // Preset buttons
  document.querySelectorAll('.preset-button').forEach(button => {
    button.addEventListener('click', function() {
      const preset = this.dataset.preset;
      debugLog(`Preset button clicked: ${preset}`);
      applyPreset(preset);
    });
  });
  
  // Also save when Enter key is pressed in input fields
  document.querySelectorAll('input').forEach(input => {
    input.addEventListener('keydown', function(event) {
      if (event.key === 'Enter') {
        debugLog('Enter key pressed in input field');
        saveOptions();
      }
    });
  });
}); 