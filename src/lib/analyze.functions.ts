import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const SYSTEM_PROMPT = `You are a specialist AI for analysing South African procurement documents (government tenders, municipal RFQs, NEC contracts, PRASA/Transnet/Eskom, B-BBEE certs, SBD forms). Extract structured fields with SA regulatory context (CIDB grades, B-BBEE levels, PPPFA, PFMA, NEC clauses). Return ONLY valid JSON via the tool call. Use null for unknown fields. Be concise.`;

const CREDITS_PER_ANALYSIS = 3;

const TOOL = {
  type: "function" as const,
  function: {
    name: "extract_tender",
    description: "Extract structured tender/contract intelligence.",
    parameters: {
      type: "object",
      properties: {
        summary: { type: "string", description: "2-3 sentence executive summary" },
        reference_number: { type: ["string", "null"] },
        issuing_entity: { type: ["string", "null"], description: "Department/municipality/SOE" },
        closing_date: { type: ["string", "null"] },
        estimated_value: { type: ["string", "null"] },
        cidb_grade: { type: ["string", "null"], description: "e.g. 5CE, 7GB" },
        bbbee_level: { type: ["string", "null"] },
        scope_of_work: { type: ["string", "null"] },
        compliance_requirements: { type: "array", items: { type: "string" } },
        key_clauses: { type: "array", items: { type: "object", properties: { title: { type: "string" }, detail: { type: "string" } }, required: ["title", "detail"] } },
        risks: { type: "array", items: { type: "object", properties: { severity: { type: "string", enum: ["low", "medium", "high"] }, description: { type: "string" } }, required: ["severity", "description"] } },
        important_dates: { type: "array", items: { type: "object", properties: { date: { type: "string" }, event: { type: "string" } }, required: ["date", "event"] } },
        contact_info: { type: "object", properties: { name: { type: ["string", "null"] }, email: { type: ["string", "null"] }, phone: { type: ["string", "null"] } } },
        confidence_score: { type: "number", description: "0-100" },
      },
      required: ["summary", "compliance_requirements", "key_clauses", "risks", "important_dates", "contact_info", "confidence_score"],
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

    // 1. Load document via admin (we already verify ownership below)
    const { data: doc, error: docErr } = await supabaseAdmin
      .from("documents").select("*").eq("id", data.documentId).maybeSingle();
    if (docErr) throw new Error("Could not load document");
    if (!doc) throw new Error("Document not found");
    if (doc.user_id !== userId) throw new Error("Forbidden");

    // 2. Idempotency: existing completed analysis?
    const { data: existing } = await supabaseAdmin
      .from("tender_analyses").select("id").eq("document_id", doc.id).maybeSingle();
    if (existing) {
      return { success: true, documentId: doc.id, alreadyAnalysed: true };
    }

    // 3. Status guard: never re-enter processing
    if (doc.status === "processing") {
      throw new Error("This document is already being analysed. Please wait a moment.");
    }

    // 4. Atomic credit reservation BEFORE any AI work
    const { data: reserved, error: reserveErr } = await supabaseAdmin
      .rpc("reserve_credits", { _user_id: userId, _amount: CREDITS_PER_ANALYSIS });
    if (reserveErr) throw new Error("Could not reserve credits");
    if (!reserved) {
      throw new Error(`Insufficient credits. ${CREDITS_PER_ANALYSIS} credits required per analysis. Please upgrade your plan.`);
    }

    // From here on, any failure MUST refund credits.
    let creditsRefunded = false;
    const refund = async () => {
      if (creditsRefunded) return;
      creditsRefunded = true;
      await supabaseAdmin.rpc("refund_credits", { _user_id: userId, _amount: CREDITS_PER_ANALYSIS });
    };

    // 5. Mark processing
    await supabaseAdmin.from("documents").update({ status: "processing", error_message: null }).eq("id", doc.id);

    try {
      // 6. Signed URL + fetch file
      const { data: signed, error: sErr } = await supabaseAdmin.storage
        .from("documents").createSignedUrl(doc.file_path, 600);
      if (sErr || !signed) throw new Error("Could not access uploaded file");

      const fileRes = await fetch(signed.signedUrl);
      if (!fileRes.ok) throw new Error("Failed to download file for analysis");
      const buf = await fileRes.arrayBuffer();

      // Safety: cap base64 payload (~20MB raw → ~27MB base64)
      if (buf.byteLength > 25 * 1024 * 1024) {
        throw new Error("File too large for analysis (max 20MB)");
      }
      const base64 = Buffer.from(buf).toString("base64");
      const mimeType = doc.mime_type || "application/pdf";

      // 7. Call AI gateway with 90s timeout
      const ctrl = new AbortController();
      const timeout = setTimeout(() => ctrl.abort(), 90_000);
      let aiRes: Response;
      try {
        aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
                  { type: "text", text: `Analyse this SA procurement document (${doc.file_name}). Extract every field accurately.` },
                  { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64}` } },
                ],
              },
            ],
            tools: [TOOL],
            tool_choice: { type: "function", function: { name: "extract_tender" } },
          }),
        });
      } catch (e) {
        if (e instanceof Error && e.name === "AbortError") {
          throw new Error("Analysis timed out after 90s. The document may be too complex — try a smaller file.");
        }
        throw new Error("Could not reach the AI service. Please try again.");
      } finally {
        clearTimeout(timeout);
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

      // 8. Insert analysis (unique constraint on document_id guarantees single row)
      const { error: insErr } = await supabaseAdmin.from("tender_analyses").insert({
        document_id: doc.id,
        user_id: userId,
        summary: extracted.summary ?? null,
        reference_number: extracted.reference_number ?? null,
        issuing_entity: extracted.issuing_entity ?? null,
        closing_date: extracted.closing_date ?? null,
        estimated_value: extracted.estimated_value ?? null,
        cidb_grade: extracted.cidb_grade ?? null,
        bbbee_level: extracted.bbbee_level ?? null,
        scope_of_work: extracted.scope_of_work ?? null,
        compliance_requirements: extracted.compliance_requirements ?? [],
        key_clauses: extracted.key_clauses ?? [],
        risks: extracted.risks ?? [],
        important_dates: extracted.important_dates ?? [],
        contact_info: extracted.contact_info ?? {},
        confidence_score: extracted.confidence_score ?? null,
        raw_response: extracted,
      });

      if (insErr) {
        // Unique-constraint conflict = another concurrent analysis already saved.
        // Treat as success and refund our reservation so we don't double-charge.
        if (insErr.code === "23505") {
          await refund();
          await supabaseAdmin.from("documents")
            .update({ status: "completed" }).eq("id", doc.id);
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
