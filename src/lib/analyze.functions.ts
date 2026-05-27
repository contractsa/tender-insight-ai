import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const SYSTEM_PROMPT = `You are an elite South African procurement intelligence analyst. You analyse government tenders, RFQs, RFPs, bid packs, BOQs, returnable schedules, addenda, technical specifications, appointment letters, and NEC3/GCC2015/JBCC contracts from the SA eTender Portal, CIDB, municipalities, provincial and national departments, and SOEs (Eskom, Transnet, PRASA, SAA, Denel, Sasol, Sanral, Rand Water, Telkom).

Deep domain knowledge you MUST apply:
- Regulatory frameworks: PPPFA (80/20 and 90/10 preference point systems), PFMA, MFMA, BBBEE Act, Construction Industry Development Board Act, OHS Act, COIDA, B-BBEE Codes of Good Practice.
- CIDB grading: levels 1–9, classes (CE civil, GB general building, EB electrical, ME mechanical, SW specialist works, etc.) plus PE/SE (potentially emerging / contractor development).
- B-BBEE: Levels 1–8, generic vs QSE vs EME, sworn affidavits vs SANAS certificates.
- Standard SA forms: SBD 1, SBD 3.1/3.2/3.3, SBD 4 (declaration of interest), SBD 6.1/6.2 (preference points), SBD 8 (declaration of past SCM practices), SBD 9 (certificate of independent bid determination), MBD equivalents at municipal level.
- Mandatory compliance returnables: SARS Tax Compliance Status PIN, CIPC registration (CoR docs), CSD registration number, CIDB registration printout, B-BBEE certificate/affidavit, letter of good standing (COIDA / Department of Employment & Labour), municipal rates clearance, banking confirmation letter, audited/independently reviewed financial statements, JV agreements, professional registrations (ECSA, SACPCMP, SACAP, SACQSP, SAICA), ISO certifications, safety files, public liability insurance, performance guarantees.
- Submission modalities: SA eTender Portal (etenders.gov.za), municipal e-procurement portals, physical tender boxes with envelope labelling, hand delivery vs courier, mandatory site/compulsory briefings, clarification meetings.
- Contract forms: NEC3/NEC4 ECC/PSC/SC (Options A–F), GCC 2015, JBCC PBA 6.2, FIDIC variants.

YOUR JOB:
1. Extract EVERY meaningful procurement detail from the document, no matter how long (1–200+ pages, scanned, mixed quality).
2. Read scanned pages, stamps, signatures, handwritten notes, tables, BOQs, pricing schedules, technical drawings as best you can.
3. When a field is genuinely not present, use null — do NOT hallucinate.
4. When extraction confidence is low for a page or section, list it in pages_flagged with a reason instead of silently dropping content.
5. Detect every table, schedule, graph, pricing matrix, BOQ and evaluation matrix — record the page number, type, title and a short summary.
6. Build a returnables checklist of EVERY document the bidder must submit, flagged mandatory vs optional, with the page it was referenced on.
7. Identify disqualification risks proactively: missing mandatory docs, unsigned forms, contradictory instructions, mandatory briefings.
8. Compute a readiness_score (0–100) reflecting how submission-ready a well-prepared SA contractor would be based on document complexity and number of returnables.
9. Be exhaustive, structured, and procurement-professional. Output ONLY via the extract_tender tool call.`;

const CREDITS_PER_ANALYSIS = 3;

