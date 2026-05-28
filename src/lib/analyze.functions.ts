import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const SYSTEM_PROMPT = `You are an elite South African procurement intelligence analyst working at the level of an experienced bid manager / tender consultant. You analyse government tenders, RFQs, RFPs, bid packs, BOQs, returnable schedules, addenda, technical specifications, appointment letters, and NEC3/GCC2015/JBCC contracts from the SA eTender Portal, CIDB, municipalities, provincial and national departments, and SOEs (Eskom, Transnet, PRASA, SAA, Denel, Sasol, Sanral, Rand Water, Telkom, water boards).

DEEP DOMAIN KNOWLEDGE YOU MUST APPLY:
- Regulatory: PPPFA (80/20 and 90/10 preference point systems), PFMA, MFMA, BBBEE Act, CIDB Act, OHS Act, COIDA, B-BBEE Codes of Good Practice, Preferential Procurement Regulations 2022.
- CIDB grading: levels 1–9, classes (CE civil, GB general building, EB electrical, ME mechanical, SW specialist works), PE/SE designations.
- B-BBEE: Levels 1–8, generic vs QSE vs EME, sworn affidavits vs SANAS-accredited certificates, specific goals scoring.
- Standard forms — you MUST recognise these by code AND by purpose:
  * SBD 1 (invitation to bid), SBD 2 (declaration of bidders past SCM practices), SBD 3.1/3.2/3.3 (pricing schedules), SBD 4 (declaration of interest / state employees), SBD 5 (declaration for procurement above R10m), SBD 6.1/6.2 (preference points B-BBEE/local content), SBD 7.2 (contract form), SBD 8 (declaration of bidders past SCM practices), SBD 9 (certificate of independent bid determination).
  * MBD equivalents (MBD 1–9) at municipal level.
  * CIDB Standard for Uniformity forms.
  * NEC3/4 contract data part 1 (employer) and part 2 (contractor).
  * GCC 2015 contract data, JBCC Principal Building Agreement.
- Mandatory compliance returnables: SARS Tax Compliance Status PIN, CIPC CoR docs, CSD registration number (MAAA…), CIDB registration printout, B-BBEE certificate/affidavit, COIDA letter of good standing, municipal rates clearance, banking confirmation letter, audited/independently reviewed AFS, JV agreements, professional registrations (ECSA, SACPCMP, SACAP, SACQSP, SAICA), ISO certifications, safety files, public liability insurance, performance guarantees.
- Submission: SA eTender Portal (etenders.gov.za), municipal e-procurement portals, physical tender boxes with envelope labelling, courier vs hand delivery, mandatory site/compulsory briefings, clarification meetings, bid validity periods (typically 90–120 days).
- Contract forms: NEC3/NEC4 ECC/PSC/SC (Options A–F), GCC 2015, JBCC PBA 6.2, FIDIC.

CRITICAL EXTRACTION PHILOSOPHY — READ CAREFULLY:
You are NOT a summarizer. You are an exhaustive procurement document mapper. A bid manager will rely on your output to assemble a fully compliant bid. Missing a single returnable can cause disqualification.

ABSOLUTE RULES:
1. Extract EVERY procurement detail. Do not collapse, paraphrase or merge items. If the document lists 23 returnables, return 23 entries — not "various compliance documents".
2. For every table, schedule, form, BOQ, declaration, pricing matrix, evaluation matrix, signature block and addendum: record it individually with the page number it appears on.
3. Build a page_intelligence map covering EVERY page in the document — what each page contains (e.g. "page 12: SBD 4 Declaration of Interest, requires director signature").
4. For returnables, capture the verbatim "Action Required" / "Attach Copy" / "Submit With Bid" instructions where present. Each returnable must have: name, what to attach, where signed, mandatory flag, page reference.
5. For forms (MBD/SBD/CIDB/declaration), list every form found by code and title, the page, and whether signatures/witnesses are required.
6. For evaluation/scoring tables, capture full criteria, weightings, sub-criteria, thresholds, points allocations, formulas, pass/fail conditions, specific goals (B-BBEE level points), local content thresholds.
7. For clauses (conditions of tender, conditions of contract, particular conditions, special conditions), extract the full clause text or a faithful detailed paraphrase — NEVER a one-line summary.
8. For bid data (C1/C2 contract data, employer representative, bid validity, alternative bids, addenda acknowledgement), capture every named field.
9. For tables/graphs you cannot fully parse, flag the page in pages_flagged with the reason and still record the detection in detected_tables. NEVER silently drop content.
10. When extraction confidence on a page is low (scan, handwriting, faint text), still attempt extraction AND flag the page.
11. Use null only when a field is genuinely absent from the document. Do not hallucinate.
12. Output ONLY via the extract_tender tool call. Be exhaustive. Volume of detail is the goal.`;

