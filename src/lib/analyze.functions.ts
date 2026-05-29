import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const CREDITS_PER_ANALYSIS = 3;
const EXTRACTION_VERSION = "3.0";

// ============================================================
// PART 1 — SAFE JSON PARSER (applied to every Gemini response)
// ============================================================
function safeParseJSON(raw: string): any {
  const cleaned = raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {}
    }
    throw new Error(`JSON parse failed. Raw preview: ${raw.slice(0, 300)}`);
  }
}

// ============================================================
// SHARED RULES BLOCK — prepended to every pass prompt
// ============================================================
const RULES_BLOCK = `CRITICAL RULES:
1. Return ONLY valid JSON. No markdown. No explanation. No preamble.
2. Never summarize procurement information. Preserve exact wording for all deadlines, amounts, requirements and legal conditions.
3. For every extracted field include the exact page number where it was found.
4. If you cannot find information return null with a reason. Never guess or infer.
5. South African context: PPPFA means Preferential Procurement Policy Framework Act. 90/10 split means price 90 points plus B-BBEE 10 points for contracts above R50 million. 80/20 split means price 80 points plus B-BBEE 20 points for contracts between R30,000 and R50 million. CIDB grading ranges from 1 to 9 with designations GB, CE, SB, ME, EE, EP, SI and others. All SBD forms numbered 1 through 9 and all MBD forms are mandatory unless explicitly stated optional.
6. SBD forms are national government forms. MBD forms are used in some municipalities. Both are legally required returnables.`;

// ============================================================
// PASS PROMPTS (verbatim from spec)
// ============================================================
const PROMPT_TRIAGE = `${RULES_BLOCK}

You are a South African procurement document classifier. Analyse this tender document and return ONLY this JSON structure:

{
  "document_type": "one of: RFQ, RFP, RFI, EOI, Open Tender, Restricted Tender, Framework Agreement, Panel Appointment, Term Contract, Emergency Procurement, Prequalification, Negotiated Tender, Multi-Stage Tender",
  "procurement_authority_type": "one of: National Department, Provincial Department, Municipality, SOE, Public Entity, TVET, University, Other",
  "issuing_entity": "exact name of department or entity",
  "industry_domain": "primary industry domain",
  "total_pages": 0,
  "estimated_complexity": "one of: low, medium, high, very_high",
  "page_map": [
    {
      "page": 1,
      "section_type": "one of: cover_page, tender_notice, scope_of_work, technical_specs, evaluation_criteria, pricing_schedule, BOQ, SBD_form, MBD_form, returnable_schedule, declaration_form, contract_conditions, general_conditions, particular_conditions, CIDB_requirements, BBBEE_requirements, insurance_schedule, submission_instructions, addendum, annexure, graph, diagram, attendance_register, signature_page, blank, unknown",
      "requires_action": true,
      "contains_table": true,
      "contains_graph": false,
      "contains_form": true,
      "confidence": 0.95,
      "notes": "brief description of what this page contains"
    }
  ],
  "critical_sections": {
    "closing_date_page": 0,
    "submission_instructions_pages": [],
    "evaluation_criteria_pages": [],
    "mandatory_returnables_pages": [],
    "pricing_schedule_pages": [],
    "BOQ_pages": [],
    "CIDB_pages": [],
    "BBBEE_pages": [],
    "SBD_form_pages": [],
    "contract_conditions_pages": [],
    "scope_of_work_pages": []
  }
}

The PDF document is attached. You must cover EVERY page in page_map — one entry per page. Do not skip pages.`;

