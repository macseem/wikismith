import { signOut } from '@workos-inc/authkit-nextjs';
import { redirect } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getSession } from '@/lib/auth/session';
import { deleteUserByWorkOSId } from '@/lib/auth/user-store';

interface AccountPageProps {
  searchParams: Promise<{ error?: string }>;
}

const AccountPage = async ({ searchParams }: AccountPageProps) => {
  const session = await getSession();
  if (!session) {
    redirect('/sign-in?redirect=/account');
  }

  const params = await searchParams;

  return (
    <main className="min-h-screen bg-zinc-950 text-white px-6 py-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Account</h1>
          <p className="text-zinc-400">
            Manage your profile and permanently delete all WikiSmith data.
          </p>
        </header>

        <Card className="p-6 bg-red-950/30 border-red-500/40 space-y-4">
          <h2 className="text-lg font-semibold text-red-300">Danger zone</h2>
          <p className="text-sm text-red-200/80">
            This permanently deletes your account, repositories, generated wikis, rate-limit
            history, and encrypted GitHub tokens.
          </p>

          {params.error === 'invalid_confirmation' && (
            <p className="text-sm text-red-300 border border-red-400/40 bg-red-500/10 rounded-md px-3 py-2">
              Type DELETE exactly to confirm account removal.
            </p>
          )}

          <form
            className="space-y-3"
            action={async (formData) => {
              'use server';

              const confirmation = String(formData.get('confirmation') ?? '').trim();
              if (confirmation !== 'DELETE') {
                redirect('/account?error=invalid_confirmation');
              }

              await deleteUserByWorkOSId(session.user.workosId);
              await signOut({ returnTo: '/?accountDeleted=1' });
            }}
          >
            <label htmlFor="confirmation" className="block text-sm text-red-200">
              Type DELETE to confirm
            </label>
            <input
              id="confirmation"
              name="confirmation"
              type="text"
              autoComplete="off"
              className="w-full h-11 rounded-md bg-zinc-950 border border-red-500/40 px-3 text-sm"
            />

            <Button type="submit" variant="destructive" className="w-full sm:w-auto">
              Delete account forever
            </Button>
          </form>
        </Card>
      </div>
    </main>
  );
};

export default AccountPage;
