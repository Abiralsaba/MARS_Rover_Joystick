#!/usr/bin/env python3

import asyncio
import json
import signal
import sys
from typing import Dict, Set, Optional
from dataclasses import dataclass, field
from enum import Enum

# WebSocket library
import websockets
from websockets.server import WebSocketServerProtocol

# ROS2 libraries
import rclpy
from rclpy.node import Node
from rclpy.executors import MultiThreadedExecutor
from geometry_msgs.msg import Twist


class ControlMode(Enum):
    MANUAL = "manual"
    AUTO = "auto"


@dataclass
class RoverState:
 
    linear_x: float = 0.0
    angular_y: float = 0.0
    angular_z: float = 0.0
    mode: ControlMode = ControlMode.MANUAL
    connected_clients: Set[WebSocketServerProtocol] = field(default_factory=set)


class RoverBridgeNode(Node):
    # Bridges WS commands to ROS2
    # - /cmd_vel publishing
    # - Gets telemetry feedback
    
    def __init__(self, state: RoverState):
        
        super().__init__('rover_bridge')
        
        self.state = state
        
        self.cmd_vel_publisher = self.create_publisher(
            Twist,
            '/cmd_vel',
            10  # qos
        )
        
        # hook up telemetry feedback
        self.cmd_vel_subscriber = self.create_subscription(
            Twist,
            '/cmd_vel',
            self.cmd_vel_callback,
            10
        )
        
        # 10 Hz broadcast
        self.telemetry_timer = self.create_timer(0.1, self.broadcast_telemetry)
        
        self.get_logger().info('🚀 Bridge init... pub/sub to /cmd_vel')
    
    def cmd_vel_callback(self, msg: Twist) -> None:
        # keep state synced with actual velocities
        self.state.linear_x = msg.linear.x
        self.state.angular_y = msg.angular.y
        self.state.angular_z = msg.angular.z
    
    def publish_velocity(self, linear: float, angular: float) -> None:
        # kill motors when disarmed
        if self.state.mode == ControlMode.MANUAL:
            linear = 0.0
            angular = 0.0
        
        twist = Twist()
        twist.linear.x = float(linear)
        twist.linear.y = 0.0
        twist.linear.z = 0.0
        twist.angular.x = 0.0
        twist.angular.y = 0.0
        twist.angular.z = float(angular)
        
        self.cmd_vel_publisher.publish(twist)
        
        # Update state for immediate feedback
        self.state.linear_x = twist.linear.x
        self.state.angular_y = twist.angular.y
        self.state.angular_z = twist.angular.z
        
        self.get_logger().debug(
            f'Published: linear={linear:.2f}, angular={angular:.2f}'
        )
    
    def publish_360_rotation(self) -> None:
        # Hack: hijack angular.y for 360 mode signal
        if self.state.mode == ControlMode.MANUAL:
            return
        
        twist = Twist()
        twist.linear.x = 0.0
        twist.linear.y = 0.0
        twist.linear.z = 0.0
        twist.angular.x = 0.0
        twist.angular.y = 200.0  # 360 rotation signal
        twist.angular.z = 0.0
        
        self.cmd_vel_publisher.publish(twist)
        
        # Update state for immediate telemetry feedback
        self.state.linear_x = 0.0
        self.state.angular_y = 200.0  # Show 200 on UI
        self.state.angular_z = 0.0
        
        self.get_logger().info('🔄 360 Rotation command sent (angular.y=200)')
    
    def publish_differential(self) -> None:
        # Hack: hijack angular.y for diff UI signal
        if self.state.mode == ControlMode.MANUAL:
            return
        
        twist = Twist()
        twist.linear.x = 0.0
        twist.linear.y = 0.0
        twist.linear.z = 0.0
        twist.angular.x = 0.0
        twist.angular.y = 404.0  # Differential velocity signal
        twist.angular.z = 0.0
        
        self.cmd_vel_publisher.publish(twist)
        
        # Update state for immediate telemetry feedback
        self.state.linear_x = 0.0
        self.state.angular_y = 404.0  # Show 404 on UI
        self.state.angular_z = 0.0
        
        self.get_logger().info('↔️ Differential velocity command sent (angular.y=404)')
    
    def stop(self) -> None:
        # zero out all velocities
        self.publish_velocity(0.0, 0.0)
        self.get_logger().info('🛑 STOP command sent')
    
    def set_mode(self, mode: str) -> None:
        # manual or auto - stop if dropping to manual
        try:
            self.state.mode = ControlMode(mode)
            if self.state.mode == ControlMode.MANUAL:
                self.stop()  # Stop when switching to manual
            self.get_logger().info(f'🔄 Mode changed to: {mode.upper()}')
        except ValueError:
            self.get_logger().error(f'Invalid mode: {mode}')
    
    def broadcast_telemetry(self) -> None:
        # handled asynchronously in the ws server
        pass
    
    def get_telemetry(self) -> Dict:
        # package current state for the frontend
        return {
            "linear_x": round(self.state.linear_x, 2),
            "angular_y": round(self.state.angular_y, 2),
            "angular_z": round(self.state.angular_z, 2),
            "mode": self.state.mode.value,
            "connected_clients": len(self.state.connected_clients)
        }


