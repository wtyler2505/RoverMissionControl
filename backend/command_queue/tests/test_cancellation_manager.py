"""
Test cases for Command Cancellation Manager

Tests cover:
- Safety validation
- State machine transitions
- Resource cleanup
- Compensating actions
- Error handling
- Concurrent cancellations
"""

import pytest
import asyncio
from datetime import datetime, timedelta
from unittest.mock import Mock, AsyncMock, patch

from ..cancellation_manager import (
    CancellationManager,
    CancellationRequest,
    CancellationReason,
    CancellationState,
    ResourceCleanupHandler,
    CompensatingAction
)
from ..command_base import Command, CommandType, CommandPriority, CommandStatus, CommandMetadata
from ..command_queue import PriorityCommandQueue
from ..websocket_integration import CommandQueueWebSocketHandler


class MockCommand(Command):
    """Mock command for testing"""
    
    async def execute(self):
        return {"success": True}
    
    def _validate_parameters(self):
        pass


@pytest.fixture
async def command_queue():
    """Create a command queue for testing"""
    queue = PriorityCommandQueue()
    await queue.initialize()
    yield queue
    await queue.shutdown()


@pytest.fixture
def ws_handler():
    """Create a mock WebSocket handler"""
    handler = Mock(spec=CommandQueueWebSocketHandler)
    handler.emit_command_event = AsyncMock()
    return handler


@pytest.fixture
def cancellation_manager(command_queue, ws_handler):
    """Create a cancellation manager for testing"""
    return CancellationManager(command_queue, ws_handler)


@pytest.fixture
def test_command():
    """Create a test command"""
    return MockCommand(
        command_type=CommandType.MOVE_FORWARD,
        priority=CommandPriority.NORMAL,
        parameters={"distance": 100},
        metadata=CommandMetadata(source="test")
    )


@pytest.fixture
def critical_command():
    """Create a critical command that cannot be cancelled"""
    cmd = MockCommand(
        command_type=CommandType.EMERGENCY_STOP,
        priority=CommandPriority.EMERGENCY,
        metadata=CommandMetadata(source="test")
    )
    return cmd


class TestCancellationValidation:
    """Test cancellation validation logic"""
    
    async def test_cannot_cancel_completed_command(
        self,
        cancellation_manager,
        command_queue,
        test_command
    ):
        """Test that completed commands cannot be cancelled"""
        # Add command to queue
        await command_queue.enqueue(test_command)
        
        # Mark as completed
        test_command.status = CommandStatus.COMPLETED
        test_command.completed_at = datetime.utcnow()
        
        # Try to cancel
        request = CancellationRequest(
            command_id=test_command.id,
            reason=CancellationReason.USER_REQUEST,
            requester_id="test_user"
        )
        
        success, error = await cancellation_manager.request_cancellation(request)
        
        assert not success
        assert "Cannot cancel command in completed state" in error
    
    async def test_cannot_cancel_critical_command_without_force(
        self,
        cancellation_manager,
        command_queue,
        critical_command
    ):
        """Test that critical commands require force flag"""
        # Add command to queue
        await command_queue.enqueue(critical_command)
        
        # Try to cancel without force
        request = CancellationRequest(
            command_id=critical_command.id,
            reason=CancellationReason.USER_REQUEST,
            requester_id="test_user",
            force=False
        )
        
        success, error = await cancellation_manager.request_cancellation(request)
        
        assert not success
        assert "non-cancellable" in error
    
    async def test_can_cancel_critical_command_with_force(
        self,
        cancellation_manager,
        command_queue,
        critical_command
    ):
        """Test that critical commands can be cancelled with force flag"""
        # Add command to queue
        await command_queue.enqueue(critical_command)
        
        # Try to cancel with force
        request = CancellationRequest(
            command_id=critical_command.id,
            reason=CancellationReason.EMERGENCY_STOP,
            requester_id="admin_user",
            force=True
        )
        
        success, error = await cancellation_manager.request_cancellation(request)
        
        assert success
        assert error is None
    
    async def test_safety_critical_metadata_prevents_cancellation(
        self,
        cancellation_manager,
        command_queue,
        test_command
    ):
        """Test that safety_critical metadata prevents cancellation"""
        # Mark command as safety critical
        test_command.metadata.custom_data["safety_critical"] = True
        
        # Add to queue
        await command_queue.enqueue(test_command)
        
        # Try to cancel
        request = CancellationRequest(
            command_id=test_command.id,
            reason=CancellationReason.USER_REQUEST,
            requester_id="test_user"
        )
        
        success, error = await cancellation_manager.request_cancellation(request)
        
        assert not success
        assert "Safety-critical" in error


