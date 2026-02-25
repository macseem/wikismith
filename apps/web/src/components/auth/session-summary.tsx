'use client';

import { useSession } from '@/hooks/use-session';

export const SessionSummary = () => {
  const { session, loading } = useSession();

  if (loading) {
    return <p className="text-sm text-zinc-500">Loading session...</p>;
  }

  if (!session) {
    return <p className="text-sm text-zinc-500">No active session found.</p>;
  }

  return (
    <div className="space-y-1 text-sm text-zinc-300">
      <p>
        <span className="text-zinc-500">User:</span> {session.user.email}
      </p>
      <p>
        <span className="text-zinc-500">WorkOS ID:</span> {session.user.workosId}
      </p>
      <p>
        <span className="text-zinc-500">Session ID:</span> {session.sessionId}
      </p>
    </div>
  );
};
