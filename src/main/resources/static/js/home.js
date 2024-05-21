/**
 * Splits the string into tokens for more meaningful diffs.
 * @param {string} str - The input string.
 * @returns {Array} Array of tokens.
 */
function splitIntoTokens(str) {
    return str.match(/(\w+|\s+|[^\s\w]+)/g) || [];
}

/**
 * Computes the Longest Common Subsequence (LCS) of two arrays using Hirschberg's algorithm.
 * @param {Array} a - The first array.
 * @param {Array} b - The second array.
 * @returns {Array} The LCS of the two arrays.
 */
function hirschbergLCS(a, b) {
    if (a.length === 0 || b.length === 0) return [];
    if (a.length === 1 || b.length === 1) return lcsBaseCase(a, b);

    const mid = Math.floor(a.length / 2);
    const l1 = lcsLengths(a.slice(0, mid), b);
    const l2 = lcsLengths(reverseArray(a.slice(mid)), reverseArray(b));
    const partition = findPartition(l1, l2);

    const leftLCS = hirschbergLCS(a.slice(0, mid), b.slice(0, partition));
    const rightLCS = hirschbergLCS(a.slice(mid), b.slice(partition));
    return leftLCS.concat(rightLCS);
}

/**
 * Computes the LCS lengths array using dynamic programming.
 * @param {Array} a - The first array.
 * @param {Array} b - The second array.
 * @returns {Array} The LCS lengths array.
 */
function lcsLengths(a, b) {
    let prev = Array(b.length + 1).fill(0);
    let curr = Array(b.length + 1).fill(0);

    for (let i = 1; i <= a.length; i++) {
        [curr, prev] = [prev, curr]; // Swap references instead of copying
        for (let j = 1; j <= b.length; j++) {
            curr[j] = (a[i - 1] === b[j - 1]) ? prev[j - 1] + 1 : Math.max(prev[j], curr[j - 1]);
        }
    }
    return curr;
}

/**
 * Reverses an array.
 * @param {Array} arr - The array to reverse.
 * @returns {Array} The reversed array.
 */
const reverseArray = arr => [...arr].reverse();

/**
 * Finds the partition index for the LCS.
 * @param {Array} l1 - The LCS lengths array for the first half.
 * @param {Array} l2 - The LCS lengths array for the second half.
 * @returns {number} The partition index.
 */
function findPartition(l1, l2) {
    const l2Reversed = l2.reverse();
    let max = -1;
    let index = 0;

    for (let i = 0; i < l1.length; i++) {
        if (l1[i] + l2Reversed[i] > max) {
            max = l1[i] + l2Reversed[i];
            index = i;
        }
    }
    return index;
}

/**
 * Handles the base case for LCS calculation when one of the arrays has length 1.
 * @param {Array} a - The first array.
 * @param {Array} b - The second array.
 * @returns {Array} The LCS of the two arrays.
 */
function lcsBaseCase(a, b) {
    const [short, long] = a.length < b.length ? [a, b] : [b, a];
    return short.filter(char => long.includes(char));
}

/**
 * Finds the common prefix of two arrays.
 * @param {Array} a - The first array.
 * @param {Array} b - The second array.
 * @returns {number} The length of the common prefix.
 */
function commonPrefix(a, b) {
    let i = 0;
    const minLen = Math.min(a.length, b.length);
    while (i < minLen && a[i] === b[i]) i++;
    return i;
}

/**
 * Finds the common suffix of two arrays.
 * @param {Array} a - The first array.
 * @param {Array} b - The second array.
 * @returns {number} The length of the common suffix.
 */
function commonSuffix(a, b) {
    let i = 0;
    const minLen = Math.min(a.length, b.length);
    while (i < minLen && a[a.length - i - 1] === b[b.length - i - 1]) i++;
    return i;
}

/**
 * Calculates the differences between two arrays using the LCS algorithm with candidate optimization.
 * @param {Array} a - The first array to compare.
 * @param {Array} b - The second array to compare.
 * @returns {Array} An array of diff objects with operations: 'equal', 'delete', 'insert'.
 */
