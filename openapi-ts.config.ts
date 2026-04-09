import { defineConfig, type UserConfig } from '@hey-api/openapi-ts'

const plugins = [
  '@hey-api/typescript',
  '@hey-api/client-fetch',
  {
    name: 'zod',
    exportFromIndex: true,
  },
  {
    name: '@hey-api/sdk',
    validator: {
      request: 'zod',
      response: 'zod',
    },
  },
] satisfies UserConfig['plugins']

export default defineConfig([
  {
    input: {
      path: './specs/datakatalog.json',
    },
    output: {
      path: 'src/api/generated/datakatalog',
      clean: true,
    },
    plugins,
  },
  {
    input: {
      path: './specs/uberiket.json',
    },
    output: {
      path: 'src/api/generated/uberiket',
      clean: true,
    },
    plugins,
  },
  {
    input: {
      path: './specs/vegnett.json',
    },
    output: {
      path: 'src/api/generated/vegnett',
      clean: true,
    },
    plugins,
  },
])
