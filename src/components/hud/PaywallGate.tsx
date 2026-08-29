import { useOutseta } from "@outseta/react";

const btnClass =
  "text-[10px] uppercase tracking-wider px-3 py-1.5 border border-border rounded-sm hover:border-primary hover:text-primary";

export function PaywallGate({ signedIn }: { signedIn: boolean }) {
  const { openLogin, openSignup, openProfile, logout } = useOutseta();

  return (
    <div className="flex-1 flex items-center justify-center px-4 py-16">
      <div className="max-w-md w-full hud-panel p-6 space-y-4">
        <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">The Collective</div>
        <h2 className="text-lg font-semibold tracking-tight text-surface-foreground">
          {signedIn ? "Subscription required" : "Log in to continue"}
        </h2>
        <p className="text-sm text-muted-foreground">
          {signedIn
            ? "This workspace is included with The Collective. Your current account does not have an active plan."
            : "Terminus is for Collective members. Log in or subscribe to open the research HUD."}
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          {signedIn ? (
            <>
              <button type="button" className={btnClass} onClick={() => openProfile({ tab: "planChange" })}>
                View plans
              </button>
              <button type="button" className={btnClass} onClick={logout}>
                Sign out
              </button>
            </>
          ) : (
            <>
              <button type="button" className={btnClass} onClick={() => openLogin()}>
                Log in
              </button>
              <button type="button" className={btnClass} onClick={() => openSignup()}>
                Subscribe
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
