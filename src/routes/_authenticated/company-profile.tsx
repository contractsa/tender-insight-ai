import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Building2, Plus, Trash2, Save, CheckCircle2, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/_authenticated/company-profile")({
  component: CompanyProfilePage,
});

// =====================================================================
// Reference data — every SA tender bidder type, every dropdown
// =====================================================================
const ENTITY_TYPES = [
  "Private Company (Pty) Ltd", "Close Corporation (CC)", "Sole Proprietor",
  "Partnership", "Trust", "Non-Profit Organisation (NPO)", "Non-Profit Company (NPC)",
  "Cooperative", "Joint Venture", "Consortium", "Public Company (Ltd)",
  "State-Owned Company (SOC)", "Section 21 Company", "Foreign Company",
  "Informal Business (CIPC exempt)", "Individual Contractor", "Professional Practice",
  "Community Based Organisation (CBO)", "Youth Enterprise", "Women-Owned Enterprise",
  "Person with Disability Enterprise", "Township Enterprise", "Rural Enterprise",
  "Emerging Micro Enterprise (EME)", "Qualifying Small Enterprise (QSE)",
];
const TAX_STATUSES = ["Compliant", "Non-Compliant", "Exempt", "Pending"];
const TURNOVER = ["Under R1M", "R1M – R5M", "R5M – R10M", "R10M – R50M", "R50M – R100M", "Over R100M"];
const PROVINCES = ["National", "Gauteng", "Western Cape", "Eastern Cape", "KwaZulu-Natal", "Limpopo", "Mpumalanga", "Free State", "North West", "Northern Cape"];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const RACES = ["African", "Coloured", "Indian", "White", "Other"];
const GENDERS = ["Male", "Female", "Non-binary", "Prefer not to say"];
const BBBEE_LEVELS = ["Level 1","Level 2","Level 3","Level 4","Level 5","Level 6","Level 7","Level 8","Non-Compliant","Exempt Micro Enterprise (EME)","Qualifying Small Enterprise (QSE)"];
const BBBEE_CERT_TYPES = ["Verified by SANAS accredited agency","Sworn Affidavit for EME","Sworn Affidavit for QSE","Not Applicable"];
const CIDB_GRADES = ["Not Registered","1","2","3","4","5","6","7","8","9"];
const CIDB_DESIGNATIONS = ["Not Applicable","GB – General Building","CE – Civil Engineering","SB – Specialist Building","ME – Mechanical Engineering","EE – Electrical Engineering","EP – Electrical Engineering (Public Infrastructure)","SI – Specialist Installation","WR – Water Resource Works","SW – Specialist Works"];
const PROF_BODIES = ["ECSA","SACPCMP","SAICA","SAIPA","SACAP","SACSSP","HPCSA","SACPVP","SAIA","Law Society","Other"];
const BANKS = ["ABSA","FNB","Standard Bank","Nedbank","Capitec","African Bank","Bidvest Bank","Discovery Bank","Investec","Other"];
const ACCOUNT_TYPES = ["Cheque","Savings","Transmission"];
const CAPABILITY_TYPES = [
  "Construction","Civil Works","Electrical Works","Mechanical Works","Plumbing","Roofing","Paving","Painting","Tiling","HVAC","Fire Protection","Security Systems",
  "ICT Hardware","ICT Software","ICT Networks","ICT Support","Software Development","Data Management","Cloud Services",
  "Cleaning Services","Waste Management","Landscaping","Pest Control","Catering","Accommodation",
  "Transport and Logistics","Fleet Management","Fuel Supply",
  "Medical Supplies","Pharmaceuticals","Laboratory Services",
  "Printing and Stationery","Office Supplies","Uniforms and PPE","Furniture","Equipment Supply","Plant Hire",
  "Professional Services – Engineering","Professional Services – Accounting","Professional Services – Legal","Professional Services – Consulting","Professional Services – Architecture",
  "Healthcare","Education and Training","Social Services","Agricultural Services","Environmental Services","Research and Development","Other",
];

