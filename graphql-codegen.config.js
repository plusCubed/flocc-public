module.exports = {
  schema: [
    {
      'https://floccapp.hasura.app/v1/graphql': {
        headers: {
          'x-hasura-admin-secret': process.env.HASURA_ADMIN_SECRET,
          'x-hasura-role': 'user',
        },
      },
    },
  ],
  documents: ['./packages/renderer/src/**/*.graphql'],
  overwrite: true,
  generates: {
    './packages/renderer/src/generated/graphql.tsx': {
      plugins: ['typescript', 'typescript-operations', 'typescript-urql'],
      config: {
        skipTypename: true,
        withHooks: true,
        withComponent: false,
      },
    },
    './graphql.schema.json': {
      plugins: ['introspection'],
    },
  },
};
