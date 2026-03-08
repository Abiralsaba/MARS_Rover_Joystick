

(function () {
    'use strict';

    // basic setup
    const CONFIG = {
        ROSBRIDGE_URL: `ws://${window.location.hostname || 'localhost'}:9090`,
        RECONNECT_INTERVAL: 2000,
        MAX_ANGULAR_SPEED: 0.49,
        PUBLISH_RATE_MS: 100,  // Continuous publish at 10Hz while joystick held
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
        ros: null,
        cmdVelPub: null,
        cmdVelSub: null,
        reconnectTimer: null,
        continuousPublishTimer: null,
        dragging: { linear: false, angular: false }
    };

    // returns max speed based on whether fast mode is on
    function getMaxLinear() {
        return state.speedMode === 'fast' ? CONFIG.FAST_MAX_LINEAR : CONFIG.SLOW_MAX_LINEAR;
    }

    // --- DOM Elements ---
    const elements = {};

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

    // --- ROSLIB setup ---

    function connectWebSocket() {
        if (state.ros && state.ros.isConnected) return;

        try {
            state.ros = new ROSLIB.Ros({
                url: CONFIG.ROSBRIDGE_URL
            });

            state.ros.on('connection', handleWebSocketOpen);
            state.ros.on('close', handleWebSocketClose);
            state.ros.on('error', handleWebSocketError);
        } catch (error) {
            console.error('ROS connection failed:', error);
            scheduleReconnect();
        }
    }

    function setupRosTopics() {
        // Publisher
        state.cmdVelPub = new ROSLIB.Topic({
            ros: state.ros,
            name: '/cmd_vel',
            messageType: 'geometry_msgs/Twist'
        });

        // Subscriber (Telemetry feedback)
        state.cmdVelSub = new ROSLIB.Topic({
            ros: state.ros,
            name: '/cmd_vel',
            messageType: 'geometry_msgs/Twist'
        });

        state.cmdVelSub.subscribe(handleTelemetryMessage);
    }

    function handleWebSocketOpen() {
        console.log('🔗 Connected to rosbridge');
        state.connected = true;
        clearTimeout(state.reconnectTimer);
        setupRosTopics();
        document.title = '✅ CONNECTED - Rover Control';
    }

    function handleWebSocketClose() {
        console.log('🔌 Disconnected from rosbridge');
        state.connected = false;
        document.title = '❌ DISCONNECTED - Rover Control';
        scheduleReconnect();
    }

    function handleWebSocketError(error) {
        console.error('❌ ROS Error:', error);
        state.connected = false;
    }

    function handleTelemetryMessage(msg) {
        updateTelemetry('linear', msg.linear.x);
        // Don't update angular Y from subscription when special mode is active
        // (it sends 404/200 codes that would cause UI flicker)
        if (!specialCmdInterval) {
            updateTelemetry('angularY', msg.angular.y);
        }
        updateTelemetry('angularZ', msg.angular.z);
    }

    function scheduleReconnect() {
        if (state.reconnectTimer) return;
        console.log(`🔄 Reconnecting in ${CONFIG.RECONNECT_INTERVAL / 1000}s...`);
        state.reconnectTimer = setTimeout(() => {
            state.reconnectTimer = null;
            connectWebSocket();
        }, CONFIG.RECONNECT_INTERVAL);
    }

    function publishTwist(linear_x, angular_y, angular_z) {
        if (!state.connected || !state.cmdVelPub) return;

        // Safety guard: do not publish if not ARMED
        if (state.mode !== 'auto') {
            linear_x = 0;
            angular_y = 0;
            angular_z = 0;
        }

        const twist = new ROSLIB.Message({
            linear: { x: linear_x, y: 0.0, z: 0.0 },
            angular: { x: 0.0, y: angular_y, z: angular_z }
        });
        state.cmdVelPub.publish(twist);
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
        publishTwist(state.linearX, 0.0, state.angularZ);
        updateTelemetry('linear', state.linearX);
        updateTelemetry('angularZ', state.angularZ);
    }

    // Continuous publish: keeps sending last velocity while joystick is held
    function startContinuousPublish() {
        if (state.continuousPublishTimer) return;
        state.continuousPublishTimer = setInterval(() => {
            if (state.dragging.linear || state.dragging.angular) {
                publishTwist(state.linearX, 0.0, state.angularZ);
            } else {
                stopContinuousPublish();
            }
        }, CONFIG.PUBLISH_RATE_MS);
    }

    function stopContinuousPublish() {
        if (state.continuousPublishTimer) {
            clearInterval(state.continuousPublishTimer);
            state.continuousPublishTimer = null;
        }
    }

    // --- Special Modes ---

    // toggle state: diff -> 360
    let specialCmdInterval = null;
    let specialCmdMode = 'diff'; // 'diff' or '360'

    function sendSpecialCommand() {
        if (specialCmdMode === 'diff') {
            // Hijacks angular.y in Twist for UI, preserve joystick values
            publishTwist(state.linearX, 404.0, state.angularZ);
        } else {
            // Hijacks angular.y in Twist for UI, preserve joystick values
            publishTwist(state.linearX, 200.0, state.angularZ);
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
            if (iconEl) iconEl.innerHTML = '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3v12"/><path d="M18 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"/><path d="M6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"/><path d="M18 9c0 4-4 6-12 6"/></svg>';
            if (textEl) textEl.textContent = 'DIFF ON';
            updateTelemetry('angularY', 404);
        } else {
            btn.classList.add('held', 'mode-360');
            if (iconEl) iconEl.innerHTML = '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-6.22-8.56"/><polyline points="21 3 21 9 15 9"/></svg>';
            if (textEl) textEl.textContent = '360° ON';
            updateTelemetry('angularY', 200);
        }
    }

    // toggles between diff and 360 mode
    function toggleSpecialCommand() {
        if (state.mode !== 'auto') return;

        // cancel whatever was running before
        // The release zeroes everything out automatically, so we'll just switch the mode
        if (specialCmdMode === 'diff') {
            publishTwist(0.0, 0.0, 0.0);
            specialCmdMode = '360';
        } else {
            publishTwist(0.0, 0.0, 0.0);
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
            publishTwist(state.linearX, 0.0, state.angularZ);
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
            startContinuousPublish();
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
            stopContinuousPublish();
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
            startContinuousPublish();
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
            stopContinuousPublish();

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

        // When switching to manual, ensure motors stop immediately
        if (newMode === 'manual') {
            publishTwist(0.0, 0.0, 0.0);
        }

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

    const keysDown = new Set();
    const keyMap = {
        'KeyW': 'up', 'ArrowUp': 'up',
        'KeyS': 'down', 'ArrowDown': 'down',
        'KeyA': 'left', 'ArrowLeft': 'left',
        'KeyD': 'right', 'ArrowRight': 'right'
    };

    function recalcFromKeys() {
        let lin = 0, ang = 0;
        const maxLin = getMaxLinear();
        if (keysDown.has('up')) lin += maxLin;
        if (keysDown.has('down')) lin -= maxLin;
        if (keysDown.has('left')) ang += CONFIG.MAX_ANGULAR_SPEED;
        if (keysDown.has('right')) ang -= CONFIG.MAX_ANGULAR_SPEED;

        state.linearX = clamp(lin, -maxLin, maxLin);
        state.angularZ = clamp(ang, -CONFIG.MAX_ANGULAR_SPEED, CONFIG.MAX_ANGULAR_SPEED);

        publishTwist(state.linearX, 0.0, state.angularZ);
        updateTelemetry('linear', state.linearX);
        updateTelemetry('angularZ', state.angularZ);
    }

    function handleKeyDown(event) {
        if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') return;
        if (event.code === 'Space') { event.preventDefault(); toggleMode(); return; }

        const dir = keyMap[event.code];
        if (dir && !event.repeat && state.mode === 'auto') {
            event.preventDefault();
            keysDown.add(dir);
            recalcFromKeys();
        }
    }

    function handleKeyUp(event) {
        const dir = keyMap[event.code];
        if (dir) {
            event.preventDefault();
            keysDown.delete(dir);
            recalcFromKeys();
        }
    }

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
                publishTwist(0.0, 0.0, 0.0);
                resetThumbs();
            });
        }

        document.addEventListener('keydown', handleKeyDown);
        document.addEventListener('keyup', handleKeyUp);

        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible' && !state.connected) connectWebSocket();
        });

        window.addEventListener('beforeunload', () => {
            if (state.connected) {
                publishTwist(0.0, 0.0, 0.0);
                state.ros.close();
            }
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
        console.log('📡 Connecting to:', CONFIG.ROSBRIDGE_URL);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
