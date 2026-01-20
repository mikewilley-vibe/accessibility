# Compliance Program Evidence System

**A lightweight, governance-ready layer for demonstrating accessibility compliance maturity.**

This system transforms your accessibility assessment tool into a comprehensive evidence platform that helps organizations systematically track and demonstrate compliance with accessibility standards.

## 🎯 What It Does

Enables you to document and prove that your organization has:

1. ✅ **Identified & Adopted** accessibility standards (WCAG 2.2 A/AA, Section 508, VITA)
2. ✅ **Assessed** your digital assets for accessibility gaps
3. ✅ **Prioritized** issues based on public impact, compliance risk, and usage
4. ✅ **Documented** remediation plans with ownership and timelines
5. ✅ **Integrated** accessibility into ongoing workflows (content, dev, procurement)
6. ✅ **Tracked** remediation progress with evidence exports

## 🚀 Quick Start

```bash
# Visit the Evidence page
http://localhost:3000/evidence

# Or use the API
curl http://localhost:3000/api/evidence/standards

# Export evidence for audits/compliance reviews
curl http://localhost:3000/api/evidence/bundle > compliance-evidence.json
```

**See [QUICK_START.md](./QUICK_START.md) for step-by-step guide.**

## 📊 Key Features

- **No External Database**: Local JSON file storage (`data/program.json`)
- **No External Services**: Fully self-contained
- **Fully Typed**: Complete TypeScript definitions
- **Multiple Exports**: CSV (spreadsheets, Jira, Smartsheet) + JSON (audits, integrations)
- **Real-time Metrics**: Automatic progress calculation
- **Lightweight**: ~2,500 lines of code
- **Incremental**: Use what you need, when you need it

## 📁 System Structure

```
Evidence Layer
├── Data Model (lib/types/evidence.ts)
│   ├── StandardsAdoption
│   ├── DigitalAsset + ScanResults
│   ├── PrioritizedIssue
│   ├── RemediationTask
│   └── AccessibilityWorkflow
│
├── Storage (lib/storage/evidenceStore.ts)
│   ├── Local JSON persistence
│   └── CRUD operations
│
├── API Endpoints (app/api/evidence/*)
│   ├── /standards (create/retrieve standards adoption)
│   ├── /assets (manage digital asset inventory)
│   ├── /scans/[assetId] (record scan results)
│   ├── /issues (prioritize issues)
│   ├── /remediation (track remediation tasks)
│   ├── /workflow (define accessibility workflows)
│   ├── /export (CSV exports)
│   └── /bundle (complete evidence package)
│
├── UI Components (components/evidence/*)
│   ├── StandardsAdoptionForm
│   ├── AssetInventoryForm
│   ├── PrioritizationBacklogView
│   └── RemediationPlanView
│
└── Main Interface (app/evidence/page.tsx)
    └── Accordion-based navigation
```

## 🔄 The Six Capabilities

### 1. Standards & Policy Adoption
**Evidence**: Organization name, adopted standards (WCAG 2.2, Section 508, VITA), policy statement, adoption date

**Location**: `/evidence` → A) Standards & Policy Adoption

**Export**: Included in all reports

### 2. Digital Asset Inventory & Assessment
**Evidence**: Asset list (name, URL, type, environment, owner, public/critical flags), scan history with metrics

**Location**: `/evidence` → B) Digital Asset Inventory

**Export**: `asset-inventory.csv` (includes last scan date, pages sampled, issues found)

### 3. Prioritization (Impact/Risk/Usage)
**Evidence**: Issues scored by public impact (1-5), compliance risk (1-5), usage frequency (1-5), with clear ranking

**Location**: `/evidence` → C) Prioritization

**Export**: `prioritized-backlog.csv` (issue type, severity, frequency, priority score)

### 4. Remediation Plan (Ownership + Timelines)
**Evidence**: Task list with owner role, assigned person, target date, status, start/completion dates

