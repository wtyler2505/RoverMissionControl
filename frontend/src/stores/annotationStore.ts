/**
 * Enterprise Annotation Store
 * Manages annotation state with versioning, permissions, and real-time collaboration
 */

import { create } from 'zustand';
import { devtools, subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import {
  EnhancedAnnotation,
  AnnotationStoreState,
  AnnotationVersion,
  AnnotationPermission,
  AnnotationConflict,
  CollaborationState,
  EnhancedAnnotationEvent,
  AnnotationAuditAction,
  EnhancedAnnotationSearchParams,
  CollaborationUser,
  CollaborationCursor,
  CollaborationSelection
} from '../types/enterprise-annotations';

interface AnnotationStore extends AnnotationStoreState {
  // Actions
  setAnnotations: (annotations: EnhancedAnnotation[]) => void;
  addAnnotation: (annotation: EnhancedAnnotation) => void;
  updateAnnotation: (id: string, updates: Partial<EnhancedAnnotation>) => void;
  deleteAnnotation: (id: string) => void;
  
  // Optimistic updates
  addOptimisticUpdate: (annotation: EnhancedAnnotation) => void;
  confirmOptimisticUpdate: (tempId: string, realId: string) => void;
  rollbackOptimisticUpdate: (tempId: string) => void;
  
  // Version management
  loadVersionHistory: (annotationId: string, versions: AnnotationVersion[]) => void;
  revertToVersion: (annotationId: string, version: number) => void;
  
  // Permission management
  updatePermissions: (annotationId: string, permissions: AnnotationPermission) => void;
  cachePermissions: (permissions: Map<string, AnnotationPermission>) => void;
  
  // Collaboration
  updateCollaborationState: (state: Partial<CollaborationState>) => void;
  addActiveUser: (user: CollaborationUser) => void;
  removeActiveUser: (userId: string) => void;
  updateCursor: (cursor: CollaborationCursor) => void;
  updateSelection: (selection: CollaborationSelection) => void;
  
  // Lock management
  lockAnnotation: (annotationId: string, userId: string, userName: string) => void;
  unlockAnnotation: (annotationId: string) => void;
  
  // Conflict resolution
  addConflict: (conflict: AnnotationConflict) => void;
  resolveConflict: (conflictId: string, resolution: 'local' | 'remote' | 'merge') => void;
  clearConflicts: () => void;
  
  // Search and filtering
  setSearchResults: (results: string[]) => void;
  clearSearchResults: () => void;
  
  // WebSocket event handling
  handleWebSocketEvent: (event: EnhancedAnnotationEvent) => void;
  
  // Loading and errors
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  
  // Batch operations
  batchUpdateAnnotations: (updates: Array<{ id: string; changes: Partial<EnhancedAnnotation> }>) => void;
  batchDeleteAnnotations: (ids: string[]) => void;
  
  // Utility functions
  getAnnotationById: (id: string) => EnhancedAnnotation | undefined;
  getAnnotationsByChartId: (chartId: string) => EnhancedAnnotation[];
  getUserPermissions: (annotationId: string, userId: string) => AnnotationPermission | undefined;
  canUserEdit: (annotationId: string, userId: string) => boolean;
  canUserDelete: (annotationId: string, userId: string) => boolean;
}

const useAnnotationStore = create<AnnotationStore>()(
  devtools(
    subscribeWithSelector(
      immer((set, get) => ({
        // Initial state
        annotations: new Map(),
        versionCache: new Map(),
        permissionCache: new Map(),
        conflicts: [],
        collaborationState: {
          activeUsers: [],
          cursors: [],
          selections: []
        },
        searchResults: [],
        isLoading: false,
        error: null,
        optimisticUpdates: new Map(),

        // Basic CRUD operations
        setAnnotations: (annotations) => set((state) => {
          state.annotations.clear();
          annotations.forEach(annotation => {
            state.annotations.set(annotation.id, annotation);
          });
        }),

        addAnnotation: (annotation) => set((state) => {
          state.annotations.set(annotation.id, annotation);
        }),

        updateAnnotation: (id, updates) => set((state) => {
          const annotation = state.annotations.get(id);
          if (annotation) {
            // Create new version entry
            const newVersion: AnnotationVersion = {
              version: annotation.version,
              timestamp: Date.now(),
              userId: updates.updatedBy || annotation.updatedBy,
              userName: updates.updatedBy || annotation.updatedBy, // TODO: Get actual username
              changes: Object.entries(updates).map(([field, newValue]) => ({
                field,
                oldValue: (annotation as any)[field],
                newValue
              })),
              comment: updates.metadata?.updateComment
            };

            // Update annotation
            const updatedAnnotation = {
              ...annotation,
              ...updates,
              version: annotation.version + 1,
              updatedAt: Date.now()
            };

            state.annotations.set(id, updatedAnnotation);

            // Update version cache
            const versions = state.versionCache.get(id) || [];
            state.versionCache.set(id, [...versions, newVersion]);
          }
        }),

        deleteAnnotation: (id) => set((state) => {
          state.annotations.delete(id);
          state.versionCache.delete(id);
          state.permissionCache.delete(id);
          state.optimisticUpdates.delete(id);
        }),

        // Optimistic updates
        addOptimisticUpdate: (annotation) => set((state) => {
          state.optimisticUpdates.set(annotation.id, annotation);
          state.annotations.set(annotation.id, annotation);
        }),

        confirmOptimisticUpdate: (tempId, realId) => set((state) => {
          const optimisticAnnotation = state.optimisticUpdates.get(tempId);
          if (optimisticAnnotation) {
            state.optimisticUpdates.delete(tempId);
            state.annotations.delete(tempId);
            
            // Update with real ID
            const confirmedAnnotation = { ...optimisticAnnotation, id: realId };
            state.annotations.set(realId, confirmedAnnotation);
          }
        }),

        rollbackOptimisticUpdate: (tempId) => set((state) => {
          state.optimisticUpdates.delete(tempId);
          state.annotations.delete(tempId);
        }),

        // Version management
        loadVersionHistory: (annotationId, versions) => set((state) => {
          state.versionCache.set(annotationId, versions);
        }),

        revertToVersion: (annotationId, version) => set((state) => {
          const versions = state.versionCache.get(annotationId);
          const annotation = state.annotations.get(annotationId);
          
          if (versions && annotation) {
            const targetVersion = versions.find(v => v.version === version);
            if (targetVersion) {
              // Apply changes in reverse to revert
              const revertedAnnotation = { ...annotation };
              targetVersion.changes.forEach(change => {
                (revertedAnnotation as any)[change.field] = change.oldValue;
              });
              
              revertedAnnotation.version = annotation.version + 1;
              revertedAnnotation.updatedAt = Date.now();
              
              state.annotations.set(annotationId, revertedAnnotation);
            }
          }
        }),

        // Permission management
        updatePermissions: (annotationId, permissions) => set((state) => {
          state.permissionCache.set(annotationId, permissions);
          const annotation = state.annotations.get(annotationId);
          if (annotation) {
            annotation.permissions = permissions;
          }
        }),

        cachePermissions: (permissions) => set((state) => {
          state.permissionCache = permissions;
        }),

        // Collaboration
        updateCollaborationState: (updates) => set((state) => {
          state.collaborationState = {
            ...state.collaborationState,
            ...updates
          };
        }),

        addActiveUser: (user) => set((state) => {
          const existingIndex = state.collaborationState.activeUsers.findIndex(
            u => u.userId === user.userId
          );
          
          if (existingIndex >= 0) {
            state.collaborationState.activeUsers[existingIndex] = user;
          } else {
            state.collaborationState.activeUsers.push(user);
          }
        }),

        removeActiveUser: (userId) => set((state) => {
          state.collaborationState.activeUsers = state.collaborationState.activeUsers.filter(
            u => u.userId !== userId
          );
          state.collaborationState.cursors = state.collaborationState.cursors.filter(
            c => c.userId !== userId
          );
          state.collaborationState.selections = state.collaborationState.selections.filter(
            s => s.userId !== userId
          );
        }),

        updateCursor: (cursor) => set((state) => {
          const existingIndex = state.collaborationState.cursors.findIndex(
            c => c.userId === cursor.userId
          );
          
          if (existingIndex >= 0) {
            state.collaborationState.cursors[existingIndex] = cursor;
          } else {
            state.collaborationState.cursors.push(cursor);
          }
        }),

        updateSelection: (selection) => set((state) => {
          const existingIndex = state.collaborationState.selections.findIndex(
            s => s.userId === selection.userId
          );
          
          if (existingIndex >= 0) {
            state.collaborationState.selections[existingIndex] = selection;
          } else {
            state.collaborationState.selections.push(selection);
          }
        }),

        // Lock management
        lockAnnotation: (annotationId, userId, userName) => set((state) => {
          const annotation = state.annotations.get(annotationId);
          if (annotation) {
            annotation.locked = true;
            annotation.lockedBy = userId;
            annotation.lockedAt = Date.now();
          }
        }),

        unlockAnnotation: (annotationId) => set((state) => {
          const annotation = state.annotations.get(annotationId);
          if (annotation) {
            annotation.locked = false;
            annotation.lockedBy = undefined;
            annotation.lockedAt = undefined;
          }
        }),

        // Conflict resolution
        addConflict: (conflict) => set((state) => {
          state.conflicts.push(conflict);
        }),

        resolveConflict: (conflictId, resolution) => set((state) => {
          const conflictIndex = state.conflicts.findIndex(c => c.id === conflictId);
          if (conflictIndex >= 0) {
            const conflict = state.conflicts[conflictIndex];
            
            switch (resolution) {
              case 'local':
                state.annotations.set(conflict.annotationId, conflict.localVersion);
                break;
              case 'remote':
                state.annotations.set(conflict.annotationId, conflict.remoteVersion);
                break;
              case 'merge':
                // TODO: Implement merge logic
                break;
            }
            
            state.conflicts.splice(conflictIndex, 1);
          }
        }),

        clearConflicts: () => set((state) => {
          state.conflicts = [];
        }),

        // Search and filtering
        setSearchResults: (results) => set((state) => {
          state.searchResults = results;
        }),

        clearSearchResults: () => set((state) => {
          state.searchResults = [];
        }),

        // WebSocket event handling
        handleWebSocketEvent: (event) => {
          const { type, annotationId, userId, data } = event;
          
          switch (type) {
            case 'annotation.created':
              if (data?.annotation) {
                get().addAnnotation(data.annotation);
              }
              break;
              
            case 'annotation.updated':
              if (data?.annotation) {
                get().updateAnnotation(annotationId, data.annotation);
              }
              break;
              
            case 'annotation.deleted':
              get().deleteAnnotation(annotationId);
              break;
              
            case 'annotation.locked':
              get().lockAnnotation(annotationId, userId, data?.userName || userId);
              break;
              
            case 'annotation.unlocked':
              get().unlockAnnotation(annotationId);
              break;
              
            case 'user.joined':
              if (data?.user) {
                get().addActiveUser(data.user);
              }
              break;
              
            case 'user.left':
              get().removeActiveUser(userId);
              break;
              
            case 'cursor.moved':
              if (data?.cursor) {
                get().updateCursor(data.cursor);
              }
              break;
              
            case 'selection.changed':
              if (data?.selection) {
                get().updateSelection(data.selection);
              }
              break;
          }
        },

        // Loading and errors
        setLoading: (loading) => set((state) => {
          state.isLoading = loading;
        }),

        setError: (error) => set((state) => {
          state.error = error;
        }),

        // Batch operations
        batchUpdateAnnotations: (updates) => set((state) => {
          updates.forEach(({ id, changes }) => {
            const annotation = state.annotations.get(id);
            if (annotation) {
              state.annotations.set(id, {
                ...annotation,
                ...changes,
                version: annotation.version + 1,
                updatedAt: Date.now()
              });
            }
          });
        }),

        batchDeleteAnnotations: (ids) => set((state) => {
          ids.forEach(id => {
            state.annotations.delete(id);
            state.versionCache.delete(id);
            state.permissionCache.delete(id);
          });
        }),

        // Utility functions
        getAnnotationById: (id) => {
          return get().annotations.get(id);
        },

        getAnnotationsByChartId: (chartId) => {
          return Array.from(get().annotations.values()).filter(
            annotation => annotation.chartId === chartId
          );
        },

        getUserPermissions: (annotationId, userId) => {
          const permissions = get().permissionCache.get(annotationId);
          if (!permissions) return undefined;
          
          // Check user-specific permissions
          if (permissions.users[userId]) {
            return permissions;
          }
          
          // TODO: Check role-based permissions
          
          return permissions.public ? permissions : undefined;
        },

        canUserEdit: (annotationId, userId) => {
          const annotation = get().annotations.get(annotationId);
          if (!annotation) return false;
          
          // Owner can always edit
          if (annotation.createdBy === userId) return true;
          
          // Check if locked by another user
          if (annotation.locked && annotation.lockedBy !== userId) return false;
          
          // Check permissions
          const permissions = get().getUserPermissions(annotationId, userId);
          return permissions?.users[userId]?.canEdit || false;
        },

        canUserDelete: (annotationId, userId) => {
          const annotation = get().annotations.get(annotationId);
          if (!annotation) return false;
          
          // Owner can always delete
          if (annotation.createdBy === userId) return true;
          
          // Check permissions
          const permissions = get().getUserPermissions(annotationId, userId);
          return permissions?.users[userId]?.canDelete || false;
        }
      }))
    ),
    {
      name: 'annotation-store',
    }
  )
);

export default useAnnotationStore;