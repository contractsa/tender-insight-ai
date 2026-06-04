
// ============================================================
// SEARCH BAR — recursive search across master_result
// ============================================================
function collectSearchable(obj: any, path: string[] = [], out: { path: string; value: string }[] = []): { path: string; value: string }[] {
  if (out.length > 500) return out;
  if (obj == null) return out;
  if (typeof obj === "string" || typeof obj === "number" || typeof obj === "boolean") {
    const v = String(obj);
    if (v.trim().length > 1) out.push({ path: path.join(" › "), value: v });
    return out;
  }
  if (Array.isArray(obj)) { obj.forEach((v, i) => collectSearchable(v, [...path, `[${i}]`], out)); return out; }
  if (typeof obj === "object") {
    for (const k of Object.keys(obj)) collectSearchable(obj[k], [...path, k], out);
  }
  return out;
}
function SearchBar({ master, setTab }: { master: any; setTab: (t: TabKey) => void }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const items = useMemo(() => collectSearchable(master ?? {}), [master]);
  const matches = useMemo(() => {
    if (!q || q.length < 2) return [];
    const ql = q.toLowerCase();
    return items.filter((it) => it.value.toLowerCase().includes(ql) || it.path.toLowerCase().includes(ql)).slice(0, 20);
  }, [items, q]);
  const sectionForPath = (p: string): TabKey => {
    const s = p.toLowerCase();
    if (s.includes("submission")) return "submission";
    if (s.includes("returnable")) return "returnables";
    if (s.includes("evaluation")) return "evaluation";
    if (s.includes("pricing")) return "pricing";
    if (s.includes("contract")) return "contract";
    if (s.includes("page_level")) return "pages";
    if (s.includes("missing")) return "missing";
    return "summary";
  };
  return (
    <div className="relative mb-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onKeyDown={(e) => { if (e.key === "Escape") { setQ(""); setOpen(false); } }}
          onFocus={() => setOpen(true)}
          placeholder="Search this tender — try returnables, closing date, CIDB, evaluation criteria…"
          className="w-full pl-9 pr-16 py-2 rounded-lg bg-surface-2 border border-border text-sm focus:outline-none focus:border-brand-blue"
        />
        {q && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs px-2 py-0.5 rounded bg-brand-teal/15 text-brand-teal font-bold">{matches.length}</span>}
      </div>
      {open && q.length >= 2 && (
        <div className="absolute z-30 left-0 right-0 mt-1 surface-card max-h-80 overflow-y-auto">
          {matches.length === 0 ? (
            <div className="p-3 text-xs text-muted-foreground">No matches</div>
          ) : matches.map((m, i) => {
            const idx = m.value.toLowerCase().indexOf(q.toLowerCase());
            const before = m.value.slice(Math.max(0, idx - 30), idx);
            const hit = m.value.slice(idx, idx + q.length);
            const after = m.value.slice(idx + q.length, idx + q.length + 60);
            return (
              <button key={i} onClick={() => { setTab(sectionForPath(m.path)); setOpen(false); }}
                className="w-full text-left p-2.5 hover:bg-surface-2 border-b border-border last:border-0">
                <div className="text-[10px] uppercase text-muted-foreground truncate">{m.path}</div>
                <div className="text-xs truncate">…{before}<span className="bg-brand-teal/30 text-brand-teal font-bold">{hit}</span>{after}…</div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
