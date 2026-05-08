# CloudBase MCP Connection Notes

> Last verified: 2026-05-08

## Project Environment

- Project CloudBase env ID: `cloudbase-d4gwpsm7gcc59b6fc`
- Alias: `cloudbase`
- Region: `ap-shanghai`
- Status: `NORMAL`
- Package: `baas_personal` / `个人版`
- Expire time observed from MCP: `2026-11-06 23:59:59`

## Important Distinction

This repository has a project-level `.mcp.json`. It starts a CloudBase MCP server with environment variables:

- `CLOUDBASE_ENV_ID`
- `TENCENTCLOUD_SECRETID`
- `TENCENTCLOUD_SECRETKEY`
- optional `TENCENTCLOUD_SESSIONTOKEN`
- `INTEGRATION_IDE`

CloudBase's own FAQ documents this env-var mode for remote development, cloud IDEs, and automation. In this mode, the MCP server uses the credentials and env ID from the MCP config instead of relying on a browser login flow.

The CloudBase CLI global default environment is a separate fallback concept. CLI docs describe its priority as:

```text
global default (tcb env use) < project cloudbaserc.json < command -e / --env-id
```

For this Codex workspace, the built-in `mcp__cloudbase__` tool may already be connected to a globally loaded CloudBase MCP instance. That global instance can auto-bind to another environment, such as `clo-test-4g8ukdond34672de`. Do not treat that as the project environment.

## Correct Verification Flow

When confirming this project's CloudBase environment, launch a fresh MCP client using the server definition from `.mcp.json`, then call CloudBase MCP tools through that client.

Recommended one-off verification command:

```bash
node - <<'NODE'
const fs = require('fs');
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');

(async () => {
  const cfg = JSON.parse(fs.readFileSync('.mcp.json', 'utf8'));
  const server = cfg.mcpServers.cloudbase;
  const transport = new StdioClientTransport({
    command: server.command,
    args: server.args,
    env: { ...process.env, ...(server.env || {}) },
    stderr: 'pipe'
  });
  const client = new Client({ name: 'dxdy-project-cloudbase-check', version: '1.0.0' });
  await client.connect(transport);

  const tools = await client.listTools();
  console.log({
    toolCount: tools.tools.length,
    hasAuth: tools.tools.some((tool) => tool.name === 'auth'),
    hasEnvQuery: tools.tools.some((tool) => tool.name === 'envQuery')
  });

  const auth = await client.callTool({ name: 'auth', arguments: { action: 'status' } });
  console.log(JSON.stringify(auth.content, null, 2));

  const env = await client.callTool({ name: 'envQuery', arguments: { action: 'info' } });
  console.log(JSON.stringify(env.content, null, 2));

  await client.close();
})();
NODE
```

Expected result:

- `toolCount` is greater than zero. On 2026-05-08 it was `36`.
- `auth` reports `current_env_id: "cloudbase-d4gwpsm7gcc59b6fc"`.
- `envQuery(action=info)` reports `EnvInfo.Status: "NORMAL"`.

## Operational Rule

For project CloudBase checks and writes, prefer the project `.mcp.json` startup path above. Use the globally available `mcp__cloudbase__` tools only after verifying they are bound to `cloudbase-d4gwpsm7gcc59b6fc`, or when the task explicitly targets the global/test environment.

Never paste or re-document the secret values from `.mcp.json` in chat, docs, logs, or commits.
