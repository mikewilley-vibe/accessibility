# Quick Start Guide: Compliance Program Evidence

## Access the System
- **URL**: http://localhost:3000/evidence
- **Main Analyzer**: http://localhost:3000

## What to Do First (10 minutes)

### 1. Set Organization Standards
```
Evidence Page → A) Standards & Policy Adoption
- Enter organization name
- Select: WCAG 2.2 A/AA ✓
- Select: Section 508 ✓
- Enter policy statement
- Save
```

### 2. Register Your Digital Assets
```
Evidence Page → B) Digital Asset Inventory
- Click "+ Add New Asset"
- Name: "Main Website"
- URL: "https://www.schev.edu"
- Type: Website
- Environment: Production
- Owner: [Your Name]
- Public Facing: ✓
- Critical Service: ✓
- Save
```

### 3. Scan an Asset
```
Main Page → Enter URL → Analyze
↓
Wait for results
↓
Note: Issues found, pages scanned, etc.
```

### 4. Record Scan in Evidence
```
Evidence Page → B) Digital Asset Inventory
- Copy metrics from scan results
- Evidence → API: POST /api/evidence/scans/[assetId]
- Or manually note the numbers
```

### 5. Add Issues to Backlog
```
Evidence Page → C) Prioritization
- Click "Add Issue"
- Issue: "Missing alt text on X images"
- Severity: High
- Public Impact: 4/5
- Compliance Risk: 4/5
- Usage: 3/5
- Affected Users: Screen reader users, Low-vision users
- Recommended Fix: Add descriptive alt text
- Save
```

### 6. Create Remediation Tasks
```
Evidence Page → D) Remediation Plan
- Click "Add Task"
- Issue: "Missing alt text on X images"
- Fix: "Add descriptive alt text"
- Owner: Content
- Assigned: jane.smith@agency.gov
- Target Date: 2026-02-20
- Status: Not Started
- Save
```

### 7. Track Progress
```
Evidence Page → D) Remediation Plan
- Change status from "Not Started" → "In Progress"
- Mark complete when done
- Dashboard shows: 3 Open, 2 In Progress, 1 Complete
```

### 8. Export Results
```
Evidence Page → Top Buttons
- "Export Remediation Plan (CSV)" → remediation-plan.csv
- "Export Inventory (CSV)" → asset-inventory.csv
- "Generate Full Bundle (JSON)" → compliance-evidence-bundle.json
```

---

## Quick Command Reference

### Get Current Standards
```bash
curl http://localhost:3000/api/evidence/standards
```

### List All Assets
```bash
curl http://localhost:3000/api/evidence/assets
```

### List All Issues
```bash
curl http://localhost:3000/api/evidence/issues
```

### List All Remediation Tasks
```bash
curl http://localhost:3000/api/evidence/remediation
```

### Get Full Evidence Bundle
```bash
curl http://localhost:3000/api/evidence/bundle | jq .
```

### Download Exports
```bash
# Remediation Plan
curl http://localhost:3000/api/evidence/export?type=remediation > plan.csv

# Backlog
curl http://localhost:3000/api/evidence/export?type=backlog > backlog.csv

# Inventory
curl http://localhost:3000/api/evidence/export?type=inventory > inventory.csv

# Progress
curl http://localhost:3000/api/evidence/export?type=progress > progress.csv
```

---

## The Six Capabilities You're Demonstrating

### 1. **Standards Adoption** ✅
- Location: Standards & Policy Adoption section
- Shows: Organization has adopted WCAG 2.2 A/AA, Section 508, and/or VITA
- Evidence: Policy statement with adoption date

### 2. **Asset Assessment** ✅
- Location: Digital Asset Inventory section
- Shows: Which digital services have been assessed
- Evidence: Scan dates, pages sampled, issues found per asset

### 3. **Issue Prioritization** ✅
- Location: Prioritization section
- Shows: Issues ranked by impact/risk/usage scores
- Evidence: Numerical scoring, rationale, affected users

