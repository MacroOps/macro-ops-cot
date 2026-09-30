import { useCallback, useEffect, useMemo, useState } from "react";
import { useOutseta } from "@outseta/react";
import { getOutsetaAccessToken } from "@/lib/outseta/edge";
import { planUidFromJwt } from "@/lib/outseta/plans";
import {
  applyViewAs,
  flagsFromPlan,
  hasProductAccess,
  type AccessFlags,
  type ViewAsMode,
} from "@/lib/outseta/entitlements";
import { readViewAs, writeViewAs } from "@/lib/outseta/viewAs";

export function useEntitlements() {
  const { user, isLoading } = useOutseta();
  const fromUser = user?.Account?.CurrentSubscription?.Plan?.Uid ?? null;
  const [jwtPlan, setJwtPlan] = useState<string | null | undefined>(undefined);
  const [viewAs, setViewAsState] = useState<ViewAsMode>(readViewAs);

  useEffect(() => {
    if (!user) {
      setJwtPlan(null);
      return;
    }
    let cancelled = false;
    getOutsetaAccessToken().then((token) => {
      if (cancelled) return;
      if (!token) {
        setJwtPlan(fromUser ? undefined : null);
        return;
      }
      if (!fromUser) setJwtPlan(planUidFromJwt(token));
      else setJwtPlan(undefined);
    });
    return () => {
      cancelled = true;
    };
  }, [user, fromUser]);

  const planUid = fromUser || jwtPlan || null;
  const waitingOnJwt = !!user && !fromUser && jwtPlan === undefined;
  const realFlags: AccessFlags = useMemo(() => flagsFromPlan(planUid), [planUid]);
  const flags = applyViewAs(realFlags, realFlags.isStaff ? viewAs : "staff");

  const setViewAs = useCallback((mode: ViewAsMode) => {
    writeViewAs(mode);
    setViewAsState(mode);
  }, []);

  return {
    isLoading: isLoading || waitingOnJwt,
    signedIn: !!user,
    planUid,
    hasAccess: hasProductAccess(flags),
    canViewAs: realFlags.isStaff,
    viewAs: realFlags.isStaff ? viewAs : "staff",
    setViewAs,
    ...flags,
  };
}

/** @deprecated prefer useEntitlements — kept so existing shells keep compiling */
export function useCollectiveAccess() {
  const e = useEntitlements();
  return {
    isLoading: e.isLoading,
    signedIn: e.signedIn,
    hasAccess: e.hasAccess,
    planUid: e.planUid,
  };
}
