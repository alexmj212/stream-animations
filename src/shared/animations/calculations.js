/**
 * Pure animation calculation functions
 * These functions contain no side effects and are easily testable
 */

/**
 * Calculate opacity based on animation phase
 * @param {string} phase - Animation phase ('fadeIn', 'visible', 'fadeOut')
 * @param {number} frame - Current frame number in the phase
 * @param {number} fadeInDuration - Duration of fade-in in frames
 * @param {number} fadeOutDuration - Duration of fade-out in frames
 * @param {number} maxOpacity - Maximum opacity value (0-1)
 * @param {Function} easingFn - Easing function that takes progress (0-1) and returns eased value
 * @returns {number} Calculated opacity (0-1)
 */
export function calculateOpacity(phase, frame, fadeInDuration, fadeOutDuration, maxOpacity, easingFn) {
    if (phase === 'fadeIn') {
        const progress = Math.min(frame / fadeInDuration, 1);
        return maxOpacity * easingFn(progress);
    } else if (phase === 'fadeOut') {
        const progress = Math.min(frame / fadeOutDuration, 1);
        return maxOpacity * (1 - easingFn(progress));
    } else {
        // visible phase
        return maxOpacity;
    }
}

/**
 * Calculate size multiplier based on animation phase and progress
 * @param {string} phase - Animation phase ('fadeIn', 'visible', 'fadeOut')
 * @param {number} frame - Current frame number in the phase
 * @param {number} visibleDuration - Duration of visible phase in frames
 * @param {number} startMultiplier - Starting size multiplier (e.g., 0.5 = 50%)
 * @param {number} endMultiplier - Ending size multiplier (e.g., 1.5 = 150%)
 * @param {Function} easingFn - Easing function that takes progress (0-1) and returns eased value
 * @returns {number} Size multiplier to apply
 */
export function calculateSizeMultiplier(phase, frame, visibleDuration, startMultiplier, endMultiplier, easingFn) {
    if (phase === 'visible') {
        const progress = Math.min(frame / visibleDuration, 1);
        const eased = easingFn(progress);
        return startMultiplier + (endMultiplier - startMultiplier) * eased;
    } else if (phase === 'fadeOut') {
        return endMultiplier;
    } else {
        // fadeIn phase
        return startMultiplier;
    }
}

/**
 * Calculate interpolated direction during transition
 * @param {number} transitionProgress - Progress through transition (0-1)
 * @param {number} oldDirection - Previous direction (-1 or 1)
 * @param {number} newDirection - Target direction (-1 or 1)
 * @param {Function} easingFn - Easing function that takes progress (0-1) and returns eased value
 * @returns {number} Interpolated direction value
 */
export function calculateDirectionTransition(transitionProgress, oldDirection, newDirection, easingFn) {
    if (transitionProgress >= 1) {
        return newDirection;
    }
    const eased = easingFn(transitionProgress);
    return oldDirection + (newDirection - oldDirection) * eased;
}

/**
 * Calculate new position based on current position, speed, and direction
 * @param {number} currentPosition - Current x or y position
 * @param {number} baseSpeed - Speed in pixels per frame
 * @param {number} direction - Direction multiplier (-1 or 1, or interpolated value)
 * @returns {number} New position
 */
export function calculatePosition(currentPosition, baseSpeed, direction) {
    return currentPosition + baseSpeed * direction;
}

/**
 * Check if direction should change based on current frame and scheduled changes
 * @param {number} currentFrame - Current frame in the visible phase
 * @param {number[]} directionChangeTimings - Array of frame numbers when direction should change
 * @param {number} nextChangeIndex - Index of next scheduled change
 * @returns {boolean} True if direction should change now
 */
export function shouldChangeDirection(currentFrame, directionChangeTimings, nextChangeIndex) {
    if (nextChangeIndex >= directionChangeTimings.length) {
        return false;
    }
    return currentFrame >= directionChangeTimings[nextChangeIndex];
}

/**
 * Calculate transition progress
 * @param {number} currentFrame - Current frame number
 * @param {number} transitionStartFrame - Frame when transition started
 * @param {number} transitionDuration - Duration of transition in frames
 * @returns {number} Progress (0-1, can exceed 1 if transition is complete)
 */
export function calculateTransitionProgress(currentFrame, transitionStartFrame, transitionDuration) {
    return (currentFrame - transitionStartFrame) / transitionDuration;
}

/**
 * Determine next phase based on current phase and frame
 * @param {string} currentPhase - Current animation phase
 * @param {number} frame - Current frame number in the phase
 * @param {number} fadeInDuration - Duration of fade-in
 * @param {number} visibleDuration - Duration of visible phase
 * @param {number} fadeOutDuration - Duration of fade-out
 * @returns {{phase: string, frame: number}} Next phase and frame number
 */
export function determineNextPhase(currentPhase, frame, fadeInDuration, visibleDuration, fadeOutDuration) {
    if (currentPhase === 'fadeIn' && frame >= fadeInDuration) {
        return { phase: 'visible', frame: 0 };
    } else if (currentPhase === 'visible' && frame >= visibleDuration) {
        return { phase: 'fadeOut', frame: 0 };
    } else if (currentPhase === 'fadeOut' && frame >= fadeOutDuration) {
        return { phase: 'complete', frame: 0 };
    }
    return { phase: currentPhase, frame };
}

/**
 * Check if a bar is within the viewport (for culling optimization)
 * @param {number} x - Bar x position
 * @param {number} y - Bar y position
 * @param {number} width - Bar width
 * @param {number} height - Bar height
 * @param {number} canvasWidth - Canvas width
 * @param {number} canvasHeight - Canvas height
 * @param {number} margin - Extra margin for safety (default 100px)
 * @returns {boolean} True if bar is visible or partially visible
 */
export function isBarInViewport(x, y, width, height, canvasWidth, canvasHeight, margin = 100) {
    return !(
        x + width < -margin ||
        x > canvasWidth + margin ||
        y + height < -margin ||
        y > canvasHeight + margin
    );
}
