import { spawn } from 'child_process'

/**
 * Runs a shell command and returns its output as a Promise.
 * @param command The command to run.
 * @param args An array of string arguments for the command.
 * @returns A promise that resolves with the command's output or rejects with an error.
 */
export const runCommand = (command: string, args: string[]): Promise<string[]> => {
  return new Promise((resolve, reject) => {
    const process = spawn(command, args)
    const output: string[] = []

    process.stdout.on('data', (data) => {
      output.push(data.toString())
    })

    process.stderr.on('data', (data) => {
      console.error(`stderr: ${data}`)
    })

    process.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`${command} process exited with code ${code}`))
      } else {
        resolve(output.join('').trim().split('\n'))
      }
    })
  })
}
