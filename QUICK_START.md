# 🚀 Quick Start Guide

> Get your MARCH ROVER Controller running in minutes!

**Author:** Abiral Saba ([@Abiralsaba](https://github.com/Abiralsaba))

---

## 1. Transfer Project to Ubuntu VM

Copy `rover_project` folder to your Ubuntu VM using UTM shared folders or USB.

## 2. Run Setup (Ubuntu VM)

```bash
cd ~/rover_project
chmod +x setup_ubuntu.sh
./setup_ubuntu.sh
```

## 3. Start the System (Ubuntu VM - 3 Terminals)

**Terminal 1 - ROS2 Bridge:**
```bash
cd ~/rover_project
source /opt/ros/jazzy/setup.bash
python3 rover_bridge.py
```

**Terminal 2 - Web Server:**
```bash
cd ~/rover_project/web
python3 -m http.server 8000
```

**Terminal 3 - Monitor ROS2:**
```bash
source /opt/ros/jazzy/setup.bash
ros2 topic echo /cmd_vel
```

## 4. Connect from Windows

1. Get VM IP: run `hostname -I` in Ubuntu
2. Open browser: `http://<VM_IP>:8000`
3. Click center button → **ARMED**
4. Press direction buttons
5. Watch Terminal 3 for Twist messages

## Firewall (if needed)

```bash
sudo ufw allow 8000
sudo ufw allow 8765
```
