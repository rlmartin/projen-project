import { {{_name.pascal}} } from '../src';

test('ProjenProject', () => {
  const project = new {{_name.pascal}}({
    name: 'foo-project',
    defaultReleaseBranch: 'main',
  });
  const fileNames = project.files.map(_ => _.path);
  ['.projen/tasks.json'].forEach(fileName => {
    expect(fileNames).toContain(fileName);
  });
});