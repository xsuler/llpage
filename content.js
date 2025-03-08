// Global variables
let apiKey = '';
let entities = [];
let highlightedElements = [];
let infoPanel = null;
let isProcessing = false;
let processingQueue = [];
let chunkSize = 500;
let processedTextNodes = new Set();
let processingStatus = null;
let totalChunks = 0;
let processedChunks = 0;
let currentProcessingOverlay = null;
let debugMode = true; // Enable debug logging
let modelSettings = null; // Store model settings
let highlightingInProgress = false; // Flag to track if highlighting is in progress
let autoProcess = false; // Flag to control automatic processing

// Initialize the extension
function initialize() {
  debugLog('Initializing extension');
  
  // Add click event listener for entity highlights
  document.addEventListener('click', handleEntityClick);
  
  // Load settings
  loadSettings();
}

// Debug logging function
function debugLog(message, ...args) {
  if (debugMode) {
    if (args.length > 0) {
      console.log(`[Entity Highlighter] ${message}`, ...args);
    } else {
      console.log(`[Entity Highlighter] ${message}`);
    }
  }
}

// Load settings from storage
function loadSettings() {
  debugLog('Loading settings from storage');
  
  chrome.storage.sync.get(['modelSettings'], function(result) {
    if (chrome.runtime.lastError) {
      debugLog(`Error getting settings: ${chrome.runtime.lastError.message}`);
      return;
    }
    
    if (result.modelSettings) {
      modelSettings = result.modelSettings;
      apiKey = modelSettings.apiKey;
      chunkSize = modelSettings.chunkSize || 500;
      autoProcess = modelSettings.autoProcess === true;
      
      debugLog('Settings loaded: ' + JSON.stringify({
        ...modelSettings,
        apiKey: apiKey ? apiKey.substring(0, 5) + '...' : 'not set'
      }));
      
      // If auto-process is enabled, start processing
      if (autoProcess && apiKey) {
        debugLog('Auto-process enabled, starting processing');
        processPageContentProgressively();
      } else {
        debugLog('Auto-process disabled or no API key, waiting for manual trigger');
      }
    } else {
      debugLog('No settings found in storage');
    }
  });
}

// Get API key from storage and then process content
function getApiKeyAndProcess() {
  debugLog('Getting API key from storage');
  
  return new Promise((resolve, reject) => {
    if (apiKey) {
      debugLog('Using cached API key');
      resolve(apiKey);
      return;
    }
    
    chrome.storage.sync.get(['modelSettings'], function(result) {
      if (chrome.runtime.lastError) {
        debugLog(`Error getting API key: ${chrome.runtime.lastError.message}`);
        reject(chrome.runtime.lastError);
        return;
      }
      
      if (result.modelSettings && result.modelSettings.apiKey) {
        apiKey = result.modelSettings.apiKey;
        modelSettings = result.modelSettings;
        chunkSize = modelSettings.chunkSize || 500;
        autoProcess = modelSettings.autoProcess === true;
        
        debugLog('API key and settings retrieved successfully');
        resolve(apiKey);
      } else {
        debugLog('API key not found in storage');
        alert('API key not found. Please set it in the extension options.');
        reject(new Error('API key not found'));
      }
    });
  });
}

