function findDifference() {
    const string1 = document.getElementById('string1').value;
    const string2 = document.getElementById('string2').value;
    const result = document.getElementById('result');
    result.innerHTML = '';

    let output1 = '';
    let output2 = '';

    const maxLineLength = Math.max(string1.length, string2.length);
    for (let i = 0; i < maxLineLength; i++) {
        const char1 = string1[i] || '';
        const char2 = string2[i] || '';
        if (char1 !== char2) {
            output1 += '<span class="deleted">' + char1 + '</span>';
            output2 += '<span class="added">' + char2 + '</span>';
        } else {
            output1 += char1;
            output2 += char2;
        }
    }

    result.innerHTML += '<div class="result-line">' + output1 + '</div>';
    result.innerHTML += '<div class="result-line">' + output2 + '</div>';
}