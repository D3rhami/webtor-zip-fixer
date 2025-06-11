(function() {
    let progressPanelElement = null;
    let urlObserver = null;
    let urlCheckTimeout = null;
    let urlCheckInterval = null;
    let themeObserver = null;
    let donateButtonIcon = null;
    window.progressRows = {};
    let extractedUrl = null;
    let retryTimer = null;

    function updateDonateButtonIcon(iconElement) {
        const isDarkTheme = document.documentElement.getAttribute('data-theme') === 'night';
        iconElement.src = chrome.runtime.getURL(`icons/donate${isDarkTheme ? '' : '_dark'}.png`);
    }

    function setupThemeObserver() {
        if (themeObserver) return;
        themeObserver = new MutationObserver(() => {
            if (donateButtonIcon) {
                updateDonateButtonIcon(donateButtonIcon);
            }
        });
        themeObserver.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['data-theme']
        });
    }

    function createProgressPanel() {
        if (progressPanelElement) {
            progressPanelElement.remove();
        }
        progressPanelElement = document.createElement('div');
        progressPanelElement.className = 'dfz-progress-panel';
        window.progressRows = {};
        const progressBarContainer = document.createElement('div');
        progressBarContainer.className = 'dfz-progress-bar-container';
        const progressBarFill = document.createElement('div');
        progressBarFill.className = 'dfz-progress-bar-fill';
        progressBarContainer.appendChild(progressBarFill);
        progressPanelElement.appendChild(progressBarContainer);
        return progressPanelElement;
    }

    function addProgressRow(id, text, status = 'processing') {
        if (!progressPanelElement) return;
        const row = document.createElement('div');
        row.className = 'dfz-progress-row';
        row.dataset.id = id;
        const textContainer = document.createElement('div');
        textContainer.style.display = 'flex';
        textContainer.style.alignItems = 'center';
        const textSpan = document.createElement('span');
        textSpan.className = 'dfz-progress-text';
        textSpan.textContent = '> ' + text;
        textContainer.appendChild(textSpan);
        const statusSpan = document.createElement('span');
        statusSpan.className = `dfz-progress-status dfz-status-${status}`;
        statusSpan.textContent = status;
        row.appendChild(textContainer);
        row.appendChild(statusSpan);
        if (progressPanelElement.querySelector('.dfz-progress-bar-container')) {
            const progressBar = progressPanelElement.querySelector('.dfz-progress-bar-container');
            progressPanelElement.insertBefore(row, progressBar);
        } else {
            progressPanelElement.appendChild(row);
        }
        window.progressRows[id] = { element: row, textSpan, statusSpan, textContainer };
        return row;
    }

    function createActionButton(text, iconPath, href, isDownload = false) {
        const button = isDownload ? document.createElement('button') : document.createElement('a');
        button.className = 'dfz-action-btn';
        if (href && !isDownload) button.href = href;
        if (!isDownload) button.target = '_blank';
        const icon = document.createElement('img');
        icon.className = `dfz-action-btn-icon ${iconPath.includes('github.png') ? 'github' : ''} ${iconPath.includes('donate.png') ? 'donate' : ''}`;
        if (iconPath === 'icons/donate.png') {
            donateButtonIcon = icon;
            updateDonateButtonIcon(icon);
        } else {
            icon.src = chrome.runtime.getURL(iconPath);
        }
        const textSpan = document.createElement('span');
        textSpan.className = 'dfz-action-btn-text';
        textSpan.textContent = text === 'DONATE' ? 'Donate to Webtor' : text;
        button.appendChild(icon);
        button.appendChild(textSpan);
        if (isDownload) {
            button.addEventListener('click', () => {
                const filename = 'fixed_' + (new URL(window.dfzExtractedUrl).pathname.split('/').pop() || 'file.zip');
                const a = document.createElement('a');
                a.href = window.dfzFixedBlobUrl;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
            });
        }
        if (iconPath === 'icons/donate.png') {
            button.addEventListener('mouseenter', () => {
                icon.dataset.hover = 'true';
            });
            button.addEventListener('mouseleave', () => {
                icon.dataset.hover = 'false';
                updateDonateButtonIcon(icon);
            });
        }
        return button;
    }

    function createCopyButton(url) {
        const button = document.createElement('a');
        button.className = 'dfz-copy-btn';
        button.href = url;
        button.title = 'Copy the download link for the original Webtor ZIP file';
        const icon = document.createElement('img');
        icon.className = 'dfz-copy-btn-icon';
        icon.src = chrome.runtime.getURL('icons/copy.png');
        button.appendChild(icon);
        button.addEventListener('click', (e) => {
            e.preventDefault();
            navigator.clipboard.writeText(url).then(() => {
                const popup = document.createElement('div');
                popup.className = 'dfz-copy-popup';
                popup.textContent = 'Copied to clipboard';
                document.body.appendChild(popup);
                setTimeout(() => {
                    popup.remove();
                }, 1500);
                window.dfzActivateDynamicPanelHiding();
            });
        });
        return button;
    }

    window.updateProgressRowStatus = function(id, status, retryInfo = null) {
        if (window.progressRows[id]) {
            const { statusSpan, textContainer } = window.progressRows[id];
            // Prevent changing state if already done
            if (statusSpan.textContent === 'done' && status !== 'done') {
                return;
            }
            statusSpan.className = `dfz-progress-status dfz-status-${status}`;
            statusSpan.textContent = status;

            if (id === 'download_zip') {
                const downloadInfo = window.progressRows['download_info'];
                const downloadProgress = window.progressRows['download_progress'];
                if (downloadInfo && downloadProgress) {
                    if (status === 'retrying' && retryInfo) {
                        const { attempt, maxAttempts, startTime, timeoutMs } = retryInfo;
                        // Clear any existing timer
                        if (retryTimer) {
                            clearInterval(retryTimer);
                        }
                        // Update progress bar to retrying state
                        downloadProgress.progressFill.classList.add('retrying');
                        downloadProgress.progressFill.style.width = '0%';
                        // Start timer to update elapsed time
                        retryTimer = setInterval(() => {
                            const elapsed = (Date.now() - startTime) / 1000;
                            if (elapsed >= timeoutMs / 1000 || statusSpan.textContent !== 'retrying') {
                                clearInterval(retryTimer);
                                retryTimer = null;
                                return;
                            }
                            downloadInfo.stats.textContent = `Trying to solve the problem [${window.dfzFormatTimeSeconds(elapsed)} / ${Math.floor(timeoutMs / 1000)}s] | attempt: ${attempt}/${maxAttempts}`;
                        }, 100);
                    } else if (status === 'processing') {
                        // Clear retry timer and reset UI for processing
                        if (retryTimer) {
                            clearInterval(retryTimer);
                            retryTimer = null;
                        }
                        downloadProgress.progressFill.classList.remove('retrying');
                        downloadInfo.stats.textContent = 'Starting download...';
                    } else if (status === 'failed' || status === 'done') {
                        // Clear retry timer and stop animations
                        if (retryTimer) {
                            clearInterval(retryTimer);
                            retryTimer = null;
                        }
                        downloadProgress.progressFill.classList.remove('retrying');
                        if (downloadProgress.progressSlash) {
                            downloadProgress.progressSlash.style.animation = 'none';
                        }
                    }
                }
            }

            if (id === 'url_retrieval' && (status === 'done' || status === 'failed')) {
                const progressBarContainer = progressPanelElement.querySelector('.dfz-progress-bar-container');
                if (progressBarContainer) {
                    progressBarContainer.remove();
                }
                if (status === 'done' && window.dfzExtractedUrl && typeof window.dfzStartDownload === 'function') {
                    textContainer.appendChild(createCopyButton(window.dfzExtractedUrl));
                    addProgressRow('download_zip', 'Download ZIP File', 'processing');
                    window.dfzStartDownload(window.dfzExtractedUrl);
                }
            }
            if (id === 'download_zip' && status === 'done' && window.dfzTempBlobUrl && typeof window.dfzStartFixingZip === 'function') {
                if (window.progressRows['download_info']) {
                    window.progressRows['download_info'].element.remove();
                    delete window.progressRows['download_info'];
                }
                if (window.progressRows['download_progress']) {
                    window.progressRows['download_progress'].element.remove();
                    delete window.progressRows['download_progress'];
                }
                addProgressRow('fix_zip', 'Fixing ZIP File', 'processing');
                window.dfzStartFixingZip(window.dfzTempBlobUrl);
            }
            if (id === 'fix_zip' && status === 'done' && window.dfzFixedBlobUrl) {
                if (window.progressRows['fixing_info']) {
                    window.progressRows['fixing_info'].element.remove();
                    delete window.progressRows['fixing_info'];
                }
                if (window.progressRows['fixing_progress']) {
                    window.progressRows['fixing_progress'].element.remove();
                    delete window.progressRows['fixing_progress'];
                }
                const container = document.createElement('div');
                container.className = 'dfz-action-btn-container';
                container.appendChild(createActionButton('Donate to Webtor', 'icons/donate.png', 'https://webtor.io/donate'));
                container.appendChild(createActionButton('Save Fixed Zip File', 'icons/download.png', '', true));
                container.appendChild(createActionButton('Extension', 'icons/github.png', 'https://github.com'));
                progressPanelElement.appendChild(container);
                setupThemeObserver();
            }
        }
    };

    function cleanupUrlExtraction() {
        if (urlObserver) {
            urlObserver.disconnect();
            urlObserver = null;
        }
        if (urlCheckTimeout) {
            clearTimeout(urlCheckTimeout);
            urlCheckTimeout = null;
        }
        if (urlCheckInterval) {
            clearInterval(urlCheckInterval);
            urlCheckInterval = null;
        }
    }

    function extractUrlFromPanel(panel) {
        const scriptTag = panel.querySelector('script');
        if (scriptTag && scriptTag.textContent) {
            const match = scriptTag.textContent.match(/var url\s*=\s*"([^"]+)"/);
            if (match && match[1]) {
                let url = match[1];
                url = url.replace(/\\u0026/g, '&');
                return url;
            }
        }
        return null;
    }

    function checkExistingPanelsForUrl() {
        const panels = document.querySelectorAll('form.progress-alert');
        for (const panel of panels) {
            if (panel.style.display !== 'none') {
                panel.style.display = 'none';
            }
            const url = extractUrlFromPanel(panel);
            if (url) {
                extractedUrl = url;
                window.dfzExtractedUrl = url;
                window.updateProgressRowStatus('url_retrieval', 'done');
                cleanupUrlExtraction();
                return true;
            }
        }
        return false;
    }

    window.dfzStartUrlExtractionProcess = function(insertAfterElement) {
        cleanupUrlExtraction();
        extractedUrl = null;
        const panel = createProgressPanel();
        insertAfterElement.parentNode.insertBefore(panel, insertAfterElement.nextSibling);
        addProgressRow('url_retrieval', 'Retrieving Download Link', 'processing');
        if (checkExistingPanelsForUrl()) {
            return;
        }
        urlObserver = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                for (const node of mutation.addedNodes) {
                    if (node.nodeType === 1 && node.matches('form.progress-alert')) {
                        const url = extractUrlFromPanel(node);
                        if (url) {
                            extractedUrl = url;
                            window.dfzExtractedUrl = url;
                            window.updateProgressRowStatus('url_retrieval', 'done');
                            cleanupUrlExtraction();
                            return;
                        }
                    }
                }
            }
            for (const mutation of mutations) {
                if (mutation.type === 'characterData' && mutation.target.nodeType === 3) {
                    const parent = mutation.target.parentElement;
                    if (parent && parent.closest('form.progress-alert')) {
                        const url = extractUrlFromPanel(parent.closest('form.progress-alert'));
                        if (url) {
                            extractedUrl = url;
                            window.dfzExtractedUrl = url;
                            window.updateProgressRowStatus('url_retrieval', 'done');
                            cleanupUrlExtraction();
                            return;
                        }
                    }
                }
            }
        });
        urlObserver.observe(document.body, {
            childList: true,
            subtree: true,
            characterData: true
        });
        urlCheckInterval = setInterval(() => {
            if (checkExistingPanelsForUrl()) {
                return;
            }
        }, 2000);
        urlCheckTimeout = setTimeout(() => {
            window.updateProgressRowStatus('url_retrieval', 'failed');
            cleanupUrlExtraction();
        }, 30000);
    };

    window.dfzClearProgressPanel = function() {
        if (progressPanelElement) {
            progressPanelElement.remove();
            progressPanelElement = null;
            window.progressRows = {};
        }
        if (themeObserver) {
            themeObserver.disconnect();
            themeObserver = null;
        }
        if (retryTimer) {
            clearInterval(retryTimer);
            retryTimer = null;
        }
        donateButtonIcon = null;
        cleanupUrlExtraction();
    }
})();