// Process the page content progressively in chunks
function processPageContentProgressively() {
  debugLog('Starting progressive content processing');
  
  // Prevent multiple processing runs
  if (highlightingInProgress) {
    debugLog('Highlighting already in progress, skipping');
    return;
  }
  
  highlightingInProgress = true;
  
  // First ensure we have the API key
  getApiKeyAndProcess()
    .then(() => {
      if (!apiKey) {
        debugLog('No API key available. Cannot process content.');
        highlightingInProgress = false;
        return;
      }
      
      // Reset processing state
      isProcessing = false;
      processingQueue = [];
      processedChunks = 0;
      entities = [];
      
      // Find all text nodes in the document
      const textNodes = [];
      
      // Use a more aggressive approach to find text nodes
      function findTextNodes(node) {
        if (node.nodeType === Node.TEXT_NODE) {
          // Only include text nodes with non-empty content
          // Ensure we properly handle Chinese and other non-Latin characters
          if (node.textContent.trim().length > 0) {
            textNodes.push(node);
          }
        } else if (node.nodeType === Node.ELEMENT_NODE) {
          // Skip script, style, and other non-content elements
          const tagName = node.tagName.toLowerCase();
          if (tagName !== 'script' && 
              tagName !== 'style' && 
              tagName !== 'noscript' && 
              tagName !== 'svg' &&
              !processedTextNodes.has(node)) {
            // Process children
            for (let i = 0; i < node.childNodes.length; i++) {
              findTextNodes(node.childNodes[i]);
            }
          }
        }
      }
      
      // Start from document body
      findTextNodes(document.body);
      
      debugLog(`Found ${textNodes.length} text nodes to process`);
      
      if (textNodes.length === 0) {
        debugLog('No text nodes found on the page');
        alert('No text content found on this page to process.');
        highlightingInProgress = false;
        return;
      }
      
      // Group text nodes into chunks of approximately chunkSize characters
      let currentChunk = [];
      let currentChunkSize = 0;
      
      for (const node of textNodes) {
        const nodeTextLength = node.textContent.length;
        
        // If adding this node would exceed chunk size, process the current chunk
        if (currentChunkSize + nodeTextLength > chunkSize && currentChunk.length > 0) {
          processingQueue.push([...currentChunk]);
          currentChunk = [];
          currentChunkSize = 0;
        }
        
        currentChunk.push(node);
        currentChunkSize += nodeTextLength;
      }
      
      // Add the last chunk if it has any nodes
      if (currentChunk.length > 0) {
        processingQueue.push(currentChunk);
      }
      
      // Set total chunks for progress tracking
      totalChunks = processingQueue.length;
      
      debugLog(`Created ${totalChunks} chunks for processing`);
      
      // Create processing status indicator
      createProcessingStatus();
      
      // Start processing chunks
      processNextChunk();
    })
    .catch(error => {
      debugLog(`Error starting processing: ${error.message}`);
      alert(`Error: ${error.message}. Please check your API key in the settings.`);
      highlightingInProgress = false;
    });
}

// Create processing status indicator
function createProcessingStatus() {
  // Remove existing status if any
  removeProcessingStatus();
  
  // Create new status element
  processingStatus = document.createElement('div');
  processingStatus.className = 'entity-processing-status';
  processingStatus.textContent = `Processing text: 0/${totalChunks} chunks`;
  document.body.appendChild(processingStatus);
  
  // Make it visible after a short delay
  setTimeout(() => {
    processingStatus.classList.add('visible');
  }, 100);
  
  debugLog('Created processing status indicator');
}

// Update processing status
function updateProcessingStatus() {
  if (processingStatus) {
    processingStatus.textContent = `Processing text: ${processedChunks}/${totalChunks} chunks`;
    
    // If complete, remove after a delay
    if (processedChunks >= totalChunks) {
      processingStatus.textContent = `Completed: ${entities.length} entities found`;
      debugLog(`Processing complete. Found ${entities.length} entities.`);
      setTimeout(removeProcessingStatus, 3000);
      highlightingInProgress = false;
    }
  }
}

// Remove processing status
function removeProcessingStatus() {
  if (processingStatus) {
    processingStatus.classList.remove('visible');
    setTimeout(() => {
      if (processingStatus && processingStatus.parentNode) {
        processingStatus.remove();
      }
      processingStatus = null;
    }, 300);
  }
}

