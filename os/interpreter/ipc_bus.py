"""
OpenXnet Neuro-Symbolic OS Kernel - IPC Channel Implementation

Provides inter-process communication via typed channels, message queues,
and pub/sub topic support for the kernel's process ecosystem.
"""

from __future__ import annotations

from collections import deque
from dataclasses import dataclass, field
from enum import Enum, auto
from typing import Any, Optional
import time


class ChannelType(Enum):
    """Direction/mode of an IPC channel."""
    SEND = auto()
    RECV = auto()
    DUPLEX = auto()


class ChannelState(Enum):
    """Lifecycle state of a channel."""
    OPEN = auto()
    CLOSED = auto()
    BLOCKED = auto()


@dataclass
class Message:
    """A single message transmitted through the IPC bus."""
    sender: int                     # Sender PID
    receiver: Optional[int]         # Receiver PID (None for broadcast)
    payload: Any                    # Message content
    timestamp: float = field(default_factory=time.time)
    topic: Optional[str] = None     # Topic for pub/sub messages
    message_id: int = 0             # Auto-assigned unique ID


@dataclass
class Channel:
    """An IPC channel with its message queue and metadata."""
    name: str
    chan_type: ChannelType
    state: ChannelState = ChannelState.OPEN
    capacity: int = 64
    queue: deque[Message] = field(default_factory=deque)
    owner_pid: Optional[int] = None
    connected_pids: set[int] = field(default_factory=set)
    created_at: float = field(default_factory=time.time)


