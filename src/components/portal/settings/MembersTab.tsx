import { useState } from 'react';
import { Icon } from '@iconify/react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { trpc } from '@/providers/trpc';
import { icons } from '@/lib/icons';
import { cn } from '@/lib/utils';
import Modal from '@/components/portal/alerts/Modal';
import { LoadingBlock, ErrorBlock } from '@/components/portal/alerts/QueryState';

const ROLE_LABEL: Record<string, string> = {
  admin: 'Admin',
  member: 'Member',
  viewer: 'Agency',
};

function initials(name: string) {
  return name
    .split(/[\s.]+/)
    .filter(Boolean)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export default function MembersTab({ notify }: { notify: (msg: string) => void }) {
  const members = trpc.settings.members.useQuery();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('member');

  const sendInvite = () => {
    const email = inviteEmail.trim();
    if (!email || !email.includes('@')) {
      notify('Enter a valid email address to send the invite.');
      return;
    }
    setInviteOpen(false);
    setInviteEmail('');
    setInviteRole('member');
    notify(`Invitation sent to ${email} — they'll join as ${ROLE_LABEL[inviteRole]}.`);
  };

  if (members.isLoading) return <LoadingBlock rows={6} />;
  if (members.isError)
    return <ErrorBlock message={members.error.message} onRetry={() => members.refetch()} />;
  if (!members.data) return null;

  return (
    <div className="rounded-ares border border-ares-border bg-ares-card">
      <div className="flex items-center justify-between gap-3 border-b border-ares-border px-5 py-4">
        <div>
          <p className="font-label text-ares-primary">Members</p>
          <p className="mt-1 text-[10px] font-light text-ares-muted">
            Unlimited seats included in your plan.
          </p>
        </div>
        <button className="btn-primary !px-3 !py-1.5 text-[10px]" onClick={() => setInviteOpen(true)}>
          <Icon icon={icons.userPlusRounded} width={13} height={13} />
          Invite member
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Member</th>
              <th>Email</th>
              <th>Role</th>
              <th>Last active</th>
            </tr>
          </thead>
          <tbody>
            {members.data.map((m, i) => (
              <motion.tr
                key={m.memberId}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: i * 0.04 }}
                className={cn(m.isYou && 'bg-ares-primary/[0.04]')}
              >
                <td>
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ares-tertiary text-[9px] font-normal tracking-[0.04em] text-white">
                      {initials(m.name ?? m.email ?? '?')}
                    </span>
                    <span className="text-ares-secondarytext">
                      {m.name ?? '—'}
                      {m.isYou && <span className="ml-1.5 text-ares-muted">(you)</span>}
                    </span>
                  </div>
                </td>
                <td className="text-ares-muted">{m.email}</td>
                <td>
                  <span
                    className={cn(
                      'badge-pill',
                      m.role === 'admin'
                        ? 'border-ares-primary/40 text-ares-primary'
                        : 'text-ares-muted'
                    )}
                  >
                    {ROLE_LABEL[m.role] ?? m.role}
                  </span>
                </td>
                <td className="text-ares-muted">
                  {m.lastActive ? format(new Date(m.lastActive), 'MMM dd, HH:mm') : '—'}
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        title="Invite member"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setInviteOpen(false)}>
              Cancel
            </button>
            <button className="btn-primary" onClick={sendInvite}>
              Send invite
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="font-label text-ares-muted">Email</label>
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="teammate@northwindadvisory.com"
              className="mt-1.5 w-full rounded-ares border border-ares-border bg-ares-card px-3 py-2 text-[12px] font-light text-ares-secondarytext placeholder:text-ares-muted focus:border-ares-primary focus:outline-none"
            />
          </div>
          <div>
            <label className="font-label text-ares-muted">Role</label>
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value)}
              className="mt-1.5 w-full rounded-ares border border-ares-border bg-ares-card px-3 py-2 text-[12px] font-light text-ares-secondarytext focus:border-ares-primary focus:outline-none"
            >
              <option value="admin">Admin</option>
              <option value="member">Member</option>
              <option value="viewer">Agency (view only)</option>
            </select>
          </div>
          <p className="text-[10px] font-light text-ares-muted">
            Unlimited seats included in your plan.
          </p>
        </div>
      </Modal>
    </div>
  );
}
