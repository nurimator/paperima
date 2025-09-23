let CCaptureLoaded = false;

async function loadCCaptureLibrary() {
    if (CCaptureLoaded) return;
    
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = './assets/CCapture.all.min.js';
        script.onload = () => {
            CCaptureLoaded = true;
            resolve();
        };
        script.onerror = () => reject(new Error('Failed to load CCapture.js'));
        document.head.appendChild(script);
    });
}

async function startExport(
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
    isExporting
) {
    try {
        await loadCCaptureLibrary();
    } catch (error) {
        showTopNotification("exportError");
        return;
    }

    isExporting = true;
    const hasAnyImage = state.object.image.element || state.background.element;
    if (!hasAnyImage) {
        showTopNotification("notificationWarnUpload");
        isExporting = false;
        return;
    }

    const exportSettingsPopup = document.getElementById('export-settings-popup');
    const exportProgressPopup = document.getElementById('export-progress-popup');
    const progressBarFill = document.getElementById('progress-bar-fill');
    const cancelExportBtn = document.getElementById('cancel-export-btn');

    exportSettingsPopup.classList.add('hidden');
    exportProgressPopup.classList.remove('hidden');
    exportProgressPopup.classList.add('flex');

    const exportTitle = exportProgressPopup.querySelector('h3');
    progressBarFill.style.width = '0%';
    progressBarFill.textContent = '0%';
    exportTitle.textContent = translations[state.language].preparingExportCanvas || 'Menyiapkan kanvas ekspor...';
    await new Promise(resolve => setTimeout(resolve, 100));
    cancelAnimationFrame(animationFrameId);

    const exportResolutionKey = document.querySelector('#canvas-resolution-btns button.active')?.dataset.res || state.previewResolution;
    const finalExportDims = RESOLUTION_MAPS[exportResolutionKey]?.[state.aspectRatio];

    if (!finalExportDims) {
        isExporting = false;
        exportProgressPopup.classList.add('hidden');
        exportProgressPopup.classList.remove('flex');
        return;
    }

    const originalCanvasWidth = canvas.width;
    const originalCanvasHeight = canvas.height;
    const previewImageElement = state.object.image.element;
    const originalImageSize = state.object.image.size; 

    canvas.width = finalExportDims.width || finalExportDims.w;
    canvas.height = finalExportDims.height || finalExportDims.h;

    const imageSizeSlider = document.getElementById('image-size');
    const maxScalePercent = imageSizeSlider ? parseFloat(imageSizeSlider.max) : 200;
    const offscreenMultiplier = (maxScalePercent / 100.0) + 0.1;

    const offscreenCanvasWidth = Math.round(canvas.width * offscreenMultiplier);
    const offscreenCanvasHeight = Math.round(canvas.height * offscreenMultiplier);

    if (objectCanvas && contentCanvas && finalObjectCanvas) {
        objectCanvas.width = contentCanvas.width = finalObjectCanvas.width = offscreenCanvasWidth;
        objectCanvas.height = contentCanvas.height = finalObjectCanvas.height = offscreenCanvasHeight;
    }

    if (state.object.image.originalElement) {
        let highResImg = state.object.image.originalElement;
        const exportTargetsForUpscale = ['1080', '1440', '2160'];
        if (exportTargetsForUpscale.includes(exportResolutionKey)) {
            const exportWidth = finalExportDims.width || finalExportDims.w;
            const exportHeight = finalExportDims.height || finalExportDims.h;
            const sourceWidth = highResImg.width;
            const sourceHeight = highResImg.height;

            const targetWidth = exportWidth * 0.8;
            const targetHeight = exportHeight * 0.8;

            const sourceAspectRatio = sourceWidth / sourceHeight;
            const targetAspectRatio = targetWidth / targetHeight;

            let newWidth, newHeight;
            if (sourceAspectRatio > targetAspectRatio) {
                newWidth = targetWidth;
                newHeight = newWidth / sourceAspectRatio;
            } else {
                newHeight = targetHeight;
                newWidth = newHeight * sourceAspectRatio;
            }

            if (newWidth > sourceWidth || newHeight > sourceHeight) {
                const upscaleCanvas = document.createElement('canvas');
                upscaleCanvas.width = newWidth;
                upscaleCanvas.height = newHeight;
                const upscaleCtx = upscaleCanvas.getContext('2d');
                upscaleCtx.drawImage(highResImg, 0, 0, newWidth, newHeight);

                const upscaledImage = new Image();
                upscaledImage.src = upscaleCanvas.toDataURL();
                await upscaledImage.decode();
                highResImg = upscaledImage;
            }
        }
        
        const paddingX = highResImg.width * 0.25;
        const paddingY = highResImg.height * 0.25;
        const paddedCanvas = document.createElement('canvas');
        const paddedCtx = paddedCanvas.getContext('2d');
        paddedCanvas.width = highResImg.width + paddingX * 2;
        paddedCanvas.height = highResImg.height + paddingY * 2;
        paddedCtx.drawImage(highResImg, paddingX, paddingY);
        const highResPaddedImg = new Image();
        highResPaddedImg.src = paddedCanvas.toDataURL();
        await highResPaddedImg.decode();
        state.object.image.element = highResPaddedImg;
    }

    isCacheGenerationNeeded = true;
    await generateTornEdgeCache();

    exportTitle.textContent = translations[state.language].exportingVideo || 'Mengekspor Video...';
    await new Promise(resolve => setTimeout(resolve, 100));

    Object.assign(state.object.movement, DEFAULT_OBJECT_STATE.movement);
    Object.assign(state.object.paperFoldOverlay, DEFAULT_OBJECT_STATE.paperFoldOverlay);

    const DURATION_S = state.export.duration;
    const FRAME_RATE = state.export.fps;
    const FILENAME = state.export.filename || 'paperima';
    const TOTAL_FRAMES = DURATION_S * FRAME_RATE;
    const capturer = new CCapture({ format: 'webm', framerate: FRAME_RATE, quality: 95, name: FILENAME });

    let isExportCancelled = false;
    const handleCancel = () => { isExportCancelled = true; };
    cancelExportBtn.addEventListener('click', handleCancel, { once: true });

    const cleanupAfterExport = () => {
        state.object.image.element = previewImageElement;
        state.object.image.size = originalImageSize;
        
        canvas.width = originalCanvasWidth;
        canvas.height = originalCanvasHeight;

        resizeAndRedrawAll();
        exportProgressPopup.classList.add('hidden');
        exportProgressPopup.classList.remove('flex');
        cancelExportBtn.removeEventListener('click', handleCancel);
        isExporting = false;
        isCacheGenerationNeeded = true;
        needsRedraw = true;
        
        if (animationLoop && typeof animationLoop === 'function') {
            requestAnimationFrame(animationLoop);
        }
    };

    capturer.start();

    async function processFrame(frame) {
        if (isExportCancelled) {
            capturer.stop();
            cleanupAfterExport();
            return;
        }

        if (frame > TOTAL_FRAMES) {
            progressBarFill.textContent = '100%';
            exportTitle.textContent = `${translations[state.language].completing}...`;
            capturer.stop();
            capturer.save(blob => {
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${FILENAME}.webm`;
                a.click();
                URL.revokeObjectURL(url);
                a.remove();
                cleanupAfterExport();
            });
            return;
        }

        const timestamp = (frame / FRAME_RATE) * 1000;
        updateMovement(timestamp);
        updatePaperFoldOverlay(timestamp);
        await draw(timestamp);
        capturer.capture(canvas);

        const percentage = Math.round((frame / TOTAL_FRAMES) * 100);
        progressBarFill.style.width = `${percentage}%`;
        progressBarFill.textContent = `${percentage}%`;

        requestAnimationFrame(() => processFrame(frame + 1));
    }

    processFrame(0);
}

window.startVideoExport = startExport;