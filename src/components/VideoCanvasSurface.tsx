import { Film } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { mediaEngine } from '@/src/media/MediaEngine';
import { VideoFilterMode, VideoFitMode, VideoItem } from '@/src/types/video';

interface VideoCanvasSurfaceProps {
  video: VideoItem | null;
  isPlaying: boolean;
  fitMode?: VideoFitMode;
  postFilter?: VideoFilterMode;
  /** Show the real <video> element (HDR passthrough) instead of the SDR canvas copy. */
  hdr?: boolean;
  className?: string;
}

const CSS_FILTER_CLASSES: Record<VideoFilterMode, string> = {
  none: '',
  grayscale: 'grayscale',
  sepia: 'sepia',
  'high-contrast': 'contrast-150',
};

export function VideoCanvasSurface({
  video,
  isPlaying,
  fitMode = 'contain',
  postFilter = 'none',
  hdr = false,
  className = '',
}: VideoCanvasSurfaceProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const loadedSrcRef = useRef<string | null>(null);

  useEffect(() => {
    if (!video?.thumbnailUrl || video.videoUrl) {
      imageRef.current = null;
      loadedSrcRef.current = null;
      return;
    }

    if (loadedSrcRef.current === video.thumbnailUrl && imageRef.current) {
      return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = video.thumbnailUrl;
    loadedSrcRef.current = video.thumbnailUrl;
    imageRef.current = img;
  }, [video?.thumbnailUrl, video?.videoUrl]);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let animId = 0;
    let width = container.clientWidth;
    let height = container.clientHeight;

    const syncSize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = Math.max(1, container.clientWidth);
      height = Math.max(1, container.clientHeight);
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    syncSize();
    const resizeObserver = new ResizeObserver(syncSize);
    resizeObserver.observe(container);

    const drawMediaRect = (
      source: CanvasImageSource,
      srcW: number,
      srcH: number,
      zoom = 1,
      panX = 0,
      panY = 0
    ) => {
      if (srcW <= 0 || srcH <= 0) return;

      const srcAspect = srcW / srcH;
      const dstAspect = width / height;

      let drawW = width;
      let drawH = height;

      if (fitMode === 'cover') {
        if (srcAspect > dstAspect) {
          drawH = height;
          drawW = height * srcAspect;
        } else {
          drawW = width;
          drawH = width / srcAspect;
        }
      } else {
        if (srcAspect > dstAspect) {
          drawW = width;
          drawH = width / srcAspect;
        } else {
          drawH = height;
          drawW = height * srcAspect;
        }
      }

      const scaledW = drawW * zoom;
      const scaledH = drawH * zoom;
      const x = (width - scaledW) / 2 + panX;
      const y = (height - scaledH) / 2 + panY;

      ctx.save();
      if (fitMode === 'contain') {
        // Clip inside fitted letterbox bounds for procedural motion zoom
        const clipX = (width - drawW) / 2;
        const clipY = (height - drawH) / 2;
        ctx.beginPath();
        ctx.rect(clipX, clipY, drawW, drawH);
        ctx.clip();
      }
      ctx.drawImage(source, x, y, scaledW, scaledH);
      ctx.restore();
    };

    const renderFrame = () => {
      ctx.fillStyle = '#09090b';
      ctx.fillRect(0, 0, width, height);

      if (!video) return;

      const videoEl = mediaEngine.getVideoElement();

      if (video.videoUrl) {
        if (videoEl.readyState >= 2 && videoEl.videoWidth > 0 && videoEl.videoHeight > 0) {
          drawMediaRect(videoEl, videoEl.videoWidth, videoEl.videoHeight, 1, 0, 0);
        }
      } else {
        const img = imageRef.current;
        if (img && img.complete && img.naturalWidth > 0) {
          const activeEl = mediaEngine.getAudioElement();
          const t = activeEl.currentTime || 0;
          const dur = Math.max(1, video.duration || 40);
          const progress = Math.min(1, Math.max(0, t / dur));

          let zoom = 1;
          let panX = 0;
          let panY = 0;

          if (!prefersReducedMotion) {
            const style = video.sceneStyle || 'zoom-in';
            const ampX = width * 0.032;
            const ampY = height * 0.024;
            switch (style) {
              case 'drift-right':
                zoom = 1.09;
                panX = (0.5 - progress) * ampX * 2;
                break;
              case 'drift-left':
                zoom = 1.09;
                panX = (progress - 0.5) * ampX * 2;
                break;
              case 'zoom-out':
                zoom = 1.14 - progress * 0.11;
                break;
              case 'tilt-up':
                zoom = 1.1;
                panY = (0.5 - progress) * ampY * 2;
                break;
              case 'pan-cinema':
                zoom = 1.1;
                panX = Math.sin(progress * Math.PI) * ampX;
                panY = Math.cos(progress * Math.PI) * ampY * 0.5;
                break;
              case 'zoom-in':
              default:
                zoom = 1.02 + progress * 0.12;
                break;
            }
          }

          drawMediaRect(img, img.naturalWidth, img.naturalHeight, zoom, panX, panY);

          // Subtle cinematic vignette & atmospheric light sweep
          const vignette = ctx.createRadialGradient(
            width * 0.5,
            height * 0.5,
            Math.min(width, height) * 0.3,
            width * 0.5,
            height * 0.5,
            Math.max(width, height) * 0.72
          );
          vignette.addColorStop(0, 'rgba(0,0,0,0)');
          vignette.addColorStop(1, 'rgba(0,0,0,0.34)');
          ctx.fillStyle = vignette;
          ctx.fillRect(0, 0, width, height);

          if (!prefersReducedMotion && isPlaying) {
            // Subtle floating ambient dust motes
            ctx.fillStyle = 'rgba(255,255,255,0.16)';
            for (let m = 0; m < 8; m++) {
              const mx = ((Math.sin(t * 0.25 + m * 2.1) * 0.5 + 0.5) * width);
              const my = ((Math.cos(t * 0.18 + m * 1.7) * 0.5 + 0.5) * height);
              ctx.beginPath();
              ctx.arc(mx, my, 1.1 + (m % 2) * 0.6, 0, Math.PI * 2);
              ctx.fill();
            }
          }
        }
      }

      if (isPlaying && !prefersReducedMotion) {
        animId = requestAnimationFrame(renderFrame);
      }
    };

    renderFrame();

    const activeEl = mediaEngine.getActiveElement();
    const videoEl = mediaEngine.getVideoElement();
    const audioEl = mediaEngine.getAudioElement();
    const img = imageRef.current;

    const onFrameTrigger = () => {
      renderFrame();
    };

    activeEl.addEventListener('seeked', onFrameTrigger);
    videoEl.addEventListener('loadeddata', onFrameTrigger);
    videoEl.addEventListener('canplay', onFrameTrigger);
    audioEl.addEventListener('seeked', onFrameTrigger);
    if (img) {
      img.addEventListener('load', onFrameTrigger);
    }

    return () => {
      resizeObserver.disconnect();
      if (animId) cancelAnimationFrame(animId);
      activeEl.removeEventListener('seeked', onFrameTrigger);
      videoEl.removeEventListener('loadeddata', onFrameTrigger);
      videoEl.removeEventListener('canplay', onFrameTrigger);
      audioEl.removeEventListener('seeked', onFrameTrigger);
      if (img) {
        img.removeEventListener('load', onFrameTrigger);
      }
    };
  }, [video, isPlaying, fitMode]);

  // HDR passthrough: put the actual video element on screen so Windows can present it in HDR.
  const showNativeVideo = Boolean(hdr && video?.videoUrl && video.isHdr);
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !showNativeVideo) return;
    const el = mediaEngine.getVideoElement();
    el.removeAttribute('class');
    el.style.cssText =
      'position:absolute;inset:0;width:100%;height:100%;background:#09090b;pointer-events:none;';
    container.appendChild(el);
    return () => {
      el.removeAttribute('style');
      el.className = 'w-2 h-2 pointer-events-none';
      document.querySelector('[data-video-host]')?.appendChild(el);
    };
  }, [showNativeVideo, video?.id]);

  useEffect(() => {
    if (!showNativeVideo) return;
    const el = mediaEngine.getVideoElement();
    el.style.objectFit = fitMode === 'cover' ? 'cover' : 'contain';
    el.style.filter =
      postFilter === 'grayscale'
        ? 'grayscale(1)'
        : postFilter === 'sepia'
          ? 'sepia(1)'
          : postFilter === 'high-contrast'
            ? 'contrast(1.5)'
            : '';
  }, [showNativeVideo, fitMode, postFilter]);

  if (!video) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-[#09090b] text-neutral-500 ${className}`}
      >
        <Film size={32} />
      </div>
    );
  }

  return (
    <div ref={containerRef} className={`relative overflow-hidden bg-[#09090b] ${className}`}>
      <canvas
        ref={canvasRef}
        className={`w-full h-full ${showNativeVideo ? 'hidden' : 'block'} transition-[filter] duration-200 ${CSS_FILTER_CLASSES[postFilter]}`}
      />
    </div>
  );
}
