# 🚀 MARCH ROVER Controller

> **Direct ROS2 control from any web browser - no Python backend needed!**

A lightweight, purely frontend (HTML/JS/CSS) controller that communicates directly with ROS2 via `rosbridge_server`. It publishes `geometry_msgs/Twist` to `/cmd_vel` for full rover control.

![Rover Control UI](./web/preview.png)

## ✨ Features
- **Direct ROS2 Integration:** Uses `roslibjs` to connect to `rosbridge_server`.
- **Responsive UI & Touch Support:** Split and unified joysticks for mobile & desktop.
- **Dual Modes:** Safe (DISARMED) and active (ARMED) states.
- **Special Commands:** Differential Drive & 360° rotation modes, plus Fast/Slow speed toggles.
- **Keyboard Controls:** Use WASD or Arrow keys to drive!

## 🛠️ Requirements
- Ubuntu 22.04+ or macOS with **[ROS2 Jazzy](https://docs.ros.org/en/jazzy/)** (or compatible)
- `rosbridge_suite` installed:
  ```bash
  sudo apt-get install ros-jazzy-rosbridge-suite
  ```

## 🚀 Quick Start

**1. Start the ROS2 Bridge**
```bash
source /opt/ros/jazzy/setup.bash
ros2 launch rosbridge_server rosbridge_websocket_launch.xml port:=9090
```

**2. Serve the Interface**
Open a new terminal and run:
```bash
cd web
python3 -m http.server 8000
```

**3. Open the App**
Go to `http://localhost:8000` on your computer or mobile device (using your computer's IP).

## 🎮 Controls

| Action | Keyboard |
|--------|----------|
| **Forward/Backward** | `W` / `S` or `↑` / `↓` |
| **Rotate L/R** | `A` / `D` or `←` / `→` |
| **Toggle Armed Mode** | `Space` |

*Note: You must click **DISARMED** to toggle it to **ARMED** (Blue) before the rover will accept movement commands.*

## 📄 License
MIT License. Created by [@Abiralsaba](https://github.com/Abiralsaba).
