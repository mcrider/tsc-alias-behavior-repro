import { build as esbuildBuild } from 'esbuild';
import { globPlugin } from 'esbuild-plugin-glob';

import { replaceTscAliasPaths, prepareSingleFileReplaceTscAliasPaths } from 'tsc-alias';

import { relative, dirname, join } from 'path';
import { readFile } from 'fs/promises';

// This will be truthy if we called `build`, and only it, from the command line.
const buildOnly = Boolean(import.meta.url.match(process.argv[1]));

const resolveTsPathsPlugin = {
  name: 'resolve-tspaths',
  async setup(build) {
    const runFile = await prepareSingleFileReplaceTscAliasPaths({
      resolveFullPaths: true,
    });

    console.log('[resolve-tspaths]', build.initialOptions);

    build.onLoad({ filter: /\.ts$/ }, async (args) => {
      // console.log('[build] onLoad');
      console.log('[build] onLoad (args)', args);
      const fileContents = await readFile(args.path, 'utf8')
      const filePath = args.path.replace(
        'src',
        build.initialOptions.outdir
      );
      console.log('[build] onLoad (filePath)', filePath);

      const contents = runFile({ fileContents, filePath });
      // console.log(contents);

      return {
        contents,
        loader: 'ts',
      }
    })

    // build.onEnd(async result => {
    //   // console.log('[build] onEnd', result);
    //   await replaceTscAliasPaths({
    //     resolveFullPaths: true,
    //   });
    // })
  },
}

export async function build() {
  return await esbuildBuild({
    entryPoints: ['src/**/*.ts'],
    platform: 'node',
    outdir: 'dist',
    sourcemap: true,

    plugins: [
      globPlugin(),
      resolveTsPathsPlugin,
    ],
    incremental: !buildOnly,
    logLevel: buildOnly ? 'info' : 'warning',
  });
}

if (buildOnly) build();
