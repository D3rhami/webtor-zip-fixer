(function() {
    function createMainFixedZipButtonElement(originalButton) {
        const fileSize = originalButton.textContent.match(/\[(.*?)\]/)?.[1] || '';
        const fixerButton = document.createElement('button');
        fixerButton.type = 'button';
        fixerButton.className = 'dfz_main_btn';
        const mainIcon = document.createElement('img');
        mainIcon.className = 'dfz_main_btn_icon';
        try {
            updateButtonIcon(mainIcon);
        } catch (e) {
            console.log("📦 js/main_btn.js Error setting icon: " + e.message);
            mainIcon.src = '';
        }
        const textSpan = document.createElement('span');
        textSpan.textContent = `Download as Fixed ZIP ${fileSize ? `[${fileSize}]` : ''}`;
        textSpan.className = 'dfz_main_btn_text';
        fixerButton.appendChild(mainIcon);
        fixerButton.appendChild(textSpan);
        fixerButton.addEventListener('click', () => {
            console.log("📦 js/main_btn.js Main Fixed ZIP button clicked.");
            if (typeof window.dfzClearProgressPanel === 'function') {
                window.dfzClearProgressPanel();
            }
            if (typeof window.dfzStartUrlExtractionProcess === 'function') {
                window.dfzStartUrlExtractionProcess(fixerButton.closest('.dfz_button_wrapper'));
            } else {
                console.log("📦 js/main_btn.js dfzStartUrlExtractionProcess function not found!");
            }
            window.dfzActivateDynamicPanelHiding();
            originalButton.click();
        });
        // Add hover event listeners for icon swap
        fixerButton.addEventListener('mouseenter', () => {
            mainIcon.dataset.hover = 'true';
        });
        fixerButton.addEventListener('mouseleave', () => {
            mainIcon.dataset.hover = 'false';
            updateButtonIcon(mainIcon); // Revert to theme-appropriate icon
        });
        return fixerButton;
    }

    function updateButtonIcon(iconElement) {
        const isDarkTheme = document.documentElement.getAttribute('data-theme') === 'night';
        iconElement.src = chrome.runtime.getURL(`icons/btn_icon_${isDarkTheme ? 'dark' : 'light'}.png`);
    }

    function addButtons() {
        const downloadForms = document.querySelectorAll('form.download-dir');
        downloadForms.forEach(form => {
            const originalButton = form.querySelector('button[type="submit"]');
            if (originalButton && !originalButton.previousElementSibling?.classList.contains('dfz_button_wrapper')) {
                console.log("📦 js/main_btn.js Adding button wrapper, main button, and toggle button");
                originalButton.style.display = 'none';
                originalButton.style.marginTop = '0';
                const wrapper = document.createElement('div');
                wrapper.className = 'dfz_button_wrapper';
                wrapper.style.marginBottom = '8px';
                const mainButton = createMainFixedZipButtonElement(originalButton);
                const toggleButton = window.dfzCreateToggleButtonElement(originalButton);
                wrapper.appendChild(mainButton);
                wrapper.appendChild(toggleButton);
                originalButton.parentElement.insertBefore(wrapper, originalButton);
            }
        });
    }

    function observeThemeChanges() {
        const observer = new MutationObserver(() => {
            try {
                document.querySelectorAll('.dfz_main_btn_icon').forEach(updateButtonIcon);
            } catch (e) {
                console.log("📦 js/main_btn.js Error updating theme icons: " + e.message);
            }
        });
        observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['data-theme']
        });
    }

    function observeContentChanges() {
        const observer = new MutationObserver((mutations) => {
            let needsUpdate = false;
            let removedWrappers = new Set();
            for (let mutation of mutations) {
                if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach(node => {
                        if (node.nodeType === 1) {
                            if (node.matches('form.download-dir') || node.querySelector('form.download-dir')) {
                                needsUpdate = true;
                            }
                        }
                    });
                    mutation.removedNodes.forEach(node => {
                        if (node.nodeType === 1 && node.matches('form.download-dir button[type="submit"]')) {
                            const wrapper = node.previousElementSibling;
                            if (wrapper?.classList.contains('dfz_button_wrapper')) {
                                if (!removedWrappers.has(wrapper)) {
                                    console.log("📦 js/main_btn.js Removing wrapper due to original button removal.");
                                    wrapper.remove();
                                    const progressPanel = wrapper.nextElementSibling;
                                    if (progressPanel?.classList.contains('dfz-progress-panel')) {
                                        progressPanel.remove();
                                    }
                                    removedWrappers.add(wrapper);
                                }
                            }
                        }
                        if (node.nodeType === 1 && node.classList?.contains('dfz_button_wrapper')) {
                            const progressPanel = node.nextElementSibling;
                            if (progressPanel?.classList.contains('dfz-progress-panel')) {
                                progressPanel.remove();
                            }
                        }
                    });
                }
            }
            if (needsUpdate) {
                try {
                    addButtons();
                } catch (e) {
                    console.log("📦 js/main_btn.js Error adding buttons on content change: " + e.message);
                    setTimeout(addButtons, 1000);
                }
            }
        });
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    function init() {
        try {
            addButtons();
            observeThemeChanges();
            observeContentChanges();
        } catch (e) {
            console.log("📦 js/main_btn.js Error during initialization: " + e.message);
            setTimeout(init, 1000);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            console.log("📦 js/main_btn.js DOM fully loaded, initializing.");
            init();
        });
    } else {
        console.log("📦 js/main_btn.js DOM already loaded, initializing with delay.");
        setTimeout(init, 500);
    }
})();