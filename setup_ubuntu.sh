#!/bin/bash
# ╔══════════════════════════════════════════════════════════════════════════════╗
# ║             MARCH ROVER Controller - Ubuntu Setup Script                     ║
# ║                   Let's get your rover ready to roll! 🚗                     ║
# ╚══════════════════════════════════════════════════════════════════════════════╝
#
# Author: Abiral Saba (@Abiralsaba)
# This script sets up everything you need to run the MARCH ROVER Controller
# Just sit back and let it do its thing!

set -e

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║     🚀 MARCH ROVER Controller - Ubuntu Setup                 ║"
echo "║          Making robots accessible, one setup at a time!      ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# Check if ROS2 is installed
if [ ! -f "/opt/ros/jazzy/setup.bash" ]; then
    echo "❌ ROS2 Jazzy not found at /opt/ros/jazzy"
    echo "Please install ROS2 Jazzy first"
    exit 1
fi

# Source ROS2
source /opt/ros/jazzy/setup.bash
echo "✅ ROS2 Jazzy sourced"

# Install Python websockets
echo "📦 Installing Python websockets..."
pip3 install websockets --quiet

# Get VM IP address
VM_IP=$(hostname -I | awk '{print $1}')
echo ""
echo "========================================"
echo "✅ Setup Complete!"
echo "========================================"
echo ""
echo "Your VM IP Address: $VM_IP"
echo ""
echo "📋 NEXT STEPS:"
echo ""
echo "1. Open Terminal 1 and run:"
echo "   source /opt/ros/jazzy/setup.bash && python3 rover_bridge.py"
echo ""
echo "2. Open Terminal 2 and run:"
echo "   cd web && python3 -m http.server 8000"
echo ""
echo "3. Open Terminal 3 to monitor ROS2:"
echo "   source /opt/ros/jazzy/setup.bash && ros2 topic echo /cmd_vel"
echo ""
echo "4. On Windows, open browser to:"
echo "   http://$VM_IP:8000"
echo ""
echo "========================================"
