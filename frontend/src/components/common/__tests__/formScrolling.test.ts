import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';

/**
 * Guard: every view holding text fields scrolls with FormScrollView, so a tap on another
 * field works with the keyboard open and no field stays hidden behind the keyboard.
 */
const SRC = join(__dirname, '..', '..', '..');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === '__tests__' ? [] : sourceFiles(path);
    return path.endsWith('.tsx') ? [path] : [];
  });
}

// A view holds fields when it renders a text field or one of the app's forms.
const FIELDS =
  /<(TextInput|Searchbar|LoginForm|RegisterForm|ChangePasswordForm|EditProfileForm|BorrowerForm|ItemForm|LoanWizard)\b/;

const viewsWithFields = [join(SRC, 'screens'), join(SRC, 'components')]
  .flatMap(sourceFiles)
  .filter((file) => FIELDS.test(readFileSync(file, 'utf8')))
  .map((file) => ({ name: relative(SRC, file), source: readFileSync(file, 'utf8') }));

/** Opening tags of a component, attributes included. */
function tags(source: string, component: string): string[] {
  return source.match(new RegExp(`<${component}\\b[^>]*>`, 'g')) ?? [];
}

describe('scrolling in views with text fields', () => {
  it('finds the views to check', () => {
    expect(viewsWithFields.map((v) => v.name)).toEqual(
      expect.arrayContaining([
        'screens/auth/RegisterScreen.tsx',
        'screens/auth/LoginScreen.tsx',
        'screens/loans/CreateLoanScreen.tsx',
        'screens/profile/EditProfileScreen.tsx',
        'screens/items/CreateItemScreen.tsx',
      ]),
    );
  });

  it.each(viewsWithFields.map((v) => [v.name, v.source]))(
    '%s scrolls vertically only with FormScrollView',
    (_name, source) => {
      const verticalScrollViews = tags(source, 'ScrollView').filter(
        (tag) => !/\bhorizontal\b/.test(tag),
      );
      expect(verticalScrollViews).toEqual([]);
    },
  );

  it.each(viewsWithFields.map((v) => [v.name, v.source]))(
    '%s lets taps through its lists while the keyboard is open',
    (_name, source) => {
      const blockingLists = tags(source, 'FlatList(<[^>]*>)?').filter(
        (tag) => !tag.includes('keyboardShouldPersistTaps="handled"'),
      );
      expect(blockingLists).toEqual([]);
    },
  );
});
