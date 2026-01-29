# Stale Branches Feature - Manual Update Needed

The server-api.js has been updated with stale branch detection, but api/analyze.js needs the same updates.

## Changes Made to server-api.js (lines 75-110):

Added stale branch detection logic that checks if branches haven't had commits in 90+ days.

## To Update api/analyze.js:

Replace the `analyzeGitHubRepo` function in `api/analyze.js` with the one from `server-api.js` (keeping the export handler at the bottom).

OR use the working server-api.js for local dev and skip Vercel deployment of stale branches feature for now.

## Quick Fix:
For now, the frontend will work without backend changes - it just won't show stale branches until api/analyze.js is updated to match server-api.js logic.
