import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';

/**
 * Guard: a dialog holding a text field is a FormDialog, so the keyboard never covers its
 * field or its buttons, and a tap meant to hide the keyboard never closes the dialog.
 */
const SRC = join(__dirname, '..', '..', '..');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === '__tests__' ? [] : sourceFiles(path);
    return path.endsWith('.tsx') ? [path] : [];
  });
}

const sources = [join(SRC, 'screens'), join(SRC, 'components')]
  .flatMap(sourceFiles)
  .map((file) => ({ name: relative(SRC, file), source: readFileSync(file, 'utf8') }));

/** Bodies of the Paper dialogs of a file (`<Dialog …>…</Dialog>`, not nested). */
function paperDialogs(source: string): string[] {
  return source.match(/<Dialog\b[\s\S]*?<\/Dialog>/g) ?? [];
}

const FIELD = /<(TextInput|Searchbar)\b/;

describe('dialogs with text fields', () => {
  it('finds the form dialogs of the app', () => {
    const users = sources.filter((s) => /<FormDialog\b/.test(s.source)).map((s) => s.name);
    expect(users).toEqual(
      expect.arrayContaining([
        'components/loans/ConfirmationDialog.tsx',
        'screens/loans/LoanDetailScreen.tsx',
      ]),
    );
  });

  it.each(sources.map((s) => [s.name, s.source]))(
    '%s puts its text fields in a FormDialog, never in a bare Paper dialog',
    (_name, source) => {
      expect(paperDialogs(source).filter((dialog) => FIELD.test(dialog))).toEqual([]);
    },
  );
});
