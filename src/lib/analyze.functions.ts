import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const CREDITS_PER_ANALYSIS = 3;
const EXTRACTION_VERSION = "4.0";

// ============================================================
// PART 1 — ROBUST JSON PARSER
// Handles all Gemini response variations:
// - JSON wrapped in ```json fences
// - JSON with leading/trailing text
// - Truncated JSON (attempts partial recovery)
// - Completely malformed responses
// ============================================================
function safeParseJSON(raw: string): any {
  if (!raw || typeof raw !== "string") throw new Error("Empty AI response");

  // Step 1: Strip markdown fences
  let cleaned = raw
    .replace(/^```json\s*/im, "")
    .replace(/^```\s*/im, "")
    .replace(/```\s*$/im, "")
    .trim();

  // Step 2: Try direct parse
  try { return JSON.parse(cleaned); } catch {}

  // Step 3: Extract largest JSON object
  const objMatch = cleaned.match(/\{[\s\S]*\}/);
  if (objMatch) {
    try { return JSON.parse(objMatch[0]); } catch {}
    // Step 4: Attempt to repair truncated JSON by closing open braces/brackets
    try {
      const partial = objMatch[0];
      const openBraces = (partial.match(/\{/g) || []).length - (partial.match(/\}/g) || []).length;
      const openBrackets = (partial.match(/\[/g) || []).length - (partial.match(/\]/g) || []).length;
      const repaired = partial + "]".repeat(Math.max(0, openBrackets)) + "}".repeat(Math.max(0, openBraces));
      return JSON.parse(repaired);
    } catch {}
  }

  // Step 5: Extract JSON array
  const arrMatch = cleaned.match(/\[[\s\S]*\]/);
  if (arrMatch) { try { return JSON.parse(arrMatch[0]); } catch {} }

  throw new Error(`JSON parse failed. Raw preview: ${raw.slice(0, 400)}`);
}

// ============================================================
// SHARED RULES — prepended to EVERY prompt
// These rules override any conflicting model behaviour
// ============================================================
const RULES = `CRITICAL RULES — READ BEFORE RESPONDING:
1. Return ONLY valid JSON. Zero markdown. Zero explanation. Zero preamble. Zero postamble.
2. NEVER summarize. Preserve EXACT wording for ALL deadlines, amounts, addresses, requirements, conditions and legal text.
3. Every extracted field MUST include the exact page number. Write "Page 64" not "P64" not "pg64" not "page64".
4. When information is missing, return null with a reason string. Never guess. Never infer. Never fabricate.
5. South African procurement context:
   - PPPFA = Preferential Procurement Policy Framework Act
   - 90/10 = price 90pts + B-BBEE 10pts (contracts above R50 million)
   - 80/20 = price 80pts + B-BBEE 20pts (contracts R30,000 to R50 million)
   - CIDB grades 1–9, designations: GB CE SB ME EE EP SI WR SW and others
   - SBD 1 through SBD 9 are national government mandatory forms
   - MBD forms are used by municipalities and are mandatory
   - B-BBEE affidavits acceptable for EMEs and QSEs (turnover thresholds apply)
   - COIDA = Compensation for Occupational Injuries and Diseases Act
   - NEC4/NEC3 = New Engineering Contract 4th/3rd edition
   - JBCC = Joint Building Contracts Committee
   - GCC = General Conditions of Contract (CSIR)
   - FIDIC = Federation Internationale des Ingenieurs-Conseils
6. Do NOT skip any pages. Do NOT truncate arrays. Do NOT abbreviate table rows.
7. If a page contains a graph, chart, or diagram you cannot fully read, still include it with confidence 0.3 and a review_flag explaining what you can see.`;

// ============================================================
// PASS 1 — DOCUMENT TRIAGE PROMPT
// Covers first 10 + last 3 pages
// Produces the page map used to route all subsequent passes
// ============================================================
const PROMPT_TRIAGE = `${RULES}

You are an expert South African public procurement document classifier with deep knowledge of eTenders.gov.za, CIDB, National Treasury, and all municipal, provincial and SOE procurement systems.

The full PDF document is attached. Analyse every single page and return ONLY this JSON:

{
  "document_type": "exact one of: RFQ, RFP, RFI, EOI, Open Tender, Restricted Tender, Framework Agreement, Panel Appointment, Term Contract, Emergency Procurement, Prequalification, Negotiated Tender, Multi-Stage Tender, Expression of Interest, Other",
  "procurement_authority_type": "exact one of: National Department, Provincial Department, Municipality, Metropolitan Municipality, SOE, Public Entity, TVET College, University, Water Board, Development Finance Institution, Other",
  "issuing_entity": "exact full legal name of department or entity as it appears in document",
  "reference_number": "exact tender/RFQ/RFP reference number",
  "tender_title": "exact title as written on cover page or notice",
  "industry_domain": "primary industry domain such as Construction, ICT, Healthcare, Security Services, Cleaning, Transport, Engineering, Professional Services, etc.",
  "total_pages": 0,
  "estimated_complexity": "one of: low, medium, high, very_high",
  "has_multiple_volumes": false,
  "volume_count": 1,
  "contains_addenda": false,
  "page_map": [
    {
      "page": 1,
      "section_type": "one of: cover_page, tender_notice, advertisement, scope_of_work, technical_specs, evaluation_criteria, pricing_schedule, BOQ, rate_schedule, SBD_form, MBD_form, returnable_schedule, returnable_index, declaration_form, contract_conditions, general_conditions, particular_conditions, special_conditions, CIDB_requirements, BBBEE_requirements, tax_compliance, insurance_schedule, submission_instructions, briefing_details, addendum, annexure, graph, diagram, chart, attendance_register, signature_page, authority_resolution, JV_agreement, subcontractor_form, site_information, drawings, blank, unknown",
      "requires_action": true,
      "contains_table": false,
      "contains_graph": false,
      "contains_form": false,
      "is_returnable": false,
      "confidence": 0.95,
      "notes": "exact description of what this page contains — be specific e.g. 'SBD 4 Declaration of Interest form with company details fields' not just 'form'"
    }
  ],
  "critical_sections": {
    "closing_date_page": 0,
    "tender_reference_page": 0,
    "submission_instructions_pages": [],
    "evaluation_criteria_pages": [],
    "mandatory_returnables_pages": [],
    "returnables_index_pages": [],
    "pricing_schedule_pages": [],
    "BOQ_pages": [],
    "CIDB_pages": [],
    "BBBEE_pages": [],
    "SBD_form_pages": [],
    "MBD_form_pages": [],
    "contract_conditions_pages": [],
    "scope_of_work_pages": [],
    "technical_spec_pages": [],
    "insurance_pages": [],
    "graph_pages": [],
    "low_confidence_pages": []
  }
}

IMPORTANT: page_map must have exactly one entry per page. Do not skip blank pages — include them as blank. Include every graph and diagram page. Flag every page with confidence below 0.75 in low_confidence_pages.`;

// ============================================================
// PASS 2A — SUBMISSION & COMPLIANCE PROMPT
// ============================================================
const PROMPT_SUBMISSION = `${RULES}

You are a South African procurement compliance specialist. Extract ALL submission requirements and compliance obligations from the attached PDF. Return ONLY this JSON:

{
  "submission": {
    "closing_date": "exact date as written e.g. 15 November 2024",
    "closing_time": "exact time with timezone e.g. 11:00 (SAST)",
    "submission_method": "one of: physical, electronic, both",
    "physical_address": "full address: building name, floor number, room/tender box number, street address, suburb, city, postal code",
    "tender_box_details": "exact tender box description if mentioned",
    "portal_url": "exact URL if electronic submission required",
    "portal_name": "name of portal e.g. eTenders, Ariba, Oracle iProc",
    "packaging_instructions": "exact instructions — number of envelopes, sealing, labelling format",
    "labelling_instructions": "exact envelope/package labelling requirements",
    "number_of_copies": "exact number of hard copies e.g. 1 original + 3 copies",
    "electronic_copy_required": false,
    "flash_drive_required": false,
    "page_reference": 0,
    "notes": "any other submission requirements",
    "briefing_session": {
      "mandatory": true,
      "date": "exact date",
      "time": "exact time",
      "venue": "full physical venue address",
      "attendance_register_required": true,
      "registration_required": false,
      "registration_contact": null,
      "non_attendance_consequence": "exact wording e.g. non-attendance will result in disqualification",
      "page_reference": 0
    }
  },
  "mandatory_compliance_documents": [
    {
      "document_name": "exact name as written in document",
      "mandatory": true,
      "disqualifies_if_missing": true,
      "validity_requirements": "e.g. must be valid at date of submission",
      "format_requirements": "e.g. original or certified copy",
      "page_reference": 0,
      "notes": "any additional requirements"
    }
  ],
  "regulatory_requirements": {
    "CIDB": {
      "required": true,
      "minimum_grade": "exact grade e.g. 7EP or 5CE",
      "designation": "exact designation e.g. Electrical, Civil Engineering, Building",
      "must_be_registered_at_closing": true,
      "joint_venture_provisions": "any JV CIDB provisions",
      "page_reference": 0
    },
    "BBBEE": {
      "required": true,
      "minimum_level": "exact level or null if not specified",
      "acceptable_certificate_types": "e.g. SANAS accredited certificate or sworn affidavit for EME/QSE",
      "emd_qse_threshold": "exact threshold amounts if mentioned",
      "subcontracting_goals": "any subcontracting to B-BBEE entities requirements",
      "page_reference": 0
    },
    "tax_compliance": {
      "SARS_TCS_PIN_required": true,
      "must_be_valid_at_closing": true,
      "joint_venture_requirements": null,
      "page_reference": 0
    },
    "CIPC_registration": {
      "required": true,
      "certified_copy_required": true,
      "page_reference": 0
    },
    "COIDA": {
      "required": false,
      "letter_of_good_standing": false,
      "page_reference": null
    },
    "municipal_accounts": {
      "required": false,
      "municipality": null,
      "page_reference": null
    },
    "professional_registrations": [
      {
        "body": "e.g. ECSA, SACPCMP, SAICA, SACAP",
        "required": true,
        "discipline": "specific discipline if applicable",
        "page_reference": 0
      }
    ],
    "PFMA_applicable": true,
    "MFMA_applicable": false,
    "PPPFA_applicable": true,
    "PPPFA_split": "90/10 or 80/20",
    "page_reference": 0
  }
}`;

// ============================================================
// PASS 2B — RETURNABLE SCHEDULES PROMPT
// This is the most critical pass — missing returnables = disqualification
// ============================================================
const PROMPT_RETURNABLES = `${RULES}

You are a South African tender submission specialist with expert knowledge of all government forms and returnable requirements. 

CRITICAL INSTRUCTION: Identify EVERY SINGLE document, form, schedule, declaration, affidavit, certificate, questionnaire, register, and undertaking that a bidder must complete and/or submit. Treat every page flagged as returnable, SBD form, MBD form, declaration form, or signature page as a potential returnable. If in doubt — include it. Missing returnables = automatic disqualification.

Return ONLY this JSON:

{
  "returnables": [
    {
      "id": "unique ID e.g. SBD_1 or RET_001 or MBD_4",
      "name": "exact name as written in document",
      "page_number": 0,
      "form_type": "one of: SBD, MBD, custom_form, declaration, pricing_schedule, BOQ, technical_schedule, compliance_certificate, authority_resolution, joint_venture, subcontractor_declaration, bank_details, reference_letter, attendance_register, other",
      "mandatory": true,
      "disqualifies_if_missing": true,
      "requires_signature": true,
      "requires_company_stamp": false,
      "requires_commissioner_of_oaths": false,
      "requires_witness": false,
      "requires_letterhead": false,
      "requires_original": false,
      "requires_certified_copy": false,
      "fields_to_complete": [
        "List every field the bidder must fill in — be specific e.g. Company registration number, VAT number, Authorised signatory name and designation"
      ],
      "purpose": "plain English explanation of what this form does and why it matters",
      "notes": "exact special instructions or warnings from the document"
    }
  ],
  "total_returnables_count": 0,
  "disqualifying_returnables_count": 0,
  "returnables_checklist_page": 0,
  "returnables_index_present": false,
  "risk_summary": "plain English: how complex is the submission? How many forms? What are the highest risk items? What must be done by a Commissioner of Oaths?"
}

Standard South African returnables to specifically look for and extract if present:
SBD 1 (Invitation to Bid), SBD 2 (Tax Matters), SBD 3.1 (Pricing Schedule), SBD 3.2 (Pricing Schedule services), SBD 3.3 (Pricing Schedule construction), SBD 4 (Declaration of Interest), SBD 5A (Declaration for procurement above threshold), SBD 6.1 (Preference Points Claim 90/10), SBD 6.2 (Preference Points Claim 80/20), SBD 7.2 (Contract), SBD 8 (Declaration of Bidder Past SCM Practices), SBD 9 (Certificate of Independent Bid Determination), MBD 1 through MBD 9, Compulsory Enterprise Questionnaire, BBBEE Status Level Certificate or Affidavit, Tax Compliance Status Pin, CIPC registration certificate, CIDB certificate, Professional registration certificates, Company profile, CVs of key personnel, Reference letters, Bank confirmation letter, Audited financial statements, Insurance certificates.`;

// ============================================================
// PASS 2C — EVALUATION MATRIX PROMPT
// ============================================================
const PROMPT_EVALUATION = `${RULES}

You are a South African procurement evaluation methodology specialist with deep knowledge of PPPFA, National Treasury Instruction Notes, and evaluation committee practices.

Extract the COMPLETE evaluation framework. Do not summarize scoring guides — reproduce them exactly. Return ONLY this JSON:

{
  "evaluation_methodology": {
    "number_of_stages": 0,
    "overall_description": "plain English summary of how this tender will be evaluated",
    "stage_1_administrative": {
      "applicable": true,
      "description": "what happens at this stage",
      "criteria": [
        {
          "criterion": "exact criterion name e.g. Valid Tax Clearance Certificate",
          "mandatory": true,
          "disqualifies_if_failed": true,
          "verification_method": "how it will be checked",
          "page_reference": 0
        }
      ]
    },
    "stage_2_functionality": {
      "applicable": true,
      "minimum_threshold": 0,
      "threshold_unit": "percentage or points",
      "below_threshold_consequence": "exact wording of consequence",
      "maximum_points": 100,
      "weighting_method": "how weights are applied",
      "criteria": [
        {
          "criterion": "exact criterion name",
          "weight": 0,
          "maximum_points": 0,
          "scoring_guide": "EXACT scoring guide as written — e.g. 0 projects = 0 points, 1-2 projects = 10 points, 3-5 projects = 20 points",
          "evidence_required": "what documentary evidence must be submitted",
          "page_reference": 0
        }
      ],
      "page_reference": 0
    },
    "stage_3_price_and_preference": {
      "applicable": true,
      "pppfa_split": "90/10 or 80/20",
      "price_points": 0,
      "preference_points": 0,
      "price_formula": "exact formula as written",
      "preference_formula": "exact formula as written",
      "bbbee_points_table": [
        {
          "bbbee_level": "Level 1",
          "points_awarded": 10,
          "non_compliant_points": 0
        }
      ],
      "page_reference": 0
    },
    "stage_4_specific_goals": {
      "applicable": false,
      "total_points": 0,
      "goals": [
        {
          "goal": "exact goal description e.g. 30% subcontracting to EMEs/QSEs",
          "points": 0,
          "requirements": "exact requirements to qualify for these points",
          "evidence_required": "what must be submitted",
          "page_reference": 0
        }
      ]
    }
  },
  "disqualification_rules": [
    {
      "rule": "exact rule as written",
      "stage": "administrative or functionality or financial or post-award",
      "consequence": "exact consequence",
      "page_reference": 0
    }
  ],
  "evaluation_committee": {
    "mentioned": false,
    "composition": null,
    "quorum_requirements": null,
    "page_reference": null
  },
  "award_criteria": "any specific award criteria beyond price/preference scoring",
  "negotiation_allowed": false,
  "best_and_final_offer": false
}`;

// ============================================================
// PASS 2D — PRICING AND BOQ PROMPT
// ============================================================
const PROMPT_PRICING = `${RULES}

You are a South African quantity surveyor and procurement pricing specialist. 

CRITICAL: Never summarize pricing tables. Never truncate BOQ items. Extract EVERY line item EXACTLY as written. Blank rate/amount cells must be shown as the string "BLANK". Return ONLY this JSON:

{
  "pricing_type": "one of: fixed_lump_sum, BOQ, rate_schedule, provisional_sum, hybrid, framework_rates, not_specified",
  "currency": "ZAR",
  "vat_inclusive": false,
  "vat_rate_percent": 15,
  "pricing_instructions": "exact instructions for how bidder must price the document",
  "arithmetic_errors_policy": "what happens if arithmetic errors found — exact wording",
  "pricing_errors_to_avoid": "exact warnings about pricing errors",
  "contract_value_estimate": "stated budget or estimate if mentioned",
  "pricing_schedules": [
    {
      "schedule_name": "exact schedule name e.g. Schedule A — Professional Fees",
      "page_number": 0,
      "table_extracted": true,
      "bidder_must_complete": true,
      "total_line_present": false,
      "rows": [
        {
          "item_no": "exact item number e.g. 1.1.1",
          "description": "exact description — full text, do not abbreviate",
          "unit": "unit of measurement e.g. m2, hour, lump sum, each",
          "quantity": "exact quantity or BLANK",
          "rate_column": "BLANK if bidder must complete, or exact pre-filled value",
          "amount_column": "BLANK if bidder must complete, or exact pre-filled value",
          "notes": "any notes or conditions on this line item"
        }
      ]
    }
  ],
  "BOQ": {
    "present": false,
    "pages": [],
    "sections": [
      {
        "section_name": "exact section name",
        "page_start": 0,
        "page_end": 0,
        "item_count": 0
      }
    ],
    "total_items": 0,
    "has_preliminaries": false,
    "note": "exact instructions for BOQ completion"
  },
  "provisional_sums": [
    {
      "description": "exact description",
      "amount": 0,
      "contingency": false,
      "page_reference": 0
    }
  ],
  "daywork_rates": {
    "present": false,
    "description": null,
    "page_reference": null
  },
  "escalation_provisions": {
    "allowed": false,
    "formula": null,
    "page_reference": null
  }
}`;

// ============================================================
// PASS 2E — CONTRACT INTELLIGENCE PROMPT
// ============================================================
const PROMPT_CONTRACT = `${RULES}

You are a South African construction and procurement contracts specialist with expertise in NEC, JBCC, GCC, FIDIC, and standard government contract conditions.

Extract ALL contract terms. Preserve exact legal wording for all clauses. Return ONLY this JSON:

{
  "contract_type": "one of: NEC4, NEC3, JBCC_Principal, JBCC_Minor_Works, GCC_2015, GCC_2010, FIDIC_Red, FIDIC_Yellow, FIDIC_Silver, FIDIC_White, custom, hybrid, not_specified",
  "contract_form_edition": "exact edition or version if stated",
  "contract_duration": "exact duration e.g. 24 months or until 31 March 2027",
  "commencement_date": "exact date or description e.g. date of letter of acceptance",
  "defects_liability_period": "exact duration and terms",
  "payment_terms": {
    "payment_cycle": "one of: monthly, milestone, completion, quarterly, on_delivery, other",
    "payment_period_days": 0,
    "payment_certificate_required": false,
    "retention_percentage": 0,
    "retention_limit_percentage": null,
    "retention_release_conditions": "exact conditions for retention release",
    "performance_guarantee_required": false,
    "performance_guarantee_percentage": null,
    "penalty_for_late_payment": "exact penalty if stated",
    "interest_on_late_payment": null,
    "page_reference": 0
  },
  "penalties_and_damages": [
    {
      "type": "exact type e.g. Delay Damages, Penalty for non-performance",
      "rate": "exact rate e.g. R5,000 per calendar day",
      "cap": "maximum cap e.g. 10% of contract price",
      "trigger": "exact trigger condition",
      "grace_period": "any grace period before penalty applies",
      "page_reference": 0
    }
  ],
  "insurance_requirements": [
    {
      "type": "exact insurance type e.g. Contractors All Risk, Public Liability",
      "minimum_cover": "exact cover amount e.g. R10,000,000",
      "mandatory": true,
      "co_insured_required": false,
      "notes": "any specific requirements e.g. must note client as additional insured",
      "page_reference": 0
    }
  ],
  "subcontracting_rules": {
    "allowed": true,
    "maximum_percentage": null,
    "client_approval_required": true,
    "designated_subcontractors": [],
    "domestic_subcontractors": null,
    "subcontracting_for_bbbee": null,
    "page_reference": 0
  },
  "termination_clauses": {
    "convenience_termination_allowed": false,
    "summary": "plain English summary",
    "notice_period": "exact notice period",
    "compensation_on_termination": null,
    "page_reference": 0
  },
  "dispute_resolution": {
    "method": "exact method e.g. Adjudication, Arbitration, Mediation",
    "governing_body": "e.g. AFSA, ACSA, High Court",
    "escalation_process": "step by step process as described",
    "page_reference": 0
  },
  "warranties_and_guarantees": [
    {
      "type": "exact warranty type",
      "duration": "exact duration",
      "conditions": "exact conditions",
      "page_reference": 0
    }
  ],
  "intellectual_property": {
    "mentioned": false,
    "client_owns_deliverables": null,
    "page_reference": null
  },
  "confidentiality": {
    "required": false,
    "duration": null,
    "page_reference": null
  },
  "governing_law": "Republic of South Africa",
  "jurisdiction": "exact jurisdiction e.g. High Court of South Africa, Gauteng Division",
  "special_conditions": [
    {
      "condition": "exact special condition — full text",
      "page_reference": 0
    }
  ],
  "key_definitions": [
    {
      "term": "defined term",
      "definition": "exact definition",
      "page_reference": 0
    }
  ]
}`;

// ============================================================
// GEMINI API CALLER
// Uses Lovable AI Gateway (OpenAI-compatible endpoint)
// Sends PDF as base64 image_url for vision processing
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
  const {
    apiKey,
    prompt,
    base64,
    mimeType,
    pageHint,
    model = "google/gemini-2.5-flash",
    timeoutMs = 200_000,
  } = opts;

  // When page hints exist, focus the model but keep the full PDF for context
  const userText = pageHint
    ? `${prompt}\n\nFOCUS PAGES: Concentrate extraction on these pages (the full PDF is attached): ${pageHint}\nNote: write page references as "Page X" format throughout.`
    : `${prompt}\n\nNote: write all page references as "Page X" format throughout.`;

  // Exponential backoff for 429 rate-limit errors: 5s, 15s, 30s, then fail.
  const backoffs = [5_000, 15_000, 30_000];
  let lastErr: any = null;

  for (let attempt = 0; attempt <= backoffs.length; attempt++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        signal: ctrl.signal,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: userText },
                {
                  type: "image_url",
                  image_url: { url: `data:${mimeType};base64,${base64}` },
                },
              ],
            },
          ],
        }),
      });

      if (res.status === 429) {
        const wait = backoffs[attempt];
        if (wait != null) {
          console.warn(`[callGemini] 429 rate-limited, retrying in ${wait}ms (attempt ${attempt + 1}/${backoffs.length})`);
          await new Promise((r) => setTimeout(r, wait));
          continue;
        }
        throw new Error("AI rate limit reached after 3 retries — please wait 2 minutes and retry this document.");
      }

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        if (res.status === 402) throw new Error("AI credits exhausted");
        if (res.status === 413) throw new Error("Document too large for AI processing");
        throw new Error(`AI error ${res.status}: ${body.slice(0, 200)}`);
      }

      const payload = await res.json();
      const raw = payload?.choices?.[0]?.message?.content;
      if (!raw || typeof raw !== "string") throw new Error("Empty AI response received");

      return safeParseJSON(raw);
    } catch (e: any) {
      lastErr = e;
      // Abort/timeout or non-retryable — re-throw immediately
      if (e?.name === "AbortError") throw new Error(`AI request timed out after ${Math.round(timeoutMs / 1000)}s`);
      if (!String(e?.message ?? "").includes("rate limit")) throw e;
      // rate-limit path: loop continues if attempts remain
      if (attempt >= backoffs.length) throw e;
    } finally {
      clearTimeout(t);
    }
  }

  throw lastErr ?? new Error("AI request failed");
}

// ============================================================
// MASTER RESULT BUILDER FUNCTIONS
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
    .filter(
      (p) =>
        p &&
        (p.requires_action ||
          p.is_returnable ||
          p.contains_table ||
          p.contains_graph ||
          (typeof p.confidence === "number" && p.confidence < 0.80))
    )
    .map((p) => {
      // Generate human-readable action description based on section type
      let action: string | null = p.notes ?? null;
      if (!action) {
        const actionMap: Record<string, string> = {
          SBD_form: "Complete and sign this SBD form",
          MBD_form: "Complete and sign this MBD form",
          returnable_schedule: "Complete this returnable schedule",
          declaration_form: "Complete and sign this declaration",
          pricing_schedule: "Complete all pricing fields",
          BOQ: "Complete all BOQ rates and amounts",
          signature_page: "Review and sign where required",
          attendance_register: "Sign attendance register at briefing session",
          authority_resolution: "Complete board/member resolution",
          insurance_schedule: "Complete insurance details",
        };
        action = actionMap[p.section_type ?? ""] ?? null;
      }

      const reviewFlag =
        p.contains_graph
          ? `Page ${p.page} contains a graph or diagram — visual content may not be fully extracted, manual review recommended`
          : typeof p.confidence === "number" && p.confidence < 0.80
          ? `Page ${p.page} has low extraction confidence (${Math.round((p.confidence ?? 0) * 100)}%) — verify content manually`
          : null;

      return {
        page: p.page,
        section_type: p.section_type ?? "unknown",
        action_required: !!p.requires_action || !!p.is_returnable,
        action,
        mandatory: !!p.requires_action || !!p.is_returnable,
        contains_table: !!p.contains_table,
        contains_graph: !!p.contains_graph,
        confidence: p.confidence ?? null,
        review_flag: reviewFlag,
        notes: p.notes ?? null,
      };
    });
}

function buildComplianceChecklist(submission: any, returnables: any): any[] {
  const out: any[] = [];

  // From submission compliance documents
  const compDocs = submission?.mandatory_compliance_documents;
  if (Array.isArray(compDocs)) {
    for (const d of compDocs) {
      out.push({
        name: d?.document_name ?? "Unnamed document",
        mandatory: d?.mandatory !== false,
        disqualifies_if_missing: !!d?.disqualifies_if_missing,
        page: d?.page_reference ?? null,
        validity: d?.validity_requirements ?? null,
        format: d?.format_requirements ?? null,
        source: "compliance",
      });
    }
  }

  // From returnables
  const rets = returnables?.returnables;
  if (Array.isArray(rets)) {
    for (const r of rets) {
      if (r?.mandatory) {
        out.push({
          name: r?.name ?? "Unnamed returnable",
          mandatory: true,
          disqualifies_if_missing: !!r?.disqualifies_if_missing,
          page: r?.page_number ?? null,
          validity: null,
          format: r?.requires_original ? "Original required" : r?.requires_certified_copy ? "Certified copy required" : null,
          source: "returnable",
        });
      }
    }
  }

  return out;
}

function buildRiskFlags(all: PassResults): any[] {
  const flags: any[] = [];

  const push = (
    severity: "critical" | "high" | "medium" | "low",
    category: string,
    flag: string,
    page_reference: any,
    action_required: string
  ) => flags.push({ severity, category, flag, page_reference: page_reference ?? null, action_required });

  // Mandatory briefing session
  const brief = all.submission?.submission?.briefing_session;
  if (brief?.mandatory) {
    push(
      "critical",
      "submission",
      `Mandatory briefing session — ${brief.non_attendance_consequence ?? "non-attendance may disqualify bid"}`,
      brief.page_reference,
      `Attend briefing on ${brief.date ?? "TBC"} at ${brief.time ?? ""} at ${brief.venue ?? "TBC"}`
    );
  }

  // CIDB grade requirement
  const cidb = all.submission?.regulatory_requirements?.CIDB;
  if (cidb?.required && cidb?.minimum_grade) {
    push(
      "high",
      "compliance",
      `CIDB registration grade ${cidb.minimum_grade} ${cidb.designation ?? ""} required — must be active at closing date`,
      cidb.page_reference,
      `Verify CIDB certificate is valid, current grade is ${cidb.minimum_grade} or higher, and designation matches`
    );
  }

  // Professional registration requirements
  const profRegs = all.submission?.regulatory_requirements?.professional_registrations ?? [];
  for (const reg of profRegs) {
    if (reg?.required) {
      push(
        "high",
        "compliance",
        `Professional registration with ${reg.body} required${reg.discipline ? ` — ${reg.discipline}` : ""}`,
        reg.page_reference,
        `Obtain and attach valid registration certificate from ${reg.body}`
      );
    }
  }

  // Every disqualifying returnable is a critical risk
  const dqReturnables = (all.returnables?.returnables ?? []).filter(
    (r: any) => r?.disqualifies_if_missing && r?.mandatory
  );
  for (const r of dqReturnables) {
    push(
      "critical",
      "compliance",
      `Disqualifying returnable: ${r.name} — missing this form will disqualify the bid`,
      r.page_number,
      `Complete and submit ${r.name}${r.requires_commissioner_of_oaths ? " — requires Commissioner of Oaths" : ""}${r.requires_signature ? " — requires signature" : ""}`
    );
  }

  // Closing date proximity
  const closingStr = all.submission?.submission?.closing_date;
  if (closingStr) {
    // Try to parse various SA date formats
    const d = new Date(closingStr);
    if (!isNaN(d.getTime())) {
      const days = Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      if (days >= 0 && days <= 7) {
        push("critical", "submission", `Tender closes in ${days} day(s) — URGENT: ${closingStr}`, all.submission?.submission?.page_reference, "Submit immediately — check all returnables are complete");
      } else if (days > 7 && days <= 14) {
        push("high", "submission", `Tender closes in ${days} days — ${closingStr}`, all.submission?.submission?.page_reference, "Prepare and submit bid — limited time remaining");
      } else if (days < 0) {
        push("medium", "submission", `Tender closed on ${closingStr} — ${Math.abs(days)} days ago`, all.submission?.submission?.page_reference, "Confirm with issuer whether late submissions or extensions apply");
      }
    }
  }

  // High functionality threshold
  const func = all.evaluation?.evaluation_methodology?.stage_2_functionality;
  if (func?.applicable && typeof func.minimum_threshold === "number" && func.minimum_threshold > 70) {
    push(
      "high",
      "technical",
      `Functionality threshold is ${func.minimum_threshold}${func.threshold_unit === "percentage" ? "%" : " points"} — above 70% industry norm. ${func.below_threshold_consequence ?? "Bids below threshold may be disqualified."}`,
      func.page_reference,
      "Prepare strong technical response and gather evidence for each criterion to comfortably exceed the threshold"
    );
  }

  // Retention above 10%
  const pay = all.contract?.payment_terms;
  if (pay && typeof pay.retention_percentage === "number" && pay.retention_percentage > 10) {
    push(
      "medium",
      "financial",
      `Retention of ${pay.retention_percentage}% exceeds typical 10% — significant cashflow risk on large contract values`,
      pay.page_reference,
      "Price retention impact into bid rates, arrange bridging finance if needed, and confirm release conditions"
    );
  }

  // Performance guarantee requirement
  if (pay?.performance_guarantee_required && pay?.performance_guarantee_percentage) {
    push(
      "high",
      "financial",
      `Performance guarantee of ${pay.performance_guarantee_percentage}% of contract value required`,
      pay.page_reference,
      "Arrange performance guarantee with bank or insurer before award — this costs money and requires lead time"
    );
  }

  // High delay damages
  for (const p of all.contract?.penalties_and_damages ?? []) {
    const rate = String(p?.rate ?? "");
    const m = rate.match(/R\s*([\d ,]+)/i);
    if (m) {
      const num = parseInt(m[1].replace(/[ ,]/g, ""), 10);
      if (!isNaN(num) && num > 10_000) {
        push(
          "high",
          "financial",
          `${p.type ?? "Delay damages"}: ${rate} — high daily exposure${p.cap ? `, capped at ${p.cap}` : ""}`,
          p.page_reference,
          "Confirm your programme is achievable, build in contingency, and ensure insurance covers this exposure"
        );
      }
    }
  }

  // Insurance requirements
  for (const ins of all.contract?.insurance_requirements ?? []) {
    if (ins?.mandatory && ins?.minimum_cover) {
      push(
        "medium",
        "financial",
        `Insurance required: ${ins.type ?? "Unknown type"} — minimum cover ${ins.minimum_cover}`,
        ins.page_reference,
        `Arrange or confirm existing ${ins.type} policy meets minimum cover of ${ins.minimum_cover}`
      );
    }
  }

  // Commissioner of Oaths required
  const coaRequired = (all.returnables?.returnables ?? []).some((r: any) => r?.requires_commissioner_of_oaths);
  if (coaRequired) {
    push(
      "medium",
      "compliance",
      "One or more returnables require Commissioner of Oaths — allow time to have documents commissioned",
      null,
      "Identify all documents requiring commissioning and arrange Commissioner of Oaths appointment well before closing date"
    );
  }

  // Sort by severity
  const order: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  flags.sort((a, b) => (order[a.severity] ?? 4) - (order[b.severity] ?? 4));

  return flags;
}

function buildMissingData(all: PassResults): any[] {
  const missing: any[] = [];

  // Check critical top-level fields only (not deep nulls which flood the list)
  const checks: Array<{ label: string; value: any; source: string; reason: string }> = [
    { label: "Closing date", value: all.submission?.submission?.closing_date, source: "submission", reason: "Not stated in document or could not be extracted" },
    { label: "Submission address", value: all.submission?.submission?.physical_address, source: "submission", reason: "Physical address not found" },
    { label: "CIDB grade requirement", value: all.submission?.regulatory_requirements?.CIDB?.minimum_grade, source: "submission", reason: "CIDB requirement not specified or not applicable" },
    { label: "B-BBEE level requirement", value: all.submission?.regulatory_requirements?.BBBEE?.minimum_level, source: "submission", reason: "B-BBEE requirement not specified" },
    { label: "PPPFA split (90/10 or 80/20)", value: all.submission?.regulatory_requirements?.PPPFA_split, source: "submission", reason: "PPPFA preference point split not specified" },
    { label: "Evaluation criteria", value: all.evaluation?.evaluation_methodology?.number_of_stages, source: "evaluation", reason: "Evaluation methodology not found in document" },
    { label: "Contract type", value: all.contract?.contract_type, source: "contract", reason: "Contract type not specified" },
    { label: "Contract duration", value: all.contract?.contract_duration, source: "contract", reason: "Contract duration not specified" },
    { label: "Payment terms", value: all.contract?.payment_terms?.payment_period_days, source: "contract", reason: "Payment period not specified" },
    { label: "Pricing schedule", value: (all.pricing?.pricing_schedules?.length ?? 0) > 0 ? "present" : null, source: "pricing", reason: "No pricing schedule found — may be in separate document or BOQ only" },
  ];

  for (const c of checks) {
    if (c.value === null || c.value === undefined || c.value === "") {
      missing.push({ field: c.label, page: null, reason: c.reason, source: c.source });
    }
  }

  return missing;
}

function buildOneLiner(triage: any, submission: any): string {
  const parts: string[] = [];
  if (triage?.tender_title) return triage.tender_title;
  if (triage?.document_type) parts.push(triage.document_type);
  if (triage?.industry_domain) parts.push(`for ${triage.industry_domain}`);
  if (triage?.issuing_entity) parts.push(`issued by ${triage.issuing_entity}`);
  if (triage?.reference_number) parts.push(`(${triage.reference_number})`);
  if (submission?.submission?.closing_date) parts.push(`— closes ${submission.submission.closing_date}`);
  return parts.length ? parts.join(" ") : "Procurement document";
}

function buildViabilityFactors(all: PassResults): string[] {
  const v: string[] = [];

  const cidb = all.submission?.regulatory_requirements?.CIDB;
  if (cidb?.required && cidb?.minimum_grade) {
    v.push(`CIDB ${cidb.minimum_grade}${cidb.designation ? " " + cidb.designation : ""} registration required`);
  }

  const bbbee = all.submission?.regulatory_requirements?.BBBEE;
  if (bbbee?.required) {
    v.push(`B-BBEE ${bbbee.minimum_level ? bbbee.minimum_level + " required" : "certificate required"}`);
  }

  const split = all.submission?.regulatory_requirements?.PPPFA_split
    || all.evaluation?.evaluation_methodology?.stage_3_price_and_preference?.pppfa_split;
  if (split) v.push(`PPPFA ${split} preference point system applies`);

  const func = all.evaluation?.evaluation_methodology?.stage_2_functionality;
  if (func?.applicable && func.minimum_threshold) {
    v.push(`Functionality threshold: ${func.minimum_threshold}${func.threshold_unit === "percentage" ? "%" : " points"} minimum`);
  }

  const totalRet = all.returnables?.total_returnables_count;
  if (totalRet) v.push(`${totalRet} returnable documents required`);

  const dqRet = all.returnables?.disqualifying_returnables_count;
  if (dqRet) v.push(`${dqRet} returnables are disqualifying if missing`);

  const brief = all.submission?.submission?.briefing_session;
  if (brief?.mandatory) v.push("Compulsory briefing session — attendance is mandatory");

  const coaCount = (all.returnables?.returnables ?? []).filter((r: any) => r?.requires_commissioner_of_oaths).length;
  if (coaCount > 0) v.push(`${coaCount} document(s) require Commissioner of Oaths`);

  const perfGuarantee = all.contract?.payment_terms?.performance_guarantee_required;
  if (perfGuarantee) v.push(`Performance guarantee required (${all.contract?.payment_terms?.performance_guarantee_percentage ?? "?"}%)`);

  return v;
}

function calculateAverageConfidence(triage: any): number {
  const pages = triage?.page_map;
  if (!Array.isArray(pages) || pages.length === 0) return 0;
  const vals = pages
    .map((p) => (typeof p?.confidence === "number" ? p.confidence : null))
    .filter((v): v is number => v !== null);
  if (vals.length === 0) return 0;
  return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100;
}

// ============================================================
// PAGE HINT HELPERS
// Deduplicate and sort page numbers for prompt context
// ============================================================
function pagesHint(pages: any): string | undefined {
  if (!Array.isArray(pages) || pages.length === 0) return undefined;
  const nums = [...new Set(pages.filter((p) => p != null && typeof p === "number"))]
    .sort((a, b) => a - b);
  if (nums.length === 0) return undefined;
  return `Pages ${nums.join(", ")}`;
}

// ============================================================
// INDIVIDUAL PASS RUNNERS
// ============================================================
async function runTriage(apiKey: string, base64: string, mimeType: string) {
  return callGemini({
    apiKey, prompt: PROMPT_TRIAGE, base64, mimeType,
    model: "google/gemini-2.5-flash",
    timeoutMs: 120_000,
  });
}

async function runSubmission(apiKey: string, base64: string, mimeType: string, triage: any) {
  const hint = pagesHint([
    ...(triage?.critical_sections?.submission_instructions_pages ?? []),
    ...(triage?.critical_sections?.CIDB_pages ?? []),
    ...(triage?.critical_sections?.BBBEE_pages ?? []),
    ...(triage?.critical_sections?.returnables_index_pages ?? []),
  ]);
  return callGemini({ apiKey, prompt: PROMPT_SUBMISSION, base64, mimeType, pageHint: hint });
}

async function runReturnables(apiKey: string, base64: string, mimeType: string, triage: any) {
  const hint = pagesHint([
    ...(triage?.critical_sections?.mandatory_returnables_pages ?? []),
    ...(triage?.critical_sections?.SBD_form_pages ?? []),
    ...(triage?.critical_sections?.MBD_form_pages ?? []),
    ...(triage?.critical_sections?.returnables_index_pages ?? []),
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
  const hint = pagesHint([
    ...(triage?.critical_sections?.contract_conditions_pages ?? []),
    ...(triage?.critical_sections?.insurance_pages ?? []),
  ]);
  return callGemini({ apiKey, prompt: PROMPT_CONTRACT, base64, mimeType, pageHint: hint });
}

// ============================================================
// FILE LOADER — Download from Supabase Storage
// ============================================================
async function loadFileBase64(filePath: string): Promise<{ base64: string; mimeType: string }> {
  const { data: signed, error } = await supabaseAdmin.storage
    .from("documents")
    .createSignedUrl(filePath, 600);

  if (error || !signed) throw new Error("Could not access uploaded file — storage error");

  const fileRes = await fetch(signed.signedUrl);
  if (!fileRes.ok) throw new Error(`Failed to download file for analysis (HTTP ${fileRes.status})`);

  const buf = await fileRes.arrayBuffer();
  const maxBytes = 25 * 1024 * 1024;
  if (buf.byteLength > maxBytes) {
    throw new Error(`File is ${(buf.byteLength / 1024 / 1024).toFixed(1)}MB — maximum supported size is 25MB. Please split the document into smaller files.`);
  }

  return { base64: Buffer.from(buf).toString("base64"), mimeType: "application/pdf" };
}

// ============================================================
// MASTER ASSEMBLY
// ============================================================
function assembleMasterResult(
  doc: any,
  all: PassResults,
  passes_completed: string[],
  passes_failed: string[]
) {
  const page_level_intelligence = buildPageLevelIntelligence(all.triage?.page_map ?? []);
  const compliance_checklist = buildComplianceChecklist(all.submission, all.returnables);
  const risk_flags = buildRiskFlags(all);
  const missing_data = buildMissingData(all);

  return {
    meta: {
      extraction_version: EXTRACTION_VERSION,
      processed_at: new Date().toISOString(),
      document_name: doc.file_name,
      total_pages: all.triage?.total_pages ?? null,
      extraction_passes: 5,
      passes_completed,
      passes_failed,
      overall_confidence: calculateAverageConfidence(all.triage),
    },
    triage: all.triage,
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
      one_line: buildOneLiner(all.triage, all.submission),
      bid_viability_factors: buildViabilityFactors(all),
    },
  };
}

// ============================================================
// MAIN ORCHESTRATOR — analyzeDocument
// ============================================================
export const analyzeDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { documentId: string }) =>
    z.object({ documentId: z.string().uuid() }).parse(input)
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("AI service is not configured. Please contact support.");

    // Load document record
    const { data: doc, error: docErr } = await supabaseAdmin
      .from("documents")
      .select("*")
      .eq("id", data.documentId)
      .maybeSingle();

    if (docErr) throw new Error("Could not load document");
    if (!doc) throw new Error("Document not found");
    if (doc.user_id !== userId) throw new Error("Forbidden");

    // Return cached result if already analysed (force=true would re-run, but we don't support that yet)
    if ((doc as any).master_result) {
      return { success: true, documentId: doc.id, alreadyAnalysed: true };
    }

    // Prevent double processing — but auto-recover stale jobs (>5min) so the user can retry.
    if (doc.status === "processing") {
      const updatedAt = doc.updated_at ? new Date(doc.updated_at).getTime() : 0;
      const stale = Date.now() - updatedAt > 5 * 60 * 1000;
      if (!stale) {
        throw new Error("This document is already being analysed. Please wait.");
      }
      // Reset so we can start fresh
      await supabaseAdmin
        .from("documents")
        .update({ status: "failed", error_message: "Previous run timed out — retrying" })
        .eq("id", doc.id);
    }

    // Reserve credits
    const { data: reserved, error: reserveErr } = await supabaseAdmin.rpc("reserve_credits", {
      _user_id: userId,
      _amount: CREDITS_PER_ANALYSIS,
    });

    if (reserveErr) throw new Error("Could not reserve credits");
    if (!reserved) {
      throw new Error(`Insufficient credits. ${CREDITS_PER_ANALYSIS} credits are required to analyse this document.`);
    }

    let refunded = false;
    const refund = async () => {
      if (refunded) return;
      refunded = true;
      await supabaseAdmin.rpc("refund_credits", {
        _user_id: userId,
        _amount: CREDITS_PER_ANALYSIS,
      });
    };

    // Mark as processing
    await supabaseAdmin
      .from("documents")
      .update({ status: "processing", error_message: null })
      .eq("id", doc.id);

    try {
      const { base64, mimeType } = await loadFileBase64(doc.file_path);

      // Shared tracker so we can save partial results if the overall pipeline times out.
      const passLabels = [
        "2A_submission",
        "2B_returnables",
        "2C_evaluation",
        "2D_pricing",
        "2E_contract",
      ] as const;

      let triage: any = null;
      let triageError: string | null = null;
      const tracker: Record<(typeof passLabels)[number], { ok: boolean | null; v?: any; err?: string }> = {
        "2A_submission": { ok: null },
        "2B_returnables": { ok: null },
        "2C_evaluation": { ok: null },
        "2D_pricing": { ok: null },
        "2E_contract": { ok: null },
      };

      const PIPELINE_TIMEOUT_MS = 90_000;

      const pipelinePromise = (async () => {
        // ── PASS 1: TRIAGE (must succeed — routes all other passes) ──
        try {
          triage = await runTriage(apiKey, base64, mimeType);
        } catch (e) {
          triageError = e instanceof Error ? e.message : "Unknown triage error";
          throw new Error(`Document triage failed: ${triageError}. Please retry.`);
        }

        // ── PASSES 2A–2E: PARALLEL with individual try/catch + shared tracker ──
        await Promise.all([
          runSubmission(apiKey, base64, mimeType, triage)
            .then((v) => { tracker["2A_submission"] = { ok: true, v }; })
            .catch((e) => { tracker["2A_submission"] = { ok: false, err: e?.message ?? "submission pass failed" }; }),
          runReturnables(apiKey, base64, mimeType, triage)
            .then((v) => { tracker["2B_returnables"] = { ok: true, v }; })
            .catch((e) => { tracker["2B_returnables"] = { ok: false, err: e?.message ?? "returnables pass failed" }; }),
          runEvaluation(apiKey, base64, mimeType, triage)
            .then((v) => { tracker["2C_evaluation"] = { ok: true, v }; })
            .catch((e) => { tracker["2C_evaluation"] = { ok: false, err: e?.message ?? "evaluation pass failed" }; }),
          runPricing(apiKey, base64, mimeType, triage)
            .then((v) => { tracker["2D_pricing"] = { ok: true, v }; })
            .catch((e) => { tracker["2D_pricing"] = { ok: false, err: e?.message ?? "pricing pass failed" }; }),
          runContract(apiKey, base64, mimeType, triage)
            .then((v) => { tracker["2E_contract"] = { ok: true, v }; })
            .catch((e) => { tracker["2E_contract"] = { ok: false, err: e?.message ?? "contract pass failed" }; }),
        ]);
      })();

      let timedOut = false;
      const timeoutPromise = new Promise<void>((resolve) =>
        setTimeout(() => { timedOut = true; resolve(); }, PIPELINE_TIMEOUT_MS)
      );

      try {
        await Promise.race([pipelinePromise, timeoutPromise]);
      } catch (e) {
        // Triage failure or other fatal error — bubble up to outer catch (which refunds + marks failed)
        throw e;
      }

      // If triage never resolved (timeout before triage finished), treat as failure
      if (!triage) {
        throw new Error("Extraction timed out before document triage completed. Please retry — if this keeps happening, the document may be too complex.");
      }

      const all: PassResults = {
        triage,
        submission: tracker["2A_submission"].ok ? tracker["2A_submission"].v : null,
        returnables: tracker["2B_returnables"].ok ? tracker["2B_returnables"].v : null,
        evaluation: tracker["2C_evaluation"].ok ? tracker["2C_evaluation"].v : null,
        pricing: tracker["2D_pricing"].ok ? tracker["2D_pricing"].v : null,
        contract: tracker["2E_contract"].ok ? tracker["2E_contract"].v : null,
      };

      const passes_completed = [
        "1_triage",
        ...passLabels.filter((l) => tracker[l].ok === true),
      ];
      // Anything that did not resolve as ok=true (failed OR still pending after timeout) is failed
      const passes_failed = passLabels.filter((l) => tracker[l].ok !== true);

      const masterResult = assembleMasterResult(doc, all, passes_completed, passes_failed);

      // If pipeline timed out, refund credits and surface partial-result note
      let resultMessage: string | null = null;
      if (timedOut) {
        await refund();
        resultMessage = "Extraction timed out — partial results shown. Retry individual sections using the buttons below.";
      }

      await supabaseAdmin
        .from("documents")
        .update({
          status: "completed",
          credits_used: timedOut ? 0 : CREDITS_PER_ANALYSIS,
          error_message: resultMessage,
          triage_result: triage,
          submission_result: all.submission,
          returnables_result: all.returnables,
          evaluation_result: all.evaluation,
          pricing_result: all.pricing,
          contract_result: all.contract,
          page_level_intelligence: masterResult.page_level_intelligence,
          compliance_checklist: masterResult.compliance_checklist,
          risk_flags: masterResult.risk_flags,
          missing_data: masterResult.missing_data,
          extraction_version: EXTRACTION_VERSION,
          extraction_passes_completed: passes_completed.length,
          extraction_failed_passes: passes_failed,
          master_result: masterResult,
        } as any)
        .eq("id", doc.id);

      return {
        success: true,
        documentId: doc.id,
        passes_completed,
        passes_failed,
        timedOut,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error during analysis";
      await refund();
      await supabaseAdmin
        .from("documents")
        .update({ status: "failed", error_message: message })
        .eq("id", doc.id);
      throw new Error(message);
    }
  });

// ============================================================
// RETRY A SINGLE PASS
// ============================================================
const PASS_NAMES = [
  "1_triage",
  "2A_submission",
  "2B_returnables",
  "2C_evaluation",
  "2D_pricing",
  "2E_contract",
] as const;
type PassName = (typeof PASS_NAMES)[number];

export const retryExtractionPass = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { documentId: string; pass: PassName }) =>
    z.object({ documentId: z.string().uuid(), pass: z.enum(PASS_NAMES) }).parse(input)
  )
  .handler(async ({ data, context }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("AI service is not configured.");

    const { data: doc } = await supabaseAdmin
      .from("documents")
      .select("*")
      .eq("id", data.documentId)
      .maybeSingle();

    if (!doc) throw new Error("Document not found");
    if (doc.user_id !== context.userId) throw new Error("Forbidden");

    const { base64, mimeType } = await loadFileBase64(doc.file_path);
    const triage = (doc as any).triage_result ?? null;

    if (data.pass !== "1_triage" && !triage) {
      throw new Error("Triage pass must be run first before retrying other passes.");
    }

    let result: any;
    switch (data.pass) {
      case "1_triage":       result = await runTriage(apiKey, base64, mimeType); break;
      case "2A_submission":  result = await runSubmission(apiKey, base64, mimeType, triage); break;
      case "2B_returnables": result = await runReturnables(apiKey, base64, mimeType, triage); break;
      case "2C_evaluation":  result = await runEvaluation(apiKey, base64, mimeType, triage); break;
      case "2D_pricing":     result = await runPricing(apiKey, base64, mimeType, triage); break;
      case "2E_contract":    result = await runContract(apiKey, base64, mimeType, triage); break;
    }

    const colMap: Record<PassName, string> = {
      "1_triage":       "triage_result",
      "2A_submission":  "submission_result",
      "2B_returnables": "returnables_result",
      "2C_evaluation":  "evaluation_result",
      "2D_pricing":     "pricing_result",
      "2E_contract":    "contract_result",
    };

    // Rebuild the full pass results from stored + retried
    const refreshed = { ...(doc as any), [colMap[data.pass]]: result };
    const all: PassResults = {
      triage:      refreshed.triage_result,
      submission:  refreshed.submission_result,
      returnables: refreshed.returnables_result,
      evaluation:  refreshed.evaluation_result,
      pricing:     refreshed.pricing_result,
      contract:    refreshed.contract_result,
    };

    const prevFailed: string[] = (doc as any).extraction_failed_passes ?? [];
    const passes_failed = prevFailed.filter((p) => p !== data.pass);
    const passes_completed = PASS_NAMES.filter((n) => !passes_failed.includes(n));
    const masterResult = assembleMasterResult(doc, all, passes_completed, passes_failed);

    await supabaseAdmin
      .from("documents")
      .update({
        [colMap[data.pass]]: result,
        page_level_intelligence: masterResult.page_level_intelligence,
        compliance_checklist: masterResult.compliance_checklist,
        risk_flags: masterResult.risk_flags,
        missing_data: masterResult.missing_data,
        extraction_failed_passes: passes_failed,
        extraction_passes_completed: passes_completed.length,
        master_result: masterResult,
      } as any)
      .eq("id", doc.id);

    return { success: true, pass: data.pass };
  });