#!/usr/bin/env node

import { Command } from 'commander'
import commit from './commands/commit'
import unitTests from './commands/unit_tests'
import analyze from './commands/review'
import init from './commands/init'
import config from './commands/config'
import models from './commands/models'

const program = new Command()

program
  .name('cloving')
  .description('Integrate AI into your development workflow for generating commit messages, code reviews, and unit tests.')
  .version('1.0.0')

program
  .command('commit')
  .description('Generate a commit message and commit the changes')
  .option('-s, --silent', 'Run the command without asking for confirmation of submitting prompts')
  .action(commit)

program
  .command('unit-tests')
  .description('Generate unit tests for the changes')
  .action(unitTests)

program
  .command('models')
  .description('List available models')
  .action(models)

program
  .command('review')
  .description('Review the changes and propose ')
  .action(analyze)

program
  .command('init')
  .description('Setup cloving in the current project')
  .action(init)

program
  .command('config')
  .description('Configure cloving with your API key and model')
  .action(config)

program.parse(process.argv)