class WebSocketServer:
    # Handles ws clients, routing commands, and spamming telemetry
    
    def __init__(self, node: RoverBridgeNode, host: str = "0.0.0.0", port: int = 8765):
        """
        Initialize the WebSocket server.
        
        Args:
            node: RoverBridgeNode instance for ROS2 communication
            host: Host address to bind to (default: all interfaces)
            port: Port to listen on (default: 8765)
        """
        self.node = node
        self.state = node.state
        self.host = host
        self.port = port
        self.server = None
    
    async def handle_connection(self, websocket: WebSocketServerProtocol) -> None:
        """
        Handle a new WebSocket connection.
        
        Args:
            websocket: The WebSocket connection object
        """
        # Register client
        self.state.connected_clients.add(websocket)
        client_info = f"{websocket.remote_address[0]}:{websocket.remote_address[1]}"
        self.node.get_logger().info(f'🔗 Client connected: {client_info}')
        
        try:
            # Send initial state
            await self.send_telemetry(websocket)
            
            # Handle incoming messages
            async for message in websocket:
                await self.handle_message(websocket, message)
                
        except websockets.exceptions.ConnectionClosed:
            self.node.get_logger().info(f'🔌 Client disconnected: {client_info}')
        except Exception as e:
            self.node.get_logger().error(f'❌ Error handling client: {e}')
        finally:
            # Unregister client
            self.state.connected_clients.discard(websocket)
            # Stop rover if no clients connected
            if len(self.state.connected_clients) == 0:
                self.node.stop()
    
    async def handle_message(self, websocket: WebSocketServerProtocol, message: str) -> None:
        """
        Parse and handle incoming WebSocket message.
        
        Expected message formats:
        - Velocity command: {"linear": float, "angular": float}
        - Mode switch: {"mode": "manual" | "auto"}
        - Stop command: {"stop": true}
        - 360 Rotation: {"rotate_360": true}
        - Differential: {"differential": true}
        
        Args:
            websocket: The WebSocket connection
            message: Raw message string (JSON)
        """
        try:
            data = json.loads(message)
            
            # Handle velocity command
            if "linear" in data and "angular" in data:
                linear = float(data["linear"])
                angular = float(data["angular"])
                self.node.publish_velocity(linear, angular)
            
            # Handle 360 rotation command
            if "rotate_360" in data:
                if data["rotate_360"]:
                    self.node.publish_360_rotation()
                else:
                    self.node.stop()
                    self.node.get_logger().info('🔄 360 Rotation stopped (button released)')
            
            # Handle differential velocity command
            if "differential" in data:
                if data["differential"]:
                    self.node.publish_differential()
                else:
                    self.node.stop()
                    self.node.get_logger().info('↔️ Differential stopped (button released)')
            
            # Handle mode switch
            if "mode" in data:
                self.node.set_mode(data["mode"])
            
            # Handle stop command
            if "stop" in data and data["stop"]:
                self.node.stop()
            
            # Send updated telemetry
            await self.broadcast_telemetry()
            
        except json.JSONDecodeError:
            self.node.get_logger().error(f'Invalid JSON: {message}')
            await websocket.send(json.dumps({"error": "Invalid JSON format"}))
        except (KeyError, ValueError) as e:
            self.node.get_logger().error(f'Invalid message format: {e}')
            await websocket.send(json.dumps({"error": str(e)}))
    
    async def send_telemetry(self, websocket: WebSocketServerProtocol) -> None:
        """
        Send telemetry to a specific client.
        
        Args:
            websocket: Target WebSocket connection
        """
        try:
            telemetry = self.node.get_telemetry()
            await websocket.send(json.dumps(telemetry))
        except websockets.exceptions.ConnectionClosed:
            pass
    
    async def broadcast_telemetry(self) -> None:
        """Broadcast telemetry to all connected clients."""
        if self.state.connected_clients:
            telemetry = json.dumps(self.node.get_telemetry())
            await asyncio.gather(
                *[client.send(telemetry) for client in self.state.connected_clients],
                return_exceptions=True
            )
    
    async def telemetry_loop(self) -> None:
        """Continuous loop for broadcasting telemetry at 10 Hz."""
        while True:
            await self.broadcast_telemetry()
            await asyncio.sleep(0.1)  # 10 Hz
    
    async def start(self) -> None:
        """Start the WebSocket server."""
        self.server = await websockets.serve(
            self.handle_connection,
            self.host,
            self.port,
            ping_interval=20,
            ping_timeout=20
        )
        self.node.get_logger().info(
            f'🌐 WebSocket server started on ws://{self.host}:{self.port}'
        )


