# To run Turtlesim with this web controller:

# Terminal 1: Start ROS Bridge
source /opt/ros/jazzy/setup.bash
ros2 launch rosbridge_server rosbridge_websocket_launch.xml port:=9090

# Terminal 2: Start Web Server (if not already running)
cd web
python3 -m http.server 8000

# Terminal 3: Run Turtlesim and remap to /cmd_vel
source /opt/ros/jazzy/setup.bash
ros2 run turtlesim turtlesim_node --ros-args -r /turtle1/cmd_vel:=/cmd_vel

# Finally, open the following in your computer or mobile browser (connected to the same Wi-Fi):
# http://<YOUR_VM_IP>:8000
#
# To find your VM IP, run: hostname -I
#
# Click the DISARMED button to start controlling!
