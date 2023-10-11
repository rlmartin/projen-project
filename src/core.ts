import * as path from 'path';
import { SampleFile, TextFile, javascript } from 'projen';
import { TypescriptConfigOptions } from 'projen/lib/javascript';
import { TypeScriptProject, TypeScriptProjectOptions } from 'projen/lib/typescript';
import { allCases, AllCases, loadFiles, packageToString, parsePackageName, squashPackageNames, squashPackages } from './helpers';

export enum FileType {
  SCAFFOLDING, GENERATED
}

interface InternalProjenProjectOptions {
  readonly _name: AllCases;
  readonly tsconfig: TypescriptConfigOptions;
}

export interface ProjectFile {
  readonly fileName: string;
  readonly contents: string;
  readonly fileType: FileType;
}

export interface ProjectSettings<O extends javascript.NodeProjectOptions> {
  readonly options: O;
  readonly files: ProjectFile[];
}

// function hasTsconfig<O extends javascript.NodeProjectOptions>(options: O | typescript.TypeScriptProject): options is typescript.TypeScriptProject {
//   return (options as typescript.TypeScriptProject).tsconfig !== undefined;
// }

export function loadSettings<O extends javascript.NodeProjectOptions, T extends TypeScriptProjectOptions>(
  options: O | T,
  filesDir: string,
  isProjenProject: boolean = false,
): ProjectSettings<O | T> {
  const dependencies = ['projen@~0'];
  const bundledDependencies = isProjenProject ? ['liquidjs@~9'] : [];
  const packageName = parsePackageName(options.name);
  const devDepsMap = squashPackageNames((options.devDeps ?? []).map(parsePackageName));
  if (devDepsMap['projen-project'] && isProjenProject) {
    dependencies.push(packageToString(devDepsMap['projen-project']));
    delete devDepsMap['projen-project'];
  }
  var tsconfig: TypescriptConfigOptions | undefined = undefined;
  if ('tsconfig' in options) {
    tsconfig = options.tsconfig as TypescriptConfigOptions;
  }
  const projectOpts: (O | T) & InternalProjenProjectOptions = {
    ...options,
    sampleCode: false, // Needed to prevent a default index.ts from being generated, which happens elsewhere.
    tsconfig: {
      ...tsconfig,
      compilerOptions: {
        ...tsconfig?.compilerOptions,
        outDir: options.artifactsDirectory ?? 'dist',
        declaration: false,
      },
    },
    deps: squashPackages([...(options.deps ?? []), ...bundledDependencies, ...dependencies]),
    devDeps: Object.values(devDepsMap).map(packageToString),
    peerDeps: squashPackages([...(options.peerDeps ?? []), ...dependencies]),
    bundledDeps: squashPackages([...(options.bundledDeps ?? []), ...bundledDependencies]),
    _name: allCases(packageName.name),
  };
  const files = [
    ...loadFiles(path.join(filesDir, 'scaffolding'), projectOpts, FileType.SCAFFOLDING),
    ...loadFiles(path.join(filesDir, 'generated'), projectOpts, FileType.GENERATED),
  ];
  return {
    options: {
      ...projectOpts,
      readme: {
        contents: files.find(_ => _.fileName === 'README.md')?.contents, // Need to load here and not later
      },
    },
    files,
  };
}

export function addFiles(project: TypeScriptProject, files: ProjectFile[]) {
  files.forEach(file => {
    const { fileName, contents, fileType } = file;
    if (fileName === 'README.md') return; // readme is set in project creation above, so skip here
    if (fileName === '.seed') return; // Ignore this; used only to create dirs in this template.
    project.tryRemoveFile(fileName);
    switch (fileType) {
      case FileType.SCAFFOLDING:
        new SampleFile(project, fileName, { contents });
        break;
      case FileType.GENERATED:
        new TextFile(project, fileName, { lines: contents.split('\n') });
        if (fileName.match(/\.[j|t]s$/i)) project.eslint?.addIgnorePattern(fileName);
        break;
      default:
        throw `fileType [${fileType}] not implemented.`;
    }
  });
}