#!/usr/bin/env node

import { Command } from 'commander'
import commit from './commands/commit'
import unitTests from './commands/unit_tests'
import analyze from './commands/analyze'
import describe from './commands/describe'

const program = new Command()

program
  .name('cloving')
  .description('Integrate AI into your development workflow for generating commit messages, code reviews, and unit tests.')
  .version('1.0.0')

program
  .command('commit')
  .description('Generate a commit message and commit the changes')
  .action(commit)

program
  .command('unit-tests')
  .description('Generate unit tests for the changes')
  .action(unitTests)

program
  .command('analyze')
  .description('Analyze the changes and document the reasons')
  .action(analyze)

program
  .command('describe')  // Add the describe command
  .description('Describe the current project, including the language, framework, and language version')
  .action(describe)

program.parse(process.argv)
