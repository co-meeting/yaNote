export class ZoomPreventionHandler {
    static init() {
        // ズーム防止の統一実装
        document.addEventListener('touchmove', (e) => {
            if (e.touches.length > 1) {
                e.preventDefault();
            }
        }, { passive: false });

        // iOS固有の対応
        if (this.isIOS()) {
            this.setupIOSSpecificFixes();
        }
    }

    static isIOS() {
        return /iPad|iPhone|iPod/.test(navigator.userAgent);
    }

    static setupIOSSpecificFixes() {
        // iOS固有の問題に対する対応をここに集約
        document.addEventListener('gesturestart', e => e.preventDefault());
        document.addEventListener('gesturechange', e => e.preventDefault());
    }
} 