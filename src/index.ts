#!/usr/bin/env node

import { Command } from 'commander'
import { readFileSync } from 'fs'
import { join } from 'path'
import config from './commands/config'
import init from './commands/init'
import proxy from './commands/proxy'
import tokens from './commands/tokens'
import models from './commands/models'
import chat from './commands/chat'
import shell from './commands/generate/shell'
import code from './commands/generate/code'
import commit from './commands/generate/commit'
import context from './commands/generate/context'
import unitTests from './commands/generate/unit_tests'
import analyze from './commands/generate/review'
import initProject from './commands/project/init'
import planProject from './commands/project/plan'
import buildProject from './commands/project/build'
import completeProject from './commands/project/complete'

// Function to get version from package.json
const getPackageVersion = () => {
  const packagePath = join(__dirname, 'package.json')
  const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'))
  return packageJson.version
}

const program = new Command()

program
  .name('cloving')
  .description('Integrate AI into your development workflow for generating commit messages, code reviews, and unit tests.')
  .version(getPackageVersion())

program
  .command('config')
  .description('Configure cloving with your API key and models to use')
  .action(config)

program
  .command('init')
  .description('Setup cloving in the current directory')
  .option('-s, --silent', 'Run the command without asking for confirmation of submitting prompts')
  .option('-m, --model <model>', 'Select the model to use (e.g., openai, claude, ollama, ollama:llama3, claude:claude-3-5-sonnet-20240620)')
  .action(init)

program
  .command('chat')
  .option('-f, --files <filenames...>', 'Specify filenames of files with context to use for generating code')
  .option('-t, --temperature <temperature>', 'Temperature for the model (default 0.2)')
  .option('-m, --model <model>', 'Select the model to use (e.g., openai, claude, ollama, ollama:llama3, claude:claude-3-5:sonnet-20240620)')
  .description('Start an interactive chat with cloving')
  .action(chat)

program
  .command('proxy')
  .option('-f, --files <filenames...>', 'Specify filenames of files with context to use for generating code')
  .option('-t, --temperature <temperature>', 'Temperature for the model (default 0.2)')
  .option('-m, --model <model>', 'Select the model to use (e.g., openai, claude, ollama, ollama:llama3, claude:claude-3-5:sonnet-20240620)')
  .description('Start a proxy server to use with cloving')
  .action(proxy)

program
  .command('models')
  .alias('m')
  .description('List available models')
  .action(models)

program
  .command('tokens')
  .alias('t')
  .option('-f, --files <filenames...>', 'Specify filenames of files with context to use for generating code')
  .description('Estimate the number of tokens in the current working directory or specified files')
  .action(tokens)

program
  .command('commit')
  .alias('c')
  .description('Alias for cloving generate commit')
  .option('-s, --silent', 'Run the command without asking for confirmation of submitting prompts')
  .option('-m, --model <model>', 'Select the model to use (e.g., openai, claude, ollama, ollama:llama3, claude:claude-3-5-sonnet-20240620)')
  .action(commit)

// Generate commands
const generate = program
  .command('generate')
  .alias('g')
  .description('Generate various items like unit-tests and code reviews')

generate
  .command('shell')
  .alias('sh')
  .description('Generate a shell command based on a prompt')
  .option('-s, --silent', 'Run the command without asking for confirmation of submitting prompts')
  .option('-m, --model <model>', 'Select the model to use (e.g., openai, claude, ollama, ollama:llama3, claude:claude-3-5-sonnet-20240620)')
  .option('-p, --prompt <prompt>', 'Specify the prompt to use')
  .option('-t, --temperature <temperature>', 'Temperature for the model (default 0.2)')
  .action(shell)

generate
  .command('code')
  .alias('c')
  .description('Generate code based on a prompt')
  .option('--save', 'Automatically save all files after generating the code')
  .option('-i, --interactive', 'Auto-save generated code and then show a new prompt with existing context to revise the code further')
  .option('-s, --silent', 'Run the command without asking for confirmation of submitting prompts')
  .option('-m, --model <model>', 'Select the model to use (e.g., openai, claude, ollama, ollama:llama3, claude:claude-3-5:sonnet-20240620)')
  .option('-t, --temperature <temperature>', 'Temperature for the model (default 0.2)')
  .option('-p, --prompt <prompt>', 'Specify the prompt to use')
  .option('-f, --files <filenames...>', 'Specify filenames of files with context to use for generating code')
  .action(code)

generate
  .command('commit')
  .description('Generate a commit message and commit the changes')
  .option('-t, --temperature <temperature>', 'Temperature for the model (default 0.2)')
  .option('-s, --silent', 'Run the command without asking for confirmation of submitting prompts')
  .option('-m, --model <model>', 'Select the model to use (e.g., openai, claude, ollama, ollama:llama3, claude:claude-3-5-sonnet-20240620)')
  .action(commit)

generate
  .command('context')
  .description('Create a context string for generating code')
  .option('-f, --files <filenames...>', 'Specify filenames of files with context')
  .action(context)

generate
  .command('unit-tests')
  .alias('u')
  .description('Generate unit tests (if you don\'t specify filenames, it will generate tests for commited changes that differ from the main/master branch)')
  .option('--save', 'Automatically save all files after generating the unit tests')
  .option('-s, --silent', 'Run the command without asking for confirmation of submitting prompts')
  .option('-f, --files <filenames...>', 'Specify filenames for the unit tests')
  .option('-m, --model <model>', 'Select the model to use (e.g., openai, claude, ollama, ollama:llama3, claude:claude-3-5-sonnet-20240620)')
  .option('-t, --temperature <temperature>', 'Temperature for the model (default 0.2)')
  .action(unitTests)

generate
  .command('review')
  .alias('r')
  .description('Review the code for commited changes that differ from the main/master branch')
  .option('-s, --silent', 'Run the command without asking for confirmation of submitting prompts')
  .option('-f, --files <filenames...>', 'Specify filenames for files you want to review')
  .option('-p, --prompt <prompt>', 'Add a prompt to the review')
  .option('-m, --model <model>', 'Select the model to use (e.g., openai, claude, ollama, ollama:llama3, claude:claude-3-5-sonnet-20240620)')
  .option('-t, --temperature <temperature>', 'Temperature for the model (default 0.2)')
  .action(analyze)

// Project commands
const project = program
  .command('project')
  .alias('p')
  .description('Commands for cloving a project')

project
  .command('init')
  .alias('i')
  .description('Setup a new cloving project inside a git branch')
  .action(initProject)

project
  .command('plan')
  .alias('p')
  .description('Plan the steps to complete the project')
  .action(planProject)

project
  .command('build')
  .alias('b')
  .description('Generate code to build the project')
  .action(buildProject)

project
  .command('complete')
  .alias('c')
  .description('Clean up and finalize the project')
  .action(completeProject)

program.parse(process.argv)
