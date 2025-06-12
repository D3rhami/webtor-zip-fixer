(function() {
    let downloadController = null;
    let downloadStartTime = null;
    let downloadedBytes = 0;
    let totalBytes = 0;
    let tempBlobUrl = null;
    let lastError = null;
    let globalAttemptCount = 0;

    function createDownloadProgressDisplay() {
        const downloadInfoRow = document.createElement('div');
        downloadInfoRow.className = 'dfz-download-info-row';
        downloadInfoRow.dataset.id = 'download_info';
        const stats = document.createElement('div');
        stats.className = 'dfz-download-stats';
        stats.textContent = 'Starting download...';
        downloadInfoRow.appendChild(stats);
        window.progressRows['download_info'] = { element: downloadInfoRow, stats };
        const downloadProgressRow = document.createElement('div');
        downloadProgressRow.className = 'dfz-download-progress-row';
        downloadProgressRow.dataset.id = 'download_progress';
        const container = document.createElement('div');
        container.className = 'dfz-download-progress-container';
        const progressFill = document.createElement('div');
        progressFill.className = 'dfz-download-progress-fill';
        container.appendChild(progressFill);
        const progressSlash = document.createElement('div');
        progressSlash.className = 'dfz-download-progress-slash';
        container.appendChild(progressSlash);
        downloadProgressRow.appendChild(container);
        window.progressRows['download_progress'] = { element: downloadProgressRow, progressFill, progressSlash };
        const downloadZipRow = window.progressRows['download_zip'].element;
        let progressPanelElement = downloadZipRow.parentNode;
        progressPanelElement.appendChild(downloadInfoRow);
        progressPanelElement.appendChild(downloadProgressRow);
        return { stats, progressFill, progressSlash };
    }

    function updateDownloadProgress(statsElement, progressFill, received, total, startTime) {
        const percentage = total > 0 ? Math.round((received / total) * 100) : 0;
        progressFill.style.width = `${percentage}%`;
        progressFill.classList.remove('retrying');
        const elapsed = (Date.now() - startTime) / 1000;
        const speed = elapsed > 0 ? received / elapsed : 0;
        const remainingBytes = total > 0 ? total - received : 0;
        const remainingTime = speed > 0 ? remainingBytes / speed : 0;
        statsElement.textContent = `[${window.dfzFormatBytes(received)}/${total > 0 ? window.dfzFormatBytes(total) : 'Calculating...'}] | speed: ${window.dfzFormatBytes(speed)}/s | remaining: ${total > 0 ? '~' + window.dfzFormatTime(remainingTime) : 'Calculating...'}`;
        const downloadZipTextSpan = window.progressRows['download_zip'].textSpan;
        downloadZipTextSpan.textContent = `> Download ZIP File [${percentage}%]`;
        
        // Remove any existing reload icon when updating progress
        const existingReloadIcon = downloadZipTextSpan.querySelector('.dfz-reload-icon');
        if (existingReloadIcon) {
            existingReloadIcon.remove();
        }
    }

    async function attemptDownload(url, progressDisplay, attempt, maxAttempts) {
        try {
            downloadController = new AbortController();
            downloadStartTime = Date.now();
            downloadedBytes = 0;
            totalBytes = 0;

            // Set state to processing for new attempt
            window.updateProgressRowStatus('download_zip', 'processing');

            const response = await fetch(url, {
                signal: downloadController.signal,
                headers: { 'Range': 'bytes=0-' }
            });

            if (!response.ok) {
                const errorMsg = `HTTP error! status: ${response.status}`;
                lastError = errorMsg;
                throw new Error(errorMsg);
            }

            const contentLength = response.headers.get('content-length');
            totalBytes = contentLength ? parseInt(contentLength) : 0;
            const reader = response.body.getReader();
            const chunks = [];
            let receivedLength = 0;

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                chunks.push(value);
                receivedLength += value.length;
                downloadedBytes = receivedLength;
                updateDownloadProgress(progressDisplay.stats, progressDisplay.progressFill, receivedLength, totalBytes, downloadStartTime);
                await new Promise(resolve => setTimeout(resolve, 10));
            }

            const blob = new Blob(chunks);
            tempBlobUrl = URL.createObjectURL(blob);
            window.dfzTempBlobUrl = tempBlobUrl;
            console.log("📦 js/download.js File downloaded successfully, temporary location: " + tempBlobUrl);
            window.updateProgressRowStatus('download_zip', 'done');
            const slashElement = progressDisplay.progressSlash;
            if (slashElement) {
                slashElement.style.animation = 'none';
            }
            lastError = null;
            return true;
        } catch (error) {
            if (error.name === 'AbortError') {
                console.log("📦 js/download.js Download aborted.");
                lastError = "Download was manually aborted";
                return false;
            }
            console.log(`📦 js/download.js Download attempt ${attempt} failed: ${error.message}`);
            lastError = error.message;
            return false;
        }
    }

    window.dfzDownloadWithRetry = async function(url, maxAttempts = 5, timeoutMs = 20000) {
        if (!url) {
            console.log("📦 js/download.js No URL provided for download.");
            lastError = "No URL provided for download";
            window.updateProgressRowStatus('download_zip', 'failed');
            return;
        }

        let attempt = 1;
        globalAttemptCount++;
        const progressDisplay = createDownloadProgressDisplay();

        while (attempt <= maxAttempts) {
            console.log(`📦 js/download.js Starting download attempt ${attempt}/${maxAttempts}`);
            const attemptStartTime = Date.now();
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Download timeout')), timeoutMs);
            });

            const downloadPromise = attemptDownload(url, progressDisplay, attempt, maxAttempts);

            try {
                const success = await Promise.race([downloadPromise, timeoutPromise]);
                if (success) {
                    return; // Download succeeded
                }
            } catch (error) {
                console.log(`📦 js/download.js Attempt ${attempt} failed: ${error.message}`);
                lastError = error.message;
                if (downloadController) {
                    downloadController.abort();
                }
            }

            if (window.progressRows['download_zip']?.statusSpan.textContent === 'done') {
                return; // Do not retry if download completed successfully
            }

            if (attempt < maxAttempts) {
                // Update to retrying status
                window.updateProgressRowStatus('download_zip', 'retrying', {
                    attempt: globalAttemptCount,
                    maxAttempts: globalAttemptCount + (maxAttempts - attempt),
                    startTime: attemptStartTime,
                    timeoutMs
                });
                // Wait for the remaining time of the 20-second timeout
                const elapsed = Date.now() - attemptStartTime;
                const remainingTime = Math.max(0, timeoutMs - elapsed);
                await new Promise(resolve => setTimeout(resolve, remainingTime));
            } else {
                // No attempts left, mark as failed
                window.updateProgressRowStatus('download_zip', 'failed');
                // Add reload icon to textSpan
                addReloadIcon();
                const progressRow = window.progressRows['download_progress'];
                if (progressRow?.progressSlash) {
                    progressRow.progressSlash.style.animation = 'none';
                }
                console.log(`📦 js/download.js All ${maxAttempts} download attempts failed. Last error: ${lastError || 'Unknown error'}`);
                if (window.progressRows['download_info']?.stats && lastError) {
                    window.progressRows['download_info'].stats.textContent = `Download failed: ${lastError}`;
                }
            }

            attempt++;
        }
    };

    function addReloadIcon() {
        const downloadZipTextSpan = window.progressRows['download_zip']?.textSpan;
        if (!downloadZipTextSpan) return;
        
        // Check if reload icon already exists
        if (downloadZipTextSpan.querySelector('.dfz-reload-icon')) return;
        
        const reloadIcon = document.createElement('img');
        reloadIcon.className = 'dfz-reload-icon';
        reloadIcon.src = chrome.runtime.getURL('icons/reload.png');
        reloadIcon.title = 'Retry download from scratch with a fresh connection';
        
        reloadIcon.addEventListener('click', function() {
            // Prevent multiple clicks
            if (this.classList.contains('rotating')) return;
            
            // Add rotating class
            this.classList.add('rotating');
            
            // Start new download with the original URL
            if (window.dfzExtractedUrl) {
                console.log("📦 js/download.js Restarting download from reload icon click");
                
                // Remove the reload icon from DOM to prevent further clicks
                this.remove();
                
                // Start new download
                window.dfzStartDownload(window.dfzExtractedUrl);
            } else {
                console.log("📦 js/download.js Cannot restart download: URL not available");
                this.classList.remove('rotating');
            }
        });
        
        downloadZipTextSpan.appendChild(reloadIcon);
    }

    window.dfzStartDownload = async function(url) {
        await window.dfzDownloadWithRetry(url);
    };

    window.dfzCancelDownload = function() {
        if (downloadController) {
            downloadController.abort();
            console.log("📦 js/download.js Download cancelled.");
            lastError = "Download was manually cancelled";
            window.updateProgressRowStatus('download_zip', 'failed');
            const progressRow = window.progressRows['download_progress'];
            if (progressRow && progressRow.progressSlash) {
                progressRow.progressSlash.style.animation = 'none';
            }
            if (window.progressRows['download_info']?.stats) {
                window.progressRows['download_info'].stats.textContent = `Download cancelled by user`;
            }
            addReloadIcon();
        }
    };

    window.dfzCleanupTempFile = function() {
        if (tempBlobUrl) {
            URL.revokeObjectURL(tempBlobUrl);
            console.log("📦 js/download.js Temporary file reference revoked: " + tempBlobUrl);
            tempBlobUrl = null;
            window.dfzTempBlobUrl = null;
        }
    };
})();