const PROMPT_SUBMISSION = `${RULES_BLOCK}

You are a South African procurement compliance analyst. Extract all submission and compliance information. Return ONLY this JSON structure:

{
  "submission": {
    "closing_date": "exact date as written in document",
    "closing_time": "exact time with timezone",
    "submission_method": "one of: physical, electronic, both",
    "physical_address": "full address including building name, floor, room, box number",
    "portal_url": "URL if electronic submission required",
    "packaging_instructions": "exact instructions from document",
    "labelling_instructions": "exact instructions from document",
    "number_of_copies": "exact number of hard copies required",
    "page_reference": 0,
    "briefing_session": {
      "mandatory": true,
      "date": "exact date",
      "time": "exact time",
      "venue": "full venue address",
      "attendance_register_required": true,
      "non_attendance_consequence": "exact consequence stated in document",
      "page_reference": 0
    }
  },
  "mandatory_compliance_documents": [
    {
      "document_name": "exact name as written",
      "mandatory": true,
      "disqualifies_if_missing": true,
      "page_reference": 0,
      "notes": "any specific requirements such as validity period or format"
    }
  ],
  "regulatory_requirements": {
    "CIDB": { "required": true, "minimum_grade": "exact grade such as 7EP", "designation": "exact designation", "must_be_registered_at_closing": true, "page_reference": 0 },
    "BBBEE": { "required": true, "minimum_level": "exact level required", "acceptable_certificate_types": "exact types accepted including affidavit rules", "page_reference": 0 },
    "tax_compliance": { "SARS_TCS_PIN_required": true, "must_be_valid_at_closing": true, "page_reference": 0 },
    "CIPC_registration": { "required": true, "certified_copy_required": true, "page_reference": 0 },
    "COIDA": { "required": false, "page_reference": null },
    "municipal_accounts": { "required": false, "page_reference": null },
    "PFMA_applicable": true,
    "MFMA_applicable": false,
    "PPPFA_split": "90/10 or 80/20",
    "page_reference": 0
  }
}`;

const PROMPT_RETURNABLES = `${RULES_BLOCK}

You are a South African tender returnable documents specialist. Identify every single form, schedule, declaration and document that a bidder must complete and submit. Miss nothing. Return ONLY this JSON structure:

{
  "returnables": [
    {
      "id": "unique identifier such as SBD_1 or RETURNABLE_A",
      "name": "exact name as written in document",
      "page_number": 0,
      "form_type": "one of: SBD, MBD, custom, declaration, pricing, technical, compliance, authority_resolution, joint_venture, other",
      "mandatory": true,
      "disqualifies_if_missing": true,
      "requires_signature": true,
      "requires_company_stamp": false,
      "requires_commissioner_of_oaths": false,
      "requires_witness": false,
      "requires_letterhead": false,
      "fields_to_complete": ["list every field or section the bidder must fill in"],
      "purpose": "plain English explanation of what this form is for",
      "notes": "any special instructions or conditions"
    }
  ],
  "total_returnables_count": 0,
  "disqualifying_returnables_count": 0,
  "returnables_checklist_page": 0,
  "returnables_index_present": true,
  "risk_summary": "plain English summary of submission risk based on number and complexity of returnables"
}`;

const PROMPT_EVALUATION = `${RULES_BLOCK}

You are a South African procurement evaluation methodology specialist. Extract the complete evaluation framework. Return ONLY this JSON structure:

{
  "evaluation_methodology": {
    "number_of_stages": 0,
    "stage_1_administrative": {
      "applicable": true,
      "criteria": [{ "criterion": "exact criterion name", "mandatory": true, "disqualifies_if_failed": true, "page_reference": 0 }]
    },
    "stage_2_functionality": {
      "applicable": true,
      "minimum_threshold": 0,
      "threshold_unit": "percentage or points",
      "below_threshold_consequence": "exact consequence",
      "maximum_points": 100,
      "criteria": [{ "criterion": "exact criterion name", "weight": 0, "maximum_points": 0, "scoring_guide": "exact scoring guide as written", "page_reference": 0 }],
      "page_reference": 0
    },
    "stage_3_price_and_preference": {
      "applicable": true,
      "pppfa_split": "90/10 or 80/20",
      "price_points": 0,
      "preference_points": 0,
      "price_formula": "exact formula as written",
      "bbbee_points_table": [{ "bbbee_level": "Level 1", "points_awarded": 10 }],
      "page_reference": 0
    },
    "stage_4_specific_goals": {
      "applicable": false,
      "goals": [{ "goal": "exact goal description", "points": 0, "requirements": "exact requirements", "page_reference": 0 }]
    }
  },
  "disqualification_rules": [{ "rule": "exact rule as written", "stage": "administrative or functionality or financial", "consequence": "exact consequence", "page_reference": 0 }],
  "evaluation_committee": { "mentioned": false, "composition": null, "page_reference": null }
}`;

