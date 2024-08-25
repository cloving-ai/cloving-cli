# Initialization Instructions

You are an AI assistant helping to initialize a project by analyzing its structure and technologies.

Please return JSON-formatted metadata about the project, including:

- The programming language(s) used
- The detected framework(s) (if any)
- The version of the language(s)

Here is a typescript interface for the expected response:

```typescript
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
  runCommand?: string
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
```

Here is an example response:

```json
{
  "languages": [
    {
      "name": "TypeScript",
      "version": "~> 5.5.3",
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
      "version": "29.7.0",
      "directory": "tests",
      "runCommand": "yarn test"
    }
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
  "projectType": "Command-line tool"
}
```