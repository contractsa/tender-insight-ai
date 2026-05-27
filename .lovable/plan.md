# SA Procurement Intelligence Upgrade — Phased Plan

This is a large scope. To ship reliably (not break the working MVP), I'll deliver in 3 phases. Each phase is independently testable. Approve the whole plan or tell me to start with Phase 1 only.

---

## Phase 1 — Extraction Engine Overhaul (backend, highest impact)

**Goal:** Make the AI actually behave like a SA procurement specialist, not a generic summarizer. Handle long/scanned docs.

1. **Expand the structured extraction schema** in `src/lib/analyze.functions.ts` to cover all required fields:
   - Tender core (title, number, entity, dept, province, category, duration, value, procurement type, framework, JV reqs, mandatory subcontracting)
   - CIDB grade + class, professional registrations
   - Dates (closing date/time, validity, clarification deadline, briefing date/time/location, mandatory briefing flag, commencement)
   - Contacts (SCM + technical, name/email/phone/cell/fax/address)
   - Submission (physical vs eTender, portal, courier, tender box, copies, USB/CD, envelope wording, step-by-step)
   - Compliance returnables (Tax PIN, SARS, CIPC, CIDB, B-BBEE, MBD/SBD forms, COIDA, letter of good standing, bank letter, AFS, JV agreement, ISO, insurance, safety file, etc.) — each item flagged mandatory/optional
   - Evaluation (functionality criteria + weights, thresholds, PPPFA 80/20 or 90/10, local content, B-BBEE points, pass/fail)
   - Risks (missing docs, contradictions, disqualification risks) with severity
   - Tables/graphs/schedules detected — `{ page, type, title, summary }`
   - Contract clauses (SLA, penalties, retention, warranties, payment terms, escalation, liability, insurance, subcontracting, cancellation, dispute)
   - Per-page confidence + list of pages flagged for manual review
   - Overall confidence score + readiness score (0-100)

2. **Upgrade the system prompt** to embed deep SA procurement domain knowledge: PPPFA, PFMA, MFMA, NEC3/GCC2015/JBCC, CIDB grading (1-9, CE/GB/SW etc.), B-BBEE levels 1-8, SARS/CIPC/COIDA, eTender Portal, common SOE templates (Eskom, Transnet, PRASA, municipalities), MBD/SBD form numbers and what each means.

3. **Handle long/scanned PDFs**:
   - Raise file size cap (current 20MB) — keep at 20MB but document limit clearly
   - Switch model selection: `google/gemini-2.5-pro` already handles vision + scans well; keep it but add fallback retry once on transient 5xx
   - For large docs, pass document directly (Gemini handles up to ~1000 pages of PDF). Currently we base64 the whole file — keep, but add explicit OCR instruction in prompt for scanned pages
   - Add `pages_flagged_for_review: [{ page, reason }]` to schema so unreadable sections surface instead of being dropped

4. **DB migration**: Add columns to `tender_analyses` for the new structured groups (submission_details, returnables, evaluation_criteria, detected_tables, contract_intelligence, pages_flagged, readiness_score, tender_title, province, etc.) as JSONB where appropriate.

**Risk controlled:** Existing pipeline (credit reservation, refund, idempotency, status guards) stays untouched.

---

## Phase 2 — Enterprise Document Detail UI

**Goal:** Rebuild `src/routes/_authenticated/documents.$id.tsx` as a real intelligence dashboard.

Sections (collapsible, mobile-responsive):
1. Executive Summary panel + confidence badge + readiness score
2. Quick Facts sidebar (tender #, entity, closing date countdown, CIDB, B-BBEE, value)
3. Key Deadlines timeline (with countdown to closing)
4. Compliance & Returnables checklist (mandatory vs optional, with disqualification warnings)
5. Submission Instructions step-by-step
6. Evaluation & Scoring breakdown
7. Risk & Disqualification warnings (color-coded by severity)
8. Contact Directory (click-to-call/email)
9. Detected Tables / Graphs / Schedules with page references
10. Contract Intelligence (clauses grouped)
11. Pages Flagged for Manual Review
12. Raw extracted JSON (collapsed, for power users)

Keep existing polling + retry. Add print/export-to-PDF button (basic).

---

## Phase 3 — Upload UX + Polish

1. Upload page: explain supported tender types, govt entities, what gets extracted, file size limits, OCR support, confidence scoring.
2. Documents list: show closing-date countdown + readiness score badge.
3. Credits widget always visible in nav.
4. Mobile pass on detail page.

---

## What I will NOT do in this plan (out of scope, ask separately)
- Stripe billing (you said after analysis quality)
- Multi-doc cross-referencing (bid pack + addenda merge)
- Search within document
- Document versioning / amendments tracking
- Team collaboration / sharing
- API access for procurement teams

---

## Recommended sequence
Start with **Phase 1** only. Verify extraction quality on a real tender doc you upload. Then I do Phase 2. Then Phase 3. Each phase is ~1 focused message.

**Reply with:**
- "Start Phase 1" — I begin the schema + prompt + migration immediately
- "Do all 3" — I execute sequentially in one go (longer, higher risk)
- Edits to the plan