const PROMPT_PRICING = `${RULES_BLOCK}

You are a South African quantity surveying and procurement pricing specialist. Extract ALL pricing information. Never summarize pricing tables. Preserve every line item exactly as written. Return ONLY this JSON structure:

{
  "pricing_type": "one of: fixed_price, BOQ, rate_schedule, provisional_sum, hybrid",
  "currency": "ZAR",
  "vat_inclusive": false,
  "pricing_instructions": "exact instructions for how bidder must price",
  "pricing_schedules": [
    {
      "schedule_name": "exact schedule name",
      "page_number": 0,
      "table_extracted": true,
      "bidder_must_complete": true,
      "rows": [
        { "item_no": "exact item number", "description": "exact description", "unit": "unit of measurement", "quantity": 0, "rate_column": "BLANK if bidder must complete or pre-filled value", "amount_column": "BLANK if bidder must complete or pre-filled value", "notes": "any notes" }
      ]
    }
  ],
  "BOQ": { "present": false, "pages": [], "sections": [], "total_items": 0, "note": "instructions for BOQ completion" },
  "provisional_sums": [{ "description": "exact description", "amount": 0, "page_reference": 0 }],
  "contract_value_estimate": "stated estimate if any",
  "pricing_errors_to_avoid": "any specific warnings in document about pricing errors"
}`;

const PROMPT_CONTRACT = `${RULES_BLOCK}

You are a South African construction and procurement contracts specialist. Extract all contract terms with exact page references. Return ONLY this JSON structure:

{
  "contract_type": "one of: NEC4, NEC3, JBCC, GCC, FIDIC, custom, hybrid",
  "contract_duration": "exact duration as written",
  "commencement_date": "exact date or description",
  "payment_terms": { "payment_cycle": "one of: monthly, milestone, completion, other", "payment_period_days": 0, "retention_percentage": 0, "retention_release_conditions": "exact conditions", "penalty_for_late_payment": "exact penalty if stated", "page_reference": 0 },
  "penalties_and_damages": [{ "type": "exact type such as delay damages", "rate": "exact rate such as R5000 per day", "cap": "maximum cap if stated", "trigger": "exact trigger condition", "page_reference": 0 }],
  "insurance_requirements": [{ "type": "exact insurance type", "minimum_cover": "exact cover amount", "mandatory": true, "notes": "any specific requirements", "page_reference": 0 }],
  "subcontracting_rules": { "allowed": true, "maximum_percentage": 0, "client_approval_required": true, "designated_subcontractors": [], "page_reference": 0 },
  "termination_clauses": { "summary": "plain English summary", "notice_period": "exact notice period", "page_reference": 0 },
  "dispute_resolution": { "method": "exact method such as adjudication or arbitration", "process": "summary of process", "page_reference": 0 },
  "warranties_and_guarantees": [{ "type": "exact warranty type", "duration": "exact duration", "page_reference": 0 }],
  "governing_law": "Republic of South Africa",
  "special_conditions": [{ "condition": "exact special condition", "page_reference": 0 }]
}`;

