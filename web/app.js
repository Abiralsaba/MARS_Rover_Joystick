

(function () {
    'use strict';

    // basic setup
    const CONFIG = {
        WS_URL: `ws://${window.location.hostname || 'localhost'}:8765`,
        RECONNECT_INTERVAL: 3000,
        MAX_ANGULAR_SPEED: 0.49,
        // fast/slow mode caps
        SLOW_MAX_LINEAR: 0.5,
        FAST_MAX_LINEAR: 1.0,
        SNAP_BACK_MS: 200
    };

    // Application State
    const state = {
        mode: 'manual',
        linearX: 0,
        angularY: 0,
        angularZ: 0,
        connected: false,
        speedMode: 'slow',  // 'slow' or 'fast'
        joystickStyle: 'unified', // 'split' or 'unified'
        ws: null,
        reconnectTimer: null,
        dragging: { linear: false, angular: false }
    };

    // returns max speed based on whether fast mode is on
    function getMaxLinear() {
        return state.speedMode === 'fast' ? CONFIG.FAST_MAX_LINEAR : CONFIG.SLOW_MAX_LINEAR;
    }

    // --- DOM Elements ---

    function initializeElements() {
        elements.linearX = document.getElementById('linear-x');
        elements.angularY = document.getElementById('angular-y');
        elements.angularZ = document.getElementById('angular-z');
        elements.modeIndicator = document.getElementById('mode-indicator');
        elements.modeIcon = elements.modeIndicator?.querySelector('.mode-icon');
        elements.modeText = elements.modeIndicator?.querySelector('.mode-text');
        elements.modeBtn = document.getElementById('btn-mode');
        elements.modeBtnText = elements.modeBtn?.querySelector('.mode-btn-text');

        // New buttons
        elements.btnSpecialCmd = document.getElementById('btn-special-cmd');
        elements.btnSpeedMode = document.getElementById('btn-speed-mode');
        elements.speedModeText = elements.btnSpeedMode?.querySelector('.speed-mode-text');

        // Joystick elements
        elements.joystickSplit = document.getElementById('joystick-split');
        elements.joystickUnified = document.getElementById('joystick-unified');
        elements.styleToggle = document.getElementById('joystick-style-toggle');

        elements.joystickLinear = document.getElementById('joystick-linear');
        elements.thumbLinear = document.getElementById('thumb-linear');
        elements.joystickAngular = document.getElementById('joystick-angular');
        elements.thumbAngular = document.getElementById('thumb-angular');

        elements.joystick2D = document.getElementById('joystick-2d');
        elements.thumb2D = document.getElementById('thumb-2d');
    }

    // --- Websocket setup ---

    function connectWebSocket() {
        if (state.ws && state.ws.readyState === WebSocket.OPEN) return;

        try {
            state.ws = new WebSocket(CONFIG.WS_URL);
            state.ws.onopen = handleWebSocketOpen;
            state.ws.onclose = handleWebSocketClose;
            state.ws.onerror = handleWebSocketError;
            state.ws.onmessage = handleWebSocketMessage;
        } catch (error) {
            console.error('WebSocket connection failed:', error);
            scheduleReconnect();
        }
    }

    function handleWebSocketOpen() {
        console.log('🔗 WebSocket connected');
        state.connected = true;
        clearTimeout(state.reconnectTimer);
        sendMessage({ mode: state.mode });
    }

    function handleWebSocketClose(event) {
        console.log('🔌 WebSocket disconnected', event.code, event.reason);
        state.connected = false;
        scheduleReconnect();
    }

    function handleWebSocketError(error) {
        console.error('❌ WebSocket error:', error);
        state.connected = false;
    }

    function handleWebSocketMessage(event) {
        try {
            const data = JSON.parse(event.data);
            if (data.error) { console.error('Server error:', data.error); return; }

            if (typeof data.linear_x === 'number') updateTelemetry('linear', data.linear_x);
            if (typeof data.angular_y === 'number') updateTelemetry('angularY', data.angular_y);
            if (typeof data.angular_z === 'number') updateTelemetry('angularZ', data.angular_z);
            if (data.mode) updateModeDisplay(data.mode);
        } catch (error) {
            console.error('Failed to parse message:', error);
        }
    }

    function scheduleReconnect() {
        if (state.reconnectTimer) return;
        console.log(`🔄 Reconnecting in ${CONFIG.RECONNECT_INTERVAL / 1000}s...`);
        state.reconnectTimer = setTimeout(() => {
            state.reconnectTimer = null;
            connectWebSocket();
        }, CONFIG.RECONNECT_INTERVAL);
    }

    function sendMessage(data) {
        if (state.ws && state.ws.readyState === WebSocket.OPEN) {
            state.ws.send(JSON.stringify(data));
        }
    }

    // --- UI Update stuff ---

    function updateTelemetry(type, value) {
        const fmt = value.toFixed(2);
        if (type === 'linear' && elements.linearX) {
            elements.linearX.textContent = fmt;
            state.linearX = value;
        } else if (type === 'angularY' && elements.angularY) {
            elements.angularY.textContent = fmt;
            state.angularY = value;
        } else if (type === 'angularZ' && elements.angularZ) {
            elements.angularZ.textContent = fmt;
            state.angularZ = value;
        }
    }

    function updateModeDisplay(mode) {
        state.mode = mode;
        const isArmed = mode === 'auto';

        if (elements.modeIndicator) elements.modeIndicator.classList.toggle('armed', isArmed);
        if (elements.modeIcon) elements.modeIcon.textContent = isArmed ? '▶' : '⏹';
        if (elements.modeText) elements.modeText.textContent = isArmed ? 'ARMED' : 'DISARMED';
        if (elements.modeBtn) elements.modeBtn.classList.toggle('armed', isArmed);
        if (elements.modeBtnText) elements.modeBtnText.textContent = isArmed ? 'ARMED' : 'DISARMED';

        // Update joystick enabled state visually
        const tracks = document.querySelectorAll('.joystick-track');
        tracks.forEach(t => t.classList.toggle('disabled', !isArmed));

        // Disable other buttons when disarmed
        if (elements.btnSpecialCmd) elements.btnSpecialCmd.disabled = !isArmed;
        if (elements.btnSpeedMode) elements.btnSpeedMode.disabled = !isArmed;
        if (elements.styleToggle) elements.styleToggle.disabled = !isArmed;

        // If we just disarmed, stop the DIFF interval
        if (!isArmed && specialCmdInterval) {
            clearInterval(specialCmdInterval);
            specialCmdInterval = null;
        } else if (isArmed && specialCmdMode && !specialCmdInterval) {
            // Resume if re-armed
            startSpecialInterval();
        }
    }

    // --- Firing commands ---

    // fire velocity straight away (used by keyboard + joystick)
    function sendVelocity(linear, angular) {
        const maxLin = getMaxLinear();
        state.linearX = clamp(linear, -maxLin, maxLin);
        state.angularZ = clamp(angular, -CONFIG.MAX_ANGULAR_SPEED, CONFIG.MAX_ANGULAR_SPEED);
        sendMessage({ linear: state.linearX, angular: state.angularZ });
        updateTelemetry('linear', state.linearX);
        updateTelemetry('angularZ', state.angularZ);
    }

    // --- Special Modes ---

    // toggle state: diff -> 360
    let specialCmdInterval = null;
    let specialCmdMode = 'diff'; // 'diff' or '360'

    function sendSpecialCommand() {
        if (specialCmdMode === 'diff') {
            sendMessage({ differential: true });
        } else {
            sendMessage({ rotate_360: true });
        }
    }

    function startSpecialInterval() {
        if (specialCmdInterval) clearInterval(specialCmdInterval);
        sendSpecialCommand();
        specialCmdInterval = setInterval(sendSpecialCommand, 100);
    }

    function updateSpecialCmdUI() {
        const btn = elements.btnSpecialCmd;
        if (!btn) return;
        const iconEl = btn.querySelector('.special-btn-icon');
        const textEl = btn.querySelector('.special-btn-text');
        btn.classList.remove('mode-diff', 'mode-360');

        if (specialCmdMode === 'diff') {
            btn.classList.add('held', 'mode-diff');
            if (iconEl) iconEl.textContent = '↔️';
            if (textEl) textEl.textContent = 'DIFF ON';
            updateTelemetry('angularY', 404);
        } else {
            btn.classList.add('held', 'mode-360');
            if (iconEl) iconEl.textContent = '🔄';
            if (textEl) textEl.textContent = '360° ON';
            updateTelemetry('angularY', 200);
        }
    }

    // toggles between diff and 360 mode
    function toggleSpecialCommand() {
        if (state.mode !== 'auto') return;

        // cancel whatever was running before
        if (specialCmdMode === 'diff') {
            sendMessage({ differential: false });
            specialCmdMode = '360';
        } else {
            sendMessage({ rotate_360: false });
            specialCmdMode = 'diff';
        }

        updateSpecialCmdUI();
        startSpecialInterval();
    }

    // flip between slow and fast mode
    function toggleSpeedMode() {
        if (state.mode !== 'auto') return;
        state.speedMode = state.speedMode === 'slow' ? 'fast' : 'slow';
        updateSpeedModeDisplay();

        // recalculate boundaries if we're currently holding the stick
        if (state.linearX !== 0) {
            const maxLin = getMaxLinear();
            state.linearX = clamp(state.linearX, -maxLin, maxLin);
            sendMessage({ linear: state.linearX, angular: state.angularZ });
            updateTelemetry('linear', state.linearX);
        }
        console.log(`⚡ Speed mode: ${state.speedMode.toUpperCase()}`);
    }

    function updateSpeedModeDisplay() {
        const isFast = state.speedMode === 'fast';
        if (elements.btnSpeedMode) {
            elements.btnSpeedMode.classList.toggle('fast', isFast);
        }
        if (elements.speedModeText) {
            elements.speedModeText.textContent = isFast ? 'FAST MODE' : 'SLOW MODE';
        }

        // change the emoji depending on the mode
        const iconEl = elements.btnSpeedMode?.querySelector('.special-btn-icon');
        if (iconEl) {
            iconEl.textContent = isFast ? '⚡' : '🐢';
        }
    }

    // --- Joystick Math & Drags ---

    function clamp(v, min, max) {
        return Math.max(min, Math.min(max, v));
    }

    // maps pointer position to a -1 to +1 range
    // vertical: +1 = fwd, -1 = bwd
    // horizontal: +1 = left, -1 = right
    function pointerToValue(track, clientX, clientY, axis) {
        const rect = track.getBoundingClientRect();
        let rawRatio;

        if (axis === 'vertical') {
            rawRatio = (clientY - rect.top) / rect.height;
        } else {
            rawRatio = (clientX - rect.left) / rect.width;
        }

        // Proportional value (-1 to 1), smooth like original
        const val = clamp(1 - 2 * rawRatio, -1, 1);

        // Small deadzone to prevent accidental drift
        if (Math.abs(val) < 0.05) return 0;
        return val;
    }

    /** Position the thumb element to reflect a value (-1 … +1). */
    function setThumbPosition(thumb, track, value, axis) {
        if (axis === 'vertical') {
            const pct = ((1 - value) / 2) * 100;
            thumb.style.top = `${pct}%`;
            thumb.style.left = '';
        } else {
            const pct = ((1 - value) / 2) * 100;
            thumb.style.left = `${pct}%`;
            thumb.style.top = '';
        }
    }

    function setupJoystick(trackEl, thumbEl, axis, onUpdate) {
        let dragging = false;
        let activeTouchId = null;   // track which finger owns this joystick

        function start(clientX, clientY) {
            if (state.joystickStyle !== 'split') return;
            if (state.mode !== 'auto') return;
            // Block linear joystick when 360° mode is active
            if (axis === 'vertical' && specialCmdMode === '360') return;
            dragging = true;
            state.dragging[axis === 'vertical' ? 'linear' : 'angular'] = true;
            thumbEl.classList.add('active');
            trackEl.classList.add('active');
            move(clientX, clientY);
        }

        function move(clientX, clientY) {
            if (!dragging) return;
            const val = pointerToValue(trackEl, clientX, clientY, axis);
            setThumbPosition(thumbEl, trackEl, val, axis);
            onUpdate(val);
        }

        function end() {
            if (!dragging) return;
            dragging = false;
            activeTouchId = null;
            state.dragging[axis === 'vertical' ? 'linear' : 'angular'] = false;
            thumbEl.classList.remove('active');
            trackEl.classList.remove('active');
            // Snap thumb back to center
            thumbEl.style.transition = `top ${CONFIG.SNAP_BACK_MS}ms ease, left ${CONFIG.SNAP_BACK_MS}ms ease`;
            setThumbPosition(thumbEl, trackEl, 0, axis);
            setTimeout(() => { thumbEl.style.transition = ''; }, CONFIG.SNAP_BACK_MS);
            onUpdate(0);
            // Instantly send zero when released
            if (axis === 'vertical') {
                sendVelocity(0, state.angularZ);
            } else {
                sendVelocity(state.linearX, 0);
            }
        }

        // Mouse
        trackEl.addEventListener('mousedown', (e) => { e.preventDefault(); start(e.clientX, e.clientY); });
        window.addEventListener('mousemove', (e) => move(e.clientX, e.clientY));
        window.addEventListener('mouseup', () => end());

        // Touch — track by identifier so both joysticks work simultaneously
        trackEl.addEventListener('touchstart', (e) => {
            e.preventDefault();
            // Grab the touch that started on this track
            const t = e.changedTouches[0];
            activeTouchId = t.identifier;
            start(t.clientX, t.clientY);
        }, { passive: false });

        window.addEventListener('touchmove', (e) => {
            if (!dragging || activeTouchId === null) return;
            // Find OUR finger among all active touches
            for (let i = 0; i < e.touches.length; i++) {
                if (e.touches[i].identifier === activeTouchId) {
                    move(e.touches[i].clientX, e.touches[i].clientY);
                    return;
                }
            }
        }, { passive: false });

        window.addEventListener('touchend', (e) => {
            if (activeTouchId === null) return;
            // Only end if OUR finger was lifted
            for (let i = 0; i < e.changedTouches.length; i++) {
                if (e.changedTouches[i].identifier === activeTouchId) {
                    end();
                    return;
                }
            }
        });

        window.addEventListener('touchcancel', (e) => {
            if (activeTouchId === null) return;
            for (let i = 0; i < e.changedTouches.length; i++) {
                if (e.changedTouches[i].identifier === activeTouchId) {
                    end();
                    return;
                }
            }
        });

        // Initialise thumb at center
        setThumbPosition(thumbEl, trackEl, 0, axis);
    }

    // ─── Unified 2D Joystick Logic ──────────────────────────────────────────

    function setup2DJoystick(trackEl, thumbEl, onUpdate) {
        let dragging = false;
        let activeTouchId = null;

        function start(clientX, clientY) {
            if (state.joystickStyle !== 'unified') return;
            if (state.mode !== 'auto') return;
            dragging = true;
            state.dragging.linear = true;
            state.dragging.angular = true;
            thumbEl.classList.add('active');
            trackEl.classList.add('active');
            move(clientX, clientY);
        }

        function move(clientX, clientY) {
            if (!dragging) return;
            const rect = trackEl.getBoundingClientRect();
            const radius = rect.width / 2;
            const centerX = rect.left + radius;
            const centerY = rect.top + radius;

            // Distance from center in pixels
            let dx = clientX - centerX;
            let dy = centerY - clientY; // Invert Y: up = positive

            // Constrain to circle (like a PS4 analog stick)
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > radius) {
                dx = (dx / dist) * radius;
                dy = (dy / dist) * radius;
            }

            // Proportional output: -1 to 1
            let propX = dx / radius;  // right = positive (angular)
            let propY = dy / radius;  // up = positive (linear)

            // Small deadzone (5%) to prevent drift
            const DEADZONE = 0.05;
            if (Math.abs(propX) < DEADZONE) propX = 0;
            if (Math.abs(propY) < DEADZONE) propY = 0;

            // When 360° mode is active, disable linear (Y) axis
            if (specialCmdMode === '360') {
                propY = 0;
                dy = 0;
            }

            // Smooth visual thumb position (constrained to circle)
            const visualX = 50 + (dx / radius) * 50;
            const visualY = 50 - (dy / radius) * 50;
            thumbEl.style.left = `${visualX}%`;
            thumbEl.style.top = `${visualY}%`;

            onUpdate(propY, -propX); // linear (Y), angular (X inverted: left=positive)
        }

        function end() {
            if (!dragging) return;
            dragging = false;
            activeTouchId = null;
            state.dragging.linear = false;
            state.dragging.angular = false;
            thumbEl.classList.remove('active');
            trackEl.classList.remove('active');

            // Snap center
            thumbEl.style.transition = `top ${CONFIG.SNAP_BACK_MS}ms ease, left ${CONFIG.SNAP_BACK_MS}ms ease`;
            thumbEl.style.left = '50%';
            thumbEl.style.top = '50%';
            setTimeout(() => { thumbEl.style.transition = ''; }, CONFIG.SNAP_BACK_MS);

            onUpdate(0, 0);
            sendVelocity(0, 0);
        }

        trackEl.addEventListener('mousedown', (e) => { e.preventDefault(); start(e.clientX, e.clientY); });
        window.addEventListener('mousemove', (e) => move(e.clientX, e.clientY));
        window.addEventListener('mouseup', () => end());

        trackEl.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const t = e.changedTouches[0];
            activeTouchId = t.identifier;
            start(t.clientX, t.clientY);
        }, { passive: false });

        window.addEventListener('touchmove', (e) => {
            if (!dragging || activeTouchId === null) return;
            for (let i = 0; i < e.touches.length; i++) {
                if (e.touches[i].identifier === activeTouchId) {
                    move(e.touches[i].clientX, e.touches[i].clientY);
                    return;
                }
            }
        }, { passive: false });

        const handleTouchEnd = (e) => {
            if (activeTouchId === null) return;
            for (let i = 0; i < e.changedTouches.length; i++) {
                if (e.changedTouches[i].identifier === activeTouchId) {
                    end();
                    return;
                }
            }
        };
        window.addEventListener('touchend', handleTouchEnd);
        window.addEventListener('touchcancel', handleTouchEnd);

        thumbEl.style.left = '50%';
        thumbEl.style.top = '50%';
    }

    // ─── Mode / Emergency ────────────────────────────────────────────────────

    function toggleMode() {
        const newMode = state.mode === 'manual' ? 'auto' : 'manual';
        state.mode = newMode;
        state.linearX = 0;
        state.angularZ = 0;
        sendMessage({ mode: newMode });
        updateModeDisplay(newMode);
        resetThumbs();
    }

    function resetThumbs() {
        if (elements.thumbLinear && elements.joystickLinear) {
            elements.thumbLinear.style.transition = `top ${CONFIG.SNAP_BACK_MS}ms ease`;
            setThumbPosition(elements.thumbLinear, elements.joystickLinear, 0, 'vertical');
            setTimeout(() => { elements.thumbLinear.style.transition = ''; }, CONFIG.SNAP_BACK_MS);
        }
        if (elements.thumbAngular && elements.joystickAngular) {
            elements.thumbAngular.style.transition = `left ${CONFIG.SNAP_BACK_MS}ms ease`;
            setThumbPosition(elements.thumbAngular, elements.joystickAngular, 0, 'horizontal');
            setTimeout(() => { elements.thumbAngular.style.transition = ''; }, CONFIG.SNAP_BACK_MS);
        }
        if (elements.thumb2D && elements.joystick2D) {
            elements.thumb2D.style.transition = `top ${CONFIG.SNAP_BACK_MS}ms ease, left ${CONFIG.SNAP_BACK_MS}ms ease`;
            elements.thumb2D.style.left = '50%';
            elements.thumb2D.style.top = '50%';
            setTimeout(() => { elements.thumb2D.style.transition = ''; }, CONFIG.SNAP_BACK_MS);
        }
    }

    // ─── Event Listeners ─────────────────────────────────────────────────────

    function setupEventListeners() {
        if (elements.modeBtn) elements.modeBtn.addEventListener('click', toggleMode);

        // Special command button — toggle DIFF ↔ 360°
        if (elements.btnSpecialCmd) {
            elements.btnSpecialCmd.addEventListener('click', (e) => { e.preventDefault(); toggleSpecialCommand(); });
        }

        // Speed mode toggle
        if (elements.btnSpeedMode) elements.btnSpeedMode.addEventListener('click', toggleSpeedMode);

        if (elements.styleToggle) {
            elements.styleToggle.addEventListener('change', (e) => {
                const isSplit = e.target.checked;
                state.joystickStyle = isSplit ? 'split' : 'unified';
                if (elements.joystickSplit) {
                    elements.joystickSplit.style.display = isSplit ? 'flex' : 'none';
                }
                if (elements.joystickUnified) {
                    elements.joystickUnified.style.display = isSplit ? 'none' : 'flex';
                }
                // Send stop command just in case any drags are active
                sendVelocity(0, 0);
                resetThumbs();
            });
        }

        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible' && !state.connected) connectWebSocket();
        });

        window.addEventListener('beforeunload', () => {
            if (state.ws) { sendMessage({ stop: true }); state.ws.close(); }
        });
    }

    // ─── Init ────────────────────────────────────────────────────────────────

    function init() {
        console.log('🚀 Rover Control System initializing...');

        initializeElements();
        setupEventListeners();

        // Setup joysticks
        if (elements.joystickLinear && elements.thumbLinear) {
            setupJoystick(
                elements.joystickLinear, elements.thumbLinear, 'vertical',
                (val) => {
                    const maxLin = getMaxLinear();
                    sendVelocity(val * maxLin, state.angularZ);
                }
            );
        }
        if (elements.joystickAngular && elements.thumbAngular) {
            setupJoystick(
                elements.joystickAngular, elements.thumbAngular, 'horizontal',
                (val) => {
                    sendVelocity(state.linearX, val * CONFIG.MAX_ANGULAR_SPEED);
                }
            );
        }

        if (elements.joystick2D && elements.thumb2D) {
            setup2DJoystick(
                elements.joystick2D, elements.thumb2D,
                (linVal, angVal) => {
                    const maxLin = getMaxLinear();
                    sendVelocity(linVal * maxLin, angVal * CONFIG.MAX_ANGULAR_SPEED);
                }
            );
        }

        connectWebSocket();

        // Start DIFF mode by default
        updateSpecialCmdUI();
        startSpecialInterval();
        updateModeDisplay('manual');
        updateSpeedModeDisplay();

        console.log('✅ Rover Control System ready');
        console.log('📡 Connecting to:', CONFIG.WS_URL);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
