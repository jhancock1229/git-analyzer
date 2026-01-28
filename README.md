# Git Repository Analyzer - React App

A modern React application for analyzing Git repositories using the GitHub API.

## 🚀 Quick Start

### 1. Install Dependencies

```bash
cd react-app
npm install
```

This installs both frontend (React, Vite) and backend (Express, CORS) dependencies.

### 2. Start the Backend API Server

In one terminal:

```bash
npm run server
```

Or:

```bash
node server-api.js
```

The API will run on `http://localhost:3002`

### 3. Start the React Dev Server

In another terminal:

```bash
npm run dev
```

The app will run on `http://localhost:3000`

### 4. Open in Browser

Navigate to `http://localhost:3000`

## 📁 Project Structure

```
react-app/
├── src/
│   ├── components/
│   │   ├── BranchDiagram.jsx    # SVG branch visualization
│   │   └── Modal.jsx             # Modal components (Info, Diagram, List)
│   ├── App.jsx                   # Main application component
│   ├── main.jsx                  # React entry point
│   └── index.css                 # Global styles
├── server-api.js                 # Backend API (GitHub API client)
├── index.html                    # HTML entry point
├── vite.config.js               # Vite configuration
└── package.json                  # Dependencies (includes Express)
```

**Everything in one directory!** No need to go up a level.

## 🎯 Features

### Analysis
- ✅ Branching strategy detection (Git Flow, GitHub Flow, Trunk-Based)
- ✅ Workflow detection (Fork + PR, Direct Commit, Branch-based)
- ✅ Contributor statistics
- ✅ Branch visualization with divergence
- ✅ Commit timeline

### Interactive UI
- ✅ Clickable branch diagram (expands to full view)
- ✅ Sortable contributor/branch/commit lists
- ✅ Clickable commits → open on GitHub
- ✅ Clickable branches → open on GitHub
- ✅ Info modals with detection criteria
- ✅ Responsive design

## 🔧 Technology Stack

- **Frontend**: React 18 + Vite
- **Backend**: Node.js + Express
- **API**: GitHub REST API v3
- **Styling**: Inline styles (no dependencies)
- **Fonts**: IBM Plex Mono + Literata

## 📊 How It Works

1. **User enters GitHub repo URL**
2. **Backend fetches data** via GitHub API (no cloning!)
3. **Analyzes** branching patterns, workflows, contributors
4. **Visualizes** branch history as interactive SVG diagram
5. **Click to explore** - commits, branches, strategies

## 🌟 Key Components

### BranchDiagram
- SVG-based git graph visualization
- Shows branch divergence and merges
- Clickable commits that link to GitHub
- Scales to show full history

### Modal System
- **InfoModal**: Shows strategy/workflow explanations
- **DiagramModal**: Full-screen scrollable branch diagram
- **SortableListModal**: Sortable lists of contributors/branches/commits

### App
- Main container component
- Manages state and API calls
- Coordinates modal system

## 🔑 GitHub Token (Optional)

Set a GitHub token to increase rate limits from 60 to 5,000 requests/hour:

```bash
export GITHUB_TOKEN=your_token_here
node server-api.js
```

Get a token at: https://github.com/settings/tokens

## 🚢 Building for Production

```bash
npm run build
```

This creates a `dist/` folder with optimized static files ready for deployment.

## 📝 Notes

- No git cloning required - uses GitHub API
- No storage costs - all data fetched on demand
- Fast analysis - results in seconds
- Only works with GitHub repositories
- Rate limited without token (60 req/hour)

## 🎨 Customization

All styling is inline in components - easy to customize!
Edit colors, fonts, spacing directly in component files.

## 🐛 Troubleshooting

**"Failed to analyze" error:**
- Make sure `server-api.js` is running on port 3002
- Check that the GitHub URL is valid and public

**Empty diagram:**
- Repository might not have enough commits
- Check browser console for errors

**Rate limit errors:**
- Set a GitHub token (see above)
- Wait an hour for rate limit to reset

## 📄 License

MIT