// =====================================================================
// Types
// =====================================================================
type Director = { full_name: string; id_number: string; nationality: string; race: string; gender: string; disability: string; ownership_pct: string; voting_rights_pct: string; role: string; signatory: boolean };
type ProfReg = { body: string; number: string; discipline: string; grade: string; expiry: string; current: string };
type Banking = { bank: string; account_holder: string; account_number: string; branch_name: string; branch_code: string; account_type: string; confirmation_letter: string };
type Insurance = { provider: string; policy_number: string; cover_amount: string; expiry: string };
type Capability = { type: string; name: string; capacity: string; unit: string; areas: string[]; max_concurrent: string; years_experience: string; references: string };
type Personnel = { full_name: string; id_number: string; race: string; gender: string; disability: string; role: string; registration: string; years_experience: string; qualification: string; availability_pct: string };
type Reference = { client_name: string; contact_person: string; contact_phone: string; contact_email: string; project_description: string; contract_value: string; start_date: string; end_date: string; cidb_grade: string; completed: string; letter_available: string };

const emptyForm = {
  // Section 1
  legal_name: "", trading_name: "", entity_type: "", registration_number: "", vat_number: "", vat_not_registered: false,
  income_tax_reference: "", tax_compliance_status: "", tax_compliance_pin: "",
  date_of_incorporation: "", financial_year_end: "", annual_turnover: "",
  permanent_employees: "", contract_employees: "",
  physical_street: "", physical_suburb: "", physical_city: "", physical_province: "", physical_postal_code: "",
  postal_address: "", business_telephone: "", business_email: "", website: "",
  // Section 2
  directors: [] as Director[],
  // Section 3
  bbbee_level: "", bbbee_certificate_type: "", bbbee_verification_agency: "", bbbee_certificate_expiry: "",
  black_ownership_pct: "", black_female_ownership_pct: "", black_youth_ownership_pct: "", disabled_ownership_pct: "",
  is_51_black_owned: "", is_30_black_female_owned: "", is_youth_enterprise: "", is_military_veteran_enterprise: "",
  // Section 4
  cidb_registration_number: "", cidb_grade: "", cidb_designation: "", cidb_expiry: "",
  professional_registrations: [] as ProfReg[],
  // Section 5
  banking: { bank: "", account_holder: "", account_number: "", branch_name: "", branch_code: "", account_type: "", confirmation_letter: "" } as Banking,
  // Section 6
  public_liability: { provider: "", policy_number: "", cover_amount: "", expiry: "" } as Insurance,
  professional_indemnity: { provider: "", policy_number: "", cover_amount: "", expiry: "" } as Insurance,
  contractors_all_risk: { provider: "", policy_number: "", cover_amount: "", expiry: "" } as Insurance,
  coida_letter: "", coida_expiry: "",
  // Section 7
  capabilities: [] as Capability[],
  // Section 8
  key_personnel: [] as Personnel[],
  // Section 9
  references: [] as Reference[],
};

