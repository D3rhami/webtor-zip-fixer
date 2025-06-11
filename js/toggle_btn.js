(function() {
    window.dfzCreateToggleButtonElement = function(originalButton) {
        const toggleButton = document.createElement('button');
        toggleButton.type = 'button';
        toggleButton.className = 'dfz_toggle_btn';
        toggleButton.title = 'Toggle visibility of the original Webtor download button (shows/hides the broken ZIP download option)';
        const toggleIcon = document.createElement('img');
        toggleIcon.className = 'dfz_toggle_icon';
        toggleIcon.src = chrome.runtime.getURL('icons/toggle_btn.png');
        toggleButton.appendChild(toggleIcon);
        toggleButton.addEventListener('click', (e) => {
            e.stopPropagation();
            console.log("📦 Toggle button clicked");
            window.dfzToggleOriginalButtonVisibility(originalButton);
            toggleIcon.classList.toggle('rotated');
        });
        return toggleButton;
    };
})();