### 4. **Remediation Planning** ✅
- Location: Remediation Plan section
- Shows: Who owns what fix, when it's due, what status
- Evidence: Task assignments, target dates, status history

### 5. **Workflow Integration** ✅
- Location: Workflow Integration section
- Shows: Content/Dev/Procurement checklists
- Evidence: Accessibility built into processes

### 6. **Progress Tracking** ✅
- Location: Remediation Progress section
- Shows: How many issues are open/in-progress/complete
- Evidence: Percentage complete, trend vs previous scan

---

## Data Storage

All data is stored in: `/Users/mikewilley/accessibility/data/program.json`

This is a simple JSON file that auto-updates. You can:
- ✅ View/edit directly
- ✅ Version control with git
- ✅ Back up to cloud storage
- ✅ Share with auditors

---

## Integration Tips

### Auto-Record Scans
After running a scan via main analyzer, automatically record it:

```bash
ASSET_ID="4bf8e739-d875-4a6e-8915-e0094f0a5d1c"
curl -X POST http://localhost:3000/api/evidence/scans/$ASSET_ID \
  -H "Content-Type: application/json" \
  -d '{
    "pagesSampled": 47,
    "totalImages": 792,
    "missingAltCount": 0,
    "totalControls": 64,
    "unlabeledControlsCount": 0,
    "totalLinks": 1125,
    "internalLinks": 742,
    "externalLinks": 383,
    "issuesFound": 0,
    "criticalIssues": 0,
    "scanDurationMs": 12047,
    "overallCoverage": "Good",
    "keyFindings": ["No major issues detected"]
  }'
```

### Bulk Export for Compliance Review
```bash
# Export everything
curl http://localhost:3000/api/evidence/bundle > evidence-$(date +%Y%m%d).json

# Keep dated backups
cp evidence-*.json ~/backups/
```

---

## Common Scenarios

### "I found 10 issues during a scan. How do I track them?"

1. **Record the scan**: Document pages scanned, metrics
2. **Create issues**: For each unique issue type, add to C) Prioritization
3. **Create tasks**: For each issue, add to D) Remediation Plan
4. **Assign owners**: Designate Content, Dev, or Vendor
5. **Set dates**: Based on severity
6. **Track**: Update status as work happens

### "I want to show auditors our compliance effort"

1. Go to Evidence page
2. Click "Generate Full Bundle (JSON)"
3. Send the JSON file to auditors
4. It contains: standards, assets, issues, remediation plan, progress

### "I need to prioritize what to fix first"

1. Go to C) Prioritization section
2. Issues are already sorted by score
3. Higher numbers = fix first
4. Each issue shows: severity, frequency, affected users, rationale

### "I'm done with a task. How do I mark it complete?"

1. Go to D) Remediation Plan
2. Find the task in the list
3. Click the Status dropdown
4. Select "Complete"
5. Dashboard automatically updates percentage

---

## Help & Documentation

- **Full Details**: `EVIDENCE_SYSTEM.md` (800+ lines)
- **Implementation**: `IMPLEMENTATION_SUMMARY.md`
- **Source Code**: 
  - Types: `lib/types/evidence.ts`
  - Storage: `lib/storage/evidenceStore.ts`
  - APIs: `app/api/evidence/*`
  - UI: `components/evidence/*`

---

## Key Stats

- **20 files** created/modified
- **2,500+ lines** of code
- **8 API endpoints** for all operations
- **4 UI components** for each capability
- **Local storage** (no database needed)
- **Fully typed** TypeScript
- **Zero external services** required
- **Multiple export formats**: CSV + JSON

---

## Your Next Steps

1. ✅ Visit http://localhost:3000/evidence
2. ✅ Enter your organization details
3. ✅ Register your digital assets
4. ✅ Run scans and record results
5. ✅ Prioritize issues
6. ✅ Create remediation plan
7. ✅ Update statuses as work progresses
8. ✅ Export CSV/JSON for audits or Jira

You're now ready to demonstrate accessibility compliance maturity!
