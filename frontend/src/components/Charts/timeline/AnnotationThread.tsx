/**
 * AnnotationThread - Thread Management for Timeline Annotations
 * 
 * Handles the display and management of annotation threads including:
 * - Nested replies and conversations
 * - Real-time collaborative updates
 * - Reaction system
 * - User mentions and notifications
 * - Thread moderation and permissions
 */

import React, { useState, useCallback, memo, useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  IconButton,
  Button,
  Avatar,
  Chip,
  Divider,
  Collapse,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Tooltip,
  Badge,
  useTheme,
  alpha,
  styled
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Reply as ReplyIcon,
  MoreVert as MoreVertIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Report as ReportIcon,
  Star as StarIcon,
  StarBorder as StarBorderIcon,
  History as HistoryIcon,
  Share as ShareIcon,
  Close as CloseIcon,
  Send as SendIcon,
  ThumbUp as ThumbUpIcon,
  ThumbDown as ThumbDownIcon,
  Favorite as FavoriteIcon,
  EmojiEmotions as EmojiIcon
} from '@mui/icons-material';
import { format, formatDistanceToNow } from 'date-fns';
import DOMPurify from 'dompurify';
import Editor from '@monaco-editor/react';

import { 
  TimelineAnnotation, 
  AnnotationAuthor, 
  AnnotationReaction,
  AnnotationVersion,
  MentionUser
} from './TimelineAnnotations';

// Styled Components
const ThreadContainer = styled(Paper)(({ theme }) => ({
  marginBottom: theme.spacing(2),
  borderRadius: theme.spacing(1),
  overflow: 'hidden',
  transition: 'all 0.2s ease-in-out',
  '&:hover': {
    boxShadow: theme.shadows[4]
  }
}));

const AnnotationHeader = styled(Box)(({ theme }) => ({
  padding: theme.spacing(1.5),
  borderBottom: `1px solid ${theme.palette.divider}`,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between'
}));

const AnnotationContent = styled(Box)(({ theme }) => ({
  padding: theme.spacing(2),
  '& .annotation-text': {
    lineHeight: 1.6,
    wordBreak: 'break-word'
  },
  '& .annotation-html': {
    '& h1, & h2, & h3, & h4, & h5, & h6': {
      margin: `${theme.spacing(1)} 0`,
      color: theme.palette.text.primary
    },
    '& p': {
      margin: `${theme.spacing(0.5)} 0`
    },
    '& ul, & ol': {
      marginLeft: theme.spacing(2)
    },
    '& blockquote': {
      borderLeft: `4px solid ${theme.palette.primary.main}`,
      paddingLeft: theme.spacing(1),
      margin: `${theme.spacing(1)} 0`,
      fontStyle: 'italic',
      backgroundColor: alpha(theme.palette.primary.main, 0.05)
    },
    '& code': {
      backgroundColor: alpha(theme.palette.text.primary, 0.1),
      padding: theme.spacing(0.25, 0.5),
      borderRadius: theme.spacing(0.5),
      fontSize: '0.875em',
      fontFamily: 'monospace'
    },
    '& pre': {
      backgroundColor: alpha(theme.palette.text.primary, 0.05),
      padding: theme.spacing(1),
      borderRadius: theme.spacing(1),
      overflow: 'auto',
      fontSize: '0.875em',
      fontFamily: 'monospace'
    }
  }
}));

const ReplyContainer = styled(Box)(({ theme }) => ({
  marginLeft: theme.spacing(4),
  borderLeft: `2px solid ${theme.palette.divider}`,
  paddingLeft: theme.spacing(2),
  marginTop: theme.spacing(1)
}));

const ReactionBar = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
  padding: theme.spacing(1, 2),
  borderTop: `1px solid ${theme.palette.divider}`,
  backgroundColor: alpha(theme.palette.background.default, 0.5)
}));

