/**
 * Collaboration Cursors Component
 * Displays real-time cursor positions of collaborating users
 */

import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import styled from 'styled-components';
import { 
  CollaborationCursor, 
  CollaborationUser 
} from '../../../types/enterprise-annotations';

interface CollaborationCursorsProps {
  cursors: CollaborationCursor[];
  users: CollaborationUser[];
  currentUserId: string;
}

const CursorContainer = styled(motion.div)`
  position: absolute;
  pointer-events: none;
  z-index: 1000;
`;

const CursorSvg = styled.svg`
  position: absolute;
  transform: translate(-2px, -2px);
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2));
`;

const CursorLabel = styled(motion.div)<{ color: string }>`
  position: absolute;
  left: 20px;
  top: 20px;
  background: ${props => props.color};
  color: white;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
  white-space: nowrap;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
`;

export const CollaborationCursors: React.FC<CollaborationCursorsProps> = ({
  cursors,
  users,
  currentUserId
}) => {
  const cursorTimeouts = useRef<Map<string, NodeJS.Timeout>>(new Map());

  useEffect(() => {
    // Cleanup timeouts on unmount
    return () => {
      cursorTimeouts.current.forEach(timeout => clearTimeout(timeout));
    };
  }, []);

  const getUserForCursor = (cursor: CollaborationCursor): CollaborationUser | undefined => {
    return users.find(u => u.userId === cursor.userId);
  };

  const handleCursorTimeout = (userId: string) => {
    // Clear existing timeout if any
    const existingTimeout = cursorTimeouts.current.get(userId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Set new timeout to hide cursor after 5 seconds of inactivity
    const timeout = setTimeout(() => {
      // Cursor will be removed from state by parent component
      cursorTimeouts.current.delete(userId);
    }, 5000);

    cursorTimeouts.current.set(userId, timeout);
  };

  return (
    <AnimatePresence>
      {cursors
        .filter(cursor => cursor.userId !== currentUserId)
        .map(cursor => {
          const user = getUserForCursor(cursor);
          if (!user) return null;

          // Reset timeout on cursor movement
          handleCursorTimeout(cursor.userId);

          return (
            <CursorContainer
              key={cursor.userId}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ 
                opacity: 1, 
                scale: 1,
                x: cursor.x,
                y: cursor.y
              }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ 
                type: "spring", 
                damping: 30, 
                stiffness: 300 
              }}
            >
              <CursorSvg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
              >
                <path
                  d="M3 3L10.07 19.97L12.58 12.58L19.97 10.07L3 3Z"
                  fill={user.color}
                  stroke="white"
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                />
              </CursorSvg>
              
              <CursorLabel
                color={user.color}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                {user.userName}
              </CursorLabel>
            </CursorContainer>
          );
        })}
    </AnimatePresence>
  );
};

export default CollaborationCursors;