export function Logo({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const dims = size === "lg" ? "w-12 h-12 text-lg" : size === "sm" ? "w-7 h-7 text-[11px]" : "w-9 h-9 text-sm";
  return (
    <div className={`${dims} rounded-xl bg-gradient-to-br from-brand-blue to-brand-teal flex items-center justify-center font-display font-extrabold text-white tracking-tight`}>
      CIQ
    </div>
  );
}

export function LogoLockup() {
  return (
    <div className="flex items-center gap-2.5 font-display font-bold text-base">
      <Logo size="sm" />
      <span>
        ContractIQ
        <span className="text-brand-teal text-xs ml-0.5">SA</span>
      </span>
    </div>
  );
}
