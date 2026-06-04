// Pure eligibility comparison engine — compares master_result vs company_profiles
export type RiskLevel = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";
export type GapRow = {
  requirement: string;
  tender_requires: string;
  your_company_has: string;
  gap: string;
  risk: RiskLevel;
  page_reference: number | string | null;
  recommended_action: string;
};

const CIDB_DESIGNATIONS = ["GB", "CE", "SB", "ME", "EE", "EP", "SI", "WR", "SW"];

function parseCidb(g?: string | null): { grade: number; designation: string } | null {
  if (!g) return null;
  const m = String(g).toUpperCase().match(/(\d+)\s*([A-Z]{2})/);
  if (!m) return null;
  return { grade: parseInt(m[1], 10), designation: m[2] };
}

function bbeePointsFor(level: number | null, split: "90/10" | "80/20"): number {
  if (level == null || isNaN(level)) return 0;
  // SA standard preference points table
  const table9010: Record<number, number> = { 1: 10, 2: 9, 3: 6, 4: 5, 5: 4, 6: 3, 7: 2, 8: 1 };
  const table8020: Record<number, number> = { 1: 20, 2: 18, 3: 14, 4: 12, 5: 8, 6: 6, 7: 4, 8: 2 };
  const t = split === "80/20" ? table8020 : table9010;
  return t[level] ?? 0;
}

export type EligibilityReport = {
  overall: "ELIGIBLE" | "CONDITIONAL" | "NOT_ELIGIBLE";
  gaps: GapRow[];
  bbbee_table: { level: string; points: number; yours: boolean }[];
  bbbee_split: "90/10" | "80/20" | "unknown";
  bbbee_points_scored: number;
  bbbee_points_max: number;
  recommendations: { title: string; body: string; risk: RiskLevel }[];
  counts: { critical: number; high: number; medium: number; low: number };
};

