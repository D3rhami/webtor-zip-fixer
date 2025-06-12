(function() {
    let fixedBlob = null;
    let originalFileName = '';

    const elements = {
        uploadSection: document.getElementById('uploadSection'),
        progressSection: document.getElementById('progressSection'),
        buildingSection: document.getElementById('buildingSection'),
        resultSection: document.getElementById('resultSection'),
        uploadBtn: document.getElementById('uploadBtn'),
        fileInput: document.getElementById('fileInput'),
        uploadArea: document.getElementById('uploadArea'),
        progressFill: document.getElementById('progressFill'),
        progressText: document.getElementById('progressText'),
        progressPercent: document.getElementById('progressPercent'),
        progressStats: document.getElementById('progressStats'),
        resultSuccess: document.getElementById('resultSuccess'),
        resultError: document.getElementById('resultError'),
        downloadBtn: document.getElementById('downloadBtn'),
        retryBtn: document.getElementById('retryBtn'),
        errorMessage: document.getElementById('errorMessage')
    };

    function formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    function showSection(section) {
        elements.uploadSection.style.display = 'none';
        elements.progressSection.style.display = 'none';
        elements.buildingSection.style.display = 'none';
        elements.resultSection.style.display = 'none';
        elements.resultSuccess.style.display = 'none';
        elements.resultError.style.display = 'none';
        
        if (section === 'upload') {
            elements.uploadSection.style.display = 'block';
        } else if (section === 'progress') {
            elements.progressSection.style.display = 'block';
        } else if (section === 'building') {
            elements.buildingSection.style.display = 'block';
        } else if (section === 'success') {
            elements.resultSection.style.display = 'block';
            elements.resultSuccess.style.display = 'block';
        } else if (section === 'error') {
            elements.resultSection.style.display = 'block';
            elements.resultError.style.display = 'block';
        }
    }

    function updateProgress(progress, text, stats) {
        const percentage = Math.round(progress * 100);
        elements.progressFill.style.width = `${percentage}%`;
        elements.progressPercent.textContent = `${percentage}%`;
        if (text) elements.progressText.textContent = text;
        if (stats) elements.progressStats.textContent = stats;
        
        // Show building section when progress reaches 100%
        if (percentage >= 100) {
            setTimeout(() => {
                showSection('building');
            }, 500);
        }
    }

    async function fixZipFile(file) {
        try {
            showSection('progress');
            updateProgress(0, 'Reading ZIP file...', `Processing: 0 MB / ${formatBytes(file.size)}`);

            const arrayBuffer = await file.arrayBuffer();
            const zipData = new Uint8Array(arrayBuffer);
            
            updateProgress(0.2, 'Analyzing ZIP structure...', `Processing: ${formatBytes(file.size * 0.2)} / ${formatBytes(file.size)}`);

            const fixedBlob = await processZip(zipData, (progress) => {
                updateProgress(0.2 + (progress * 0.8), 'Fixing ZIP file...', 
                    `Processing: ${formatBytes(file.size * (0.2 + progress * 0.8))} / ${formatBytes(file.size)}`);
            });

            updateProgress(1, 'ZIP file fixed successfully!', `Completed: ${formatBytes(file.size)} / ${formatBytes(file.size)}`);

            window.fixedBlob = fixedBlob;
            window.originalFileName = file.name;

            // The building section is now shown by updateProgress when it reaches 100%
            // Now we wait a bit to simulate the building process before showing the success screen
            setTimeout(() => {
                showSection('success');
            }, 2000);

        } catch (error) {
            console.error('Error fixing ZIP file:', error);
            elements.errorMessage.textContent = error.message || 'Failed to process the ZIP file';
            showSection('error');
        }
    }

    async function processZip(zipData, progressCallback) {
        const zip = new JSZip();
        let processedBytes = 0;
        const totalBytes = zipData.length;

        try {
            const loadedZip = await zip.loadAsync(zipData, {
                checkCRC32: false
            });

            const files = Object.keys(loadedZip.files);
            const totalFiles = files.length;
            let processedFiles = 0;

            const newZip = new JSZip();

            for (const fileName of files) {
                const file = loadedZip.files[fileName];
                
                if (file.dir) {
                    newZip.folder(fileName);
                } else {
                    try {
                        const content = await file.async('uint8array');
                        newZip.file(fileName, content);
                    } catch (e) {
                        console.warn(`Skipping corrupted file: ${fileName}`);
                    }
                }

                processedFiles++;
                const progress = processedFiles / totalFiles;
                if (progressCallback) {
                    progressCallback(progress);
                }
            }

            const fixedZipBlob = await newZip.generateAsync({
                type: 'blob',
                compression: 'DEFLATE',
                compressionOptions: { level: 6 }
            });

            return fixedZipBlob;

        } catch (error) {
            throw new Error('Invalid or corrupted ZIP file');
        }
    }

    function downloadFixedFile() {
        if (!window.fixedBlob || !window.originalFileName) return;

        const url = URL.createObjectURL(window.fixedBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `fixed_${window.originalFileName}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    function handleFileSelect(file) {
        if (!file) return;

        if (!file.name.toLowerCase().endsWith('.zip')) {
            elements.errorMessage.textContent = 'Please select a ZIP file';
            showSection('error');
            return;
        }

        originalFileName = file.name;
        fixZipFile(file);
    }

    elements.uploadBtn.addEventListener('click', () => {
        elements.fileInput.click();
    });

    elements.fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            handleFileSelect(file);
        }
    });

    elements.uploadArea.addEventListener('click', () => {
        elements.fileInput.click();
    });

    elements.uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        elements.uploadArea.classList.add('drag-over');
    });

    elements.uploadArea.addEventListener('dragleave', () => {
        elements.uploadArea.classList.remove('drag-over');
    });

    elements.uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        elements.uploadArea.classList.remove('drag-over');
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleFileSelect(files[0]);
        }
    });

    elements.downloadBtn.addEventListener('click', downloadFixedFile);

    elements.retryBtn.addEventListener('click', () => {
        elements.fileInput.value = '';
        showSection('upload');
    });

    showSection('upload');
})(); 