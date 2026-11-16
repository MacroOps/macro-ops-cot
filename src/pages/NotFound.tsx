import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-16">
      <div className="max-w-md w-full hud-panel p-6 space-y-4">
        <div className="text-[10px] uppercase tracking-[0.22em] text-accent-deep">
          Foundation Macro · 404
        </div>
        <h1 className="font-serif font-light text-[22px] tracking-[-0.005em] text-surface-foreground">
          Page not found
        </h1>
        <p className="text-sm text-muted-foreground">
          There is no page at{" "}
          <span className="font-mono text-xs text-surface-foreground break-all">{location.pathname}</span>. The link
          may be old or mistyped.
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          <Link
            to="/"
            className="text-[10px] uppercase tracking-wider px-3 py-1.5 border border-border rounded-sm hover:border-primary hover:text-primary"
          >
            Return to Terminus
          </Link>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
