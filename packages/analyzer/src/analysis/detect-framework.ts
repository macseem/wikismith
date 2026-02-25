import type { IIngestionResult } from '@wikismith/shared';

interface FrameworkSignal {
  name: string;
  detect: (ingestion: IIngestionResult) => boolean;
}

const dependencyMatch =
  (depNames: string[]) =>
  (ingestion: IIngestionResult): boolean => {
    const pkgJsons = ingestion.manifests.filter((m) => m.path.endsWith('package.json'));
    return pkgJsons.some((m) => {
      try {
        const pkg = JSON.parse(m.content) as Record<string, Record<string, unknown>>;
        const allDeps = {
          ...pkg['dependencies'],
          ...pkg['devDependencies'],
        };
        return depNames.some((dep) => dep in allDeps);
      } catch {
        return false;
      }
    });
  };

const fileExists =
  (patterns: RegExp[]) =>
  (ingestion: IIngestionResult): boolean =>
    patterns.some((re) => ingestion.fileTree.some((f) => re.test(f)));

const FRAMEWORKS: FrameworkSignal[] = [
  { name: 'Next.js', detect: dependencyMatch(['next']) },
  { name: 'React', detect: dependencyMatch(['react']) },
  { name: 'Vue', detect: dependencyMatch(['vue']) },
  { name: 'Svelte', detect: dependencyMatch(['svelte']) },
  { name: 'Angular', detect: dependencyMatch(['@angular/core']) },
  { name: 'Astro', detect: dependencyMatch(['astro']) },
  { name: 'Nuxt', detect: dependencyMatch(['nuxt']) },
  { name: 'Express', detect: dependencyMatch(['express']) },
  { name: 'Fastify', detect: dependencyMatch(['fastify']) },
  { name: 'Hono', detect: dependencyMatch(['hono']) },
  { name: 'NestJS', detect: dependencyMatch(['@nestjs/core']) },
  { name: 'tRPC', detect: dependencyMatch(['@trpc/server']) },
  { name: 'Prisma', detect: dependencyMatch(['prisma', '@prisma/client']) },
  { name: 'Drizzle', detect: dependencyMatch(['drizzle-orm']) },
  { name: 'Django', detect: fileExists([/manage\.py$/]) },
  { name: 'Flask', detect: fileExists([/app\.py$/]) },
  { name: 'FastAPI', detect: fileExists([/main\.py$/]) },
  { name: 'Gin', detect: fileExists([/go\.mod$/]) },
  { name: 'Actix', detect: fileExists([/Cargo\.toml$/]) },
  { name: 'Rails', detect: fileExists([/Gemfile$/]) },
  { name: 'Spring', detect: fileExists([/pom\.xml$/, /build\.gradle$/]) },
  { name: 'Tailwind CSS', detect: dependencyMatch(['tailwindcss']) },
];

export const detectFrameworks = (ingestion: IIngestionResult): string[] =>
  FRAMEWORKS.filter((fw) => fw.detect(ingestion)).map((fw) => fw.name);
