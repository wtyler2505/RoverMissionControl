/**
 * useAnnotationCollaboration Hook
 * 
 * Manages real-time collaborative features for timeline annotations including:
 * - WebSocket connection management
 * - Real-time annotation updates
 * - User presence indicators
 * - Collaborative cursors
 * - Conflict resolution
 * - Offline queue management
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { io, Socket } from 'socket.io-client';
import { v4 as uuidv4 } from 'uuid';

import { 
  TimelineAnnotation, 
  AnnotationAuthor, 
  MentionUser 
} from './TimelineAnnotations';

// Types
export interface CollaborativeEvent {
  type: 'annotation_added' | 'annotation_updated' | 'annotation_deleted' | 'user_joined' | 'user_left' | 'cursor_moved';
  data: any;
  userId: string;
  timestamp: Date;
  sessionId: string;
}

export interface UserPresence {
  userId: string;
  user: AnnotationAuthor;
  isOnline: boolean;
  lastSeen: Date;
  cursor?: { x: number; y: number; timestamp: Date };
  currentAnnotation?: string; // ID of annotation being edited
}

export interface CollaborationState {
  isConnected: boolean;
  activeUsers: UserPresence[];
  pendingChanges: CollaborativeEvent[];
  conflicts: AnnotationConflict[];
  sessionId: string;
}

export interface AnnotationConflict {
  annotationId: string;
  conflictType: 'concurrent_edit' | 'delete_modified' | 'version_mismatch';
  localVersion: TimelineAnnotation;
  remoteVersion: TimelineAnnotation;
  timestamp: Date;
}

export interface UseAnnotationCollaborationOptions {
  enabled?: boolean;
  wsUrl?: string;
  currentUser: AnnotationAuthor;
  onAnnotationUpdate?: (annotation: TimelineAnnotation) => void;
  onAnnotationDelete?: (annotationId: string) => void;
  onConflict?: (conflict: AnnotationConflict) => void;
  onUserJoin?: (user: AnnotationAuthor) => void;
  onUserLeave?: (userId: string) => void;
  onError?: (error: Error) => void;
  reconnectAttempts?: number;
  heartbeatInterval?: number;
}

/**
 * useAnnotationCollaboration Hook
 * Manages real-time collaborative annotation features
 */
