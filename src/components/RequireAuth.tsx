import { useEffect } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "@/hooks/useAuth";
import { LOGIN_PATH } from "@/const";
import { AuthLayoutSkeleton } from "@/components/AuthLayoutSkeleton";
import type { ReactNode } from "react";

/**
 * Minimal auth gate for the member portal. Consumes the graft's auth contract
 * (useAuth + LOGIN_PATH) without modifying graft-owned files. The portal has
 * its own shell (PortalLayout), so the graft's AuthLayout sidebar shell is
 * intentionally not used here.
 */
export default function RequireAuth({ children }: { children: ReactNode }) {
  const { isLoading, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && !user) {
      navigate(LOGIN_PATH, { replace: true });
    }
  }, [isLoading, user, navigate]);

  if (isLoading) return <AuthLayoutSkeleton />;
  if (!user) return null;
  return <>{children}</>;
}
