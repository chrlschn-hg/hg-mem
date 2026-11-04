# Paseo 0.14

- Plugin version: 0.2.1. Supported Paseo range: `>=0.13.0 <0.15.0`.
- SDK/client: 0.14.0. React 19.2.3 and React Native 0.86.3 stay unchanged.
- Session-open requests now require title, labels, tools and MCP server fields. Test fixtures include them. The integration preserves them when adding environment values.
- The graph bundle and its exact React version guard stay unchanged.
- GraphQLite stays at 0.12.0. No database migration is needed.

Checks: typecheck, generated assets, skill links, 61 backend tests, 6 graph/refresh
tests and package contents. Tests use disposable stores.