function diff(a, b) {
    const diffs = [];

    // Check for common prefix
    const prefixLength = commonPrefix(a, b);
    if (prefixLength > 0) {
        diffs.push({ operation: 'equal', text: a.slice(0, prefixLength).join('') });
        a = a.slice(prefixLength);
        b = b.slice(prefixLength);
    }

    // Check for common suffix
    const suffixLength = commonSuffix(a, b);
    let suffix = '';
    if (suffixLength > 0) {
        suffix = a.slice(a.length - suffixLength).join('');
        a = a.slice(0, a.length - suffixLength);
        b = b.slice(0, b.length - suffixLength);
    }

    // Perform candidate-based LCS diff
    const lcs = hirschbergLCS(a, b);
    let i = 0, j = 0, k = 0;

    // Iterate through both arrays to determine differences based on LCS
    while (i < a.length || j < b.length) {
        if (k < lcs.length && a[i] === lcs[k] && b[j] === lcs[k]) {
            diffs.push({ operation: 'equal', text: lcs[k] });
            i++;
            j++;
            k++;
        } else {
            if (i < a.length && (k >= lcs.length || a[i] !== lcs[k])) {
                diffs.push({ operation: 'delete', text: a[i] });
                i++;
            }
            if (j < b.length && (k >= lcs.length || b[j] !== lcs[k])) {
                diffs.push({ operation: 'insert', text: b[j] });
                j++;
            }
        }
    }

    // Add common suffix to the end of diffs
    if (suffixLength > 0) {
        diffs.push({ operation: 'equal', text: suffix });
    }

    return diffs;
}

/**
 * Finds and visualizes the differences between two input strings.
 * Highlights deletions in red and insertions in green.
 */
function findDifference() {
    const string1 = document.getElementById('string1').value;
    const string2 = document.getElementById('string2').value;
    const result = document.getElementById('result');
    result.innerHTML = '';

    const tokens1 = splitIntoTokens(string1);
    const tokens2 = splitIntoTokens(string2);

    const startTime = performance.now();

    // Check for identical strings early to avoid unnecessary calculations
    if (string1 === string2) {
        const endTime = performance.now();
        const timeTaken = endTime - startTime;
        result.innerHTML = '<div class="result-line">Strings are identical.</div>' +
            '<div class="time-taken">Time taken: ' + timeTaken.toFixed(2) + ' ms</div>';
        return;
    }

    const diffs = diff(tokens1, tokens2);

    // Handle the case where no differences are found
    if (diffs.length === 0) {
        const endTime = performance.now();
        const timeTaken = endTime - startTime;
        result.innerHTML = '<div class="time-taken">No differences found. Time taken: ' + timeTaken.toFixed(2) + ' ms</div>';
        return;
    }

    let deletedParts = '';
    let insertedParts = '';

    // Construct the visual representation of the differences
    diffs.forEach(part => {
        if (part.operation === 'delete') {
            deletedParts += '<span class="deleted">' + escapeHtml(part.text) + '</span>';
            insertedParts += '<span class="placeholder">' + ' '.repeat(part.text.length) + '</span>';
        } else if (part.operation === 'insert') {
            insertedParts += '<span class="added">' + escapeHtml(part.text) + '</span>';
            deletedParts += '<span class="placeholder">' + ' '.repeat(part.text.length) + '</span>';
        } else {
            deletedParts += escapeHtml(part.text);
            insertedParts += escapeHtml(part.text);
        }
    });

    const endTime = performance.now();
    const timeTaken = endTime - startTime;

    // Display the result and time taken
    result.innerHTML = '<div class="result-line">' + deletedParts + '</div>' +
        '<div class="result-line">' + insertedParts + '</div>' +
        '<div class="time-taken">Time taken: ' + timeTaken.toFixed(2) + ' ms</div>';
}

/**
 * Escapes HTML characters to prevent XSS attacks.
 * @param {string} text - The text to escape.
 * @returns {string} The escaped text.
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(text));
    return div.innerHTML;
}