async def run_ros2_node(node: RoverBridgeNode, executor: MultiThreadedExecutor) -> None:
    """
    Run the ROS2 node using asyncio.
    
    Args:
        node: The RoverBridgeNode to spin
        executor: ROS2 executor
    """
    while rclpy.ok():
        executor.spin_once(timeout_sec=0.01)
        await asyncio.sleep(0.01)


async def main_async():
    """Async main function to run both ROS2 and WebSocket server."""
    
    # Initialize ROS2
    rclpy.init()
    
    # Create shared state
    state = RoverState()
    
    # Create ROS2 node
    node = RoverBridgeNode(state)
    
    # Create executor
    executor = MultiThreadedExecutor()
    executor.add_node(node)
    
    # Create WebSocket server
    ws_server = WebSocketServer(node, host="0.0.0.0", port=8765)
    
    print("\n" + "="*60)
    print("🚀 ROVER BRIDGE - ROS2 WebSocket Control System")
    print("="*60)
    print(f"📡 ROS2 Node: rover_bridge")
    print(f"📤 Publishing to: /cmd_vel")
    print(f"📥 Subscribing to: /cmd_vel")
    print(f"🌐 WebSocket Server: ws://0.0.0.0:8765")
    print("="*60)
    print("\n💡 Open your web browser and navigate to the control interface")
    print("   Local: http://localhost:8000")
    print("   Network: http://<your-ip>:8000")
    print("\n🛑 Press Ctrl+C to stop\n")
    
    try:
        # Start WebSocket server
        await ws_server.start()
        
        # Run both ROS2 and telemetry loop concurrently
        await asyncio.gather(
            run_ros2_node(node, executor),
            ws_server.telemetry_loop()
        )
        
    except asyncio.CancelledError:
        pass
    finally:
        # Cleanup
        node.stop()
        node.destroy_node()
        rclpy.shutdown()
        print("\n👋 Rover Bridge shut down gracefully")


def main():
    """Main entry point."""
    
    # Handle signals for graceful shutdown
    def signal_handler(sig, frame):
        print("\n🛑 Shutdown signal received...")
        sys.exit(0)
    
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    # Run the async main function
    try:
        asyncio.run(main_async())
    except KeyboardInterrupt:
        print("\n👋 Goodbye!")
    except Exception as e:
        print(f"❌ Fatal error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
