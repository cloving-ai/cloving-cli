Here's the updated README.md with the latest changes and improvements:

# Cloving

Cloving is an innovative tool designed to seamlessly integrate AI into various aspects of the developer workflow. It aims to enhance productivity and code quality by leveraging AI for tasks such as generating commit messages, conducting code reviews, and creating unit tests.

## Features

- **AI-powered Git commit message generation**
- **Automated code reviews with AI insights**
- **AI-assisted unit test generation**
- **Seamless integration with existing development workflows**
- **Customizable AI prompts for different tasks**
- **Project initialization, planning, and building with AI assistance**

## Prerequisites

- Node.js (version 20 or higher)
- Git
- API access to AI chat models (e.g., OpenAI GPT-4, Claude, Ollama, etc.)

## Installation

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

4. Configure Cloving with your API key and model:
   ```bash
   cloving config
   ```

## Usage

Cloving provides several commands to help integrate AI into your development workflow:

### Generating Commit Messages

Run the following command in your Git repository:
```bash
cloving commit
```
This will generate an AI-powered commit message based on your recent changes, allow you to review and edit it, and then commit your changes.

### Code Reviews

To get an AI-powered code review for your latest changes:
```bash
cloving generate review
```

### Generating Unit Tests

To generate unit tests for a specific file or function:
```bash
cloving generate unit-tests [file_path_to_test]
```

### Initial Setup

To set up Cloving in the current project, generating a `cloving.json` file that includes a GPT-generated project overview with details like the language, framework, and language version:
```bash
cloving init
```

### Configuration

To configure Cloving with your API key and model:
```bash
cloving config
```

### Listing Available Models

To list the available AI models:
```bash
cloving models
```

### Project Commands

Cloving now includes commands for managing entire projects:

- Initialize a new project:
  ```bash
  cloving project init
  ```

- Plan a project:
  ```bash
  cloving project plan
  ```

- Build the next step in the project:
  ```bash
  cloving project build
  ```

- Complete and finalize the project:
  ```bash
  cloving project complete
  ```

## Command Line Options

Usage: `cloving [options] [command]`

Integrate AI into your development workflow for generating commit messages, code reviews, and unit tests.

Options:
- `-V, --version`   output the version number
- `-h, --help`      display help for command

Commands:
- `commit`          Generate a commit message and commit the changes
- `config`          Configure Cloving with your API key and model
- `init`            Setup Cloving in the current project
- `models`          List available models
- `generate`        Generate various items like unit-tests and code reviews
  - `commit`        Generate a commit message and commit the changes
  - `unit-tests`    Generate unit tests for the changes
  - `review`        Review the changes and propose improvements
- `project`         Commands for managing Cloving projects
  - `init`          Setup a new Cloving project
  - `plan`          Plan a Cloving project
  - `build`         Build the next step in the project
  - `complete`      Clean up and finalize the project
- `help [command]`  Display help for command

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the [MIT License](LICENSE).

## Acknowledgements

- This project is inspired by [aichat](https://github.com/sigoden/aichat) for interfacing with AI models.
- Special thanks to the open-source community for inspiration and support.