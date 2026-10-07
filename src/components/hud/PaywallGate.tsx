import { useOutseta } from "@outseta/react";
import { signOutOfOutseta } from "@/lib/outseta/session";

const btnClass =
  "text-[10px] uppercase tracking-wider px-3 py-1.5 border border-border rounded-sm hover:border-primary hover:text-primary";

export function PaywallGate({ signedIn }: { signedIn: boolean }) {
  const { openLogin, logout } = useOutseta();

  return (
    <div className="flex-1 flex items-center justify-center px-4 py-16">
      <div className="max-w-md w-full hud-panel p-6 space-y-4">
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-accent-deep">Foundation Research</div>
        <h2 className="font-serif font-light text-[22px] tracking-[-0.005em] text-surface-foreground">
          {signedIn ? "Subscription required" : "Log in to continue"}
        </h2>
        <p className="text-sm text-muted-foreground">
          {signedIn
            ? "This workspace is included with Turning Point or The Collective. Your current account does not have an active plan. Membership is through foundationmacro.com."
            : "Terminus is for Turning Point and Collective members. Log in to continue. New memberships go through foundationmacro.com."}
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          {signedIn ? (
            <button type="button" className={btnClass} onClick={() => void signOutOfOutseta(logout)}>
              Sign out
            </button>
          ) : (
            <button type="button" className={btnClass} onClick={() => openLogin()}>
              Log in
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
