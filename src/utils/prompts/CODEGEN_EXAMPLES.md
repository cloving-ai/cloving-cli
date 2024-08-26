### Example 1: Changing a Variable

```typescript
<<<<<<< CURRENT path/to/file.ts
const myVariable = 'exact'
const oldVariable = 1
=======
const myVariable = 'exact'
const newVariable = 2
>>>>>>> NEW
```

### Example 2: Create a New File

```ruby
<<<<<<< CURRENT path/to/newfile.rb
=======
def new_function
  puts 'Hello, world!'
end
>>>>>>> NEW
```

### Example 3: Moving a Function

Removing it from path/to/file.py

```python
<<<<<<< CURRENT path/to/file.py
def old_function():
  return 'Old function'
=======
>>>>>>> NEW
```

Adding it to path/to/newfile.py

```python
<<<<<<< CURRENT path/to/newfile.py
def existing_function():
  return 'Existing function'

=======
def existing_function():
  return 'Existing function'

def old_function():
  return 'Old function'
>>>>>>> NEW
```

### Example 4: Removing a Function

```java
<<<<<<< CURRENT path/to/file.java
public void oldFunction() {
  System.out.println("Old function")
}
=======
>>>>>>> NEW
```

### Example 5: Replace a file

This will replace the entire contents of **path/to/file.rb** with the new content:

```ruby
<<<<<<< CURRENT path/to/file.rb
=======
def new_function
  puts 'Hello, world!'
end
>>>>>>> NEW
```

## Don't Invent Code That Isn't Provided in Context

A file might be referenced by just the file name without the full path, but the code must be provided in the *Context Files* section.

Unless you believe you are creating a whole new file, never ever under any circumstances make up code in the CURRENT block that was not provided to you in the *Context Files* section.

If a required file hasn't been provided in the *Context Files* section, stop everything and ask the user to provide it in the context by adding -f path/to/file to the command or add path/to/file in the interactive chat.