# Compliance Program Evidence Layer
## Accessibility Assessment Tool Enhancement

This document describes the "Compliance Program Evidence" layer added to the accessibility assessment tool. It enables organizations to demonstrate the six key capabilities for digital accessibility compliance.

---

## Overview

The Compliance Program Evidence layer transforms the accessibility analyzer from a scan-only tool into a **comprehensive governance platform** that helps organizations document:

1. **Standards adoption** and organizational policy commitment
2. **Digital asset inventory** and assessment coverage
3. **Issue prioritization** based on impact, risk, and usage
4. **Remediation plans** with ownership and timelines
5. **Workflow integration** through checklists and governance processes
6. **Remediation progress** and compliance evidence

---

## Architecture

### Data Model (`lib/types/evidence.ts`)

TypeScript types for:
- **Standards Adoption**: Organization commitment to accessibility standards (WCAG 2.2 A/AA, Section 508, VITA)
- **Digital Assets**: Tracked websites/applications with ownership and environment
- **Scan Results**: Historical assessment data per asset
- **Prioritized Issues**: Issues ranked by public impact, compliance risk, and usage frequency
- **Remediation Tasks**: Fix assignments with owner roles, target dates, and status
- **Accessibility Workflow**: Governance checklists for content, development, and procurement
- **Evidence Bundle**: Complete snapshot of compliance program state

### Storage (`lib/storage/evidenceStore.ts`)

Local JSON file storage (`data/program.json`) with CRUD operations:
- No external database required
- Automatically persisted after each operation
- Simple file-based approach suitable for small to medium organizations

### API Endpoints

```
POST   /api/evidence/standards          # Create/update standards adoption
GET    /api/evidence/standards          # Retrieve current standards

GET    /api/evidence/assets             # List all digital assets
POST   /api/evidence/assets             # Register new asset

POST   /api/evidence/scans/[assetId]    # Create scan result
GET    /api/evidence/scans/[assetId]    # Get scan history for asset

GET    /api/evidence/issues             # List all prioritized issues
POST   /api/evidence/issues             # Create issue entry

GET    /api/evidence/remediation        # List all remediation tasks
POST   /api/evidence/remediation        # Create remediation task
PUT    /api/evidence/remediation        # Update task status/progress

GET    /api/evidence/workflow           # Get workflow checklists
POST   /api/evidence/workflow           # Update workflow definitions

GET    /api/evidence/export?type=X      # Export CSV (remediation, backlog, inventory, progress)
GET    /api/evidence/bundle             # Generate full evidence JSON bundle
```

### UI Components

Located in `components/evidence/`:

1. **StandardsAdoptionForm**: Document standards adoption with policy statement
2. **AssetInventoryForm**: Register and manage digital assets
3. **PrioritizationBacklogView**: Display issues ranked by priority score
4. **RemediationPlanView**: Track remediation tasks with status updates

Main evidence page: `app/evidence/page.tsx`
- Accordion interface with all six program areas
- Export buttons for CSV and JSON formats
- Workflow checklists embedded in UI

---

## How This Demonstrates the Six Capabilities

### 1. Identified and Adopted an Accessibility Standard ✅

**Evidence Location**: Standards & Policy Adoption section

**Artifacts**:
- Organization selects standards: WCAG 2.2 A/AA, Section 508, or VITA
- Adoption date recorded automatically
- Free-text policy statement documenting organizational commitment
- Included in every report and export

**Demonstrates**:
- Policy commitment is documented and dated
- Standards are clearly stated
- Can be included in all compliance communications

**Export**: Included in JSON bundle; visible on evidence page

---

### 2. Assessed Digital Assets to Understand Accessibility Gaps ✅

**Evidence Location**: Digital Asset Inventory & Assessment section

**Artifacts**:
- Asset inventory: name, URL, type, environment, owner, public-facing flag, critical service flag
- Scan history per asset: date, pages sampled, metrics, findings summary
- Assessment coverage report showing which assets have been scanned and when

**Data Tracked**:
```
Asset {
  name: "Main Website"
  url: "https://example.gov"
  type: "Website"
  environment: "Production"
  owner: "John Doe"
  publicFacing: true
  criticalService: true
}

ScanResult {
  assetId: "asset-123"
  scanDate: "2026-01-20T15:03:00Z"
  pagesSampled: 47
  totalImages: 792
  missingAltCount: 0
  totalControls: 64
  unlabeledControlsCount: 0
  issuesFound: 0
  overallCoverage: "Good"
  keyFindings: ["No major accessibility blockers detected..."]
}
```

**Demonstrates**:
- Systematic assessment of digital landscape
- Coverage across multiple assets
- Baseline metrics documented
- Historical comparison possible

**Export**: 
- CSV: `asset-inventory.csv` (includes last scan date, metrics per asset)
- JSON Bundle: Full asset inventory with all scans