**Location**: `/evidence` → D) Remediation Plan

**Export**: `remediation-plan.csv` (issue → fix → owner → date → status)

### 5. Workflow Integration (Ongoing Governance)
**Evidence**: Content authoring, development, and procurement checklists

**Location**: `/evidence` → E) Workflow Integration

**Export**: Embedded in main interface + JSON bundle

### 6. Remediation Progress & Evidence
**Evidence**: Open/in-progress/complete counts, percentage complete, trend vs previous scan

**Location**: `/evidence` → F) Remediation Progress

**Export**: `remediation-progress.csv` (status breakdown with percentages)

## 📝 Example Usage

### Record Standards Adoption
```bash
curl -X POST http://localhost:3000/api/evidence/standards \
  -H "Content-Type: application/json" \
  -d '{
    "organizationName": "State Council of Higher Education",
    "adoptedStandards": ["WCAG 2.2 A/AA", "Section 508", "VITA"],
    "policyStatement": "We are committed to ensuring all digital services are accessible to citizens with disabilities..."
  }'
```

### Register Digital Asset
```bash
curl -X POST http://localhost:3000/api/evidence/assets \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Main Website",
    "url": "https://www.schev.edu",
    "type": "Website",
    "environment": "Production",
    "owner": "John Doe",
    "publicFacing": true,
    "criticalService": true
  }'
```

### Record Scan Results
```bash
curl -X POST http://localhost:3000/api/evidence/scans/[ASSET_ID] \
  -H "Content-Type: application/json" \
  -d '{
    "pagesSampled": 47,
    "totalImages": 792,
    "missingAltCount": 0,
    "totalControls": 64,
    "unlabeledControlsCount": 0,
    "issuesFound": 0,
    "overallCoverage": "Good",
    "keyFindings": ["No major accessibility blockers detected"]
  }'
```

### Create Prioritized Issue
```bash
curl -X POST http://localhost:3000/api/evidence/issues \
  -H "Content-Type: application/json" \
  -d '{
    "issueType": "Missing alt text",
    "affectedAssets": ["asset-123"],
    "severity": "High",
    "frequency": 47,
    "affectedUserGroups": ["Screen reader users", "Low-vision users"],
    "publicImpact": 4,
    "complianceRisk": 4,
    "usageFrequency": 3,
    "affectedUsers": 2500,
    "rationale": "Affects 47 pages on main public website with high traffic",
    "recommendedFix": "Add descriptive alt text to all images"
  }'
```

### Create Remediation Task
```bash
curl -X POST http://localhost:3000/api/evidence/remediation \
  -H "Content-Type: application/json" \
  -d '{
    "issueId": "issue-123",
    "issueSummary": "Missing alt text on 47 images",
    "recommendedFix": "Add descriptive alt text",
    "ownerRole": "Content",
    "assignedTo": "jane.smith@agency.gov",
    "targetDate": "2026-02-20"
  }'
```

### Get Full Evidence Bundle
```bash
curl http://localhost:3000/api/evidence/bundle > compliance-evidence.json
```

### Export Metrics
```bash
# Remediation Plan
curl http://localhost:3000/api/evidence/export?type=remediation > remediation-plan.csv

# Prioritized Backlog
curl http://localhost:3000/api/evidence/export?type=backlog > prioritized-backlog.csv

# Asset Inventory
curl http://localhost:3000/api/evidence/export?type=inventory > asset-inventory.csv

# Progress
curl http://localhost:3000/api/evidence/export?type=progress > remediation-progress.csv
```

## 📚 Documentation

- **[QUICK_START.md](./QUICK_START.md)** - Step-by-step getting started guide (10 min)
- **[EVIDENCE_SYSTEM.md](./EVIDENCE_SYSTEM.md)** - Comprehensive system documentation (800+ lines)
- **[IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md)** - Technical implementation details

## 🏗️ Architecture

