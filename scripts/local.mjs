import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { createServer } from 'node:net';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// This wrapper never accepts or forwards a Cloud target, URL, or arbitrary CLI flags.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const [action, ...args] = process.argv.slice(2);
const actions = ['start', 'stop', 'status', 'migrate', 'reset', 'verify'];
const projectId = 'dms-group05';
const network = `${projectId}-local`;
const database = `supabase_db_${projectId}`;
const cliPath = join(root, 'node_modules', 'supabase', 'dist', 'supabase.js');
const config = readFileSync(join(root, 'supabase', 'config.toml'), 'utf8');

function ensure(condition, message) {
  if (!condition) throw new Error(message);
}

function run(command, parameters, options = {}) {
  const result = spawnSync(command, parameters, {
    cwd: root, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024,
    timeout: 20 * 60 * 1000, windowsHide: true, ...options,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    // Do not include raw CLI/status/inspect output: it can contain credentials.
    throw new Error(`${command === process.execPath ? 'Supabase CLI' : 'Docker'} ${parameters.slice(0, 2).join(' ')} failed (exit ${result.status}). Check Docker Desktop and README troubleshooting.`);
  }
  return result.stdout.trim();
}

function cli(parameters) {
  return run(process.execPath, [cliPath, ...parameters, '--workdir', root]);
}

function section(name) {
  return config.match(new RegExp(`^\\[${name.replaceAll('.', '\\.')}\\]\\s*\\r?\\n([\\s\\S]*?)(?=^\\[|$(?![\\s\\S]))`, 'm'))?.[1] ?? '';
}

function port(name) {
  const value = Number(section(name).match(/^port\s*=\s*(\d+)/m)?.[1]);
  ensure(Number.isInteger(value) && value > 0 && value < 65536, `Missing ${name}.port in config.toml.`);
  return value;
}

let dockerPath;
function docker(parameters) {
  return run(dockerPath, parameters);
}

function checkDocker() {
  const candidates = [
    join(process.env.LOCALAPPDATA ?? '', 'Programs', 'DockerDesktop', 'resources', 'bin', 'docker.exe'),
    join(process.env.ProgramFiles ?? 'C:\\Program Files', 'Docker', 'Docker', 'resources', 'bin', 'docker.exe'),
  ];
  dockerPath = candidates.find(existsSync) ?? 'docker';
  ensure(!process.env.SUPABASE_CLI_BINARY_OVERRIDE, 'Remove SUPABASE_CLI_BINARY_OVERRIDE before local operations.');
  const host = process.env.DOCKER_HOST;
  ensure(!host || host.startsWith('npipe:////./pipe/'), 'DOCKER_HOST must use a local Windows named pipe. Remote Docker is forbidden.');
  const context = JSON.parse(docker(['context', 'inspect']))[0];
  ensure(context?.Endpoints?.docker?.Host?.startsWith('npipe:////./pipe/'), 'Select a local Docker Desktop context; remote Docker is forbidden.');
  ensure(docker(['info', '--format', '{{.OSType}}']) === 'linux', 'Docker Desktop must be running Linux containers.');
}

function checkDesktopPortBinding() {
  const settingsPath = join(process.env.APPDATA ?? '', 'Docker', 'settings-store.json');
  ensure(existsSync(settingsPath), 'Docker Desktop settings not found. See README Windows setup.');
  const settings = JSON.parse(readFileSync(settingsPath, 'utf8').replace(/^\uFEFF/, ''));
  ensure(['default-local-port-binding', 'local-only-port-binding'].includes(settings.PortBindingBehavior ?? settings.portBindingBehavior), 'In Docker Desktop Settings > Resources > Network, set Port binding behavior to Localhost by default, then Apply/restart. No services were started.');
}

function inspectDatabase() {
  const info = JSON.parse(docker(['inspect', database]))[0];
  ensure(info.State.Running, 'Local PostgreSQL container is stopped. Run npm.cmd run db:start.');
  ensure(info.Config.Labels?.['com.supabase.cli.project'] === projectId, 'Unexpected database container project label.');
  ensure(info.Config.Image.includes('/postgres:'), 'Unexpected database container image.');
  const bindings = info.NetworkSettings.Ports?.['5432/tcp'];
  ensure(bindings?.length && bindings.every(binding => ['127.0.0.1', '::1'].includes(binding.HostIp) && Number(binding.HostPort) === port('db')), 'Database must bind only to loopback (127.0.0.1/::1) and the configured local port.');
  return info;
}

function query(sql) {
  return docker(['exec', database, 'psql', '-X', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-A', '-t', '-c', sql]);
}

function status() {
  inspectDatabase();
  const names = docker(['ps', '-a', '--filter', `label=com.supabase.cli.project=${projectId}`, '--format', '{{.Names}}']).split(/\r?\n/).filter(Boolean);
  ensure(names.length > 0, 'No local Supabase containers found.');
  const containers = JSON.parse(docker(['inspect', ...names]));
  for (const container of containers) {
    const health = container.State.Health?.Status ?? 'no healthcheck';
    for (const bindings of Object.values(container.NetworkSettings.Ports ?? {})) {
      ensure(!bindings || bindings.every(binding => ['127.0.0.1', '::1'].includes(binding.HostIp)), 'A service is exposed beyond loopback; stop it and check the Docker network.');
    }
    if (container.State.Running && health === 'starting') {
      const error = new Error(`${container.Name.slice(1)} is still starting.`);
      error.code = 'SERVICE_STARTING';
      throw error;
    }
    ensure(container.State.Running && health !== 'unhealthy', `${container.Name.slice(1)} is not healthy: ${container.State.Status}; ${health}.`);
  }
  for (const service of ['db', 'rest', 'auth', 'studio', 'storage', 'realtime']) {
    ensure(names.some(name => name.startsWith(`supabase_${service}_`)), `Missing required ${service} service.`);
  }
  for (const container of containers) {
    console.log(`${container.Name.slice(1)}: ${container.State.Status}; ${container.State.Health?.Status ?? 'no healthcheck'}`);
  }
  console.log(`PostgreSQL: 127.0.0.1:${port('db')}/postgres (user postgres)`);
  console.log(`API: http://127.0.0.1:${port('api')}`);
  console.log(`Studio: http://127.0.0.1:${port('studio')}`);
  console.log('Keys are hidden. Retrieve them privately with npx.cmd --no-install supabase status.');
}

async function waitForServices() {
  const deadline = Date.now() + 90000;
  while (true) {
    try {
      status();
      return;
    } catch (error) {
      if (error.code !== 'SERVICE_STARTING' || Date.now() >= deadline) throw error;
      console.log(`Waiting: ${error.message}`);
      await new Promise(resolvePromise => setTimeout(resolvePromise, 3000));
    }
  }
}

async function httpCheck(label, url, headers = {}) {
  const origin = new URL(url).origin;
  let current = url;
  for (let redirects = 0; redirects <= 5; redirects += 1) {
    const response = await fetch(current, { headers, redirect: 'manual', signal: AbortSignal.timeout(15000) });
    const location = response.headers.get('location');
    await response.body?.cancel();
    if (response.status >= 300 && response.status < 400 && location) {
      const next = new URL(location, current);
      ensure(next.origin === origin, `${label} redirected outside the local service; request blocked.`);
      current = next.href;
      continue;
    }
    ensure(response.status >= 200 && response.status < 300, `${label} returned HTTP ${response.status}.`);
    console.log(`PASS ${label}: HTTP ${response.status}`);
    return;
  }
  throw new Error(`${label} redirected too many times.`);
}

async function verify() {
  await waitForServices();
  const files = readdirSync(join(root, 'supabase', 'migrations')).filter(name => name.endsWith('.sql'));
  ensure(files.length > 0 && files.every(name => /^\d{14}_[a-z0-9_]+\.sql$/.test(name)), 'Invalid migration filename; use timestamp_name.sql.');
  const versions = files.map(name => name.slice(0, 14)).sort();
  ensure(new Set(versions).size === versions.length, 'Duplicate migration timestamp.');
  const applied = query('SELECT version FROM supabase_migrations.schema_migrations ORDER BY version').split(/\r?\n/).filter(Boolean);
  ensure(JSON.stringify(applied) === JSON.stringify(versions), 'Local migration history does not match repository files. Run db:migrate.');
  const result = JSON.parse(query(`SELECT json_build_object(
    'server_version', current_setting('server_version'),
    'schema', to_regclass('setup_meta.workflow_probe')::text,
    'seed', (SELECT marker FROM setup_meta.workflow_probe WHERE id = 1),
    'row_count', (SELECT count(*) FROM setup_meta.workflow_probe),
    'rls', (SELECT relrowsecurity FROM pg_class WHERE oid = 'setup_meta.workflow_probe'::regclass),
    'private', NOT has_schema_privilege('anon', 'setup_meta', 'USAGE') AND NOT has_schema_privilege('authenticated', 'setup_meta', 'USAGE')
  )`));
  ensure(result.schema === 'setup_meta.workflow_probe' && result.seed === 'local-seed-ok' && result.row_count === 1 && result.rls && result.private, 'Bootstrap schema, seed, or permissions did not match.');
  console.log(`PASS PostgreSQL/schema/seed/RLS: ${JSON.stringify(result)}`);
  console.log(`PASS migrations: ${versions.join(', ')}`);
  const raw = JSON.parse(cli(['status', '-o', 'json']));
  const values = raw.data ?? raw;
  const key = values.ANON_KEY ?? values.anon_key ?? values.api?.anon_key ?? values.PUBLISHABLE_KEY ?? values.api?.publishable_key;
  ensure(typeof key === 'string' && key.length > 0, 'Could not read local API key from CLI status. No credentials were printed.');
  const api = `http://127.0.0.1:${port('api')}`;
  await httpCheck('REST API', `${api}/rest/v1/`, { apikey: key });
  await httpCheck('Auth', `${api}/auth/v1/health`, { apikey: key });
  await httpCheck('Studio', `http://127.0.0.1:${port('studio')}`);
}

async function assertFree(value) {
  await new Promise((resolvePromise, reject) => {
    const server = createServer();
    server.once('error', () => reject(new Error(`Port ${value} is busy. See README port conflicts.`)));
    server.listen(value, '127.0.0.1', () => server.close(resolvePromise));
  });
}

async function main() {
  ensure(process.platform === 'win32', 'This repository setup supports Windows PowerShell only.');
  ensure(actions.includes(action), `Usage: node scripts/local.mjs ${actions.join('|')}`);
  ensure((action === 'reset' && args.length === 1 && args[0] === '--confirm-local-reset') || (action !== 'reset' && args.length === 0), 'Reset deletes LOCAL data. After verifying/backing up disposable data, use: npm.cmd run db:reset -- --confirm-local-reset. No other arguments are accepted.');
  ensure(existsSync(cliPath), 'Run npm.cmd ci first.');
  ensure(config.match(/^project_id\s*=\s*"([^"]+)"/m)?.[1] === projectId, 'Unexpected project_id in config.toml.');
  checkDocker();
  if (action === 'start') {
    checkDesktopPortBinding();
    const networks = docker(['network', 'ls', '--filter', `name=^${network}$`, '--format', '{{.Name}}']);
    if (!networks) docker(['network', 'create', '--driver', 'bridge', '--opt', 'com.docker.network.bridge.host_binding_ipv4=127.0.0.1', network]);
    const settings = JSON.parse(docker(['network', 'inspect', network]))[0];
    ensure(settings.Driver === 'bridge' && settings.Options?.['com.docker.network.bridge.host_binding_ipv4'] === '127.0.0.1', 'Existing Docker network does not enforce loopback binding.');
    const running = docker(['ps', '--filter', `name=^/${database}$`, '--format', '{{.Names}}']);
    if (!running) {
      await Promise.all([port('api'), port('db'), port('studio'), port('local_smtp'), 54320].map(assertFree));
    }
    console.log('Starting local Supabase; the first run downloads Docker images and may take several minutes.');
    try {
      cli(['start', '--network-id', network]);
      await waitForServices();
    } catch (error) {
      try {
        cli(['stop']);
        console.error('Local stack stopped after failed startup validation; data preserved.');
      } catch {
        console.error('Could not stop the local stack automatically. Check Docker Desktop immediately.');
      }
      throw error;
    }
  } else if (action === 'stop') {
    cli(['stop']); // Default preserves local data. Never pass --no-backup here.
    console.log('Local Supabase stopped; data preserved by Supabase CLI.');
  } else if (action === 'status') {
    status();
  } else if (action === 'migrate') {
    inspectDatabase();
    cli(['migration', 'up']); // CLI 3.2.0: local by default; no remote flags accepted.
    console.log('Pending local migrations applied.');
  } else if (action === 'reset') {
    checkDesktopPortBinding();
    inspectDatabase();
    ensure(query('SELECT current_database()') === 'postgres', 'Unexpected database name.');
    console.log(`Verified LOCAL reset target: ${database}, 127.0.0.1:${port('db')}/postgres.`);
    cli(['db', 'reset', '--network-id', network]); // Local target; preserve the stack network.
    await verify();
  } else {
    await verify();
  }
}

main().catch(error => {
  console.error(`FAIL: ${error.message}`);
  process.exitCode = 1;
});