class TestCancellationStateMachine:
    """Test state machine transitions"""
    
    async def test_state_transitions_for_queued_command(
        self,
        cancellation_manager,
        command_queue,
        test_command,
        ws_handler
    ):
        """Test state transitions for cancelling a queued command"""
        # Add command to queue
        await command_queue.enqueue(test_command)
        
        # Track state transitions
        states = []
        
        async def capture_state(event_type, command_id, data):
            if "cancellation_state" in data:
                states.append(data["cancellation_state"])
        
        ws_handler.emit_command_event.side_effect = capture_state
        
        # Cancel command
        request = CancellationRequest(
            command_id=test_command.id,
            reason=CancellationReason.USER_REQUEST,
            requester_id="test_user"
        )
        
        success, error = await cancellation_manager.request_cancellation(request)
        
        assert success
        
        # Check state transitions
        assert CancellationState.VALIDATING.value in states
        assert CancellationState.CANCELLING.value in states
        assert CancellationState.COMPLETED.value in states
    
    async def test_state_transitions_for_executing_command(
        self,
        cancellation_manager,
        command_queue,
        test_command,
        ws_handler
    ):
        """Test state transitions for cancelling an executing command"""
        # Add command and mark as executing
        await command_queue.enqueue(test_command)
        test_command.status = CommandStatus.EXECUTING
        test_command.started_at = datetime.utcnow()
        
        # Track state transitions
        states = []
        
        async def capture_state(event_type, command_id, data):
            if "cancellation_state" in data:
                states.append(data["cancellation_state"])
        
        ws_handler.emit_command_event.side_effect = capture_state
        
        # Cancel command
        request = CancellationRequest(
            command_id=test_command.id,
            reason=CancellationReason.USER_REQUEST,
            requester_id="test_user",
            rollback_requested=True
        )
        
        success, error = await cancellation_manager.request_cancellation(request)
        
        assert success
        
        # Check state transitions
        assert CancellationState.VALIDATING.value in states
        assert CancellationState.CANCELLING.value in states
        assert CancellationState.CLEANING_UP.value in states
        assert CancellationState.ROLLING_BACK.value in states
        assert CancellationState.COMPLETED.value in states


