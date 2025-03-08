# Entity Highlighter Chrome Extension

A Chrome extension that highlights entity words in web pages and visualizes relationships between entities using Deepseek's language models.

## Features

- **Entity Highlighting**: Automatically identifies and highlights entities (people, organizations, locations, concepts, etc.) in web page text.
- **Progressive Processing**: Processes text in small chunks (500 characters) to provide a smooth experience even on large pages.
- **Visual Processing Feedback**: Highlights the text chunks currently being processed with a pulsing blue overlay.
- **Entity Information**: Click on highlighted entities to view detailed information and background knowledge.
- **Relationship Visualization**: Displays relationships between entities with visual lines connecting related entities.
- **Powered by Deepseek**: Uses Deepseek's advanced language models for entity recognition and information retrieval.

## Installation

1. Download or clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right corner
4. Click "Load unpacked" and select the directory containing the extension files
5. The Entity Highlighter extension should now be installed and visible in your Chrome toolbar

## Usage

1. Click on the Entity Highlighter icon in your Chrome toolbar
2. Enter your Deepseek API key in the Settings page (you'll need to obtain this from Deepseek)
3. Navigate to any web page with text content
4. Click the "Highlight Entities" button in the extension popup
5. The extension will progressively process the page text in chunks, showing a status indicator
6. Each text chunk being processed will be highlighted with a pulsing blue overlay
7. Entities will be highlighted in yellow as they are identified
8. Click on any highlighted entity to view detailed information and relationships

## Configuration

- **API Key**: You need to provide a valid Deepseek API key in the extension settings
- The API key is stored locally in your browser and is only sent to Deepseek's servers when processing text

## Technical Details

The extension consists of the following components:

- **Content Script**: Handles entity highlighting and relationship visualization on web pages
  - Processes text in chunks of 500 characters for better performance
  - Visually highlights chunks during processing with a pulsing blue overlay
  - Progressively highlights entities as they are identified
- **Background Script**: Manages communication with Deepseek's API
  - Uses JSON response format for better organized responses
- **Popup**: Provides user interface for triggering entity highlighting
- **Options Page**: Allows users to configure their Deepseek API key

## Privacy

- The extension only processes text on the current web page
- Text is sent to Deepseek's API in small chunks for entity recognition and information retrieval
- No data is stored on servers beyond what is necessary for API processing
- Your API key is stored locally in your browser's storage

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Powered by Deepseek's language models
- Inspired by the need for better entity recognition and visualization in web content 