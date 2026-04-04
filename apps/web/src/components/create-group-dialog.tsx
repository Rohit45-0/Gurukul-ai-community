"use client";

import * as Dialog from "@radix-ui/react-dialog";
import * as Switch from "@radix-ui/react-switch";
import { CircleAlert, Sparkles, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { createGroup } from "@/lib/api";
import { cn } from "@/lib/cn";

export function CreateGroupDialog({
  token,
  onCreated,
}: {
  token: string;
  onCreated: () => Promise<void> | void;
}) {
  const [open, setOpen] = useState(false);
  const [confirmPublic, setConfirmPublic] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const trimmedName = name.trim();
  const trimmedDescription = description.trim();
  const nameTooShort = trimmedName.length > 0 && trimmedName.length < 3;
  const descriptionTooShort =
    trimmedDescription.length > 0 && trimmedDescription.length < 3;
  const canSubmit =
    !submitting && trimmedName.length >= 3 && trimmedDescription.length >= 3;

  const closeAndReset = () => {
    setOpen(false);
    setConfirmPublic(false);
    setName("");
    setDescription("");
    setIsPublic(false);
  };

  const submit = async () => {
    setSubmitting(true);
    try {
      await createGroup(token, {
        name,
        description,
        visibilityScope: isPublic ? "global_public" : "organization",
      });
      toast.success("Group created");
      closeAndReset();
      await Promise.resolve(onCreated());
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to create the group.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog.Root onOpenChange={setOpen} open={open}>
      <Dialog.Trigger asChild>
        <button className="inline-flex items-center gap-2 rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-[var(--panel-strong)] transition hover:opacity-95">
          <Sparkles className="size-4" />
          Create a group
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-[rgba(23,50,77,0.3)] backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 flex max-h-[min(94vh,760px)] w-[min(92vw,620px)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-[2rem] border border-[var(--line)] bg-[var(--panel-strong)] p-5 shadow-[0_30px_90px_rgba(23,50,77,0.18)] sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="display-font text-3xl font-semibold">
                Start a teaching circle
              </Dialog.Title>
              <Dialog.Description className="mt-2 text-sm leading-6 text-[var(--ink-soft)]">
                Create a local staff discussion or turn the group public across all
                institutions using a single toggle.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button className="rounded-full border border-[var(--line)] p-2 transition hover:bg-[var(--hover)]">
                <X className="size-4" />
              </button>
            </Dialog.Close>
          </div>

          <div className="rich-scrollbar mt-6 flex-1 space-y-4 overflow-y-auto pr-1">
            <label className="block">
              <span className="section-label">Group name</span>
              <input
                className={cn(
                  "mt-2 w-full rounded-[1.2rem] border bg-[var(--panel-muted)] px-4 py-3 outline-none",
                  nameTooShort
                    ? "border-[rgba(224,104,74,0.45)]"
                    : "border-[var(--line)]",
                )}
                placeholder="Maths"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
              <p className="mt-2 text-xs leading-5 text-[var(--ink-soft)]">
                Use at least 3 characters.
              </p>
            </label>

            <label className="block">
              <span className="section-label">Purpose</span>
              <textarea
                className={cn(
                  "mt-2 min-h-32 w-full rounded-[1.2rem] border bg-[var(--panel-muted)] px-4 py-3 outline-none",
                  descriptionTooShort
                    ? "border-[rgba(224,104,74,0.45)]"
                    : "border-[var(--line)]",
                )}
                placeholder="Notes"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
              <p className="mt-2 text-xs leading-5 text-[var(--ink-soft)]">
                Short purpose is fine. Use at least 3 characters.
              </p>
            </label>

            <div className="rounded-[1.4rem] border border-[var(--line)] bg-[var(--panel-muted)] p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-semibold">Open to all teachers</p>
                  <p className="mt-1 text-sm leading-6 text-[var(--ink-soft)]">
                    When enabled, this group becomes visible and joinable across the
                    full platform.
                  </p>
                </div>
                <Switch.Root
                  checked={isPublic}
                  className="relative h-7 w-13 rounded-full bg-[var(--line)] transition data-[state=checked]:bg-[var(--success)]"
                  onCheckedChange={(checked) => {
                    if (checked && !confirmPublic) {
                      setConfirmPublic(true);
                    }
                    setIsPublic(checked);
                  }}
                >
                  <Switch.Thumb className="block size-5 translate-x-1 rounded-full bg-[var(--panel-strong)] transition data-[state=checked]:translate-x-7" />
                </Switch.Root>
              </div>

              {isPublic ? (
                <div className="mt-4 rounded-[1.2rem] border border-[var(--danger-soft)] bg-[var(--danger-soft)] p-4">
                  <div className="flex gap-3">
                    <CircleAlert className="mt-0.5 size-5 shrink-0 text-[var(--danger)]" />
                    <div className="text-sm leading-6 text-[var(--ink-soft)]">
                      This group and its future content will be visible across the app
                      to authenticated teachers. Turning public access off later is
                      blocked if cross-school activity already happened.
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <div className="mt-4 border-t border-[var(--line)] bg-[var(--panel-strong)] pt-4">
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                className="rounded-full border border-[var(--line)] px-5 py-3 text-sm font-semibold transition hover:bg-[var(--hover)]"
                onClick={closeAndReset}
                type="button"
              >
                Cancel
              </button>
              <button
                className={cn(
                  "rounded-full px-5 py-3 text-sm font-semibold text-[var(--panel-strong)] transition",
                  canSubmit
                    ? "bg-[var(--ink)] hover:opacity-95"
                    : "cursor-not-allowed bg-[var(--ink)]/45",
                )}
                disabled={!canSubmit}
                onClick={() => void submit()}
                type="button"
              >
                {submitting ? "Creating..." : "Create group"}
              </button>
            </div>
            {!canSubmit ? (
              <p className="mt-3 text-center text-xs leading-5 text-[var(--accent)] sm:text-right">
                Add at least 3 characters for both group name and purpose.
              </p>
            ) : null}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
