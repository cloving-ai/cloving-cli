# Cloving

Cloving is an innovative CLI tool designed to seamlessly integrate AI into various aspects of the developer workflow. It enhances productivity and code quality by leveraging AI for tasks such as generating commit messages, conducting code reviews, creating unit tests, and even assisting with entire project lifecycles.

## Features

- **AI-powered Git commit message generation**
- **Automated code reviews with AI insights**
- **AI-assisted unit test generation**
- **Seamless integration with existing development workflows**
- **Customizable AI prompts for different tasks**
- **Project initialization, planning, and building with AI assistance**
- **Support for multiple AI models including OpenAI, Claude, and Ollama**

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

### Listing Available Models

List the available AI models:
```bash
cloving models
```

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

### Generating Unit Tests

Generate unit tests for changes or specific files:
```bash
cloving generate unit-tests
```
Options:
- `-s, --silent`: Run without asking for confirmation
- `-f, --files <filenames...>`: Specify filenames for the unit tests
- `-m, --model <model>`: Select the model to use

### Code Reviews

Get an AI-powered code review:
```bash
cloving generate review
```
Options:
- `-s, --silent`: Run without asking for confirmation
- `-m, --model <model>`: Select the model to use

### Project Commands

Cloving now includes commands for managing entire projects:

- Initialize a new project inside a git branch:
  ```bash
  cloving project init
  ```

- Plan the steps to complete the project:
  ```bash
  cloving project plan
  ```

- Generate code to build the project:
  ```bash
  cloving project build
  ```

- Clean up and finalize the project:
  ```bash
  cloving project complete
  ```

## Command Line Options

Usage: `cloving [options] [command]`

Options:
- `-V, --version`: Output the version number
- `-h, --help`: Display help for command

Commands:
- `config`: Configure Cloving with your API key and models to use
- `init`: Setup Cloving in the current directory
- `models`: List available models
- `commit`: Alias for cloving generate commit
- `generate`: Generate various items like unit-tests and code reviews
  - `commit`: Generate a commit message and commit the changes
  - `unit-tests`: Generate unit tests
  - `review`: Review the code for committed changes
- `project`: Commands for managing Cloving projects
  - `init`: Setup a new Cloving project inside a git branch
  - `plan`: Plan the steps to complete the project
  - `build`: Generate code to build the project
  - `complete`: Clean up and finalize the project

Most commands support the following options:
- `-s, --silent`: Run the command without asking for confirmation of submitting prompts
- `-m, --model <model>`: Select the model to use (e.g., openai, claude, ollama, ollama:llama3, claude:claude-3-5-sonnet-20240620)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the [MIT License](LICENSE).

## Acknowledgements

- This project is inspired by [aichat](https://github.com/sigoden/aichat) for interfacing with AI models.
- Special thanks to the open-source community for inspiration and support.