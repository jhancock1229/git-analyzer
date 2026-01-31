# Git Repository Analyzer - Setup Instructions

## Environment Variables

To enable LLM-powered commit summaries, you need to set up the Anthropic API key.

### Setting up in Vercel:

1. Go to your Vercel dashboard
2. Select your `git-analyzer` project
3. Go to **Settings** → **Environment Variables**
4. Add a new variable:
   - **Name**: `ANTHROPIC_API_KEY`
   - **Value**: Your Anthropic API key (get one at https://console.anthropic.com/)
   - **Environments**: Select all (Production, Preview, Development)
5. Click **Save**
6. Redeploy your project for changes to take effect

### Getting an Anthropic API Key:

1. Go to https://console.anthropic.com/
2. Sign up or log in
3. Go to **API Keys** in the dashboard
4. Click **Create Key**
5. Copy the key (starts with `sk-ant-...`)
6. Add it to Vercel as described above

### What the LLM Summary Does:

The analyzer now uses Claude (Anthropic's AI) to:
- Read through the most recent 30 commits
- Identify major themes and work areas
- Generate an executive-friendly summary of what the team has been building
- Highlight specific features, improvements, and development direction

### Fallback Behavior:

If the API key is not set or the API call fails, the analyzer will:
- Still show all the data (commits, branches, contributors, etc.)
- Display a basic categorized list of commits instead of the LLM summary
- Continue to function normally for all other features

## Testing

After setting up the environment variable:
1. Trigger a new deployment in Vercel (or wait for next push)
2. Test with a repository like `pytorch/pytorch`
3. The Activity Summary should now show an AI-generated narrative

## Troubleshooting

**Issue**: Summary says "Unable to generate detailed summary"
- **Fix**: Check that `ANTHROPIC_API_KEY` is set correctly in Vercel
- **Fix**: Make sure you've redeployed after adding the environment variable
- **Fix**: Check Vercel function logs for API errors

**Issue**: API rate limits
- **Fix**: The analyzer only makes 1 API call per repository analysis
- **Fix**: Each summary uses ~2000 tokens, well within free tier limits
