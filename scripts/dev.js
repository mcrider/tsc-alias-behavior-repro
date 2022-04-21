import { watch } from 'chokidar'
import { spawn } from "child_process";

import { generate } from '@graphql-codegen/cli'

import { build } from './build.js';

let result;
let serverProcess;

async function generateTypes(path) {
  // if (path) {
  //   console.log('[rebuild] (gql)', path);
  // } else {
  //   console.log('[ready] (gql) listening for file changes');
  // }

  return generate(
    {
      schema: "graphql/*",
      generates: {
        ['src/generated/graphql.ts']: {
          plugins: [
            "typescript",
            "typescript-resolvers"
          ]
        },
      },
      silent: true
    },
    true
  )
}

function spawnServerProcess(from) {
  // console.log('[spawn] >', from);

  const server = spawn(
    'node',
    [
      '--enable-source-maps',
      'dist/index.js'
    ], {
      stdio: 'inherit',
    }
  )

  server.on("close", async (code, signal) => {
    console.log("[closed]", code, signal);

    /**
     * We shouldn't force a rebuild if the server process closed with an error,
     * otherwise we get an infinite loop restarting the server untill the error
     * is fixed.
     */
    if (code !== null) {
      serverProcess = undefined;
      return;
    };

    spawnServerProcess('onClose');
  });

  serverProcess = server
}

function restartServerProcess() {
  // console.log('[restart]');

  // If there's no `serverProcess` it means that we erroed on the previous run.
  if (serverProcess) {
    serverProcess.kill()
  } else {
    spawnServerProcess('restartErroed')
  };
}

watch('./graphql/**/*.gql')
  .on('ready', generateTypes)
  .on('change', generateTypes);

const tsWatcher = watch('./src/**/*.ts')

const firstBuild = async () => {
  try {
    result = await build();
    spawnServerProcess('onReady');
  } catch (error) {}
}

const rebuild = async () => {
  try {
    await result.rebuild();
    restartServerProcess();
  } catch(error) {}
}

tsWatcher.on('ready', async () => {
  await firstBuild();

  // Now that we are ready, we start listenning to the change event.
  tsWatcher.on('change', async (path, stats) => {
    console.log('[rebuild] (ts)', path, stats);

    if (!result) {
      await firstBuild();
      return;
    }

    await rebuild();
  });

  // console.log('[ready] (ts) listening for file changes');
})
