/**
 * Computes the LCS of two strings using the candidate method as described in the diff algorithm.
 * @param {string} a - The first string.
 * @param {string} b - The second string.
 * @returns {Array} The LCS of the two strings as a list of indices.
 */
function candidateLCS(a, b) {
    const n = a.length;
    const m = b.length;

    if (n === 0 || m === 0) {
        return [];
    }

    // Step 1: Create equivalence classes for b
    const eqClasses = {};
    for (let j = 0; j < m; j++) {
        if (!eqClasses[b[j]]) {
            eqClasses[b[j]] = [];
        }
        eqClasses[b[j]].push(j + 1);
    }

    // Step 2: Initialize the candidate list
    let candidates = [{ i: 0, j: 0 }];
    const prev = Array(n + 1).fill(0);

    for (let i = 1; i <= n; i++) {
        let newCandidates = [];
        if (eqClasses[a[i - 1]]) {
            for (const j of eqClasses[a[i - 1]]) {
                if (j > prev[i - 1]) {
                    newCandidates.push({ i: i, j: j });
                    prev[i] = j;
                    break;
                }
            }
        }
        candidates = mergeCandidates(candidates, newCandidates);
    }

    return candidates.map(c => ({ i: c.i - 1, j: c.j - 1 }));
}

/**
 * Merges two lists of candidates, maintaining the order and removing duplicates.
 * @param {Array} candidates - The existing list of candidates.
 * @param {Array} newCandidates - The new list of candidates to merge.
 * @returns {Array} The merged list of candidates.
 */
function mergeCandidates(candidates, newCandidates) {
    let merged = [];
    let i = 0, j = 0;

    while (i < candidates.length && j < newCandidates.length) {
        if (candidates[i].j < newCandidates[j].j) {
            merged.push(candidates[i]);
            i++;
        } else if (candidates[i].j > newCandidates[j].j) {
            merged.push(newCandidates[j]);
            j++;
        } else {
            merged.push(newCandidates[j]);
            i++;
            j++;
        }
    }

    while (i < candidates.length) {
        merged.push(candidates[i]);
        i++;
    }

    while (j < newCandidates.length) {
        merged.push(newCandidates[j]);
        j++;
    }

    return merged;
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
 * Calculates the differences between two strings using the LCS algorithm with candidate optimization.
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

    // Perform candidate-based LCS diff
    const lcsIndices = candidateLCS(a, b);
    let i = 0, j = 0, k = 0;

    while (i < a.length || j < b.length) {
        if (k < lcsIndices.length && i === lcsIndices[k].i && j === lcsIndices[k].j) {
            diffs.push({ operation: 'equal', text: a[i] });
            i++;
            j++;
            k++;
        } else {
            if (i < a.length && (k >= lcsIndices.length || i !== lcsIndices[k].i)) {
                diffs.push({ operation: 'delete', text: a[i] });
                i++;
            }
            if (j < b.length && (k >= lcsIndices.length || j !== lcsIndices[k].j)) {
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
