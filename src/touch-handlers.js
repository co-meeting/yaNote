export class TouchEventHandler {
    constructor(mindMap) {
        this.mindMap = mindMap;
        this.touchState = {
            startX: 0,
            startY: 0,
            isMoving: false,
            activeNode: null
        };
    }

    handleNodeTouchStart(e, node) {
        e.preventDefault();
        this.touchState.startX = e.touches[0].clientX;
        this.touchState.startY = e.touches[0].clientY;
        this.touchState.activeNode = node;
        this.touchState.isMoving = false;
    }

    handleNodeTouchEnd(e, node) {
        if (!this.touchState.isMoving) {
            node.handleTap();
        }
        this.resetTouchState();
    }

    resetTouchState() {
        this.touchState = {
            startX: 0,
            startY: 0,
            isMoving: false,
            activeNode: null
        };
    }
} 