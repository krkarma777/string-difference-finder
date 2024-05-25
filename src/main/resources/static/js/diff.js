/**
 * Splits the string into tokens for more meaningful diffs.
 * @param {string} str - The input string.
 * @returns {Array} Array of tokens.
 */
function splitIntoTokens(str) {
    return str.match(/(\w+|\s+|[^\s\w]+)/g) || [];
}

/**
 * Computes the Longest Common Subsequence (LCS) of two arrays using Hirschberg's algorithm with space division optimization.
 * @param {Array} a - The first array.
 * @param {Array} b - The second array.
 * @returns {Array} The LCS of the two arrays.
 */
async function hirschbergLCS(a, b) {
    // Base cases for recursion
    if (a.length === 0) return [];
    if (a.length === 1) return b.includes(a[0]) ? [a[0]] : [];
    if (b.length === 1) return a.includes(b[0]) ? [b[0]] : [];

    const mid = Math.floor(a.length / 2);

    try {
        // Calculate LCS lengths for both halves
        const [l1, l2] = await Promise.all([
            lcsLengths(a.slice(0, mid), b),
            lcsLengths(reverseArray(a.slice(mid)), reverseArray(b))
        ]);

        // Find the partition point in the second string
        const partition = findPartition(l1, l2);

        // Recursively solve for both halves
        const [leftLCS, rightLCS] = await Promise.all([
            hirschbergLCS(a.slice(0, mid), b.slice(0, partition)),
            hirschbergLCS(a.slice(mid), b.slice(partition))
        ]);

        return leftLCS.concat(rightLCS);
    } catch (error) {
        console.error('Error in hirschbergLCS:', error);
        return [];
    }
}

/**
 * Computes the LCS lengths array using dynamic programming with space optimization.
 * @param {Array} a - The first array.
 * @param {Array} b - The second array.
 * @returns {Array} The LCS lengths array.
 */
async function lcsLengths(a, b) {
    const n = b.length;
    let current = new Array(n + 1).fill(0);
    let previous = new Array(n + 1).fill(0);

    try {
        for (let i = 1; i <= a.length; i++) {
            for (let j = 1; j <= n; j++) {
                if (a[i - 1] === b[j - 1]) {
                    current[j] = previous[j - 1] + 1;
                } else {
                    current[j] = Math.max(previous[j], current[j - 1]);
                }
            }
            [previous, current] = [current, previous];
        }
        return previous;
    } catch (error) {
        console.error('Error in lcsLengths:', error);
        return [];
    }
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
    const l2Reversed = [...l2].reverse();
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
 * Calculates the differences between two arrays using the LCS algorithm with candidate optimization and parallel processing.
 * @param {Array} a - The first array to compare.
 * @param {Array} b - The second array to compare.
 * @returns {Array} An array of diff objects with operations: 'equal', 'delete', 'insert'.
 */
async function diff(a, b) {
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

    try {
        // Perform candidate-based LCS diff
        const lcs = await hirschbergLCS(a, b);
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
    } catch (error) {
        console.error('Error in diff:', error);
        return [];
    }
}

/**
 * Finds and visualizes the differences between two input strings using parallel processing.
 * Highlights deletions in red and insertions in green.
 */
async function findDifference() {
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

    try {
        const diffs = await diff(tokens1, tokens2);

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

        // Display the differences and the time taken to compute them
        result.innerHTML = '<div class="result-line">' + deletedParts + '</div>' +
            '<div class="result-line">' + insertedParts + '</div>' +
            '<div class="time-taken">Time taken: ' + timeTaken.toFixed(2) + ' ms</div>';
    } catch (error) {
        console.error('Error in findDifference:', error);
        result.innerHTML = '<div class="error-message">An error occurred while computing differences.</div>';
    }
}

/**
 * Escapes HTML characters to prevent XSS attacks.
 * @param {string} text - The text to escape.
 * @returns {string} The escaped text.
 */
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;',
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

// Event listener for the "Compare" button
document.getElementById('compare-button').addEventListener('click', findDifference);