// Process the next chunk in the queue
function processNextChunk() {
  if (processingQueue.length === 0 || isProcessing) {
    if (processingQueue.length === 0) {
      // All chunks processed
      updateProcessingStatus();
      removeProcessingOverlay();
      debugLog('All chunks processed');
      highlightingInProgress = false;
    }
    return;
  }
  
  isProcessing = true;
  const chunk = processingQueue.shift();
  const chunkText = chunk.map(node => node.textContent).join(' ');
  
  debugLog(`Processing chunk with ${chunk.length} nodes and ${chunkText.length} characters`);
  
  // Highlight the chunk being processed
  highlightProcessingChunk(chunk);
  
  // Process this chunk of text
  processTextChunk(chunkText, chunk);
  
  // Make sure all entity highlights are clickable
  // This ensures entities can be clicked during processing
  document.querySelectorAll('.entity-highlight').forEach(el => {
    el.dataset.clickable = 'true';
    el.style.cursor = 'pointer';
  });
}

// Highlight the chunk currently being processed
function highlightProcessingChunk(textNodes) {
  // Remove previous processing overlay
  removeProcessingOverlay();
  
  // Create overlays for each text node in the chunk
  textNodes.forEach(node => {
    if (!node.parentNode) return; // Skip if node was removed
    
    try {
      // Get node position
      const range = document.createRange();
      range.selectNodeContents(node);
      const rect = range.getBoundingClientRect();
      
      if (rect.width === 0 || rect.height === 0) return; // Skip if not visible
      
      // Create overlay
      const overlay = document.createElement('div');
      overlay.className = 'chunk-processing-overlay';
      
      // Position overlay
      overlay.style.left = `${window.scrollX + rect.left}px`;
      overlay.style.top = `${window.scrollY + rect.top}px`;
      overlay.style.width = `${rect.width}px`;
      overlay.style.height = `${rect.height}px`;
      
      // Add to document
      document.body.appendChild(overlay);
      
      // Store reference to remove later
      if (!currentProcessingOverlay) {
        currentProcessingOverlay = [];
      }
      currentProcessingOverlay.push(overlay);
    } catch (e) {
      debugLog(`Error creating overlay: ${e.message}`);
    }
  });
  
  debugLog(`Created ${currentProcessingOverlay ? currentProcessingOverlay.length : 0} overlays`);
}

// Remove processing chunk highlight
function removeProcessingOverlay() {
  if (currentProcessingOverlay) {
    currentProcessingOverlay.forEach(overlay => {
      if (overlay.parentNode) {
        overlay.remove();
      }
    });
    currentProcessingOverlay = null;
  }
}

// Process a chunk of text to identify entities
function processTextChunk(text, textNodes) {
  if (!text || text.trim().length === 0) {
    debugLog('Empty text chunk, skipping');
    // Skip empty chunks but continue processing
    isProcessing = false;
    processedChunks++;
    updateProcessingStatus();
    processNextChunk();
    return;
  }
  
  // Verify API key is available
  if (!apiKey) {
    debugLog('API key not available for processing chunk');
    isProcessing = false;
    processNextChunk();
    return;
  }
  
  // Send message to background script to process text with AI API
  chrome.runtime.sendMessage({
    action: 'identifyEntities',
    text: text,
    apiKey: apiKey
  }, function(response) {
    if (chrome.runtime.lastError) {
      debugLog(`Runtime error: ${chrome.runtime.lastError.message}`);
      isProcessing = false;
      processedChunks++;
      updateProcessingStatus();
      processNextChunk();
      return;
    }
    
    if (response && response.success) {
      const chunkEntities = response.entities || [];
      debugLog(`Received ${chunkEntities.length} entities for chunk`);
      
      // Add new entities to the global list
      for (const entity of chunkEntities) {
        if (!entities.some(e => e.name === entity.name)) {
          entities.push(entity);
        }
      }
      
      // Highlight entities in this chunk's text nodes
      highlightEntitiesInNodes(chunkEntities, textNodes);
      
      // Mark these nodes as processed
      textNodes.forEach(node => processedTextNodes.add(node));
      
      // Update progress
      processedChunks++;
      updateProcessingStatus();
      
      // Continue with the next chunk after a short delay to allow DOM updates
      setTimeout(() => {
        isProcessing = false;
        processNextChunk();
      }, 50);
    } else {
      debugLog('Failed to identify entities: ' + (response ? response.error : 'Unknown error'));
      
      // Update progress even on error
      processedChunks++;
      updateProcessingStatus();
      
      // Continue with the next chunk after a short delay
      setTimeout(() => {
        isProcessing = false;
        processNextChunk();
      }, 50);
    }
  });
}

