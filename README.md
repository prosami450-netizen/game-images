# App Asset Studio

A powerful React application designed for mobile developers and ASO (App Store Optimization) specialists. This tool automates the process of extracting, resizing, and formatting app icons and screenshots from popular APK repositories.

![App Screenshot](https://placehold.co/800x400/1e293b/ffffff?text=App+Asset+Studio+Preview)

## Features

### 🚀 Asset Extraction
- **Multi-Source Support**: Extract high-quality assets from **Google Play Store**, **APKPure**, and **APKCombo**.
- **Batch Processing**: Paste multiple store URLs to process dozens of apps simultaneously.
- **Smart Resizing**: Automatically resizes icons to standard formats (512x512, 114x114) and screenshots to device sizes (720p Landscape/Portrait).
- **Intelligent Fallbacks**: Uses multiple proxy strategies to bypass strict CORS policies and image protection.

### 🎨 Asset Formatting
- **Manual Upload**: Upload your own raw images to format them instantly.
- **Canvas Processing**: Adds high-quality blurred backgrounds to screenshots to fit specific aspect ratios without cropping.

### ✨ AI Tools (Powered by Google Gemini)
- **Generate Assets**: Create new app icons or screenshots from text prompts using `gemini-3-pro-image-preview`.
- **Edit Assets**: Modify existing images using natural language instructions with `gemini-2.5-flash-image`.

## Tech Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS
- **AI Integration**: Google GenAI SDK (@google/genai)
- **Utilities**: JSZip (Compression), Lucide React (Icons)
- **Proxying**: Multiple CORS proxies (wsrv.nl, corsproxy.io, etc.)

## Getting Started

### Prerequisites
- A modern web browser.
- A Google Gemini API Key (for AI features).

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/app-asset-studio.git
   ```

2. Open the project in your preferred web IDE or serve it locally.
   *Note: This project uses ES Modules via CDN import maps. It does not currently require a Node.js build step.*

### API Key Configuration
The application supports two methods for API keys:
1. **Environment Variable**: Set `API_KEY` in your environment (if using a build tool).
2. **Interactive Selection**: If running in Google AI Studio or a compatible environment, the app will prompt you to select a key securely.

## License

MIT
