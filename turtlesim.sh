# To run Turtlesim with this web controller:

# Terminal 1: Start ROS Bridge
source /opt/ros/jazzy/setup.bash
ros2 launch rosbridge_server rosbridge_websocket_launch.xml port:=9090 delay_between_messages:=0.0

# Terminal 2: Start Web Server (if not already running)
cd web
python3 -m http.server 8000

# Terminal 3: Run Turtlesim and remap to /cmd_vel
source /opt/ros/jazzy/setup.bash
ros2 run turtlesim turtlesim_node --ros-args -r /turtle1/cmd_vel:=/cmd_vel

# Finally, open the following in your computer or mobile browser (connected to the same Wi-Fi):
# http://192.168.64.7:8000
#
# If your phone can't reach the VM directly (e.g. UTM on Mac), forward ports on Mac:
#   socat TCP-LISTEN:8000,fork,reuseaddr TCP:192.168.64.7:8000 &
#   socat TCP-LISTEN:9090,fork,reuseaddr TCP:192.168.64.7:9090 &
# Then use your Mac's Wi-Fi IP instead:
#   http://<MAC_WIFI_IP>:8000
#   (Find it with: ipconfig getifaddr en0)
#
# Click the DISARMED button to start controlling!