export const useAnnotationCollaboration = (
  annotations: TimelineAnnotation[],
  options: UseAnnotationCollaborationOptions
) => {
  const {
    enabled = true,
    wsUrl = 'ws://localhost:8000/annotations',
    currentUser,
    onAnnotationUpdate,
    onAnnotationDelete,
    onConflict,
    onUserJoin,
    onUserLeave,
    onError,
    reconnectAttempts = 5,
    heartbeatInterval = 30000
  } = options;

  const [collaborationState, setCollaborationState] = useState<CollaborationState>({
    isConnected: false,
    activeUsers: [],
    pendingChanges: [],
    conflicts: [],
    sessionId: uuidv4()
  });

  const socketRef = useRef<Socket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const offlineQueueRef = useRef<CollaborativeEvent[]>([]);
  const annotationVersionsRef = useRef<Map<string, number>>(new Map());

  // Initialize WebSocket connection
  const initializeConnection = useCallback(() => {
    if (!enabled || socketRef.current?.connected) return;

    try {
      socketRef.current = io(wsUrl, {
        transports: ['websocket'],
        auth: {
          userId: currentUser.id,
          userName: currentUser.name,
          sessionId: collaborationState.sessionId
        },
        reconnection: true,
        reconnectionAttempts: reconnectAttempts,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000
      });

      const socket = socketRef.current;

      // Connection events
      socket.on('connect', () => {
        console.log('Connected to annotation collaboration server');
        setCollaborationState(prev => ({
          ...prev,
          isConnected: true,
          pendingChanges: []
        }));

        // Process offline queue
        if (offlineQueueRef.current.length > 0) {
          offlineQueueRef.current.forEach(event => {
            socket.emit('collaborative_event', event);
          });
          offlineQueueRef.current = [];
        }

        // Start heartbeat
        startHeartbeat();
      });

      socket.on('disconnect', () => {
        console.log('Disconnected from annotation collaboration server');
        setCollaborationState(prev => ({
          ...prev,
          isConnected: false
        }));
        stopHeartbeat();
      });

      socket.on('connect_error', (error) => {
        console.error('Collaboration connection error:', error);
        onError?.(error);
      });

      // Collaboration events
      socket.on('annotation_added', (data: { annotation: TimelineAnnotation; userId: string }) => {
        if (data.userId !== currentUser.id) {
          onAnnotationUpdate?.(data.annotation);
          annotationVersionsRef.current.set(data.annotation.id, data.annotation.version);
        }
      });

      socket.on('annotation_updated', (data: { 
        annotation: TimelineAnnotation; 
        userId: string; 
        previousVersion: number 
      }) => {
        if (data.userId !== currentUser.id) {
          // Check for conflicts
          const localVersion = annotationVersionsRef.current.get(data.annotation.id);
          if (localVersion && localVersion !== data.previousVersion) {
            const localAnnotation = annotations.find(a => a.id === data.annotation.id);
            if (localAnnotation) {
              const conflict: AnnotationConflict = {
                annotationId: data.annotation.id,
                conflictType: 'concurrent_edit',
                localVersion: localAnnotation,
                remoteVersion: data.annotation,
                timestamp: new Date()
              };
              
              setCollaborationState(prev => ({
                ...prev,
                conflicts: [...prev.conflicts, conflict]
              }));
              
              onConflict?.(conflict);
              return;
            }
          }
          
          onAnnotationUpdate?.(data.annotation);
          annotationVersionsRef.current.set(data.annotation.id, data.annotation.version);
        }
      });

      socket.on('annotation_deleted', (data: { annotationId: string; userId: string }) => {
        if (data.userId !== currentUser.id) {
          onAnnotationDelete?.(data.annotationId);
          annotationVersionsRef.current.delete(data.annotationId);
        }
      });

      // User presence events
      socket.on('user_joined', (data: { user: AnnotationAuthor; sessionId: string }) => {
        if (data.user.id !== currentUser.id) {
          setCollaborationState(prev => ({
            ...prev,
            activeUsers: [
              ...prev.activeUsers.filter(u => u.userId !== data.user.id),
              {
                userId: data.user.id,
                user: data.user,
                isOnline: true,
                lastSeen: new Date()
              }
            ]
          }));
          
          onUserJoin?.(data.user);
        }
      });

      socket.on('user_left', (data: { userId: string }) => {
        if (data.userId !== currentUser.id) {
          setCollaborationState(prev => ({
            ...prev,
            activeUsers: prev.activeUsers.map(u => 
              u.userId === data.userId 
                ? { ...u, isOnline: false, lastSeen: new Date() }
                : u
            )
          }));
          
          onUserLeave?.(data.userId);
        }
      });

      socket.on('cursor_moved', (data: { 
        userId: string; 
        position: { x: number; y: number }; 
        annotationId?: string 
      }) => {
        if (data.userId !== currentUser.id) {
          setCollaborationState(prev => ({
            ...prev,
            activeUsers: prev.activeUsers.map(u => 
              u.userId === data.userId 
                ? { 
                    ...u, 
                    cursor: { 
                      x: data.position.x, 
                      y: data.position.y, 
                      timestamp: new Date() 
                    },
                    currentAnnotation: data.annotationId
                  }
                : u
            )
          }));
        }
      });

      socket.on('active_users', (data: { users: AnnotationAuthor[] }) => {
        const presenceUsers: UserPresence[] = data.users
          .filter(user => user.id !== currentUser.id)
          .map(user => ({
            userId: user.id,
            user,
            isOnline: true,
            lastSeen: new Date()
          }));
        
        setCollaborationState(prev => ({
          ...prev,
          activeUsers: presenceUsers
        }));
      });

    } catch (error) {
      console.error('Failed to initialize collaboration:', error);
      onError?.(error as Error);
    }
  }, [
    enabled, 
    wsUrl, 
    currentUser, 
    collaborationState.sessionId, 
    reconnectAttempts,
    onAnnotationUpdate,
    onAnnotationDelete,
    onConflict,
    onUserJoin,
    onUserLeave,
    onError,
    annotations
  ]);

  // Start heartbeat
  const startHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) return;
    
    heartbeatIntervalRef.current = setInterval(() => {
      if (socketRef.current?.connected) {
        socketRef.current.emit('heartbeat', {
          userId: currentUser.id,
          timestamp: new Date().toISOString()
        });
      }
    }, heartbeatInterval);
  }, [currentUser.id, heartbeatInterval]);

  // Stop heartbeat
  const stopHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
  }, []);

  // Emit collaborative event
  const emitCollaborativeEvent = useCallback((event: Omit<CollaborativeEvent, 'userId' | 'sessionId'>) => {
    const fullEvent: CollaborativeEvent = {
      ...event,
      userId: currentUser.id,
      sessionId: collaborationState.sessionId
    };

    if (socketRef.current?.connected) {
      socketRef.current.emit('collaborative_event', fullEvent);
    } else {
      // Queue for when connection is restored
      offlineQueueRef.current.push(fullEvent);
    }
  }, [currentUser.id, collaborationState.sessionId]);

  // Broadcast annotation addition
  const broadcastAnnotationAdded = useCallback((annotation: TimelineAnnotation) => {
    annotationVersionsRef.current.set(annotation.id, annotation.version);
    emitCollaborativeEvent({
      type: 'annotation_added',
      data: { annotation },
      timestamp: new Date()
    });
  }, [emitCollaborativeEvent]);

  // Broadcast annotation update
  const broadcastAnnotationUpdated = useCallback((annotation: TimelineAnnotation, previousVersion: number) => {
    annotationVersionsRef.current.set(annotation.id, annotation.version);
    emitCollaborativeEvent({
      type: 'annotation_updated',
      data: { annotation, previousVersion },
      timestamp: new Date()
    });
  }, [emitCollaborativeEvent]);

  // Broadcast annotation deletion
  const broadcastAnnotationDeleted = useCallback((annotationId: string) => {
    annotationVersionsRef.current.delete(annotationId);
    emitCollaborativeEvent({
      type: 'annotation_deleted',
      data: { annotationId },
      timestamp: new Date()
    });
  }, [emitCollaborativeEvent]);

  // Broadcast cursor movement
  const broadcastCursorMoved = useCallback((position: { x: number; y: number }, annotationId?: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('cursor_moved', {
        userId: currentUser.id,
        position,
        annotationId,
        timestamp: new Date().toISOString()
      });
    }
  }, [currentUser.id]);

  // Resolve conflict
  const resolveConflict = useCallback((
    conflict: AnnotationConflict, 
    resolution: 'use_local' | 'use_remote' | 'merge'
  ) => {
    let resolvedAnnotation: TimelineAnnotation;
    
    switch (resolution) {
      case 'use_local':
        resolvedAnnotation = conflict.localVersion;
        break;
      case 'use_remote':
        resolvedAnnotation = conflict.remoteVersion;
        break;
      case 'merge':
        // Simple merge strategy - could be enhanced
        resolvedAnnotation = {
          ...conflict.remoteVersion,
          content: `${conflict.localVersion.content}\n\n---\n\n${conflict.remoteVersion.content}`,
          version: Math.max(conflict.localVersion.version, conflict.remoteVersion.version) + 1,
          updatedAt: new Date()
        };
        break;
      default:
        resolvedAnnotation = conflict.remoteVersion;
    }
    
    // Remove conflict from state
    setCollaborationState(prev => ({
      ...prev,
      conflicts: prev.conflicts.filter(c => c.annotationId !== conflict.annotationId)
    }));
    
    // Update annotation
    onAnnotationUpdate?.(resolvedAnnotation);
    
    // Broadcast resolution
    broadcastAnnotationUpdated(resolvedAnnotation, conflict.localVersion.version);
  }, [onAnnotationUpdate, broadcastAnnotationUpdated]);

  // Get online users
  const onlineUsers = useMemo(() => {
    return collaborationState.activeUsers.filter(user => user.isOnline);
  }, [collaborationState.activeUsers]);

  // Initialize connection on mount
  useEffect(() => {
    if (enabled) {
      initializeConnection();
    }

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      
      stopHeartbeat();
    };
  }, [enabled, initializeConnection, stopHeartbeat]);

  // Update annotation versions when annotations change
  useEffect(() => {
    annotations.forEach(annotation => {
      annotationVersionsRef.current.set(annotation.id, annotation.version);
    });
  }, [annotations]);

  return {
    collaborationState,
    onlineUsers,
    isConnected: collaborationState.isConnected,
    activeUsers: collaborationState.activeUsers,
    conflicts: collaborationState.conflicts,
    pendingChanges: collaborationState.pendingChanges,
    
    // Methods
    broadcastAnnotationAdded,
    broadcastAnnotationUpdated,
    broadcastAnnotationDeleted,
    broadcastCursorMoved,
    resolveConflict,
    
    // Connection management
    connect: initializeConnection,
    disconnect: () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    }
  };
};

export default useAnnotationCollaboration;