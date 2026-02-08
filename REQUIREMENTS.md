# Git Repository Analyzer - Requirements Document

## 1. Functional Requirements

### 1.1 Core Functionality

#### FR-1: Repository URL Ingestion
**Priority:** MUST  
**Description:** The system shall accept a GitHub repository URL as input.

**Acceptance Criteria:**
- AC-1.1: System accepts full GitHub URLs (https://github.com/owner/repo)
- AC-1.2: System accepts GitHub URLs with .git suffix
- AC-1.3: System validates URL format before processing
- AC-1.4: System displays clear error message for invalid URLs
- AC-1.5: System handles both public and private repositories (with proper authentication)

**Test Cases:**
```
Valid inputs:
- https://github.com/facebook/react
- https://github.com/torvalds/linux.git
- https://github.com/microsoft/vscode

Invalid inputs:
- gitlab.com/user/repo (not GitHub)
- github.com/invalid (missing protocol)
- https://github.com/ (incomplete URL)
```

---

#### FR-2: Executive Summary Generation
**Priority:** MUST  
**Description:** The system shall generate and display an executive summary of source code changes for non-technical managers.

**Acceptance Criteria:**
- AC-2.1: Summary analyzes actual code changes (diffs), not just commit messages
- AC-2.2: Summary is written in non-technical, business-friendly language
- AC-2.3: Summary explains what functionality changed, not how it changed
- AC-2.4: Summary is 2-3 paragraphs in length
- AC-2.5: Summary includes:
  - New features or functionality added
  - Bugs or issues fixed
  - Performance improvements
  - Security enhancements
  - Overall development focus
- AC-2.6: Summary is clearly labeled and visually distinct from other content
- AC-2.7: Summary degrades gracefully if AI service is unavailable

**Quality Metrics:**
- Response generated within 10 seconds
- Summary contains no technical jargon (function names, code syntax, etc.)
- Summary is comprehensible to someone with no programming knowledge

---

#### FR-3: Time Range Selection
**Priority:** MUST  
**Description:** The system shall provide a time range toggle to filter repository activity.

**Acceptance Criteria:**
- AC-3.1: System provides at minimum the following time ranges:
  - Last 24 Hours
  - Last Week
  - Last Month
  - Last Quarter
  - Last 6 Months
  - Last Year
  - All Time
- AC-3.2: Time range selector is clearly visible and easily accessible
- AC-3.3: Selected time range is applied to all displayed data
- AC-3.4: System displays which time range is currently selected
- AC-3.5: Changing time range triggers new analysis
- AC-3.6: System caches results per time range to improve performance

**Test Cases:**
```
Scenario 1: User selects "Last Week"
- System fetches commits from last 7 days
- Summary reflects only last week's changes
- Charts show last week's data

Scenario 2: User switches from "Week" to "Month"
- System fetches new data for last 30 days
- All visualizations update
- Previous selection is cleared
```

---

#### FR-4: Dark Mode Toggle
**Priority:** MUST  
**Description:** The system shall provide a dark mode toggle for improved accessibility and user preference.

**Acceptance Criteria:**
- AC-4.1: Dark mode toggle is visible and accessible from all pages
- AC-4.2: Toggle is positioned in top-right corner
- AC-4.3: Toggle clearly indicates current mode (🌙 for light, ☀️ for dark)
- AC-4.4: Dark mode applies to all UI elements:
  - Background colors
  - Text colors
  - Card/panel backgrounds
  - Form inputs
  - Buttons
  - Charts and visualizations
- AC-4.5: Color contrast meets WCAG 2.1 Level AA standards in both modes
- AC-4.6: Mode preference persists during session
- AC-4.7: Transition between modes is smooth (animated, <0.5s)

**Test Cases:**
```
Light Mode Colors:
- Background: #F5F5F5 (light gray)
- Text: #1A1A1A (near black)
- Cards: #FFFFFF (white)

Dark Mode Colors:
- Background: #0A0A0A (near black)
- Text: #E8E8E8 (light gray)
- Cards: #1A1A1A (dark gray)
```

---

### 1.2 Performance Requirements

#### FR-5: Speed and Quality Balance
**Priority:** MUST  
**Description:** The system shall find an acceptable balance between response speed and data quality.

**Acceptance Criteria:**
- AC-5.1: Initial analysis completes within 15 seconds for typical repositories
- AC-5.2: Cached results return within 1 second
- AC-5.3: System limits data fetching to prevent timeouts:
  - Maximum 100 commits analyzed
  - Maximum 20 PRs detailed
  - Maximum 10 diffs for AI summary
- AC-5.4: System provides loading indicators during processing
- AC-5.5: System implements rate limiting to prevent API throttling
- AC-5.6: System caches results for 5 minutes per repository/timerange combination
- AC-5.7: System handles large repositories (>10k commits) without timeout

**Performance Targets:**
```
Small repo (<100 commits): 3-5 seconds
Medium repo (100-1000 commits): 5-10 seconds
Large repo (>1000 commits): 10-15 seconds
Cached result: <1 second
```

---

## 2. Non-Functional Requirements

### 2.1 Usability

#### NFR-1: User Interface
- UI shall be intuitive and require no training
- All interactive elements shall have clear labels
- Form fields shall have placeholder text
- Error messages shall be specific and actionable
- Loading states shall be clearly indicated

#### NFR-2: Accessibility
- Interface shall be keyboard navigable
- Color contrast shall meet WCAG 2.1 Level AA
- Interactive elements shall have appropriate ARIA labels
- Text shall be resizable up to 200% without loss of functionality

### 2.2 Reliability

#### NFR-3: Error Handling
- System shall handle GitHub API rate limits gracefully
- System shall provide clear error messages for:
  - Invalid URLs
  - Network failures
  - API timeouts
  - Authentication failures
- System shall not crash on malformed input
- System shall log errors for debugging

#### NFR-4: Data Accuracy
- Commit counts shall match GitHub's reported counts
- Date ranges shall be accurately applied
- Code diffs shall be complete and unmodified
- AI summaries shall accurately reflect code changes

### 2.3 Security

#### NFR-5: Authentication
- GitHub token shall be stored securely (environment variables)
- Token shall never be exposed in client-side code
- Token shall never be logged
- System shall support both personal and OAuth tokens

#### NFR-6: Data Privacy
- System shall not store repository data permanently
- Cache shall clear after 5 minutes
- System shall not log repository contents
- User input shall be sanitized to prevent injection

### 2.4 Scalability

#### NFR-7: Concurrent Users
- System shall support multiple concurrent analyses
- Each analysis shall be independent (no shared state)
- System shall implement request queuing if needed

### 2.5 Maintainability

#### NFR-8: Code Quality
- Code shall follow consistent style guidelines
- Functions shall be single-purpose and well-named
- Complex logic shall be commented
- Dependencies shall be minimal and up-to-date

#### NFR-9: Deployment
- System shall support multiple deployment targets:
  - Vercel (serverless)
  - Kubernetes (self-hosted)
  - Docker (local)
- Environment variables shall be clearly documented
- Setup process shall be documented with examples

---

## 3. Technical Constraints

### 3.1 External Dependencies

#### TC-1: GitHub API
- System depends on GitHub REST API v3
- Rate limits: 5,000 requests/hour (authenticated)
- Requires personal access token with `repo` or `public_repo` scope

#### TC-2: AI Service
- System optionally depends on Groq API
- Free tier: 14,400 requests/day, 30 requests/minute
- Requires API key from console.groq.com
- Falls back gracefully if unavailable

### 3.2 Browser Support

#### TC-3: Compatibility
- Modern browsers (last 2 versions):
  - Chrome/Edge (Chromium)
  - Firefox
  - Safari
- JavaScript required (React application)
- No IE11 support required

---

## 4. Data Requirements

### 4.1 Input Data

#### DR-1: Repository URL
```
Format: https://github.com/{owner}/{repo}[.git]
Example: https://github.com/facebook/react
Validation: Must match GitHub URL pattern
```

#### DR-2: Time Range
```
Type: Enum
Values: 'day' | 'week' | 'month' | 'quarter' | '6months' | 'year' | 'all'
Default: 'week'
```

### 4.2 Output Data

#### DR-3: Analysis Results
```json
{
  "repository": {
    "name": "string",
    "description": "string",
    "stars": "number",
    "forks": "number",
    "url": "string"
  },
  "executiveSummary": "string | null",
  "summary": "string",
  "stats": {
    "totalCommits": "number",
    "totalContributors": "number",
    "totalPRs": "number",
    "categories": {
      "features": "number",
      "bugFixes": "number",
      "performance": "number",
      "security": "number"
    }
  },
  "contributors": "array",
  "recentCommits": "array",
  "recentPRs": "array"
}
```

---

## 5. User Stories

### US-1: Analyze Repository Activity
```
As a project manager
I want to analyze repository activity over the last week
So that I can report progress to stakeholders

Given I have a GitHub repository URL
When I enter the URL and select "Last Week"
Then I see a summary of what changed in plain English
```

### US-2: Compare Time Periods
```
As a team lead
I want to compare activity across different time periods
So that I can identify trends and patterns

Given I have analyzed a repository for "Last Week"
When I change the time range to "Last Month"
Then I see updated data reflecting the new time range
```

### US-3: Read in Low-Light Conditions
```
As a user working at night
I want to enable dark mode
So that I can read the content without eye strain

Given I am viewing analysis results
When I click the dark mode toggle
Then all colors invert to dark theme
```

### US-4: Get Quick Results
```
As a busy executive
I want results to load quickly
So that I don't waste time waiting

Given I enter a repository URL
When I click analyze
Then I see results within 15 seconds
And cached results appear in less than 1 second
```

---

## 6. Success Criteria

The system is considered successful when:

1. ✅ Users can analyze any public GitHub repository
2. ✅ Executive summaries are comprehensible to non-technical readers
3. ✅ 90% of analyses complete within 15 seconds
4. ✅ Cached results return in <1 second
5. ✅ Dark mode works across all UI elements
6. ✅ All 7 time ranges are selectable and functional
7. ✅ System handles errors gracefully without crashes
8. ✅ Users can deploy to both Vercel and Kubernetes
9. ✅ Color contrast meets WCAG 2.1 Level AA
10. ✅ System works in Chrome, Firefox, and Safari

---

## 7. Out of Scope

The following are explicitly NOT in scope for v1:

- ❌ Support for non-GitHub repositories (GitLab, Bitbucket)
- ❌ Historical data storage/trending over time
- ❌ User accounts or authentication
- ❌ Comparison between repositories
- ❌ Automated scheduling/monitoring
- ❌ PDF/export functionality
- ❌ Mobile app (web only)
- ❌ Email notifications
- ❌ Integration with project management tools
- ❌ Code quality metrics (complexity, coverage, etc.)

These may be considered for future versions.