// =====================================================================
// Page
// =====================================================================
function CompanyProfilePage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const skipNextSave = useRef(true);

  const { data: profile, isLoading } = useQuery({
    queryKey: ["company_profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("company_profiles").select("*").eq("user_id", user!.id).maybeSingle();
      return data;
    },
  });

  const [form, setForm] = useState<any>(emptyForm);

  // Hydrate once when profile loads
  useEffect(() => {
    if (profile) {
      skipNextSave.current = true;
      setForm({ ...emptyForm, ...profile });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  // Auto-save with debounce
  useEffect(() => {
    if (!user || isLoading) return;
    if (skipNextSave.current) { skipNextSave.current = false; return; }
    const t = setTimeout(() => save(), 1500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(form)]);

  async function save() {
    if (!user) return;
    setSaving(true);
    const payload = { ...form, user_id: user.id };
    const { error } = await supabase.from("company_profiles").upsert(payload, { onConflict: "user_id" });
    setSaving(false);
    if (error) toast.error(error.message);
    else { setSavedAt(Date.now()); qc.invalidateQueries({ queryKey: ["company_profile", user.id] }); }
  }

  // Completeness — 9 sections weighted equally
  const completeness = useMemo(() => {
    const filled = (v: any) => v != null && String(v).trim().length > 0;
    const s1 = [form.legal_name, form.entity_type, form.registration_number, form.tax_compliance_status, form.physical_city, form.physical_province, form.business_telephone, form.business_email].filter(filled).length / 8;
    const s2 = (form.directors?.length ?? 0) > 0 ? 1 : 0;
    const s3 = [form.bbbee_level, form.bbbee_certificate_type, form.is_51_black_owned].filter(filled).length / 3;
    const s4 = [form.cidb_grade, form.cidb_designation].filter(filled).length / 2;
    const s5 = [form.banking?.bank, form.banking?.account_number, form.banking?.branch_code].filter(filled).length / 3;
    const s6 = [form.public_liability?.provider, form.coida_letter].filter(filled).length / 2;
    const s7 = (form.capabilities?.length ?? 0) > 0 ? 1 : 0;
    const s8 = (form.key_personnel?.length ?? 0) > 0 ? 1 : 0;
    const s9 = (form.references?.length ?? 0) > 0 ? 1 : 0;
    return Math.round(((s1+s2+s3+s4+s5+s6+s7+s8+s9) / 9) * 100);
  }, [form]);

  function set(key: string, value: any) { setForm((f: any) => ({ ...f, [key]: value })); }
  function setNested(parent: string, key: string, value: any) {
    setForm((f: any) => ({ ...f, [parent]: { ...(f[parent] ?? {}), [key]: value } }));
  }

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-5xl mx-auto pb-24">
      <header className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Building2 className="w-5 h-5 text-brand-teal" />
            <h1 className="text-3xl font-extrabold">Company Profile</h1>
          </div>
          <p className="text-sm text-muted-foreground">Used for eligibility matching, B-BBEE point calculation and pre-filling submission forms.</p>
        </div>
        <div className="text-right shrink-0">
          <div className="text-xs text-muted-foreground mb-1">Profile completeness</div>
          <div className={`text-2xl font-bold ${completeness >= 80 ? "text-success" : completeness >= 50 ? "text-yellow-500" : "text-destructive"}`}>{completeness}%</div>
          {savedAt && <div className="text-xs text-success flex items-center gap-1 justify-end mt-1"><CheckCircle2 className="w-3 h-3" /> Saved</div>}
          {saving && <div className="text-xs text-muted-foreground mt-1">Saving…</div>}
        </div>
      </header>

      {completeness < 80 && (
        <div className="surface-card p-4 mb-5 border-amber-500/30 bg-amber-500/5">
          <div className="flex gap-3 text-sm">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <span>Profile is under 80% complete. Eligibility checks rely on this data — complete every section below for accurate gap analysis.</span>
          </div>
        </div>
      )}

      {/* SECTION 1 — ENTITY INFORMATION */}
      <Section title="1. Entity Information" subtitle="Legal identity, tax status, address and headcount.">
        <Grid cols={2}>
          <Text label="Legal business name (as registered with CIPC)" value={form.legal_name} onChange={(v) => set("legal_name", v)} placeholder="ABC Construction (Pty) Ltd" />
          <Text label="Trading name (if different)" value={form.trading_name} onChange={(v) => set("trading_name", v)} />
          <Select label="Entity type" value={form.entity_type} onChange={(v) => set("entity_type", v)} options={ENTITY_TYPES} />
          <Text label="CIPC registration number" value={form.registration_number} onChange={(v) => set("registration_number", v)} placeholder="2020/123456/07" />
          <div>
            <Text label="VAT registration number" value={form.vat_number} onChange={(v) => set("vat_number", v)} placeholder="4123456789" disabled={form.vat_not_registered} />
            <label className="text-xs text-muted-foreground inline-flex items-center gap-2 mt-1">
              <input type="checkbox" checked={!!form.vat_not_registered} onChange={(e) => set("vat_not_registered", e.target.checked)} /> Not VAT registered
            </label>
          </div>
          <Text label="Income tax reference number" value={form.income_tax_reference} onChange={(v) => set("income_tax_reference", v)} />
          <Select label="SARS tax compliance status" value={form.tax_compliance_status} onChange={(v) => set("tax_compliance_status", v)} options={TAX_STATUSES} />
          <Text label="Tax Compliance Status PIN (TCS)" value={form.tax_compliance_pin} onChange={(v) => set("tax_compliance_pin", v)} placeholder="From SARS eFiling" />
          <Text label="Date of incorporation" type="date" value={form.date_of_incorporation} onChange={(v) => set("date_of_incorporation", v)} />
          <Select label="Financial year end month" value={form.financial_year_end} onChange={(v) => set("financial_year_end", v)} options={MONTHS} />
          <Select label="Annual turnover range" value={form.annual_turnover} onChange={(v) => set("annual_turnover", v)} options={TURNOVER} />
          <Text label="Permanent employees" type="number" value={form.permanent_employees} onChange={(v) => set("permanent_employees", v)} />
          <Text label="Temporary / contract employees" type="number" value={form.contract_employees} onChange={(v) => set("contract_employees", v)} />
        </Grid>
        <h3 className="text-sm font-semibold mt-5 mb-2">Physical business address</h3>
        <Grid cols={2}>
          <Text label="Street address" value={form.physical_street} onChange={(v) => set("physical_street", v)} />
          <Text label="Suburb" value={form.physical_suburb} onChange={(v) => set("physical_suburb", v)} />
          <Text label="City" value={form.physical_city} onChange={(v) => set("physical_city", v)} />
          <Select label="Province" value={form.physical_province} onChange={(v) => set("physical_province", v)} options={PROVINCES.filter(p => p !== "National")} />
          <Text label="Postal code" value={form.physical_postal_code} onChange={(v) => set("physical_postal_code", v)} />
          <Text label="Postal address (if different)" value={form.postal_address} onChange={(v) => set("postal_address", v)} />
        </Grid>
        <h3 className="text-sm font-semibold mt-5 mb-2">Contact</h3>
        <Grid cols={2}>
          <Text label="Business telephone" value={form.business_telephone} onChange={(v) => set("business_telephone", v)} />
          <Text label="Business email" type="email" value={form.business_email} onChange={(v) => set("business_email", v)} />
          <Text label="Website" value={form.website} onChange={(v) => set("website", v)} placeholder="https://" />
        </Grid>
      </Section>

      {/* SECTION 2 — OWNERSHIP AND CONTROL */}
      <Section title="2. Ownership and Control" subtitle="Directors, members and shareholders (up to 20). Race, gender and disability are required for B-BBEE calculation.">
        <Repeatable<Director>
          items={form.directors}
          setItems={(v) => set("directors", v)}
          max={20}
          empty={{ full_name: "", id_number: "", nationality: "South African", race: "", gender: "", disability: "No", ownership_pct: "", voting_rights_pct: "", role: "", signatory: false }}
          render={(item, upd) => (
            <Grid cols={2}>
              <Text label="Full name" value={item.full_name} onChange={(v) => upd({ ...item, full_name: v })} />
              <Text label="ID / passport number" value={item.id_number} onChange={(v) => upd({ ...item, id_number: v })} />
              <Text label="Nationality" value={item.nationality} onChange={(v) => upd({ ...item, nationality: v })} />
              <Select label="Race" value={item.race} onChange={(v) => upd({ ...item, race: v })} options={RACES} />
              <Select label="Gender" value={item.gender} onChange={(v) => upd({ ...item, gender: v })} options={GENDERS} />
              <Select label="Disability" value={item.disability} onChange={(v) => upd({ ...item, disability: v })} options={["Yes", "No"]} />
              <Text label="Ownership %" type="number" value={item.ownership_pct} onChange={(v) => upd({ ...item, ownership_pct: v })} />
              <Text label="Voting rights %" type="number" value={item.voting_rights_pct} onChange={(v) => upd({ ...item, voting_rights_pct: v })} />
              <Text label="Role / designation" value={item.role} onChange={(v) => upd({ ...item, role: v })} />
              <label className="flex items-center gap-2 text-sm self-end pb-2">
                <input type="checkbox" checked={item.signatory} onChange={(e) => upd({ ...item, signatory: e.target.checked })} />
                Authorised to sign bid documents
              </label>
            </Grid>
          )}
        />
      </Section>

      {/* SECTION 3 — B-BBEE */}
      <Section title="3. B-BBEE Status" subtitle="Drives preference points under PPPFA (80/20 or 90/10).">
        <Grid cols={2}>
          <Select label="B-BBEE status level" value={form.bbbee_level} onChange={(v) => set("bbbee_level", v)} options={BBBEE_LEVELS} />
          <Select label="B-BBEE certificate type" value={form.bbbee_certificate_type} onChange={(v) => set("bbbee_certificate_type", v)} options={BBBEE_CERT_TYPES} />
          <Text label="Verification agency (if verified)" value={form.bbbee_verification_agency} onChange={(v) => set("bbbee_verification_agency", v)} />
          <Text label="Certificate expiry date" type="date" value={form.bbbee_certificate_expiry} onChange={(v) => set("bbbee_certificate_expiry", v)} />
          <Text label="Black ownership %" type="number" value={form.black_ownership_pct} onChange={(v) => set("black_ownership_pct", v)} />
          <Text label="Black female ownership %" type="number" value={form.black_female_ownership_pct} onChange={(v) => set("black_female_ownership_pct", v)} />
          <Text label="Black youth ownership % (under 35)" type="number" value={form.black_youth_ownership_pct} onChange={(v) => set("black_youth_ownership_pct", v)} />
          <Text label="Disabled person ownership %" type="number" value={form.disabled_ownership_pct} onChange={(v) => set("disabled_ownership_pct", v)} />
          <Select label="51%+ black-owned?" value={form.is_51_black_owned} onChange={(v) => set("is_51_black_owned", v)} options={["Yes", "No"]} />
          <Select label="30%+ black-female-owned?" value={form.is_30_black_female_owned} onChange={(v) => set("is_30_black_female_owned", v)} options={["Yes", "No"]} />
          <Select label="Youth-owned enterprise?" value={form.is_youth_enterprise} onChange={(v) => set("is_youth_enterprise", v)} options={["Yes", "No"]} />
          <Select label="Military veteran enterprise?" value={form.is_military_veteran_enterprise} onChange={(v) => set("is_military_veteran_enterprise", v)} options={["Yes", "No"]} />
        </Grid>
      </Section>

      {/* SECTION 4 — CIDB & PROF REGS */}
      <Section title="4. Professional Registrations and CIDB">
        <Grid cols={2}>
          <Text label="CIDB registration number" value={form.cidb_registration_number} onChange={(v) => set("cidb_registration_number", v)} />
          <Select label="CIDB grade" value={form.cidb_grade} onChange={(v) => set("cidb_grade", v)} options={CIDB_GRADES} />
          <Select label="CIDB designation" value={form.cidb_designation} onChange={(v) => set("cidb_designation", v)} options={CIDB_DESIGNATIONS} />
          <Text label="CIDB expiry date" type="date" value={form.cidb_expiry} onChange={(v) => set("cidb_expiry", v)} />
        </Grid>
        <h3 className="text-sm font-semibold mt-5 mb-2">Professional registrations</h3>
        <Repeatable<ProfReg>
          items={form.professional_registrations}
          setItems={(v) => set("professional_registrations", v)}
          empty={{ body: "", number: "", discipline: "", grade: "", expiry: "", current: "Yes" }}
          render={(item, upd) => (
            <Grid cols={2}>
              <Select label="Registration body" value={item.body} onChange={(v) => upd({ ...item, body: v })} options={PROF_BODIES} />
              <Text label="Registration number" value={item.number} onChange={(v) => upd({ ...item, number: v })} />
              <Text label="Discipline / category" value={item.discipline} onChange={(v) => upd({ ...item, discipline: v })} />
              <Text label="Grade / level" value={item.grade} onChange={(v) => upd({ ...item, grade: v })} />
              <Text label="Expiry date" type="date" value={item.expiry} onChange={(v) => upd({ ...item, expiry: v })} />
              <Select label="Currently valid?" value={item.current} onChange={(v) => upd({ ...item, current: v })} options={["Yes", "No"]} />
            </Grid>
          )}
        />
      </Section>

      {/* SECTION 5 — BANKING */}
      <Section title="5. Banking Details" subtitle="Required for bank confirmation letters on letterhead.">
        <Grid cols={2}>
          <Select label="Bank" value={form.banking.bank} onChange={(v) => setNested("banking", "bank", v)} options={BANKS} />
          <Text label="Account holder name" value={form.banking.account_holder} onChange={(v) => setNested("banking", "account_holder", v)} />
          <Text label="Account number" value={form.banking.account_number} onChange={(v) => setNested("banking", "account_number", v)} />
          <Text label="Branch name" value={form.banking.branch_name} onChange={(v) => setNested("banking", "branch_name", v)} />
          <Text label="Branch code" value={form.banking.branch_code} onChange={(v) => setNested("banking", "branch_code", v)} />
          <Select label="Account type" value={form.banking.account_type} onChange={(v) => setNested("banking", "account_type", v)} options={ACCOUNT_TYPES} />
          <Select label="Bank confirmation letter available?" value={form.banking.confirmation_letter} onChange={(v) => setNested("banking", "confirmation_letter", v)} options={["Yes", "No"]} />
        </Grid>
      </Section>

      {/* SECTION 6 — INSURANCE */}
      <Section title="6. Insurance">
        <h3 className="text-sm font-semibold mb-2">Public liability insurance</h3>
        <InsuranceBlock value={form.public_liability} onChange={(k, v) => setNested("public_liability", k, v)} />
        <h3 className="text-sm font-semibold mt-5 mb-2">Professional indemnity insurance</h3>
        <InsuranceBlock value={form.professional_indemnity} onChange={(k, v) => setNested("professional_indemnity", k, v)} />
        <h3 className="text-sm font-semibold mt-5 mb-2">Contractors all-risk insurance (if applicable)</h3>
        <InsuranceBlock value={form.contractors_all_risk} onChange={(k, v) => setNested("contractors_all_risk", k, v)} />
        <h3 className="text-sm font-semibold mt-5 mb-2">COIDA / Employers liability</h3>
        <Grid cols={2}>
          <Select label="Letter of good standing available?" value={form.coida_letter} onChange={(v) => set("coida_letter", v)} options={["Yes", "No"]} />
          <Text label="Expiry date" type="date" value={form.coida_expiry} onChange={(v) => set("coida_expiry", v)} />
        </Grid>
      </Section>

      {/* SECTION 7 — CAPABILITIES */}
      <Section title="7. Company Capabilities" subtitle="Drives functionality scoring matches in eligibility checks.">
        <Repeatable<Capability>
          items={form.capabilities}
          setItems={(v) => set("capabilities", v)}
          empty={{ type: "", name: "", capacity: "", unit: "", areas: [], max_concurrent: "", years_experience: "", references: "" }}
          render={(item, upd) => (
            <>
              <Grid cols={2}>
                <Select label="Capability type" value={item.type} onChange={(v) => upd({ ...item, type: v })} options={CAPABILITY_TYPES} />
                <Text label="Service / product name" value={item.name} onChange={(v) => upd({ ...item, name: v })} />
                <Text label="Capacity (numeric)" type="number" value={item.capacity} onChange={(v) => upd({ ...item, capacity: v })} />
                <Text label="Unit of measurement" value={item.unit} onChange={(v) => upd({ ...item, unit: v })} placeholder="e.g. m³, units, contracts" />
                <Text label="Max concurrent projects / contracts" type="number" value={item.max_concurrent} onChange={(v) => upd({ ...item, max_concurrent: v })} />
                <Text label="Years of experience" type="number" value={item.years_experience} onChange={(v) => upd({ ...item, years_experience: v })} />
              </Grid>
              <div className="mt-3">
                <span className="text-xs text-muted-foreground font-medium">Geographic delivery areas</span>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {PROVINCES.map((p) => {
                    const on = item.areas.includes(p);
                    return (
                      <button key={p} type="button"
                        onClick={() => upd({ ...item, areas: on ? item.areas.filter(a => a !== p) : [...item.areas, p] })}
                        className={`px-2.5 py-1 rounded-full text-xs border ${on ? "bg-brand-teal/20 border-brand-teal text-brand-teal" : "border-border text-muted-foreground hover:border-brand-teal"}`}>
                        {p}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="mt-3">
                <span className="text-xs text-muted-foreground font-medium">Notable clients or references</span>
                <textarea value={item.references} onChange={(e) => upd({ ...item, references: e.target.value })}
                  className="mt-1 w-full px-3 py-2 rounded-lg bg-surface-2 border border-border text-sm focus:outline-none focus:border-brand-blue min-h-[60px]" />
              </div>
            </>
          )}
        />
      </Section>

      {/* SECTION 8 — KEY PERSONNEL */}
      <Section title="8. Key Personnel" subtitle="Staff who will work on awarded contracts.">
        <Repeatable<Personnel>
          items={form.key_personnel}
          setItems={(v) => set("key_personnel", v)}
          empty={{ full_name: "", id_number: "", race: "", gender: "", disability: "No", role: "", registration: "", years_experience: "", qualification: "", availability_pct: "100" }}
          render={(item, upd) => (
            <Grid cols={2}>
              <Text label="Full name" value={item.full_name} onChange={(v) => upd({ ...item, full_name: v })} />
              <Text label="ID number" value={item.id_number} onChange={(v) => upd({ ...item, id_number: v })} />
              <Select label="Race" value={item.race} onChange={(v) => upd({ ...item, race: v })} options={RACES} />
              <Select label="Gender" value={item.gender} onChange={(v) => upd({ ...item, gender: v })} options={GENDERS} />
              <Select label="Disability" value={item.disability} onChange={(v) => upd({ ...item, disability: v })} options={["Yes", "No"]} />
              <Text label="Role / designation" value={item.role} onChange={(v) => upd({ ...item, role: v })} />
              <Text label="Professional registration" value={item.registration} onChange={(v) => upd({ ...item, registration: v })} />
              <Text label="Years of experience" type="number" value={item.years_experience} onChange={(v) => upd({ ...item, years_experience: v })} />
              <Text label="Highest qualification" value={item.qualification} onChange={(v) => upd({ ...item, qualification: v })} />
              <Text label="Availability %" type="number" value={item.availability_pct} onChange={(v) => upd({ ...item, availability_pct: v })} />
            </Grid>
          )}
        />
      </Section>

      {/* SECTION 9 — REFERENCES */}
      <Section title="9. References and Track Record" subtitle="Past contracts used to score functionality and verify experience.">
        <Repeatable<Reference>
          items={form.references}
          setItems={(v) => set("references", v)}
          empty={{ client_name: "", contact_person: "", contact_phone: "", contact_email: "", project_description: "", contract_value: "", start_date: "", end_date: "", cidb_grade: "", completed: "Yes", letter_available: "No" }}
          render={(item, upd) => (
            <>
              <Grid cols={2}>
                <Text label="Client organisation" value={item.client_name} onChange={(v) => upd({ ...item, client_name: v })} />
                <Text label="Contact person" value={item.contact_person} onChange={(v) => upd({ ...item, contact_person: v })} />
                <Text label="Contact telephone" value={item.contact_phone} onChange={(v) => upd({ ...item, contact_phone: v })} />
                <Text label="Contact email" type="email" value={item.contact_email} onChange={(v) => upd({ ...item, contact_email: v })} />
                <Text label="Contract value (R)" type="number" value={item.contract_value} onChange={(v) => upd({ ...item, contract_value: v })} />
                <Text label="CIDB grading used" value={item.cidb_grade} onChange={(v) => upd({ ...item, cidb_grade: v })} />
                <Text label="Project start date" type="date" value={item.start_date} onChange={(v) => upd({ ...item, start_date: v })} />
                <Text label="Project end date" type="date" value={item.end_date} onChange={(v) => upd({ ...item, end_date: v })} />
                <Select label="Successfully completed?" value={item.completed} onChange={(v) => upd({ ...item, completed: v })} options={["Yes", "No"]} />
                <Select label="Reference letter available?" value={item.letter_available} onChange={(v) => upd({ ...item, letter_available: v })} options={["Yes", "No"]} />
              </Grid>
              <div className="mt-3">
                <span className="text-xs text-muted-foreground font-medium">Project description</span>
                <textarea value={item.project_description} onChange={(e) => upd({ ...item, project_description: e.target.value })}
                  className="mt-1 w-full px-3 py-2 rounded-lg bg-surface-2 border border-border text-sm focus:outline-none focus:border-brand-blue min-h-[60px]" />
              </div>
            </>
          )}
        />
      </Section>

      <div className="sticky bottom-0 -mx-4 sm:-mx-6 md:-mx-8 px-4 sm:px-6 md:px-8 py-3 bg-background/95 backdrop-blur border-t border-border">
        <button onClick={save} disabled={saving} className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold inline-flex items-center gap-2 disabled:opacity-60">
          <Save className="w-4 h-4" /> {saving ? "Saving…" : "Save Profile"}
        </button>
        <span className="ml-3 text-xs text-muted-foreground">Auto-saves as you type.</span>
      </div>
    </div>
  );
}

// =====================================================================
// Reusable building blocks
// =====================================================================
function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="surface-card p-5 sm:p-6 mb-5">
      <h2 className="font-bold text-lg mb-1">{title}</h2>
      {subtitle && <p className="text-xs text-muted-foreground mb-4">{subtitle}</p>}
      {children}
    </section>
  );
}
function Grid({ cols, children }: { cols: 1 | 2 | 3; children: React.ReactNode }) {
  const cls = cols === 1 ? "grid gap-3" : cols === 3 ? "grid sm:grid-cols-2 md:grid-cols-3 gap-3" : "grid sm:grid-cols-2 gap-3";
  return <div className={cls}>{children}</div>;
}
function Text({ label, value, onChange, placeholder, type = "text", disabled }: { label: string; value: any; onChange: (v: string) => void; placeholder?: string; type?: string; disabled?: boolean }) {
  return (
    <label className="block">
      <span className="text-xs text-muted-foreground font-medium">{label}</span>
      <input type={type} value={value ?? ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} disabled={disabled}
        className="mt-1 w-full px-3 py-2 rounded-lg bg-surface-2 border border-border text-sm focus:outline-none focus:border-brand-blue disabled:opacity-50" />
    </label>
  );
}
function Select({ label, value, onChange, options }: { label: string; value: any; onChange: (v: string) => void; options: string[] }) {
  return (
    <label className="block">
      <span className="text-xs text-muted-foreground font-medium">{label}</span>
      <select value={value ?? ""} onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full px-3 py-2 rounded-lg bg-surface-2 border border-border text-sm focus:outline-none focus:border-brand-blue">
        <option value="">Select…</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
}
function InsuranceBlock({ value, onChange }: { value: Insurance; onChange: (k: keyof Insurance, v: string) => void }) {
  return (
    <Grid cols={2}>
      <Text label="Provider" value={value.provider} onChange={(v) => onChange("provider", v)} />
      <Text label="Policy number" value={value.policy_number} onChange={(v) => onChange("policy_number", v)} />
      <Text label="Cover amount (R)" type="number" value={value.cover_amount} onChange={(v) => onChange("cover_amount", v)} />
      <Text label="Expiry date" type="date" value={value.expiry} onChange={(v) => onChange("expiry", v)} />
    </Grid>
  );
}
function Repeatable<T>({ items, setItems, empty, render, max }: {
  items: T[]; setItems: (v: T[]) => void; empty: T; render: (item: T, upd: (v: T) => void) => React.ReactNode; max?: number;
}) {
  const list = Array.isArray(items) ? items : [];
  return (
    <div>
      <div className="space-y-3">
        {list.map((item, i) => (
          <div key={i} className="p-3 sm:p-4 rounded-lg bg-surface-2/60 border border-border">
            <div className="flex items-start justify-between gap-2 mb-2">
              <span className="text-xs font-mono text-muted-foreground">#{i + 1}</span>
              <button onClick={() => setItems(list.filter((_, j) => j !== i))} className="p-1.5 text-muted-foreground hover:text-destructive" aria-label="Remove">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            {render(item, (v) => { const next = [...list]; next[i] = v; setItems(next); })}
          </div>
        ))}
      </div>
      <button
        type="button"
        disabled={max != null && list.length >= max}
        onClick={() => setItems([...list, { ...empty }])}
        className="mt-3 text-xs px-3 py-1.5 rounded-lg border border-border hover:border-brand-teal hover:text-brand-teal inline-flex items-center gap-1.5 disabled:opacity-50">
        <Plus className="w-3 h-3" /> Add {max != null ? `(${list.length}/${max})` : ""}
      </button>
    </div>
  );
}
