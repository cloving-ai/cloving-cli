# Shell Script Instructions

Generate an executable script that works on the current operating system. Try to make it a single line if possible and as simple and straightforward as possible.

Do not add any commentary or context to the message other than the commit message itself.

## Example

An example of the output for this should look like the following:

```sh
find . -type f -name "*.ts" -exec sed -i '' 's/old/new/g' {} +
```

Don't use that script, it is only an example.