const CREDITS_PER_ANALYSIS = 3;

const TOOL = {
  type: "function" as const,
  function: {
    name: "extract_tender",
    description: "Exhaustive procurement-grade extraction of a South African tender / contract / bid pack.",
    parameters: {
      type: "object",
      properties: {
        // ============ CORE ============
        tender_title: { type: ["string", "null"] },
        reference_number: { type: ["string", "null"], description: "Tender / RFQ / bid / contract number" },
        issuing_entity: { type: ["string", "null"], description: "Municipality, department, SOE" },
        department: { type: ["string", "null"] },
        province: { type: ["string", "null"] },
        tender_category: { type: ["string", "null"] },
        scope_of_work: { type: ["string", "null"], description: "Detailed scope (not one line — multi-paragraph)" },
        contract_duration: { type: ["string", "null"] },
        estimated_value: { type: ["string", "null"] },
        procurement_type: { type: ["string", "null"] },
        cidb_grade: { type: ["string", "null"] },
        bbbee_level: { type: ["string", "null"] },
        jv_requirements: { type: ["string", "null"] },
        subcontracting_requirements: { type: ["string", "null"] },
        professional_registrations: { type: "array", items: { type: "string" } },

        summary: { type: "string", description: "3–5 sentence executive summary for a procurement manager" },

        // ============ BID DATA / CONDITIONS OF BID ============
        bid_data: {
          type: "object",
          description: "C1 / C2 contract data, conditions of tender, employer details, validity, alternative bids",
          properties: {
            contract_form: { type: ["string", "null"], description: "NEC3 ECC Option X, GCC 2015, JBCC PBA, bespoke" },
            employer: { type: ["string", "null"] },
            employer_representative: { type: ["string", "null"] },
            employer_address: { type: ["string", "null"] },
            project_manager: { type: ["string", "null"] },
            engineer: { type: ["string", "null"] },
            bid_validity_days: { type: ["string", "null"] },
            bid_validity_expires: { type: ["string", "null"] },
            alternative_bids_allowed: { type: ["boolean", "null"] },
            alternative_bids_conditions: { type: ["string", "null"] },
            site_handover: { type: ["string", "null"] },
            commencement_date: { type: ["string", "null"] },
            completion_date: { type: ["string", "null"] },
            access_dates: { type: ["string", "null"] },
            conditions_of_tender_summary: { type: ["string", "null"], description: "CIDB Standard Conditions of Tender — key conditions" },
          },
        },

        // ============ DATES ============
        important_dates: {
          type: "array",
          items: {
            type: "object",
            properties: {
              date: { type: "string" },
              time: { type: ["string", "null"] },
              event: { type: "string" },
              mandatory: { type: ["boolean", "null"] },
              location: { type: ["string", "null"] },
            },
            required: ["date", "event"],
          },
        },
        closing_date: { type: ["string", "null"] },

        // ============ CONTACTS ============
        contacts: {
          type: "array",
          items: {
            type: "object",
            properties: {
              role: { type: ["string", "null"] },
              name: { type: ["string", "null"] },
              email: { type: ["string", "null"] },
              phone: { type: ["string", "null"] },
              cell: { type: ["string", "null"] },
              fax: { type: ["string", "null"] },
              address: { type: ["string", "null"] },
            },
          },
        },

        // ============ SUBMISSION ============
        submission_details: {
          type: "object",
          properties: {
            mode: { type: ["string", "null"] },
            portal: { type: ["string", "null"] },
            physical_address: { type: ["string", "null"] },
            tender_box: { type: ["string", "null"] },
            envelope_marking: { type: ["string", "null"] },
            copies_required: { type: ["string", "null"] },
            usb_or_cd_required: { type: ["boolean", "null"] },
            courier_allowed: { type: ["boolean", "null"] },
            late_submissions: { type: ["string", "null"] },
            step_by_step: { type: "array", items: { type: "string" } },
          },
        },

        // ============ RETURNABLES (exhaustive, one row per item) ============
        returnables: {
          type: "array",
          description: "Every single returnable schedule / mandatory document / declaration the bidder must submit. One entry per item — do not merge.",
          items: {
            type: "object",
            properties: {
              name: { type: "string", description: "Verbatim name of returnable (e.g. 'C.1.1 Form of Offer and Acceptance')" },
              category: { type: ["string", "null"], description: "Compliance / Pricing / Technical / Financial / Legal / Declaration / Form" },
              mandatory: { type: "boolean" },
              action_required: { type: ["string", "null"], description: "Verbatim action — 'Attach copy', 'Sign and submit', 'Complete and return', etc." },
              attachment_required: { type: ["string", "null"], description: "What must be attached (e.g. 'Copy of CIDB registration printout')" },
              signature_required: { type: ["boolean", "null"] },
              page_reference: { type: ["string", "null"] },
              notes: { type: ["string", "null"] },
            },
            required: ["name", "mandatory"],
          },
        },

        // ============ FORMS DETECTED (MBD/SBD/CIDB/declarations) ============
        forms_detected: {
          type: "array",
          description: "Every standardised form found — SBD 1–9, MBD 1–9, CIDB forms, declarations, JV schedules, briefing attendance, addenda acknowledgement, tax forms, signature pages, authority resolutions.",
          items: {
            type: "object",
            properties: {
              code: { type: ["string", "null"], description: "e.g. SBD 4, MBD 6.1, C.1.1" },
              title: { type: "string" },
              page: { type: ["string", "number"] },
              purpose: { type: ["string", "null"] },
              signature_required: { type: ["boolean", "null"] },
              witness_required: { type: ["boolean", "null"] },
              attachments_required: { type: "array", items: { type: "string" } },
              completion_status: { type: ["string", "null"], description: "blank / partial / pre-filled" },
            },
            required: ["title", "page"],
          },
        },

        // ============ EVALUATION ============
        evaluation_criteria: {
          type: "object",
          properties: {
            preference_system: { type: ["string", "null"] },
            functionality_threshold: { type: ["string", "null"] },
            functionality_criteria: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  criterion: { type: "string" },
                  weight: { type: ["string", "null"] },
                  minimum: { type: ["string", "null"] },
                  sub_criteria: { type: "array", items: { type: "string" } },
                },
                required: ["criterion"],
              },
            },
            price_weighting: { type: ["string", "null"] },
            bbbee_weighting: { type: ["string", "null"] },
            specific_goals: {
              type: "array",
              description: "PPPFA 2022 specific goals points (e.g. women-owned, youth, EME/QSE, designated groups)",
              items: {
                type: "object",
                properties: {
                  goal: { type: "string" },
                  points: { type: ["string", "null"] },
                  evidence_required: { type: ["string", "null"] },
                },
                required: ["goal"],
              },
            },
            local_content: { type: ["string", "null"] },
            pass_fail_requirements: { type: "array", items: { type: "string" } },
            methodology: { type: ["string", "null"] },
            scoring_formula: { type: ["string", "null"] },
          },
        },

        // Full scoring tables verbatim
        scoring_tables: {
          type: "array",
          description: "Every evaluation / functionality / scoring matrix found in the document — captured row by row.",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              page: { type: ["string", "number"] },
              type: { type: ["string", "null"], description: "Functionality / PPPFA / Specific Goals / Local Content / Technical" },
              columns: { type: "array", items: { type: "string" } },
              rows: {
                type: "array",
                items: { type: "array", items: { type: ["string", "null"] } },
              },
              notes: { type: ["string", "null"] },
            },
            required: ["title", "page"],
          },
        },

        compliance_requirements: { type: "array", items: { type: "string" } },

        // ============ CLAUSES (detailed, not summarised) ============
        key_clauses: {
          type: "array",
          description: "Full clauses from conditions of tender, conditions of contract, particular conditions, special conditions. Extract detail — never one-liners.",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              category: { type: ["string", "null"], description: "Conditions of Tender / General Conditions / Particular Conditions / Special Conditions / Insurance / Penalties" },
              detail: { type: "string", description: "Full clause text or detailed paraphrase — at least 2–4 sentences" },
              page_reference: { type: ["string", "null"] },
            },
            required: ["title", "detail"],
          },
        },

        // ============ RISKS ============
        risks: {
          type: "array",
          items: {
            type: "object",
            properties: {
              severity: { type: "string", enum: ["low", "medium", "high"] },
              category: { type: ["string", "null"] },
              description: { type: "string" },
              mitigation: { type: ["string", "null"] },
            },
            required: ["severity", "description"],
          },
        },

        // ============ TABLES / GRAPHS ============
        detected_tables: {
          type: "array",
          items: {
            type: "object",
            properties: {
              page: { type: ["string", "number"] },
              type: { type: "string", description: "table / graph / chart / BOQ / pricing schedule / evaluation matrix / technical drawing / schedule / matrix" },
              title: { type: ["string", "null"] },
              summary: { type: ["string", "null"] },
              needs_manual_review: { type: ["boolean", "null"] },
            },
            required: ["page", "type"],
          },
        },

        // ============ PRICING SCHEDULES ============
        pricing_schedules: {
          type: "array",
          description: "BOQs / pricing schedules / activity schedules — structure only (not full prices).",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              page: { type: ["string", "number"] },
              type: { type: ["string", "null"], description: "BOQ / Activity Schedule / Schedule of Rates / Lump Sum" },
              sections: { type: "array", items: { type: "string" }, description: "Section/chapter headings of the schedule" },
              line_item_count: { type: ["string", "number", "null"] },
              total_estimated: { type: ["string", "null"] },
            },
            required: ["title", "page"],
          },
        },

        // ============ SIGNATURE BLOCKS ============
        signature_blocks: {
          type: "array",
          description: "Every signature / witness / official-capacity block found.",
          items: {
            type: "object",
            properties: {
              page: { type: ["string", "number"] },
              form_or_section: { type: "string" },
              signatory_role: { type: ["string", "null"], description: "Bidder / Director / Witness / Commissioner of Oaths" },
              witness_required: { type: ["boolean", "null"] },
              commissioner_required: { type: ["boolean", "null"] },
            },
            required: ["page", "form_or_section"],
          },
        },

        // ============ ADDENDA ============
        addenda: {
          type: "array",
          description: "Addenda issued, addenda acknowledgement forms, briefing minutes, clarifications.",
          items: {
            type: "object",
            properties: {
              number: { type: ["string", "null"] },
              title: { type: "string" },
              date: { type: ["string", "null"] },
              page: { type: ["string", "number", "null"] },
              acknowledgement_required: { type: ["boolean", "null"] },
            },
            required: ["title"],
          },
        },

        // ============ CONTRACT INTELLIGENCE ============
        contract_intelligence: {
          type: "object",
          properties: {
            contract_form: { type: ["string", "null"] },
            sla: { type: ["string", "null"] },
            penalties: { type: ["string", "null"] },
            retention: { type: ["string", "null"] },
            warranties: { type: ["string", "null"] },
            guarantees: { type: ["string", "null"] },
            payment_terms: { type: ["string", "null"] },
            escalation: { type: ["string", "null"] },
            liability: { type: ["string", "null"] },
            insurance: { type: ["string", "null"] },
            subcontracting: { type: ["string", "null"] },
            cancellation: { type: ["string", "null"] },
            dispute_resolution: { type: ["string", "null"] },
            variations: { type: ["string", "null"] },
            defects_liability: { type: ["string", "null"] },
          },
        },

        // ============ PAGE-LEVEL INTELLIGENCE ============
        page_intelligence: {
          type: "array",
          description: "Cover EVERY page in the document. One entry per page describing what it contains. Mandatory for procurement traceability.",
          items: {
            type: "object",
            properties: {
              page: { type: ["string", "number"] },
              section: { type: ["string", "null"], description: "T1 / T2 / C1 / C2 / C3 / C4 etc." },
              contents: { type: "string", description: "What is on this page — form code, schedule, clause, table, signature block, drawing" },
              requires_action: { type: ["boolean", "null"] },
              notes: { type: ["string", "null"] },
            },
            required: ["page", "contents"],
          },
        },

        // ============ QUALITY FLAGS ============
        pages_flagged: {
          type: "array",
          items: {
            type: "object",
            properties: {
              page: { type: ["string", "number"] },
              reason: { type: "string" },
            },
            required: ["page", "reason"],
          },
        },

        confidence_score: { type: "number" },
        readiness_score: { type: "number" },
      },
      required: [
        "summary",
        "compliance_requirements",
        "key_clauses",
        "risks",
        "important_dates",
        "contacts",
        "submission_details",
        "returnables",
        "forms_detected",
        "evaluation_criteria",
        "scoring_tables",
        "detected_tables",
        "pricing_schedules",
        "signature_blocks",
        "addenda",
        "contract_intelligence",
        "page_intelligence",
        "bid_data",
        "pages_flagged",
        "confidence_score",
        "readiness_score",
      ],
      additionalProperties: false,
    },
  },
};