export function runEligibility(master: any, profile: any): EligibilityReport {
  const gaps: GapRow[] = [];
  const reg = master?.submission?.regulatory_requirements ?? {};
  const ev = master?.evaluation?.evaluation_methodology ?? {};

  // CIDB
  const tenderCidbStr = reg?.CIDB?.minimum_grade ?? null;
  const tenderDesignation = reg?.CIDB?.designation ?? null;
  if (tenderCidbStr) {
    const tCidb = parseCidb(tenderCidbStr);
    const cCidb = parseCidb(profile?.cidb_grade);
    if (!cCidb) {
      gaps.push({
        requirement: "CIDB grade",
        tender_requires: tenderCidbStr,
        your_company_has: profile?.cidb_grade || "Not provided",
        gap: "Your CIDB grade is not on file",
        risk: "CRITICAL",
        page_reference: reg?.CIDB?.page_reference ?? null,
        recommended_action: "Add your CIDB registration to your Company Profile.",
      });
    } else if (tCidb) {
      const designation = profile?.cidb_designation || cCidb.designation;
      const reqDesignation = tenderDesignation || tCidb.designation;
      if (cCidb.grade < tCidb.grade) {
        gaps.push({
          requirement: "CIDB grade",
          tender_requires: `${tCidb.grade}${reqDesignation}`,
          your_company_has: `${cCidb.grade}${designation}`,
          gap: `${tCidb.grade - cCidb.grade} grade${tCidb.grade - cCidb.grade > 1 ? "s" : ""} below`,
          risk: "CRITICAL",
          page_reference: reg?.CIDB?.page_reference ?? null,
          recommended_action: "Upgrade your CIDB grade or partner via JV with a higher-graded firm.",
        });
      }
      if (reqDesignation && designation && designation.toUpperCase() !== reqDesignation.toUpperCase() && CIDB_DESIGNATIONS.includes(reqDesignation.toUpperCase())) {
        gaps.push({
          requirement: "CIDB designation",
          tender_requires: reqDesignation,
          your_company_has: designation,
          gap: "Wrong designation",
          risk: "CRITICAL",
          page_reference: reg?.CIDB?.page_reference ?? null,
          recommended_action: `Tender requires ${reqDesignation} designation — partner with a firm that holds it.`,
        });
      }
    }
  }

  // B-BBEE
  const splitRaw = String(reg?.PPPFA_split ?? ev?.stage_3_price_and_preference?.pppfa_split ?? "").trim();
  const split: "90/10" | "80/20" | "unknown" =
    splitRaw.includes("80") ? "80/20" : splitRaw.includes("90") ? "90/10" : "unknown";
  const myLevelRaw = profile?.bbbee_level ?? null;
  const myLevel = myLevelRaw ? parseInt(String(myLevelRaw).match(/\d+/)?.[0] ?? "0", 10) : null;
  const minLevel = reg?.BBBEE?.minimum_level ? parseInt(String(reg.BBBEE.minimum_level).match(/\d+/)?.[0] ?? "0", 10) : null;
  const usedSplit: "90/10" | "80/20" = split === "unknown" ? "90/10" : split;
  const bbeeMax = usedSplit === "80/20" ? 20 : 10;
  const bbeeScored = bbeePointsFor(myLevel, usedSplit);

  if (minLevel && myLevel && myLevel > minLevel) {
    gaps.push({
      requirement: "B-BBEE level",
      tender_requires: `Level ${minLevel} or better`,
      your_company_has: `Level ${myLevel}`,
      gap: `${myLevel - minLevel} level${myLevel - minLevel > 1 ? "s" : ""} below requirement`,
      risk: "HIGH",
      page_reference: reg?.BBBEE?.page_reference ?? null,
      recommended_action: "Improve your B-BBEE rating or pursue subcontracting arrangements that boost your score.",
    });
  }

  const bbbeeTableSource: any[] = Array.isArray(ev?.stage_3_price_and_preference?.bbbee_points_table)
    ? ev.stage_3_price_and_preference.bbbee_points_table
    : [];
  const bbbee_table = (bbbeeTableSource.length
    ? bbbeeTableSource.map((r: any) => ({
        level: String(r.bbbee_level ?? ""),
        points: Number(r.points_awarded ?? 0),
        yours: myLevel != null && String(r.bbbee_level ?? "").match(new RegExp(`${myLevel}`)) != null,
      }))
    : [1, 2, 3, 4, 5, 6, 7, 8].map((l) => ({
        level: `Level ${l}`,
        points: bbeePointsFor(l, usedSplit),
        yours: myLevel === l,
      })));

  // Tax
  if (reg?.tax_compliance?.SARS_TCS_PIN_required && profile?.tax_compliance_status && !/compliant|valid|active/i.test(String(profile.tax_compliance_status))) {
    gaps.push({
      requirement: "SARS Tax Compliance Status",
      tender_requires: "Valid SARS TCS PIN at closing date",
      your_company_has: profile?.tax_compliance_status || "Unknown",
      gap: "Tax status is not marked compliant",
      risk: "HIGH",
      page_reference: reg?.tax_compliance?.page_reference ?? null,
      recommended_action: "Renew SARS Tax Compliance Status PIN via SARS eFiling before submitting.",
    });
  }

  // Professional registrations
  const tenderRegs: any[] = Array.isArray(reg?.professional_registrations) ? reg.professional_registrations : [];
  const myRegs: any[] = Array.isArray(profile?.professional_registrations) ? profile.professional_registrations : [];
  for (const r of tenderRegs) {
    const match = myRegs.find((m: any) => String(m?.body || "").toLowerCase() === String(r?.body || "").toLowerCase());
    if (!match) {
      gaps.push({
        requirement: `Registration — ${r?.body}`,
        tender_requires: `${r?.body}${r?.discipline ? ` (${r.discipline})` : ""}`,
        your_company_has: "Not on file",
        gap: "Missing professional registration",
        risk: "CRITICAL",
        page_reference: r?.page_reference ?? null,
        recommended_action: `Add ${r?.body} registration details to your Company Profile or partner with a registered firm.`,
      });
    }
  }

  // Functionality criteria
  const funcCriteria: any[] = Array.isArray(ev?.stage_2_functionality?.criteria) ? ev.stage_2_functionality.criteria : [];
  const myCaps: any[] = Array.isArray(profile?.capabilities) ? profile.capabilities : [];
  const capsText = myCaps.map((c: any) => `${c.type ?? ""} ${c.name ?? ""} ${c.capacity ?? ""}`.toLowerCase()).join(" ");
  for (const c of funcCriteria) {
    const text = String(c?.criterion ?? "").toLowerCase();
    const matched = text && capsText && text.split(/\s+/).some((w) => w.length > 3 && capsText.includes(w));
    if (!matched) {
      gaps.push({
        requirement: `Functionality — ${c?.criterion}`,
        tender_requires: `${c?.maximum_points ?? "?"} max points`,
        your_company_has: "Unknown — no matching capability on file",
        gap: "Verify manually",
        risk: "MEDIUM",
        page_reference: c?.page_reference ?? null,
        recommended_action: "Add a matching capability to your Company Profile to enable automatic matching.",
      });
    }
  }

  // Mandatory briefing
  if (master?.submission?.submission?.briefing_session?.mandatory) {
    gaps.push({
      requirement: "Compulsory briefing session",
      tender_requires: master?.submission?.submission?.briefing_session?.date ?? "Attend briefing",
      your_company_has: "Attendance required",
      gap: "Attendance is compulsory — non-attendance disqualifies",
      risk: "CRITICAL",
      page_reference: master?.submission?.submission?.briefing_session?.page_reference ?? null,
      recommended_action: "Diarise attendance and sign the attendance register on the day.",
    });
  }

  const counts = {
    critical: gaps.filter((g) => g.risk === "CRITICAL").length,
    high: gaps.filter((g) => g.risk === "HIGH").length,
    medium: gaps.filter((g) => g.risk === "MEDIUM").length,
    low: gaps.filter((g) => g.risk === "LOW").length,
  };
  const overall: EligibilityReport["overall"] =
    counts.critical > 0 ? "NOT_ELIGIBLE" : counts.high > 0 ? "CONDITIONAL" : "ELIGIBLE";

  const recommendations = gaps.map((g) => ({
    title: g.requirement,
    body: g.recommended_action,
    risk: g.risk,
  }));

  return {
    overall,
    gaps,
    bbbee_table,
    bbbee_split: split,
    bbbee_points_scored: bbeeScored,
    bbbee_points_max: bbeeMax,
    recommendations,
    counts,
  };
}
