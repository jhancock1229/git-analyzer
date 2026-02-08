# AI Executive Summary Feature

## Overview

The Git Analyzer includes an optional AI-powered executive summary that analyzes actual code changes (not just commit messages) to generate business-friendly explanations of what happened in the repository.

## How It Works

1. **Fetches Code Diffs:** Gets the actual code changes (diffs) from the 10 most recent commits
2. **Analyzes Changes:** Uses Groq's Llama 3.1 to analyze what the code actually does
3. **Generates Summary:** Creates a 2-3 paragraph executive summary in plain English

## What It Analyzes

- New features and functionality added
- Bugs and issues fixed
- Performance improvements
- Security enhancements
- Architectural changes
- Overall development patterns

## Setup

### 1. Get a Free Groq API Key

1. Go to https://console.groq.com
2. Sign up (free)
3. Create an API key
4. Copy the key

### 2. Add to Environment

**Vercel:**
```
Settings → Environment Variables
Name: GROQ_API_KEY
Value: gsk_your_key_here
```

**k3s:**
```yaml
# k8s/secret.yaml
groq-api-key: "gsk_your_key_here"
```

**Local Development:**
```bash
# .env
GROQ_API_KEY=gsk_your_key_here
```

### 3. Deploy

The feature will automatically activate when the API key is present.

## Usage

Just analyze a repository normally - if `GROQ_API_KEY` is set, you'll see an "AI Executive Summary" section appear below the basic summary.

## Cost

**FREE!** Groq's free tier includes:
- 14,400 requests per day
- 30 requests per minute
- More than enough for this use case

## Performance Impact

- Adds ~2-5 seconds to analysis time
- Only fetches diffs for 10 most recent commits
- Runs in parallel with other API calls where possible
- Cached results include the AI summary

## Graceful Degradation

If no `GROQ_API_KEY` is provided:
- App works normally without AI summaries
- No errors shown to users
- Just skips the summary generation

## Example Output

```
The team focused heavily on authentication and security improvements this 
week. Major changes include implementing OAuth 2.0 support with token 
refresh logic, adding rate limiting middleware to prevent abuse, and 
updating password hashing to use bcrypt with stronger work factors.

Several bug fixes addressed edge cases in the payment processing flow, 
particularly around handling declined transactions and ensuring proper 
webhook delivery. The code now includes retry logic with exponential 
backoff for failed payment notifications.

Performance improvements were made to the database query layer, with 
the addition of proper indexes on frequently-accessed columns and 
implementation of query result caching. The changes should significantly 
reduce response times for user-facing endpoints.
```

## Limitations

- Only analyzes 10 most recent commits (to stay within token limits)
- Each diff truncated to 2000 characters
- Quality depends on code clarity
- May miss context from older changes
- English language only

## Alternatives

If you prefer a different LLM:

### Together AI
```javascript
const response = await fetch('https://api.together.xyz/v1/chat/completions', {
  headers: { 'Authorization': `Bearer ${process.env.TOGETHER_API_KEY}` },
  body: JSON.stringify({
    model: 'meta-llama/Llama-3-70b-chat-hf',
    messages: [...]
  })
});
```

### Cerebras (Faster, Free during beta)
```javascript
const response = await fetch('https://api.cerebras.ai/v1/chat/completions', {
  headers: { 'Authorization': `Bearer ${process.env.CEREBRAS_API_KEY}` },
  body: JSON.stringify({
    model: 'llama3.1-70b',
    messages: [...]
  })
});
```

## Troubleshooting

**Summary not appearing:**
- Check `GROQ_API_KEY` is set in environment
- Check function logs for `[LLM]` messages
- Verify API key is valid at https://console.groq.com

**Timeouts:**
- Reduce number of commits analyzed (currently 10)
- Use smaller model like `llama-3.1-8b-instant`
- Increase function timeout in vercel.json

**Poor quality summaries:**
- Make sure commit diffs are being fetched (check logs)
- Try adjusting the prompt in `generateExecutiveSummary()`
- Use a larger model (e.g., `llama-3.1-70b-versatile`)

## Customization

Edit the prompt in `api/analyze.js`:

```javascript
const prompt = `You are analyzing code changes...
[Customize instructions here]
`;
```

Adjust parameters:
```javascript
{
  model: 'llama-3.1-8b-instant',  // Change model
  max_tokens: 600,                 // Adjust length
  temperature: 0.7                 // Adjust creativity (0-1)
}
```