// ============================================================
// GEMINI CALLER
// ============================================================
async function callGemini(opts: {
  apiKey: string;
  prompt: string;
  base64: string;
  mimeType: string;
  pageHint?: string;
  model?: string;
  timeoutMs?: number;
}): Promise<any> {
  const { apiKey, prompt, base64, mimeType, pageHint, model = "google/gemini-2.5-flash", timeoutMs = 180_000 } = opts;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);

  const userText = pageHint
    ? `${prompt}\n\nFOCUS ON THESE PAGES (the full PDF is attached, but concentrate your extraction here): ${pageHint}`
    : prompt;

  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      signal: ctrl.signal,
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: userText },
              { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64}` } },
            ],
          },
        ],
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      if (res.status === 429) throw new Error("AI rate limit");
      if (res.status === 402) throw new Error("AI credits exhausted");
      throw new Error(`AI ${res.status}: ${body.slice(0, 200)}`);
    }

    const payload = await res.json();
    const raw = payload?.choices?.[0]?.message?.content;
    if (!raw || typeof raw !== "string") throw new Error("Empty AI response");
    return safeParseJSON(raw);
  } finally {
    clearTimeout(t);
  }
}

// ============================================================
// MASTER RESULT BUILDERS
// ============================================================
type PassResults = {
  triage: any | null;
  submission: any | null;
  returnables: any | null;
  evaluation: any | null;
  pricing: any | null;
  contract: any | null;
};

function buildPageLevelIntelligence(pageMap: any[]): any[] {
  if (!Array.isArray(pageMap)) return [];
  return pageMap
    .filter((p) => p && (p.requires_action || p.contains_table || p.contains_graph || (typeof p.confidence === "number" && p.confidence < 0.75)))
    .map((p) => ({
      page: p.page,
      section_type: p.section_type ?? "unknown",
      action_required: !!p.requires_action,
      action: p.notes ?? null,
      mandatory: !!p.requires_action,
      contains_table: !!p.contains_table,
      contains_graph: !!p.contains_graph,
      confidence: p.confidence ?? null,
      review_flag:
        p.contains_graph || (typeof p.confidence === "number" && p.confidence < 0.75)
          ? p.contains_graph
            ? "Contains a graph or diagram — manual review recommended"
            : `Low extraction confidence (${Math.round((p.confidence ?? 0) * 100)}%)`
          : null,
    }));
}

function buildComplianceChecklist(submission: any, returnables: any): any[] {
  const out: any[] = [];
  const sub = submission?.mandatory_compliance_documents;
  if (Array.isArray(sub)) {
    for (const d of sub) {
      out.push({
        name: d?.document_name ?? "Unnamed document",
        mandatory: d?.mandatory !== false,
        disqualifies_if_missing: !!d?.disqualifies_if_missing,
        page: d?.page_reference ?? null,
        source: "submission",
      });
    }
  }
  const ret = returnables?.returnables;
  if (Array.isArray(ret)) {
    for (const r of ret) {
      if (r?.mandatory) {
        out.push({
          name: r?.name ?? "Unnamed returnable",
          mandatory: true,
          disqualifies_if_missing: !!r?.disqualifies_if_missing,
          page: r?.page_number ?? null,
          source: "returnable",
        });
      }
    }
  }
  return out;
}

function buildRiskFlags(all: PassResults): any[] {
  const flags: any[] = [];
  const push = (severity: string, category: string, flag: string, page_reference: any, action_required: string) =>
    flags.push({ severity, category, flag, page_reference: page_reference ?? null, action_required });

  // Mandatory briefing session
  const brief = all.submission?.submission?.briefing_session;
  if (brief?.mandatory) {
    push(
      "critical",
      "submission",
      `Mandatory briefing session — non-attendance: ${brief.non_attendance_consequence ?? "may disqualify bid"}`,
      brief.page_reference,
      `Attend briefing on ${brief.date ?? "TBC"} at ${brief.venue ?? "TBC"}`
    );
  }

  // CIDB grade
  const cidb = all.submission?.regulatory_requirements?.CIDB;
  if (cidb?.required && cidb?.minimum_grade) {
    push(
      "high",
      "compliance",
      `CIDB grade ${cidb.minimum_grade} ${cidb.designation ?? ""} required at closing`,
      cidb.page_reference,
      `Ensure CIDB registration is active at grade ${cidb.minimum_grade} before submission`
    );
  }

  // Disqualifying returnables
  const dqReturnables = (all.returnables?.returnables ?? []).filter((r: any) => r?.disqualifies_if_missing);
  for (const r of dqReturnables) {
    push("critical", "compliance", `Disqualifying returnable: ${r.name}`, r.page_number, `Complete and submit ${r.name}`);
  }

  // Closing date within 14 days
  const closingStr = all.submission?.submission?.closing_date;
  if (closingStr) {
    const d = new Date(closingStr);
    if (!isNaN(d.getTime())) {
      const days = Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      if (days >= 0 && days <= 14) {
        push("high", "submission", `Closing in ${days} day(s) — ${closingStr}`, all.submission?.submission?.page_reference, "Prepare and submit bid immediately");
      } else if (days < 0) {
        push("medium", "submission", `Tender has already closed (${closingStr})`, all.submission?.submission?.page_reference, "Confirm with issuer if extensions apply");
      }
    }
  }

  // Functionality threshold above 70%
  const func = all.evaluation?.evaluation_methodology?.stage_2_functionality;
  if (func?.applicable && typeof func.minimum_threshold === "number" && func.minimum_threshold > 70) {
    push("high", "technical", `Functionality threshold of ${func.minimum_threshold}${func.threshold_unit === "percentage" ? "%" : ""} — above industry norm`, func.page_reference, "Strengthen technical response to comfortably exceed threshold");
  }

  // Retention above 10%
  const pay = all.contract?.payment_terms;
  if (pay && typeof pay.retention_percentage === "number" && pay.retention_percentage > 10) {
    push("medium", "financial", `Retention of ${pay.retention_percentage}% exceeds typical 10% — cashflow risk`, pay.page_reference, "Price retention impact into bid and plan cashflow accordingly");
  }

  // Delay damages above R10k/day
  for (const p of all.contract?.penalties_and_damages ?? []) {
    const rate = String(p?.rate ?? "");
    const m = rate.match(/R\s*([\d ,]+)/i);
    if (m) {
      const num = parseInt(m[1].replace(/[ ,]/g, ""), 10);
      if (!isNaN(num) && num > 10000) {
        push("high", "financial", `${p.type ?? "Damages"}: ${rate} — high exposure`, p.page_reference, "Quantify total exposure and confirm achievability of timelines");
      }
    }
  }

  return flags;
}

function buildMissingData(all: PassResults): any[] {
  const missing: any[] = [];
  const walk = (obj: any, path: string, source: string) => {
    if (!obj || typeof obj !== "object") return;
    for (const [k, v] of Object.entries(obj)) {
      const p = path ? `${path}.${k}` : k;
      if (v === null) missing.push({ field: p, page: null, reason: "Not present in document", source });
      else if (typeof v === "object" && !Array.isArray(v)) walk(v, p, source);
    }
  };
  walk(all.submission, "", "submission");
  walk(all.evaluation, "", "evaluation");
  walk(all.contract, "", "contract");
  walk(all.pricing, "", "pricing");
  return missing.slice(0, 200);
}

function buildOneLiner(triage: any, submission: any): string {
  const parts: string[] = [];
  if (triage?.document_type) parts.push(triage.document_type);
  if (triage?.industry_domain) parts.push(`for ${triage.industry_domain}`);
  if (triage?.issuing_entity) parts.push(`from ${triage.issuing_entity}`);
  if (submission?.submission?.closing_date) parts.push(`closing ${submission.submission.closing_date}`);
  return parts.length ? parts.join(" ") : "Procurement document";
}

function buildViabilityFactors(all: PassResults): string[] {
  const v: string[] = [];
  const cidb = all.submission?.regulatory_requirements?.CIDB;
  if (cidb?.required) v.push(`CIDB ${cidb.minimum_grade ?? ""} ${cidb.designation ?? ""}`.trim() + " required");
  const bbbee = all.submission?.regulatory_requirements?.BBBEE;
  if (bbbee?.required) v.push(`B-BBEE ${bbbee.minimum_level ?? "level"} required`);
  const split = all.submission?.regulatory_requirements?.PPPFA_split || all.evaluation?.evaluation_methodology?.stage_3_price_and_preference?.pppfa_split;
  if (split) v.push(`PPPFA ${split} preference system`);
  const ret = all.returnables?.total_returnables_count;
  if (ret) v.push(`${ret} returnable documents to complete`);
  const dq = all.returnables?.disqualifying_returnables_count;
  if (dq) v.push(`${dq} disqualifying returnables`);
  const brief = all.submission?.submission?.briefing_session;
  if (brief?.mandatory) v.push("Mandatory briefing session");
  return v;
}

function calculateAverageConfidence(triage: any): number {
  const pages = triage?.page_map;
  if (!Array.isArray(pages) || pages.length === 0) return 0;
  const vals = pages.map((p) => (typeof p?.confidence === "number" ? p.confidence : null)).filter((v) => v !== null) as number[];
  if (vals.length === 0) return 0;
  return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100;
}

// ============================================================
// PASS RUNNERS (helpers wrapped per-pass for try/catch in handler)
// ============================================================
function pagesHint(pages: any): string | undefined {
  if (!Array.isArray(pages) || pages.length === 0) return undefined;
  return pages.filter((p) => p != null).join(", ");
}

async function runTriage(apiKey: string, base64: string, mimeType: string) {
  return callGemini({ apiKey, prompt: PROMPT_TRIAGE, base64, mimeType, model: "google/gemini-2.5-pro", timeoutMs: 240_000 });
}
async function runSubmission(apiKey: string, base64: string, mimeType: string, triage: any) {
  const hint = pagesHint([
    ...(triage?.critical_sections?.submission_instructions_pages ?? []),
    ...(triage?.critical_sections?.CIDB_pages ?? []),
    ...(triage?.critical_sections?.BBBEE_pages ?? []),
  ]);
  return callGemini({ apiKey, prompt: PROMPT_SUBMISSION, base64, mimeType, pageHint: hint });
}
async function runReturnables(apiKey: string, base64: string, mimeType: string, triage: any) {
  const hint = pagesHint([
    ...(triage?.critical_sections?.mandatory_returnables_pages ?? []),
    ...(triage?.critical_sections?.SBD_form_pages ?? []),
  ]);
  return callGemini({ apiKey, prompt: PROMPT_RETURNABLES, base64, mimeType, pageHint: hint });
}
async function runEvaluation(apiKey: string, base64: string, mimeType: string, triage: any) {
  const hint = pagesHint(triage?.critical_sections?.evaluation_criteria_pages);
  return callGemini({ apiKey, prompt: PROMPT_EVALUATION, base64, mimeType, pageHint: hint });
}
async function runPricing(apiKey: string, base64: string, mimeType: string, triage: any) {
  const hint = pagesHint([
    ...(triage?.critical_sections?.pricing_schedule_pages ?? []),
    ...(triage?.critical_sections?.BOQ_pages ?? []),
  ]);
  return callGemini({ apiKey, prompt: PROMPT_PRICING, base64, mimeType, pageHint: hint });
}
async function runContract(apiKey: string, base64: string, mimeType: string, triage: any) {
  const hint = pagesHint(triage?.critical_sections?.contract_conditions_pages);
  return callGemini({ apiKey, prompt: PROMPT_CONTRACT, base64, mimeType, pageHint: hint });
}

// ============================================================
// DOWNLOAD FILE FROM SUPABASE STORAGE
// ============================================================
async function loadFileBase64(filePath: string): Promise<{ base64: string; mimeType: string }> {
  const { data: signed, error } = await supabaseAdmin.storage.from("documents").createSignedUrl(filePath, 600);
  if (error || !signed) throw new Error("Could not access uploaded file");
  const fileRes = await fetch(signed.signedUrl);
  if (!fileRes.ok) throw new Error("Failed to download file for analysis");
  const buf = await fileRes.arrayBuffer();
  if (buf.byteLength > 25 * 1024 * 1024) throw new Error("File too large for analysis (max 20MB)");
  return { base64: Buffer.from(buf).toString("base64"), mimeType: "application/pdf" };
}

// ============================================================
// MAIN ORCHESTRATOR
// ============================================================
export const analyzeDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { documentId: string }) => z.object({ documentId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("AI service is not configured. Please contact support.");

    const { data: doc, error: docErr } = await supabaseAdmin.from("documents").select("*").eq("id", data.documentId).maybeSingle();
    if (docErr) throw new Error("Could not load document");
    if (!doc) throw new Error("Document not found");
    if (doc.user_id !== userId) throw new Error("Forbidden");

    if ((doc as any).master_result) return { success: true, documentId: doc.id, alreadyAnalysed: true };
    if (doc.status === "processing") throw new Error("This document is already being analysed. Please wait a moment.");

    const { data: reserved, error: reserveErr } = await supabaseAdmin.rpc("reserve_credits", { _user_id: userId, _amount: CREDITS_PER_ANALYSIS });
    if (reserveErr) throw new Error("Could not reserve credits");
    if (!reserved) throw new Error(`Insufficient credits. ${CREDITS_PER_ANALYSIS} credits required per analysis.`);

    let refunded = false;
    const refund = async () => {
      if (refunded) return;
      refunded = true;
      await supabaseAdmin.rpc("refund_credits", { _user_id: userId, _amount: CREDITS_PER_ANALYSIS });
    };

    await supabaseAdmin.from("documents").update({ status: "processing", error_message: null }).eq("id", doc.id);

    try {
      const { base64, mimeType } = await loadFileBase64(doc.file_path);

      // PASS 1 — TRIAGE (must succeed; without it we cannot route page hints)
      let triage: any;
      try {
        triage = await runTriage(apiKey, base64, mimeType);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Triage failed";
        throw new Error(`Triage extraction failed: ${msg}`);
      }

      // PASSES 2A–2E — PARALLEL with per-pass try/catch
      const passes = await Promise.all([
        runSubmission(apiKey, base64, mimeType, triage).then((v) => ({ ok: true, v }), (e) => ({ ok: false, e: e?.message ?? "error" })),
        runReturnables(apiKey, base64, mimeType, triage).then((v) => ({ ok: true, v }), (e) => ({ ok: false, e: e?.message ?? "error" })),
        runEvaluation(apiKey, base64, mimeType, triage).then((v) => ({ ok: true, v }), (e) => ({ ok: false, e: e?.message ?? "error" })),
        runPricing(apiKey, base64, mimeType, triage).then((v) => ({ ok: true, v }), (e) => ({ ok: false, e: e?.message ?? "error" })),
        runContract(apiKey, base64, mimeType, triage).then((v) => ({ ok: true, v }), (e) => ({ ok: false, e: e?.message ?? "error" })),
      ]);

      const [subRes, retRes, evalRes, priceRes, contractRes] = passes as any[];
      const all: PassResults = {
        triage,
        submission: subRes.ok ? subRes.v : null,
        returnables: retRes.ok ? retRes.v : null,
        evaluation: evalRes.ok ? evalRes.v : null,
        pricing: priceRes.ok ? priceRes.v : null,
        contract: contractRes.ok ? contractRes.v : null,
      };
      const passLabels = ["2A_submission", "2B_returnables", "2C_evaluation", "2D_pricing", "2E_contract"];
      const passes_completed = ["1_triage", ...passes.map((p: any, i) => (p.ok ? passLabels[i] : null)).filter(Boolean) as string[]];
      const passes_failed = passes.map((p: any, i) => (p.ok ? null : passLabels[i])).filter(Boolean) as string[];

      const page_level_intelligence = buildPageLevelIntelligence(triage?.page_map ?? []);
      const compliance_checklist = buildComplianceChecklist(all.submission, all.returnables);
      const risk_flags = buildRiskFlags(all);
      const missing_data = buildMissingData(all);

      const masterResult = {
        meta: {
          extraction_version: EXTRACTION_VERSION,
          processed_at: new Date().toISOString(),
          document_name: doc.file_name,
          total_pages: triage?.total_pages ?? null,
          extraction_passes: 5,
          passes_completed,
          passes_failed,
          overall_confidence: calculateAverageConfidence(triage),
        },
        triage,
        submission: all.submission,
        returnables: all.returnables,
        evaluation: all.evaluation,
        pricing: all.pricing,
        contract: all.contract,
        page_level_intelligence,
        compliance_checklist,
        risk_flags,
        missing_data,
        procurement_summary: {
          one_line: buildOneLiner(triage, all.submission),
          bid_viability_factors: buildViabilityFactors(all),
        },
      };

      await supabaseAdmin.from("documents").update({
        status: "completed",
        credits_used: CREDITS_PER_ANALYSIS,
        error_message: null,
        triage_result: triage,
        submission_result: all.submission,
        returnables_result: all.returnables,
        evaluation_result: all.evaluation,
        pricing_result: all.pricing,
        contract_result: all.contract,
        page_level_intelligence,
        compliance_checklist,
        risk_flags,
        missing_data,
        extraction_version: EXTRACTION_VERSION,
        extraction_passes_completed: passes_completed.length,
        extraction_failed_passes: passes_failed,
        master_result: masterResult,
      } as any).eq("id", doc.id);

      return { success: true, documentId: doc.id, passes_completed, passes_failed };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      await refund();
      await supabaseAdmin.from("documents").update({ status: "failed", error_message: message }).eq("id", doc.id);
      throw new Error(message);
    }
  });

// ============================================================
// RETRY A SINGLE PASS
// ============================================================
const PASS_NAMES = ["1_triage", "2A_submission", "2B_returnables", "2C_evaluation", "2D_pricing", "2E_contract"] as const;
type PassName = typeof PASS_NAMES[number];

export const retryExtractionPass = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { documentId: string; pass: PassName }) =>
    z.object({ documentId: z.string().uuid(), pass: z.enum(PASS_NAMES) }).parse(input)
  )
  .handler(async ({ data, context }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("AI service is not configured.");

    const { data: doc } = await supabaseAdmin.from("documents").select("*").eq("id", data.documentId).maybeSingle();
    if (!doc) throw new Error("Document not found");
    if (doc.user_id !== context.userId) throw new Error("Forbidden");

    const { base64, mimeType } = await loadFileBase64(doc.file_path);
    const triage = (doc as any).triage_result ?? null;
    if (data.pass !== "1_triage" && !triage) throw new Error("Re-run triage first before retrying section passes.");

    let result: any;
    switch (data.pass) {
      case "1_triage": result = await runTriage(apiKey, base64, mimeType); break;
      case "2A_submission": result = await runSubmission(apiKey, base64, mimeType, triage); break;
      case "2B_returnables": result = await runReturnables(apiKey, base64, mimeType, triage); break;
      case "2C_evaluation": result = await runEvaluation(apiKey, base64, mimeType, triage); break;
      case "2D_pricing": result = await runPricing(apiKey, base64, mimeType, triage); break;
      case "2E_contract": result = await runContract(apiKey, base64, mimeType, triage); break;
    }

    const col: Record<PassName, string> = {
      "1_triage": "triage_result",
      "2A_submission": "submission_result",
      "2B_returnables": "returnables_result",
      "2C_evaluation": "evaluation_result",
      "2D_pricing": "pricing_result",
      "2E_contract": "contract_result",
    };

    const updates: any = { [col[data.pass]]: result };

    // Refresh derived fields + master_result
    const refreshed = { ...(doc as any), [col[data.pass]]: result };
    const all: PassResults = {
      triage: refreshed.triage_result,
      submission: refreshed.submission_result,
      returnables: refreshed.returnables_result,
      evaluation: refreshed.evaluation_result,
      pricing: refreshed.pricing_result,
      contract: refreshed.contract_result,
    };
    updates.page_level_intelligence = buildPageLevelIntelligence(all.triage?.page_map ?? []);
    updates.compliance_checklist = buildComplianceChecklist(all.submission, all.returnables);
    updates.risk_flags = buildRiskFlags(all);
    updates.missing_data = buildMissingData(all);
    const failed = ((doc as any).extraction_failed_passes ?? []).filter((p: string) => p !== data.pass);
    updates.extraction_failed_passes = failed;
    updates.master_result = {
      meta: {
        extraction_version: EXTRACTION_VERSION,
        processed_at: new Date().toISOString(),
        document_name: doc.file_name,
        total_pages: all.triage?.total_pages ?? null,
        extraction_passes: 5,
        passes_completed: PASS_NAMES.filter((n) => !failed.includes(n)),
        passes_failed: failed,
        overall_confidence: calculateAverageConfidence(all.triage),
      },
      ...all,
      page_level_intelligence: updates.page_level_intelligence,
      compliance_checklist: updates.compliance_checklist,
      risk_flags: updates.risk_flags,
      missing_data: updates.missing_data,
      procurement_summary: {
        one_line: buildOneLiner(all.triage, all.submission),
        bid_viability_factors: buildViabilityFactors(all),
      },
    };

    await supabaseAdmin.from("documents").update(updates).eq("id", doc.id);
    return { success: true, pass: data.pass };
  });
