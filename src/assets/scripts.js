        document.addEventListener('DOMContentLoaded', function() {
            // Main canvas and context
            const canvas = document.getElementById('main-canvas');
            const ctx = canvas.getContext('2d');
            const canvasContainer = document.getElementById('canvas-container');
            const panelWrapper = document.getElementById('settings-panel-wrapper');
            const panelHandle = document.getElementById('panel-handle');
            const body = document.body;
            const mobilePanelHeader = document.getElementById('mobile-panel-header');
            
            // Notification elements
            const topNotificationPopup = document.getElementById('top-notification-popup');
            const topNotificationMessage = document.getElementById('top-notification-message');
            const topNotificationCloseBtn = topNotificationPopup.querySelector('.close-btn');
            let notificationTimeout;

            // Confirmation dialog elements
            const confirmationPopup = document.getElementById('confirmation-popup');
            const confirmationTitle = document.getElementById('confirmation-title');
            const confirmationMessage = document.getElementById('confirmation-message');
            const confirmCancelBtn = document.getElementById('confirm-cancel-btn');
            const confirmContinueBtn = document.getElementById('confirm-continue-btn');
            const resetImagesOption = document.getElementById('reset-images-option');
            const deleteImagesCheckbox = document.getElementById('confirm-delete-images-checkbox');

            // SVG Filter elements
            const tornDilate = document.getElementById('torn-dilate');
            const tornTurbulence = document.getElementById('torn-turbulence');
            const tornDisplacement = document.getElementById('torn-displacement');
            const tornFlood = document.getElementById('torn-flood');

            const overlayImageUrls = [
                './assets/texture/paper_overlay_0.webp',
                './assets/texture/paper_overlay_1.webp',
                './assets/texture/paper_overlay_2.webp',
                './assets/texture/paper_overlay_3.webp'
            ];
            const MASK_IMAGE_URLS = [
                './assets/texture/paper_mask_0.webp',
                './assets/texture/paper_mask_1.webp',
                './assets/texture/paper_mask_2.webp',
                './assets/texture/paper_mask_3.webp',
                './assets/texture/paper_mask_4.webp',
                './assets/texture/paper_mask_5.webp'
            ];
            const LAYER_IMAGE_URLS = [
                './assets/texture/paper_fold_0.webp',
                './assets/texture/paper_fold_1.webp',
                './assets/texture/paper_fold_2.webp',
                './assets/texture/paper_fold_3.webp',
                './assets/texture/paper_fold_4.webp',
                './assets/texture/paper_fold_5.webp'
            ];

            let maskImages = [];
            let layerImages = [];
            let originalOverlayImages = []; 
            
            // Offscreen canvases for processing
            const objectCanvas = document.createElement('canvas');
            const objectCtx = objectCanvas.getContext('2d');
            
            const finalObjectCanvas = document.createElement('canvas');
            const finalObjectCtx = finalObjectCanvas.getContext('2d');

            const contentCanvas = document.createElement('canvas');
            const contentCtx = contentCanvas.getContext('2d');

            const tempOverlayCanvas = document.createElement('canvas'); 

            let originalDebugContent = null;

            let tornEdgeCache = [];
            let isCacheGenerationNeeded = true;
            let isLiveTornEdgePreview = false;
            let originalOverlaySpeed = 0;
            let isAdjustingTornEdge = false;
            let isGeneratingCache = false;

            const debugScreenEl = document.getElementById('debug-screen');
            let lastDebugUpdateTime = 0;
            let fps = 0;
            let frameCount = 0;
            let lastFPSTime = 0;           

            let animationFrameId = null;
            let needsRedraw = true;
            let isExporting = false;
            let isScrubbing = false;
            let pauseStartTime = 0;
            let animationStartTime = 0;
            // Timing reference object for export module to update
            const timingRef = { get pauseStartTime() { return pauseStartTime; }, set pauseStartTime(v) { pauseStartTime = v; }, get animationStartTime() { return animationStartTime; }, set animationStartTime(v) { animationStartTime = v; } };
            // Default state for a single object
            const DEFAULT_OBJECT_STATE = {
                image: { element: null, originalElement: null, size: 80, offset: { x: 0, y: 0 }, rotation: 0, file: null, isSVG: false, originalSVGSrc: null },
                stroke: { enabled: true, width: 25, roughness: 25, detail: 0.020, seed: 0 },
                shadow: { enabled: true, offsetX: 5, offsetY: -5, blur: 5, color: '#000000', opacity: 50 },
                color: { enabled: false, hue: 0, saturation: 0, brightness: 0, colorize: false },
                movement: { 
                    enabled: true, 
                    mode: 'simpel',
                    simpelSpeed: 1,
                    simpelStrength: 1,
                    rotationSpeed: 4, 
                    rotationStrength: 0.5, 
                    positionSpeed: { x: 2, y: 4 },
                    positionStrength: { x: 1, y: 5 },
                    lastRotationUpdateTime: 0, 
                    lastPositionUpdateTime: { x: 0, y: 0 },
                    rotation: 0,
                    positionOffset: { x: 0, y: 0 }
                },
                paperFoldOverlay: {
                    enabled: true,
                    currentImageIndex: 0,
                    opacity: 75,
                    speed: 4,
                    blendMode: 'multiply',
                    lastImageSwitchTime: 0
                },
                animation: {
                    mode: 'simple',
                    simple: {
                        open: false,
                        close: false
                    },                    
                    isPlaying: true,
                    activeKeyframeId: null,
                    previewTime: null,
                    keyframes: [
                        // Start with two default keyframes for example
                        {
                            id: Date.now(),
                            time: 0,
                            x: 0,
                            y: 0,
                            scale: 50,
                            rotation: 0,
                            easing: 'linear',
                            paperAnim: 'none'
                        },
                        {
                            id: Date.now() + 1,
                            time: 1,
                            x: 0,
                            y: 0,
                            scale: 80,
                            rotation: 0,
                            easing: 'linear',
                            paperAnim: 'none'
                        }
                    ]
                }             
            };

            // Default state for the entire application
            const DEFAULT_STATE = {
                activeTab: 'object',
                language: 'en',
                displayMode: 'auto', 
                uiSize: 'normal',
                previewResolution: '540',
                accentColor: '#3b82f6',
                debugScreenEnabled: false,                
                background: {
                    element: null, color: '#00ff00', file: null,
                    transform: { enabled: true, mode: 'fill', size: 100, rotation: 0, offset: { x: 0, y: 0 } },
                    effects: {
                        colorCorrection: { enabled: false, hue: 0, saturation: 0, brightness: 0, colorize: false },
                        blur: { enabled: false, intensity: 10 },
                        vignette: { enabled: false, opacity: 100, radius: 50, feather: 100, color: '#000000' }
                    }
                },
                aspectRatio: '16/9',
                canvasDisplayResolution: 720,
                export: {
                    duration: 5, fps: 24, filename: 'paperima', format: 'webm', jpgQuality: 95, transparentBackground: true
                },
                object: JSON.parse(JSON.stringify(DEFAULT_OBJECT_STATE))
            };

            let state = JSON.parse(JSON.stringify(DEFAULT_STATE));
            let keyframeClipboard = null;
            
            const RESOLUTION_MAPS = {
                '360': { '16/9': { w: 640, h: 360 }, '9/16': { w: 360, h: 640 }, '4/3': { w: 480, h: 360 }, '3/4': { w: 360, h: 480 }, '1/1': { w: 360, h: 360 } },
                '540': { '16/9': { w: 960, h: 540 }, '9/16': { w: 540, h: 960 }, '4/3': { w: 720, h: 540 }, '3/4': { w: 540, h: 720 }, '1/1': { w: 540, h: 540 } },
                '720': { '16/9': { w: 1280, h: 720 }, '9/16': { w: 720, h: 1280 }, '4/3': { w: 960, h: 720 }, '3/4': { w: 720, h: 960 }, '1/1': { w: 720, h: 720 } },
                '1080': { '16/9': { w: 1920, h: 1080 }, '9/16': { w: 1080, h: 1920 }, '4/3': { w: 1440, h: 1080 }, '3/4': { w: 1080, h: 1440 }, '1/1': { w: 1080, h: 1080 } },
                '1440': { '16/9': { w: 2560, h: 1440 }, '9/16': { w: 1440, h: 2560 }, '4/3': { w: 1920, h: 1440 }, '3/4': { w: 1440, h: 1920 }, '1/1': { w: 1440, h: 1440 } }
            };

            const EASING = {
                linear: t => t,
                easeIn: t => t * t,
                easeOut: t => t * (2 - t),
                easeInOut: t => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
                backIn: t => {
                    const s = 1.70158;
                    return t * t * ((s + 1) * t - s);
                },
                backOut: t => {
                    const s = 1.70158;
                    return (t = t - 1) * t * ((s + 1) * t + s) + 1;
                },
                backInOut: t => {
                    const s = 1.70158 * 1.525;
                    if ((t /= 0.5) < 1) return 0.5 * (t * t * (((s) + 1) * t - s));
                    return 0.5 * ((t -= 2) * t * (((s) + 1) * t + s) + 2);
                }
            };

            // Language translations
            const translations = {
                'en': {
                    settings: 'Settings', export: 'Export', canvas: 'Canvas', previewAspectRatio: 'Aspect Ratio',
                    canvasResolution: 'Resolution', solidBackgroundColor: 'Solid Background Color', backgroundImage: 'Background Image',
                    dropImagePrompt: '<span class="desktop-only">Drop Image Here<br>- or -<br></span>Click to Import Image', backgroundTransform: 'Background Transform',
                    resetBackgroundTransformTitle: 'Reset Background Transform', backgroundMode: 'Background Mode', fill: 'Fill',
                    stretch: 'Stretch', backgroundSize: 'Background Size (%)', offsetX: 'Offset X (%)', offsetY: 'Offset Y (%)',
                    backgroundColorCorrection: 'Background Color Correction', resetBackgroundColorCorrectionTitle: 'Reset Background Color Correction',
                    hue: 'Hue', saturation: 'Saturation', brightness: 'Brightness', colorize: 'Monochrome', backgroundBlur: 'Background Blur',
                    resetBackgroundBlurTitle: 'Reset Background Blur', intensity: 'Intensity', backgroundVignette: 'Background Vignette',
                    resetBackgroundVignetteTitle: 'Reset Background Vignette', opacity: 'Opacity', radius: 'Radius', feather: 'Feather',
                    vignetteColor: 'Vignette Color', objectImage: 'Object Image', transform: 'Transform', resetTransformTitle: 'Reset Transform',
                    imageSize: 'Image Size (%)', tornEdges: 'Torn Edges', resetTornEdgesTitle: 'Reset Torn Edges', thickness: 'Thickness',
                    roughness: 'Roughness', detail: 'Detail', paperTexture: 'Paper Texture',
                    resetPaperTextureTitle: 'Reset Paper Texture', speedFps: 'Speed', dropShadow: 'Drop Shadow',
                    resetDropShadowTitle: 'Reset Drop Shadow', offset: 'Offset', blur: 'Blur', color: 'Color', movement: 'Movement',
                    resetMovementTitle: 'Reset Movement', controlMode: 'Control Mode', simple: 'Simple', advanced: 'Advanced', speed: 'Speed',
                    strength: 'Strength', rotationSpeed: 'Rotation Speed', rotationStrength: 'Rotation Strength',
                    positionSpeedX: 'Position Speed X', positionSpeedY: 'Position Speed Y', positionStrengthX: 'Position Strength X',
                    positionStrengthY: 'Position Strength Y', colorCorrection: 'Color Correction', resetColorCorrectionTitle: 'Reset Color Correction',
                    language: 'Language', displayMode: 'Display Mode', auto: 'Auto', mobile: 'Mobile (Force)', desktop: 'Desktop (Force)',
                    uiSize: 'UI Size', compact: 'Compact', normal: 'Normal', spacious: 'Spacious', appInfo: 'App Information',
                    resetAll: 'Reset All', exportSettings: 'Export Settings', exportFormat: 'Export Format', 
                    videoWebm: 'Video (.webm)', imagePng: 'Image (.png)', imageJpg: 'Image (.jpg)',
                    fps: 'FPS', duration: 'Duration (seconds)', transparentBackground: 'Transparent Background',
                    imageQuality: 'Image Quality', fileName: 'File Name', cancel: 'Cancel', startExport: 'Start Export', 
                    exportingVideo: 'Exporting Video...', exportingImage: 'Exporting Image...',
                    exportingVideoWait: 'Please wait and do not close this window.', confirmResetTitle: 'Confirm Reset',
                    confirmResetMessage: 'Are you sure you want to reset all settings to their default values?',
                    deleteImportedImages: 'Delete imported images', continue: 'Continue', notificationWarnUpload: 'Please upload an image first!',
                    notificationWarnObject: 'Please upload an object image first!',
                    tabTitleBackground: 'Background Settings', tabTitleObject: 'Object Settings', tabTitleAnimasi: 'Animation Settings', tabTitleInfo: 'Preferences',
                    activeObject: 'Active Object', animationObject: 'Object Animation', easing: 'Easing', linear: 'Linear', easeIn: 'Ease In',
                    easeOut: 'Ease Out', backIn: 'Back In', backOut: 'Back Out', instant: 'Instant', easeInOut: 'Ease In Out', backInOut: 'Back In Out',
                    keyframeProperties: 'Keyframe Properties', rotation: 'Rotation', easingToNext: 'Easing to Next', keyframeAnim: 'Paper Animation', animNone: 'None', animOpen: 'Open', animClose: 'Close',
                    addKeyframe: 'Add Keyframe', keyframePropertiesTitle: 'Keyframe Properties #',
                    simple: 'Simple', advanced: 'Advanced', openAnim: 'Paper Unfolding Animation', closeAnim: 'Paper Folding Animation', timeline: 'Timeline',
                    Info: 'Guides', sourceCode: 'Source Code', license: 'License', supportCreator: 'Support Creator', installApp: 'Install App', appInstalled: 'Installed',
                    licenseTitle: 'GNU Affero General Public License v3.0', 
                    licenseContent: `
<div class="text-sm text-slate-300 space-y-4">
    <div>
        <h4 class="font-semibold text-slate-200 mb-2">You May:</h4>
        <p class="text-slate-400">You may use, modify, and distribute this software for both personal and commercial purposes.</p>
    </div>
    <div>
        <h4 class="font-semibold text-slate-200 mb-2">You Must:</h4>
        <p class="text-slate-400">You must include a copy of the license and copyright notices, and state any changes you have made. Any distribution must remain under the AGPLv3 license. If you provide the program as a network service, you are required to provide its source code to users.</p>
    </div>
    <div>
        <h4 class="font-semibold text-slate-200 mb-2">You May Not:</h4>
        <p class="text-slate-400">You may not add sublicenses or additional restrictions. You also cannot hold the original author liable for any issues arising from the use of this software.</p>
    </div>
    <div>
        <h4 class="font-semibold text-slate-200 mb-2">User Content:</h4>
        <p class="text-slate-400">This license does not apply to content you generate using the software, such as images or videos. The full rights to such content belong to you. Therefore, any risks or liabilities arising from the content you create are your sole responsibility as the user.</p>
    </div>
</div>
                    `,
                    licenseViewFull: 'View Full License',
                    resetPreferences: 'Reset Preferences', preparingExportCanvas: 'Preparing export canvas...',
                    confirmResetPrefsTitle: 'Confirm Preferences Reset', completing: 'Completing',
                    accentColor: 'Accent Color', previewResolution: 'Preview Resolution', debugScreen: 'Debug Screen',
                    appDescription: 'Paperima is a web-based application that allows users to add paper effects to images. Users can access and use this application offline because all processing is done directly on their device, ensuring user data remains secure.',
                    appDescription2: 'This application was created by Nurhidayat (a.k.a. nurimator). Paperima is completely free and open source. Donations are very helpful to keep the app available for everyone.',
                    displayModeWarning: 'Warning: Forcing a display mode may break layout or functionality if it doesn\'t match your screen size.',
                    previewResolutionWarning: 'Preview resolution does not affect the final export resolution.',
                    dropShadowTooltip: 'We recommend turning off drop shadow when exporting for a greenscreen. <a href="#" target="_blank" class="text-blue-400 hover:underline">Learn more</a>',
                    exportFormatInfoTooltip: 'For now, video export only supports WebM format.',
                    confirmResetPrefsMessage: 'Are you sure you want to reset language, display mode, and UI size to their defaults?',
                    infoLink: 'https://dayverse.id/en/docs/?q=paperima',
                    supportLink: 'https://dayverse.id/en/donate/'
                },
                'id': {
                    settings: 'Pengaturan', export: 'Ekspor', canvas: 'Kanvas', previewAspectRatio: 'Aspek Rasio',
                    canvasResolution: 'Resolusi', solidBackgroundColor: 'Warna Latar Belakang Solid', backgroundImage: 'Gambar Latar Belakang',
                    dropImagePrompt: '<span class="desktop-only">Jatuhkan Gambar Disini<br>- atau -<br></span>Tekan untuk Impor Gambar', backgroundTransform: 'Transformasi Latar',
                    resetBackgroundTransformTitle: 'Reset Transformasi Latar', backgroundMode: 'Mode Latar', fill: 'Isi',
                    stretch: 'Regangkan', backgroundSize: 'Ukuran Latar (%)', offsetX: 'Offset X (%)', offsetY: 'Offset Y (%)',
                    backgroundColorCorrection: 'Koreksi Warna Latar', resetBackgroundColorCorrectionTitle: 'Reset Koreksi Warna Latar',
                    hue: 'Hue', saturation: 'Saturasi', brightness: 'Kecerahan', colorize: 'Monokrom', backgroundBlur: 'Blur Latar',
                    resetBackgroundBlurTitle: 'Reset Blur Latar', intensity: 'Intensitas', backgroundVignette: 'Vinyet Latar',
                    resetBackgroundVignetteTitle: 'Reset Vinyet Latar', opacity: 'Opasitas', radius: 'Radius', feather: 'Feather',
                    vignetteColor: 'Warna Vinyet', objectImage: 'Gambar Objek', transform: 'Transformasi', resetTransformTitle: 'Reset Transformasi',
                    imageSize: 'Ukuran Gambar (%)', tornEdges: 'Pinggiran Sobek', resetTornEdgesTitle: 'Reset Pinggiran Sobek', thickness: 'Ketebalan',
                    roughness: 'Kekasaran', detail: 'Detail', paperTexture: 'Tekstur Kertas',
                    resetPaperTextureTitle: 'Reset Tekstur Kertas', speedFps: 'Kecepatan', dropShadow: 'Bayangan',
                    resetDropShadowTitle: 'Reset Bayangan', offset: 'Offset', blur: 'Blur', color: 'Warna', movement: 'Gerakan',
                    resetMovementTitle: 'Reset Gerakan', controlMode: 'Mode Kontrol', simple: 'Simpel', advanced: 'Lengkap', speed: 'Kecepatan',
                    strength: 'Kekuatan', rotationSpeed: 'Kecepatan Rotasi', rotationStrength: 'Kekuatan Rotasi',
                    positionSpeedX: 'Kecepatan Posisi X', positionSpeedY: 'Kecepatan Posisi Y', positionStrengthX: 'Kekuatan Posisi X',
                    positionStrengthY: 'Kekuatan Posisi Y', colorCorrection: 'Koreksi Warna', resetColorCorrectionTitle: 'Reset Koreksi Warna',
                    language: 'Bahasa', displayMode: 'Mode Tampilan', auto: 'Otomatis', mobile: 'Seluler (Paksa)', desktop: 'Desktop (Paksa)',
                    uiSize: 'Ukuran UI', compact: 'Sempit', normal: 'Normal', spacious: 'Lebar', appInfo: 'Informasi Aplikasi',
                    resetAll: 'Reset Semua', exportSettings: 'Pengaturan Ekspor', exportFormat: 'Format Ekspor', 
                    videoWebm: 'Video (.webm)', imagePng: 'Gambar (.png)', imageJpg: 'Gambar (.jpg)',
                    fps: 'FPS', duration: 'Durasi (detik)', transparentBackground: 'Latar Belakang Transparan',
                    imageQuality: 'Kualitas Gambar', fileName: 'Nama File', cancel: 'Batal', startExport: 'Mulai Ekspor', 
                    exportingVideo: 'Mengekspor Video...', exportingImage: 'Mengekspor Gambar...',
                    exportingVideoWait: 'Harap tunggu dan jangan tutup jendela ini.', confirmResetTitle: 'Konfirmasi Reset',
                    confirmResetMessage: 'Apakah Anda yakin ingin mereset semua pengaturan ke nilai default?',
                    deleteImportedImages: 'Hapus gambar yang telah diimpor', continue: 'Lanjutkan', notificationWarnUpload: 'Silakan masukan gambar terlebih dahulu!',
                    notificationWarnObject: 'Masukan gambar objek terlebih dahulu!',
                    tabTitleBackground: 'Pengaturan Latar', tabTitleObject: 'Pengaturan Objek', tabTitleAnimasi: 'Pengaturan Animasi', tabTitleInfo: 'Preferensi',
                    activeObject: 'Objek Aktif', animationObject: 'Animasi Objek', easing: 'Easing', linear: 'Linear', easeIn: 'Ease In',
                    easeOut: 'Ease Out', backIn: 'Back In', backOut: 'Back Out', instant: 'Instan', easeInOut: 'Ease In Out', backInOut: 'Back In Out',
                    keyframeProperties: 'Properti Keyframe', rotation: 'Rotasi', easingToNext: 'Easing Berikutnya', keyframeAnim: 'Animasi Kertas', animNone: 'Tidak Ada', animOpen: 'Buka', animClose: 'Tutup',
                    addKeyframe: 'Tambah Keyframe', keyframePropertiesTitle: 'Properti Keyframe ke-',
                    simple: 'Simpel', advanced: 'Lanjutan', openAnim: 'Animasi Kertas Terbuka', closeAnim: 'Animasi Kertas Tertutup', timeline: 'Timeline',
                    Info: 'Panduan', sourceCode: 'Kode Sumber', license: 'Lisensi', supportCreator: 'Dukung Kreator', installApp: 'Instal Aplikasi', appInstalled: 'Terinstal',
                    licenseTitle: 'GNU Affero General Public License v3.0',
                    licenseContent: `
<div class="text-sm text-slate-300 space-y-4">
    <div>
        <h4 class="font-semibold text-slate-200 mb-2">Anda Diizinkan:</h4>
        <p class="text-slate-400">Anda diizinkan untuk menggunakan, memodifikasi, dan mendistribusikan perangkat lunak ini untuk tujuan pribadi maupun komersial.</p>
    </div>
    <div>
        <h4 class="font-semibold text-slate-200 mb-2">Anda Diwajibkan:</h4>
        <p class="text-slate-400">Anda wajib menyertakan salinan lisensi dan hak cipta, serta menyatakan perubahan yang dibuat. Setiap distribusi harus tetap menggunakan lisensi AGPLv3. Jika Anda menyediakan program sebagai layanan jaringan, Anda wajib menyediakan kode sumbernya.</p>
    </div>
    <div>
        <h4 class="font-semibold text-slate-200 mb-2">Anda Tidak Boleh:</h4>
        <p class="text-slate-400">Anda tidak boleh menambahkan sublisensi atau pembatasan tambahan. Anda juga tidak bisa meminta pertanggungjawaban penulis asli atas masalah yang timbul dari penggunaan perangkat lunak ini.</p>
    </div>
    <div>
        <h4 class="font-semibold text-slate-200 mb-2">Konten Pengguna:</h4>
        <p class="text-slate-400">Lisensi ini tidak berlaku untuk konten yang Anda hasilkan menggunakan perangkat lunak ini, seperti gambar atau video. Hak penuh atas konten tersebut adalah milik Anda. Dengan demikian, segala risiko atau tanggung jawab yang timbul dari konten yang Anda buat sepenuhnya menjadi tanggung jawab Anda sebagai pengguna.</p>
    </div>
</div>
                    `,
                    licenseViewFull: 'Lihat Lisensi Lengkap',
                    resetPreferences: 'Reset Preferensi', preparingExportCanvas: 'Menyiapkan kanvas ekspor...',
                    confirmResetPrefsTitle: 'Konfirmasi Reset Preferensi', completing: 'Menyelesaikan',
                    accentColor: 'Warna Aksen', previewResolution: 'Resolusi Pratinjau', debugScreen: 'Debug Screen',
                    appDescription: 'Aplikasi ini dibuat oleh Nurhidayat (nurimator). Paperima sepenuhnya gratis dan bersifat open source. Donasi sangat membantu untuk menjaga agar aplikasi ini tetap tersedia bagi semua orang.',
                    appDescription2: 'Setelah menginstal aplikasi, pengguna dapat menggunakan aplikasi ini secara offline karena seluruh proses dilakukan langsung di perangkat pengguna sehingga data pengguna tetap aman.',
                    displayModeWarning: 'Peringatan: Memaksa mode tampilan dapat merusak tata letak atau fungsionalitas jika tidak sesuai dengan ukuran layar Anda.',
                    previewResolutionWarning: 'Resolusi pratinjau tidak memengaruhi resolusi ekspor.',
                    dropShadowTooltip: 'Kami menyarankan dropshadow dimatikan jika ekspor sebagai greenscreen. <a href="#" target="_blank" class="text-blue-400 hover:underline">Pelajari selengkapnya</a>',
                    exportFormatInfoTooltip: 'Untuk saat ini, ekspor video hanya mendukung format WebM.',
                    confirmResetPrefsMessage: 'Apakah Anda yakin ingin mereset bahasa, mode tampilan, dan ukuran UI ke nilai default?',
                    infoLink: 'https://dayverse.id/id/docs/?q=paperima',
                    supportLink: 'https://dayverse.id/id/donate/'
                }
            };
            
            function hexToRgba(hex, opacity) {
                let r = 0, g = 0, b = 0;
                if (hex.length === 7) { 
                    r = parseInt(hex.substring(1, 3), 16); 
                    g = parseInt(hex.substring(3, 5), 16); 
                    b = parseInt(hex.substring(5, 7), 16); 
                }
                return `rgba(${r},${g},${b},${opacity})`;
            }

            function darkenHexColor(hex, amount) {
                let [r, g, b] = hex.match(/\w\w/g).map(x => parseInt(x, 16));
                const factor = 1 - amount / 100;
                r = Math.floor(r * factor);
                g = Math.floor(g * factor);
                b = Math.floor(b * factor);
                return "#" + [r, g, b].map(x => {
                    const hexVal = x.toString(16);
                    return hexVal.length === 1 ? '0' + hexVal : hexVal;
                }).join('');
            }

            function applyAccentColor(hexColor) {
                if (!hexColor) return;
                const hoverColor = darkenHexColor(hexColor, 15);
                document.body.style.setProperty('--accent-color', hexColor);
                document.body.style.setProperty('--accent-color-hover', hoverColor);
                const picker = document.getElementById('accent-color-picker');
                if (picker) {
                    picker.value = hexColor;
                }
            }           

            function throttle(func, delay) {
                let inProgress = false;
                return (...args) => {
                    if (inProgress) {
                        return;
                    }
                    inProgress = true;
                    setTimeout(() => {
                        func(...args);
                        inProgress = false;
                    }, delay);
                };
            }

            function getVisualStateAtTime(timeInSeconds, keyframes) {
                const sortedKeyframes = [...keyframes].sort((a, b) => a.time - b.time);
                let currentState = 'open';

                for (const kf of sortedKeyframes) {
                    if (kf.time < timeInSeconds) {
                        if (kf.paperAnim === 'open') {
                            currentState = 'open';
                        } else if (kf.paperAnim === 'close') {
                            currentState = 'closed';
                        }
                    } else {
                        break;
                    }
                }
                return currentState;
            }           

            // This function contains keyframe logic that already existed
            function getAdvancedTransform(timeInSeconds, objectState) {
                const keyframes = [...objectState.animation.keyframes].sort((a, b) => a.time - b.time);
                let currentTransform = { 
                    x: objectState.image.offset.x, 
                    y: objectState.image.offset.y, 
                    scale: objectState.image.size, 
                    rotation: objectState.image.rotation
                };

                let prevKeyframe, nextKeyframe;

                if (keyframes.length > 0) {
                    prevKeyframe = keyframes[0];
                    nextKeyframe = keyframes[keyframes.length - 1];

                    for (let i = 0; i < keyframes.length; i++) {
                        if (keyframes[i].time <= timeInSeconds) {
                            prevKeyframe = keyframes[i];
                        }
                        if (keyframes[i].time > timeInSeconds) {
                            nextKeyframe = keyframes[i];
                            break;
                        }
                    }

                    if (prevKeyframe === nextKeyframe) {
                        currentTransform = { 
                            x: prevKeyframe.x, 
                            y: prevKeyframe.y, 
                            scale: prevKeyframe.scale, 
                            rotation: prevKeyframe.rotation 
                        };
                    } else {
                        if (prevKeyframe.easing === 'instant') {
                            currentTransform = { 
                                x: nextKeyframe.x, 
                                y: nextKeyframe.y, 
                                scale: nextKeyframe.scale, 
                                rotation: nextKeyframe.rotation 
                            };
                        } else {
                            const segmentDuration = nextKeyframe.time - prevKeyframe.time;
                            const timeIntoSegment = timeInSeconds - prevKeyframe.time;
                            let progress = (segmentDuration > 0) ? timeIntoSegment / segmentDuration : 1;
                            progress = Math.max(0, Math.min(1, progress));

                            const easingFunc = EASING[prevKeyframe.easing] || EASING.linear;
                            const easedProgress = easingFunc(progress);

                            currentTransform.x = lerp(prevKeyframe.x, nextKeyframe.x, easedProgress);
                            currentTransform.y = lerp(prevKeyframe.y, nextKeyframe.y, easedProgress);
                            currentTransform.scale = lerp(prevKeyframe.scale, nextKeyframe.scale, easedProgress);
                            currentTransform.rotation = lerp(prevKeyframe.rotation, nextKeyframe.rotation, easedProgress);
                        }
                    }
                }

                return { transform: currentTransform, prevKeyframe, nextKeyframe };
            }

            async function generateTornEdgeCache() {
                if (isGeneratingCache || !state.object.image.element || !state.object.stroke.enabled) {
                    return
                }
                isGeneratingCache = true
                isCacheGenerationNeeded = false
                console.log("Starting progressive cache generation...")
                tornEdgeCache = [];
                console.log("Old cache cleared, starting new cache generation...");

                const objectState = state.object
                const seeds = [20, 30, 40, 10]
                const sourceImg = objectState.image.element
                const newCache = []

                const BASE_RENDER_WIDTH = 1080.0
                const renderScaleFactor = sourceImg.width / BASE_RENDER_WIDTH

                for (let i = 0; i < seeds.length; i++) {
                    const seed = seeds[i]
                    const cacheCanvas = document.createElement('canvas')
                    const cacheCtx = cacheCanvas.getContext('2d')
                    cacheCanvas.width = sourceImg.width
                    cacheCanvas.height = sourceImg.height

                    const adjustedStrokeWidth = objectState.stroke.width * renderScaleFactor
                    const adjustedRoughness = objectState.stroke.roughness * renderScaleFactor
                    const adjustedDetail = objectState.stroke.detail / renderScaleFactor

                    tornDilate.setAttribute('radius', adjustedStrokeWidth)
                    tornDisplacement.setAttribute('scale', adjustedRoughness)
                    tornTurbulence.setAttribute('baseFrequency', adjustedDetail)
                    tornTurbulence.setAttribute('seed', seed)
                    tornFlood.setAttribute('flood-color', '#FFFFFF')

                    cacheCtx.filter = 'url(#combined-filter)'
                    cacheCtx.drawImage(sourceImg, 0, 0)

                    const img = new Image()
                    img.src = cacheCanvas.toDataURL()
                    await img.decode()

                    newCache[i] = img
                    tornEdgeCache = [...newCache]
                    requestRedraw()

                    await new Promise(resolve => setTimeout(resolve, 16))
                }

                isGeneratingCache = false
                console.log("Progressive cache generation completed.")
            }


            function drawFinalObject(objectState, imgW, imgH, totalOffsetX, totalOffsetY, tornEdgesEnabled, layerImage = null, maskImage = null) {
                const centerX = contentCanvas.width / 2;
                const centerY = contentCanvas.height / 2;

                objectCtx.clearRect(0, 0, objectCanvas.width, objectCanvas.height);
                contentCtx.clearRect(0, 0, contentCanvas.width, contentCanvas.height);
                finalObjectCtx.clearRect(0, 0, finalObjectCanvas.width, finalObjectCanvas.height);

                let fgColorFilterString = '';
                if (objectState.color.enabled) {
                    let filterParts = [];
                    if (objectState.color.colorize) filterParts.push('sepia(1)');
                    filterParts.push(`hue-rotate(${objectState.color.hue}deg)`);
                    filterParts.push(`saturate(${100 + objectState.color.saturation}%)`);
                    filterParts.push(`brightness(${100 + objectState.color.brightness}%)`);
                    fgColorFilterString = filterParts.join(' ');
                }

                contentCtx.save();
                contentCtx.filter = fgColorFilterString;
                contentCtx.translate(centerX, centerY);
                contentCtx.drawImage(objectState.image.element, -imgW / 2, -imgH / 2, imgW, imgH);
                contentCtx.restore();

                const overlayImage = originalOverlayImages[objectState.paperFoldOverlay.currentImageIndex];
                if (overlayImage && overlayImage.complete && overlayImage.naturalWidth > 0) {
                    const tempCtx = tempOverlayCanvas.getContext('2d');
                    tempOverlayCanvas.width = overlayImage.naturalWidth;
                    tempOverlayCanvas.height = overlayImage.naturalHeight;
                    tempCtx.drawImage(overlayImage, 0, 0);
                    const imageData = tempCtx.getImageData(0, 0, tempOverlayCanvas.width, tempOverlayCanvas.height);
                    const data = imageData.data;
                    const effectStrength = objectState.paperFoldOverlay.enabled ? objectState.paperFoldOverlay.opacity : 0;
                    const strength = (100 - effectStrength) / 100;
                    for (let i = 0; i < data.length; i += 4) {
                        data[i] += (255 - data[i]) * strength;
                        data[i + 1] += (255 - data[i + 1]) * strength;
                        data[i + 2] += (255 - data[i + 2]) * strength;
                    }
                    tempCtx.putImageData(imageData, 0, 0);
                    contentCtx.save();
                    contentCtx.translate(centerX, centerY);
                    contentCtx.globalCompositeOperation = objectState.paperFoldOverlay.blendMode;
                    contentCtx.drawImage(tempOverlayCanvas, -imgW / 2, -imgH / 2, imgW, imgH);
                    contentCtx.restore();
                }

                if (layerImage) {
                    const layerSize = Math.max(imgW, imgH);
                    contentCtx.save();
                    contentCtx.translate(centerX, centerY);
                    contentCtx.drawImage(layerImage, -layerSize / 2, -layerSize / 2, layerSize, layerSize);
                    contentCtx.restore();
                }

                if (tornEdgesEnabled && objectState.stroke.width > 0) {
                    objectCtx.clearRect(0, 0, objectCanvas.width, objectCanvas.height);
                    objectCtx.save();

                    if (isLiveTornEdgePreview) {

                        const previewCanvas = tempOverlayCanvas; 
                        const previewCtx = previewCanvas.getContext('2d');
                        
                        const sourceImg = objectState.image.element;
                        previewCanvas.width = sourceImg.width;
                        previewCanvas.height = sourceImg.height; 

                        const BASE_RENDER_WIDTH = 1080.0;
                        const renderScaleFactor = sourceImg.width / BASE_RENDER_WIDTH; 
                        const adjustedStrokeWidth = objectState.stroke.width * renderScaleFactor;
                        const adjustedRoughness = objectState.stroke.roughness * renderScaleFactor;
                        const adjustedDetail = objectState.stroke.detail / renderScaleFactor;

                        tornDilate.setAttribute('radius', adjustedStrokeWidth);
                        tornDisplacement.setAttribute('scale', adjustedRoughness);
                        tornTurbulence.setAttribute('baseFrequency', adjustedDetail);
                        tornTurbulence.setAttribute('seed', 10);
                        tornFlood.setAttribute('flood-color', '#FFFFFF');

                        previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
                        previewCtx.filter = 'url(#combined-filter)';
                        previewCtx.drawImage(sourceImg, 0, 0);

                        objectCtx.filter = 'none'; 
                        objectCtx.translate(centerX, centerY);
                        objectCtx.drawImage(previewCanvas, -imgW / 2, -imgH / 2, imgW, imgH); 
                    } else {
                        let cachedImage = tornEdgeCache[objectState.paperFoldOverlay.currentImageIndex];

                        if (!cachedImage && tornEdgeCache.length > 0) {
                            cachedImage = tornEdgeCache[0];
                        }
                        
                        if (cachedImage && cachedImage.complete) {
                            objectCtx.translate(centerX, centerY);
                            objectCtx.drawImage(cachedImage, -imgW / 2, -imgH / 2, imgW, imgH);
                        } else {
                            objectCtx.translate(centerX, centerY);
                            objectCtx.drawImage(objectState.image.element, -imgW / 2, -imgH / 2, imgW, imgH);
                        }
                    }

                    objectCtx.restore();
                    contentCtx.save();
                    contentCtx.globalCompositeOperation = 'destination-in';
                    contentCtx.drawImage(objectCanvas, 0, 0);
                    contentCtx.restore();
                } else {
                    objectCtx.save();
                    objectCtx.translate(centerX, centerY);
                    objectCtx.drawImage(objectState.image.element, -imgW / 2, -imgH / 2, imgW, imgH);
                    objectCtx.restore();

                    contentCtx.save();
                    contentCtx.globalCompositeOperation = 'destination-in';
                    contentCtx.drawImage(objectCanvas, 0, 0);
                    contentCtx.restore();
                }

                let finalSourceCanvas = contentCanvas;
                if (maskImage) {
                    const maskSize = Math.max(imgW, imgH);
                    finalObjectCtx.save();
                    finalObjectCtx.translate(centerX, centerY);
                    finalObjectCtx.drawImage(maskImage, -maskSize / 2, -maskSize / 2, maskSize, maskSize);
                    finalObjectCtx.restore();
                    finalObjectCtx.save();
                    finalObjectCtx.globalCompositeOperation = 'source-in';
                    finalObjectCtx.drawImage(contentCanvas, 0, 0);
                    finalObjectCtx.restore();
                    finalSourceCanvas = finalObjectCanvas;
                }

                return finalSourceCanvas;
            }
            
            function requestRedraw() { needsRedraw = true; }

            // Main drawing function
            async function draw(elapsedTime = 0) {
                if (isCacheGenerationNeeded && !isGeneratingCache && !isLiveTornEdgePreview) {
                    generateTornEdgeCache()
                }

                ctx.save();
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                // Apply background filters
                let bgFilterString = '';
                const bgCC = state.background.effects.colorCorrection;
                if (bgCC.enabled) {
                    let filterParts = [];
                    if (bgCC.colorize) { filterParts.push('sepia(1)'); }
                    filterParts.push(`hue-rotate(${bgCC.hue}deg)`);
                    filterParts.push(`saturate(${100 + bgCC.saturation}%)`);
                    filterParts.push(`brightness(${100 + bgCC.brightness}%)`);
                    bgFilterString = filterParts.join(' ');
                }
                if (state.background.effects.blur.enabled && state.background.effects.blur.intensity > 0) {
                    bgFilterString += ` blur(${state.background.effects.blur.intensity}px)`;
                }
                ctx.filter = bgFilterString.trim();

                ctx.fillStyle = state.background.color;
                ctx.fillRect(0, 0, canvas.width, canvas.height);

                const bgOffsetX = (canvas.width * state.background.transform.offset.x) / 100;
                const bgOffsetY = (canvas.height * (state.background.transform.offset.y * -1)) / 100;
                // Draw the background image if it exists
                if (state.background.element) {
                    ctx.save();
                    if (state.background.transform.mode === 'fill') {
                        ctx.translate(canvas.width / 2 + bgOffsetX, canvas.height / 2 + bgOffsetY);
                        ctx.rotate(state.background.transform.rotation * Math.PI / 180);
                        const userScale = state.background.transform.size / 100;
                        const canvasAspect = canvas.width / canvas.height;
                        const bgAspect = state.background.element.width / state.background.element.height;
                        let fillScale = (canvasAspect > bgAspect) ? canvas.width / state.background.element.width : canvas.height / state.background.element.height;
                        ctx.scale(fillScale * userScale, fillScale * userScale);
                        ctx.drawImage(state.background.element, -state.background.element.width / 2, -state.background.element.height / 2);
                    } else if (state.background.transform.mode === 'stretch') {
                        ctx.drawImage(state.background.element, 0, 0, canvas.width, canvas.height);
                    }
                    ctx.restore();
                }
                ctx.filter = 'none';
                if (state.background.effects.vignette.enabled) {
                    ctx.save();
                    const centerX = canvas.width / 2;
                    const centerY = canvas.height / 2;
                    const outerRadius = 1.5 * Math.sqrt(centerX * centerX + centerY * centerY);
                    const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, outerRadius);
                    const vignetteColor = hexToRgba(state.background.effects.vignette.color, state.background.effects.vignette.opacity / 100);
                    const midPoint = state.background.effects.vignette.radius / 100;
                    const halfFeather = (state.background.effects.vignette.feather / 100) / 2;
                    const stop1 = Math.max(0, midPoint - halfFeather);
                    const stop2 = Math.min(1, midPoint + halfFeather);
                    gradient.addColorStop(stop1, 'rgba(0,0,0,0)');
                    gradient.addColorStop(stop2, vignetteColor);
                    gradient.addColorStop(1, vignetteColor);
                    ctx.fillStyle = gradient;
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                    ctx.restore();
                }
                // Draw the object
                const objectState = state.object;
                if (objectState.image.element) {
                    const animState = objectState.animation;
                    const isSimpleMode = animState.mode === 'simple';
                    const totalDuration = state.export.duration;
                    let timeInSeconds;
                    if (animState.previewTime !== null) {
                        timeInSeconds = animState.previewTime;
                    } else if (isExporting) {
                        timeInSeconds = elapsedTime / 1000;
                    } else {
                        timeInSeconds = (elapsedTime / 1000) % totalDuration;
                    }
                    let transform, isPaperAnimActive = false, paperFrameIndex = 0, currentLayer = null, currentMask = null;
                    if (isSimpleMode) {
                        transform = { x: objectState.image.offset.x, y: objectState.image.offset.y, scale: objectState.image.size, rotation: objectState.image.rotation };
                        const animDuration = 1.0, frameDuration = animDuration / 6.0;
                        if (animState.simple.previewing) {
                            const timeSincePreviewStart = (performance.now() - animState.simple.previewStartTime) / 1000;
                            if (timeSincePreviewStart < animDuration) {
                                isPaperAnimActive = true;
                                let frameIndex = Math.min(5, Math.floor(timeSincePreviewStart / frameDuration));
                                paperFrameIndex = (animState.simple.previewing === 'close') ? 5 - frameIndex : frameIndex;
                            }
                        } else {
                            if (animState.simple.open && timeInSeconds >= 0 && timeInSeconds < animDuration) {
                                isPaperAnimActive = true;
                                paperFrameIndex = Math.min(5, Math.floor(timeInSeconds / frameDuration));
                            }
                            const closeAnimStartTime = totalDuration - animDuration;
                            if (animState.simple.close && timeInSeconds >= closeAnimStartTime && timeInSeconds <= totalDuration) {
                                isPaperAnimActive = true;
                                const timeIntoClose = timeInSeconds - closeAnimStartTime;
                                const frameIndex = Math.min(5, Math.floor(timeIntoClose / frameDuration));
                                paperFrameIndex = 5 - frameIndex;
                            }
                        }
                    } else {
                        const { transform: advTransform, prevKeyframe, nextKeyframe } = getAdvancedTransform(timeInSeconds, objectState);
                        transform = advTransform;
                        if (prevKeyframe && nextKeyframe) {
                            const paperAnimType = prevKeyframe.paperAnim;
                            const segmentDuration = nextKeyframe.time - prevKeyframe.time;
                            if (paperAnimType !== 'none' && segmentDuration > 0) {
                                isPaperAnimActive = true;
                                const progress = Math.min(1, Math.max(0, (timeInSeconds - prevKeyframe.time) / segmentDuration));
                                let frameIndex = Math.floor(progress * MASK_IMAGE_URLS.length);
                                paperFrameIndex = Math.max(0, Math.min(MASK_IMAGE_URLS.length - 1, frameIndex));
                                if (paperAnimType === 'close') {
                                    paperFrameIndex = (MASK_IMAGE_URLS.length - 1) - paperFrameIndex;
                                }
                            }
                        }
                    }
                    if (isPaperAnimActive) {
                        currentLayer = layerImages[paperFrameIndex];
                        currentMask = maskImages[paperFrameIndex];
                    }
                    if (!transform) { console.error("Gagal menentukan transformasi objek."); ctx.restore(); return; }
                    const canvasAspect = canvas.width / canvas.height;
                    const imageAspect = objectState.image.element.width / objectState.image.element.height;
                    const baseScale = (canvasAspect > imageAspect) ? canvas.height / objectState.image.element.height : canvas.width / objectState.image.element.width;
                    const finalScale = baseScale * (transform.scale / 100);
                    const finalW = objectState.image.element.width * finalScale;
                    const finalH = objectState.image.element.height * finalScale;
                    const imgBaseOffsetX = (canvas.width * transform.x) / 100;
                    const imgBaseOffsetY = (canvas.height * transform.y) / 100;
                    const totalOffsetX = imgBaseOffsetX + objectState.movement.positionOffset.x;
                    const totalOffsetY = imgBaseOffsetY + objectState.movement.positionOffset.y;
                    const isTornEdgesEnabled = objectState.stroke.enabled;
                    const stateBefore = getVisualStateAtTime(timeInSeconds, animState.keyframes);
                    let finalStampSource;
                    if (!isSimpleMode && !isPaperAnimActive && stateBefore === 'closed') {
                        finalStampSource = drawFinalObject(objectState, finalW, finalH, totalOffsetX, totalOffsetY, isTornEdgesEnabled, layerImages[0], maskImages[0]);
                    } else {
                        finalStampSource = drawFinalObject(objectState, finalW, finalH, totalOffsetX, totalOffsetY, isTornEdgesEnabled, currentLayer, currentMask);
                    }
                    ctx.save();
                    if (objectState.shadow.enabled) {
                        const baseResolution = 720;
                        const currentResolution = canvas.height;
                        const resolutionScaleFactor = currentResolution / baseResolution;
                        ctx.shadowColor = hexToRgba(objectState.shadow.color, objectState.shadow.opacity / 100);
                        ctx.shadowBlur = objectState.shadow.blur * resolutionScaleFactor;
                        ctx.shadowOffsetX = objectState.shadow.offsetX * resolutionScaleFactor;
                        ctx.shadowOffsetY = (objectState.shadow.offsetY * -1) * resolutionScaleFactor;
                    }
                    ctx.translate(canvas.width / 2 + totalOffsetX, canvas.height / 2 + (totalOffsetY * -1));
                    if (objectState.movement.enabled || transform.rotation !== 0) {
                        const totalRotation = transform.rotation + objectState.movement.rotation;
                        ctx.rotate(totalRotation * Math.PI / 180);
                    }
                    ctx.drawImage(finalStampSource, -finalStampSource.width / 2, -finalStampSource.height / 2);
                    ctx.restore();
                }
                ctx.restore();
            }

            function fpsLoop(timestamp) {
                if (!lastFPSTime) {
                    lastFPSTime = timestamp;
                }
                frameCount++;
                const delta = timestamp - lastFPSTime;

                if (delta >= 1000) {
                    fps = Math.round((frameCount * 1000) / delta);
                    frameCount = 0;
                    lastFPSTime = timestamp;
                    updateDebugScreen(); 
                }

                requestAnimationFrame(fpsLoop);
            }

            function updateTimelineUI() {
                if (isScrubbing) return

                const elapsed = performance.now() - animationStartTime
                const totalDuration = state.export.duration
                const currentTime = (elapsed / 1000) % totalDuration

                const timelineSlider = document.getElementById('timeline-slider')
                const timelineCurrentTime = document.getElementById('timeline-current-time')

                if (timelineSlider) timelineSlider.value = currentTime
                if (timelineCurrentTime) timelineCurrentTime.textContent = `${currentTime.toFixed(2)}s`
            }

            function animationLoop() {
                const timestamp = performance.now()
                const animState = state.object.animation
                
                // Calculate current playhead time
                let currentPlayheadTime;
                if (animState.previewTime !== null) {
                    // When paused or scrubbing, use the fixed preview time
                    currentPlayheadTime = animState.previewTime * 1000
                } else if (animState.isPlaying) {
                    // Only calculate elapsed time when actually playing
                    const elapsed = timestamp - animationStartTime
                    currentPlayheadTime = elapsed
                } else {
                    // When paused but previewTime not set, use pauseStartTime
                    currentPlayheadTime = pauseStartTime
                }

                // Only update movement and overlay when playing or when redraw is needed
                if (animState.isPlaying || needsRedraw || isScrubbing) {
                    updateMovement(currentPlayheadTime)
                    updatePaperFoldOverlay(currentPlayheadTime)
                }
                
                if (animState.isPlaying && !isScrubbing) {
                    updateTimelineUI()
                }

                if (needsRedraw) {
                    draw(currentPlayheadTime).then(() => {
                        needsRedraw = false
                    })
                }

                animationFrameId = requestAnimationFrame(animationLoop)
            }

            // Seeded pseudo-random number generator for consistent randomness
            function seededRandom(seed) {
                const x = Math.sin(seed) * 10000;
                return x - Math.floor(x);
            }

            //Updates objects' positions and rotations based on playhead time (elapsedTime in ms)
            function updateMovement(elapsedTime) {
                if (isLiveTornEdgePreview) return;
                let hasChanged = false;
                const objectState = state.object;

                if (!objectState.movement.enabled) {
                    if (objectState.movement.rotation !== 0 || objectState.movement.positionOffset.x !== 0 || objectState.movement.positionOffset.y !== 0) {
                        objectState.movement.rotation = 0;
                        objectState.movement.positionOffset = { x: 0, y: 0 };
                        hasChanged = true;
                    }
                } else {
                    const isSimpelMode = objectState.movement.mode === 'simpel';
                    const speedMultiplier = isSimpelMode ? objectState.movement.simpelSpeed : 1;
                    const strengthMultiplier = isSimpelMode ? objectState.movement.simpelStrength : 1;
                    
                    const canvasWidth = canvas.offsetWidth;
                    const canvasHeight = canvas.offsetHeight;
                    
                    const effectiveRotationSpeed = objectState.movement.rotationSpeed * speedMultiplier;
                    const effectiveRotationStrength = objectState.movement.rotationStrength * strengthMultiplier;
                    const effectivePositionSpeedX = objectState.movement.positionSpeed.x * speedMultiplier;
                    const effectivePositionSpeedY = objectState.movement.positionSpeed.y * speedMultiplier;
                    const effectivePositionStrengthX = objectState.movement.positionStrength.x * strengthMultiplier;
                    const effectivePositionStrengthY = objectState.movement.positionStrength.y * strengthMultiplier;

                    // Calculate rotation based on time
                    let newRotation = 0;
                    if (effectiveRotationSpeed > 0 && effectiveRotationStrength > 0) {
                        const rotationInterval = 1000 / effectiveRotationSpeed;
                        const cycleIndex = Math.floor(elapsedTime / rotationInterval);
                        // Alternate between positive and negative rotation
                        newRotation = (cycleIndex % 2 === 0) ? effectiveRotationStrength : -effectiveRotationStrength;
                    }
                    
                    if (objectState.movement.rotation !== newRotation) {
                        objectState.movement.rotation = newRotation;
                        hasChanged = true;
                    }

                    // Calculate position X based on time with seeded random
                    let newPositionX = 0;
                    if (effectivePositionSpeedX > 0 && effectivePositionStrengthX > 0) {
                        const positionIntervalX = 1000 / effectivePositionSpeedX;
                        const cycleIndexX = Math.floor(elapsedTime / positionIntervalX);
                        // Use seeded random for consistent results at same time
                        newPositionX = (seededRandom(cycleIndexX * 1000) - 0.5) * effectivePositionStrengthX;
                    }
                    
                    if (objectState.movement.positionOffset.x !== newPositionX) {
                        objectState.movement.positionOffset.x = newPositionX;
                        hasChanged = true;
                    }

                    // Calculate position Y based on time with seeded random
                    let newPositionY = 0;
                    if (effectivePositionSpeedY > 0 && effectivePositionStrengthY > 0) {
                        const positionIntervalY = 1000 / effectivePositionSpeedY;
                        const cycleIndexY = Math.floor(elapsedTime / positionIntervalY);
                        // Use seeded random for consistent results at same time
                        newPositionY = (seededRandom(cycleIndexY * 2000 + 500) - 0.5) * effectivePositionStrengthY;
                    }
                    
                    if (objectState.movement.positionOffset.y !== newPositionY) {
                        objectState.movement.positionOffset.y = newPositionY;
                        hasChanged = true;
                    }
                }

                if (hasChanged) { requestRedraw(); }
            }
            
            // Updates paper texture overlay based on playhead time (elapsedTime in ms)
			function updatePaperFoldOverlay(elapsedTime) {
				const objectState = state.object;
				
				// Early return if not enabled
				if (!objectState.paperFoldOverlay.enabled && !objectState.stroke.enabled) {
					return;
				}

				const speed = objectState.paperFoldOverlay.speed;
				if (speed <= 0) return;

				// Calculate texture index based on elapsed time
				const interval = 1000 / speed;
				const newIndex = Math.floor(elapsedTime / interval) % 4;
				
				if (objectState.paperFoldOverlay.currentImageIndex !== newIndex) {
					objectState.paperFoldOverlay.currentImageIndex = newIndex;
					requestRedraw();
				}
			}

            // Updates debug screen content with more relevant information
            function updateDebugScreen(timestamp) {
                if (!state.debugScreenEnabled) return;
                if (timestamp - lastDebugUpdateTime < 1000) return;
                if (!debugScreenEl) return; 
                lastDebugUpdateTime = timestamp;

                let uiModeText;
                const isCurrentlyDesktop = window.matchMedia('(min-width: 769px)').matches;
                if (state.displayMode === 'auto') {
                    uiModeText = isCurrentlyDesktop ? 'auto (desktop)' : 'auto (mobile)';
                } else {
                    uiModeText = state.displayMode;
                }

                const resPreviewText = `${state.previewResolution}p`;
                const bgFileName = state.background.file ? truncateFilename(state.background.file.name, 20) : 'null';
                const objFileName = state.object.image.file ? truncateFilename(state.object.image.file.name, 20) : 'null';

                const debugInfo = `
FPS          : ${fps}
UI Mode      : ${uiModeText}
Res Preview  : ${resPreviewText} ${canvas.width}x${canvas.height}
Background   : ${bgFileName}
Object       : ${objFileName}
                `.trim();

                debugScreenEl.textContent = debugInfo;
            }
            
            function updateInternalCanvasResolution() {
                // Use active resolution from state, not static value
                const PREVIEW_RESOLUTION_KEY = state.previewResolution;
                const aspectRatioKey = state.aspectRatio;
                
                // Find matching dimensions from resolution map
                const dims = RESOLUTION_MAPS[PREVIEW_RESOLUTION_KEY]?.[aspectRatioKey];

                if (!dims) {
                    console.error(`Dimensi pratinjau tidak ditemukan untuk ${PREVIEW_RESOLUTION_KEY}! Kembali ke 540p.`);
                    const fallbackDims = RESOLUTION_MAPS['540']?.[aspectRatioKey];
                    canvas.width = fallbackDims ? fallbackDims.w : 960;
                    canvas.height = fallbackDims ? fallbackDims.h : 540;
                } else {
                    canvas.width = dims.w;
                    canvas.height = dims.h;
                }

                const imageSizeSlider = document.getElementById('image-size');
                const maxScalePercent = imageSizeSlider ? parseFloat(imageSizeSlider.max) : 200;
                const offscreenMultiplier = (maxScalePercent / 100.0) + 0.1; 

                const offscreenCanvasWidth = Math.round(canvas.width * offscreenMultiplier);
                const offscreenCanvasHeight = Math.round(canvas.height * offscreenMultiplier);          

                // Set resolution for all offscreen canvases
                objectCanvas.width = contentCanvas.width = finalObjectCanvas.width = offscreenCanvasWidth;
                objectCanvas.height = contentCanvas.height = finalObjectCanvas.height = offscreenCanvasHeight;
                
                requestRedraw();
            }

            function updateCanvasDisplaySize() {
                const containerStyle = window.getComputedStyle(canvasContainer);
                const paddingX = parseFloat(containerStyle.paddingLeft) + parseFloat(containerStyle.paddingRight);
                const paddingY = parseFloat(containerStyle.paddingTop) + parseFloat(containerStyle.paddingBottom);
                let availableWidth = canvasContainer.offsetWidth - paddingX;
                let availableHeight = canvasContainer.offsetHeight - paddingY;

                availableWidth = Math.max(10, availableWidth);
                availableHeight = Math.max(10, availableHeight);

                const canvasRatio = canvas.width / canvas.height;
                let displayW = availableWidth;
                let displayH = displayW / canvasRatio;

                if (displayH > availableHeight) {
                    displayH = availableHeight;
                    displayW = displayH * canvasRatio;
                }

                // JavaScript now sets #canvas-wrapper size
                const wrapper = document.getElementById('canvas-wrapper');
                if (wrapper) {
                    wrapper.style.width = `${Math.round(displayW)}px`;
                    wrapper.style.height = `${Math.round(displayH)}px`;
                }
            }

            function resizeAndRedrawAll() {
                updateInternalCanvasResolution();
                updateCanvasDisplaySize();
            }

            function renderKeyframeMarkers() {
                const markersContainer = document.getElementById('keyframe-markers-container');
                if (!markersContainer) return;

                markersContainer.innerHTML = '';

                if (state.object.animation.mode !== 'advanced') {
                    return;
                }

                const totalDuration = state.export.duration;
                if (totalDuration <= 0) return;

                const keyframes = state.object.animation.keyframes;

                keyframes.forEach(kf => {
                    const marker = document.createElement('div');
                    marker.className = 'keyframe-marker';
                    
                    // Provide keyframe position (0.0 - 1.0) as CSS Custom Property
                    const keyframePosition = kf.time / totalDuration;
                    if (keyframePosition >= 0 && keyframePosition <= 1) {
                        marker.style.setProperty('--kf-pos', keyframePosition);
                        markersContainer.appendChild(marker);
                    }
                });
            }

            function getIconForKeyframe(currentKeyframe, currentIndex, sortedKeyframes) {
                const iconStyle = 'fill="currentColor"';
                const openIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" ${iconStyle}><path d="M12.8659 3.00017L22.3922 19.5002C22.6684 19.9785 22.5045 20.5901 22.0262 20.8662C21.8742 20.954 21.7017 21.0002 21.5262 21.0002H2.47363C1.92135 21.0002 1.47363 20.5525 1.47363 20.0002C1.47363 19.8246 1.51984 19.6522 1.60761 19.5002L11.1339 3.00017C11.41 2.52187 12.0216 2.358 12.4999 2.63414C12.6519 2.72191 12.7782 2.84815 12.8659 3.00017ZM4.20568 19.0002H19.7941L11.9999 5.50017L4.20568 19.0002Z"></path></svg>`;
                const closeIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" ${iconStyle} style="transform: rotate(180deg);"><path d="M12.8659 3.00017L22.3922 19.5002C22.6684 19.9785 22.5045 20.5901 22.0262 20.8662C21.8742 20.954 21.7017 21.0002 21.5262 21.0002H2.47363C1.92135 21.0002 1.47363 20.5525 1.47363 20.0002C1.47363 19.8246 1.51984 19.6522 1.60761 19.5002L11.1339 3.00017C11.41 2.52187 12.0216 2.358 12.4999 2.63414C12.6519 2.72191 12.7782 2.84815 12.8659 3.00017ZM4.20568 19.0002H19.7941L11.9999 5.50017L4.20568 19.0002Z"></path></svg>`;
                const squareIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" ${iconStyle}><path d="M4 3H20C20.5523 3 21 3.44772 21 4V20C21 20.5523 20.5523 21 20 21H4C3.44772 21 3 20.5523 3 20V4C3 3.44772 3.44772 3 4 3ZM5 5V19H19V5H5Z"></path></svg>`;
                const lineIcon = `<svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14"/></svg>`;

                if (currentKeyframe.paperAnim === 'open') return openIcon;
                if (currentKeyframe.paperAnim === 'close') return closeIcon;

                if (currentKeyframe.paperAnim === 'none') {
                    for (let i = currentIndex - 1; i >= 0; i--) {
                        const prevAnim = sortedKeyframes[i].paperAnim;
                        if (prevAnim === 'open') return squareIcon;
                        if (prevAnim === 'close') return lineIcon;
                    }
                    return squareIcon;
                }

                return squareIcon;
            }

            // Draws duration bar with accurate length and position
            function renderSimpleAnimationMarkers() {
                const container = document.getElementById('keyframe-markers-container');
                if (!container) return;

                const trackWidth = container.offsetWidth;
                container.querySelectorAll('.simple-anim-marker').forEach(m => m.remove());

                if (state.object.animation.mode !== 'simple') return;

                const totalDuration = state.export.duration;
                if (totalDuration <= 0 || trackWidth <= 0) return;

                const animDuration = 1.0;
                const thumbWidth = 20;
                const borderWidth = 3;

                const oneSecondInPixels = (animDuration / totalDuration) * trackWidth;
                const markerWidthInPixels = oneSecondInPixels + thumbWidth - borderWidth;

                if (state.object.animation.simple.open) {
                    const openMarker = document.createElement('div');
                    openMarker.className = 'simple-anim-marker';
                    openMarker.style.left = '0px';
                    openMarker.style.width = `${markerWidthInPixels}px`;
                    container.appendChild(openMarker);
                }

                if (state.object.animation.simple.close) {
                    const closeMarker = document.createElement('div');
                    closeMarker.className = 'simple-anim-marker';
                    const endPosition = trackWidth;
                    const startPosition = endPosition - markerWidthInPixels;
                    
                    closeMarker.style.left = `${startPosition}px`;
                    closeMarker.style.width = `${markerWidthInPixels}px`;
                    container.appendChild(closeMarker);
                }
            }

            // Initializes rotation slider with "wrapping" thumb and fixed range
			function initContinuousSlider(sliderEl, inputEl, labelEl, getValue, stateUpdater) {
				if (!sliderEl || !inputEl || !labelEl) return;

				sliderEl.min = -180;
				sliderEl.max = 180;

				let isDragging = false;
				let startX = 0;
				let startValue = 0;
				const sensitivity = 2.0;

				const syncUI = (newValue) => {
					const value = Math.round(newValue);
					stateUpdater(value);
					inputEl.value = value;
					sliderEl.value = (value % 360 + 540) % 360 - 180;
					const loop = Math.floor((value + 180) / 360);
					const baseText = translations[state.language]?.rotation || 'Rotation';
					labelEl.textContent = loop === 0 ? baseText : `${baseText} (${loop > 0 ? '+' : ''}${loop})`;
					requestRedraw();
				};

				const handleDragStart = (clientX) => {
					isDragging = true;
					startX = clientX;
					startValue = getValue();
					document.body.style.cursor = 'ew-resize';
					sliderEl.classList.add('grabbing');
					document.addEventListener('mousemove', handleMouseMove);
					document.addEventListener('mouseup', handleDragEnd);
					document.addEventListener('touchmove', handleTouchMove, { passive: false });
					document.addEventListener('touchend', handleDragEnd);
				};

				const handleDragMove = (clientX) => {
					if (!isDragging) return;
					const deltaX = clientX - startX;
					const newValue = startValue + (deltaX / sensitivity);
					syncUI(newValue);
				};

				const handleDragEnd = () => {
					isDragging = false;
					document.body.style.cursor = 'default';
					sliderEl.classList.remove('grabbing');
					document.removeEventListener('mousemove', handleMouseMove);
					document.removeEventListener('mouseup', handleDragEnd);
					document.removeEventListener('touchmove', handleTouchMove);
					document.removeEventListener('touchend', handleDragEnd);
				};

				const handleMouseDown = (e) => handleDragStart(e.clientX);
				const handleMouseMove = (e) => handleDragMove(e.clientX);
				const handleTouchStart = (e) => { e.preventDefault(); handleDragStart(e.touches[0].clientX); };
				const handleTouchMove = (e) => { e.preventDefault(); handleDragMove(e.touches[0].clientX); };

				const updateFromInput = () => syncUI(parseFloat(inputEl.value) || 0);

				sliderEl.addEventListener('mousedown', handleMouseDown);
				sliderEl.addEventListener('touchstart', handleTouchStart, { passive: false });
				inputEl.addEventListener('change', updateFromInput);
				inputEl.addEventListener('wheel', (e) => {
					e.preventDefault();
					const step = e.deltaY < 0 ? 1 : -1;
					const currentValue = parseFloat(inputEl.value) || 0;
					syncUI(currentValue + step);
				});

				syncUI(getValue());
			}

            function syncSliderAndInput(sliderId, inputId, stateUpdater) {
                const slider = document.getElementById(sliderId);
                const input = document.getElementById(inputId);
                if (!slider || !input) return;

                function updateValue(value, trigger) {
                    const min = parseFloat(slider.min);
                    const max = parseFloat(slider.max);
                    const step = parseFloat(slider.step) || 1;
                    const decimalPlaces = (String(step).split('.')[1] || []).length;
                    let valueToUpdate = parseFloat(value);
                    let clampedValue = Math.max(min, Math.min(max, valueToUpdate || 0));
                    
                    if (trigger !== 'slider') slider.value = clampedValue;
                    if (trigger !== 'input') input.value = clampedValue.toFixed(decimalPlaces);

                    stateUpdater(clampedValue);
                    requestRedraw();
                }

                slider.addEventListener('input', (e) => updateValue(e.target.value, 'slider'));
                input.addEventListener('change', (e) => updateValue(e.target.value, 'input'));
                input.addEventListener('wheel', (e) => {
                    e.preventDefault();
                    const step = parseFloat(input.step) || 1;
                    const direction = e.deltaY < 0 ? 1 : -1;
                    const newValue = parseFloat(input.value) + (direction * step);
                    input.value = newValue; 
                    updateValue(newValue, 'input');
                });
            }

            function syncInputOnly(inputId, stateUpdater) {
                const input = document.getElementById(inputId);
                if (!input) return;
                function updateValue(value) {
                    const min = parseFloat(input.min) || -Infinity;
                    const max = parseFloat(input.max) || Infinity;
                    let clampedValue = Math.max(min, Math.min(max, parseFloat(value) || 0));
                    input.value = clampedValue;
                    stateUpdater(clampedValue);
                    requestRedraw();
                }
                input.addEventListener('change', (e) => updateValue(e.target.value));
                input.addEventListener('wheel', (e) => {
                    e.preventDefault();
                    const step = parseFloat(input.step) || 1;
                    const direction = e.deltaY < 0 ? 1 : -1;
                    const newValue = parseFloat(input.value) + (direction * step);
                    input.value = newValue; 
                    updateValue(newValue);
                });
            }
            
            function handleImageFile(file, target) {
                if (!file || !file.type.startsWith('image/')) return

                const isSVG = file.type === 'image/svg+xml'
                const reader = new FileReader()
                reader.onload = (event) => {
                    const highResImg = new Image()
                    highResImg.onload = () => {
                        // For background images
                        if (target === 'background') {
                            if (isSVG) {
                                // Render SVG at preview resolution
                                const previewRes = parseInt(state.previewResolution) || 540
                                const aspectRatio = highResImg.width / highResImg.height
                                let targetWidth, targetHeight
                                if (aspectRatio > 1) {
                                    targetWidth = previewRes * aspectRatio
                                    targetHeight = previewRes
                                } else {
                                    targetWidth = previewRes
                                    targetHeight = previewRes / aspectRatio
                                }
                                
                                const svgCanvas = document.createElement('canvas')
                                const svgCtx = svgCanvas.getContext('2d')
                                svgCanvas.width = targetWidth
                                svgCanvas.height = targetHeight
                                svgCtx.drawImage(highResImg, 0, 0, targetWidth, targetHeight)
                                
                                const scaledImg = new Image()
                                scaledImg.onload = () => {
                                    state.background.element = scaledImg
                                    state.background.file = file
                                    updateUIFromState()
                                    requestRedraw()
                                }
                                scaledImg.src = svgCanvas.toDataURL()
                            } else {
                                state.background.element = highResImg
                                state.background.file = file
                                updateUIFromState()
                                requestRedraw()
                            }
                            return
                        }

                        // For foreground/object images
                        state.object.image.originalElement = highResImg
                        state.object.image.file = file
                        state.object.image.isSVG = isSVG
                        if (isSVG) {
                            state.object.image.originalSVGSrc = event.target.result
                        }

                        const MAX_PREVIEW_SIZE = 800
                        let previewWidth, previewHeight
                        
                        if (isSVG) {
                            // For SVG, use MAX_PREVIEW_SIZE as target resolution
                            const ratio = highResImg.width / highResImg.height
                            if (ratio > 1) {
                                previewWidth = MAX_PREVIEW_SIZE
                                previewHeight = MAX_PREVIEW_SIZE / ratio
                            } else {
                                previewHeight = MAX_PREVIEW_SIZE
                                previewWidth = MAX_PREVIEW_SIZE * ratio
                            }
                        } else {
                            // For raster images, only downscale if larger than MAX_PREVIEW_SIZE
                            previewWidth = highResImg.width
                            previewHeight = highResImg.height
                            
                            if (previewWidth > MAX_PREVIEW_SIZE || previewHeight > MAX_PREVIEW_SIZE) {
                                const ratio = previewWidth / previewHeight
                                if (ratio > 1) {
                                    previewWidth = MAX_PREVIEW_SIZE
                                    previewHeight = MAX_PREVIEW_SIZE / ratio
                                } else {
                                    previewHeight = MAX_PREVIEW_SIZE
                                    previewWidth = MAX_PREVIEW_SIZE * ratio
                                }
                            }
                        }

                        const resampleCanvas = document.createElement('canvas')
                        const resampleCtx = resampleCanvas.getContext('2d')
                        resampleCanvas.width = previewWidth
                        resampleCanvas.height = previewHeight
                        resampleCtx.drawImage(highResImg, 0, 0, previewWidth, previewHeight)

                        const previewImg = new Image()
                        previewImg.onload = () => {
                            const paddedCanvas = document.createElement('canvas')
                            const paddedCtx = paddedCanvas.getContext('2d')
                            const paddingX = previewImg.width * 0.25
                            const paddingY = previewImg.height * 0.25
                            paddedCanvas.width = previewImg.width + paddingX * 2
                            paddedCanvas.height = previewImg.height + paddingY * 2
                            paddedCtx.drawImage(previewImg, paddingX, paddingY)

                            const finalPaddedImg = new Image()
                            finalPaddedImg.onload = () => {
                                state.object.image.element = finalPaddedImg
                                isCacheGenerationNeeded = true
                                state.object.animation.isPlaying = true
                                animationStartTime = performance.now()
                                pauseStartTime = 0
                                state.object.paperFoldOverlay.lastImageSwitchTime = animationStartTime
                                updatePlayPauseButton()
                                updateUIFromState()
                                requestRedraw()
                            }
                            finalPaddedImg.src = paddedCanvas.toDataURL()
                        }
                        previewImg.src = resampleCanvas.toDataURL()
                    }
                    highResImg.onerror = () => {
                        console.error(`Gagal memuat gambar ${target}`)
                    }
                    highResImg.src = event.target.result
                }
                reader.readAsDataURL(file)
            }

            // Updates all text elements in the UI to the selected language
            function updateUIText(lang) {
                const translationMap = translations[lang] || translations['en'];
                document.querySelectorAll('[data-translate-key]').forEach(el => {
                    const key = el.dataset.translateKey;
                    if (translationMap[key]) {
                        if (key === 'dropImagePrompt' || key === 'appDescription2' || key === 'exportFormatInfoTooltip' || key === 'dropShadowTooltip' || key === 'licenseContent') {
                           el.innerHTML = translationMap[key];
                        } else {
                           el.textContent = translationMap[key];
                        }
                    }
                });
                 document.querySelectorAll('[data-translate-key-title]').forEach(el => {
                    const key = el.dataset.translateKeyTitle;
                    if (translationMap[key]) {
                        el.title = translationMap[key];
                    }
                });
                
                // Update option elements specifically
                document.querySelectorAll('option[data-translate-key]').forEach(option => {
                    const key = option.dataset.translateKey;
                    if (translationMap[key]) {
                        option.textContent = translationMap[key];
                    }
                });
            }
            function lerp(a, b, t) {
                return a + (b - a) * t;
            }
            // Truncates a filename for display purposes
            function truncateFilename(filename, maxLength = 12) {
                const lastDotIndex = filename.lastIndexOf('.');
                if (lastDotIndex === -1) {
                    return filename.length > maxLength ? filename.substring(0, maxLength) + '...' : filename;
                }
                const name = filename.substring(0, lastDotIndex);
                const ext = filename.substring(lastDotIndex);
                if (name.length > maxLength) {
                    return name.substring(0, maxLength) + '...' + ext;
                }
                return filename;
            }

            let activeKeyframeUI = null;

            // Creates and renders the entire keyframe list based on state, now with icons
            function renderKeyframeList() {
                const keyframeListContainer = document.getElementById('keyframe-list');
                const keyframes = state.object.animation.keyframes;
                const sortedKeyframes = [...keyframes].sort((a, b) => a.time - b.time);

                keyframeListContainer.innerHTML = '';

                sortedKeyframes.forEach((kf, index) => {
                    const item = document.createElement('div');
                    item.className = 'keyframe-item flex items-center gap-2 p-2 border border-slate-700 bg-slate-800 cursor-pointer transition-colors hover:bg-slate-700/50';
                    item.dataset.keyframeId = kf.id;

                    if (kf.id === state.object.animation.activeKeyframeId) {
                        item.classList.add('border-accent-400', 'bg-slate-700');
                        item.style.borderColor = 'var(--accent-color)';
                    }

                    const iconSVG = getIconForKeyframe(kf, index, sortedKeyframes);

                    item.innerHTML = `
                        <div class="w-6 h-6 flex-shrink-0 text-white flex items-center justify-center">${iconSVG}</div>
                        <span class="font-semibold text-slate-300 flex-shrink-0">Keyframe ${index + 1}</span>
                        <div class="flex items-center gap-2 ml-auto">
                            <input type="number" min="0" step="0.1" value="${kf.time.toFixed(2)}" class="keyframe-time-input number-input-uniform bg-slate-900 border border-[var(--border-color-light)] py-1 px-2 text-sm focus:ring-[var(--accent-color)] focus:border-[var(--accent-color)]">
                            <span class="text-sm text-[var(--text-muted)]">s</span>
                            <button class="delete-keyframe-btn p-1.5 text-red-400 hover:text-white hover:bg-red-500/80 transition-all">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M7 4V2H17V4H22V6H20V21C20 21.5523 19.5523 22 19 22H5C4.44772 22 4 21.5523 4 21V6H2V4H7ZM6 6V20H18V6H6ZM9 9H11V17H9V9ZM13 9H15V17H13V9Z"></path></svg>
                            </button>
                        </div>
                    `;
                    keyframeListContainer.appendChild(item);
                });

                renderKeyframeProperties();
                renderKeyframeMarkers();
            }

            // Renders the properties panel for the currently active keyframe
            function renderKeyframeProperties() {
                const panel = document.getElementById('keyframe-properties-panel');
                const activeKeyframeId = state.object.animation.activeKeyframeId;
                const keyframes = state.object.animation.keyframes;
                const keyframe = keyframes.find(kf => kf.id === activeKeyframeId);

                if (!keyframe) {
                    panel.innerHTML = '';
                    panel.classList.add('hidden');
                    return;
                }

                const sortedKeyframes = [...keyframes].sort((a, b) => a.time - b.time);
                const currentIndex = sortedKeyframes.findIndex(kf => kf.id === activeKeyframeId);
                const stateBefore = getVisualStateAtTime(keyframe.time, keyframes);
                const isOpenDisabled = !(stateBefore === 'closed' || currentIndex === 0);
                const isCloseDisabled = !(stateBefore === 'open');

                panel.classList.remove('hidden');
                panel.innerHTML = `
                <div class="accordion-section border border-[var(--border-color)] accordion-open">
                    <div class="accordion-header w-full flex items-center justify-between p-4 bg-slate-700/30">
                        <h2 id="keyframe-properties-title" class="text-base font-semibold text-slate-300"></h2>
                        <div class="flex items-center gap-2">
                            <button id="kf-reset-btn" title="Reset Properties" class="p-1.5 text-slate-300 hover:text-white hover:bg-slate-600 transition-colors">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M22 12C22 17.5228 17.5229 22 12 22C6.4772 22 2 17.5228 2 12C2 6.47715 6.4772 2 12 2V4C7.5817 4 4 7.58172 4 12C4 16.4183 7.5817 20 12 20C16.4183 20 20 16.4183 20 12C20 9.25022 18.6127 6.82447 16.4998 5.38451L16.5 8H14.5V2L20.5 2V4L18.0008 3.99989C20.4293 5.82434 22 8.72873 22 12Z"></path></svg>
                            </button>
                            <button id="kf-copy-btn" title="Copy Properties" class="p-1.5 text-slate-300 hover:text-white hover:bg-slate-600 transition-colors">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M6.9998 6V3C6.9998 2.44772 7.44752 2 7.9998 2H19.9998C20.5521 2 20.9998 2.44772 20.9998 3V17C20.9998 17.5523 20.5521 18 19.9998 18H16.9998V20.9991C16.9998 21.5519 16.5499 22 15.993 22H4.00666C3.45059 22 3 21.5554 3 20.9991L3.0026 7.00087C3.0027 6.44811 3.45264 6 4.00942 6H6.9998ZM5.00242 8L5.00019 20H14.9998V8H5.00242ZM8.9998 6H16.9998V16H18.9998V4H8.9998V6Z"></path></svg>
                            </button>
                            <button id="kf-paste-btn" title="Paste Properties" class="p-1.5 text-slate-300 hover:text-white hover:bg-slate-600 transition-colors ${keyframeClipboard === null ? 'is-disabled' : ''}">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M7 4V2H17V4H20.0066C20.5552 4 21 4.44495 21 4.9934V21.0066C21 21.5552 20.5551 22 20.0066 22H3.9934C3.44476 22 3 21.5551 3 21.0066V4.9934C3 4.44476 3.44495 4 3.9934 4H7ZM7 6H5V20H19V6H17V8H7V6ZM9 4V6H15V4H9Z"></path></svg>
                            </button>
                        </div>
                    </div>
                    <div class="accordion-body space-y-4 p-4 border-t border-[var(--border-color)]">
                        <!-- Scale -->
                        <div>
                            <label class="text-sm font-medium text-[var(--text-muted)] mb-2 block" data-translate-key="imageSize"></label>
                            <div class="flex items-center gap-3">
                                <input type="range" id="kf-scale" min="10" max="200" value="${keyframe.scale}" class="w-full slider">
                                <input type="number" id="kf-scale-input" min="10" max="200" value="${keyframe.scale}" class="number-input-uniform bg-slate-900 border border-[var(--border-color)] py-1 px-2 text-sm">
                            </div>
                        </div>
                        <!-- Offset X -->
                        <div>
                            <label class="text-sm font-medium text-[var(--text-muted)] mb-2 block" data-translate-key="offsetX"></label>
                            <div class="flex items-center gap-3">
                                <input type="range" id="kf-offset-x" min="-150" max="150" value="${keyframe.x}" class="w-full slider">
                                <input type="number" id="kf-offset-x-input" min="-150" max="150" value="${keyframe.x}" class="number-input-uniform bg-slate-900 border border-[var(--border-color)] py-1 px-2 text-sm">
                            </div>
                        </div>
                        <!-- Offset Y -->
                        <div>
                            <label class="text-sm font-medium text-[var(--text-muted)] mb-2 block" data-translate-key="offsetY"></label>
                            <div class="flex items-center gap-3">
                                <input type="range" id="kf-offset-y" min="-150" max="150" value="${keyframe.y}" class="w-full slider">
                                <input type="number" id="kf-offset-y-input" min="-150" max="150" value="${keyframe.y}" class="number-input-uniform bg-slate-900 border border-[var(--border-color)] py-1 px-2 text-sm">
                            </div>
                        </div>
                        <!-- Rotation -->
                        <div>
                            <label id="kf-rotation-label" class="text-sm font-medium text-[var(--text-muted)] mb-2 block" data-translate-key="rotation"></label>
                            <div class="flex items-center gap-3">
                                <input type="range" id="kf-rotation" min="-180" max="180" value="${(keyframe.rotation % 360 + 540) % 360 - 180}" class="w-full slider">
                                <input type="number" id="kf-rotation-input" value="${keyframe.rotation}" class="number-input-uniform bg-slate-900 border border-[var(--border-color)] py-1 px-2 text-sm">
                            </div>
                        </div>
                        <!-- Easing -->
                        <div class="pt-4 border-t border-slate-700">
                            <label class="text-sm font-medium text-[var(--text-muted)] mb-2 block" data-translate-key="easingToNext"></label>
                            <div id="kf-easing-btns" class="space-y-2">
                                <div class="grid grid-cols-4 gap-2 btn-group-toggle">
                                    ${['linear', 'easeIn', 'easeOut', 'easeInOut'].map(type => `
                                        <button data-easing="${type}" class="${keyframe.easing === type ? 'active' : ''} p-2.5 border-2 border-[var(--border-color)] text-[var(--text-muted)] text-sm" data-translate-key="${type}"></button>
                                    `).join('')}
                                </div>
                                <div class="grid grid-cols-4 gap-2 btn-group-toggle">
                                    ${['instant', 'backIn', 'backOut', 'backInOut'].map(type => `
                                        <button data-easing="${type}" class="${keyframe.easing === type ? 'active' : ''} p-2.5 border-2 border-[var(--border-color)] text-[var(--text-muted)] text-sm" data-translate-key="${type}"></button>
                                    `).join('')}
                                </div>
                            </div>
                        </div>
                        <!-- Paper Animation -->
                        <div class="pt-4 border-t border-slate-700">
                            <label class="text-sm font-medium text-[var(--text-muted)] mb-2 block" data-translate-key="keyframeAnim"></label>
                            <div id="kf-paper-anim-btns" class="grid grid-cols-3 gap-2 btn-group-toggle">
                                <button data-anim="none" class="${keyframe.paperAnim === 'none' ? 'active' : ''} p-2.5 border-2 border-[var(--border-color)] text-[var(--text-muted)] text-sm" data-translate-key="animNone"></button>
                                <button data-anim="open" class="${keyframe.paperAnim === 'open' ? 'active' : ''} p-2.5 border-2 border-[var(--border-color)] text-[var(--text-muted)] text-sm" ${isOpenDisabled ? 'disabled' : ''} data-translate-key="animOpen"></button>
                                <button data-anim="close" class="${keyframe.paperAnim === 'close' ? 'active' : ''} p-2.5 border-2 border-[var(--border-color)] text-[var(--text-muted)] text-sm" ${isCloseDisabled ? 'disabled' : ''} data-translate-key="animClose"></button>
                            </div>
                        </div>
                    </div>
                </div>`;

                // Create dynamic title
                const titleTemplate = translations[state.language].keyframePropertiesTitle || 'Keyframe Properties #';
                const dynamicTitle = `${titleTemplate}${currentIndex + 1}`;
                document.getElementById('keyframe-properties-title').textContent = dynamicTitle;                

                updateUIText(state.language);

                document.getElementById('kf-reset-btn').addEventListener('click', () => {
                    const defaultProps = DEFAULT_OBJECT_STATE.animation.keyframes[0];
                    keyframe.x = defaultProps.x;
                    keyframe.y = defaultProps.y;
                    keyframe.scale = defaultProps.scale;
                    keyframe.rotation = defaultProps.rotation;
                    renderKeyframeProperties();
                    requestRedraw();
                });

                document.getElementById('kf-copy-btn').addEventListener('click', () => {
                    keyframeClipboard = {
                        x: keyframe.x,
                        y: keyframe.y,
                        scale: keyframe.scale,
                        rotation: keyframe.rotation,
                    };
                    renderKeyframeProperties();
                });

                document.getElementById('kf-paste-btn').addEventListener('click', (e) => {
                    if (e.currentTarget.classList.contains('is-disabled')) return;
                    if (keyframeClipboard) {
                        keyframe.x = keyframeClipboard.x;
                        keyframe.y = keyframeClipboard.y;
                        keyframe.scale = keyframeClipboard.scale;
                        keyframe.rotation = keyframeClipboard.rotation;
                        renderKeyframeProperties();
                        requestRedraw();
                    }
                });

                syncSliderAndInput('kf-scale', 'kf-scale-input', val => keyframe.scale = val);
                syncSliderAndInput('kf-offset-x', 'kf-offset-x-input', val => keyframe.x = val);
                syncSliderAndInput('kf-offset-y', 'kf-offset-y-input', val => keyframe.y = val);
                initContinuousSlider(
                    document.getElementById('kf-rotation'),
                    document.getElementById('kf-rotation-input'),
                    document.getElementById('kf-rotation-label'),
                    () => keyframe.rotation,
                    val => { keyframe.rotation = val; }
                );
                document.getElementById('kf-easing-btns').addEventListener('click', e => {
                    const btn = e.target.closest('button');
                    if (btn) {
                        keyframe.easing = btn.dataset.easing;
                        renderKeyframeProperties();
                        requestRedraw();
                    }
                });
                document.getElementById('kf-paper-anim-btns').addEventListener('click', e => {
                    const btn = e.target.closest('button');
                    if (btn && !btn.disabled) {
                        keyframe.paperAnim = btn.dataset.anim;
                        renderKeyframeProperties();
                        renderKeyframeList();
                        requestRedraw();
                    }
                });
            }


			function updateUIFromState() {
				updateUIText(state.language);

				const activeObjectState = state.object;
				const animMode = activeObjectState.animation.mode;
				document.getElementById('animation-simple-controls').classList.toggle('hidden', animMode !== 'simple');
				document.getElementById('animation-advanced-controls').classList.toggle('hidden', animMode !== 'advanced');

				document.querySelectorAll('#animation-mode-btns button').forEach(btn => {
					btn.classList.toggle('active', btn.dataset.mode === animMode);
				});

				document.getElementById('simple-anim-open-switch').checked = activeObjectState.animation.simple.open;
				document.getElementById('simple-anim-close-switch').checked = activeObjectState.animation.simple.close;

				const transformAccordion = document.getElementById('foreground-transform-accordion');
				if (transformAccordion) {
					if (animMode === 'advanced') {
						transformAccordion.classList.add('is-disabled');
						if (transformAccordion.classList.contains('accordion-open')) {
							transformAccordion.classList.remove('accordion-open');
							transformAccordion.querySelector('.accordion-body').classList.add('hidden');
						}
					} else {
						transformAccordion.classList.remove('is-disabled');
					}
				}

				const imageSpecificControls = document.getElementById('image-specific-controls');
				const dropZonePrompt = document.getElementById('drop-zone-prompt');
				const dropZoneFilenameContainer = document.getElementById('drop-zone-filename');
				const deleteImageBtn = document.getElementById('delete-image-btn');

				if (activeObjectState.image.element) {
					imageSpecificControls.classList.remove('is-disabled');
					dropZonePrompt.classList.add('hidden');
					dropZoneFilenameContainer.classList.remove('hidden');
					if (dropZoneFilenameContainer.querySelector('p') && activeObjectState.image.file) {
						dropZoneFilenameContainer.querySelector('p').textContent = truncateFilename(activeObjectState.image.file.name);
					}
					deleteImageBtn.classList.remove('hidden');
				} else {
					imageSpecificControls.classList.add('is-disabled');
					dropZonePrompt.classList.remove('hidden');
					dropZoneFilenameContainer.classList.add('hidden');
					deleteImageBtn.classList.add('hidden');
				}

				const backgroundColorControl = document.getElementById('background-color-control');
				const backgroundDropZonePrompt = document.getElementById('background-drop-zone-prompt');
				const backgroundDropZoneFilename = document.getElementById('background-drop-zone-filename');
				const removeBackgroundImageBtn = document.getElementById('remove-background-image');
				const bgDependentAccordions = ['background-transform-accordion', 'background-blur-accordion'];

                const hasBgImage = !!state.background.element;

                backgroundDropZonePrompt.classList.toggle('hidden', hasBgImage);
                backgroundDropZoneFilename.classList.toggle('hidden', !hasBgImage);
                if (hasBgImage && backgroundDropZoneFilename.querySelector('p') && state.background.file) {
                    backgroundDropZoneFilename.querySelector('p').textContent = truncateFilename(state.background.file.name);
                }
                removeBackgroundImageBtn.classList.toggle('hidden', !hasBgImage);

                bgDependentAccordions.forEach(id => {
                    document.getElementById(id).classList.toggle('controls-disabled-for-bg', !hasBgImage);
                });

				const paperFoldOverlayControls = document.getElementById('overlay-controls');
				const anyOverlayImageLoaded = originalOverlayImages.length > 0 && originalOverlayImages.some(img => img !== null);
				if (activeObjectState.paperFoldOverlay.enabled && anyOverlayImageLoaded) {
					paperFoldOverlayControls.classList.remove('controls-disabled-for-overlay');
				} else {
					paperFoldOverlayControls.classList.add('controls-disabled-for-overlay');
				}

				document.getElementById('background-color').value = state.background.color;
				document.querySelectorAll('#aspect-ratio-btns button').forEach(btn => btn.classList.toggle('active', btn.dataset.ratio === state.aspectRatio));
				document.querySelectorAll('#canvas-resolution-btns button').forEach(btn => btn.classList.toggle('active', parseInt(btn.dataset.res) === state.canvasDisplayResolution));

				const inputsToUpdate = [
					{ id: 'background-size-input', value: state.background.transform.size },
					{ id: 'background-offset-x-input', value: state.background.transform.offset.x },
					{ id: 'background-offset-y-input', value: state.background.transform.offset.y },
					{ id: 'background-color-hue-input', value: state.background.effects.colorCorrection.hue },
					{ id: 'background-color-saturation-input', value: state.background.effects.colorCorrection.saturation },
					{ id: 'background-color-brightness-input', value: state.background.effects.colorCorrection.brightness },
					{ id: 'background-colorize-switch', checked: state.background.effects.colorCorrection.colorize },
					{ id: 'background-blur-intensity-input', value: state.background.effects.blur.intensity },
					{ id: 'background-vignette-opacity-input', value: state.background.effects.vignette.opacity },
					{ id: 'background-vignette-radius-input', value: state.background.effects.vignette.radius },
					{ id: 'background-vignette-feather-input', value: state.background.effects.vignette.feather },
					{ id: 'background-vignette-color', value: state.background.effects.vignette.color },
					{ id: 'image-size-input', value: activeObjectState.image.size },
					{ id: 'image-offset-x-input', value: activeObjectState.image.offset.x },
					{ id: 'image-offset-y-input', value: activeObjectState.image.offset.y },
					{ id: 'stroke-width-input', value: activeObjectState.stroke.width },
					{ id: 'stroke-roughness-input', value: activeObjectState.stroke.roughness },
					{ id: 'stroke-detail-input', value: activeObjectState.stroke.detail * 1000 },
					{ id: 'shadow-offset-x-input', value: activeObjectState.shadow.offsetX },
					{ id: 'shadow-offset-y-input', value: activeObjectState.shadow.offsetY },
					{ id: 'shadow-blur-input', value: activeObjectState.shadow.blur },
					{ id: 'shadow-opacity-input', value: activeObjectState.shadow.opacity },
					{ id: 'shadow-color', value: activeObjectState.shadow.color },
					{ id: 'color-hue-input', value: activeObjectState.color.hue },
					{ id: 'color-saturation-input', value: activeObjectState.color.saturation },
					{ id: 'color-brightness-input', value: activeObjectState.color.brightness },
					{ id: 'colorize-switch', checked: activeObjectState.color.colorize },
					{ id: 'movement-simpel-speed-input', value: activeObjectState.movement.simpelSpeed },
					{ id: 'movement-simpel-strength-input', value: activeObjectState.movement.simpelStrength },
					{ id: 'movement-rotation-speed-input', value: activeObjectState.movement.rotationSpeed },
					{ id: 'movement-rotation-strength-input', value: activeObjectState.movement.rotationStrength },
					{ id: 'movement-position-speed-x-input', value: activeObjectState.movement.positionSpeed.x },
					{ id: 'movement-position-speed-y-input', value: activeObjectState.movement.positionSpeed.y },
					{ id: 'movement-position-strength-x-input', value: activeObjectState.movement.positionStrength.x },
					{ id: 'movement-position-strength-y-input', value: activeObjectState.movement.positionStrength.y },
					{ id: 'overlay-opacity-input', value: activeObjectState.paperFoldOverlay.opacity },
					{ id: 'overlay-speed-input', value: activeObjectState.paperFoldOverlay.speed },
					{ id: 'export-duration-input', value: state.export.duration },
					{ id: 'export-filename-input', value: state.export.filename }
				];

				inputsToUpdate.forEach(item => {
					const el = document.getElementById(item.id);
					const sliderEl = document.getElementById(item.id.replace('-input', ''));
					if (el) {
						if (el.type === 'checkbox') {
							el.checked = item.checked;
						} else if (item.value !== undefined) {
							el.value = item.value;
						}
					}
					if (sliderEl && sliderEl.type === 'range' && item.value !== undefined) {
						sliderEl.value = item.value;
					}
				});

				// Update FPS dropdown selection
				const fpsSelect = document.getElementById('export-fps-select');
				if (fpsSelect) {
					fpsSelect.value = state.export.fps;
				}

				document.querySelectorAll('.accordion-section').forEach(section => {
					const switchInput = section.querySelector('.accordion-header .switch input');
					if (!switchInput) return;
					let isEnabled;
					const sectionId = section.id;
					if (sectionId.includes('foreground-stroke')) isEnabled = activeObjectState.stroke.enabled;
					else if (sectionId.includes('foreground-shadow')) isEnabled = activeObjectState.shadow.enabled;
					else if (sectionId.includes('foreground-color')) isEnabled = activeObjectState.color.enabled;
					else if (sectionId.includes('movement')) isEnabled = activeObjectState.movement.enabled;
					else if (sectionId.includes('background-color-correction')) isEnabled = state.background.effects.colorCorrection.enabled;
					else if (sectionId.includes('background-blur')) isEnabled = state.background.effects.blur.enabled;
					else if (sectionId.includes('background-vignette')) isEnabled = state.background.effects.vignette.enabled;
					else if (sectionId.includes('paper-fold-overlay')) isEnabled = activeObjectState.paperFoldOverlay.enabled;
					if (typeof isEnabled !== 'undefined') switchInput.checked = isEnabled;
				});

				const isSimpelMode = activeObjectState.movement.mode === 'simpel';
				document.getElementById('movement-controls-simpel').classList.toggle('hidden', !isSimpelMode);
				document.getElementById('movement-controls-lengkap').classList.toggle('hidden', isSimpelMode);
				document.querySelectorAll('#movement-mode-btns button').forEach(btn => btn.classList.toggle('active', btn.dataset.mode === activeObjectState.movement.mode));

				document.getElementById('color-correction-standard-controls').classList.remove('hidden');
				document.getElementById('background-color-correction-standard-controls').classList.remove('hidden');

				syncBackgroundTransformModeUI();
				syncDisplayModeUI();
				syncUISizeUI();

				document.querySelectorAll('#language-btns button').forEach(button => {
					button.classList.toggle('active', button.dataset.lang === state.language);
				});

				document.querySelectorAll('.accordion-section').forEach(section => {
					const body = section.querySelector('.accordion-body');
					const isEnabledBySwitch = section.querySelector('.switch input')?.checked ?? true;
					let shouldBeOpenByDefault = false;
					if (section.id === 'background-transform-accordion' && !state.background.element) {
					} else if (section.id === 'background-transform-accordion' || (section.id === 'foreground-transform-accordion' && activeObjectState.image.element)) {
						shouldBeOpenByDefault = true;
					}
					const isOpen = isEnabledBySwitch || section.classList.contains('accordion-open');
					section.classList.toggle('accordion-open', isOpen);
					if (body) {
						body.classList.toggle('hidden', !isOpen);
					}
				});

				document.querySelectorAll('#preview-resolution-btns button').forEach(button => {
					button.classList.toggle('active', button.dataset.res === state.previewResolution);
				});
                const langLinks = translations[state.language];
                if (langLinks) {
                    const infoLinkEl = document.getElementById('info-link');
                    if (infoLinkEl && langLinks.infoLink) {
                        infoLinkEl.href = langLinks.infoLink;
                    }

                    const supportLinkEl = document.getElementById('support-link');
                    if (supportLinkEl && langLinks.supportLink) {
                        supportLinkEl.href = langLinks.supportLink;
                    }
                }
				document.getElementById('debug-screen-switch').checked = state.debugScreenEnabled;
				document.getElementById('debug-screen').classList.toggle('hidden', !state.debugScreenEnabled);
				showTab(state.activeTab);
				requestRedraw();
				renderKeyframeList();
				updateExportFormatUI(state.export.format);
			}

            // Updates the export modal UI based on the selected format
            function updateExportFormatUI(format) {
                const videoSettings = document.getElementById('video-settings');
                const pngSettings = document.getElementById('png-settings');
                const jpgSettings = document.getElementById('jpg-settings');
                const fileExtension = document.getElementById('file-extension');
                const exportFormatSelect = document.getElementById('export-format-select');
                
                // Update dropdown selection
                if (exportFormatSelect) {
                    exportFormatSelect.value = format;
                }
                
                // Show/hide settings based on format
                if (videoSettings) {
                    videoSettings.classList.toggle('hidden', format !== 'webm');
                }
                if (pngSettings) {
                    pngSettings.classList.toggle('hidden', format !== 'png');
                }
                if (jpgSettings) {
                    jpgSettings.classList.toggle('hidden', format !== 'jpg');
                }
                
                // Update file extension
                if (fileExtension) {
                    const extensions = { webm: '.webm', png: '.png', jpg: '.jpg' };
                    fileExtension.textContent = extensions[format] || '.webm';
                }
                
                // Update UI for JPG quality
                if (format === 'jpg') {
                    const qualitySlider = document.getElementById('jpg-quality-slider');
                    const qualityValue = document.getElementById('jpg-quality-value');
                    if (qualitySlider && qualityValue) {
                        qualitySlider.value = state.export.jpgQuality;
                        qualityValue.textContent = state.export.jpgQuality + '%';
                    }
                }
                
                // Update UI for PNG transparent background
                if (format === 'png') {
                    const transparentBgCheckbox = document.getElementById('transparent-background-checkbox');
                    if (transparentBgCheckbox) {
                        transparentBgCheckbox.checked = state.export.transparentBackground;
                    }
                }
            }

            // Updates the UI for the background transform controls based on the selected mode ('fill' or 'stretch')
            function syncBackgroundTransformModeUI() {
                const isDisabled = state.background.transform.mode === 'stretch';
                ['background-size-control', 'background-offset-x-control', 'background-offset-y-control'].forEach(id => {
                    const el = document.getElementById(id);
                    if(el) el.classList.toggle('is-disabled', isDisabled);
                });
                document.querySelectorAll('#background-mode-btns button').forEach(btn => btn.classList.toggle('active', btn.dataset.mode === state.background.transform.mode));
            }

            // Updates the body class and UI to reflect the current display mode ('auto', 'mobile', 'desktop')
            function syncDisplayModeUI() {
                document.querySelectorAll('#display-mode-btns button').forEach(button => {
                    button.classList.toggle('active', button.dataset.mode === state.displayMode);
                });
                const warningElement = document.getElementById('display-mode-warning');
                if (warningElement) {
                    warningElement.classList.toggle('hidden', state.displayMode === 'auto');
                }
                body.classList.remove('force-mobile', 'force-desktop');
                
                if (state.displayMode === 'mobile') {
                    body.classList.add('force-mobile');
                } else if (state.displayMode === 'desktop') {
                    body.classList.add('force-desktop');
                    if (userDesktopPanelWidth) {
                        body.style.setProperty('--panel-width', `${userDesktopPanelWidth}px`);
                    }
                }
                resizeAndRedrawAll();
            }
            
            // Updates the body data-attribute and UI buttons for the current UI size
            function syncUISizeUI() {
                body.dataset.uiSize = state.uiSize;
                document.querySelectorAll('#ui-size-btns button').forEach(button => {
                    button.classList.toggle('active', button.dataset.size === state.uiSize);
                });
            }
            
            // Applies a new UI size and redraws the interface
            function applyUISize(size) {
                state.uiSize = size;
                syncUISizeUI();
                resizeAndRedrawAll();
                savePreferences(); 
            }


            // Key to save data in localStorage
            const PREFERENCES_KEY = 'paperaMeUserPreferences';

            // Saves user preferences to localStorage
            function savePreferences() {
                try {
                    const prefsToSave = {
                        language: state.language,
                        uiSize: state.uiSize,
                        previewResolution: state.previewResolution,
                        accentColor: state.accentColor,
                        desktopPanelWidth: userDesktopPanelWidth,
                    };
                    localStorage.setItem(PREFERENCES_KEY, JSON.stringify(prefsToSave));
                } catch (e) {
                    console.error("Gagal menyimpan preferensi:", e);
                }
            }

            // Loads user preferences from localStorage when the application starts
            function loadPreferences() {
                try {
                    const savedPrefsString = localStorage.getItem(PREFERENCES_KEY);
                    if (savedPrefsString) {
                        const savedPrefs = JSON.parse(savedPrefsString);

                        // Apply saved preferences to state
                        state.language = savedPrefs.language || state.language;
                        state.uiSize = savedPrefs.uiSize || state.uiSize;
                        state.previewResolution = savedPrefs.previewResolution || state.previewResolution;
                        state.accentColor = savedPrefs.accentColor || state.accentColor;
                        userDesktopPanelWidth = savedPrefs.desktopPanelWidth || null;
                    }
                } catch (e) {
                    console.error("Failed to load preferences:", e);
                    localStorage.removeItem(PREFERENCES_KEY);
                }
            } 
                
            function resetPreferences() {
                localStorage.removeItem(PREFERENCES_KEY);
                
                userDesktopPanelWidth = null;
                body.style.removeProperty('--panel-width');

                panelWrapper.style.removeProperty('flex-basis');
                canvasContainer.style.removeProperty('flex-basis');

                const isCurrentlyMobile = !window.matchMedia('(min-width: 769px)').matches;
                const defaultLang = navigator.language.startsWith('id') ? 'id' : 'en';

                state.language = defaultLang;
                state.displayMode = 'auto';
                state.uiSize = isCurrentlyMobile ? 'compact' : 'normal';
                state.accentColor = DEFAULT_STATE.accentColor;
                
                const screenWidth = window.innerWidth;
                if (screenWidth <= 480) {
                    state.previewResolution = '360';
                } else if (screenWidth > 480 && screenWidth < 1440) {
                    state.previewResolution = '540';
                } else {
                    state.previewResolution = '720';
                }
                
                applyAccentColor(state.accentColor);
                syncDisplayModeUI();
                syncUISizeUI();
                updateUIText(state.language);
                updateUIFromState();
                autoAdjustMobileLayout();
            }

            // This logic ensures that the drop-zone display is also reset
            function resetMainSettings(deleteImages = false) {
                const currentPreferences = {
                    language: state.language,
                    displayMode: state.displayMode,
                    uiSize: state.uiSize
                };

                const currentBgImg = state.background.element;
                const currentBgFile = state.background.file;
                const currentObjectImg = state.object.image.element;
                const currentObjectFile = state.object.image.file;

                state = JSON.parse(JSON.stringify(DEFAULT_STATE));

                state.language = currentPreferences.language;
                state.displayMode = currentPreferences.displayMode;
                state.uiSize = currentPreferences.uiSize;

                if (!deleteImages) {
                    state.background.element = currentBgImg;
                    state.background.file = currentBgFile;
                    state.object.image.element = currentObjectImg;
                    state.object.image.file = currentObjectFile;
                }
                updateUIFromState();
                resizeAndRedrawAll();
            }
            
            function resetSectionSettings(sectionKey) {
                const defaultObjectState = DEFAULT_OBJECT_STATE;

                if (sectionKey === 'image' || ['stroke', 'shadow', 'color', 'movement', 'paperFoldOverlay'].includes(sectionKey)) {
                    if (sectionKey === 'image') {
                        state.object.image.size = defaultObjectState.image.size;
                        state.object.image.offset = JSON.parse(JSON.stringify(defaultObjectState.image.offset));
                        state.object.image.rotation = defaultObjectState.image.rotation;

                        const rotSlider = document.getElementById('image-rotation');
                        const rotInput = document.getElementById('image-rotation-input');
                        const rotLabel = document.getElementById('image-rotation-label');
                        
                        if (rotSlider) rotSlider.value = 0;
                        if (rotInput) rotInput.value = 0;
                        if (rotLabel) rotLabel.textContent = translations[state.language]?.rotation || 'Rotation';                        
                    } else {
                        state.object[sectionKey] = JSON.parse(JSON.stringify(defaultObjectState[sectionKey]));
                            if (sectionKey === 'stroke') {
                                isCacheGenerationNeeded = true;
                            }
                    }
                } else {
                    const keys = sectionKey.split('.');
                    let defaultSection = DEFAULT_STATE;
                    let currentSection = state;
                    for (let i = 0; i < keys.length - 1; i++) {
                        defaultSection = defaultSection[keys[i]];
                        currentSection = currentSection[keys[i]];
                    }
                    const finalKey = keys[keys.length - 1];
                    currentSection[finalKey] = JSON.parse(JSON.stringify(defaultSection[finalKey]));
                }

                updateUIFromState();
                requestRedraw();
            }

            function showTopNotification(messageKey, duration = 3000) {
                clearTimeout(notificationTimeout);
                topNotificationMessage.textContent = translations[state.language][messageKey] || messageKey;
                topNotificationPopup.classList.remove('hidden');
                setTimeout(() => topNotificationPopup.classList.add('show'), 10);
                notificationTimeout = setTimeout(() => {
                    topNotificationPopup.classList.remove('show');
                    setTimeout(() => topNotificationPopup.classList.add('hidden'), 300);
                }, duration);
            }

            // Shows a modal confirmation dialog
            function showConfirmationPopup(titleKey, messageKey, options = {}) {
                return new Promise(resolve => {
                    confirmationTitle.textContent = translations[state.language][titleKey] || titleKey;
                    confirmationMessage.textContent = translations[state.language][messageKey] || messageKey;

                    if (options.showDeleteImagesCheckbox) {
                        resetImagesOption.style.display = 'flex';
                        deleteImagesCheckbox.checked = false; 
                    } else {
                        resetImagesOption.style.display = 'none';
                    }

                    confirmationPopup.classList.remove('hidden');
                    
                    const handleConfirm = () => closeAndResolve(true);
                    const handleCancel = () => closeAndResolve(false);
                    
                    function closeAndResolve(isConfirmed) {
                        confirmationPopup.classList.add('hidden');
                        confirmContinueBtn.removeEventListener('click', handleConfirm);
                        confirmCancelBtn.removeEventListener('click', handleCancel);
                        const result = {
                            confirmed: isConfirmed,
                            deleteImages: options.showDeleteImagesCheckbox ? deleteImagesCheckbox.checked : false
                        };
                        resolve(result);
                    }

                    confirmContinueBtn.addEventListener('click', handleConfirm, { once: true });
                    confirmCancelBtn.addEventListener('click', handleCancel, { once: true });
                });
            }

            // Starts the video export process using CCapture.js (loaded lazily)
            async function startExport() {
                // Load export module if not already loaded
                if (!window.startVideoExport) {
                    try {
                        await new Promise((resolve, reject) => {
                            const script = document.createElement('script');
                            script.src = './assets/export-module.js';
                            script.onload = resolve;
                            script.onerror = () => reject(new Error('Failed to load export module'));
                            document.head.appendChild(script);
                        });
                    } catch (error) {
                        console.error('Failed to load export module:', error);
                        showTopNotification("exportError");
                        return;
                    }
                }

                // Call the actual export function from the module
                await window.startVideoExport(
                    state, 
                    translations, 
                    canvas, 
                    ctx, 
                    draw, 
                    updateMovement, 
                    updatePaperFoldOverlay, 
                    animationFrameId, 
                    requestAnimationFrame, 
                    showTopNotification, 
                    generateTornEdgeCache, 
                    resizeAndRedrawAll, 
                    DEFAULT_OBJECT_STATE,
                    RESOLUTION_MAPS,
                    objectCanvas,
                    contentCanvas,
                    finalObjectCanvas,
                    isCacheGenerationNeeded,
                    needsRedraw,
                    animationLoop,
                    isExporting,
                    drawFinalObject,
                    getAdvancedTransform,
                    getVisualStateAtTime,
                    layerImages,
                    maskImages,
                    hexToRgba,
                    timingRef
                );
            }

            // Shows the content for a specific tab and updates the active state of tab buttons
            const tabScrollPositions = {};
            const controlsPanel = document.querySelector('.controls-panel');            
            function showTab(tabName) {
                const currentActiveTab = state.activeTab;
                if (controlsPanel) {
                    tabScrollPositions[currentActiveTab] = controlsPanel.scrollTop;
                }

                // Only reset previewTime if animation is playing
                if (state.object.animation.isPlaying) {
                    state.object.animation.previewTime = null;
                }
                const lang = state.language;
                const tabTitles = {
                    background: translations[lang].tabTitleBackground,
                    object: translations[lang].tabTitleObject,
                    animasi: translations[lang].tabTitleAnimasi,
                    info: translations[lang].tabTitleInfo
                };
                
                const titleText = tabTitles[tabName] || translations[lang].settings;
                document.getElementById('panel-title').textContent = titleText;
                document.getElementById('mobile-panel-header').textContent = titleText.toUpperCase();

                document.querySelectorAll('.tab-content').forEach(content => content.classList.add('hidden'));
                document.querySelectorAll('.tab-handle').forEach(handle => handle.classList.remove('active'));
                document.querySelectorAll('.mobile-tab-btn').forEach(handle => handle.classList.remove('active'));
                
                const newTabContent = document.getElementById(`${tabName}-tab-content`);
                if (newTabContent) {
                    newTabContent.classList.remove('hidden');
                }
                
                document.getElementById(`handle-${tabName}`)?.classList.add('active');
                document.querySelector(`.mobile-tab-btn[data-tab="${tabName}"]`)?.classList.add('active');
                state.activeTab = tabName;

                if (controlsPanel) {
                    controlsPanel.scrollTop = tabScrollPositions[tabName] || 0;
                }
            }

            let smoothResizeRafId = null;
            function animateCanvasResize(duration = 310) {
                if (smoothResizeRafId) {
                    cancelAnimationFrame(smoothResizeRafId);
                }

                const startTime = performance.now();

                function loop(currentTime) {
                    const elapsedTime = currentTime - startTime;

                    if (elapsedTime < duration) {
                        updateCanvasDisplaySize();
                        smoothResizeRafId = requestAnimationFrame(loop);
                    } else {
                        updateCanvasDisplaySize();
                        cancelAnimationFrame(smoothResizeRafId);
                        smoothResizeRafId = null;
                    }
                }

                smoothResizeRafId = requestAnimationFrame(loop);
            }


            // Toggles the settings panel open or closed, managing browser history for back button support
            function togglePanel() {
                const isOpen = panelWrapper.classList.contains('panel-open');
                if (isOpen) {
                    if (history.state && history.state.panel === 'open') {
                        history.back();
                    } else {
                        panelWrapper.classList.remove('panel-open');
                        body.classList.remove('desktop-panel-open');
                    }
                } else {
                    history.pushState({ panel: 'open' }, 'Panel Open');
                    panelWrapper.classList.add('panel-open');
                    body.classList.add('desktop-panel-open');
                }
                animateCanvasResize();
            }

            function syncDurationInputs(newValue) {
                const newDuration = Math.max(1, parseFloat(newValue) || 1);
                state.export.duration = newDuration;

                const exportInput = document.getElementById('export-duration-input');
                const timelineInput = document.getElementById('timeline-duration-input');
                if (exportInput) exportInput.value = newDuration.toFixed(1);
                if (timelineInput) timelineInput.value = newDuration.toFixed(1);

                const timelineSlider = document.getElementById('timeline-slider');
                if (timelineSlider) {
                    timelineSlider.max = newDuration;
                    if (parseFloat(timelineSlider.value) > newDuration) {
                        timelineSlider.value = newDuration;
                    }
                }
                requestRedraw();
                renderKeyframeMarkers();
                renderSimpleAnimationMarkers();
            }

            function updatePlayPauseButton() {
                const isPlaying = state.object.animation.isPlaying;
                document.getElementById('play-icon').classList.toggle('hidden', isPlaying);
                document.getElementById('pause-icon').classList.toggle('hidden', !isPlaying);
            }

            function checkAndExtendDuration(keyframeTime) {
                if (keyframeTime > state.export.duration) {
                    const newDuration = Math.ceil(keyframeTime * 2) / 2;
                    syncDurationInputs(newDuration);
                }
            }           

            function autoAdjustMobileLayout() {
                const isMobile = body.classList.contains('force-mobile') || (!body.classList.contains('force-desktop') && window.matchMedia('(max-width: 768px)').matches);
                if (!isMobile) {
                    return;
                }
                const canvasContainer = document.getElementById('canvas-container');
                const panelWrapper = document.getElementById('settings-panel-wrapper');
                const mobileFooter = document.getElementById('mobile-footer');
                if (!canvasContainer || !panelWrapper || !mobileFooter) return;

                // Dimension calculations
                const containerWidth = canvasContainer.offsetWidth;
                const containerStyle = window.getComputedStyle(canvasContainer);
                const paddingX = parseFloat(containerStyle.paddingLeft) + parseFloat(containerStyle.paddingRight);
                const paddingY = parseFloat(containerStyle.paddingTop) + parseFloat(containerStyle.paddingBottom);
                const canvasContentWidth = containerWidth - paddingX;
                const [aspectW, aspectH] = state.aspectRatio.split('/').map(Number);
                const requiredCanvasContentHeight = canvasContentWidth / (aspectW / aspectH);
                const requiredContainerHeight = requiredCanvasContentHeight + paddingY;
                const totalLayoutHeight = window.innerHeight - mobileFooter.offsetHeight;
                
                const canvasHeightPercentage = (requiredContainerHeight / totalLayoutHeight) * 100;

                const finalCanvasPercentage = Math.min(canvasHeightPercentage, 50);

                // Animation Logic
                const transitionStyle = 'flex-basis 0.5s ease-in-out';
                canvasContainer.style.transition = transitionStyle;
                panelWrapper.style.transition = transitionStyle;

                canvasContainer.style.flexBasis = `${finalCanvasPercentage}%`;
                panelWrapper.style.flexBasis = `${100 - finalCanvasPercentage}%`;

                // Remove transition style after animation completes
                setTimeout(() => {
                    canvasContainer.style.transition = '';
                    panelWrapper.style.transition = '';
                    resizeAndRedrawAll();
                }, 500);
            }

            function setInstallButtonToInstalled() {
                const installButton = document.getElementById('pwa-install-button');
                if (installButton) {
                    installButton.style.display = 'flex';

                    installButton.disabled = true;
                    installButton.classList.add('is-disabled');

                    const buttonTextSpan = installButton.querySelector('span');
                    if (buttonTextSpan) {
                        buttonTextSpan.textContent = translations[state.language].appInstalled || 'Installed';
                    }
                }
            }
            let userDesktopPanelWidth = null;
            function desktopPanelResizer() {
                const resizer = document.getElementById('desktop-resizer');
                const panelWrapper = document.getElementById('settings-panel-wrapper');
                const canvasContainer = document.getElementById('canvas-container');
                const body = document.body;

                if (!resizer || !panelWrapper || !canvasContainer) return;

                if(userDesktopPanelWidth) {
                    body.style.setProperty('--panel-width', `${userDesktopPanelWidth}px`);
                }

                const handleMove = (e) => {
                    const currentX = e.touches ? e.touches[0].clientX : e.clientX;
                    const viewportWidth = window.innerWidth;
                    const newPanelWidth = viewportWidth - currentX;
                    const minWidth = viewportWidth * 0.20;
                    const maxWidth = viewportWidth * 0.50;

                    if (newPanelWidth >= minWidth && newPanelWidth <= maxWidth) {
                        userDesktopPanelWidth = newPanelWidth;
                        body.style.setProperty('--panel-width', `${userDesktopPanelWidth}px`);
                        updateCanvasDisplaySize();
                        requestRedraw();
                    }
                };

                const handleMouseUp = () => {
                    body.classList.remove('is-resizing');
                    document.removeEventListener('mousemove', handleMove);
                    document.removeEventListener('mouseup', handleMouseUp);
                    document.removeEventListener('touchmove', handleMove);
                    document.removeEventListener('touchend', handleMouseUp);
                    canvasContainer.style.transition = 'width 0.3s ease-out';
                    panelWrapper.style.transition = 'transform 0.3s ease-in-out';
                    savePreferences();
                };

                const handleMouseDown = (e) => {
                    e.preventDefault();
                    body.classList.add('is-resizing');
                    panelWrapper.style.transition = 'none';
                    canvasContainer.style.transition = 'none';
                    document.addEventListener('mousemove', handleMove);
                    document.addEventListener('mouseup', handleMouseUp);
                };
                
                resizer.addEventListener('mousedown', handleMouseDown);
                
                resizer.addEventListener('touchstart', (e) => {
                    handleMouseDown(e); 
                    document.addEventListener('touchmove', handleMove, { passive: false });
                    document.addEventListener('touchend', handleMouseUp);
                }, { passive: false });
            }      
            
            // PWA and Service Worker will be loaded lazily
            function loadPWAModule() {
                if (!window.paperimaPWA) {
                    const script = document.createElement('script');
                    script.src = './assets/pwa-module.js';
                    script.async = true;
                    document.head.appendChild(script);
                }
            }

            //Initializes the application, sets up event listeners, and starts the animation loop.
            function init() {
                loadPreferences();

                // Set initial language based on browser setting
                if (!localStorage.getItem(PREFERENCES_KEY)) {
                    if (navigator.language.startsWith('id')) {
                        state.language = 'id';
                    }
                    
                    // Set initial UI size and display mode
                    state.displayMode = 'auto';
                    state.uiSize = window.innerWidth < 1280 ? 'compact' : 'normal';

                    const screenWidth = window.innerWidth;
                    if (screenWidth <= 480) {
                        state.previewResolution = '360';
                    } else if (screenWidth > 480 && screenWidth < 1440) {
                        state.previewResolution = '540';
                    } else {
                        state.previewResolution = '720';
                    }
                }
                
                // Initialize animation timing
                animationStartTime = performance.now();
                pauseStartTime = 0;
                
                resizeAndRedrawAll();
                animationFrameId = requestAnimationFrame(animationLoop);
                requestAnimationFrame(fpsLoop);

                const bgTransformAccordion = document.getElementById('background-transform-accordion');
                bgTransformAccordion.classList.add('accordion-open');
                bgTransformAccordion.querySelector('.accordion-body').classList.remove('hidden');
                // Load overlay images from URLs
                let loadedOriginalOverlays = 0;
                const totalOverlays = overlayImageUrls.length;
                overlayImageUrls.forEach((url, index) => {
                    const img = new Image();
                    img.onload = () => {
                        originalOverlayImages[index] = img;
                        loadedOriginalOverlays++;
                        if (loadedOriginalOverlays === totalOverlays) {
                            updateUIFromState();
                            requestRedraw();
                        }
                    };
                    img.onerror = () => { console.error(`Failed to load overlay image from URL: ${url}`); };
                    img.src = url;
                });

                function loadImageAsset(url, targetArray, index) {
                    const img = new Image();
                    img.onload = () => {
                        targetArray[index] = img;
                    };
                    img.onerror = () => console.error(`Gagal memuat aset: ${url}`);
                    img.src = url;
                }

                MASK_IMAGE_URLS.forEach((url, index) => loadImageAsset(url, maskImages, index));
                LAYER_IMAGE_URLS.forEach((url, index) => loadImageAsset(url, layerImages, index));
                // EVENT LISTENERS
                window.addEventListener('resize', () => {
                    if (state.displayMode === 'auto') {
                        const newSize = window.innerWidth < 1280 ? 'compact' : 'normal';
                        if (newSize !== state.uiSize) {
                            applyUISize(newSize);
                        }
                    }
                    resizeAndRedrawAll();
                });

                document.getElementById('preview-resolution-btns').addEventListener('click', (e) => {
                    const button = e.target.closest('button');
                    if (button && button.dataset.res) {
                        state.previewResolution = button.dataset.res;
                        updateUIFromState();
                        resizeAndRedrawAll();
                        savePreferences();
                    }
                });

                document.getElementById('debug-screen-switch').addEventListener('change', (e) => {
                    state.debugScreenEnabled = e.target.checked;
                    updateUIFromState();
                });
                panelHandle.addEventListener('click', togglePanel);
                document.getElementById('mobile-export-btn').addEventListener('click', () => {
                    document.getElementById('export-settings-popup').classList.remove('hidden');
                    updateUIFromState();
                });
                window.addEventListener('popstate', (event) => {
                    if (!event.state || event.state.panel !== 'open') {
                        panelWrapper.classList.remove('panel-open');
                        body.classList.remove('desktop-panel-open');
                        animateCanvasResize();
                    }
                });
                ['handle-background', 'handle-object', 'handle-animasi', 'handle-info'].forEach(id => {
                    document.getElementById(id).addEventListener('click', (e) => showTab(id.split('-')[1]));
                });
                document.querySelectorAll('.mobile-tab-btn').forEach(btn => {
                    btn.addEventListener('click', () => {
                        showTab(btn.dataset.tab);
                    });
                });

                document.querySelectorAll('.reset-all-btn').forEach(button => {
                    button.addEventListener('click', async () => {
                        const { confirmed, deleteImages } = await showConfirmationPopup(
                            "confirmResetTitle", 
                            "confirmResetMessage",
                            { showDeleteImagesCheckbox: true }
                        );
                        if (confirmed) {
                            resetMainSettings(deleteImages);
                        }
                    });
                });

                document.getElementById('reset-preferences-btn').addEventListener('click', async () => {
                    const { confirmed } = await showConfirmationPopup(
                        "confirmResetPrefsTitle", 
                        "confirmResetPrefsMessage"
                    );
                    if (confirmed) {
                        resetPreferences();
                    }
                });

                document.getElementById('export-video-btn-header').addEventListener('click', () => {
                    document.getElementById('export-settings-popup').classList.remove('hidden');
                    updateUIFromState();
                });
                document.getElementById('cancel-export-settings-btn').addEventListener('click', () => document.getElementById('export-settings-popup').classList.add('hidden'));
                document.getElementById('start-export-with-settings-btn').addEventListener('click', startExport);
                
                // License popup handlers
                document.getElementById('license-btn').addEventListener('click', () => {
                    document.getElementById('license-popup').classList.remove('hidden');
                });
                document.getElementById('close-license-popup').addEventListener('click', () => {
                    document.getElementById('license-popup').classList.add('hidden');
                });
                // Close license popup when clicking outside
                document.getElementById('license-popup').addEventListener('click', (e) => {
                    if (e.target === e.currentTarget) {
                        document.getElementById('license-popup').classList.add('hidden');
                    }
                });
                
                document.getElementById('export-fps-select').addEventListener('change', (e) => {
                    state.export.fps = parseInt(e.target.value);
                });
                document.getElementById('export-duration-input').addEventListener('change', (e) => {
                    const val = parseInt(e.target.value, 10);
                    const min = parseInt(e.target.min, 10);
                    const max = parseInt(e.target.max, 10);
                    state.export.duration = Math.max(min, Math.min(max, val || 1));
                    e.target.value = state.export.duration;
                });
                document.getElementById('export-filename-input').addEventListener('input', (e) => {
                    state.export.filename = e.target.value.trim();
                });
                
                // Export format dropdown handler
                document.getElementById('export-format-select').addEventListener('change', (e) => {
                    const format = e.target.value;
                    state.export.format = format;
                    updateExportFormatUI(format);
                });
                
                // JPG quality slider handler
                document.getElementById('jpg-quality-slider').addEventListener('input', (e) => {
                    const quality = parseInt(e.target.value);
                    state.export.jpgQuality = quality;
                    document.getElementById('jpg-quality-value').textContent = quality + '%';
                });
                
                // Transparent background checkbox handler
                document.getElementById('transparent-background-checkbox').addEventListener('change', (e) => {
                    state.export.transparentBackground = e.target.checked;
                });

                // Setup drag and drop zones
                const setupDropZone = (zoneId, inputId, target) => {
                    const dropZone = document.getElementById(zoneId);
                    const input = document.getElementById(inputId);
                    if(!dropZone || !input) return;
                    input.addEventListener('change', (e) => handleImageFile(e.target.files[0], target));
                    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
                        dropZone.addEventListener(eventName, (e) => { e.preventDefault(); e.stopPropagation(); });
                        document.body.addEventListener(eventName, (e) => { e.preventDefault(); e.stopPropagation(); });
                    });
                    ['dragenter', 'dragover'].forEach(eventName => dropZone.addEventListener(eventName, () => dropZone.classList.add('drag-over')));
                    ['dragleave', 'drop'].forEach(eventName => dropZone.addEventListener(eventName, () => dropZone.classList.remove('drag-over')));
                    dropZone.addEventListener('drop', (e) => {
                        handleImageFile(e.dataTransfer.files[0], target);
                        input.files = e.dataTransfer.files; 
                    });
                };
                setupDropZone('drop-zone', 'image-upload', 'foreground');
                setupDropZone('background-drop-zone', 'background-image-upload', 'background');
				document.getElementById('delete-image-btn').addEventListener('click', (e) => { 
					e.stopPropagation(); 
					state.object.image.element = null; 
					state.object.image.file = null; 
					document.getElementById('image-upload').value = ''; 
					updateUIFromState(); 
					requestRedraw();
				});
                document.getElementById('remove-background-image').addEventListener('click', (e) => { e.stopPropagation(); state.background.element = null; state.background.file = null; document.getElementById('background-image-upload').value = ''; updateUIFromState(); });
                
                // Accordion logic
                document.querySelectorAll('.accordion-header').forEach(header => {
                    header.addEventListener('click', (e) => {
                        if (e.target.closest('.switch') || e.target.closest('.reset-section-btn')) return;
                        
                        const section = header.parentElement;
                        
                        if (section.classList.contains('controls-disabled-for-bg') && !section.id.includes('color-correction') && !section.id.includes('vignette')) {
                            e.stopPropagation();
                            return;
                        }

                        if (section.closest('#image-specific-controls')?.classList.contains('is-disabled')) {
                             e.stopPropagation();
                             return;
                        }

                        section.classList.toggle('accordion-open');
                        const body = section.querySelector('.accordion-body');
                        if (body) body.classList.toggle('hidden', !section.classList.contains('accordion-open'));
                    });
                });
                
                document.querySelectorAll('.info-tooltip-trigger').forEach(trigger => {
                    trigger.addEventListener('click', (e) => {
                        e.stopPropagation();
                    });
                });

                // Effect enable/disable switches
                const effectSwitches = [
                    { switchId: 'background-color-correction-enabled-switch', stateKey: 'background.effects.colorCorrection' },
                    { switchId: 'background-blur-enabled-switch', stateKey: 'background.effects.blur' },
                    { switchId: 'background-vignette-enabled-switch', stateKey: 'background.effects.vignette' },
                    { switchId: 'stroke-enabled-switch', stateKey: 'stroke' },
                    { switchId: 'shadow-enabled-switch', stateKey: 'shadow' },
                    { switchId: 'color-enabled-switch', stateKey: 'color' },
                    { switchId: 'movement-enabled-switch', stateKey: 'movement' },
                    { switchId: 'paper-fold-overlay-enabled-switch', stateKey: 'paperFoldOverlay' },
                ];
                
                effectSwitches.forEach(({ switchId, stateKey }) => {
                    const switchEl = document.getElementById(switchId);
                    if (switchEl) {
                        switchEl.addEventListener('change', (e) => {
                            const isObjectProperty = ['stroke', 'shadow', 'color', 'movement', 'paperFoldOverlay'].includes(stateKey);
                            
                            let sectionState;
                            if (isObjectProperty) {
                                sectionState = state.object;
                                sectionState[stateKey].enabled = e.target.checked;
                            } else {
                                const keys = stateKey.split('.');
                                sectionState = state;
                                for (let i = 0; i < keys.length - 1; i++) {
                                    sectionState = sectionState[keys[i]];
                                }
                                sectionState[keys[keys.length - 1]].enabled = e.target.checked;
                            }

                            const section = switchEl.closest('.accordion-section');
                            const body = section.querySelector('.accordion-body');
                            
                            if (e.target.checked) {
                                section.classList.add('accordion-open');
                                if (body) body.classList.remove('hidden');
                            } else {
                                section.classList.remove('accordion-open');
                                if (body) body.classList.add('hidden');
                            }
                            updateUIFromState(); 
                            requestRedraw();
                        });
                    }
                });

                // Reset section buttons
                document.querySelectorAll('.reset-section-btn').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const sectionKey = btn.dataset.sectionKey;
                        resetSectionSettings(sectionKey);
                    });
                });
                
                // BIND OBJECT CONTROLS
                const getActiveObject = () => state.object;

                syncSliderAndInput('image-size', 'image-size-input', (val) => getActiveObject().image.size = val);
                syncSliderAndInput('image-offset-x', 'image-offset-x-input', (val) => getActiveObject().image.offset.x = val);
                syncSliderAndInput('image-offset-y', 'image-offset-y-input', (val) => getActiveObject().image.offset.y = val);
                initContinuousSlider(
                    document.getElementById('image-rotation'),
                    document.getElementById('image-rotation-input'),
                    document.getElementById('image-rotation-label'),
                    () => getActiveObject().image.rotation,
                    (val) => { getActiveObject().image.rotation = val; }
                );

                const setupTornEdgeSlider = (sliderId, inputId, stateUpdater, isDetail = false) => {
                    const slider = document.getElementById(sliderId);
                    const input = document.getElementById(inputId);
                    if (!slider || !input) return;

                    let cacheDebounceTimeout;
                    let finalDebounceTimeout;

                    const startAdjusting = () => {
                        if (!state.object.image.element) return;
                        if (!isAdjustingTornEdge) {
                            isAdjustingTornEdge = true;
                            originalOverlaySpeed = getActiveObject().paperFoldOverlay.speed;
                            getActiveObject().paperFoldOverlay.speed = 0;
                        }
                        isLiveTornEdgePreview = true;
                    };

                    const stopAdjustingAndFinalize = () => {
                        if (!isAdjustingTornEdge) return;
                        isAdjustingTornEdge = false;
                        isLiveTornEdgePreview = false;
                        getActiveObject().paperFoldOverlay.speed = originalOverlaySpeed;
                        requestRedraw();
                        console.log("1000ms: Adjustment completed, animation continues, cache displayed.");
                    };

                    slider.addEventListener('input', (e) => {
                        startAdjusting();

                        const numericValue = parseFloat(e.target.value) || 0;
                        input.value = numericValue;
                        stateUpdater(isDetail ? numericValue / 1000 : numericValue);
                        requestRedraw();

                        clearTimeout(cacheDebounceTimeout);
                        clearTimeout(finalDebounceTimeout);
                        cacheDebounceTimeout = setTimeout(generateTornEdgeCache, 500);
                        finalDebounceTimeout = setTimeout(stopAdjustingAndFinalize, 1000);
                    });

                    input.addEventListener('change', (e) => {
                        clearTimeout(cacheDebounceTimeout);
                        clearTimeout(finalDebounceTimeout);

                        const finalValue = parseFloat(e.target.value) || 0;
                        slider.value = finalValue;
                        stateUpdater(isDetail ? finalValue / 1000 : finalValue);

                        startAdjusting();
                        generateTornEdgeCache().then(() => {
                            stopAdjustingAndFinalize();
                        });
                    });
                };

				setupTornEdgeSlider('stroke-width', 'stroke-width-input', (val) => getActiveObject().stroke.width = val);
				setupTornEdgeSlider('stroke-roughness', 'stroke-roughness-input', (val) => getActiveObject().stroke.roughness = val);
				setupTornEdgeSlider('stroke-detail', 'stroke-detail-input', (val) => getActiveObject().stroke.detail = val, true);

                syncSliderAndInput('shadow-blur', 'shadow-blur-input', (val) => getActiveObject().shadow.blur = val);
                syncSliderAndInput('shadow-opacity', 'shadow-opacity-input', (val) => getActiveObject().shadow.opacity = val);
                syncInputOnly('shadow-offset-x-input', (val) => getActiveObject().shadow.offsetX = val);
                syncInputOnly('shadow-offset-y-input', (val) => getActiveObject().shadow.offsetY = val);
                document.getElementById('shadow-color').addEventListener('input', (e) => { getActiveObject().shadow.color = e.target.value; requestRedraw(); });
                syncSliderAndInput('color-hue', 'color-hue-input', (val) => getActiveObject().color.hue = val);
                syncSliderAndInput('color-saturation', 'color-saturation-input', (val) => getActiveObject().color.saturation = val);
                syncSliderAndInput('color-brightness', 'color-brightness-input', (val) => getActiveObject().color.brightness = val);
                document.getElementById('colorize-switch').addEventListener('change', (e) => { getActiveObject().color.colorize = e.target.checked; updateUIFromState(); });
                
                document.getElementById('movement-mode-btns').addEventListener('click', (e) => {
                    const button = e.target.closest('button');
                    if (button) { getActiveObject().movement.mode = button.dataset.mode; updateUIFromState(); }
                });
                syncSliderAndInput('movement-simpel-speed', 'movement-simpel-speed-input', (val) => getActiveObject().movement.simpelSpeed = val);
                syncSliderAndInput('movement-simpel-strength', 'movement-simpel-strength-input', (val) => getActiveObject().movement.simpelStrength = val);
                syncSliderAndInput('movement-rotation-speed', 'movement-rotation-speed-input', (val) => getActiveObject().movement.rotationSpeed = val);
                syncSliderAndInput('movement-rotation-strength', 'movement-rotation-strength-input', (val) => getActiveObject().movement.rotationStrength = val);
                syncSliderAndInput('movement-position-speed-x', 'movement-position-speed-x-input', (val) => getActiveObject().movement.positionSpeed.x = val);
                syncSliderAndInput('movement-position-speed-y', 'movement-position-speed-y-input', (val) => getActiveObject().movement.positionSpeed.y = val);
                syncSliderAndInput('movement-position-strength-x', 'movement-position-strength-x-input', (val) => getActiveObject().movement.positionStrength.x = val);
                syncSliderAndInput('movement-position-strength-y', 'movement-position-strength-y-input', (val) => getActiveObject().movement.positionStrength.y = val);

                syncSliderAndInput('overlay-opacity', 'overlay-opacity-input', (val) => { getActiveObject().paperFoldOverlay.opacity = val; });
                syncSliderAndInput('overlay-speed', 'overlay-speed-input', (val) => getActiveObject().paperFoldOverlay.speed = val); 
                
                // BIND GLOBAL CONTROLS
                document.getElementById('aspect-ratio-btns').addEventListener('click', (e) => {
                    const button = e.target.closest('button');
                    if (button) { state.aspectRatio = button.dataset.ratio; resizeAndRedrawAll(); updateUIFromState(); }
                });
                document.getElementById('canvas-resolution-btns').addEventListener('click', (e) => {
                    const button = e.target.closest('button');
                    if (button) {
                        state.canvasDisplayResolution = parseInt(button.dataset.res);
                        updateUIFromState();
                    }
                });
                document.getElementById('background-color').addEventListener('input', (e) => { state.background.color = e.target.value; requestRedraw(); });
                document.getElementById('background-mode-btns').addEventListener('click', (e) => {
                    const button = e.target.closest('button');
                    if (button) { state.background.transform.mode = button.dataset.mode; syncBackgroundTransformModeUI(); requestRedraw(); }
                });
                syncSliderAndInput('background-size', 'background-size-input', (val) => state.background.transform.size = val);
                syncSliderAndInput('background-offset-x', 'background-offset-x-input', (val) => state.background.transform.offset.x = val);
                syncSliderAndInput('background-offset-y', 'background-offset-y-input', (val) => state.background.transform.offset.y = val);
                initContinuousSlider(
                    document.getElementById('background-rotation'),
                    document.getElementById('background-rotation-input'),
                    document.getElementById('background-rotation-label'),
                    () => state.background.transform.rotation,
                    (val) => { state.background.transform.rotation = val; }
                );

                syncSliderAndInput('background-color-hue', 'background-color-hue-input', (val) => state.background.effects.colorCorrection.hue = val);
                syncSliderAndInput('background-color-saturation', 'background-color-saturation-input', (val) => state.background.effects.colorCorrection.saturation = val);
                syncSliderAndInput('background-color-brightness', 'background-color-brightness-input', (val) => state.background.effects.colorCorrection.brightness = val);
                document.getElementById('background-colorize-switch').addEventListener('change', (e) => { state.background.effects.colorCorrection.colorize = e.target.checked; updateUIFromState(); });
                syncSliderAndInput('background-blur-intensity', 'background-blur-intensity-input', (val) => state.background.effects.blur.intensity = val);
                syncSliderAndInput('background-vignette-opacity', 'background-vignette-opacity-input', (val) => state.background.effects.vignette.opacity = val);
                syncSliderAndInput('background-vignette-radius', 'background-vignette-radius-input', (val) => state.background.effects.vignette.radius = val);
                syncSliderAndInput('background-vignette-feather', 'background-vignette-feather-input', (val) => state.background.effects.vignette.feather = val);
                document.getElementById('background-vignette-color').addEventListener('input', (e) => { state.background.effects.vignette.color = e.target.value; requestRedraw(); });
                
                document.getElementById('display-mode-btns').addEventListener('click', (e) => {
                    const button = e.target.closest('button');
                    if (button) {
                        state.displayMode = button.dataset.mode;
                        if(state.displayMode === 'mobile') { applyUISize('compact'); } 
                        else if(state.displayMode === 'desktop') { applyUISize('normal'); }
                        syncDisplayModeUI();
                    }
                });

                document.getElementById('ui-size-btns').addEventListener('click', (e) => {
                    const button = e.target.closest('button');
                    if (button && button.dataset.size) { applyUISize(button.dataset.size); }
                });

                document.getElementById('language-btns').addEventListener('click', (e) => {
                    const button = e.target.closest('button');
                    if (button && button.dataset.lang) {
                        state.language = button.dataset.lang;
                        updateUIFromState();
                        savePreferences();
                    }
                });

                topNotificationCloseBtn.addEventListener('click', () => {
                    topNotificationPopup.classList.remove('show');
                    clearTimeout(notificationTimeout);
                    setTimeout(() => topNotificationPopup.classList.add('hidden'), 300);
                });

                const accentPicker = document.getElementById('accent-color-picker');
                if (accentPicker) {
                    accentPicker.addEventListener('input', (e) => {
                        const newColor = e.target.value;
                        state.accentColor = newColor;
                        applyAccentColor(newColor);
                        savePreferences();
                    });
                }

                // Mobile panel resizer logic
				let dragOffset = 0;

				const resizerMove = (e) => {
					e.preventDefault();
					const clientY = e.touches ? e.touches[0].clientY : e.clientY;
					const totalHeight = window.innerHeight;
					const footerHeight = document.getElementById('mobile-footer').offsetHeight;
					const minHeight = totalHeight * 0.20;

					let canvasHeight = clientY - dragOffset;

					canvasHeight = Math.max(minHeight, canvasHeight);
					canvasHeight = Math.min(totalHeight - minHeight - footerHeight, canvasHeight);

					const panelHeight = totalHeight - canvasHeight;

					canvasContainer.style.flexBasis = `${canvasHeight}px`;
					panelWrapper.style.flexBasis = `${panelHeight}px`;

					requestAnimationFrame(updateCanvasDisplaySize);
				};

				const resizerStop = () => {
					document.removeEventListener('mousemove', resizerMove);
					document.removeEventListener('touchmove', resizerMove);
					document.removeEventListener('mouseup', resizerStop);
					document.removeEventListener('touchend', resizerStop);
					body.style.userSelect = '';
					resizeAndRedrawAll();
                    savePreferences();
				};

				const resizerStart = (e) => {
					const clientY = e.touches ? e.touches[0].clientY : e.clientY;

					dragOffset = clientY - mobilePanelHeader.getBoundingClientRect().top;

					body.style.userSelect = 'none';
					document.addEventListener('mousemove', resizerMove);
					document.addEventListener('mouseup', resizerStop);
					document.addEventListener('touchmove', resizerMove, { passive: false });
					document.addEventListener('touchend', resizerStop);
				};

				mobilePanelHeader.addEventListener('mousedown', resizerStart);
				mobilePanelHeader.addEventListener('touchstart', resizerStart, { passive: false });

                document.getElementById('animation-mode-btns').addEventListener('click', (e) => {
                    const button = e.target.closest('button');
                    if (button) {
                        state.object.animation.mode = button.dataset.mode;
                        // Only reset previewTime if animation is playing
                        if (state.object.animation.isPlaying) {
                            state.object.animation.previewTime = null;
                        }
                        updateUIFromState();
                        renderKeyframeMarkers();
                        renderSimpleAnimationMarkers();
                        requestRedraw();
                    }
                });

                // Event listener untuk switch di mode simpel
                document.getElementById('simple-anim-open-switch').addEventListener('change', (e) => {
                    state.object.animation.simple.open = e.target.checked;
                    renderSimpleAnimationMarkers();
                    requestRedraw();
                });

                document.getElementById('simple-anim-close-switch').addEventListener('change', (e) => {
                    state.object.animation.simple.close = e.target.checked;
                    renderSimpleAnimationMarkers();
                    requestRedraw();
                });
                             
                document.getElementById('add-keyframe-btn').addEventListener('click', () => {
                    const keyframes = state.object.animation.keyframes;
                    const sortedKeyframes = [...keyframes].sort((a, b) => a.time - b.time);
                    const lastKeyframe = sortedKeyframes.length > 0 ? sortedKeyframes[sortedKeyframes.length - 1] : DEFAULT_OBJECT_STATE.animation.keyframes[0];

                    const newKeyframe = {
                        ...JSON.parse(JSON.stringify(lastKeyframe)),
                        id: Date.now(),
                        time: Math.round((lastKeyframe.time + 1) * 10) / 10,
                        easing: 'linear',
                        paperAnim: 'none'
                    };

                    if (typeof newKeyframe.rotation !== 'number') {
                        newKeyframe.rotation = 0;
                    }

                    keyframes.push(newKeyframe);
                    state.object.animation.activeKeyframeId = newKeyframe.id;
                    checkAndExtendDuration(newKeyframe.time);
                    renderKeyframeList();
                    requestRedraw();
                });

                document.getElementById('keyframe-list').addEventListener('click', (e) => {
					if (e.target.classList.contains('keyframe-time-input')) return;

					const item = e.target.closest('.keyframe-item');
					if (!item) return;

                    const id = Number(item.dataset.keyframeId);

                    if (e.target.closest('.delete-keyframe-btn')) {
                        state.object.animation.keyframes = state.object.animation.keyframes.filter(kf => kf.id !== id);
                        if (state.object.animation.activeKeyframeId === id) {
                            state.object.animation.activeKeyframeId = null;
                        }
                        renderKeyframeList();
                        requestRedraw();
                        return;
                    }

                    // Logic to select a keyframe
                    state.object.animation.activeKeyframeId = id;
                    const kf = state.object.animation.keyframes.find(k => k.id === id);

                    if (kf) {
                        state.object.animation.isPlaying = false;
                        state.object.animation.previewTime = kf.time;
                        pauseStartTime = kf.time * 1000;

                        const timelineSlider = document.getElementById('timeline-slider');
                        const timelineCurrentTime = document.getElementById('timeline-current-time');
                        if (timelineSlider) timelineSlider.value = kf.time;
                        if (timelineCurrentTime) timelineCurrentTime.textContent = `${kf.time.toFixed(2)}s`;

                        updatePlayPauseButton();

                        needsRedraw = true;
                    }
                    renderKeyframeList();
                });

                document.getElementById('keyframe-list').addEventListener('change', e => {
                    if (e.target.classList.contains('keyframe-time-input')) {
                        const item = e.target.closest('.keyframe-item');
                        const id = Number(item.dataset.keyframeId);
                        const kf = state.object.animation.keyframes.find(k => k.id === id);
                        if (kf) {
                            const newTime = Math.max(0, parseFloat(e.target.value) || 0);
                            kf.time = newTime;
                            
                            checkAndExtendDuration(newTime);

                            renderKeyframeList();
                            requestRedraw();
                        }
                    }
                });
   
                document.getElementById('play-pause-btn').addEventListener('click', () => {
                    const animState = state.object.animation;
                    if (!state.object.image.element && !animState.isPlaying) {
                        showTopNotification("notificationWarnObject");
                        return;
                    }                    
                    animState.isPlaying = !animState.isPlaying;

                    if (animState.isPlaying) {
                        animState.previewTime = null;
                        animationStartTime = performance.now() - pauseStartTime;
                        state.object.paperFoldOverlay.lastImageSwitchTime = performance.now();
                        
                    } else {
                        pauseStartTime = performance.now() - animationStartTime;
                        animState.previewTime = (pauseStartTime / 1000) % state.export.duration;
                        needsRedraw = true;
                        
                    }
                    
                    updatePlayPauseButton();
                });

                // Timeline/Playhead Scrubbing Logic (Standard Drag)
                const timelineSlider = document.getElementById('timeline-slider');
                if (timelineSlider) {
                    const timelineCurrentTime = document.getElementById('timeline-current-time');

                    const startScrub = () => {
                        isScrubbing = true;
                        state.object.animation.isPlaying = false;
                        updatePlayPauseButton();
                    };

                    const stopScrub = () => {
                        if (isScrubbing) {
                            isScrubbing = false;
                            const lastScrubTime = state.object.animation.previewTime;
                            if (lastScrubTime !== null) {
                                animationStartTime = performance.now() - (lastScrubTime * 1000);
                                pauseStartTime = lastScrubTime * 1000;
                            }
                        }
                    };

                    const doScrub = (e) => {
                        if (!isScrubbing) return;
                        const newTime = parseFloat(e.target.value);
                        state.object.animation.previewTime = newTime;
                        if (timelineCurrentTime) {
                            timelineCurrentTime.textContent = `${newTime.toFixed(2)}s`;
                        }
                        requestRedraw();
                    };

                    timelineSlider.addEventListener('mousedown', startScrub);
                    timelineSlider.addEventListener('touchstart', startScrub, { passive: true });
                    timelineSlider.addEventListener('input', throttle(doScrub, 50));
                    document.addEventListener('mouseup', stopScrub);
                    document.addEventListener('touchend', stopScrub);
                }

                let hideTooltipTimeout;
                let activeMobileTooltip = null;
                let activeMobileTooltipOverlay = null;

                const hideMobileTooltip = () => {
                    if (activeMobileTooltip) {
                        activeMobileTooltip.remove();
                        activeMobileTooltip = null;
                    }
                    if (activeMobileTooltipOverlay) {
                        activeMobileTooltipOverlay.remove();
                        activeMobileTooltipOverlay = null;
                    }
                };

                document.querySelectorAll('.info-tooltip-trigger').forEach(trigger => {
                    const tooltip = trigger.querySelector('.info-tooltip');
                    if (!tooltip) return;

                    let hideDesktopTimeout;

                    const showDesktopTooltip = () => {
                        if (window.innerWidth > 480) {
                            clearTimeout(hideDesktopTimeout);
                            
                            tooltip.classList.add('tooltip-visible');

                            requestAnimationFrame(() => {
                                const tooltipRect = tooltip.getBoundingClientRect();
                                const viewportWidth = window.innerWidth;
                                const margin = 16;

                                const overflowLeft = tooltipRect.left < margin ? margin - tooltipRect.left : 0;
                                const overflowRight = tooltipRect.right > viewportWidth - margin ? tooltipRect.right - (viewportWidth - margin) : 0;

                                let transformStyle = 'translateX(-50%)';

                                if (overflowRight > 0) {
                                    transformStyle = `translateX(calc(-50% - ${overflowRight}px))`;
                                } else if (overflowLeft > 0) {
                                    transformStyle = `translateX(calc(-50% + ${overflowLeft}px))`;
                                }
                                
                                tooltip.style.transform = transformStyle;
                            });
                        }
                    };

                    const hideDesktopTooltip = () => {
                        if (window.innerWidth > 480) {
                            hideDesktopTimeout = setTimeout(() => {
                                tooltip.classList.remove('tooltip-visible');
                                tooltip.style.transform = ''; 
                            }, 200);
                        }
                    };

                    trigger.addEventListener('mouseenter', showDesktopTooltip);
                    tooltip.addEventListener('mouseenter', showDesktopTooltip);
                    trigger.addEventListener('mouseleave', hideDesktopTooltip);
                    tooltip.addEventListener('mouseleave', hideDesktopTooltip);

                    trigger.addEventListener('click', (e) => {
                        if (window.innerWidth <= 480) {
                            e.stopPropagation();
                            
                            if (activeMobileTooltip) {
                                hideMobileTooltip();
                                return;
                            }

                            activeMobileTooltipOverlay = document.createElement('div');
                            activeMobileTooltipOverlay.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; z-index:9998;';
                            document.body.appendChild(activeMobileTooltipOverlay);
                            activeMobileTooltipOverlay.addEventListener('click', hideMobileTooltip);

                            activeMobileTooltip = tooltip.cloneNode(true);
                            activeMobileTooltip.classList.remove('absolute', 'bottom-full', 'left-1/2', '-translate-x-1/2', 'mb-2', 'pointer-events-none');
                            document.body.appendChild(activeMobileTooltip);

                            const triggerRect = trigger.getBoundingClientRect();
                            const tooltipHeight = activeMobileTooltip.offsetHeight;
                            const margin = 12;
                            const topPosition = triggerRect.top - tooltipHeight - margin;

                            activeMobileTooltip.style.position = 'fixed';
                            activeMobileTooltip.style.zIndex = '9999';
                            activeMobileTooltip.style.visibility = 'visible';
                            activeMobileTooltip.style.opacity = '1';
                            activeMobileTooltip.style.pointerEvents = 'auto';
                            activeMobileTooltip.style.top = `${topPosition}px`;
                            activeMobileTooltip.style.left = '50%';
                            activeMobileTooltip.style.transform = 'translateX(-50%)';
                        }
                    });
                });
                const exportDurationInput = document.getElementById('export-duration-input');
                const timelineDurationInput = document.getElementById('timeline-duration-input');
                
                if (exportDurationInput) {
                    exportDurationInput.addEventListener('change', (e) => syncDurationInputs(e.target.value));
                }
                if (timelineDurationInput) {
                    timelineDurationInput.addEventListener('change', (e) => syncDurationInputs(e.target.value));
                }     
                setTimeout(autoAdjustMobileLayout, 500);
                desktopPanelResizer();
                applyAccentColor(state.accentColor);
                updateUIFromState();
            }
            init();
            
            // Load PWA module after main initialization
            window.addEventListener('load', () => {
                if (!window.matchMedia('(max-width: 768px)').matches) {
                    panelWrapper.classList.add('panel-open');
                    body.classList.add('desktop-panel-open');
                    animateCanvasResize();
                }
                
                // Load PWA functionality after page load
                loadPWAModule();
            });            
        });