class TestResourceCleanup:
    """Test resource cleanup functionality"""
    
    async def test_cleanup_handlers_execute_in_priority_order(
        self,
        cancellation_manager,
        command_queue,
        test_command
    ):
        """Test that cleanup handlers execute in priority order"""
        # Track execution order
        execution_order = []
        
        # Create handlers with different priorities
        async def handler1(cmd):
            execution_order.append("handler1")
        
        async def handler2(cmd):
            execution_order.append("handler2")
        
        async def handler3(cmd):
            execution_order.append("handler3")
        
        cancellation_manager.register_cleanup_handler(
            ResourceCleanupHandler(
                resource_type="test1",
                handler=handler1,
                priority=50
            )
        )
        cancellation_manager.register_cleanup_handler(
            ResourceCleanupHandler(
                resource_type="test2",
                handler=handler2,
                priority=100
            )
        )
        cancellation_manager.register_cleanup_handler(
            ResourceCleanupHandler(
                resource_type="test3",
                handler=handler3,
                priority=75
            )
        )
        
        # Add executing command
        await command_queue.enqueue(test_command)
        test_command.status = CommandStatus.EXECUTING
        
        # Cancel command
        request = CancellationRequest(
            command_id=test_command.id,
            reason=CancellationReason.USER_REQUEST,
            requester_id="test_user"
        )
        
        await cancellation_manager.request_cancellation(request)
        
        # Check execution order (highest priority first)
        assert execution_order == ["handler2", "handler3", "handler1"]
    
    async def test_critical_cleanup_failure_blocks_cancellation(
        self,
        cancellation_manager,
        command_queue,
        test_command
    ):
        """Test that critical cleanup failure blocks cancellation"""
        # Create failing critical handler
        async def failing_handler(cmd):
            raise Exception("Cleanup failed")
        
        cancellation_manager.register_cleanup_handler(
            ResourceCleanupHandler(
                resource_type="critical_resource",
                handler=failing_handler,
                priority=100,
                critical=True
            )
        )
        
        # Add executing command
        await command_queue.enqueue(test_command)
        test_command.status = CommandStatus.EXECUTING
        
        # Try to cancel
        request = CancellationRequest(
            command_id=test_command.id,
            reason=CancellationReason.USER_REQUEST,
            requester_id="test_user"
        )
        
        success, error = await cancellation_manager.request_cancellation(request)
        
        assert not success
        assert "Resource cleanup failed" in error
    
    async def test_cleanup_timeout_handling(
        self,
        cancellation_manager,
        command_queue,
        test_command
    ):
        """Test cleanup handler timeout"""
        # Create slow handler
        async def slow_handler(cmd):
            await asyncio.sleep(5)  # Longer than timeout
        
        cancellation_manager.register_cleanup_handler(
            ResourceCleanupHandler(
                resource_type="slow_resource",
                handler=slow_handler,
                priority=100,
                timeout_seconds=0.1,
                critical=True
            )
        )
        
        # Add executing command
        await command_queue.enqueue(test_command)
        test_command.status = CommandStatus.EXECUTING
        
        # Try to cancel
        request = CancellationRequest(
            command_id=test_command.id,
            reason=CancellationReason.USER_REQUEST,
            requester_id="test_user"
        )
        
        start = datetime.utcnow()
        success, error = await cancellation_manager.request_cancellation(request)
        duration = (datetime.utcnow() - start).total_seconds()
        
        # Should fail due to timeout, but not take 5 seconds
        assert not success
        assert duration < 1  # Well under the 5 second sleep


class TestCompensatingActions:
    """Test compensating action execution"""
    
    async def test_compensating_actions_execute_for_rollback(
        self,
        cancellation_manager,
        command_queue,
        test_command
    ):
        """Test that compensating actions execute when rollback is requested"""
        # Track compensating actions
        executed_actions = []
        
        async def compensate1(cmd, metadata):
            executed_actions.append("compensate1")
        
        async def compensate2(cmd, metadata):
            executed_actions.append("compensate2")
        
        # Register compensating actions
        cancellation_manager.register_compensating_action(
            CommandType.MOVE_FORWARD,
            CompensatingAction(
                action_type="reverse_movement",
                execute=compensate1
            )
        )
        cancellation_manager.register_compensating_action(
            CommandType.MOVE_FORWARD,
            CompensatingAction(
                action_type="reset_position",
                execute=compensate2
            )
        )
        
        # Add executing command
        await command_queue.enqueue(test_command)
        test_command.status = CommandStatus.EXECUTING
        
        # Cancel with rollback
        request = CancellationRequest(
            command_id=test_command.id,
            reason=CancellationReason.USER_REQUEST,
            requester_id="test_user",
            rollback_requested=True
        )
        
        await cancellation_manager.request_cancellation(request)
        
        # Check that compensating actions executed
        assert "compensate1" in executed_actions
        assert "compensate2" in executed_actions
    
    async def test_conditional_compensating_actions(
        self,
        cancellation_manager,
        command_queue,
        test_command
    ):
        """Test compensating actions with validation"""
        executed = []
        
        async def should_compensate(cmd):
            return cmd.parameters.get("distance", 0) > 50
        
        async def compensate(cmd, metadata):
            executed.append("compensated")
        
        # Register conditional compensating action
        cancellation_manager.register_compensating_action(
            CommandType.MOVE_FORWARD,
            CompensatingAction(
                action_type="conditional_reverse",
                execute=compensate,
                validate=should_compensate
            )
        )
        
        # Test with distance > 50
        test_command.parameters["distance"] = 100
        await command_queue.enqueue(test_command)
        test_command.status = CommandStatus.EXECUTING
        
        request = CancellationRequest(
            command_id=test_command.id,
            reason=CancellationReason.USER_REQUEST,
            requester_id="test_user",
            rollback_requested=True
        )
        
        await cancellation_manager.request_cancellation(request)
        
        assert "compensated" in executed
        
        # Test with distance <= 50
        executed.clear()
        test_command2 = MockCommand(
            command_type=CommandType.MOVE_FORWARD,
            parameters={"distance": 30}
        )
        await command_queue.enqueue(test_command2)
        test_command2.status = CommandStatus.EXECUTING
        
        request2 = CancellationRequest(
            command_id=test_command2.id,
            reason=CancellationReason.USER_REQUEST,
            requester_id="test_user",
            rollback_requested=True
        )
        
        await cancellation_manager.request_cancellation(request2)
        
        assert "compensated" not in executed


