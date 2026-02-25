import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getSession } from '@/lib/auth/session';
import { SessionSummary } from '@/components/auth/session-summary';

const SettingsPage = async () => {
  const session = await getSession();
  if (!session) {
    redirect('/sign-in?redirect=/settings');
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-white px-6 py-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-zinc-400">Session, authorization, and account-level controls.</p>
        </header>

        <Card className="p-6 bg-zinc-900/70 border-zinc-800 space-y-4">
          <h2 className="text-lg font-semibold">Session details</h2>
          <SessionSummary />
        </Card>

        <Card className="p-6 bg-zinc-900/70 border-zinc-800 space-y-3">
          <h2 className="text-lg font-semibold">Account actions</h2>
          <p className="text-sm text-zinc-400">
            Need to fully remove your repositories, wiki versions, and encrypted GitHub tokens?
          </p>
          <Button asChild variant="outline" size="sm">
            <Link href="/account">Open account danger zone</Link>
          </Button>
        </Card>
      </div>
    </main>
  );
};

export default SettingsPage;
