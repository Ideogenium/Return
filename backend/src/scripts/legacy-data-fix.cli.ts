/* eslint-disable no-console -- stdout/stderr is the interface of this CLI, there is no Nest logger here */
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { formatReport, parseArgs, runLegacyDataFix } from './legacy-data-fix.js';

/**
 * Entry point of `npm run db:legacy-fix`. Plain PrismaClient on purpose: no Nest
 * application, no cron, no event listener is started by this script.
 */
async function main(): Promise<void> {
  const { apply } = parseArgs(process.argv.slice(2));

  const connectionString = process.env['DATABASE_URL'];
  if (!connectionString) throw new Error('DATABASE_URL is required');

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  try {
    const report = await runLegacyDataFix(prisma, { apply });
    formatReport(report).forEach((line) => console.log(line));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