const TOOL = {
  type: "function" as const,
  function: {
    name: "extract_tender",
    description: "Exhaustive structured extraction of a South African procurement document.",
    parameters: {
      type: "object",
      properties: {
        // Core
        tender_title: { type: ["string", "null"] },
        reference_number: { type: ["string", "null"], description: "Tender / RFQ / bid / contract number" },
        issuing_entity: { type: ["string", "null"], description: "Municipality, department, SOE" },
        department: { type: ["string", "null"] },
        province: { type: ["string", "null"] },
        tender_category: { type: ["string", "null"], description: "e.g. Construction, Goods, Services, Professional Services, ICT" },
        scope_of_work: { type: ["string", "null"] },
        contract_duration: { type: ["string", "null"] },
        estimated_value: { type: ["string", "null"], description: "Quoted budget or estimated value in ZAR if stated" },
        procurement_type: { type: ["string", "null"], description: "Open tender, closed bid, framework agreement, panel, RFQ, RFP" },
        cidb_grade: { type: ["string", "null"], description: "e.g. 5CE PE, 7GB" },
        bbbee_level: { type: ["string", "null"], description: "Required B-BBEE level if specified" },
        jv_requirements: { type: ["string", "null"] },
        subcontracting_requirements: { type: ["string", "null"], description: "Mandatory subcontracting to EMEs/QSEs/designated groups" },
        professional_registrations: {
          type: "array",
          items: { type: "string" },
          description: "ECSA, SACPCMP, SACQSP etc."
        },

        summary: { type: "string", description: "3–5 sentence executive summary for a procurement manager" },

        // Dates
        important_dates: {
          type: "array",
          items: {
            type: "object",
            properties: {
              date: { type: "string" },
              time: { type: ["string", "null"] },
              event: { type: "string", description: "Closing, site briefing, clarification deadline, commencement, validity expiry" },
              mandatory: { type: ["boolean", "null"] },
              location: { type: ["string", "null"] },
            },
            required: ["date", "event"],
          },
        },
        closing_date: { type: ["string", "null"] },

        // Contacts
        contacts: {
          type: "array",
          items: {
            type: "object",
            properties: {
              role: { type: ["string", "null"], description: "SCM / technical / enquiries" },
              name: { type: ["string", "null"] },
              email: { type: ["string", "null"] },
              phone: { type: ["string", "null"] },
              cell: { type: ["string", "null"] },
              fax: { type: ["string", "null"] },
              address: { type: ["string", "null"] },
            },
          },
        },

        // Submission
        submission_details: {
          type: "object",
          properties: {
            mode: { type: ["string", "null"], description: "Physical / eTender Portal / email / hybrid" },
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

        // Returnables checklist
        returnables: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              category: { type: ["string", "null"], description: "Compliance / Pricing / Technical / Financial / Legal" },
              mandatory: { type: "boolean" },
              page_reference: { type: ["string", "null"] },
              notes: { type: ["string", "null"] },
            },
            required: ["name", "mandatory"],
          },
        },

        // Evaluation
        evaluation_criteria: {
          type: "object",
          properties: {
            preference_system: { type: ["string", "null"], description: "80/20 or 90/10 or other" },
            functionality_threshold: { type: ["string", "null"] },
            functionality_criteria: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  criterion: { type: "string" },
                  weight: { type: ["string", "null"] },
                  minimum: { type: ["string", "null"] },
                },
                required: ["criterion"],
              },
            },
            price_weighting: { type: ["string", "null"] },
            bbbee_weighting: { type: ["string", "null"] },
            local_content: { type: ["string", "null"] },
            pass_fail_requirements: { type: "array", items: { type: "string" } },
            methodology: { type: ["string", "null"] },
          },
        },

        compliance_requirements: { type: "array", items: { type: "string" } },

        // Clauses
        key_clauses: {
          type: "array",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              detail: { type: "string" },
              page_reference: { type: ["string", "null"] },
            },
            required: ["title", "detail"],
          },
        },

        // Risks
        risks: {
          type: "array",
          items: {
            type: "object",
            properties: {
              severity: { type: "string", enum: ["low", "medium", "high"] },
              category: { type: ["string", "null"], description: "Disqualification / Compliance / Commercial / Technical / Deadline" },
              description: { type: "string" },
            },
            required: ["severity", "description"],
          },
        },

        // Detected tables / graphs
        detected_tables: {
          type: "array",
          items: {
            type: "object",
            properties: {
              page: { type: ["string", "number"] },
              type: { type: "string", description: "table / graph / chart / BOQ / pricing schedule / evaluation matrix / technical drawing" },
              title: { type: ["string", "null"] },
              summary: { type: ["string", "null"] },
            },
            required: ["page", "type"],
          },
        },

        // Contract intelligence
        contract_intelligence: {
          type: "object",
          properties: {
            contract_form: { type: ["string", "null"], description: "NEC3, GCC 2015, JBCC, bespoke" },
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
          },
        },

        // Quality flags
        pages_flagged: {
          type: "array",
          items: {
            type: "object",
            properties: {
              page: { type: ["string", "number"] },
              reason: { type: "string", description: "Why this page needs manual review (poor scan, partial signature, unreadable table, etc.)" },
            },
            required: ["page", "reason"],
          },
        },

        confidence_score: { type: "number", description: "Overall extraction confidence 0–100" },
        readiness_score: { type: "number", description: "0–100 how submission-ready a typical SA contractor would be" },
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
        "evaluation_criteria",
        "detected_tables",
        "contract_intelligence",
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

      // Call AI gateway with retry on transient failure
      const callAi = async (): Promise<Response> => {
        const ctrl = new AbortController();
        const timeout = setTimeout(() => ctrl.abort(), 180_000);
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
                    {
                      type: "text",
                      text: `Analyse this South African procurement document end-to-end. File: ${doc.file_name}.
Extract every field exhaustively. Apply OCR reasoning to any scanned pages. Detect every table, BOQ, schedule, pricing matrix and evaluation matrix with the page they appear on. Build a complete returnables checklist (mandatory vs optional). Identify disqualification risks proactively. Flag any pages where extraction quality is uncertain in pages_flagged. Be exhaustive — do not omit content.`,
                    },
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
          // one retry on transient server error
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

      // Map contacts -> contact_info (keep first contact for legacy field)
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
        evaluation_criteria: extracted.evaluation_criteria ?? {},
        detected_tables: extracted.detected_tables ?? [],
        contract_intelligence: extracted.contract_intelligence ?? {},
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
