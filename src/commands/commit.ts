import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { generateCommitMessagePrompt } from '../utils/gitUtils';

export default () => {
  try {
    // Generate the prompt for commit message
    const prompt = generateCommitMessagePrompt();

    // Get the commit message from the AI chat model
    const commitMessage = execSync(`aichat -m "$(model)" -r coder "${prompt}"`).toString();

    // Write the commit message to a temporary file
    const tempCommitFilePath = path.join('.git', 'SUGGESTED_COMMIT_EDITMSG');
    fs.writeFileSync(tempCommitFilePath, commitMessage);

    // Commit the changes using the generated commit message
    execSync(`git commit -a --edit --file=${tempCommitFilePath}`, { stdio: 'inherit' });

    // Remove the temporary file using fs
    fs.unlink(tempCommitFilePath, (err) => {
      if (err) {
        console.error(`Failed to delete ${tempCommitFilePath}:`, err.message);
      } else {
        console.log(`Successfully deleted ${tempCommitFilePath}`);
      }
    });

  } catch (error) {
    console.error('Error generating or committing the message:', (error as Error).message);
  }
};
