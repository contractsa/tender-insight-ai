import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/_authenticated/account")({
  component: AccountPage,
});

function AccountPage() {
  const { user } = useAuth();
  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("user_id", user!.id).single();
      return data;
    },
  });

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-3xl font-extrabold mb-8">Account</h1>

      <div className="surface-card p-6 mb-4">
        <h2 className="font-display font-bold mb-4">Profile</h2>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">Name</span><span>{profile?.full_name || "—"}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Email</span><span>{user?.email}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Company</span><span>{profile?.company || "—"}</span></div>
        </div>
      </div>

      <div className="surface-card p-6">
        <h2 className="font-display font-bold mb-4">Subscription</h2>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">Plan</span><span className="capitalize">{profile?.plan || "Trial"}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Credits remaining</span><span className="text-brand-blue font-semibold">{profile?.credits_remaining ?? 0}</span></div>
          {profile?.trial_ends_at && (
            <div className="flex justify-between"><span className="text-muted-foreground">Trial ends</span><span>{new Date(profile.trial_ends_at).toLocaleDateString()}</span></div>
          )}
        </div>
      </div>
    </div>
  );
}
