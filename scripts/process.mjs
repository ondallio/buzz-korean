import { spawn } from 'node:child_process';

// No shell interpolation. Bound captured API output and terminate the process
// group on deadlines so a failed tool cannot strand grandchildren.
export function run(command, args, { cwd, env = process.env, input, timeoutMs = 120000, maxBytes = 4 * 1024 * 1024, inherit = false, sensitive = false } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, env, detached: process.platform !== 'win32', stdio: ['pipe', 'pipe', 'pipe'] });
    const chunks = [];
    let count = 0;
    let failure;
    const stop = reason => {
      failure ??= reason;
      try {
        if (process.platform === 'win32') child.kill('SIGKILL');
        else process.kill(-child.pid, 'SIGKILL');
      } catch (error) {
        if (error.code !== 'ESRCH') failure = new Error('Could not contain failed process', { cause: error });
      }
      clearTimeout(timer);
      // An escaped process may still hold inherited descriptors. Never wait
      // forever for their close event after the command has already failed.
      child.stdout.destroy();
      child.stderr.destroy();
      child.stdin.destroy();
      child.unref();
      reject(failure);
    };
    const timer = setTimeout(() => stop(new Error(`${command}: timeout`)), timeoutMs);
    for (const [stream, destination] of [[child.stdout, process.stdout], [child.stderr, process.stderr]]) stream.on('data', bytes => {
      count += bytes.length;
      if (count > maxBytes) { stop(new Error(`${command}: output limit exceeded`)); return; }
      if (inherit && !sensitive) destination.write(bytes);
      if (stream === child.stdout) chunks.push(bytes);
    });
    child.on('error', error => { clearTimeout(timer); reject(error); });
    child.on('close', code => {
      clearTimeout(timer);
      if (failure) reject(failure);
      else if (code !== 0) reject(new Error(`${command}: exit ${code}`));
      else resolve(Buffer.concat(chunks).toString('utf8'));
    });
    child.stdin.on('error', error => { if (error.code !== 'EPIPE') stop(error); });
    child.stdin.end(input);
  });
}