class TestConcurrentCancellations:
    """Test handling of concurrent cancellation requests"""
    
    async def test_duplicate_cancellation_requests_rejected(
        self,
        cancellation_manager,
        command_queue,
        test_command
    ):
        """Test that duplicate cancellation requests are rejected"""
        await command_queue.enqueue(test_command)
        
        # Create two cancellation requests
        request1 = CancellationRequest(
            command_id=test_command.id,
            reason=CancellationReason.USER_REQUEST,
            requester_id="user1"
        )
        request2 = CancellationRequest(
            command_id=test_command.id,
            reason=CancellationReason.USER_REQUEST,
            requester_id="user2"
        )
        
        # Start first cancellation
        task1 = asyncio.create_task(
            cancellation_manager.request_cancellation(request1)
        )
        
        # Small delay to ensure first request starts
        await asyncio.sleep(0.01)
        
        # Try second cancellation
        success2, error2 = await cancellation_manager.request_cancellation(request2)
        
        # Wait for first to complete
        success1, error1 = await task1
        
        # First should succeed, second should fail
        assert success1
        assert not success2
        assert "already in progress" in error2
    
    async def test_cancellation_timeout_protection(
        self,
        cancellation_manager,
        command_queue,
        test_command
    ):
        """Test that cancellations timeout properly"""
        # Create manager with short timeout
        manager = CancellationManager(
            command_queue,
            Mock(emit_command_event=AsyncMock()),
            cancellation_timeout_seconds=0.1
        )
        
        # Create handler that blocks
        async def blocking_handler(cmd):
            await asyncio.sleep(5)
        
        manager.register_cleanup_handler(
            ResourceCleanupHandler(
                resource_type="blocking",
                handler=blocking_handler,
                priority=100,
                critical=True,
                timeout_seconds=10  # Handler timeout longer than manager timeout
            )
        )
        
        # Add executing command
        await command_queue.enqueue(test_command)
        test_command.status = CommandStatus.EXECUTING
        
        # Try to cancel
        request = CancellationRequest(
            command_id=test_command.id,
            reason=CancellationReason.USER_REQUEST,
            requester_id="test_user"
        )
        
        start = datetime.utcnow()
        success, error = await manager.request_cancellation(request)
        duration = (datetime.utcnow() - start).total_seconds()
        
        assert not success
        assert "timeout" in error.lower()
        assert duration < 0.5  # Should timeout quickly


