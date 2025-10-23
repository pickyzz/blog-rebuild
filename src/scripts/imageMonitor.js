// Image Monitoring Utility for Free Plan
// Monitors image loading performance and reports issues

class ImageMonitor {
  constructor() {
    this.stats = {
      total: 0,
      loaded: 0,
      failed: 0,
      retried: 0,
      bySource: {
        proxy: { total: 0, loaded: 0, failed: 0 },
        direct: { total: 0, loaded: 0, failed: 0 },
        encoded: { total: 0, loaded: 0, failed: 0 }
      }
    };

    this.performanceData = [];
    this.init();
  }

  init() {
    this.observeImages();
    this.setupPerformanceMonitoring();
    this.reportStats();
  }

  observeImages() {
    const images = document.querySelectorAll('img[data-fallback1]');

    images.forEach(img => {
      this.stats.total++;

      // Determine image source type
      const sourceType = this.getImageSourceType(img);
      this.stats.bySource[sourceType].total++;

      // Monitor loading
      img.addEventListener('load', () => {
        this.stats.loaded++;
        this.stats.bySource[sourceType].loaded++;
        this.recordPerformance(img, true);
      });

      img.addEventListener('error', () => {
        this.stats.failed++;
        this.stats.bySource[sourceType].failed++;
        this.recordPerformance(img, false);
      });
    });
  }

  getImageSourceType(img) {
    const src = img.src;
    if (src.includes('/api/image/')) {
      return src.includes('/api/image/p/') ? 'encoded' : 'proxy';
    }
    return 'direct';
  }

  recordPerformance(img, success) {
    const timing = {
      timestamp: Date.now(),
      src: img.src,
      success,
      loadTime: success ? performance.now() : null,
      sourceType: this.getImageSourceType(img)
    };

    this.performanceData.push(timing);

    // Keep only last 50 entries
    if (this.performanceData.length > 50) {
      this.performanceData.shift();
    }
  }

  setupPerformanceMonitoring() {
    // Monitor connection quality
    if ('connection' in navigator) {
      const connection = navigator.connection;
      console.log(`[Image Monitor] Connection: ${connection.effectiveType}, downlink: ${connection.downlink}Mbps`);
    }

    // Monitor page visibility changes
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        console.log('[Image Monitor] Page became visible, checking image status...');
        this.checkFailedImages();
      }
    });
  }

  checkFailedImages() {
    const failedImages = document.querySelectorAll('.image-error-placeholder');
    if (failedImages.length > 0) {
      console.warn(`[Image Monitor] Found ${failedImages.length} failed images`);

      // Optional: Auto-retry failed images once
      if (typeof window.ImageErrorBoundary !== 'undefined') {
        setTimeout(() => {
          window.ImageErrorBoundary.retryFailedImages();
        }, 2000);
      }
    }
  }

  reportStats() {
    // Report stats every 30 seconds in development
    if (import.meta.env.DEV) {
      setInterval(() => {
        this.logStats();
      }, 30000);
    }

    // Report on page unload
    window.addEventListener('beforeunload', () => {
      this.sendBeacon();
    });
  }

  logStats() {
    const successRate = this.stats.total > 0 ? (this.stats.loaded / this.stats.total * 100).toFixed(1) : 0;

    console.log(`[Image Monitor] Stats: ${this.stats.loaded}/${this.stats.total} loaded (${successRate}% success)`);

    // Log by source
    Object.entries(this.stats.bySource).forEach(([source, stats]) => {
      if (stats.total > 0) {
        const rate = (stats.loaded / stats.total * 100).toFixed(1);
        console.log(`[Image Monitor] ${source}: ${stats.loaded}/${stats.total} (${rate}%)`);
      }
    });
  }

  sendBeacon() {
    if ('sendBeacon' in navigator && this.stats.total > 0) {
      const data = {
        url: window.location.href,
        timestamp: Date.now(),
        stats: this.stats,
        userAgent: navigator.userAgent.substring(0, 100)
      };

      // Send to analytics endpoint (optional)
      navigator.sendBeacon('/api/analytics/image-stats', JSON.stringify(data));
    }
  }

  // Public method to get current stats
  getStats() {
    return {
      ...this.stats,
      successRate: this.stats.total > 0 ? (this.stats.loaded / this.stats.total * 100).toFixed(1) : 0,
      recentPerformance: this.performanceData.slice(-10)
    };
  }

  // Public method to retry failed images
  retryFailed() {
    if (typeof window.ImageErrorBoundary !== 'undefined') {
      window.ImageErrorBoundary.retryFailedImages();
    }
  }
}

// Auto-initialize
document.addEventListener('DOMContentLoaded', () => {
  window.imageMonitor = new ImageMonitor();
});

// Export for manual access
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ImageMonitor;
}
