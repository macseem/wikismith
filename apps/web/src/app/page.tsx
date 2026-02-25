import { RepoInput } from '@/components/home/repo-input';
import { AuthNav } from '@/components/auth/auth-nav';
import { getSession } from '@/lib/auth/session';

interface HomePageProps {
  searchParams: Promise<{
    accountDeleted?: string;
  }>;
}

const HomePage = async ({ searchParams }: HomePageProps) => {
  const session = await getSession();
  const params = await searchParams;

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto max-w-6xl w-full px-6 pt-6 flex items-center justify-between">
        <span className="text-sm font-medium text-zinc-300">WikiSmith</span>
        <AuthNav session={session} returnPathname="/dashboard" />
      </div>

      <div className="flex flex-col items-center justify-center min-h-screen px-6">
        {params.accountDeleted === '1' && (
          <div className="mb-6 text-sm rounded-md border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-emerald-300">
            Your account data has been deleted.
          </div>
        )}

        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold tracking-tight mb-4">
            Wiki<span className="text-blue-400">Smith</span>
          </h1>
          <p className="text-xl text-zinc-400 max-w-xl mx-auto">
            Paste a GitHub repository URL and get beautiful, AI-generated documentation organized by
            features.
          </p>
        </div>

        <RepoInput />

        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl">
          <Feature
            title="Feature-Organized"
            description="Documentation grouped by what the software does, not how the code is structured."
          />
          <Feature
            title="Code Citations"
            description="Every claim links back to the actual source code with line-level references."
          />
          <Feature
            title="AI-Powered"
            description="Uses LLMs to understand codebases and generate human-readable explanations."
          />
        </div>
      </div>
    </main>
  );
};

const Feature = ({ title, description }: { title: string; description: string }) => (
  <div className="text-center p-6 rounded-xl border border-zinc-800 bg-zinc-900/50">
    <h3 className="text-lg font-semibold mb-2">{title}</h3>
    <p className="text-sm text-zinc-400">{description}</p>
  </div>
);

export default HomePage;
