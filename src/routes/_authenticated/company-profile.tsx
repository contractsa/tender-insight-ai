import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Building2, Plus, Trash2, Save, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/_authenticated/company-profile")({
  component: CompanyProfilePage,
});

type Director = { full_name: string; id_number: string; nationality: string; ownership_pct: string; role: string; signatory: boolean };
type ProfReg = { body: string; discipline: string; number: string };
type Capability = { type: string; name: string; capacity: string; unit: string; max_output: string; current_utilisation: string };

function CompanyProfilePage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const { data: profile, isLoading } = useQuery({
    queryKey: ["company_profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("company_profiles").select("*").eq("user_id", user!.id).maybeSingle();
      return data;
    },
  });

  const [form, setForm] = useState<any>({
    legal_name: "", registration_number: "", vat_number: "", tax_compliance_status: "",
    business_structure: "", cidb_grade: "", cidb_designation: "",
    bbbee_level: "", bbbee_certificate_type: "",
    professional_registrations: [] as ProfReg[],
    directors: [] as Director[],
    capabilities: [] as Capability[],
  });

  useEffect(() => {
    if (profile) setForm({ ...form, ...profile });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  const completeness = useMemo(() => {
    const fields = [form.legal_name, form.registration_number, form.vat_number, form.business_structure, form.cidb_grade, form.bbbee_level];
    const filled = fields.filter((v) => v && String(v).trim().length).length;
    const extras = (form.directors?.length ? 1 : 0) + (form.capabilities?.length ? 1 : 0) + (form.professional_registrations?.length ? 1 : 0);
    return Math.round(((filled + extras) / (fields.length + 3)) * 100);
  }, [form]);

  async function save() {
    if (!user) return;
    setSaving(true);
    const payload = { ...form, user_id: user.id };
    const { error } = await supabase.from("company_profiles").upsert(payload, { onConflict: "user_id" });
    setSaving(false);
    if (error) toast.error(error.message);
    else {
      setSavedAt(Date.now());
      qc.invalidateQueries({ queryKey: ["company_profile", user.id] });
    }
  }

  // Auto-save with debounce
  useEffect(() => {
    if (!user || isLoading) return;
    const t = setTimeout(() => save(), 1500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(form)]);

  function field(label: string, key: string, placeholder = "") {
    return (
      <label className="block">
        <span className="text-xs text-muted-foreground font-medium">{label}</span>
        <input
          value={form[key] ?? ""}
          onChange={(e) => setForm({ ...form, [key]: e.target.value })}
          placeholder={placeholder}
          className="mt-1 w-full px-3 py-2 rounded-lg bg-surface-2 border border-border text-sm focus:outline-none focus:border-brand-blue"
        />
      </label>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto">
      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Building2 className="w-5 h-5 text-brand-teal" />
            <h1 className="text-3xl font-extrabold">Company Profile</h1>
          </div>
          <p className="text-sm text-muted-foreground">Used for eligibility matching against tender requirements.</p>
        </div>
        <div className="text-right">
          <div className="text-xs text-muted-foreground mb-1">Profile completeness</div>
          <div className="text-2xl font-bold text-brand-teal">{completeness}%</div>
          {savedAt && <div className="text-xs text-success flex items-center gap-1 mt-1"><CheckCircle2 className="w-3 h-3" /> Saved</div>}
        </div>
      </div>

      <div className="surface-card p-6 mb-5">
        <h2 className="font-bold mb-4">Business Details</h2>
        <div className="grid md:grid-cols-2 gap-4">
          {field("Legal name", "legal_name", "ABC Construction (Pty) Ltd")}
          {field("Registration number", "registration_number", "2020/123456/07")}
          {field("VAT number", "vat_number", "4123456789")}
          {field("Tax compliance status PIN", "tax_compliance_status")}
          {field("Business structure", "business_structure", "Pty Ltd / CC / Sole Prop")}
        </div>
      </div>

      <div className="surface-card p-6 mb-5">
        <h2 className="font-bold mb-4">Compliance Credentials</h2>
        <div className="grid md:grid-cols-2 gap-4">
          {field("CIDB grade", "cidb_grade", "e.g. 7GB or 9CE")}
          {field("CIDB designation", "cidb_designation", "e.g. General Building")}
          {field("B-BBEE level", "bbbee_level", "1 - 8")}
          {field("B-BBEE certificate type", "bbbee_certificate_type", "Sworn Affidavit / Verified")}
        </div>

        <RepeatableList
          title="Professional registrations"
          items={form.professional_registrations}
          setItems={(items) => setForm({ ...form, professional_registrations: items })}
          empty={{ body: "", discipline: "", number: "" }}
          render={(item, set) => (
            <div className="grid md:grid-cols-3 gap-2">
              <input className="px-3 py-2 rounded-lg bg-surface-2 border border-border text-sm" placeholder="Body (e.g. ECSA, SACPCMP)" value={item.body} onChange={(e) => set({ ...item, body: e.target.value })} />
              <input className="px-3 py-2 rounded-lg bg-surface-2 border border-border text-sm" placeholder="Discipline" value={item.discipline} onChange={(e) => set({ ...item, discipline: e.target.value })} />
              <input className="px-3 py-2 rounded-lg bg-surface-2 border border-border text-sm" placeholder="Registration number" value={item.number} onChange={(e) => set({ ...item, number: e.target.value })} />
            </div>
          )}
        />
      </div>

      <div className="surface-card p-6 mb-5">
        <h2 className="font-bold mb-4">Directors & Ownership</h2>
        <RepeatableList
          items={form.directors}
          setItems={(items) => setForm({ ...form, directors: items })}
          empty={{ full_name: "", id_number: "", nationality: "South African", ownership_pct: "", role: "", signatory: false }}
          render={(item, set) => (
            <div className="grid md:grid-cols-2 gap-2">
              <input className="px-3 py-2 rounded-lg bg-surface-2 border border-border text-sm" placeholder="Full name" value={item.full_name} onChange={(e) => set({ ...item, full_name: e.target.value })} />
              <input className="px-3 py-2 rounded-lg bg-surface-2 border border-border text-sm" placeholder="ID number" value={item.id_number} onChange={(e) => set({ ...item, id_number: e.target.value })} />
              <input className="px-3 py-2 rounded-lg bg-surface-2 border border-border text-sm" placeholder="Nationality" value={item.nationality} onChange={(e) => set({ ...item, nationality: e.target.value })} />
              <input className="px-3 py-2 rounded-lg bg-surface-2 border border-border text-sm" placeholder="Ownership %" value={item.ownership_pct} onChange={(e) => set({ ...item, ownership_pct: e.target.value })} />
              <input className="px-3 py-2 rounded-lg bg-surface-2 border border-border text-sm" placeholder="Role" value={item.role} onChange={(e) => set({ ...item, role: e.target.value })} />
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input type="checkbox" checked={item.signatory} onChange={(e) => set({ ...item, signatory: e.target.checked })} />
                Authorised signatory
              </label>
            </div>
          )}
        />
      </div>

      <div className="surface-card p-6 mb-5">
        <h2 className="font-bold mb-4">Company Capabilities</h2>
        <RepeatableList
          items={form.capabilities}
          setItems={(items) => setForm({ ...form, capabilities: items })}
          empty={{ type: "", name: "", capacity: "", unit: "", max_output: "", current_utilisation: "" }}
          render={(item, set) => (
            <div className="grid md:grid-cols-3 gap-2">
              <input className="px-3 py-2 rounded-lg bg-surface-2 border border-border text-sm" placeholder="Type (Plant / Service / Trade)" value={item.type} onChange={(e) => set({ ...item, type: e.target.value })} />
              <input className="px-3 py-2 rounded-lg bg-surface-2 border border-border text-sm" placeholder="Name" value={item.name} onChange={(e) => set({ ...item, name: e.target.value })} />
              <input className="px-3 py-2 rounded-lg bg-surface-2 border border-border text-sm" placeholder="Capacity" value={item.capacity} onChange={(e) => set({ ...item, capacity: e.target.value })} />
              <input className="px-3 py-2 rounded-lg bg-surface-2 border border-border text-sm" placeholder="Unit" value={item.unit} onChange={(e) => set({ ...item, unit: e.target.value })} />
              <input className="px-3 py-2 rounded-lg bg-surface-2 border border-border text-sm" placeholder="Max output" value={item.max_output} onChange={(e) => set({ ...item, max_output: e.target.value })} />
              <input className="px-3 py-2 rounded-lg bg-surface-2 border border-border text-sm" placeholder="Current utilisation %" value={item.current_utilisation} onChange={(e) => set({ ...item, current_utilisation: e.target.value })} />
            </div>
          )}
        />
      </div>

      <button onClick={save} disabled={saving} className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold inline-flex items-center gap-2 disabled:opacity-60">
        <Save className="w-4 h-4" /> {saving ? "Saving…" : "Save Profile"}
      </button>
    </div>
  );
}

function RepeatableList<T>({ title, items, setItems, empty, render }: {
  title?: string; items: T[]; setItems: (v: T[]) => void; empty: T;
  render: (item: T, set: (v: T) => void) => React.ReactNode;
}) {
  const list = Array.isArray(items) ? items : [];
  return (
    <div className="mt-4">
      {title && <div className="text-sm font-semibold mb-2">{title}</div>}
      <div className="space-y-2">
        {list.map((item, i) => (
          <div key={i} className="p-3 rounded-lg bg-surface-2/60 border border-border flex items-start gap-2">
            <div className="flex-1">{render(item, (v) => { const next = [...list]; next[i] = v; setItems(next); })}</div>
            <button onClick={() => setItems(list.filter((_, j) => j !== i))} className="p-1.5 text-muted-foreground hover:text-destructive" aria-label="Remove">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
      <button onClick={() => setItems([...list, { ...empty }])} className="mt-2 text-xs px-3 py-1.5 rounded-lg border border-border hover:border-brand-teal hover:text-brand-teal inline-flex items-center gap-1.5">
        <Plus className="w-3 h-3" /> Add
      </button>
    </div>
  );
}
