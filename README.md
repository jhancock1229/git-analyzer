# Git Repository Analyzer

A simple tool to analyze git repositories and visualize who has been working on what over different time periods.

## Features

- Analyze any git repository (public or local)
- View contributor activity across different time ranges:
  - Last 24 Hours
  - Last Week
  - Last Month
  - Last Quarter (90 days)
  - Last 6 Months
  - Last Year
  - All Time
- See detailed contributor statistics:
  - Number of commits
  - Lines added/deleted
  - Branches created
  - Last activity time
- Color-coded branch types (feature, bugfix, refactor, etc.)
- Clean, editorial design that's easy for non-technical managers to understand

## Prerequisites

- Node.js (v14 or higher)
- Git installed on your system
- npm or yarn

## Installation

1. Install backend dependencies:

```bash
npm install
```

2. For the React frontend, you'll need to set up a React project. You can use Create React App or Vite:

```bash
# Using Create React App
npx create-react-app git-analyzer-frontend
cd git-analyzer-frontend

# Install recharts for visualizations (if you want to add charts later)
npm install recharts

# Copy the GitContributorAnalyzer.jsx into src/
# Then import and use it in App.js
```

## Running the Application

### 1. Start the Backend Server

```bash
node server.js
```

The backend will start on `http://localhost:3001`

### 2. Start the Frontend

In a separate terminal:

```bash
cd git-analyzer-frontend
npm start
```

The frontend will start on `http://localhost:3000`

## Usage

1. Open your browser to `http://localhost:3000`
2. Enter a git repository URL (e.g., `https://github.com/facebook/react.git`)
3. Select a time range from the dropdown
4. Click "ANALYZE REPOSITORY"
5. View the results showing contributors and their branches

## API Endpoints

### POST /api/analyze

Analyze a git repository for a specific time range.

**Request Body:**
```json
{
  "repoUrl": "https://github.com/username/repo.git",
  "timeRange": "week"
}
```

**Time Range Options:**
- `day` - Last 24 hours
- `week` - Last 7 days
- `month` - Last 30 days
- `quarter` - Last 90 days
- `6months` - Last 180 days
- `year` - Last 365 days
- `all` - All time

**Response:**
```json
{
  "success": true,
  "repoUrl": "https://github.com/username/repo.git",
  "timeRange": "week",
  "data": {
    "contributors": [
      {
        "name": "John Doe",
        "email": "john@example.com",
        "commits": 45,
        "additions": 2340,
        "deletions": 890,
        "branches": [
          {
            "name": "feature/new-feature",
            "lastUpdate": "2 hours ago"
          }
        ]
      }
    ],
    "totalCommits": 234,
    "timeRange": "Last Week"
  }
}
```

### GET /api/health

Health check endpoint.

**Response:**
```json
{
  "status": "ok"
}
```

## How It Works

1. **Repository Cloning**: The backend clones the repository (or updates it if already cloned) to a local `repos/` directory
2. **Git Analysis**: Uses native git commands to extract:
   - Branch information (`git for-each-ref`)
   - Commit history (`git log`)
   - File changes (additions/deletions)
3. **Data Processing**: Parses git output and aggregates data by contributor
4. **Visualization**: Frontend displays the data in an easy-to-read format

## Project Structure

```
.
├── server.js                      # Express backend server
├── package.json                   # Backend dependencies
├── GitContributorAnalyzer.jsx     # React frontend component
├── repos/                         # Git repositories (created automatically)
└── README.md                      # This file
```

## Analyzing Private Repositories

To analyze private repositories, you have a few options:

1. **Local Repositories**: Instead of a URL, you can modify the code to accept a local path
2. **SSH Keys**: Ensure your SSH keys are set up and use SSH URLs (git@github.com:user/repo.git)
3. **Access Tokens**: For HTTPS URLs, you can include authentication in the URL (not recommended for production)

## Customization

### Adding More Time Ranges

Edit the `TIME_RANGES` object in `server.js`:

```javascript
const TIME_RANGES = {
  'custom': { days: 14, label: 'Last 2 Weeks' },
  // ... add more ranges
};
```

### Changing Branch Color Coding

Edit the `getBranchColor` function in `GitContributorAnalyzer.jsx`:

```javascript
const getBranchColor = (branchName) => {
  if (branchName.includes('epic')) return '#FFD700';
  // ... add more patterns
};
```

## Troubleshooting

**Error: Failed to clone repository**
- Check that the repository URL is correct
- Ensure you have network access
- For private repos, verify your authentication

**Error: git command not found**
- Make sure git is installed: `git --version`
- On Windows, ensure git is in your PATH

**Backend won't start**
- Check if port 3001 is already in use
- Try changing the PORT in server.js

## Performance Notes

- First analysis of a large repository may take time (cloning)
- Subsequent analyses are faster (uses git pull)
- Very large repositories may need increased buffer sizes
- The `repos/` directory will grow over time - clean it periodically

## Future Enhancements

- [ ] Commit frequency charts
- [ ] Code ownership heatmaps
- [ ] Branch merge status
- [ ] Pull request integration
- [ ] Export to PDF/CSV
- [ ] Real-time updates
- [ ] Multi-repository comparison

## License

MIT