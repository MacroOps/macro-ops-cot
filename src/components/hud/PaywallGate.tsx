import { useOutseta } from "@outseta/react";
import { signOutOfOutseta } from "@/lib/outseta/session";

const btnClass =
  "text-[10px] uppercase tracking-wider px-3 py-1.5 border border-border rounded-sm hover:border-primary hover:text-primary";

export function PaywallGate({ signedIn }: { signedIn: boolean }) {
  const { openLogin, logout } = useOutseta();

  return (
    <div className="flex-1 flex items-center justify-center px-4 py-16">
      <div className="max-w-md w-full hud-panel p-6 space-y-4">
        <div className="text-[10px] uppercase tracking-[0.22em] text-accent-deep">Foundation Macro</div>
        <h2 className="font-serif font-light text-[22px] tracking-[-0.005em] text-surface-foreground">
          {signedIn ? "Subscription required" : "Log in to continue"}
        </h2>
        <p className="text-sm text-muted-foreground">
          {signedIn
            ? "This workspace is included with Turning Point or The Collective. Your current account does not have an active plan. Membership is through foundationmacro.com."
            : "This platform is private to Foundation Macro members."}
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          {signedIn ? (
            <button type="button" className={btnClass} onClick={() => void signOutOfOutseta(logout)}>
              Sign out
            </button>
          ) : (
            <button
              type="button"
              className="text-[10px] uppercase tracking-wider px-4 py-2 rounded-sm bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={() => openLogin()}
            >
              Log in
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
