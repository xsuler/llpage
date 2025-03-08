// Debug mode
const debugMode = true;

// Debug logging function
function debugLog(message) {
  if (debugMode) {
    console.log(`[Entity Highlighter Popup] ${message}`);
  }
}

// Check if API key is set
function checkApiKey() {
  const statusElement = document.getElementById('status');
  const highlightButton = document.getElementById('highlightButton');
  
  debugLog('Checking API key status');
  
  chrome.storage.sync.get(['modelSettings'], function(result) {
    if (!result.modelSettings || !result.modelSettings.apiKey) {
      statusElement.textContent = 'API key not set. Please go to Settings to add your API key.';
      statusElement.classList.add('error');
      highlightButton.disabled = true;
      debugLog('No API key found');
    } else {
      const settings = result.modelSettings;
      statusElement.textContent = `Ready to highlight entities using ${settings.modelName} model.`;
      statusElement.classList.add('success');
      highlightButton.disabled = false;
      debugLog('API key found: ' + settings.apiKey.substring(0, 5) + '...');
      debugLog(`Using model: ${settings.modelName} via ${settings.apiBaseUrl}`);
    }
  });
}

// Send message to content script to highlight entities
function highlightEntities() {
  const statusElement = document.getElementById('status');
  statusElement.textContent = 'Starting entity highlighting...';
  statusElement.classList.remove('error');
  statusElement.classList.add('success');
  
  debugLog('Getting settings before sending highlight message');
  
  // First get the settings
  chrome.storage.sync.get(['modelSettings'], function(result) {
    if (!result.modelSettings || !result.modelSettings.apiKey) {
      statusElement.textContent = 'Error: API key not found. Please go to Settings to add your API key.';
      statusElement.classList.remove('success');
      statusElement.classList.add('error');
      debugLog('No API key found when trying to highlight');
      return;
    }
    
    const settings = result.modelSettings;
    debugLog('Settings retrieved, sending to content script');
    
    // First update the settings in the content script
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      if (tabs[0]) {
        debugLog(`Sending settings update to tab: ${tabs[0].id}`);
        
        chrome.tabs.sendMessage(tabs[0].id, { 
          action: 'settingsUpdated', 
          settings: settings 
        })
        .then(response => {
          debugLog('Settings update sent, now triggering highlighting');
          
          // Now trigger the highlighting
          return chrome.tabs.sendMessage(tabs[0].id, { action: 'highlightEntities' });
        })
        .then(response => {
          debugLog(`Received highlight response: ${JSON.stringify(response)}`);
          if (response && response.success) {
            statusElement.textContent = 'Processing page content in chunks. You can close this popup - highlighting will continue in the background.';
          }
        })
        .catch(error => {
          console.error('Error sending message to content script:', error);
          debugLog(`Error: ${error.message}`);
          
          // Check if content script is loaded
          if (error.message.includes('Could not establish connection') || 
              error.message.includes('Receiving end does not exist')) {
            // Content script might not be loaded yet, try injecting it
            statusElement.textContent = 'Error: Content script not ready. Please refresh the page and try again.';
          } else {
            statusElement.textContent = 'Error: Could not communicate with the page. Try refreshing the page.';
          }
          
          statusElement.classList.remove('success');
          statusElement.classList.add('error');
        });
      } else {
        debugLog('No active tab found');
        statusElement.textContent = 'Error: No active tab found.';
        statusElement.classList.remove('success');
        statusElement.classList.add('error');
      }
    });
  });
}

// Open options page
function openOptions() {
  debugLog('Opening options page');
  chrome.runtime.openOptionsPage();
}

// Add event listeners
document.addEventListener('DOMContentLoaded', function() {
  debugLog('Popup DOM loaded');
  checkApiKey();
  
  document.getElementById('highlightButton').addEventListener('click', function() {
    debugLog('Highlight button clicked');
    highlightEntities();
  });
  
  document.getElementById('optionsButton').addEventListener('click', function() {
    debugLog('Options button clicked');
    openOptions();
  });
}); 