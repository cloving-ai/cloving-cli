# Cloving

Cloving is an innovative tool designed to seamlessly integrate AI into various aspects of the developer workflow. It aims to enhance productivity and code quality by leveraging AI for tasks such as generating commit messages, conducting code reviews, and creating unit tests.

## Features

- AI-powered Git commit message generation
- Automated code reviews with AI insights
- AI-assisted unit test generation
- Seamless integration with existing development workflows
- Customizable AI prompts for different tasks

## Prerequisites

- Node.js (version 20 or higher)
- Git
- API access to AI chat models (e.g., OpenAI GPT-4o, Claude, etc.)

## Installation

1. Clone this repository:
   ```
   git clone https://github.com/clovingai/cloving-cli.git
   ```

2. Navigate to the project directory:
   ```
   cd cloving-cli
   ```

3. Install dependencies:
   ```
   yarn install
   ```

4. Set up your AI chat model environment variable:
   ```
   export CLOVING_MODEL=your_preferred_model
   export CLOVING_API_KEY=your_api_key
   ```

## Usage

### Generating Commit Messages

Run the following command in your Git repository:

```
cloving commit
```

This will generate an AI-powered commit message based on your recent changes, allow you to review and edit it, and then commit your changes.

### Code Reviews

To get an AI-powered code review for your latest changes:

```
cloving review
```

### Generating Unit Tests

To generate unit tests for a specific file or function:

```
cloving unit-tests [file_path_to_test]
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the [MIT License](LICENSE).

## Acknowledgements

- This project is inspired by [aichat](https://github.com/sigoden/aichat) for interfacing with AI models.
- Special thanks to the open-source community for inspiration and support.