const ReactionChip = styled(Chip)<{ isUserReaction?: boolean }>(({ theme, isUserReaction }) => ({
  cursor: 'pointer',
  transition: 'all 0.2s ease-in-out',
  backgroundColor: isUserReaction 
    ? alpha(theme.palette.primary.main, 0.2)
    : 'transparent',
  borderColor: isUserReaction 
    ? theme.palette.primary.main
    : theme.palette.divider,
  '&:hover': {
    backgroundColor: alpha(theme.palette.primary.main, 0.1),
    borderColor: theme.palette.primary.main
  }
}));

// Props Interface
export interface AnnotationThreadProps {
  annotation: TimelineAnnotation;
  currentUser: AnnotationAuthor;
  availableUsers?: MentionUser[];
  isCollaborativeMode?: boolean;
  allowRichText?: boolean;
  maxDepth?: number;
  currentDepth?: number;
  
  // Event handlers
  onReply?: (parentId: string, content: string, htmlContent?: string) => void;
  onEdit?: (id: string, content: string, htmlContent?: string) => void;
  onDelete?: (id: string) => void;
  onReaction?: (id: string, emoji: string, action: 'add' | 'remove') => void;
  onMention?: (userId: string, annotationId: string) => void;
  onReport?: (id: string, reason: string) => void;
  onPin?: (id: string) => void;
  onShare?: (id: string) => void;
  onVersionHistory?: (id: string) => void;
}

// Emoji reactions
const COMMON_REACTIONS = [
  '👍', '👎', '❤️', '😊', '😮', '😢', '😡', '🎉', '🚀', '💡'
];

/**
 * AnnotationThread Component
 * Main component for displaying annotation threads with replies
 */
