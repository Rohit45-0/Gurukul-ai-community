"use client";

import { Loader2, Mail, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { requestOtp, verifyOtp } from "@/lib/api";
import { useSession } from "@/lib/session";

export function AuthGateway() {
  const router = useRouter();
  const { signIn } = useSession();
  const emailInputRef = useRef<HTMLInputElement>(null);
  const codeInputRef = useRef<HTMLInputElement>(null);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "otp">("email");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const submitEmail = async () => {
    const nextEmail = emailInputRef.current?.value.trim() ?? email.trim();

    if (!nextEmail) {
      setErrorMessage("Enter your invited teacher email first.");
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      const response = await requestOtp(nextEmail);
      setEmail(nextEmail);
      setDevCode(response.devOtpCode ?? null);
      setStep("otp");
      setStatusMessage(
        "OTP sent. If debug OTP mode is enabled for this environment, the code is shown below.",
      );
      toast.success("OTP sent", {
        description: `Use the code sent to ${nextEmail}.`,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to send OTP.";
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const submitOtp = async () => {
    const nextCode =
      codeInputRef.current?.value.replace(/\D+/g, "").slice(0, 6) ??
      code.replace(/\D+/g, "").slice(0, 6);

    if (!email.trim()) {
      setErrorMessage("Request the OTP first, then enter the code.");
      return;
    }

    if (nextCode.length !== 6) {
      setErrorMessage("Enter the 6-digit OTP code.");
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);
    try {
      setCode(nextCode);
      const response = await verifyOtp(email, nextCode);
      await signIn(response.token);
      toast.success("Welcome back", {
        description: "Your teacher workspace is ready.",
      });
      router.push("/community");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to verify your code.";
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="panel rounded-[1.75rem] p-5 sm:p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="section-label">Secure access</p>
          <h2 className="display-font mt-2 text-3xl font-semibold">
            Enter the staffroom
          </h2>
        </div>
        <div className="rounded-full border border-[var(--line)] bg-[var(--panel-muted)] p-3">
          <ShieldCheck className="size-5 text-[var(--success)]" />
        </div>
      </div>

      <p className="mt-4 text-sm leading-6 text-[var(--ink-soft)]">
        Sign in with your invited teacher email. In local development, or in a test
        deployment with debug OTP mode enabled, the code is shown directly below.
      </p>

      <div className="mt-6 space-y-4">
        <label className="block">
          <span className="section-label">Teacher email</span>
          <div className="mt-2 flex items-center gap-3 rounded-[1.2rem] border border-[var(--line)] bg-[var(--panel-muted)] px-4 py-3">
            <Mail className="size-4 text-[var(--ink-soft)]" />
            <input
              autoComplete="email"
              className="w-full bg-transparent text-base outline-none placeholder:text-[var(--ink-soft)]/70"
              defaultValue={email}
              name="email"
              placeholder="name@school.edu"
              ref={emailInputRef}
              type="email"
              onInput={(event) =>
                setEmail((event.target as HTMLInputElement).value)
              }
            />
          </div>
        </label>

        {step === "otp" ? (
          <label className="block">
            <span className="section-label">One-time code</span>
            <input
              autoComplete="one-time-code"
              className="mt-2 w-full rounded-[1.2rem] border border-[var(--line)] bg-[var(--panel-muted)] px-4 py-3 text-base tracking-[0.45em] outline-none"
              defaultValue={code}
              inputMode="numeric"
              name="otp"
              placeholder="000000"
              ref={codeInputRef}
              onInput={(event) =>
                setCode(
                  (event.target as HTMLInputElement).value
                    .replace(/\D+/g, "")
                    .slice(0, 6),
                )
              }
            />
          </label>
        ) : null}
      </div>

      {statusMessage ? (
        <div
          aria-live="polite"
          className="mt-4 rounded-[1.2rem] border border-[var(--success-soft)] bg-[var(--success-soft)] p-4 text-sm leading-6 text-[var(--ink-soft)]"
        >
          {statusMessage}
        </div>
      ) : null}

      {errorMessage ? (
        <div
          aria-live="polite"
          className="mt-4 rounded-[1.2rem] border border-[var(--danger-soft)] bg-[var(--danger-soft)] p-4 text-sm leading-6 text-[var(--danger)]"
        >
          {errorMessage}
        </div>
      ) : null}

      {devCode ? (
        <div className="mt-4 rounded-[1.2rem] border border-[var(--success-soft)] bg-[var(--success-soft)] p-4">
          <p className="section-label text-[var(--success)]">Dev helper</p>
          <p className="mt-2 text-sm leading-6 text-[var(--ink-soft)]">
            OTP for this session:{" "}
            <span className="font-semibold tracking-[0.28em] text-[var(--ink)]">
              {devCode}
            </span>
          </p>
        </div>
      ) : null}

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <button
          className="inline-flex items-center justify-center rounded-full bg-[var(--ink)] px-5 py-3 text-sm font-semibold text-[var(--panel-strong)] transition hover:translate-y-[-1px] hover:opacity-95"
          disabled={submitting}
          onClick={step === "email" ? submitEmail : submitOtp}
          type="button"
        >
          {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
          <span className={submitting ? "ml-2" : ""}>
            {step === "email" ? "Send OTP" : "Verify and enter"}
          </span>
        </button>
        {step === "otp" ? (
          <button
            className="rounded-full border border-[var(--line)] px-5 py-3 text-sm font-semibold text-[var(--ink)] transition hover:bg-[var(--hover)]"
            disabled={submitting}
            onClick={() => {
              setStep("email");
              setCode("");
              setDevCode(null);
              setStatusMessage(null);
              setErrorMessage(null);
              if (codeInputRef.current) {
                codeInputRef.current.value = "";
              }
            }}
            type="button"
          >
            Use another email
          </button>
        ) : null}
      </div>
    </section>
  );
}
