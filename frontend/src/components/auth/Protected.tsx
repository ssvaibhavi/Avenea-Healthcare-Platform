import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Show } from "@clerk/react";

/** Signed-in-only content; signed-out visitors go to /sign-in (the server enforces access regardless). */
export function Protected({ children }: { children: ReactNode }) {
  const location = useLocation();
  return (
    <>
      <Show when="signed-in">{children}</Show>
      <Show when="signed-out">
        <Navigate to="/sign-in" replace state={{ from: location.pathname }} />
      </Show>
    </>
  );
}
