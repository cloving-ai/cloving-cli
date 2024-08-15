import fs from 'fs';
import os from 'os';
import path from 'path';
import { confirm } from '@inquirer/prompts';
import ClovingGPT from '../cloving_gpt';
import ignore from 'ignore';
import { extractJsonMetadata } from '../utils/string_utils';
import { getConfig } from '../utils/config_utils';
import {
  generateFileList,
  collectSpecialFileContents,
  checkForSpecialFiles,
} from '../utils/command_utils';
import type { ClovingGPTOptions, ChatMessage } from '../utils/types';

// Main function for the describe command
export const init = async (options: ClovingGPTOptions) => {
  options.silent = getConfig(options).globalSilent || false;
  const gpt = new ClovingGPT(options);
  const specialFileContents = collectSpecialFileContents();
  const specialFileNames = Object.keys(specialFileContents).map((file) => ' - ' + file);

  // Initialize chat history
  const chatHistory: ChatMessage[] = [
    {
      role: 'system',
      content: `You are an AI assistant helping to initialize a project by analyzing its structure and technologies.

Please return JSON-formatted metadata about the project, including:

- The programming language(s) used
- The detected framework(s) (if any)
- The version of the language(s)

Here is a typescript interface for the expected response:

interface LanguageConfig {
  name: string
  version?: string
  primary?: boolean
  directory: string
  extension: string
}

interface FrameworkConfig {
  name: string
  type: string
  version?: string
  primary?: boolean
  directory?: string
  extension?: string
}

interface TestingFrameworkConfig {
  name: string
  type: string
  version?: string
  directory?: string
}

interface BuildToolConfig {
  name: string
  type: string
  version?: string
}

interface LinterConfig {
  name: string
  version?: string
  type?: string
}

interface DatabaseConfig {
  name: string
  primary?: boolean
}

export interface ClovingfileConfig {
  languages: LanguageConfig[]
  frameworks: FrameworkConfig[]
  testingFrameworks?: TestingFrameworkConfig[]
  buildTools: BuildToolConfig[]
  packageManager: string
  linters: LinterConfig[]
  databases?: DatabaseConfig[]
  projectType: string
}

Here is an example response:

{
  "languages": [
    {
      "name": "TypeScript",
      "version": "~> 5.5.3"
      "primary": true,
      "directory": "src",
      "extension": ".ts"
    },
    {
      "name": "JavaScript",
      "version": "ES6+",
      "directory": "src",
      "extension": ".js"
    }
  ],
  "frameworks": [
    {
      "name": "Node.js",
      "type": "Runtime environment",
      "primary": true,
      "directory": "src",
      "extension": ".js"
    }
  ],
  "testingFrameworks": [
    {
      "name": "Jest",
      "type": "Testing framework",
      "version": "29.7.0"
      "directory": "tests"
    },
  ],
  "buildTools": [
    {
      "name": "TypeScript Compiler (tsc)",
      "type": "Transpiler"
    },
    {
      "name": "Vite",
      "type": "Build tool",
      "version": "5.3.3"
    }
  ],
  "packageManager": "Yarn",
  "linters": [
    {
      "name": "ESLint",
      "version": "9.6.0"
    }
  ],
  "databases": [
    {
      "name": "MongoDB",
      "version": "5.0.3",
      "primary": true
    }
  ],
  "projectType": "Command-line tool",
}`,
    },
  ];

  if (!options.silent) {
    if (specialFileNames.length > 0) {
      console.log(`Cloving will analyze the list of files and the contents of the following files:

${specialFileNames.join('\n')}

Cloving will send AI a request to summarize the technologies used in this project.

This will provide better context for future Cloving requests.`);
    } else {
      console.log(`
This script will analyze the list of files in the current directory using GPT to summarize the
technologies used. This will provide better context for future Cloving requests.
      `);
    }
  }

  const config = getConfig(options);
  if (!config || !config?.models) {
    console.error('No cloving configuration found. Please run `cloving config`');
    return;
  }

  if (!checkForSpecialFiles()) {
    console.error(
      'No dependencies files detected. Please add a dependency file (e.g. package.json, Gemfile, requirements.txt, etc.) to your project and run `cloving init` again.',
    );
    return;
  }

  const tempFilePath = path.join(os.tmpdir(), `describe_${Date.now()}.tmp`);

  try {
    const gitignorePath = path.join(process.cwd(), '.gitignore');
    const ig = ignore();
    if (fs.existsSync(gitignorePath)) {
      const gitignoreContent = fs.readFileSync(gitignorePath, 'utf-8');
      ig.add(gitignoreContent);
    }

    const fileList = await generateFileList();
    const filteredFileList = fileList.filter((file) => {
      try {
        return !ig.ignores(file);
      } catch (error) {
        return false;
      }
    });

    const limitedFileList = filteredFileList.slice(0, 100);

    const projectDetails = {
      files: limitedFileList,
      specialFiles: specialFileContents,
    };

    const prompt = `Here is a JSON object describing my project:
${JSON.stringify(projectDetails, null, 2)}`;

    chatHistory.push({ role: 'user', content: prompt });

    const aiChatResponse = await gpt.generateText({ prompt, messages: chatHistory });

    chatHistory.push({ role: 'assistant', content: aiChatResponse });

    const cleanAiChatResponse = extractJsonMetadata(aiChatResponse);

    fs.writeFileSync(tempFilePath, cleanAiChatResponse);

    // Save the AI chat response to cloving.json
    fs.writeFileSync('cloving.json', cleanAiChatResponse);
    console.log('Project data saved to cloving.json');

    // Prompt the user if they want to review the generated cloving.json
    if (!options.silent) {
      const reviewAnswer = await confirm({
        message: 'Do you want to review the generated data?',
        default: true,
      });
      if (reviewAnswer) {
        console.log(cleanAiChatResponse);
      }
    }

    // Clean up
    fs.unlinkSync(tempFilePath);
  } catch (error) {
    console.error('Error describing the project:', (error as Error).message);
  }
};

export default init;
