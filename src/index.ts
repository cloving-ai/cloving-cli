#!/usr/bin/env node

import { Command } from 'commander';
import commit from './commands/commit';

const program = new Command();

program
  .name('cloving')
  .description('CLI to some JavaScript utilities')
  .version('1.0.0');

program
  .command('commit')
  .description('Generate a commit message and commit the changes')
  .action(commit);

program.parse(process.argv);
