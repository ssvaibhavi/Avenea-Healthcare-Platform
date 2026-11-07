import { useSearchParams } from "react-router-dom";
import { SignIn, SignUp } from "@clerk/react";
import { Ribbon } from "@/components/Ribbon";

/** Editorial sign-in / sign-up page: brand column (lg+) beside Clerk's own card. */
export default function SignInPage({ mode = "sign-in" }: { mode?: "sign-in" | "sign-up" }) {
  const [params] = useSearchParams();
  const expired = params.get("expired") === "1";

  return (
    <div className="relative isolate overflow-x-clip">
      <div aria-hidden className="absolute -top-40 bottom-0 left-1/2 -z-10 w-screen -translate-x-1/2">
        <Ribbon variant="header" />
      </div>
      <div className="mx-auto grid max-w-7xl gap-12 px-4 pb-16 pt-12 sm:px-6 lg:grid-cols-[1fr_auto] lg:items-center lg:px-8 lg:pt-20">
        <div className="hidden lg:block">
          <div className="flex items-center gap-4">
            <span className="font-heading text-sm italic text-rose-deep">N° 00</span>
            <span className="h-px w-14 bg-gradient-to-r from-dusty to-transparent" />
            <p className="text-[11px] font-medium uppercase tracking-[0.32em] text-dusty">Secure sign-in</p>
          </div>
          <h1 className="mt-6 max-w-xl font-heading text-6xl leading-[1.02] tracking-[-0.02em] text-plum">
            Welcome back to the <em className="ink-rose italic">path.</em>
          </h1>
          <p className="mt-7 max-w-md border-l border-dusty/40 pl-5 text-lg leading-relaxed text-plum-muted">
            Sign in to reach the patients, screenings and referrals assigned to your role. Everything here is synthetic
            demonstration data.
          </p>
        </div>
        <div className="flex flex-col items-center justify-center gap-4" data-testid="auth-card">
          {expired ? (
            <p className="rounded-full border border-rose-border bg-cream/90 px-4 py-2 text-sm text-rose-ink" data-testid="session-expired-message">
              Your session has ended. Please sign in again.
            </p>
          ) : null}
          {mode === "sign-in" ? (
            <SignIn routing="path" path="/sign-in" signUpUrl="/sign-up" withSignUp />
          ) : (
            <SignUp routing="path" path="/sign-up" signInUrl="/sign-in" />
          )}
        </div>
      </div>
    </div>
  );
}