export const analyzeDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { documentId: string }) =>
    z.object({ documentId: z.string().uuid() }).parse(input)
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("AI service is not configured. Please contact support.");

    const { data: doc, error: docErr } = await supabaseAdmin
      .from("documents").select("*").eq("id", data.documentId).maybeSingle();
    if (docErr) throw new Error("Could not load document");
    if (!doc) throw new Error("Document not found");
    if (doc.user_id !== userId) throw new Error("Forbidden");

    const { data: existing } = await supabaseAdmin
      .from("tender_analyses").select("id").eq("document_id", doc.id).maybeSingle();
    if (existing) {
      return { success: true, documentId: doc.id, alreadyAnalysed: true };
    }

    if (doc.status === "processing") {
      throw new Error("This document is already being analysed. Please wait a moment.");
    }

    const { data: reserved, error: reserveErr } = await supabaseAdmin
      .rpc("reserve_credits", { _user_id: userId, _amount: CREDITS_PER_ANALYSIS });
    if (reserveErr) throw new Error("Could not reserve credits");
    if (!reserved) {
      throw new Error(`Insufficient credits. ${CREDITS_PER_ANALYSIS} credits required per analysis. Please upgrade your plan.`);
    }

    let creditsRefunded = false;
    const refund = async () => {
      if (creditsRefunded) return;
      creditsRefunded = true;
      await supabaseAdmin.rpc("refund_credits", { _user_id: userId, _amount: CREDITS_PER_ANALYSIS });
    };

    await supabaseAdmin.from("documents").update({ status: "processing", error_message: null }).eq("id", doc.id);

    try {
      const { data: signed, error: sErr } = await supabaseAdmin.storage
        .from("documents").createSignedUrl(doc.file_path, 600);
      if (sErr || !signed) throw new Error("Could not access uploaded file");

      const fileRes = await fetch(signed.signedUrl);
      if (!fileRes.ok) throw new Error("Failed to download file for analysis");
      const buf = await fileRes.arrayBuffer();

      if (buf.byteLength > 25 * 1024 * 1024) {
        throw new Error("File too large for analysis (max 20MB)");
      }
      const base64 = Buffer.from(buf).toString("base64");
      const mimeType = doc.mime_type || "application/pdf";

      const USER_INSTRUCTION = `Analyse this South African procurement document EXHAUSTIVELY end-to-end. File: ${doc.file_name}.

You MUST:
- Walk through EVERY page and populate page_intelligence with one entry per page.
- Identify EVERY MBD/SBD/CIDB/C.1.x/C.2.x/T-series form and add to forms_detected (with page, code, signature requirements, attachments).
- Build an exhaustive returnables checklist — one entry per item — capturing the verbatim Action Required / Attach Copy / Signature instruction. If the document's returnables schedule has 30 rows, return 30 entries.
- Extract every evaluation / functionality / PPPFA / specific goals / local content scoring matrix verbatim into scoring_tables (columns + rows).
- Capture bid_data (C1/C2 contract data: employer, representative, project manager, bid validity, alternative bids, commencement).
- Extract key_clauses with DETAILED clause text (not one-line summaries) covering conditions of tender, general conditions, particular conditions, special conditions.
- Detect every table, graph, BOQ, pricing schedule, signature block, addendum — with the page.
- Apply OCR reasoning on scanned pages. If a page is unreadable or a table cannot be parsed, still record the detection in detected_tables AND flag the page in pages_flagged with the reason. NEVER silently drop content.
- Use null only when truly absent. Do NOT collapse multiple items into vague summaries. Volume of structured detail is the success criterion.`;

      const callAi = async (): Promise<Response> => {
        const ctrl = new AbortController();
        const timeout = setTimeout(() => ctrl.abort(), 300_000);
        try {
          return await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            signal: ctrl.signal,
            headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              model: "google/gemini-2.5-pro",
              messages: [
                { role: "system", content: SYSTEM_PROMPT },
                {
                  role: "user",
                  content: [
                    { type: "text", text: USER_INSTRUCTION },
                    { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64}` } },
                  ],
                },
              ],
              tools: [TOOL],
              tool_choice: { type: "function", function: { name: "extract_tender" } },
            }),
          });
        } finally {
          clearTimeout(timeout);
        }
      };

      let aiRes: Response;
      try {
        aiRes = await callAi();
        if (!aiRes.ok && aiRes.status >= 500) {
          await new Promise((r) => setTimeout(r, 1500));
          aiRes = await callAi();
        }
      } catch (e) {
        if (e instanceof Error && e.name === "AbortError") {
          throw new Error("Analysis timed out. The document may be very large — try a smaller file or split it.");
        }
        throw new Error("Could not reach the AI service. Please try again.");
      }

      if (!aiRes.ok) {
        const txt = await aiRes.text().catch(() => "");
        if (aiRes.status === 429) throw new Error("AI service is busy — please try again in a minute.");
        if (aiRes.status === 402) throw new Error("AI service credits exhausted. Please contact support.");
        throw new Error(`AI service error (${aiRes.status}). ${txt.slice(0, 200)}`);
      }

      const payload = await aiRes.json().catch(() => null);
      const toolCall = payload?.choices?.[0]?.message?.tool_calls?.[0];
      if (!toolCall?.function?.arguments) {
        throw new Error("AI did not return structured output. The document may be unreadable.");
      }

      let extracted: any;
      try {
        extracted = JSON.parse(toolCall.function.arguments);
      } catch {
        throw new Error("AI returned malformed output. Please try again.");
      }

      const firstContact = Array.isArray(extracted.contacts) && extracted.contacts.length > 0 ? extracted.contacts[0] : {};

      const { error: insErr } = await supabaseAdmin.from("tender_analyses").insert({
        document_id: doc.id,
        user_id: userId,
        summary: extracted.summary ?? null,
        tender_title: extracted.tender_title ?? null,
        reference_number: extracted.reference_number ?? null,
        issuing_entity: extracted.issuing_entity ?? null,
        department: extracted.department ?? null,
        province: extracted.province ?? null,
        tender_category: extracted.tender_category ?? null,
        closing_date: extracted.closing_date ?? null,
        estimated_value: extracted.estimated_value ?? null,
        contract_duration: extracted.contract_duration ?? null,
        procurement_type: extracted.procurement_type ?? null,
        cidb_grade: extracted.cidb_grade ?? null,
        bbbee_level: extracted.bbbee_level ?? null,
        jv_requirements: extracted.jv_requirements ?? null,
        subcontracting_requirements: extracted.subcontracting_requirements ?? null,
        professional_registrations: extracted.professional_registrations ?? [],
        scope_of_work: extracted.scope_of_work ?? null,
        compliance_requirements: extracted.compliance_requirements ?? [],
        key_clauses: extracted.key_clauses ?? [],
        risks: extracted.risks ?? [],
        important_dates: extracted.important_dates ?? [],
        contact_info: {
          name: firstContact.name ?? null,
          email: firstContact.email ?? null,
          phone: firstContact.phone ?? null,
          all: extracted.contacts ?? [],
        },
        submission_details: extracted.submission_details ?? {},
        returnables: extracted.returnables ?? [],
        forms_detected: extracted.forms_detected ?? [],
        evaluation_criteria: extracted.evaluation_criteria ?? {},
        scoring_tables: extracted.scoring_tables ?? [],
        detected_tables: extracted.detected_tables ?? [],
        pricing_schedules: extracted.pricing_schedules ?? [],
        signature_blocks: extracted.signature_blocks ?? [],
        addenda: extracted.addenda ?? [],
        contract_intelligence: extracted.contract_intelligence ?? {},
        page_intelligence: extracted.page_intelligence ?? [],
        bid_data: extracted.bid_data ?? {},
        pages_flagged: extracted.pages_flagged ?? [],
        confidence_score: extracted.confidence_score ?? null,
        readiness_score: extracted.readiness_score ?? null,
        raw_response: extracted,
      });

      if (insErr) {
        if (insErr.code === "23505") {
          await refund();
          await supabaseAdmin.from("documents").update({ status: "completed" }).eq("id", doc.id);
          return { success: true, documentId: doc.id, alreadyAnalysed: true };
        }
        throw new Error("Could not save analysis results");
      }

      await supabaseAdmin.from("documents")
        .update({ status: "completed", credits_used: CREDITS_PER_ANALYSIS, error_message: null })
        .eq("id", doc.id);

      return { success: true, documentId: doc.id };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      await refund();
      await supabaseAdmin.from("documents")
        .update({ status: "failed", error_message: message })
        .eq("id", doc.id);
      throw new Error(message);
    }
  });
