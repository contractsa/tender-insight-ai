import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const SYSTEM_PROMPT = `You are a specialist AI for analysing South African procurement documents (government tenders, municipal RFQs, NEC contracts, PRASA/Transnet/Eskom, B-BBEE certs, SBD forms). Extract structured fields with SA regulatory context (CIDB grades, B-BBEE levels, PPPFA, PFMA, NEC clauses). Return ONLY valid JSON. Use null for unknown fields. Be concise.`;

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
    const { supabase, userId } = context;
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("AI gateway not configured");

    // Load document (RLS scoped to user)
    const { data: doc, error: docErr } = await supabase
      .from("documents").select("*").eq("id", data.documentId).single();
    if (docErr || !doc) throw new Error("Document not found");
    if (doc.user_id !== userId) throw new Error("Forbidden");

    // Mark processing
    await supabase.from("documents").update({ status: "processing" }).eq("id", doc.id);

    try {
      // Get signed URL (admin can read)
      const { data: signed, error: sErr } = await supabaseAdmin.storage
        .from("documents").createSignedUrl(doc.file_path, 600);
      if (sErr || !signed) throw new Error("Could not access file");

      // Fetch file as base64 for vision
      const fileRes = await fetch(signed.signedUrl);
      const buf = await fileRes.arrayBuffer();
      const base64 = Buffer.from(buf).toString("base64");
      const mimeType = doc.mime_type || "application/pdf";

      const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
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

      if (!aiRes.ok) {
        const txt = await aiRes.text();
        if (aiRes.status === 429) throw new Error("Rate limit — please try again in a minute");
        if (aiRes.status === 402) throw new Error("AI credits exhausted — contact support");
        throw new Error(`AI error: ${aiRes.status} ${txt.slice(0, 200)}`);
      }

      const payload = await aiRes.json();
      const toolCall = payload.choices?.[0]?.message?.tool_calls?.[0];
      if (!toolCall) throw new Error("AI did not return structured output");
      const extracted = JSON.parse(toolCall.function.arguments);

      const creditsUsed = 3;

      // Insert analysis + update doc + deduct credits in parallel
      await supabase.from("tender_analyses").insert({
        document_id: doc.id,
        user_id: userId,
        summary: extracted.summary,
        reference_number: extracted.reference_number,
        issuing_entity: extracted.issuing_entity,
        closing_date: extracted.closing_date,
        estimated_value: extracted.estimated_value,
        cidb_grade: extracted.cidb_grade,
        bbbee_level: extracted.bbbee_level,
        scope_of_work: extracted.scope_of_work,
        compliance_requirements: extracted.compliance_requirements ?? [],
        key_clauses: extracted.key_clauses ?? [],
        risks: extracted.risks ?? [],
        important_dates: extracted.important_dates ?? [],
        contact_info: extracted.contact_info ?? {},
        confidence_score: extracted.confidence_score ?? null,
        raw_response: extracted,
      });

      await supabase.from("documents")
        .update({ status: "completed", credits_used: creditsUsed })
        .eq("id", doc.id);

      // Deduct credits via admin (RLS-safe)
      const { data: prof } = await supabaseAdmin.from("profiles")
        .select("credits_remaining").eq("user_id", userId).single();
      if (prof) {
        await supabaseAdmin.from("profiles")
          .update({ credits_remaining: Math.max(0, (prof.credits_remaining ?? 0) - creditsUsed) })
          .eq("user_id", userId);
      }

      return { success: true, documentId: doc.id };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      await supabase.from("documents")
        .update({ status: "failed", error_message: message })
        .eq("id", doc.id);
      throw new Error(message);
    }
  });
