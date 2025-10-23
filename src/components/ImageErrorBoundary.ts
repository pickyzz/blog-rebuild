// Image Error Boundary Component for better image loading reliability
export class ImageErrorBoundary {
  private static readonly MAX_RETRIES = 2;
  private static readonly RETRY_DELAY = 1000;
  private static readonly RETRY_TIMEOUT = 8000;

  static init() {
    // Add global error handling for images
    this.setupGlobalImageHandler();
    this.setupImageLoadingMonitor();
  }

  private static setupGlobalImageHandler() {
    // Enhanced image error handler with retry logic
    document.addEventListener('error', (e) => {
      const target = e.target as HTMLImageElement;
      if (target.tagName === 'IMG' && target.dataset.fallback1) {
        this.handleImageError(target);
      }
    }, true);
  }

  private static async handleImageError(img: HTMLImageElement) {
    const attempt = parseInt(img.dataset.attempt || '0');

    if (attempt >= this.MAX_RETRIES) {
      this.showImagePlaceholder(img);
      return;
    }

    // Try next fallback
    const nextFallback = this.getNextFallback(img, attempt);
    if (nextFallback) {
      img.dataset.attempt = String(attempt + 1);

      // Add retry delay
      await this.delay(this.RETRY_DELAY);

      // Set timeout for next attempt
      const timeoutId = setTimeout(() => {
        if (!img.complete || img.naturalHeight === 0) {
          this.handleImageError(img);
        }
      }, this.RETRY_TIMEOUT);

      img.onload = () => {
        clearTimeout(timeoutId);
        img.classList.remove('img-loading');
        img.classList.add('img-loaded');
      };

      img.src = nextFallback;
    } else {
      this.showImagePlaceholder(img);
    }
  }

  private static getNextFallback(img: HTMLImageElement, attempt: number): string | null {
    const currentSrc = img.src;

    // Try fallback 2 (encoded proxy) first
    if (attempt === 0 && img.dataset.fallback2 && currentSrc !== img.dataset.fallback2) {
      return img.dataset.fallback2;
    }

    // Then try fallback 1 (direct URL)
    if (attempt <= 1 && img.dataset.fallback1 && currentSrc !== img.dataset.fallback1) {
      return img.dataset.fallback1;
    }

    return null;
  }

  private static showImagePlaceholder(img: HTMLImageElement) {
    img.style.display = 'none';

    // Check if placeholder already exists
    const existingPlaceholder = img.parentNode?.querySelector('.image-error-placeholder');
    if (existingPlaceholder) return;

    const placeholder = document.createElement('div');
    placeholder.className = 'image-error-placeholder';
    placeholder.innerHTML = `
      <div style="
        padding: 2rem;
        text-align: center;
        color: #666;
        background: #f5f5f5;
        border-radius: 8px;
        border: 1px dashed #ddd;
        font-size: 0.9rem;
        min-height: 200px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-direction: column;
        gap: 0.5rem;
      ">
        <div style="font-size: 2rem;">📷</div>
        <div>Image temporarily unavailable</div>
        <div style="font-size: 0.8rem; color: #999;">Please try refreshing the page</div>
      </div>
    `;

    img.parentNode?.insertBefore(placeholder, img);
  }

  private static setupImageLoadingMonitor() {
    // Monitor image loading and report issues
    const images = document.querySelectorAll('img[data-fallback1]');
    let loadedCount = 0;
    let errorCount = 0;

    images.forEach((img) => {
      const image = img as HTMLImageElement;

      image.addEventListener('load', () => {
        loadedCount++;
        this.updateLoadingStats();
      });

      image.addEventListener('error', () => {
        errorCount++;
        this.updateLoadingStats();
      });
    });
  }

  private static updateLoadingStats() {
    // Log loading statistics for debugging
    const total = document.querySelectorAll('img[data-fallback1]').length;
    const loaded = document.querySelectorAll('img.img-loaded').length;
    const errors = document.querySelectorAll('.image-error-placeholder').length;

    if (import.meta.env.DEV) {
      console.log(`[Image Loading] ${loaded}/${total} loaded, ${errors} errors`);
    }
  }

  private static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Utility to manually retry failed images
  static retryFailedImages() {
    const placeholders = document.querySelectorAll('.image-error-placeholder');
    placeholders.forEach((placeholder) => {
      const img = placeholder.nextElementSibling as HTMLImageElement;
      if (img && img.tagName === 'IMG') {
        placeholder.remove();
        img.style.display = '';
        img.dataset.attempt = '0';
        img.classList.add('img-loading');
        img.src = img.src; // Trigger reload
      }
    });
  }

  // Utility to preload critical images
  static preloadCriticalImages() {
    const criticalImages = document.querySelectorAll('img[loading="eager"]');
    criticalImages.forEach((img) => {
      const image = img as HTMLImageElement;
      if (image.dataset.fallback1 && !image.complete) {
        // Preload fallback images in background
        const fallback1 = new Image();
        fallback1.src = image.dataset.fallback1;

        if (image.dataset.fallback2) {
          const fallback2 = new Image();
          fallback2.src = image.dataset.fallback2;
        }
      }
    });
  }
}

// Auto-initialize on DOM content loaded
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      ImageErrorBoundary.init();
    });
  } else {
    ImageErrorBoundary.init();
  }
}
