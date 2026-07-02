import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import matter from 'gray-matter';
import { validateOkfDocument } from '../src/github/parser';

function main() {
  const docsPath = process.argv[2] || 'docs';

  if (!statSync(docsPath).isDirectory()) {
    console.error(`Not a directory: ${docsPath}`);
    process.exit(1);
  }

  const files = findMdFiles(docsPath);
  let valid = 0;
  let invalid = 0;

  for (const file of files) {
    const content = readFileSync(file, 'utf-8');
    const { data } = matter(content);
    const errors = validateOkfDocument(data);

    if (errors.length > 0) {
      console.error(`\n✗ ${file}`);
      errors.forEach(e => console.error(`  - ${e}`));
      invalid++;
    } else {
      valid++;
    }
  }

  console.log(`\nResults: ${valid} valid, ${invalid} invalid out of ${files.length} files`);

  if (invalid > 0) process.exit(1);
}

function findMdFiles(dir: string): string[] {
  const results: string[] = [];

  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      results.push(...findMdFiles(fullPath));
    } else if (entry.endsWith('.md')) {
      results.push(fullPath);
    }
  }

  return results;
}

main();
