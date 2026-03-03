/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║              MARCH ROVER - Frontend Control Application                      ║
 * ║                   Joystick Edition - Slide to Drive! 🎮                      ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 *
 * Two slider joysticks:
 *   - Vertical slider: Controls linear.x (forward/backward)
 *   - Horizontal slider: Controls angular.z (left/right turn)
 *
 * Keyboard controls still work (WASD / Arrows / Space / Esc).
 *
 * Author: Abiral Saba (@Abiralsaba)
 * Project: MARCH ROVER Controller
 * License: MIT
 */

(function () {
    'use strict';

    // Configuration
    const CONFIG = {
        WS_URL: `ws://${window.location.hostname || 'localhost'}:8765`,
        RECONNECT_INTERVAL: 3000,
        MAX_LINEAR_SPEED: 1.0,
        MAX_ANGULAR_SPEED: 1.0,
        ACCELERATION_STEP: 0.02,
        DECELERATION_STEP: 0.3,
        RAMP_INTERVAL: 50,
        SNAP_BACK_MS: 200
    };

    // Application State
    const state = {
        mode: 'manual',
        linearX: 0,
        angularZ: 0,
        targetLinearX: 0,
        targetAngularZ: 0,
        connected: false,
        emergencyStop: false,
        ws: null,
        reconnectTimer: null,
        rampingInterval: null,
        dragging: { linear: false, angular: false }
    };

    // DOM Elements
    const elements = {};

    // ─── DOM Init ────────────────────────────────────────────────────────────

    function initializeElements() {
        elements.connectionStatus = document.getElementById('connection-status');
        elements.statusText = elements.connectionStatus?.querySelector('.status-text');
        elements.linearX = document.getElementById('linear-x');
        elements.angularZ = document.getElementById('angular-z');
        elements.modeIndicator = document.getElementById('mode-indicator');
        elements.modeIcon = elements.modeIndicator?.querySelector('.mode-icon');
        elements.modeText = elements.modeIndicator?.querySelector('.mode-text');
        elements.modeBtn = document.getElementById('btn-mode');
        elements.modeBtnText = elements.modeBtn?.querySelector('.mode-btn-text');
        elements.emergencyBtn = document.getElementById('btn-emergency');
        elements.helpToggle = document.getElementById('help-toggle');
        elements.helpContent = document.getElementById('help-content');

        // Joystick elements
        elements.joystickLinear = document.getElementById('joystick-linear');
        elements.thumbLinear = document.getElementById('thumb-linear');
        elements.joystickAngular = document.getElementById('joystick-angular');
        elements.thumbAngular = document.getElementById('thumb-angular');
    }

    // ─── WebSocket ───────────────────────────────────────────────────────────

    function connectWebSocket() {
        if (state.ws && state.ws.readyState === WebSocket.OPEN) return;
        updateConnectionStatus('connecting');

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
        updateConnectionStatus('connected');
        clearTimeout(state.reconnectTimer);
        sendMessage({ mode: state.mode });
    }

    function handleWebSocketClose(event) {
        console.log('🔌 WebSocket disconnected', event.code, event.reason);
        state.connected = false;
        updateConnectionStatus('disconnected');
        scheduleReconnect();
    }

    function handleWebSocketError(error) {
        console.error('❌ WebSocket error:', error);
        state.connected = false;
        updateConnectionStatus('disconnected');
    }

    function handleWebSocketMessage(event) {
        try {
            const data = JSON.parse(event.data);
            if (data.error) { console.error('Server error:', data.error); return; }

            if (typeof data.linear_x === 'number') updateTelemetry('linear', data.linear_x);
            if (typeof data.angular_z === 'number') updateTelemetry('angular', data.angular_z);
            if (data.mode) updateModeDisplay(data.mode);
            if (typeof data.emergency_stop === 'boolean') {
                state.emergencyStop = data.emergency_stop;
                updateEmergencyDisplay();
            }
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

    // ─── UI Updates ──────────────────────────────────────────────────────────

    function updateConnectionStatus(status) {
        if (!elements.connectionStatus) return;
        elements.connectionStatus.classList.remove('connected', 'connecting', 'disconnected');
        elements.connectionStatus.classList.add(status);
        const texts = { connected: 'Connected', connecting: 'Connecting...', disconnected: 'Disconnected' };
        if (elements.statusText) elements.statusText.textContent = texts[status] || 'Unknown';
    }

    function updateTelemetry(type, value) {
        const fmt = value.toFixed(2);
        if (type === 'linear' && elements.linearX) {
            elements.linearX.textContent = fmt;
            state.linearX = value;
        } else if (type === 'angular' && elements.angularZ) {
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
    }

    function updateEmergencyDisplay() {
        if (elements.emergencyBtn) {
            elements.emergencyBtn.classList.toggle('active', state.emergencyStop);
        }
    }

    // ─── Velocity Ramping ────────────────────────────────────────────────────

    function startRampingLoop() {
        if (state.rampingInterval) return;

        state.rampingInterval = setInterval(() => {
            let changed = false;

            // Ramp linear
            const ld = state.targetLinearX - state.linearX;
            if (Math.abs(ld) > 0.01) {
                // Fast decel only when joystick is released (target = 0)
                const releasing = state.targetLinearX === 0;
                const step = releasing ? CONFIG.DECELERATION_STEP : CONFIG.ACCELERATION_STEP;
                state.linearX = ld > 0
                    ? Math.min(state.linearX + step, state.targetLinearX, CONFIG.MAX_LINEAR_SPEED)
                    : Math.max(state.linearX - step, state.targetLinearX, -CONFIG.MAX_LINEAR_SPEED);
                changed = true;
            } else if (state.linearX !== state.targetLinearX) {
                state.linearX = state.targetLinearX;
                changed = true;
            }

            // Ramp angular
            const ad = state.targetAngularZ - state.angularZ;
            if (Math.abs(ad) > 0.01) {
                const releasing = state.targetAngularZ === 0;
                const step = releasing ? CONFIG.DECELERATION_STEP : CONFIG.ACCELERATION_STEP;
                state.angularZ = ad > 0
                    ? Math.min(state.angularZ + step, state.targetAngularZ, CONFIG.MAX_ANGULAR_SPEED)
                    : Math.max(state.angularZ - step, state.targetAngularZ, -CONFIG.MAX_ANGULAR_SPEED);
                changed = true;
            } else if (state.angularZ !== state.targetAngularZ) {
                state.angularZ = state.targetAngularZ;
                changed = true;
            }

            sendMessage({ linear: state.linearX, angular: state.angularZ });
            if (changed) {
                updateTelemetry('linear', state.linearX);
                updateTelemetry('angular', state.angularZ);
            }
        }, CONFIG.RAMP_INTERVAL);
    }

    // ─── Joystick Drag Logic ─────────────────────────────────────────────────

    function clamp(v, min, max) {
        return Math.max(min, Math.min(max, v));
    }

    /**
     * Convert a pointer position to a normalised value (-1 … +1).
     * Vertical: top = +1 (forward), bottom = -1 (backward).
     * Horizontal: left = +1 (angular positive = turn left), right = -1.
     */
    function pointerToValue(track, clientX, clientY, axis) {
        const rect = track.getBoundingClientRect();
        if (axis === 'vertical') {
            const ratio = (clientY - rect.top) / rect.height;
            return clamp(1 - 2 * ratio, -1, 1);
        } else {
            const ratio = (clientX - rect.left) / rect.width;
            return clamp(1 - 2 * ratio, -1, 1);
        }
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
            if (state.mode !== 'auto' || state.emergencyStop) return;
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

    // ─── Mode / Emergency ────────────────────────────────────────────────────

    function toggleMode() {
        const newMode = state.mode === 'manual' ? 'auto' : 'manual';
        state.mode = newMode;
        state.targetLinearX = 0;
        state.targetAngularZ = 0;
        sendMessage({ mode: newMode });
        updateModeDisplay(newMode);
        resetThumbs();
    }

    function triggerEmergencyStop() {
        state.emergencyStop = true;
        state.targetLinearX = 0;
        state.targetAngularZ = 0;
        state.mode = 'manual';
        sendMessage({ emergency_stop: true });
        updateEmergencyDisplay();
        updateModeDisplay('manual');
        resetThumbs();
    }

    function releaseEmergencyStop() {
        state.emergencyStop = false;
        sendMessage({ emergency_stop: false });
        updateEmergencyDisplay();
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
    }

    // ─── Keyboard Controls ───────────────────────────────────────────────────

    const keysDown = new Set();

    function recalcTargetsFromKeys() {
        let lin = 0, ang = 0;
        if (keysDown.has('up'))    lin += 1;
        if (keysDown.has('down'))  lin -= 1;
        if (keysDown.has('left'))  ang += 0.5;
        if (keysDown.has('right')) ang -= 0.5;
        state.targetLinearX = clamp(lin, -CONFIG.MAX_LINEAR_SPEED, CONFIG.MAX_LINEAR_SPEED);
        state.targetAngularZ = clamp(ang, -CONFIG.MAX_ANGULAR_SPEED, CONFIG.MAX_ANGULAR_SPEED);
    }

    const keyMap = {
        'KeyW': 'up', 'ArrowUp': 'up',
        'KeyS': 'down', 'ArrowDown': 'down',
        'KeyA': 'left', 'ArrowLeft': 'left',
        'KeyD': 'right', 'ArrowRight': 'right'
    };

    function handleKeyDown(event) {
        if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') return;
        if (event.code === 'Space') { event.preventDefault(); toggleMode(); return; }
        if (event.code === 'Escape') { event.preventDefault(); triggerEmergencyStop(); return; }

        const dir = keyMap[event.code];
        if (dir && !event.repeat && state.mode === 'auto' && !state.emergencyStop) {
            event.preventDefault();
            keysDown.add(dir);
            recalcTargetsFromKeys();
        }
    }

    function handleKeyUp(event) {
        const dir = keyMap[event.code];
        if (dir) {
            event.preventDefault();
            keysDown.delete(dir);
            recalcTargetsFromKeys();
        }
    }

    // ─── Event Listeners ─────────────────────────────────────────────────────

    function setupEventListeners() {
        if (elements.modeBtn) elements.modeBtn.addEventListener('click', toggleMode);

        if (elements.emergencyBtn) {
            elements.emergencyBtn.addEventListener('click', () => {
                state.emergencyStop ? releaseEmergencyStop() : triggerEmergencyStop();
            });
        }

        if (elements.helpToggle && elements.helpContent) {
            elements.helpToggle.addEventListener('click', () => {
                elements.helpToggle.classList.toggle('open');
                elements.helpContent.classList.toggle('open');
            });
        }

        document.addEventListener('keydown', handleKeyDown);
        document.addEventListener('keyup', handleKeyUp);

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
                (val) => { state.targetLinearX = val * CONFIG.MAX_LINEAR_SPEED; }
            );
        }
        if (elements.joystickAngular && elements.thumbAngular) {
            setupJoystick(
                elements.joystickAngular, elements.thumbAngular, 'horizontal',
                (val) => { state.targetAngularZ = val * CONFIG.MAX_ANGULAR_SPEED; }
            );
        }

        startRampingLoop();
        connectWebSocket();

        updateModeDisplay('manual');
        updateConnectionStatus('disconnected');

        console.log('✅ Rover Control System ready');
        console.log('📡 Connecting to:', CONFIG.WS_URL);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
