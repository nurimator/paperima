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

// Function to draw only the object without background for transparent PNG export
async function drawObjectOnly(ctx, canvas, state, elapsedTime = 0, drawFinalObject, getAdvancedTransform, getVisualStateAtTime, layerImages, maskImages, hexToRgba) {
    const objectState = state.object;
    if (!objectState.image.element) return;

    ctx.save();
    // Clear canvas with transparency
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const animState = objectState.animation;
    const isSimpleMode = animState.mode === 'simple';
    const totalDuration = state.export.duration;
    let timeInSeconds = elapsedTime / 1000;
    
    let transform, isPaperAnimActive = false, paperFrameIndex = 0, currentLayer = null, currentMask = null;
    
    if (isSimpleMode) {
        transform = { 
            x: objectState.image.offset.x, 
            y: objectState.image.offset.y, 
            scale: objectState.image.size, 
            rotation: objectState.image.rotation 
        };
        
        // Handle simple paper animation
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
        // Advanced mode - use keyframe system
        if (getAdvancedTransform) {
            const { transform: advTransform, prevKeyframe, nextKeyframe } = getAdvancedTransform(timeInSeconds, objectState);
            transform = advTransform;
            
            if (prevKeyframe && nextKeyframe) {
                const paperAnimType = prevKeyframe.paperAnim;
                const segmentDuration = nextKeyframe.time - prevKeyframe.time;
                if (paperAnimType !== 'none' && segmentDuration > 0) {
                    isPaperAnimActive = true;
                    const progress = Math.min(1, Math.max(0, (timeInSeconds - prevKeyframe.time) / segmentDuration));
                    let frameIndex = Math.floor(progress * (layerImages ? layerImages.length : 6));
                    paperFrameIndex = Math.max(0, Math.min((layerImages ? layerImages.length : 6) - 1, frameIndex));
                    if (paperAnimType === 'close') {
                        paperFrameIndex = ((layerImages ? layerImages.length : 6) - 1) - paperFrameIndex;
                    }
                }
            }
        } else {
            // Fallback to basic transform
            transform = { 
                x: objectState.image.offset.x, 
                y: objectState.image.offset.y, 
                scale: objectState.image.size, 
                rotation: objectState.image.rotation 
            };
        }
    }
    
    if (!transform) {
        ctx.restore();
        return;
    }
    
    // Calculate object positioning and scaling
    const canvasAspect = canvas.width / canvas.height;
    const imageAspect = objectState.image.element.width / objectState.image.element.height;
    const baseScale = (canvasAspect > imageAspect) ? 
        canvas.height / objectState.image.element.height : 
        canvas.width / objectState.image.element.width;
    const finalScale = baseScale * (transform.scale / 100);
    const finalW = objectState.image.element.width * finalScale;
    const finalH = objectState.image.element.height * finalScale;
    
    const imgBaseOffsetX = (canvas.width * transform.x) / 100;
    const imgBaseOffsetY = (canvas.height * transform.y) / 100;
    const totalOffsetX = imgBaseOffsetX + objectState.movement.positionOffset.x;
    const totalOffsetY = imgBaseOffsetY + objectState.movement.positionOffset.y;
    
    // Get paper animation layers if active
    if (isPaperAnimActive && layerImages && maskImages) {
        currentLayer = layerImages[paperFrameIndex];
        currentMask = maskImages[paperFrameIndex];
    }
    
    const isTornEdgesEnabled = objectState.stroke.enabled;
    
    // Draw the final object using the drawFinalObject function
    let finalStampSource;
    if (drawFinalObject) {
        finalStampSource = drawFinalObject(
            objectState, finalW, finalH, totalOffsetX, totalOffsetY, 
            isTornEdgesEnabled, currentLayer, currentMask
        );
    } else {
        // Fallback: draw object directly if drawFinalObject is not available
        finalStampSource = document.createElement('canvas');
        finalStampSource.width = finalW;
        finalStampSource.height = finalH;
        const stampCtx = finalStampSource.getContext('2d');
        stampCtx.drawImage(objectState.image.element, 0, 0, finalW, finalH);
    }
    
    ctx.save();
    
    // Apply shadow if enabled
    if (objectState.shadow.enabled) {
        const baseResolution = 720;
        const currentResolution = canvas.height;
        const resolutionScaleFactor = currentResolution / baseResolution;
        
        if (hexToRgba) {
            ctx.shadowColor = hexToRgba(objectState.shadow.color, objectState.shadow.opacity / 100);
        } else {
            // Fallback color conversion
            ctx.shadowColor = `rgba(${parseInt(objectState.shadow.color.slice(1, 3), 16)}, ${parseInt(objectState.shadow.color.slice(3, 5), 16)}, ${parseInt(objectState.shadow.color.slice(5, 7), 16)}, ${objectState.shadow.opacity / 100})`;
        }
        
        ctx.shadowBlur = objectState.shadow.blur * resolutionScaleFactor;
        ctx.shadowOffsetX = objectState.shadow.offsetX * resolutionScaleFactor;
        ctx.shadowOffsetY = (objectState.shadow.offsetY * -1) * resolutionScaleFactor;
    }
    
    // Apply transformations
    ctx.translate(canvas.width / 2 + totalOffsetX, canvas.height / 2 + (totalOffsetY * -1));
    if (objectState.movement.enabled || transform.rotation !== 0) {
        const totalRotation = transform.rotation + objectState.movement.rotation;
        ctx.rotate(totalRotation * Math.PI / 180);
    }
    
    // Draw the final object
    ctx.drawImage(finalStampSource, -finalStampSource.width / 2, -finalStampSource.height / 2);
    
    ctx.restore();
    ctx.restore();
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
    isExporting,
    drawFinalObject,
    getAdvancedTransform,
    getVisualStateAtTime,
    layerImages,
    maskImages,
    hexToRgba
) {
    const exportFormat = state.export.format || 'webm';
    
    // For video export, load CCapture.js
    if (exportFormat === 'webm') {
        try {
            await loadCCaptureLibrary();
        } catch (error) {
            showTopNotification("exportError");
            return;
        }
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

    // Handle image export (PNG/JPG)
    if (exportFormat === 'png' || exportFormat === 'jpg') {
        exportTitle.textContent = translations[state.language].exportingImage || 'Mengekspor Gambar...';
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // For image export, just draw a single frame
        Object.assign(state.object.movement, DEFAULT_OBJECT_STATE.movement);
        Object.assign(state.object.paperFoldOverlay, DEFAULT_OBJECT_STATE.paperFoldOverlay);
        
        // Set progress to 50%
        progressBarFill.style.width = '50%';
        progressBarFill.textContent = '50%';
        
        // Draw the image
        await draw(0);
        
        // Set progress to 90%
        progressBarFill.style.width = '90%';
        progressBarFill.textContent = '90%';
        
        // Export the image
        let dataURL;
        if (exportFormat === 'png') {
            if (state.export.transparentBackground) {
                // For transparent PNG, create a separate canvas with only the object
                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = canvas.width;
                tempCanvas.height = canvas.height;
                const tempCtx = tempCanvas.getContext('2d');
                
                // Draw only the object without background
                await drawObjectOnly(tempCtx, tempCanvas, state, 0, drawFinalObject, getAdvancedTransform, getVisualStateAtTime, layerImages, maskImages, hexToRgba);
                dataURL = tempCanvas.toDataURL('image/png');
            } else {
                // For non-transparent PNG, draw everything normally
                await draw(0);
                dataURL = canvas.toDataURL('image/png');
            }
        } else if (exportFormat === 'jpg') {
            // For JPG, always draw everything (no transparency support)
            await draw(0);
            const quality = (state.export.jpgQuality || 95) / 100;
            dataURL = canvas.toDataURL('image/jpeg', quality);
        }
        
        // Set progress to 100%
        progressBarFill.style.width = '100%';
        progressBarFill.textContent = '100%';
        exportTitle.textContent = `${translations[state.language].completing}...`;
        
        // Download the image
        const filename = state.export.filename || 'paperima';
        const extension = exportFormat === 'png' ? '.png' : '.jpg';
        const link = document.createElement('a');
        link.href = dataURL;
        link.download = `${filename}${extension}`;
        link.click();
        link.remove();
        
        // Cleanup
        setTimeout(() => {
            cleanupAfterExport();
        }, 500);
        
        return;
    }

    // Video export logic continues below
    exportTitle.textContent = translations[state.language].exportingVideo || 'Mengekspor Video...';
    await new Promise(resolve => setTimeout(resolve, 100));

    Object.assign(state.object.movement, DEFAULT_OBJECT_STATE.movement);
    Object.assign(state.object.paperFoldOverlay, DEFAULT_OBJECT_STATE.paperFoldOverlay);

    const DURATION_S = state.export.duration;
    const FRAME_RATE = state.export.fps;
    const FILENAME = state.export.filename || 'paperima';
    const TOTAL_FRAMES = DURATION_S * FRAME_RATE;
    const capturer = new CCapture({ format: 'webm', framerate: FRAME_RATE, quality: 95, name: FILENAME });

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