---

### 3. Prioritized Issues Based on Public Impact, Risk, and Usage ✅

**Evidence Location**: Prioritization (Impact/Risk/Usage) section

**Prioritization Model**:

Each issue receives a **Priority Score** based on three dimensions:

```typescript
PrioritizationScore {
  publicImpact: number       // 1-5: Impact on citizens/public services
  complianceRisk: number     // 1-5: Severity + legal/compliance risk
  usageFrequency: number     // 1-5: Traffic/usage level
  affectedUsers: number      // Count of affected users
  totalScore: number         // Average of three dimensions
}
```

**Data Structure**:
```
PrioritizedIssue {
  issueType: "Missing alt text"
  severity: "Critical" | "High" | "Medium" | "Low"
  frequency: 47           // # of pages/components affected
  affectedUserGroups: ["Screen reader users", "Low-vision users"]
  score: { publicImpact: 5, complianceRisk: 4, usageFrequency: 3, totalScore: 4.0 }
  rationale: "Affects 47 pages on main public website..."
  recommendedFix: "Add descriptive alt text to all images"
}
```

**Ranking Logic**:
- Issues sorted by `totalScore` descending
- Visible priority rank (#1, #2, #3, etc.)
- Rationale explains why this issue is prioritized

**Demonstrates**:
- Systematic approach to prioritization
- Data-driven decision making
- Clear rationale for ordering
- Links to usage/impact metrics

**Export**:
- CSV: `prioritized-backlog.csv` (issue type, severity, frequency, priority score, recommended fix)
- JSON Bundle: Full prioritized issues list with scores

---

### 4. Documented Remediation Approach with Ownership and Timelines ✅

**Evidence Location**: Remediation Plan (Ownership + Timelines) section

**Remediation Task Model**:
```typescript
RemediationTask {
  id: "task-456"
  issueId: "issue-123"
  issueSummary: "Missing alt text on 47 images"
  recommendedFix: "Add descriptive alt text to all images"
  ownerRole: "Content" | "Development" | "UX/Design" | "Vendor" | "QA"
  assignedTo: "jane.smith@example.gov"       // Optional: specific person
  targetDate: "2026-02-20"                   // Deadline
  status: "Not Started" | "In Progress" | "Complete" | "Blocked" | "Deferred"
  startDate: "2026-01-20"
  completionDate: null
  blockers: "Waiting for vendor response"    // Optional
  notes: "Using bulk image tagger tool"      // Optional
  statusChangedAt: "2026-01-20T10:00:00Z"
}
```

**Default Timelines** (configurable by severity):
```
Critical:  7 days
High:      14 days
Medium:    30 days
Low:       60 days
```

**Features**:
- Each issue mapped to remediation task(s)
- Owner role assigned (clear accountability)
- Specific person can be assigned
- Status tracking: Not Started → In Progress → Complete
- Tracking of start date, completion date, and blockers
- Overdue detection (comparing target date vs current date)

**Progress Metrics Automatically Calculated**:
```
Metrics {
  totalIssues: 12
  openIssues: 7
  inProgressCount: 3
  completedCount: 2
  blockedCount: 1
  deferredCount: 1
  onTimeCount: 1       // Completed before target date
  overdueCount: 1      // Past target date without completion
  percentComplete: 16% // 2 of 12 complete
}
```

**Demonstrates**:
- Clear ownership (assigned role/person)
- Defined timeline for each fix
- Status transparency
- Accountability tracking
- Proof of remediation efforts

**Export**:
- CSV: `remediation-plan.csv` (issue summary, fix, owner role, assigned to, target date, status)
- CSV: `remediation-progress.csv` (status distribution, percentage complete)
- JSON Bundle: Full remediation plan with all task details

---

### 5. Integrated Accessibility into Ongoing Workflows ✅

**Evidence Location**: Workflow Integration (Ongoing Governance) section

**Three Workflow Checklists Included**:

#### Content Authoring Checklist:
- Include descriptive alt text for all images
- Use proper heading hierarchy (H1 → H2 → H3)
- Ensure color is not the only method of conveying information
- Test with keyboard navigation
- Verify form labels are properly associated

#### Development Checklist:
- Run automated accessibility tests (Axe, WAVE)
- Test keyboard navigation and focus management
- Validate HTML semantics and ARIA usage
- Test with screen readers (NVDA, JAWS)
- Verify color contrast ratios (WCAG AA minimum)

#### Procurement Checklist:
- Request VPAT or Accessibility Conformance Report (ACR)
- Specify WCAG 2.2 AA compliance requirement in contracts
- Include accessibility testing in acceptance criteria
- Require accessibility training for vendor staff
- Schedule quarterly compliance reviews

**Demonstrates**:
- Accessibility is built into workflows
- Pre-publication/pre-launch checks
- Vendor oversight and accountability
- Continuous compliance culture
- Evidence these processes exist and are in use

**Export**: 
- Embedded in evidence page
- Included in JSON bundle with last update timestamp

---

### 6. Begun Remediation Efforts Consistent with Priorities ✅

**Evidence Location**: Remediation Progress & Evidence section

**Remediation Progress Tracking**:

**Status Workflow**:
```
Not Started → In Progress → Complete
                ↓
              Blocked → (fix blocker) → In Progress
                ↓
              Deferred → (revisit later)
```

**Metrics Dashboard** (calculated in real-time):
- Open issues: tasks not yet completed
- In-progress count: actively being worked
- Completed count: finished fixes
- Blocked count: waiting for external action
- Deferred count: postponed until later phase
- On-time count: completed before target date
- Overdue count: past target date
- Overall percentage complete

**Trend Analysis** (comparing scans):
- Previous scan date
- Previous issue count
- Delta (improvement or regression)
- Enables "before/after" evidence

**Demonstrates**:
- Active remediation underway
- Clear progress tracking
- Evidence of prioritization being followed
- Regular status updates
- Measurable improvement

**Export**:
- CSV: `remediation-progress.csv` (status breakdown with percentages)
- JSON Bundle: Full metrics with trend analysis

---

## Usage Flow

### Step 1: Establish Standards
1. Go to Evidence page → Standards & Policy Adoption
2. Enter organization name
3. Select applicable standards (WCAG 2.2 A/AA, Section 508, VITA)
4. Enter policy statement
5. Save

### Step 2: Inventory Digital Assets
1. Go to Evidence page → Digital Asset Inventory
2. Click "+ Add New Asset"
3. Enter asset details (name, URL, type, environment, owner)
4. Check if public-facing and/or critical service
5. Save

### Step 3: Run Scans and Record Results
1. Use the main Accessibility Analyzer to scan assets
2. For each asset, record the scan in inventory:
   - Go to Evidence page → Digital Asset Inventory
   - Note the scan results (pages sampled, issues found)
   - Or use API: `POST /api/evidence/scans/[assetId]`

### Step 4: Prioritize Issues
1. Based on scan results and impact analysis, create issue entries
2. Go to Evidence page → Prioritization section
3. For each unique issue type:
   - Describe the issue
   - Rate public impact, compliance risk, usage frequency
   - List affected user groups
   - Provide recommended fix
   - Save (automatically sorted by priority score)

### Step 5: Create Remediation Plan
1. Go to Evidence page → Remediation Plan
2. For each prioritized issue:
   - Create a remediation task
   - Assign owner role (Content/Dev/UX/Vendor/QA)
   - Optionally assign specific person
   - Set target date based on severity
   - Save

### Step 6: Define Workflows
1. Go to Evidence page → Workflow Integration
2. Review the embedded checklists
3. Customize for your organization if needed
4. Document how these are being used in your teams

### Step 7: Track Progress
1. Ongoing: Update remediation task statuses
2. Go to Evidence page → Remediation Plan
3. Click status dropdown to mark as "In Progress," "Complete," etc.
4. Add notes or blockers as needed
5. System automatically calculates progress metrics

### Step 8: Export and Report
1. Export individual reports:
   - Remediation Plan (CSV)
   - Prioritized Backlog (CSV)
   - Asset Inventory (CSV)
   - Progress Metrics (CSV)

2. Generate complete evidence bundle:
   - Click "Generate Full Bundle (JSON)"
   - Contains all program data
   - Ready for governance/audit review

---

## Data Export Examples

### Remediation Plan CSV
```csv
Issue Summary,Recommended Fix,Owner Role,Assigned To,Target Date,Status,Blockers,Notes
"Missing alt text on 47 images","Add descriptive alt text",Content,"jane.smith@example.gov",2026-02-20,In Progress,"","Using bulk tagger"
"Form controls lack labels","Associate labels with form fields",Development,"mark.jones@example.gov",2026-02-15,Not Started,"","High priority for compliance"
```

### Prioritized Backlog CSV
```csv
Issue Type,Severity,Frequency,Priority Score,Affected User Groups,Recommended Fix,Rationale
"Missing alt text",High,47,4.33,"Screen reader users; Low-vision users","Add descriptive alt text","Affects 47 pages on main public website with high traffic"
"Unlabeled form controls",Critical,12,4.67,"Screen reader users; Keyboard-only users","Associate labels with all form inputs","Critical compliance gap on public benefit application"
```

### Asset Inventory CSV
```csv
Asset Name,URL,Type,Environment,Owner,Public Facing,Critical Service,Last Scan Date,Pages Sampled,Issues Found
"Main Website",https://example.gov,Website,Production,"John Doe",Yes,Yes,2026-01-20,47,0
"Benefits Portal",https://benefits.example.gov,Web Application,Production,"Jane Smith",Yes,Yes,2026-01-19,32,5
```

### Remediation Progress CSV
```csv
Status,Count,Percentage
"Not Started",7,58.3%
"In Progress",3,25.0%
"Complete",2,16.7%
"Blocked",0,0%

Overall Progress,16.7%
```

---

## Complete Evidence Bundle (JSON)

The `/api/evidence/bundle` endpoint returns a comprehensive snapshot:

```json
{
  "organizationId": "org-123",
  "organizationName": "State Council of Higher Education",
  "generatedAt": "2026-01-20T15:30:00Z",
  "evidenceType": "Full Program",
  "standardsAdoption": {
    "id": "std-123",
    "organizationName": "State Council of Higher Education",
    "adoptedStandards": ["WCAG 2.2 A/AA", "Section 508", "VITA"],
    "adoptionDate": "2026-01-15",
    "policyStatement": "We are committed to ensuring...",
    "lastUpdated": "2026-01-20T10:00:00Z"
  },
  "assetInventory": {
    "id": "inv-123",
    "assets": [...],
    "scans": [...]
  },
  "prioritizationBacklog": {
    "issues": [...]
  },
  "remediationPlan": {
    "tasks": [...],
    "defaultTimelinesByGrade": { "Critical": 7, "High": 14, "Medium": 30, "Low": 60 }
  },
  "accessibilityWorkflow": {
    "contentChecklist": [...],
    "developmentChecklist": [...],
    "procurementChecklist": [...]
  },
  "remediationMetrics": {
    "totalIssues": 12,
    "openIssues": 7,
    "inProgressCount": 3,
    "completedCount": 2,
    "percentComplete": 16.7,
    ...
  }
}
```

---

## Compliance Demonstration Strategy

### For Audits/Compliance Reviews:

1. **Standards Adoption**: Show certificate/policy from Evidence page
2. **Assessment Coverage**: Export asset inventory CSV showing which systems have been scanned
3. **Issue Identification**: Export prioritized backlog CSV showing issues found and ranked
4. **Remediation Plan**: Export remediation plan CSV showing ownership and timelines
5. **Progress**: Export progress metrics showing work completed and in-progress
6. **Workflow Integration**: Screenshot workflow checklists from Evidence page
7. **Complete Evidence**: Generate full JSON bundle for audit trail

### Timeline for Demonstration:
- **Month 1**: Adopt standards, inventory assets, run initial scans
- **Month 2**: Prioritize issues, create remediation plan
- **Month 3**: Begin remediation (update statuses)
- **Ongoing**: Monthly progress updates, quarterly evidence bundle generation

---

## API Integration with Main Analyzer

The evidence layer is **completely independent** of the main analyzer. However, you can integrate them:

**Recommended Pattern:**
1. User runs a scan via main analyzer
2. Scan completes and shows results
3. Manually record scan results in Evidence → Asset Inventory
4. Or, use API endpoint to auto-record:
   ```bash
   curl -X POST http://localhost:3000/api/evidence/scans/asset-123 \
     -H "Content-Type: application/json" \
     -d '{
       "pagesSampled": 47,
       "totalImages": 792,
       "missingAltCount": 0,
       "totalControls": 64,
       "unlabeledControlsCount": 0,
       "issuesFound": 0,
       "overallCoverage": "Good",
       "keyFindings": ["No major issues detected..."]
     }'
   ```

---

## Implementation Notes

- **Local Storage**: Uses `data/program.json` - ensure directory is writable
- **No Database**: Lightweight file-based approach suitable for government/non-profit use
- **TypeScript**: Fully typed for IDE autocomplete and error catching
- **Extensible**: Can add additional checklists, workflows, or scoring models
- **Export-Ready**: All data exportable for spreadsheets, Jira, Smartsheet, etc.

---

## Next Steps / Future Enhancements

1. **Dashboard**: Visual charts showing progress over time
2. **Notifications**: Alerts when tasks are overdue
3. **Multi-Organization**: Support for managing multiple agencies
4. **Database**: Migrate to SQLite/PostgreSQL for larger deployments
5. **VPAT Integration**: Auto-link to vendor accessibility statements
6. **Reporting API**: Generate formal compliance reports on-demand
7. **Audit Trail**: Track all changes for compliance history
8. **Role-Based Access**: Separate permissions for Content, Dev, Leadership

---

## Questions?

Refer to:
- `lib/types/evidence.ts` for all data structures
- `lib/storage/evidenceStore.ts` for storage/retrieval
- `app/api/evidence/` for API endpoint implementations
- `components/evidence/` for UI components
- `app/evidence/page.tsx` for the main interface
