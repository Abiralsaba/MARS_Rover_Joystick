# 🚀 MARCH ROVER Controller

> **Control your ROS2 rover from any browser - no app installation needed!**

Hey there! 👋 Welcome to the MARCH ROVER Controller - a complete, fully functional offline rover control system with ROS2 integration, WebSocket communication, and a sleek modern web interface.

[![ROS2](https://img.shields.io/badge/ROS2-Jazzy-blue)](https://docs.ros.org/en/jazzy/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Made with Love](https://img.shields.io/badge/Made%20with-❤️-red)](https://github.com/Abiralsaba)

![Rover Control UI](./web/preview.png)

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🤖 **ROS2 Integration** | Publishes `geometry_msgs/Twist` to `/cmd_vel` - works with any ROS2 robot! |
| 🌐 **WebSocket Communication** | Real-time bidirectional control - no lag, just smooth driving |
| 📱 **Responsive UI** | Works beautifully on mobile, tablet, and desktop |
| 🎯 **Smooth Velocity Ramping** | Gradual acceleration/deceleration - no jerky movements |
| 🔄 **Dual Control Modes** | DISARMED (safe) and ARMED (ready to roll!) |
| 🛑 **Emergency Stop** | One button to stop everything - safety first! |
| ⌨️ **Keyboard Controls** | WASD, arrow keys, Q/E for differential drive |
| 🔌 **Auto-Reconnect** | Lost WiFi? We'll reconnect automatically |
| 📊 **Live Telemetry** | See linear.x and angular.z in real-time |
| 📴 **100% Offline** | No cloud, no subscriptions - it's all yours |

## Project Structure

```
rover_project/
├── rover_bridge.py     # ROS2 WebSocket bridge
├── web/
│   ├── index.html      # Main HTML interface
│   ├── style.css       # Responsive styling
│   └── app.js          # Frontend logic
└── README.md           # This file
```

## Requirements

### System Requirements
- Ubuntu 22.04+ or macOS
- ROS2 Jazzy (or compatible)
- Python 3.10+
- Modern web browser

### Python Dependencies
```bash
pip install websockets
```

### ROS2 Dependencies
- `rclpy`
- `geometry_msgs`

## Installation

### 1. Install ROS2 Jazzy
Follow the [official ROS2 installation guide](https://docs.ros.org/en/jazzy/Installation.html).

### 2. Install Python Dependencies
```bash
pip3 install websockets
```

### 3. Clone or Copy the Project
```bash
cd ~/Documents
mkdir -p "March Rover"
cd "March Rover"
# Copy project files here
```

## Running the System

### Step 1: Source ROS2 Environment
```bash
source /opt/ros/jazzy/setup.bash
```

### Step 2: Start the ROS2 Bridge
```bash
cd rover_project
python3 rover_bridge.py
```

You should see:
```
============================================================
🚀 ROVER BRIDGE - ROS2 WebSocket Control System
============================================================
📡 ROS2 Node: rover_bridge
📤 Publishing to: /cmd_vel
📥 Subscribing to: /cmd_vel
🌐 WebSocket Server: ws://0.0.0.0:8765
============================================================
```

### Step 3: Start the Web Server
In a new terminal:
```bash
cd rover_project/web
python3 -m http.server 8000
```

### Step 4: Open the Interface

**Local access:**
```
http://localhost:8000
```

**Mobile/Network access:**
1. Find your computer's IP:
   ```bash
   ip addr show | grep inet   # Linux
   ifconfig | grep inet       # macOS
   ```
2. Open on mobile:
   ```
   http://<YOUR-IP>:8000
   ```

## Usage

### Control Modes

| Mode | Button Color | Description |
|------|--------------|-------------|
| **DISARMED** | Red | Safe mode, no movement |
| **ARMED** | Blue | Active control enabled |

### Direction Controls

| Button | Action | Linear X | Angular Z |
|--------|--------|----------|-----------|
| ↑ | Forward | 1.0 | 0.0 |
| ↓ | Backward | -1.0 | 0.0 |
| ← | Rotate Left | 0.0 | 0.5 |
| → | Rotate Right | 0.0 | -0.5 |
| DIFF LEFT | Forward + Left | 1.0 | 0.5 |
| DIFF RIGHT | Forward + Right | 1.0 | -0.5 |

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `W` / `↑` | Forward |
| `S` / `↓` | Backward |
| `A` / `←` | Rotate Left |
| `D` / `→` | Rotate Right |
| `Q` | Differential Left |
| `E` | Differential Right |
| `Space` | Toggle Mode |
| `Esc` | Emergency Stop |

### Emergency Stop
Click the red **EMERGENCY STOP** button or press `Esc` for immediate halt.

## Testing Without a Real Robot

### Using ROS2 Echo
Monitor `/cmd_vel` messages:
```bash
ros2 topic echo /cmd_vel
```

### Using RViz2
Visualize commands in RViz2:
```bash
ros2 run rviz2 rviz2
```

### Using Turtlesim
Test with turtlesim:
```bash
# Terminal 1
ros2 run turtlesim turtlesim_node

# Terminal 2 - Remap cmd_vel
ros2 run turtlesim turtle_teleop_key --ros-args -r /turtle1/cmd_vel:=/cmd_vel
```

### Using Gazebo
Test with a simulated robot in Gazebo:
```bash
ros2 launch gazebo_ros empty_world.launch.py
```

## WebSocket Protocol

### Messages from Frontend → Backend

**Velocity Command:**
```json
{ "linear": 1.0, "angular": 0.5 }
```

**Mode Switch:**
```json
{ "mode": "manual" }
{ "mode": "auto" }
```

**Emergency Stop:**
```json
{ "emergency_stop": true }
{ "emergency_stop": false }
```

**Stop Command:**
```json
{ "stop": true }
```

### Messages from Backend → Frontend

**Telemetry:**
```json
{
  "linear_x": 0.5,
  "angular_z": 0.25,
  "mode": "auto",
  "emergency_stop": false,
  "connected_clients": 1
}
```

## Extending the System

### Adding Camera Feed
```python
# In rover_bridge.py, add:
from sensor_msgs.msg import Image
import cv2
import base64

# Subscribe to camera topic
self.camera_sub = self.create_subscription(
    Image, '/camera/image_raw', self.camera_callback, 10
)

async def send_camera_frame(self, frame_data):
    await self.broadcast({
        "type": "camera",
        "data": base64.b64encode(frame_data).decode()
    })
```

### Adding Joystick Support
```javascript
// In app.js, add:
window.addEventListener('gamepadconnected', (e) => {
    console.log('Gamepad connected:', e.gamepad.id);
    pollGamepad();
});

function pollGamepad() {
    const gamepads = navigator.getGamepads();
    if (gamepads[0]) {
        const gp = gamepads[0];
        const linear = -gp.axes[1]; // Left stick Y
        const angular = -gp.axes[2]; // Right stick X
        sendMessage({ linear, angular });
    }
    requestAnimationFrame(pollGamepad);
}
```

### Adding Sensor Data
```python
# Subscribe to sensors
from sensor_msgs.msg import LaserScan, Imu

self.lidar_sub = self.create_subscription(
    LaserScan, '/scan', self.lidar_callback, 10
)

self.imu_sub = self.create_subscription(
    Imu, '/imu/data', self.imu_callback, 10
)
```

### Adding Odometry
```python
from nav_msgs.msg import Odometry

self.odom_sub = self.create_subscription(
    Odometry, '/odom', self.odom_callback, 10
)

def odom_callback(self, msg):
    position = msg.pose.pose.position
    # Broadcast to frontend
```

## Troubleshooting

### WebSocket Connection Failed
1. Check if `rover_bridge.py` is running
2. Verify port 8765 is not blocked
3. Check firewall settings

### ROS2 Node Not Starting
1. Ensure ROS2 is sourced: `source /opt/ros/jazzy/setup.bash`
2. Check for conflicting nodes: `ros2 node list`

### Mobile Can't Connect
1. Ensure devices are on same network
2. Use computer's network IP, not `localhost`
3. Check firewall allows ports 8000 and 8765

### Velocity Not Publishing
1. Check mode is ARMED (blue button)
2. Verify no emergency stop is active
3. Monitor with: `ros2 topic echo /cmd_vel`

## 📄 License

MIT License - Free for personal and commercial use. Go wild! 🎉

## 🙏 Credits & Acknowledgments

**Author:** Abiral Saba ([@Abiralsaba](https://github.com/Abiralsaba))

Built with love for ROS2 Jazzy using vanilla Python, HTML, CSS, and JavaScript.
No external frameworks, no cloud dependencies - just pure, simple code that works!

---

⭐ **If you found this helpful, please star the repo!** ⭐

*Happy Roving! 🤖*
