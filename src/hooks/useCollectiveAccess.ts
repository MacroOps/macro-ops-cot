import { useEffect, useState } from "react";
import { useOutseta } from "@outseta/react";
import { getOutsetaAccessToken } from "@/lib/outseta/edge";
import { isCollectivePlanUid, planUidFromJwt } from "@/lib/outseta/plans";

export function useCollectiveAccess() {
  const { user, isLoading } = useOutseta();
  const fromUser = user?.Account?.CurrentSubscription?.Plan?.Uid ?? null;
  const [jwtPlan, setJwtPlan] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    if (!user) {
      setJwtPlan(null);
      return;
    }
    if (fromUser) {
      setJwtPlan(undefined);
      return;
    }
    let cancelled = false;
    getOutsetaAccessToken().then((token) => {
      if (cancelled) return;
      setJwtPlan(token ? planUidFromJwt(token) : null);
    });
    return () => {
      cancelled = true;
    };
  }, [user, fromUser]);

  const planUid = fromUser || jwtPlan || null;
  const waitingOnJwt = !!user && !fromUser && jwtPlan === undefined;

  return {
    isLoading: isLoading || waitingOnJwt,
    signedIn: !!user,
    hasAccess: isCollectivePlanUid(planUid),
    planUid,
  };
}
