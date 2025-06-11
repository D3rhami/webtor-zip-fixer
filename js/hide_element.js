(function() {
    const observerState = {
        current: null,
        timeoutId: null
    };

    window.dfzToggleOriginalButtonVisibility = function(originalButton) {
        if (!originalButton) return;
        const isHidden = originalButton.style.display === 'none';
        originalButton.style.display = isHidden ? 'inline-flex' : 'none';
        originalButton.style.marginTop = isHidden ? '8px' : '0';
        console.log(`📦 js/hide_element.js Original button visibility toggled to: ${isHidden ? 'visible' : 'hidden'}`);
        const wrapper = originalButton.previousElementSibling;
        if (wrapper && wrapper.classList.contains('dfz_button_wrapper')) {
            wrapper.style.marginBottom = isHidden ? '8px' : '0';
        }
    };

    function createHidePanelCallback(state) {
        return (mutations) => {
            mutations.forEach(mutation => {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === 1 && node.matches('form.progress-alert')) {
                        console.log("📦 js/hide_element.js Found generated progress panel, hiding.");
                        node.style.display = 'none';
                        if (state.current) {
                            state.current.disconnect();
                            state.current = null;
                            console.log("📦 js/hide_element.js Disconnected hide observer after hiding.");
                        }
                        if (state.timeoutId) {
                            clearTimeout(state.timeoutId);
                            state.timeoutId = null;
                            console.log("📦 js/hide_element.js Cleared hide observer timeout after hiding.");
                        }
                    }
                });
            });
        };
    }

    window.dfzActivateDynamicPanelHiding = function() {
        console.log("📦 js/hide_element.js Activating observer for dynamic panel hiding.");
        if (observerState.current) {
            observerState.current.disconnect();
            console.log("📦 js/hide_element.js Disconnected previous hide observer.");
        }
        if (observerState.timeoutId) {
            clearTimeout(observerState.timeoutId);
            console.log("📦 js/hide_element.js Cleared previous hide observer timeout.");
        }
        observerState.current = new MutationObserver(createHidePanelCallback(observerState));
        observerState.current.observe(document.body, { childList: true, subtree: true });
        observerState.timeoutId = setTimeout(() => {
            if (observerState.current) {
                observerState.current.disconnect();
                observerState.current = null;
                console.log("📦 js/hide_element.js Hide observer timeout reached, disconnected.");
            }
        }, 5000);
    };
})();