// Highlight entities in specific text nodes
function highlightEntitiesInNodes(entities, textNodes) {
  let highlightCount = 0;
  
  // Create a map of text nodes to their original content
  const textNodeContents = new Map();
  textNodes.forEach(node => {
    if (node.parentNode) {
      textNodeContents.set(node, node.textContent);
    }
  });
  
  // Process each entity
  entities.forEach(entity => {
    // For each text node
    textNodeContents.forEach((originalContent, textNode) => {
      if (!textNode.parentNode) return; // Skip if node was removed
      
      const text = originalContent;
      
      // Use a more flexible regex pattern for Chinese and other non-Latin characters
      let entityRegex;
      if (/[\u4e00-\u9fa5]/.test(entity.name)) {
        // Chinese characters detected, don't use word boundaries
        entityRegex = new RegExp(`${escapeRegExp(entity.name)}`, 'g');
      } else {
        // Use word boundaries for Latin script
        entityRegex = new RegExp(`\\b${escapeRegExp(entity.name)}\\b`, 'gi');
      }
      
      if (entityRegex.test(text)) {
        try {
          highlightEntityInNode(textNode, entity, text);
          highlightCount++;
        } catch (e) {
          debugLog(`Error highlighting entity "${entity.name}" in node: ${e.message}`);
        }
      }
    });
  });
  
  // Ensure all newly created entity highlights are clickable
  document.querySelectorAll('.entity-highlight').forEach(el => {
    el.dataset.clickable = 'true';
    el.style.cursor = 'pointer';
    
    // Make sure the element responds to clicks
    el.addEventListener('click', function(event) {
      event.stopPropagation();
      handleEntityClick(event);
    });
  });
  
  debugLog(`Highlighted ${highlightCount} entity instances in this chunk`);
}

// Original highlightEntities function (now used for manual triggering)
function highlightEntities() {
  debugLog('Manual highlight entities triggered');
  
  // Reset any existing highlights
  resetHighlights();
  
  // Start progressive processing
  processPageContentProgressively();
}

// Reset all highlights and processing state
function resetHighlights() {
  debugLog('Resetting all highlights and processing state');
  
  // Remove existing highlights
  highlightedElements.forEach(el => {
    if (el.parentNode) {
      const text = document.createTextNode(el.textContent);
      el.parentNode.replaceChild(text, el);
    }
  });
  
  // Reset state
  highlightedElements = [];
  processedTextNodes = new Set();
  removeInfoPanel();
  removeProcessingStatus();
  removeProcessingOverlay();
  highlightingInProgress = false;
}

// Helper function to escape special characters in regex
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Highlight a specific entity in a text node
function highlightEntityInNode(textNode, entity, originalText) {
  try {
    // Use the original text if provided, otherwise use the current content
    const text = originalText || textNode.textContent;
    
    // Use a more flexible regex pattern for Chinese and other non-Latin characters
    let entityRegex;
    if (/[\u4e00-\u9fa5]/.test(entity.name)) {
      // Chinese characters detected, don't use word boundaries
      entityRegex = new RegExp(`${escapeRegExp(entity.name)}`, 'g');
    } else {
      // Use word boundaries for Latin script
      entityRegex = new RegExp(`\\b${escapeRegExp(entity.name)}\\b`, 'gi');
    }
    
    let match;
    let lastIndex = 0;
    let fragments = [];
    
    while ((match = entityRegex.exec(text)) !== null) {
      // Add text before the match
      if (match.index > lastIndex) {
        fragments.push(document.createTextNode(text.substring(lastIndex, match.index)));
      }
      
      // Create highlighted span for the entity
      const span = document.createElement('span');
      span.className = 'entity-highlight';
      span.textContent = match[0];
      span.dataset.entityId = entity.id || entity.name;
      span.dataset.entityType = entity.type || 'unknown';
      span.dataset.clickable = 'true';
      span.style.cursor = 'pointer';
      highlightedElements.push(span);
      fragments.push(span);
      
      lastIndex = match.index + match[0].length;
    }
    
    // Add remaining text
    if (lastIndex < text.length) {
      fragments.push(document.createTextNode(text.substring(lastIndex)));
    }
    
    // Replace the original text node with the fragments
    if (fragments.length > 1) {
      const parent = textNode.parentNode;
      if (parent) {
        fragments.forEach(fragment => {
          parent.insertBefore(fragment, textNode);
        });
        parent.removeChild(textNode);
      }
    }
  } catch (e) {
    debugLog(`Error highlighting entity in node: ${e.message}`);
    throw e; // Re-throw to allow caller to handle
  }
}