### Data Flow
```
Evidence UI ←→ API Endpoints ←→ Storage Layer ←→ JSON File
                                                    (data/program.json)
```

### Prioritization Formula
```
Priority Score = (Public Impact + Compliance Risk + Usage Frequency) / 3

Range: 1.0 - 5.0 (higher = more urgent)
```

### Remediation Status Workflow
```
Not Started → In Progress → Complete
                ↓
              Blocked → (fix blocker) → In Progress
                ↓
              Deferred → (revisit later)
```

## 💾 Storage

All data stored in: `/data/program.json`

Features:
- ✅ Human-readable JSON
- ✅ Version control friendly (git)
- ✅ Easily backed up to cloud
- ✅ Simple to share with auditors

## 🔌 Integration

### With Main Analyzer
After running a scan on the main page, record results via:

```bash
# Automatically record scan in evidence system
./scripts/record-scan.sh [ASSET_ID] [SCAN_METRICS]
```

### With Jira/Smartsheet
Export remediation plan CSV:
```bash
curl http://localhost:3000/api/evidence/export?type=remediation > tasks.csv
```

Then import into Jira or Smartsheet for project management.

## 🚦 Status Dashboard

The Evidence system automatically calculates:

- Total issues identified
- Open issues (not started)
- In-progress count
- Completed count
- Blocked count
- Deferred count
- Percentage complete
- On-time vs overdue tasks
- Trend vs previous scan

All visible on the Remediation Plan page.

## 📤 Export Formats

### CSV Exports
- **remediation-plan.csv**: All tasks with status, owner, date
- **prioritized-backlog.csv**: Issues ranked by priority score
- **asset-inventory.csv**: All assets with last scan info
- **remediation-progress.csv**: Status breakdown with percentages

### JSON Export
- **compliance-evidence-bundle.json**: Complete snapshot of all program data
  - Standards adopted
  - All assets and scans
  - All prioritized issues
  - Complete remediation plan
  - Workflow documentation
  - Progress metrics with trends

## 🔐 Security Considerations

Current implementation (development):
- ⚠️ No authentication/authorization
- ⚠️ File system permissions only

For production, add:
- ✅ Authentication (OAuth2, SAML)
- ✅ Role-based access control (Leadership/Staff/Auditor)
- ✅ Audit trail (who changed what, when)
- ✅ Database encryption
- ✅ API rate limiting

## 🛠️ Troubleshooting

**"API returns 500 error"**
- Check that `/data` directory exists
- Verify file permissions on `data/program.json`
- Check server logs for details

**"Changes not persisting"**
- Verify `data/program.json` is writable
- Check available disk space
- Look for disk permission errors

**"UI shows 'Loading...' forever"**
- Check browser console for errors
- Verify API endpoints are responding
- Restart dev server: `npm run dev`

## 🚀 Deployment

### Development
```bash
npm run dev
# Visit http://localhost:3000/evidence
```

### Production Build
```bash
npm run build
npm start
```

### Docker (optional)
```dockerfile
FROM node:18
WORKDIR /app
COPY . .
RUN npm install
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

## 📈 Future Enhancements

Potential additions:

- 📊 Dashboard with progress charts
- 🔔 Notifications for overdue tasks
- 👥 Multi-organization support
- 🗄️ Database migration (SQLite/PostgreSQL)
- 📋 VPAT auto-linking
- 📝 Audit trail tracking
- 🔐 Role-based access control
- 📄 Auto-generated compliance reports
- 🪝 Webhook notifications
- 📱 Mobile-native app

## 📞 Support

For questions:
1. Check **QUICK_START.md** for common scenarios
2. Review **EVIDENCE_SYSTEM.md** for detailed documentation
3. Examine source code in `lib/types/`, `lib/storage/`, `app/api/evidence/`
4. Check `components/evidence/` for UI component examples

## 📄 License

Same as main project.

---

**Start demonstrating your accessibility compliance maturity today!**

→ **[Get Started Now](./QUICK_START.md)**
