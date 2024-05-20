function findDifference() {
    console.log("findDifference called");
    const string1 = document.getElementById('string1').value;
    const string2 = document.getElementById('string2').value;
    const result = document.getElementById('result');
    result.innerHTML = '';

    const startTime = performance.now();

    if (string1 === string2) {
        const endTime = performance.now();
        const timeTaken = endTime - startTime;
        result.innerHTML = '<div class="result-line">Strings are identical.</div>' +
            '<div class="time-taken">Time taken: ' + timeTaken.toFixed(2) + ' ms</div>';
        return;
    }

    console.log("Input strings:", string1, string2);
    const diffs = diff(string1, string2);

    if (diffs.length === 0) {
        const endTime = performance.now();
        const timeTaken = endTime - startTime;
        result.innerHTML = '<div class="time-taken">No differences found. Time taken: ' + timeTaken.toFixed(2) + ' ms</div>';
        return;
    }

    console.log("Diffs:", diffs);

    let deletedParts = '';
    let insertedParts = '';

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

    result.innerHTML = '<div class="result-line">' + deletedParts + '</div>' +
        '<div class="result-line">' + insertedParts + '</div>' +
        '<div class="time-taken">Time taken: ' + timeTaken.toFixed(2) + ' ms</div>';
}

function diff(a, b) {
    const lcs = longestCommonSubsequence(a, b);
    let i = 0, j = 0, k = 0;
    const diffs = [];

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

    return diffs;
}

function longestCommonSubsequence(a, b) {
    const dp = Array(a.length + 1).fill(null).map(() => Array(b.length + 1).fill(''));
    for (let i = 1; i <= a.length; i++) {
        for (let j = 1; j <= b.length; j++) {
            if (a[i - 1] === b[j - 1]) {
                dp[i][j] = dp[i - 1][j - 1] + a[i - 1];
            } else {
                dp[i][j] = dp[i - 1][j].length > dp[i][j - 1].length ? dp[i - 1][j] : dp[i][j - 1];
            }
        }
    }
    return dp[a.length][b.length];
}

function escapeHtml(text) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(text));
    return div.innerHTML;
}