class TestAuditLogging:
    """Test audit logging integration"""
    
    @patch('backend.command_queue.cancellation_manager.get_audit_service')
    async def test_successful_cancellation_logged(
        self,
        mock_get_audit,
        cancellation_manager,
        command_queue,
        test_command
    ):
        """Test that successful cancellations are logged"""
        # Mock audit service
        audit_service = Mock()
        audit_service.log_action = AsyncMock()
        mock_get_audit.return_value = audit_service
        
        # Add command
        await command_queue.enqueue(test_command)
        
        # Cancel command
        request = CancellationRequest(
            command_id=test_command.id,
            reason=CancellationReason.USER_REQUEST,
            requester_id="test_user",
            metadata={
                "ip_address": "127.0.0.1",
                "user_agent": "test-agent"
            }
        )
        
        await cancellation_manager.request_cancellation(request)
        
        # Check audit log
        audit_service.log_action.assert_called_once()
        call_args = audit_service.log_action.call_args
        
        assert call_args.kwargs["action"] == "command_cancellation"
        assert call_args.kwargs["resource"] == "command"
        assert call_args.kwargs["resource_id"] == test_command.id
        assert call_args.kwargs["user_id"] == "test_user"
        assert call_args.kwargs["details"]["success"] is True
    
    @patch('backend.command_queue.cancellation_manager.get_audit_service')
    async def test_failed_cancellation_logged(
        self,
        mock_get_audit,
        cancellation_manager,
        command_queue,
        critical_command
    ):
        """Test that failed cancellations are logged"""
        # Mock audit service
        audit_service = Mock()
        audit_service.log_action = AsyncMock()
        mock_get_audit.return_value = audit_service
        
        # Add critical command
        await command_queue.enqueue(critical_command)
        
        # Try to cancel without force
        request = CancellationRequest(
            command_id=critical_command.id,
            reason=CancellationReason.USER_REQUEST,
            requester_id="test_user"
        )
        
        await cancellation_manager.request_cancellation(request)
        
        # Check audit log
        audit_service.log_action.assert_called_once()
        call_args = audit_service.log_action.call_args
        
        assert call_args.kwargs["details"]["success"] is False
        assert len(call_args.kwargs["details"]["validation_errors"]) > 0


class TestStatistics:
    """Test cancellation statistics tracking"""
    
    async def test_statistics_tracking(
        self,
        cancellation_manager,
        command_queue
    ):
        """Test that statistics are properly tracked"""
        initial_stats = cancellation_manager.get_statistics()
        assert initial_stats["total_requests"] == 0
        
        # Create commands
        commands = []
        for i in range(3):
            cmd = MockCommand(
                command_type=CommandType.MOVE_FORWARD,
                parameters={"distance": i * 10}
            )
            await command_queue.enqueue(cmd)
            commands.append(cmd)
        
        # Cancel first command successfully
        request1 = CancellationRequest(
            command_id=commands[0].id,
            reason=CancellationReason.USER_REQUEST,
            requester_id="test_user"
        )
        await cancellation_manager.request_cancellation(request1)
        
        # Try to cancel already completed command (should fail)
        commands[1].status = CommandStatus.COMPLETED
        request2 = CancellationRequest(
            command_id=commands[1].id,
            reason=CancellationReason.USER_REQUEST,
            requester_id="test_user"
        )
        await cancellation_manager.request_cancellation(request2)
        
        # Cancel third with cleanup failure
        commands[2].status = CommandStatus.EXECUTING
        
        async def failing_cleanup(cmd):
            raise Exception("Cleanup failed")
        
        cancellation_manager.register_cleanup_handler(
            ResourceCleanupHandler(
                resource_type="failing",
                handler=failing_cleanup,
                critical=False  # Non-critical so cancellation continues
            )
        )
        
        request3 = CancellationRequest(
            command_id=commands[2].id,
            reason=CancellationReason.USER_REQUEST,
            requester_id="test_user"
        )
        await cancellation_manager.request_cancellation(request3)
        
        # Check statistics
        stats = cancellation_manager.get_statistics()
        assert stats["total_requests"] == 3
        assert stats["successful_cancellations"] == 2
        assert stats["rejected_cancellations"] == 1
        assert stats["resource_cleanup_failures"] >= 1
        assert stats["average_cancellation_time_ms"] > 0


if __name__ == "__main__":
    pytest.main([__file__, "-v"])