export const AnnotationThread: React.FC<AnnotationThreadProps> = memo(({
  annotation,
  currentUser,
  availableUsers = [],
  isCollaborativeMode = false,
  allowRichText = true,
  maxDepth = 5,
  currentDepth = 0,
  onReply,
  onEdit,
  onDelete,
  onReaction,
  onMention,
  onReport,
  onPin,
  onShare,
  onVersionHistory
}) => {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(true);
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [replyContent, setReplyContent] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [editContent, setEditContent] = useState(annotation.content);
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [reactionMenuAnchor, setReactionMenuAnchor] = useState<null | HTMLElement>(null);
  const [reportDialog, setReportDialog] = useState(false);
  const [reportReason, setReportReason] = useState('');

  // Check permissions
  const canEdit = useMemo(() => {
    return annotation.author.id === currentUser.id || 
           currentUser.permissions.some(p => p.action === 'write' && p.scope === 'all');
  }, [annotation.author.id, currentUser]);

  const canDelete = useMemo(() => {
    return annotation.author.id === currentUser.id || 
           currentUser.permissions.some(p => p.action === 'delete' && (p.scope === 'all' || p.scope === 'own'));
  }, [annotation.author.id, currentUser]);

  const canModerate = useMemo(() => {
    return currentUser.permissions.some(p => p.action === 'moderate');
  }, [currentUser]);

  // Handle reply submission
  const handleReplySubmit = useCallback(() => {
    if (!replyContent.trim() || !onReply) return;
    
    const htmlContent = allowRichText ? DOMPurify.sanitize(replyContent) : undefined;
    onReply(annotation.id, replyContent.trim(), htmlContent);
    
    setReplyContent('');
    setShowReplyForm(false);
  }, [replyContent, annotation.id, onReply, allowRichText]);

  // Handle edit submission
  const handleEditSubmit = useCallback(() => {
    if (!editContent.trim() || !onEdit) return;
    
    const htmlContent = allowRichText ? DOMPurify.sanitize(editContent) : undefined;
    onEdit(annotation.id, editContent.trim(), htmlContent);
    
    setEditMode(false);
  }, [editContent, annotation.id, onEdit, allowRichText]);

  // Handle reaction toggle
  const handleReactionToggle = useCallback((emoji: string) => {
    if (!onReaction) return;
    
    const existingReaction = annotation.reactions.find(r => r.emoji === emoji);
    const userHasReacted = existingReaction?.users.includes(currentUser.id);
    
    onReaction(annotation.id, emoji, userHasReacted ? 'remove' : 'add');
    setReactionMenuAnchor(null);
  }, [annotation.reactions, annotation.id, currentUser.id, onReaction]);

  // Handle report submission
  const handleReportSubmit = useCallback(() => {
    if (!reportReason.trim() || !onReport) return;
    
    onReport(annotation.id, reportReason.trim());
    setReportDialog(false);
    setReportReason('');
  }, [reportReason, annotation.id, onReport]);

  // Render annotation content
  const renderContent = useCallback(() => {
    if (editMode) {
      return (
        <Box sx={{ mt: 1 }}>
          {allowRichText ? (
            <Box sx={{ 
              border: `1px solid ${theme.palette.divider}`,
              borderRadius: 1,
              minHeight: 120
            }}>
              <Editor
                height={120}
                defaultLanguage="markdown"
                value={editContent}
                onChange={(value) => setEditContent(value || '')}
                theme={theme.palette.mode === 'dark' ? 'vs-dark' : 'vs'}
                options={{
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                  wordWrap: 'on',
                  lineNumbers: 'off'
                }}
              />
            </Box>
          ) : (
            <TextField
              multiline
              rows={4}
              fullWidth
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
            />
          )}
          <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
            <Button size="small" onClick={handleEditSubmit} variant="contained">
              Save
            </Button>
            <Button size="small" onClick={() => setEditMode(false)}>
              Cancel
            </Button>
          </Box>
        </Box>
      );
    }
    
    if (annotation.htmlContent && allowRichText) {
      return (
        <div 
          className="annotation-html"
          dangerouslySetInnerHTML={{ __html: annotation.htmlContent }}
        />
      );
    }
    
    return (
      <Typography variant="body1" className="annotation-text">
        {annotation.content}
      </Typography>
    );
  }, [editMode, editContent, annotation.content, annotation.htmlContent, allowRichText, theme, handleEditSubmit]);

  // Render reply form
  const renderReplyForm = useCallback(() => {
    if (!showReplyForm) return null;
    
    return (
      <Box sx={{ mt: 2, p: 2, bgcolor: alpha(theme.palette.primary.main, 0.05), borderRadius: 1 }}>
        <Typography variant="subtitle2" gutterBottom>
          Reply to {annotation.author.name}
        </Typography>
        
        {allowRichText ? (
          <Box sx={{ 
            border: `1px solid ${theme.palette.divider}`,
            borderRadius: 1,
            minHeight: 100,
            mb: 1
          }}>
            <Editor
              height={100}
              defaultLanguage="markdown"
              value={replyContent}
              onChange={(value) => setReplyContent(value || '')}
              theme={theme.palette.mode === 'dark' ? 'vs-dark' : 'vs'}
              options={{
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                wordWrap: 'on',
                lineNumbers: 'off'
              }}
            />
          </Box>
        ) : (
          <TextField
            multiline
            rows={3}
            fullWidth
            value={replyContent}
            onChange={(e) => setReplyContent(e.target.value)}
            placeholder="Write your reply..."
            sx={{ mb: 1 }}
          />
        )}
        
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button 
            size="small" 
            onClick={handleReplySubmit} 
            variant="contained"
            disabled={!replyContent.trim()}
            startIcon={<SendIcon />}
          >
            Reply
          </Button>
          <Button size="small" onClick={() => setShowReplyForm(false)}>
            Cancel
          </Button>
        </Box>
      </Box>
    );
  }, [showReplyForm, replyContent, annotation.author.name, allowRichText, theme, handleReplySubmit]);

  // Render replies
  const renderReplies = useCallback(() => {
    if (!annotation.replies.length || !expanded) return null;
    
    return (
      <Box sx={{ mt: 1 }}>
        {annotation.replies.map(reply => (
          <ReplyContainer key={reply.id}>
            <AnnotationThread
              annotation={reply}
              currentUser={currentUser}
              availableUsers={availableUsers}
              isCollaborativeMode={isCollaborativeMode}
              allowRichText={allowRichText}
              maxDepth={maxDepth}
              currentDepth={currentDepth + 1}
              onReply={currentDepth < maxDepth ? onReply : undefined}
              onEdit={onEdit}
              onDelete={onDelete}
              onReaction={onReaction}
              onMention={onMention}
              onReport={onReport}
              onPin={onPin}
              onShare={onShare}
              onVersionHistory={onVersionHistory}
            />
          </ReplyContainer>
        ))}
      </Box>
    );
  }, [
    annotation.replies, 
    expanded, 
    currentUser, 
    availableUsers, 
    isCollaborativeMode, 
    allowRichText, 
    maxDepth, 
    currentDepth,
    onReply, 
    onEdit, 
    onDelete, 
    onReaction, 
    onMention, 
    onReport, 
    onPin, 
    onShare, 
    onVersionHistory
  ]);

  return (
    <ThreadContainer elevation={1}>
      {/* Header */}
      <AnnotationHeader>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flex: 1 }}>
          <Avatar 
            src={annotation.author.avatar}
            sx={{ width: 32, height: 32 }}
          >
            {annotation.author.name.charAt(0).toUpperCase()}
          </Avatar>
          
          <Box sx={{ flex: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="subtitle2" fontWeight="bold">
                {annotation.author.name}
              </Typography>
              <Chip 
                label={annotation.author.role} 
                size="small" 
                variant="outlined"
                sx={{ height: 20, fontSize: '0.75rem' }}
              />
              <Chip
                label={annotation.category.name}
                size="small"
                sx={{ 
                  height: 20, 
                  fontSize: '0.75rem',
                  backgroundColor: alpha(annotation.category.color, 0.1),
                  color: annotation.category.color,
                  borderColor: annotation.category.color
                }}
              />
            </Box>
            
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
              <Typography variant="caption" color="text.secondary">
                {formatDistanceToNow(annotation.createdAt, { addSuffix: true })}
              </Typography>
              
              {annotation.updatedAt > annotation.createdAt && (
                <>
                  <Typography variant="caption" color="text.secondary">•</Typography>
                  <Typography variant="caption" color="text.secondary">
                    edited {formatDistanceToNow(annotation.updatedAt, { addSuffix: true })}
                  </Typography>
                </>
              )}
              
              {annotation.version > 1 && (
                <Tooltip title="View version history">
                  <IconButton 
                    size="small" 
                    onClick={() => onVersionHistory?.(annotation.id)}
                    sx={{ p: 0.25 }}
                  >
                    <HistoryIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
            </Box>
          </Box>
        </Box>
        
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          {annotation.replies.length > 0 && (
            <Tooltip title={expanded ? 'Collapse replies' : 'Expand replies'}>
              <IconButton 
                size="small" 
                onClick={() => setExpanded(!expanded)}
              >
                <Badge badgeContent={annotation.replies.length} color="primary">
                  {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                </Badge>
              </IconButton>
            </Tooltip>
          )}
          
          <IconButton 
            size="small"
            onClick={(e) => setMenuAnchor(e.currentTarget)}
          >
            <MoreVertIcon />
          </IconButton>
        </Box>
      </AnnotationHeader>
      
      {/* Content */}
      <AnnotationContent>
        {renderContent()}
        
        {/* Tags */}
        {annotation.tags.length > 0 && (
          <Box sx={{ display: 'flex', gap: 0.5, mt: 1, flexWrap: 'wrap' }}>
            {annotation.tags.map(tag => (
              <Chip
                key={tag}
                label={`#${tag}`}
                size="small"
                variant="outlined"
                sx={{ height: 20, fontSize: '0.75rem' }}
              />
            ))}
          </Box>
        )}
        
        {/* Attachments */}
        {annotation.attachments.length > 0 && (
          <Box sx={{ mt: 1 }}>
            <Typography variant="caption" color="text.secondary">
              Attachments:
            </Typography>
            <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5, flexWrap: 'wrap' }}>
              {annotation.attachments.map(attachment => (
                <Chip
                  key={attachment.id}
                  label={attachment.name}
                  size="small"
                  clickable
                  onClick={() => window.open(attachment.url, '_blank')}
                />
              ))}
            </Box>
          </Box>
        )}
        
        {/* Reply form */}
        {renderReplyForm()}
      </AnnotationContent>
      
      {/* Reactions */}
      {annotation.reactions.length > 0 && (
        <ReactionBar>
          {annotation.reactions.map(reaction => {
            const userHasReacted = reaction.users.includes(currentUser.id);
            return (
              <ReactionChip
                key={reaction.emoji}
                label={`${reaction.emoji} ${reaction.count}`}
                size="small"
                variant="outlined"
                isUserReaction={userHasReacted}
                onClick={() => handleReactionToggle(reaction.emoji)}
              />
            );
          })}
          
          <Tooltip title="Add reaction">
            <IconButton 
              size="small"
              onClick={(e) => setReactionMenuAnchor(e.currentTarget)}
            >
              <EmojiIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </ReactionBar>
      )}
      
      {/* Replies */}
      <Collapse in={expanded}>
        {renderReplies()}
      </Collapse>
      
      {/* Context Menu */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={() => setMenuAnchor(null)}
      >
        <MenuItem onClick={() => { setShowReplyForm(true); setMenuAnchor(null); }}>
          <ListItemIcon><ReplyIcon fontSize="small" /></ListItemIcon>
          <ListItemText>Reply</ListItemText>
        </MenuItem>
        
        {canEdit && (
          <MenuItem onClick={() => { setEditMode(true); setMenuAnchor(null); }}>
            <ListItemIcon><EditIcon fontSize="small" /></ListItemIcon>
            <ListItemText>Edit</ListItemText>
          </MenuItem>
        )}
        
        <MenuItem onClick={() => { onShare?.(annotation.id); setMenuAnchor(null); }}>
          <ListItemIcon><ShareIcon fontSize="small" /></ListItemIcon>
          <ListItemText>Share</ListItemText>
        </MenuItem>
        
        <MenuItem onClick={() => { onPin?.(annotation.id); setMenuAnchor(null); }}>
          <ListItemIcon><StarIcon fontSize="small" /></ListItemIcon>
          <ListItemText>Pin</ListItemText>
        </MenuItem>
        
        <Divider />
        
        <MenuItem onClick={() => { setReportDialog(true); setMenuAnchor(null); }}>
          <ListItemIcon><ReportIcon fontSize="small" /></ListItemIcon>
          <ListItemText>Report</ListItemText>
        </MenuItem>
        
        {canDelete && (
          <MenuItem 
            onClick={() => { onDelete?.(annotation.id); setMenuAnchor(null); }}
            sx={{ color: 'error.main' }}
          >
            <ListItemIcon><DeleteIcon fontSize="small" /></ListItemIcon>
            <ListItemText>Delete</ListItemText>
          </MenuItem>
        )}
      </Menu>
      
      {/* Reaction Menu */}
      <Menu
        anchorEl={reactionMenuAnchor}
        open={Boolean(reactionMenuAnchor)}
        onClose={() => setReactionMenuAnchor(null)}
      >
        <Box sx={{ display: 'flex', gap: 0.5, p: 1, flexWrap: 'wrap', maxWidth: 200 }}>
          {COMMON_REACTIONS.map(emoji => (
            <IconButton
              key={emoji}
              size="small"
              onClick={() => handleReactionToggle(emoji)}
              sx={{ fontSize: '1.2rem' }}
            >
              {emoji}
            </IconButton>
          ))}
        </Box>
      </Menu>
      
      {/* Report Dialog */}
      <Dialog open={reportDialog} onClose={() => setReportDialog(false)}>
        <DialogTitle>Report Annotation</DialogTitle>
        <DialogContent>
          <TextField
            multiline
            rows={4}
            fullWidth
            value={reportReason}
            onChange={(e) => setReportReason(e.target.value)}
            placeholder="Please describe why you're reporting this annotation..."
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReportDialog(false)}>Cancel</Button>
          <Button 
            onClick={handleReportSubmit}
            variant="contained"
            color="error"
            disabled={!reportReason.trim()}
          >
            Report
          </Button>
        </DialogActions>
      </Dialog>
    </ThreadContainer>
  );
});

AnnotationThread.displayName = 'AnnotationThread';

export default AnnotationThread;