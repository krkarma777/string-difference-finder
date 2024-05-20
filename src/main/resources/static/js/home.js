/**
 * Computes the Longest Common Subsequence (LCS) of two strings using Hirschberg's algorithm.
 * @param {string} a - The first string.
 * @param {string} b - The second string.
 * @returns {string} The LCS of the two strings.
 */
function hirschbergLCS(a, b) {
    if (a.length === 0 || b.length === 0) {
        return '';
    }
    if (a.length === 1 || b.length === 1) {
        return lcsBaseCase(a, b);
    }

    const mid = Math.floor(a.length / 2);
    const l1 = lcsLengths(a.slice(0, mid), b);
    const l2 = lcsLengths(reverseString(a.slice(mid)), reverseString(b));
    const partition = findPartition(l1, l2);

    const leftLCS = hirschbergLCS(a.slice(0, mid), b.slice(0, partition));
    const rightLCS = hirschbergLCS(a.slice(mid), b.slice(partition));
    return leftLCS + rightLCS;
}

/**
 * Computes the LCS lengths array using dynamic programming.
 * @param {string} a - The first string.
 * @param {string} b - The second string.
 * @returns {Array} The LCS lengths array.
 */
function lcsLengths(a, b) {
    const curr = Array(b.length + 1).fill(0);
    const prev = Array(b.length + 1).fill(0);

    for (let i = 1; i <= a.length; i++) {
        for (let j = 1; j <= b.length; j++) {
            if (a[i - 1] === b[j - 1]) {
                curr[j] = prev[j - 1] + 1;
            } else {
                curr[j] = Math.max(curr[j - 1], prev[j]);
            }
        }
        for (let j = 0; j <= b.length; j++) {
            prev[j] = curr[j];
        }
    }
    return curr;
}

/**
 * Reverses a string.
 * @param {string} s - The string to reverse.
 * @returns {string} The reversed string.
 */
function reverseString(s) {
    return s.split('').reverse().join('');
}

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
 * Handles the base case for LCS calculation when one of the strings has length 1.
 * @param {string} a - The first string.
 * @param {string} b - The second string.
 * @returns {string} The LCS of the two strings.
 */
function lcsBaseCase(a, b) {
    const [short, long] = a.length < b.length ? [a, b] : [b, a];
    return short.split('').find(char => long.includes(char)) || '';
}

/**
 * Finds the common prefix of two strings.
 * @param {string} a - The first string.
 * @param {string} b - The second string.
 * @returns {number} The length of the common prefix.
 */
function commonPrefix(a, b) {
    let i;
    for (i = 0; i < Math.min(a.length, b.length); i++) {
        if (a[i] !== b[i]) break;
    }
    return i;
}

/**
 * Finds the common suffix of two strings.
 * @param {string} a - The first string.
 * @param {string} b - The second string.
 * @returns {number} The length of the common suffix.
 */
function commonSuffix(a, b) {
    let i;
    for (i = 0; i < Math.min(a.length, b.length); i++) {
        if (a[a.length - i - 1] !== b[b.length - i - 1]) break;
    }
    return i;
}

/**
 * Calculates the differences between two strings using the Longest Common Subsequence (LCS) algorithm.
 * @param {string} a - The first string to compare.
 * @param {string} b - The second string to compare.
 * @returns {Array} An array of diff objects with operations: 'equal', 'delete', 'insert'.
 */
function diff(a, b) {
    const diffs = [];

    // Check for common prefix
    const prefixLength = commonPrefix(a, b);
    if (prefixLength > 0) {
        diffs.push({ operation: 'equal', text: a.substring(0, prefixLength) });
        a = a.substring(prefixLength);
        b = b.substring(prefixLength);
    }

    // Check for common suffix
    const suffixLength = commonSuffix(a, b);
    let suffix = '';
    if (suffixLength > 0) {
        suffix = a.substring(a.length - suffixLength);
        a = a.substring(0, a.length - suffixLength);
        b = b.substring(0, b.length - suffixLength);
    }

    // Perform LCS-based diff
    const lcs = hirschbergLCS(a, b);
    let i = 0, j = 0, k = 0;

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
    console.log("findDifference called");
    const string1 = document.getElementById('string1').value;
    const string2 = document.getElementById('string2').value;
    const result = document.getElementById('result');
    result.innerHTML = '';

    const startTime = performance.now();

    // Check for identical strings early to avoid unnecessary calculations
    if (string1 === string2) {
        const endTime = performance.now();
        const timeTaken = endTime - startTime;
        result.innerHTML = '<div class="result-line">Strings are identical.</div>' +
            '<div class="time-taken">Time taken: ' + timeTaken.toFixed(2) + ' ms</div>';
        return;
    }

    console.log("Input strings:", string1, string2);
    const diffs = diff(string1, string2);

    // Handle the case where no differences are found
    if (diffs.length === 0) {
        const endTime = performance.now();
        const timeTaken = endTime - startTime;
        result.innerHTML = '<div class="time-taken">No differences found. Time taken: ' + timeTaken.toFixed(2) + ' ms</div>';
        return;
    }

    console.log("Diffs:", diffs);

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
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(text));
    return div.innerHTML;
}