// Handle click on an entity
function handleEntityClick(event) {
  const target = event.target;
  
  // Check if clicked element is an entity
  if (target.classList.contains('entity-highlight')) {
    event.preventDefault();
    event.stopPropagation();
    
    const entityId = target.dataset.entityId;
    const entityName = target.textContent;
    
    debugLog(`Entity clicked: ${entityName}`);
    
    // Ensure we have the API key
    if (!apiKey) {
      getApiKeyAndProcess()
        .then(() => {
          processEntityClick(target, entityName);
        })
        .catch(error => {
          debugLog(`Error getting API key for entity click: ${error.message}`);
          alert('Could not retrieve API key. Please check your settings.');
        });
    } else {
      processEntityClick(target, entityName);
    }
  } else if (!target.closest('.entity-info-panel')) {
    // If clicked outside entity or info panel, remove panel
    removeInfoPanel();
  }
}

// Extract surrounding text (approximately 1000 words) from the current page
function extractSurroundingText(targetElement, wordCount = 1000) {
  debugLog(`Extracting approximately ${wordCount} words of surrounding text`);
  
  // Find all text nodes in the document if not already available
  const allTextNodes = [];
  findTextNodes(document.body, allTextNodes);
  
  function findTextNodes(node, collection) {
    if (node.nodeType === Node.TEXT_NODE) {
      if (node.textContent.trim().length > 0) {
        collection.push(node);
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const tagName = node.tagName.toLowerCase();
      if (tagName !== 'script' && 
          tagName !== 'style' && 
          tagName !== 'noscript' && 
          tagName !== 'svg') {
        for (let i = 0; i < node.childNodes.length; i++) {
          findTextNodes(node.childNodes[i], collection);
        }
      }
    }
  }
  
  // Find the index of the node closest to our target element
  let closestNodeIndex = 0;
  let closestDistance = Infinity;
  
  // Get the position of the target element
  const targetRect = targetElement.getBoundingClientRect();
  const targetCenter = {
    x: targetRect.left + targetRect.width / 2,
    y: targetRect.top + targetRect.height / 2
  };
  
  // Find the closest text node to our target
  allTextNodes.forEach((node, index) => {
    try {
      const range = document.createRange();
      range.selectNodeContents(node);
      const rect = range.getBoundingClientRect();
      
      if (rect.width === 0 || rect.height === 0) return;
      
      const nodeCenter = {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2
      };
      
      const distance = Math.sqrt(
        Math.pow(targetCenter.x - nodeCenter.x, 2) + 
        Math.pow(targetCenter.y - nodeCenter.y, 2)
      );
      
      if (distance < closestDistance) {
        closestDistance = distance;
        closestNodeIndex = index;
      }
    } catch (e) {
      // Skip nodes that can't be measured
    }
  });
  
  // Collect text before and after the closest node
  let textBefore = '';
  let textAfter = '';
  let wordsCollected = 0;
  const targetWords = wordCount / 2; // Half before, half after
  
  // Collect words before the closest node
  for (let i = closestNodeIndex - 1; i >= 0 && wordsCollected < targetWords; i--) {
    const nodeText = allTextNodes[i].textContent.trim();
    if (nodeText.length > 0) {
      textBefore = nodeText + ' ' + textBefore;
      wordsCollected += nodeText.split(/\s+/).length;
    }
  }
  
  // Reset word count for after collection
  wordsCollected = 0;
  
  // Collect words after the closest node (including the closest node)
  for (let i = closestNodeIndex; i < allTextNodes.length && wordsCollected < targetWords; i++) {
    const nodeText = allTextNodes[i].textContent.trim();
    if (nodeText.length > 0) {
      textAfter += nodeText + ' ';
      wordsCollected += nodeText.split(/\s+/).length;
    }
  }
  
  // Combine the text
  const surroundingText = (textBefore + textAfter).trim();
  
  debugLog(`Extracted ${surroundingText.split(/\s+/).length} words of surrounding text`);
  return surroundingText;
}

// Process entity click with API key available
function processEntityClick(target, entityName) {
  // Remove existing info panel
  removeInfoPanel();
  
  // Show loading indicator
  showLoadingIndicator(target);
  
  // Extract surrounding text for context
  const surroundingText = extractSurroundingText(target, 1000);
  
  // Get entity details from AI API
  chrome.runtime.sendMessage({
    action: 'getEntityDetails',
    entityName: entityName,
    apiKey: apiKey,
    contextText: surroundingText
  }, function(response) {
    removeLoadingIndicator();
    
    if (chrome.runtime.lastError) {
      debugLog(`Runtime error: ${chrome.runtime.lastError.message}`);
      return;
    }
    
    debugLog('Received entity details response:', response);
    
    if (response && response.success) {
      // Validate the details object
      if (!response.details) {
        debugLog('Error: No details object in response');
        return;
      }
      
      // Ensure details has the expected properties
      const details = {
        description: response.details.description || 'No description available.',
        background: response.details.background || '',
        relationships: response.details.relationships || []
      };
      
      debugLog('Processed details for display:', details);
      
      // Show entity info with validated details
      showEntityInfo(target, details);
    } else {
      debugLog('Error getting entity details:', response ? response.error : 'Unknown error');
    }
  });
}

// Show loading indicator
function showLoadingIndicator(targetElement) {
  const loadingIndicator = document.createElement('div');
  loadingIndicator.className = 'entity-loading-indicator';
  loadingIndicator.textContent = 'Loading...';
  
  // Position near the target element
  const rect = targetElement.getBoundingClientRect();
  loadingIndicator.style.left = `${window.scrollX + rect.left}px`;
  loadingIndicator.style.top = `${window.scrollY + rect.bottom + 5}px`;
  
  document.body.appendChild(loadingIndicator);
  
  debugLog('Showing loading indicator');
}

// Remove loading indicator
function removeLoadingIndicator() {
  const indicator = document.querySelector('.entity-loading-indicator');
  if (indicator) {
    indicator.remove();
    debugLog('Removed loading indicator');
  }
}

// Show entity information panel
function showEntityInfo(entityElement, details) {
  // Create info panel
  infoPanel = document.createElement('div');
  infoPanel.className = 'entity-info-panel';
  
  // Add content to panel
  const title = document.createElement('h3');
  title.textContent = entityElement.textContent;
  infoPanel.appendChild(title);
  
  const type = document.createElement('p');
  type.className = 'entity-type';
  type.textContent = `Type: ${entityElement.dataset.entityType}`;
  infoPanel.appendChild(type);
  
  const description = document.createElement('div');
  description.className = 'entity-description';
  description.innerHTML = details.description || 'No description available.';
  infoPanel.appendChild(description);
  
  // Debug log the details to verify content
  debugLog('Entity details received:', details);
  
  if (details.background) {
    debugLog('Background information found:', details.background);
    const background = document.createElement('div');
    background.className = 'entity-background';
    const bgTitle = document.createElement('h4');
    bgTitle.textContent = 'Background Knowledge';
    background.appendChild(bgTitle);
    const bgContent = document.createElement('p');
    bgContent.innerHTML = details.background;
    background.appendChild(bgContent);
    infoPanel.appendChild(background);
  }
  
  // Add relationships section if there are any relationships
  if (details.relationships && details.relationships.length > 0) {
    debugLog('Relationships found:', details.relationships);
    const relationships = document.createElement('div');
    relationships.className = 'entity-relationships';
    const relTitle = document.createElement('h4');
    relTitle.textContent = 'Related Entities';
    relationships.appendChild(relTitle);
    
    const relList = document.createElement('ul');
    details.relationships.forEach(rel => {
      const relItem = document.createElement('li');
      const relEntity = document.createElement('strong');
      relEntity.textContent = rel.entity;
      relItem.appendChild(relEntity);
      relItem.appendChild(document.createTextNode(`: ${rel.description}`));
      relList.appendChild(relItem);
    });
    relationships.appendChild(relList);
    infoPanel.appendChild(relationships);
  }
  
  // Close button
  const closeBtn = document.createElement('button');
  closeBtn.className = 'close-btn';
  closeBtn.textContent = '×';
  closeBtn.addEventListener('click', removeInfoPanel);
  infoPanel.appendChild(closeBtn);
  
  // Position the panel
  const rect = entityElement.getBoundingClientRect();
  infoPanel.style.left = `${window.scrollX + rect.left}px`;
  infoPanel.style.top = `${window.scrollY + rect.bottom + 10}px`;
  
  // Add to document
  document.body.appendChild(infoPanel);
  
  debugLog('Displayed entity info panel');
}

// Remove info panel
function removeInfoPanel() {
  if (infoPanel) {
    infoPanel.remove();
    infoPanel = null;
    debugLog('Removed info panel');
  }
}

// Initialize when DOM is fully loaded
document.addEventListener('DOMContentLoaded', initialize);

// Re-initialize when the page content changes significantly
const observer = new MutationObserver(function(mutations) {
  const significantChange = mutations.some(mutation => 
    mutation.addedNodes.length > 0 && 
    Array.from(mutation.addedNodes).some(node => 
      node.nodeType === Node.ELEMENT_NODE && 
      ['DIV', 'ARTICLE', 'SECTION', 'MAIN'].includes(node.tagName)
    )
  );
  
  if (significantChange && !highlightingInProgress && autoProcess) {
    debugLog('Significant page change detected, resetting and reprocessing');
    // Reset and process again only if auto-process is enabled
    resetHighlights();
    processPageContentProgressively();
  }
});

observer.observe(document.body, { childList: true, subtree: true });

// Listen for messages from the background script or popup
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  debugLog(`Received message: ${request.action}`);
  
  if (request.action === 'apiKeyUpdated') {
    apiKey = request.apiKey;
    debugLog('API key updated: ' + (apiKey ? 'Key present' : 'No key'));
    // Re-process the page with the new API key
    resetHighlights();
    processPageContentProgressively();
    sendResponse({ success: true });
  } else if (request.action === 'settingsUpdated') {
    if (request.settings) {
      modelSettings = request.settings;
      apiKey = modelSettings.apiKey;
      chunkSize = modelSettings.chunkSize || 100;
      autoProcess = modelSettings.autoProcess === true;
      
      debugLog('Settings updated: ' + JSON.stringify({
        ...modelSettings,
        apiKey: apiKey ? 'Key present' : 'No key',
        autoProcess: autoProcess
      }));
      
      // Re-process the page with the new settings only if auto-process is enabled
      resetHighlights();
      if (autoProcess) {
        processPageContentProgressively();
      }
    }
    sendResponse({ success: true });
  } else if (request.action === 'highlightEntities') {
    debugLog('Highlight entities action received from popup');
    // Manual trigger from popup
    highlightEntities();
    sendResponse({ success: true });
  }
  return true;
}); 