let deferredPrompt;

function initPWA() {
    const installButton = document.getElementById('pwa-install-button');
    
    if (!installButton) return;
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        installButton.style.display = 'inline-flex';
    });

    // Handle install button click
    installButton.addEventListener('click', async () => {
        if (!deferredPrompt) return;
        
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        
        if (outcome === 'accepted') {
            setInstallButtonToInstalled();
        }
        
        deferredPrompt = null;
    });

    // Listen for the appinstalled event
    window.addEventListener('appinstalled', () => {
        setInstallButtonToInstalled();
    });

    // Check if app is already installed
    if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) {
        setInstallButtonToInstalled();
    }
}

function setInstallButtonToInstalled() {
    const installButton = document.getElementById('pwa-install-button');
    if (!installButton) return;
    
    const installIcon = installButton.querySelector('.install-icon');
    const installedIcon = installButton.querySelector('.installed-icon');
    const installText = installButton.querySelector('.install-text');
    
    if (installIcon) installIcon.style.display = 'none';
    if (installedIcon) installedIcon.style.display = 'block';
    if (installText) installText.textContent = 'Installed';
    
    installButton.disabled = true;
    installButton.style.opacity = '0.6';
}

async function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        try {
            const registration = await navigator.serviceWorker.register('./service-worker.js', {
                scope: './public/'
            });
        } catch (error) {
        }
    }
}

function initializePWAFeatures() {
    initPWA();
    registerServiceWorker();
}

setTimeout(initializePWAFeatures, 1000);
window.paperimaPWA = {
    init: initializePWAFeatures,
    registerServiceWorker,
    setInstallButtonToInstalled
};