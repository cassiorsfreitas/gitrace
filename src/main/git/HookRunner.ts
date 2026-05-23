import { EventEmitter } from 'events'
import { spawn } from 'child_process'

/**
 * Runs a git hook script as a child process and streams output.
 *
 * Emits:
 *   'data'  (chunk: string) — stdout or stderr chunk
 *   'exit'  (code: number)  — process exit code (1 if process errored)
 *
 * Usage:
 *   const runner = new HookRunner()
 *   runner.on('data', chunk => ...)
 *   const code = await runner.run('/path/to/.git/hooks/pre-commit', repoPath)
 */
export class HookRunner extends EventEmitter {
  run(hookPath: string, repoPath: string): Promise<number> {
    return new Promise((resolve) => {
      const proc = spawn(hookPath, [], {
        cwd: repoPath,
        env: process.env,
        shell: false,
      })

      proc.stdout.on('data', (chunk: Buffer) => {
        this.emit('data', chunk.toString())
      })

      proc.stderr.on('data', (chunk: Buffer) => {
        this.emit('data', chunk.toString())
      })

      proc.on('close', (code: number | null) => {
        resolve(code ?? 1)
      })

      proc.on('error', (err: Error) => {
        this.emit('data', `hook error: ${err.message}\n`)
        resolve(1)
      })
    })
  }
}