class IPCBus:
    """Inter-process communication bus.

    Manages named channels and topic-based pub/sub for kernel processes.
    Each channel has a bounded message queue. Senders block when the queue
    is full; receivers block when the queue is empty (cooperative blocking
    via return codes, not OS-level blocking).
    """

    def __init__(self):
        self._channels: dict[str, Channel] = {}
        self._topics: dict[str, set[int]] = {}  # topic -> set of subscriber PIDs
        self._next_message_id: int = 1
        self._message_log: deque[Message] = deque(maxlen=1000)

    def create_channel(
        self,
        name: str,
        chan_type: ChannelType = ChannelType.DUPLEX,
        capacity: int = 64,
        owner_pid: Optional[int] = None,
    ) -> Channel:
        """Create a new named channel.

        Raises ValueError if a channel with that name already exists.
        """
        if name in self._channels:
            raise ValueError(f"Channel '{name}' already exists")

        channel = Channel(
            name=name,
            chan_type=chan_type,
            capacity=capacity,
            owner_pid=owner_pid,
        )
        if owner_pid is not None:
            channel.connected_pids.add(owner_pid)
        self._channels[name] = channel
        return channel

    def send(self, channel_name: str, payload: Any, sender_pid: int) -> bool:
        """Send a message on a channel.

        Returns True if the message was queued, False if the channel is full
        or closed, or if the sender lacks permission.
        """
        channel = self._channels.get(channel_name)
        if channel is None:
            raise ValueError(f"Channel '{channel_name}' does not exist")

        if channel.state == ChannelState.CLOSED:
            return False

        if channel.chan_type == ChannelType.RECV:
            # Cannot send on a receive-only channel
            return False

        if len(channel.queue) >= channel.capacity:
            channel.state = ChannelState.BLOCKED
            return False

        msg = Message(
            sender=sender_pid,
            receiver=None,
            payload=payload,
            message_id=self._next_message_id,
        )
        self._next_message_id += 1
        channel.queue.append(msg)
        self._message_log.append(msg)

        # Unblock if was blocked
        if channel.state == ChannelState.BLOCKED:
            channel.state = ChannelState.OPEN

        return True

    def recv(self, channel_name: str, receiver_pid: int) -> Optional[Message]:
        """Receive the next message from a channel.

        Returns the message or None if the queue is empty or channel is closed.
        """
        channel = self._channels.get(channel_name)
        if channel is None:
            raise ValueError(f"Channel '{channel_name}' does not exist")

        if channel.state == ChannelState.CLOSED:
            return None

        if channel.chan_type == ChannelType.SEND:
            # Cannot receive on a send-only channel
            return None

        if not channel.queue:
            return None

        msg = channel.queue.popleft()
        msg.receiver = receiver_pid

        # Unblock if was blocked due to full queue
        if channel.state == ChannelState.BLOCKED and len(channel.queue) < channel.capacity:
            channel.state = ChannelState.OPEN

        return msg

    def peek(self, channel_name: str) -> Optional[Message]:
        """Peek at the next message without removing it."""
        channel = self._channels.get(channel_name)
        if channel is None or not channel.queue:
            return None
        return channel.queue[0]

    def subscribe(self, topic: str, pid: int) -> None:
        """Subscribe a process to a topic."""
        if topic not in self._topics:
            self._topics[topic] = set()
        self._topics[topic].add(pid)

    def unsubscribe(self, topic: str, pid: int) -> None:
        """Unsubscribe a process from a topic."""
        if topic in self._topics:
            self._topics[topic].discard(pid)
            if not self._topics[topic]:
                del self._topics[topic]

    def publish(self, topic: str, payload: Any, sender_pid: int = 0) -> int:
        """Publish a message to all subscribers of a topic.

        Returns the number of subscribers that received the message.
        Each subscriber gets the message placed in their per-topic channel
        (auto-created as 'topic:{topic}:pid:{pid}').
        """
        subscribers = self._topics.get(topic, set())
        delivered = 0

        for pid in subscribers:
            chan_name = f"__topic__{topic}__pid__{pid}"
            if chan_name not in self._channels:
                self.create_channel(chan_name, ChannelType.DUPLEX, capacity=128, owner_pid=pid)

            msg = Message(
                sender=sender_pid,
                receiver=pid,
                payload=payload,
                topic=topic,
                message_id=self._next_message_id,
            )
            self._next_message_id += 1

            channel = self._channels[chan_name]
            if len(channel.queue) < channel.capacity:
                channel.queue.append(msg)
                self._message_log.append(msg)
                delivered += 1

        return delivered

    def get_topic_messages(self, topic: str, pid: int) -> list[Message]:
        """Retrieve all pending topic messages for a process."""
        chan_name = f"__topic__{topic}__pid__{pid}"
        channel = self._channels.get(chan_name)
        if channel is None:
            return []
        messages = list(channel.queue)
        channel.queue.clear()
        return messages

    def close_channel(self, name: str) -> bool:
        """Close a channel. Remaining messages are discarded.

        Returns True if closed, False if not found.
        """
        channel = self._channels.get(name)
        if channel is None:
            return False

        channel.state = ChannelState.CLOSED
        channel.queue.clear()
        channel.connected_pids.clear()
        del self._channels[name]
        return True

    def connect(self, channel_name: str, pid: int) -> bool:
        """Connect a process to an existing channel."""
        channel = self._channels.get(channel_name)
        if channel is None or channel.state == ChannelState.CLOSED:
            return False
        channel.connected_pids.add(pid)
        return True

    def disconnect(self, channel_name: str, pid: int) -> bool:
        """Disconnect a process from a channel."""
        channel = self._channels.get(channel_name)
        if channel is None:
            return False
        channel.connected_pids.discard(pid)
        return True

    def list_channels(self) -> list[str]:
        """List all active channel names (excluding internal topic channels)."""
        return [name for name in self._channels if not name.startswith("__topic__")]

    def channel_info(self, name: str) -> Optional[dict]:
        """Get information about a channel."""
        channel = self._channels.get(name)
        if channel is None:
            return None
        return {
            "name": channel.name,
            "type": channel.chan_type.name,
            "state": channel.state.name,
            "capacity": channel.capacity,
            "pending": len(channel.queue),
            "connected_pids": list(channel.connected_pids),
            "owner_pid": channel.owner_pid,
        }

    def cleanup_pid(self, pid: int) -> None:
        """Clean up all channels and subscriptions for a terminated process."""
        # Unsubscribe from all topics
        for topic in list(self._topics.keys()):
            self.unsubscribe(topic, pid)

        # Remove from all channel connections
        for channel in self._channels.values():
            channel.connected_pids.discard(pid)

        # Close owned channels
        owned = [name for name, ch in self._channels.items() if ch.owner_pid == pid]
        for name in owned:
            self.close_channel(name)
