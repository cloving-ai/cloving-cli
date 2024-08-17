# Cloving

An AI pair-programmer for the command line.

LLM-powered shell commands, code generation, commit messages, code reviews, unit test generation, and more. Works with most popular LLMs including OpenAI, Claude, Gemini, Ollama, and more.

[![asciicast](https://asciinema.org/a/SCcxw4B2XFQaTD0GeDTk0xbuq.svg)](https://asciinema.org/a/SCcxw4B2XFQaTD0GeDTk0xbuq)

Cloving CLI is a command line utility which integrates AI into your development workflow.

What makes the Cloving CLI different from other AI tools is that it builds sophisticated context-aware prompts to generate code, commit messages, and more.

Cloving gets to know your specific projects, the frameworks you use, the coding style you prefer, and the patterns you follow, and does its best to generate code that fits your existing project so that it actually works.

It delivers usable code that you can save directly into your project instead of copying and pasting code snippets from chat interactions.

**Read the [introduction announcement](https://cloving.ai/tutorials/introducing-the-cloving-cli).**

> [!WARNING]
>
> This project is still in the early stages of development and is not yet stable.
> Please use it with caution and [report any issues](https://github.com/cloving-ai/cloving-cli/issues) you encounter

## Features

- **Context-aware AI code generation**
- **AI-powered Git commit message generation**
- **Automated code reviews with AI insights**
- **AI-assisted unit test generation**
- **Support for multiple AI models including OpenAI, Claude, and Ollama**

## Important

The cloving will ask you before submitting any prompt to the AI model. You can use the `-s` or `--silent` flag to run the command without asking for confirmation, but by default you will have the chance to review all prompts with all the context before submitting them. This is to ensure that you are aware of what is being sent to the AI model and can make any necessary changes before submitting the prompt.

## Prerequisites

- Node.js (version 20 or higher)
- Git
- API access to AI chat models (e.g., OpenAI GPT-4, Claude, Ollama, etc.)

## Installation

You have three options to install and use Cloving:

### 1. Global Installation via npm

Install Cloving globally using npm:

```bash
npm install cloving -g
```

This allows you to run `cloving` commands from anywhere in your terminal.

### 2. Run with npx

You can use npx to run Cloving without installing it globally:

```bash
npx cloving [command]
```

This method downloads and executes Cloving on-the-fly, ensuring you always use the latest version.

### 3. Clone and Install from Source

For development or to use the latest unreleased features:

1. Clone this repository:
   ```bash
   git clone https://github.com/cloving-ai/cloving-cli.git
   ```

2. Navigate to the project directory:
   ```bash
   cd cloving-cli
   ```

3. Install dependencies and link the package:
   ```bash
   yarn install
   yarn link
   ```

After installation, configure Cloving with your API key and preferred model:

```bash
cloving config
```

Choose the installation method that best suits your needs and workflow. The global npm installation is recommended for most users, while npx is great for one-off usage or trying out Cloving. Cloning from source is ideal for contributors or those who want the absolute latest features.

## Usage

Cloving provides several commands to help integrate AI into your development workflow:

### Configuration

Configure Cloving with your API key and model:
```bash
cloving config
```

### Initialization

Set up Cloving in the current project:
```bash
cloving init
```
Options:
- `-s, --silent`: Run without asking for confirmation of submitting prompts
- `-m, --model <model>`: Select the model to use

### Generating Commit Messages

Generate an AI-powered commit message:
```bash
cloving commit
```
or
```bash
cloving generate commit
```
Options:
- `-s, --silent`: Run without asking for confirmation
- `-m, --model <model>`: Select the model to use

### Code Reviews

Get an AI-powered code review:
```bash
cloving generate review
```
Options:
- `-s, --silent`: Run without asking for confirmation
- `-m, --model <model>`: Select the model to use

### Generating Code

Generate code based on a prompt:
```bash
cloving generate code
```
Options:
- `--save`: Automatically save all files after generating the code
- `-i, --interactive`: Auto-save generated code and then show a new prompt with existing context to revise the code further
- `-s, --silent`: Run the command without asking for confirmation of submitting prompts
- `-m, --model <model>`: Select the model to use
- `-p, --prompt <prompt>`: Specify the prompt to use
- `-f, --files <filenames...>`: Specify filenames of files with context to use for generating code

### Generating Shell Commands

Generate a shell command based on a prompt:
```bash
cloving generate shell
```
or
```bash
cloving generate sh
```
Options:
- `-s, --silent`: Run without asking for confirmation of submitting prompts
- `-m, --model <model>`: Select the model to use
- `-p, --prompt <prompt>`: Specify the prompt to use

### Interactive Chat

Start an interactive chat session with the AI:
```bash
cloving chat
```
Options:
- `-f, --files <filenames...>`: Specify filenames of files with context to use for the chat
- `-t, --temperature <temperature>`: Set the temperature for the model (default 0.2)
- `-m, --model <model>`: Select the model to use

### Proxy Server

Start a proxy server to use with Cloving:
```bash
cloving proxy
```
Options:
- `-f, --files <filenames...>`: Specify filenames of files with context to use for generating code
- `-t, --temperature <temperature>`: Set the temperature for the model (default 0.2)
- `-m, --model <model>`: Select the model to use

The proxy server allows you to integrate Cloving with other tools or applications. It starts a local server that can receive requests and forward them to the AI model, returning the responses. This is useful for creating custom integrations or using Cloving in scenarios where a direct CLI interaction isn't suitable.

### Token Estimation

Estimate the number of tokens in the current working directory or specified files:
```bash
cloving tokens
```
or
```bash
cloving t
```
Options:
- `-f, --files <filenames...>`: Specify filenames of files to estimate tokens for

### Generating Context

Create a context string for generating prompts outside of the cloving cli:
```bash
cloving generate context
```
Options:
- `-f, --files <filenames...>`: Specify filenames of files with context

### Generating Unit Tests

Generate unit tests for changes or specific files:
```bash
cloving generate unit-tests
```
Options:
- `-s, --silent`: Run without asking for confirmation
- `-f, --files <filenames...>`: Specify filenames for the unit tests
- `-m, --model <model>`: Select the model to use

## Command Line Options

Usage: `cloving [command] [options]`

Options:
- `-V, --version`: Output the version number
- `-h, --help`: Display help for command

Commands:
- `config`: Configure Cloving with your API key and models to use
- `init`: Setup Cloving in the current directory
- `chat`: Start an interactive chat with Cloving
- `tokens`: Estimate the number of tokens in the current working directory or specified files
- `proxy`: Start a proxy server to use with Cloving
- `models`: List available models
- `commit`: Alias for cloving generate commit
- `generate`: Generate various items like unit-tests and code reviews
  - `commit`: Generate a commit message and commit the changes
  - `code`: Generate code based on a prompt
  - `context`: Generate context for building a prompt outside of cloving
  - `shell`: Generate a shell command based on a prompt
  - `unit-tests`: Generate unit tests
  - `review`: Review the code for committed changes

Most commands support the following options:
- `-s, --silent`: Run the command without asking for confirmation of submitting prompts
- `-m, --model <model>`: Select the model to use (e.g., openai, claude, ollama, ollama:llama3, claude:claude-3-5-sonnet-20240620)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the [MIT License](LICENSE).

## Acknowledgements

- This project is inspired by [aichat](https://github.com/sigoden/aichat) and [aider](https://github.com/paul-gauthier/aider)
- Special thanks to the open-source community for inspiration and support.