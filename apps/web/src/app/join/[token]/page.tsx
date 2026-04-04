"use client";

import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { acceptInvite } from "@/lib/api";

export default function JoinPage() {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-4 py-8 sm:px-6">
      <section className="panel w-full rounded-[2rem] p-6 sm:p-8">
        <p className="section-label">Accept invite</p>
        <h1 className="display-font mt-3 text-4xl font-semibold">
          Join your teacher community
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--ink-soft)]">
          Finish setup with your name, then return to the sign-in page and request
          your OTP using the same invited email.
        </p>

        <div className="mt-6 rounded-[1.5rem] border border-[var(--line)] bg-[var(--panel-muted)] p-5">
          <label className="block">
            <span className="section-label">Full name</span>
            <input
              className="mt-2 w-full rounded-[1.2rem] border border-[var(--line)] bg-[var(--panel-strong)] px-4 py-3 text-[var(--ink)] outline-none placeholder:text-[var(--ink-soft)]"
              placeholder="A teacher name for your profile"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              className="inline-flex items-center justify-center rounded-full bg-[var(--ink)] px-5 py-3 text-sm font-semibold text-[var(--panel-strong)] transition hover:opacity-95 disabled:opacity-60"
              disabled={submitting || name.trim().length < 2}
              onClick={async () => {
                setSubmitting(true);
                try {
                  await acceptInvite(params.token, name);
                  toast.success("Invite accepted");
                  router.push("/");
                } catch (error) {
                  toast.error(
                    error instanceof Error
                      ? error.message
                      : "Unable to accept the invite.",
                  );
                } finally {
                  setSubmitting(false);
                }
              }}
              type="button"
            >
              {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
              <span className={submitting ? "ml-2" : ""}>Accept invite</span>
            </button>

            <Link
              className="rounded-full border border-[var(--line)] bg-[var(--panel-muted)] px-5 py-3 text-sm font-semibold transition hover:bg-[var(--panel-strong)]"
              href="/"
            >
              Back to sign in
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
