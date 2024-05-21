# String Difference Finder
![image](https://github.com/krkarma777/string-difference-finder/assets/149022496/3308901b-2764-417b-8775-bbeb4764e959)

## Overview

String Difference Finder is a web-based tool that allows you to compare two strings and visualize their differences. It highlights deletions in red and insertions in green, providing an intuitive way to understand changes between two versions of text. The tool leverages parallel processing to optimize the performance of the Longest Common Subsequence (LCS) algorithm, making it efficient for large inputs.

## Features

- **Token-based Diffing**: Splits strings into meaningful tokens for more accurate and readable diffs.
- **Parallel Processing**: Utilizes parallel processing in LCS calculations to improve performance.
- **Visual Highlighting**: Highlights deletions and insertions in red and green, respectively.
- **Performance Metrics**: Displays the time taken to compute the differences.
- **User-friendly Interface**: Simple and intuitive web interface for comparing strings.

## Getting Started

### Prerequisites

- Java Development Kit (JDK) 17 or later
- A web browser (Chrome, Firefox, Safari, etc.)
- A web server to host the HTML and JavaScript files (optional for local usage)

### Installation

1. Clone the repository:
   ```sh
   git clone https://github.com/krkarma777/string-difference-finder.git
   cd string-difference-finder
   ```

2. Build and run the Spring Boot application:
   ```sh
   ./gradlew bootRun
   ```

3. Open your web browser and navigate to:
   ```
   http://localhost:8090/
   ```

### Usage

1. Enter the first string in the "First String" textarea.
2. Enter the second string in the "Second String" textarea.
3. Click the "Show Difference" button to see the highlighted differences.

### Example

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>String Difference Finder</title>
    <link rel="stylesheet" href="/stylesheet/diff.css"/>
</head>
<body>
<h1>String Difference Finder</h1>
<label for="string1">First String:</label>
<textarea id="string1" placeholder="Enter first string">
committer_list_per_month[date + '-' + log[i].author] = 1;
</textarea>
<br>
<label for="string2">Second String:</label>
<textarea id="string2" placeholder="Enter second string">
var date_author = date + '-' + log[i].author;
</textarea>
<br>
<button onclick="findDifference()">Show Difference</button>
<div id="result" class="difference"></div>
<script src="/js/diff.js"></script>
</body>
</html>
```

## Configuration

The application can be configured using the `application.properties` file:

```properties
spring.application.name=TextDiffTool
server.port=8090
```

## References

- **Myer's Diff Algorithm**:
  - [A technique for isolating differences between files](http://portal.acm.org/citation.cfm?doid=359460.359467)
  - [An Algorithm for Differential File Comparison](https://www.cs.dartmouth.edu/~doug/diff.pdf)
- **Diff-match-patch**:
  - [Google's diff-match-patch library](https://github.com/google/diff-match-patch)
- **Pre-diff speedups and post-diff cleanups**:
  - [Neil Fraser's writing on diff](https://neil.fraser.name/writing/diff/)

## Contributing

We welcome contributions to improve this tool! Here are some ways you can help:

- Reporting issues
- Adding new features
- Improving documentation

To contribute:

1. Fork the repository
2. Create a new branch (`git checkout -b feature/your-feature`)
3. Commit your changes (`git commit -am 'Add some feature'`)
4. Push to the branch (`git push origin feature/your-feature`)
5. Create a new Pull Request

## Contact

For any inquiries, please contact [krkarma777@gmail.com] or open an issue on GitHub.
