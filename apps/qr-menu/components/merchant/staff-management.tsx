"use client";

import { useActionState, useState, useTransition } from "react";
import {
  acceptInvite,
  inviteStaff,
  revokeStaff,
  type StaffActionResult,
} from "@/lib/identity/staff-actions";
import type { StaffRole } from "@/lib/identity/permissions";

type StaffRow = {
  id: string;
  email: string | null;
  displayName: string;
  role: StaffRole;
  invitedAt: Date | string | null;
  acceptedAt: Date | string | null;
  revokedAt: Date | string | null;
};

const initialState: StaffActionResult = { status: "success" };

export function StaffManagement({
  staff,
  inviteToken,
}: {
  staff: StaffRow[];
  inviteToken?: string;
}) {
  const [state, formAction, pending] = useActionState(inviteStaff, initialState);

  return (
    <div className="px-6 py-5 flex flex-col gap-6">
      {inviteToken ? <AcceptInvite token={inviteToken} /> : null}

      <form action={formAction} className="border border-outline p-4 flex flex-col gap-3">
        <h2 className="font-mono font-bold uppercase tracking-widest text-[12px]">
          Inviter un membre
        </h2>
        <label className="flex flex-col gap-1 font-mono text-[11px] uppercase tracking-widest text-ink/60">
          Email
          <input
            name="email"
            type="email"
            required
            className="border border-outline bg-base px-3 py-2 font-sans text-[14px] normal-case tracking-normal text-ink"
          />
        </label>
        <label className="flex flex-col gap-1 font-mono text-[11px] uppercase tracking-widest text-ink/60">
          Nom
          <input
            name="displayName"
            className="border border-outline bg-base px-3 py-2 font-sans text-[14px] normal-case tracking-normal text-ink"
          />
        </label>
        <label className="flex flex-col gap-1 font-mono text-[11px] uppercase tracking-widest text-ink/60">
          Role
          <select
            name="role"
            defaultValue="waiter"
            className="border border-outline bg-base px-3 py-2 font-sans text-[14px] normal-case tracking-normal text-ink"
          >
            <option value="manager">Manager</option>
            <option value="waiter">Serveur</option>
            <option value="kitchen">Cuisine</option>
            <option value="cashier">Caisse</option>
          </select>
        </label>
        <button
          type="submit"
          disabled={pending}
          className="bg-ink text-base px-5 py-3 font-mono font-bold uppercase tracking-widest text-[12px] hover:bg-accent transition-colors border-2 border-ink disabled:opacity-60"
        >
          {pending ? "..." : "Inviter"}
        </button>
        {state.message ? (
          <p
            role={state.status === "error" ? "alert" : "status"}
            className="font-mono text-[11px] uppercase tracking-widest text-ink/55"
          >
            {state.message}
          </p>
        ) : null}
      </form>

      <div className="flex flex-col border border-outline">
        {staff.map((member) => (
          <StaffListRow key={member.id} member={member} />
        ))}
      </div>
    </div>
  );
}

function AcceptInvite({ token }: { token: string }) {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="border-2 border-ink p-4 flex flex-col gap-3">
      <p className="font-sans text-sm text-ink/70">
        Une invitation est en attente pour ce compte.
      </p>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await acceptInvite(token);
            setMessage(result.message ?? (result.status === "success" ? "Invitation acceptee" : "Erreur"));
          })
        }
        className="bg-ink text-base px-5 py-3 font-mono font-bold uppercase tracking-widest text-[12px] border-2 border-ink disabled:opacity-60"
      >
        {pending ? "..." : "Accepter"}
      </button>
      {message ? <p className="font-mono text-[11px] uppercase tracking-widest">{message}</p> : null}
    </div>
  );
}

function StaffListRow({ member }: { member: StaffRow }) {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const active = !member.revokedAt;

  return (
    <div className="p-4 border-b border-outline last:border-b-0 flex flex-col gap-2">
      <div className="flex justify-between gap-3">
        <div className="min-w-0">
          <p className="font-sans font-bold text-[14px] truncate">{member.displayName}</p>
          <p className="font-mono text-[11px] text-ink/50 truncate">
            {member.email ?? "-"}
          </p>
        </div>
        <span className="font-mono text-[10px] uppercase tracking-widest text-ink/60">
          {member.role}
        </span>
      </div>
      <div className="flex justify-between items-center gap-3">
        <p className="font-mono text-[10px] uppercase tracking-widest text-ink/45">
          {member.acceptedAt ? "Actif" : active ? "Invite" : "Retire"}
        </p>
        {active && member.role !== "owner" ? (
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await revokeStaff(member.id);
                setMessage(result.message ?? (result.status === "success" ? "Retire" : "Erreur"));
              })
            }
            className="font-mono text-[10px] uppercase tracking-widest text-accent disabled:opacity-60"
          >
            Retirer
          </button>
        ) : null}
      </div>
      {message ? <p className="font-mono text-[10px] uppercase tracking-widest">{message}</p> : null}
    </div>
  );
}
