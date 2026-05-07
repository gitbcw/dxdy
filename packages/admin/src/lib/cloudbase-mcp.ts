import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

type RpcPending = {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
  timer: NodeJS.Timeout;
};

type RpcMessage = {
  id?: number;
  error?: { message?: string };
  result?: unknown;
};

type ToolContent = {
  text?: string;
};

function findProjectRoot(startDir: string) {
  let dir = startDir;
  while (dir !== path.dirname(dir)) {
    if (existsSync(path.join(dir, '.mcp.json'))) return dir;
    dir = path.dirname(dir);
  }
  throw new Error('未找到项目 .mcp.json');
}

function parseToolText(result: unknown) {
  const content = typeof result === 'object' && result && 'content' in result
    ? (result as { content?: ToolContent[] }).content || []
    : [];
  const text = content.map((item) => item.text || '').join('\n');
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

export async function callCloudBaseTool<T = unknown>(name: string, args: Record<string, unknown>): Promise<T> {
  const projectRoot = findProjectRoot(process.cwd());
  const mcp = JSON.parse(readFileSync(path.join(projectRoot, '.mcp.json'), 'utf8')).mcpServers.cloudbase;
  const child = spawn(mcp.command, mcp.args, {
    cwd: projectRoot,
    env: { ...process.env, ...mcp.env },
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  let nextId = 1;
  let buffer = '';
  const pending = new Map<number, RpcPending>();

  const send = (method: string, params: Record<string, unknown>) => {
    const id = nextId++;
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`CloudBase MCP 调用超时：${method}`));
      }, 120000);
      pending.set(id, {
        resolve,
        reject,
        timer,
      });
    });
  };

  child.stdout.on('data', (chunk) => {
    buffer += chunk.toString();
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() || '';
    for (const line of lines) {
      if (!line.trim()) continue;
      let message: RpcMessage;
      try {
        message = JSON.parse(line);
      } catch {
        continue;
      }
      if (message.id && pending.has(message.id)) {
        const item = pending.get(message.id)!;
        pending.delete(message.id);
        clearTimeout(item.timer);
        if (message.error) item.reject(new Error(message.error.message || JSON.stringify(message.error)));
        else item.resolve(message.result);
      }
    }
  });

  try {
    await send('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'dxdy-admin-api', version: '1.0.0' },
    });
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized', params: {} }) + '\n');
    const result = await send('tools/call', { name, arguments: args });
    return parseToolText(result) as T;
  } finally {
    for (const item of pending.values()) clearTimeout(item.timer);
    pending.clear();
    child.kill('SIGTERM');
  }
}
