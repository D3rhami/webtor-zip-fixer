console.log("📦 Webtor-Zip-Fixer extension version 2.0 loaded");

let downloadUrl = null;
let urlCheckTimeout = null;
let urlObserver = null;

window.dfzFormatBytes = function(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

window.dfzFormatTime = function(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}m ${remainingSeconds}s`;
};

window.dfzFormatTimeSeconds = function(seconds, decimals = 1) {
    return seconds.toFixed(decimals) + 's';
};

function extractDownloadUrl(panel) {
    const urlScript = panel.querySelector('script');
    if (!urlScript) return null;

    try {
        const scriptContent = urlScript.textContent;
        const urlMatch = scriptContent.match(/var url = "([^"]+)"/);
        if (urlMatch && urlMatch[1]) {
            return urlMatch[1]
                .replace(/\\u0026/g, '&')
                .replace(/\\/g, '');
        }
    } catch (e) {
        console.log("📦 Error parsing download URL:", e);
    }
    return null;
}

function handleFoundUrl(url) {
    console.log("📦 Found download URL:", url);
    cleanupUrlWatchers();
}

function cleanupUrlWatchers() {
    if (urlObserver) {
        urlObserver.disconnect();
        urlObserver = null;
    }
    if (urlCheckTimeout) {
        clearTimeout(urlCheckTimeout);
        urlCheckTimeout = null;
    }
}

function setupUrlObserver() {
    cleanupUrlWatchers();

    urlObserver = new MutationObserver((mutations) => {
        mutations.forEach(mutation => {
            mutation.addedNodes.forEach(node => {
                if (node.nodeType === 1 && node.matches('form.progress-alert')) {
                    const url = extractDownloadUrl(node);
                    if (url) {
                        downloadUrl = url;
                        handleFoundUrl(url);
                    }
                }
            });
        });
    });

    urlObserver.observe(document.body, {
        childList: true,
        subtree: true
    });

    urlCheckTimeout = setTimeout(() => {
        if (!downloadUrl) {
            console.log("📦 Timeout reached without finding download URL");
            cleanupUrlWatchers();
        }
    }, 30000);
}

window.dfzStartUrlExtraction = function() {
    downloadUrl = null;
    setupUrlObserver();
};