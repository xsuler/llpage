// Background script for Entity Highlighter extension
// Handles communication with AI APIs

// Debug mode
const debugMode = true;

// Default settings
const DEFAULT_SETTINGS = {
  apiBaseUrl: 'https://api.deepseek.com/v1',
  apiKey: '',
  modelName: 'deepseek-chat',
  apiType: 'openai',
  chunkSize: 500,
  temperature: 0.1
};

// Current settings
let currentSettings = { ...DEFAULT_SETTINGS };

// Debug logging function
function debugLog(message, ...args) {
  if (debugMode) {
    if (args.length > 0) {
      console.log(`[Entity Highlighter Background] ${message}`, ...args);
    } else {
      console.log(`[Entity Highlighter Background] ${message}`);
    }
  }
}

// Initialize settings from storage
function initializeSettings() {
  chrome.storage.sync.get({ modelSettings: DEFAULT_SETTINGS }, function(items) {
    currentSettings = items.modelSettings;
    debugLog('Settings initialized: ' + JSON.stringify({
      ...currentSettings,
      apiKey: currentSettings.apiKey ? currentSettings.apiKey.substring(0, 5) + '...' : 'not set'
    }));
  });
}

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  debugLog(`Received message: ${request.action} from ${sender.tab ? 'tab ' + sender.tab.id : 'extension'}`);
  
  if (request.action === 'identifyEntities') {
    const apiKey = request.apiKey || currentSettings.apiKey;
    
    if (!apiKey) {
      debugLog('No API key provided');
      sendResponse({ success: false, error: 'No API key provided' });
      return true;
    }
    
    if (!request.text || request.text.trim().length === 0) {
      debugLog('Empty text provided');
      sendResponse({ success: false, error: 'Empty text provided' });
      return true;
    }
    
    debugLog(`Processing text chunk of length ${request.text.length}`);
    
    identifyEntities(request.text, apiKey)
      .then(entities => {
        debugLog(`Identified ${entities.length} entities`);
        sendResponse({ success: true, entities: entities });
      })
      .catch(error => {
        debugLog(`Error identifying entities: ${error.message}`);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Indicates async response
  }
  
  else if (request.action === 'getEntityDetails') {
    const apiKey = request.apiKey || currentSettings.apiKey;
    const contextText = request.contextText || '';
    
    if (!apiKey) {
      debugLog('No API key provided');
      sendResponse({ success: false, error: 'No API key provided' });
      return true;
    }
    
    if (!request.entityName) {
      debugLog('No entity name provided');
      sendResponse({ success: false, error: 'No entity name provided' });
      return true;
    }
    
    debugLog(`Getting details for entity: ${request.entityName}`);
    if (contextText) {
      debugLog(`Context text provided: ${contextText.length} characters`);
    }
    
    getEntityDetails(request.entityName, apiKey, contextText)
      .then(details => {
        debugLog('Retrieved entity details successfully', details);
        sendResponse({ success: true, details: details });
      })
      .catch(error => {
        debugLog(`Error getting entity details: ${error.message}`);
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }
  
  else if (request.action === 'getEntityRelationships') {
    const apiKey = request.apiKey || currentSettings.apiKey;
    const contextText = request.contextText || '';
    
    if (!apiKey) {
      debugLog('No API key provided');
      sendResponse({ success: false, error: 'No API key provided' });
      return true;
    }
    
    if (!request.entityName) {
      debugLog('No entity name provided');
      sendResponse({ success: false, error: 'No entity name provided' });
      return true;
    }
    
    debugLog(`Getting relationships for entity: ${request.entityName}`);
    if (contextText) {
      debugLog(`Context text provided: ${contextText.length} characters`);
    }
    
    getEntityRelationships(request.entityName, apiKey, contextText)
      .then(relationships => {
        debugLog(`Retrieved ${relationships.length} relationships`);
        sendResponse({ success: true, relationships: relationships });
      })
      .catch(error => {
        debugLog(`Error getting entity relationships: ${error.message}`);
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }
  
  debugLog(`Unknown action: ${request.action}`);
  sendResponse({ success: false, error: `Unknown action: ${request.action}` });
  return true;
});

// Function to identify entities in text using AI API
async function identifyEntities(text, apiKey) {
  try {
    debugLog('Calling AI API to identify entities');
    
    let response;
    
    if (currentSettings.apiType === 'anthropic') {
      response = await callAnthropicAPI('identifyEntities', text, apiKey);
    } else {
      // Default to OpenAI-compatible API
      response = await callOpenAIAPI('identifyEntities', text, apiKey);
    }
    
    return response;
  } catch (error) {
    debugLog(`Error in identifyEntities: ${error.message}`);
    throw error;
  }
}

// Function to get detailed information about an entity
async function getEntityDetails(entityName, apiKey, contextText = '') {
  try {
    debugLog(`Getting details for entity: ${entityName}`);
    debugLog(`Context text length: ${contextText.length} characters`);
    
    let response;
    
    if (currentSettings.apiType === 'anthropic') {
      response = await callAnthropicAPI('getEntityDetails', entityName, apiKey, contextText);
    } else {
      // Default to OpenAI-compatible API
      response = await callOpenAIAPI('getEntityDetails', entityName, apiKey, contextText);
    }
    
    // Ensure response has the expected format
    if (!response) {
      debugLog('Error: Empty response from API');
      return {
        description: 'Unable to retrieve entity details.',
        background: '',
        relationships: []
      };
    }
    
    // Validate and format the response
    const formattedResponse = {
      description: response.description || 'No description available.',
      background: response.background || '',
      relationships: response.relationships || []
    };
    
    debugLog('Formatted entity details:', formattedResponse);
    
    return formattedResponse;
  } catch (error) {
    debugLog(`Error in getEntityDetails: ${error.message}`);
    throw error;
  }
}

// Function to get relationships between entities
async function getEntityRelationships(entityName, apiKey, contextText = '') {
  try {
    debugLog(`Getting relationships for entity: ${entityName}`);
    debugLog(`Context text length: ${contextText.length} characters`);
    
    let response;
    
    if (currentSettings.apiType === 'anthropic') {
      response = await callAnthropicAPI('getEntityRelationships', entityName, apiKey, contextText);
    } else {
      // Default to OpenAI-compatible API
      response = await callOpenAIAPI('getEntityRelationships', entityName, apiKey, contextText);
    }
    
    return response;
  } catch (error) {
    debugLog(`Error in getEntityRelationships: ${error.message}`);
    throw error;
  }
}

// Call OpenAI-compatible API
async function callOpenAIAPI(action, inputContent, apiKey, contextText = '') {
  const apiBaseUrl = currentSettings.apiBaseUrl;
  const modelName = currentSettings.modelName;
  const temperature = currentSettings.temperature;
  
  let systemPrompt = '';
  let userPrompt = '';
  
  // Set prompts based on action
  switch (action) {
    case 'identifyEntities':
      systemPrompt = '你是一位擅长识别文本中实体的专家。从提供的文本中提取所有实体。对于每个实体，提供其名称和类型。';
      userPrompt = `识别以下文本中的所有实体，并将它们作为JSON返回：\n\n${inputContent}
       以JSON格式返回：
       {
        "entities": [
          {"name": "约翰·史密斯", "type": "人物"},
          {"name": "谷歌", "type": "组织"},
          {"name": "巴黎", "type": "地点"}
        ]
       }
      `;
      break;
    case 'getEntityDetails':
      systemPrompt = '你是一位擅长提供实体详细信息的专家。提供全面的描述、背景知识，以及与其他实体的关系。使用提供的上下文来增强你的回答。';
      
      // Include context text if available
      if (contextText && contextText.length > 0) {
        userPrompt = `提供关于"${inputContent}"的详细信息。包括描述、背景知识，以及与上下文中其他实体的关系。
        
        以下是实体出现的上下文，请使用这些信息来增强你的回答：
        
        "${contextText}"
        
        将信息作为JSON对象返回，包含"description"、"background"和"relationships"属性。其中relationships是一个数组，描述与其他实体的关系。
        以JSON格式返回：
        {
          "info": {
            "description": "实体的详细描述...",
            "background": "关于实体的背景知识...",
            "relationships": [
              {"entity": "其他实体名称", "description": "与该实体的关系描述"}
            ]
          }
        }
        `;
      } else {
        userPrompt = `提供关于"${inputContent}"的详细信息。包括描述和背景知识。将信息作为JSON对象返回，包含"description"、"background"和"relationships"属性。
        以JSON格式返回：
        {
          "info": {
            "description": "实体的详细描述...",
            "background": "关于实体的背景知识...",
            "relationships": []
          }
        }
        `;
      }
      break;
    case 'getEntityRelationships':
      systemPrompt = '你是一位擅长识别实体之间关系的专家。识别给定实体与其他实体之间所有可能的关系。使用提供的上下文来增强你的回答。';
      
      // Include context text if available
      if (contextText && contextText.length > 0) {
        userPrompt = `识别"${inputContent}"与其他实体之间可能的关系。
        
        以下是实体出现的上下文，请使用这些信息来识别关系：
        
        "${contextText}"
        
        将关系作为JSON对象返回，包含"relationships"属性，该属性包含一个对象数组，每个对象具有"targetEntity"和"type"属性。
        以JSON格式返回：
        {
         "relationships": [
           {"targetEntity": "实体B", "type": "父级"},
           {"targetEntity": "实体C", "type": "合作"}
         ]
        }
        `;
      } else {
        userPrompt = `识别"${inputContent}"与其他实体之间可能的关系。将关系作为JSON对象返回，包含"relationships"属性，该属性包含一个对象数组，每个对象具有"targetEntity"和"type"属性。
        以JSON格式返回：
        {
         "relationships": [
           {"targetEntity": "实体B", "type": "父级"},
           {"targetEntity": "实体C", "type": "合作"}
         ]
        }
        `;
      }
      break;
  }
  
  const response = await fetch(`${apiBaseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: modelName,
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: userPrompt
        }
      ],
      temperature: temperature,
      response_format: { type: "json_object" }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    debugLog(`API request failed with status ${response.status}: ${errorText}`);
    throw new Error(`API request failed with status ${response.status}`);
  }

  const data = await response.json();
  debugLog('Received response from API: ' + JSON.stringify(data));
  
  const responseContent = data.choices[0].message.content;
  
  try {
    const parsedContent = JSON.parse(responseContent);
    
    // Extract the appropriate data based on the action
    switch (action) {
      case 'identifyEntities':
        return parsedContent.entities || [];
      case 'getEntityDetails':
        return parsedContent.info;
      case 'getEntityRelationships':
        return parsedContent.relationships || [];
    }
    
    return parsedContent;
  } catch (e) {
    debugLog(`Failed to parse response: ${e.message}`);
    debugLog(`Raw content: ${responseContent}`);
    
    // Return appropriate default values based on the action
    switch (action) {
      case 'identifyEntities':
        return [];
      case 'getEntityDetails':
        return {
          description: 'Unable to retrieve entity details.',
          background: '',
          relationships: []
        };
      case 'getEntityRelationships':
        return [];
    }
  }
}

// Call Anthropic API
async function callAnthropicAPI(action, inputContent, apiKey, contextText = '') {
  const apiBaseUrl = currentSettings.apiBaseUrl;
  const modelName = currentSettings.modelName;
  const temperature = currentSettings.temperature;
  
  let systemPrompt = '';
  let userPrompt = '';
  
  // Set prompts based on action
  switch (action) {
    case 'identifyEntities':
      systemPrompt = '你是一位擅长识别文本中实体的专家。从提供的文本中提取所有实体。对于每个实体，提供其名称和类型。';
      userPrompt = `识别以下文本中的所有实体，并将它们作为JSON返回：\n\n${inputContent}
       以JSON格式返回：
       {
        "entities": [
          {"name": "约翰·史密斯", "type": "人物"},
          {"name": "谷歌", "type": "组织"},
          {"name": "巴黎", "type": "地点"}
        ]
       }
      `;
      break;
    case 'getEntityDetails':
      systemPrompt = '你是一位擅长提供实体详细信息的专家。提供全面的描述和背景知识。使用提供的上下文来增强你的回答。';
      
      // Include context text if available
      if (contextText && contextText.length > 0) {
        userPrompt = `提供关于"${inputContent}"的详细信息。包括描述和背景知识。
        
        以下是实体出现的上下文，请使用这些信息来增强你的回答：
        
        "${contextText}"
        
        将信息作为JSON对象返回，包含"description"和"background"属性。
        以JSON格式返回：
        {
          "info": {
            "description": "实体的详细描述...",
            "background": "关于实体的背景知识..."
          }
        }
        `;
      } else {
        userPrompt = `提供关于"${inputContent}"的详细信息。包括描述和背景知识。将信息作为JSON对象返回，包含"description"和"background"属性。
        以JSON格式返回：
        {
          "info": {
            "description": "实体的详细描述...",
            "background": "关于实体的背景知识..."
          }
        }
        `;
      }
      break;
    case 'getEntityRelationships':
      systemPrompt = '你是一位擅长识别实体之间关系的专家。识别给定实体与其他实体之间所有可能的关系。使用提供的上下文来增强你的回答。';
      
      // Include context text if available
      if (contextText && contextText.length > 0) {
        userPrompt = `识别"${inputContent}"与其他实体之间可能的关系。
        
        以下是实体出现的上下文，请使用这些信息来识别关系：
        
        "${contextText}"
        
        将关系作为JSON对象返回，包含"relationships"属性，该属性包含一个对象数组，每个对象具有"targetEntity"和"type"属性。
        以JSON格式返回：
        {
         "relationships": [
           {"targetEntity": "实体B", "type": "父级"},
           {"targetEntity": "实体C", "type": "合作"}
         ]
        }
        `;
      } else {
        userPrompt = `识别"${inputContent}"与其他实体之间可能的关系。将关系作为JSON对象返回，包含"relationships"属性，该属性包含一个对象数组，每个对象具有"targetEntity"和"type"属性。
        以JSON格式返回：
        {
         "relationships": [
           {"targetEntity": "实体B", "type": "父级"},
           {"targetEntity": "实体C", "type": "合作"}
         ]
        }
        `;
      }
      break;
  }
  
  // Anthropic API expects a different format than OpenAI
  const response = await fetch(`${apiBaseUrl}/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: modelName,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: userPrompt
        }
      ],
      temperature: temperature,
      max_tokens: 1000,
      response_format: { type: "json_object" }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    debugLog(`Anthropic API request failed with status ${response.status}: ${errorText}`);
    throw new Error(`Anthropic API request failed with status ${response.status}`);
  }

  const data = await response.json();
  debugLog('Received response from Anthropic API');
  
  // Anthropic API response structure is different from OpenAI
  const responseContent = data.content[0].text;
  
  try {
    const parsedContent = JSON.parse(responseContent);
    
    // Extract the appropriate data based on the action
    switch (action) {
      case 'identifyEntities':
        return parsedContent.entities || [];
      case 'getEntityDetails':
        return parsedContent.info;
      case 'getEntityRelationships':
        return parsedContent.relationships || [];
    }
    
    return parsedContent;
  } catch (e) {
    debugLog(`Failed to parse Anthropic response: ${e.message}`);
    debugLog(`Raw content: ${responseContent}`);
    
    // Return appropriate default values based on the action
    switch (action) {
      case 'identifyEntities':
        return [];
      case 'getEntityDetails':
        return {
          description: 'Unable to retrieve entity details.',
          background: '',
          relationships: []
        };
      case 'getEntityRelationships':
        return [];
    }
  }
}

// Listen for settings changes
chrome.storage.onChanged.addListener(function(changes, namespace) {
  if (namespace === 'sync' && changes.modelSettings) {
    currentSettings = changes.modelSettings.newValue;
    debugLog('Settings updated: ' + JSON.stringify({
      ...currentSettings,
      apiKey: currentSettings.apiKey ? currentSettings.apiKey.substring(0, 5) + '...' : 'not set'
    }));
  }
});

// Initialize settings when background script loads
initializeSettings();

// Log when the background script is loaded
debugLog('Background script loaded'); 