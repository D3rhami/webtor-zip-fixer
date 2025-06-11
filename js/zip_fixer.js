(function() {
    function createFixingProgressDisplay() {
        const fixingInfoRow = document.createElement('div');
        fixingInfoRow.className = 'dfz-fixing-info-row';
        fixingInfoRow.dataset.id = 'fixing_info';
        const stats = document.createElement('div');
        stats.className = 'dfz-fixing-stats';
        stats.textContent = '[0 Bytes/Unknown] | speed: 0 Bytes/s | remaining: Calculating...';
        fixingInfoRow.appendChild(stats);
        window.progressRows['fixing_info'] = { element: fixingInfoRow, stats };
        const fixingProgressRow = document.createElement('div');
        fixingProgressRow.className = 'dfz-fixing-progress-row';
        fixingProgressRow.dataset.id = 'fixing_progress';
        const container = document.createElement('div');
        container.className = 'dfz-fixing-progress-container';
        const progressFill = document.createElement('div');
        progressFill.className = 'dfz-fixing-progress-fill';
        container.appendChild(progressFill);
        const progressSlash = document.createElement('div');
        progressSlash.className = 'dfz-fixing-progress-slash';
        container.appendChild(progressSlash);
        fixingProgressRow.appendChild(container);
        window.progressRows['fixing_progress'] = { element: fixingProgressRow, progressFill, progressSlash };
        const fixingZipRow = window.progressRows['fix_zip'].element;
        progressPanelElement = fixingZipRow.parentNode;
        progressPanelElement.appendChild(fixingInfoRow);
        progressPanelElement.appendChild(fixingProgressRow);
        return { stats, progressFill, progressSlash };
    }

    function updateFixingProgress(statsElement, progressFill, progress, totalSize, startTime) {
        const percentage = Math.round(progress * 100);
        progressFill.style.width = `${percentage}%`;
        const elapsed = (Date.now() - startTime) / 1000;
        const processedBytes = Math.round(totalSize * progress);
        const speed = processedBytes / elapsed;
        const remainingBytes = totalSize - processedBytes;
        const remainingTime = speed > 0 ? remainingBytes / speed : 0;
        statsElement.textContent = `[${window.dfzFormatBytes(processedBytes)}/${window.dfzFormatBytes(totalSize)}] | speed: ${window.dfzFormatBytes(speed)}/s | remaining: ~${window.dfzFormatTime(remainingTime)}`;
        const fixingZipTextSpan = window.progressRows['fix_zip'].textSpan;
        fixingZipTextSpan.textContent = `> Fixing ZIP File [${percentage}%]`;
    }

    window.dfzStartFixingZip = async function(blobUrl) {
        if (!blobUrl) {
            window.updateProgressRowStatus('fix_zip', 'failed');
            return;
        }
        try {
            const fixingStartTime = Date.now();
            const progressDisplay = createFixingProgressDisplay();
            const response = await fetch(blobUrl);
            const blob = await response.blob();
            const totalSize = blob.size;
            const progressCallback = (progress) => {
                updateFixingProgress(progressDisplay.stats, progressDisplay.progressFill, progress, totalSize, fixingStartTime);
            };
            const fixedBlob = await fixZip(blob, progressCallback);
            const fixedUrl = URL.createObjectURL(fixedBlob);
            window.dfzFixedBlobUrl = fixedUrl;
            window.updateProgressRowStatus('fix_zip', 'done');
            const slashElement = progressDisplay.progressSlash;
            if (slashElement) {
                slashElement.style.animation = 'none';
            }
        } catch (error) {
            window.updateProgressRowStatus('fix_zip', 'failed');
            const progressRow = window.progressRows['fixing_progress'];
            if (progressRow && progressRow.progressSlash) {
                progressRow.progressSlash.style.animation = 'none';
            }
        }
    };

    async function fixZip(blob, progressCallback) {
        if (typeof JSZip === 'undefined') {
            throw new Error("JSZip library not found.");
        }
        const zipData = new Uint8Array(await blob.arrayBuffer());
        const fixedBlob = await processZip(zipData, progressCallback);
        return fixedBlob;
    }

    async function processZip(zipData, progressCallback) {
        const zip = new JSZip();
        await zip.loadAsync(zipData);
        const fixedZip = new JSZip();
        const files = zip.file(/.*/);
        const totalFiles = files.length;
        let processedFiles = 0;
        for (const file of files) {
            const content = await file.async('uint8array');
            fixedZip.file(file.name, content, { binary: true });
            processedFiles++;
            if (progressCallback) {
                progressCallback(processedFiles / totalFiles);
            }
        }
        return await fixedZip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
    }

    window.dfzCleanupFixedFile = function() {
        if (window.dfzFixedBlobUrl) {
            URL.revokeObjectURL(window.dfzFixedBlobUrl);
            window.dfzFixedBlobUrl = null;
        }
        if (window.dfzTempBlobUrl) {
            URL.revokeObjectURL(window.dfzTempBlobUrl);
            window.dfzTempBlobUrl = null;
        }
    };
})();