import { useOutseta } from "@outseta/react";
import { LogOut, User as UserIcon } from "lucide-react";

const btnClass =
  "flex items-center gap-1.5 text-[10px] uppercase tracking-wider px-2 py-1 border border-border rounded-sm hover:bg-muted transition-colors";

/** Outseta login in the HUD header. Does not gate routes. */
export function OutsetaAuthControls() {
  const { user, openLogin, openSignup, openProfile, logout } = useOutseta();

  if (user) {
    const label = user.FirstName || user.Email?.split("@")[0] || "Account";
    return (
      <>
        <button
          type="button"
          onClick={() => openProfile({ tab: "profile" })}
          className={btnClass}
          aria-label="Profile"
        >
          <UserIcon className="h-3 w-3" />
          <span className="hidden sm:inline">{label}</span>
        </button>
        <button type="button" onClick={logout} className={btnClass} aria-label="Sign out">
          <LogOut className="h-3 w-3" />
          <span className="hidden sm:inline">Sign out</span>
        </button>
      </>
    );
  }

  return (
    <>
      <button type="button" onClick={() => openLogin()} className={btnClass} aria-label="Log in">
        <UserIcon className="h-3 w-3" />
        <span className="hidden sm:inline">Log in</span>
      </button>
      <button type="button" onClick={() => openSignup()} className={btnClass} aria-label="Sign up">
        <span className="hidden sm:inline">Sign up</span>
      </button>
    </>
  );
}
