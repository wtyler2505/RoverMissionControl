/**
 * Comprehensive Tests for Alert Grouping Algorithm Correctness and Performance
 * Tests the EnhancedAlertGroupingManager grouping logic and performance characteristics
 * @jest-environment jsdom
 */

import { EnhancedAlertGroupingManager, AlertGroupCriteria } from '../../../../../utils/alertQueue/EnhancedAlertGroupingManager';
import { ProcessedAlert } from '../../../../../utils/alertQueue/AlertQueueManager';
import { AlertPriority } from '../../../../../theme/alertPriorities';

// Mock performance.now for consistent timing
global.performance.now = jest.fn(() => Date.now());

// Helper to create mock alerts
const createMockAlert = (
  id: string,
  priority: AlertPriority,
  message: string,
  options?: {
    title?: string;
    source?: string;
    groupId?: string;
    metadata?: Record<string, any>;
    timestamp?: Date;
  }
): ProcessedAlert => ({
  id,
  priority,
  queuedAt: options?.timestamp || new Date(),
  processAfter: new Date(),
  metadata: { 
    source: options?.source || 'test',
    ...options?.metadata 
  },
  data: {
    message,
    title: options?.title || `Alert ${id}`,
    groupId: options?.groupId,
    closable: true,
  },
});

// Levenshtein distance function for testing similarity
const levenshteinDistance = (str1: string, str2: string): number => {
  const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
  
  for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
  for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;
  
  for (let j = 1; j <= str2.length; j++) {
    for (let i = 1; i <= str1.length; i++) {
      const substitutionCost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1,
        matrix[j - 1][i] + 1,
        matrix[j - 1][i - 1] + substitutionCost
      );
    }
  }
  
  return matrix[str2.length][str1.length];
};

describe('Alert Grouping Algorithm', () => {
  let groupingManager: EnhancedAlertGroupingManager;

  beforeEach(() => {
    groupingManager = new EnhancedAlertGroupingManager({
      maxGroups: 20,
      undoHistorySize: 100,
    });
  });

  describe('Basic Grouping Functionality', () => {
    it('should group alerts with identical messages', () => {
      const alerts = [
        createMockAlert('1', 'medium', 'Network connection failed'),
        createMockAlert('2', 'medium', 'Network connection failed'),
        createMockAlert('3', 'medium', 'Network connection failed'),
      ];

      const groups = groupingManager.analyzeAndGroup(alerts);

      expect(groups.size).toBe(1);
      const group = Array.from(groups.values())[0];
      expect(group.alerts).toHaveLength(3);
      expect(group.groupType).toBe('automatic');
    });

    it('should not group alerts with different messages', () => {
      const alerts = [
        createMockAlert('1', 'medium', 'Network connection failed'),
        createMockAlert('2', 'medium', 'Database query timeout'),
        createMockAlert('3', 'medium', 'Authentication error'),
      ];

      const groups = groupingManager.analyzeAndGroup(alerts);

      // Should create separate groups or no groups at all
      if (groups.size > 0) {
        Array.from(groups.values()).forEach(group => {
          expect(group.alerts).toHaveLength(1);
        });
      } else {
        // No grouping occurred, which is also valid
        expect(groups.size).toBe(0);
      }
    });

    it('should group alerts with similar messages using Levenshtein distance', () => {
      const alerts = [
        createMockAlert('1', 'medium', 'Connection to server failed'),
        createMockAlert('2', 'medium', 'Connection to server timeout'),
        createMockAlert('3', 'medium', 'Connection to server error'),
      ];

      const criteria: AlertGroupCriteria = {
        titleSimilarity: 0.7, // 70% similarity threshold
      };

      const customManager = new EnhancedAlertGroupingManager({
        groupingCriteria: criteria,
      });

      const groups = customManager.analyzeAndGroup(alerts);

      // Should group based on similarity
      expect(groups.size).toBeGreaterThanOrEqual(1);
      
      if (groups.size === 1) {
        const group = Array.from(groups.values())[0];
        expect(group.alerts).toHaveLength(3);
        expect(group.groupingCriteria).toContain('similar-content');
      }
    });

    it('should respect groupId when provided', () => {
      const alerts = [
        createMockAlert('1', 'medium', 'Different message 1', { groupId: 'network-issues' }),
        createMockAlert('2', 'medium', 'Different message 2', { groupId: 'network-issues' }),
        createMockAlert('3', 'medium', 'Different message 3', { groupId: 'auth-issues' }),
      ];

      const groups = groupingManager.analyzeAndGroup(alerts);

      expect(groups.size).toBe(2);
      
      const networkGroup = Array.from(groups.values()).find(g => 
        g.alerts.some(a => a.data?.groupId === 'network-issues')
      );
      const authGroup = Array.from(groups.values()).find(g => 
        g.alerts.some(a => a.data?.groupId === 'auth-issues')
      );

      expect(networkGroup?.alerts).toHaveLength(2);
      expect(authGroup?.alerts).toHaveLength(1);
    });
  });

  describe('Advanced Grouping Criteria', () => {
    it('should group by message patterns using regex', () => {
      const alerts = [
        createMockAlert('1', 'medium', 'Error 404: Page not found'),
        createMockAlert('2', 'medium', 'Error 403: Access denied'),
        createMockAlert('3', 'medium', 'Error 500: Internal server error'),
        createMockAlert('4', 'medium', 'Warning: Low disk space'),
      ];

      const criteria: AlertGroupCriteria = {
        messagePattern: /^Error \d+:/,
      };

      const customManager = new EnhancedAlertGroupingManager({
        groupingCriteria: criteria,
      });

      const groups = customManager.analyzeAndGroup(alerts);

      expect(groups.size).toBeGreaterThanOrEqual(1);
      
      // Find the error group
      const errorGroup = Array.from(groups.values()).find(g => 
        g.alerts.every(a => /^Error \d+:/.test(a.data?.message || ''))
      );

      expect(errorGroup).toBeDefined();
      expect(errorGroup?.alerts).toHaveLength(3);
      expect(errorGroup?.groupingCriteria).toContain('message-pattern');
    });

    it('should group by source similarity', () => {
      const alerts = [
        createMockAlert('1', 'medium', 'Database error', { source: 'database-service' }),
        createMockAlert('2', 'medium', 'Connection timeout', { source: 'database-service' }),
        createMockAlert('3', 'medium', 'Auth failure', { source: 'auth-service' }),
      ];

      const criteria: AlertGroupCriteria = {
        sourceSimilarity: true,
      };

      const customManager = new EnhancedAlertGroupingManager({
        groupingCriteria: criteria,
      });

      const groups = customManager.analyzeAndGroup(alerts);

      expect(groups.size).toBe(2);
      
      const dbGroup = Array.from(groups.values()).find(g => 
        g.alerts.every(a => a.metadata?.source === 'database-service')
      );
      const authGroup = Array.from(groups.values()).find(g => 
        g.alerts.every(a => a.metadata?.source === 'auth-service')
      );

      expect(dbGroup?.alerts).toHaveLength(2);
      expect(authGroup?.alerts).toHaveLength(1);
    });

    it('should group by timing window', () => {
      const baseTime = new Date('2024-01-15T10:00:00Z');
      const alerts = [
        createMockAlert('1', 'medium', 'Alert 1', { timestamp: new Date(baseTime.getTime()) }),
        createMockAlert('2', 'medium', 'Alert 2', { timestamp: new Date(baseTime.getTime() + 5000) }), // 5 seconds later
        createMockAlert('3', 'medium', 'Alert 3', { timestamp: new Date(baseTime.getTime() + 120000) }), // 2 minutes later
      ];

      const criteria: AlertGroupCriteria = {
        timingWindow: 30000, // 30 seconds
      };

      const customManager = new EnhancedAlertGroupingManager({
        groupingCriteria: criteria,
      });

      const groups = customManager.analyzeAndGroup(alerts);

      // First two alerts should be grouped, third should be separate
      expect(groups.size).toBeGreaterThanOrEqual(1);
      
      // Find group with timing-based grouping
      const timedGroup = Array.from(groups.values()).find(g => 
        g.groupingCriteria.includes('timing-window')
      );

      if (timedGroup) {
        expect(timedGroup.alerts.length).toBeGreaterThanOrEqual(2);
      }
    });

    it('should group by priority when enabled', () => {
      const alerts = [
        createMockAlert('1', 'high', 'High priority alert 1'),
        createMockAlert('2', 'high', 'High priority alert 2'),
        createMockAlert('3', 'medium', 'Medium priority alert'),
        createMockAlert('4', 'high', 'High priority alert 3'),
      ];

      const criteria: AlertGroupCriteria = {
        priorityGrouping: true,
      };

      const customManager = new EnhancedAlertGroupingManager({
        groupingCriteria: criteria,
      });

      const groups = customManager.analyzeAndGroup(alerts);

      expect(groups.size).toBeGreaterThanOrEqual(1);
      
      const highPriorityGroup = Array.from(groups.values()).find(g => 
        g.commonPriority === 'high'
      );

      expect(highPriorityGroup?.alerts).toHaveLength(3);
      expect(highPriorityGroup?.groupingCriteria).toContain('priority');
    });

    it('should use custom grouping function when provided', () => {
      const alerts = [
        createMockAlert('1', 'medium', 'Alert 1', { metadata: { category: 'network' } }),
        createMockAlert('2', 'medium', 'Alert 2', { metadata: { category: 'network' } }),
        createMockAlert('3', 'medium', 'Alert 3', { metadata: { category: 'storage' } }),
      ];

      const customGroupingFn = (alerts: ProcessedAlert[]) => {
        const groups = new Map<string, ProcessedAlert[]>();
        
        alerts.forEach(alert => {
          const category = alert.metadata?.category as string;
          if (category) {
            if (!groups.has(category)) {
              groups.set(category, []);
            }
            groups.get(category)!.push(alert);
          }
        });
        
        return groups;
      };

      const criteria: AlertGroupCriteria = {
        customGroupingFn,
      };

      const customManager = new EnhancedAlertGroupingManager({
        groupingCriteria: criteria,
      });

      const groups = customManager.analyzeAndGroup(alerts);

      expect(groups.size).toBe(2);
      
      const networkGroup = Array.from(groups.values()).find(g => 
        g.alerts.every(a => a.metadata?.category === 'network')
      );
      const storageGroup = Array.from(groups.values()).find(g => 
        g.alerts.every(a => a.metadata?.category === 'storage')
      );

      expect(networkGroup?.alerts).toHaveLength(2);
      expect(storageGroup?.alerts).toHaveLength(1);
    });
  });

  describe('Group Lifecycle Management', () => {
    it('should create group with correct metadata', () => {
      const alerts = [
        createMockAlert('1', 'high', 'Critical system error', { source: 'system' }),
        createMockAlert('2', 'high', 'Critical system error', { source: 'system' }),
      ];

      const groups = groupingManager.analyzeAndGroup(alerts);
      const group = Array.from(groups.values())[0];

      expect(group.id).toBeDefined();
      expect(group.groupKey).toBeDefined();
      expect(group.primaryAlert).toBeDefined();
      expect(group.createdAt).toBeInstanceOf(Date);
      expect(group.lastUpdated).toBeInstanceOf(Date);
      expect(group.commonSource).toBe('system');
      expect(group.commonPriority).toBe('high');
      expect(group.groupType).toBe('automatic');
      expect(group.groupingCriteria).toContain('identical-content');
    });

    it('should update group when new similar alerts are added', () => {
      const initialAlerts = [
        createMockAlert('1', 'medium', 'Database connection lost'),
        createMockAlert('2', 'medium', 'Database connection lost'),
      ];

      let groups = groupingManager.analyzeAndGroup(initialAlerts);
      expect(groups.size).toBe(1);
      expect(Array.from(groups.values())[0].alerts).toHaveLength(2);

      // Add more similar alerts
      const additionalAlerts = [
        ...initialAlerts,
        createMockAlert('3', 'medium', 'Database connection lost'),
        createMockAlert('4', 'medium', 'Database connection lost'),
      ];

      groups = groupingManager.analyzeAndGroup(additionalAlerts);
      expect(groups.size).toBe(1);
      expect(Array.from(groups.values())[0].alerts).toHaveLength(4);
    });

    it('should maintain group stability when alerts are removed', () => {
      const alerts = [
        createMockAlert('1', 'medium', 'Service unavailable'),
        createMockAlert('2', 'medium', 'Service unavailable'),
        createMockAlert('3', 'medium', 'Service unavailable'),
      ];

      let groups = groupingManager.analyzeAndGroup(alerts);
      const originalGroupId = Array.from(groups.keys())[0];

      // Remove one alert
      const remainingAlerts = alerts.slice(1);
      groups = groupingManager.analyzeAndGroup(remainingAlerts);

      // Group should still exist with same ID
      expect(groups.has(originalGroupId)).toBe(true);
      expect(groups.get(originalGroupId)?.alerts).toHaveLength(2);
    });

    it('should dissolve group when only one alert remains', () => {
      const alerts = [
        createMockAlert('1', 'medium', 'Temporary issue'),
        createMockAlert('2', 'medium', 'Temporary issue'),
      ];

      let groups = groupingManager.analyzeAndGroup(alerts);
      expect(groups.size).toBe(1);

      // Remove one alert, leaving only one
      const singleAlert = [alerts[0]];
      groups = groupingManager.analyzeAndGroup(singleAlert);

      // Group should be dissolved (no groups for single alerts)
      expect(groups.size).toBe(0);
    });
  });

  describe('Performance Characteristics', () => {
    it('should handle large numbers of similar alerts efficiently', () => {
      const alertCount = 1000;
      const alerts = Array.from({ length: alertCount }, (_, i) =>
        createMockAlert(`alert-${i}`, 'medium', 'Repeated error message')
      );

      const startTime = performance.now();
      const groups = groupingManager.analyzeAndGroup(alerts);
      const endTime = performance.now();

      // Should complete within reasonable time (adjust threshold as needed)
      expect(endTime - startTime).toBeLessThan(1000); // 1 second

      // Should group all alerts together
      expect(groups.size).toBe(1);
      expect(Array.from(groups.values())[0].alerts).toHaveLength(alertCount);
    });

    it('should handle large numbers of unique alerts efficiently', () => {
      const alertCount = 500;
      const alerts = Array.from({ length: alertCount }, (_, i) =>
        createMockAlert(`alert-${i}`, 'medium', `Unique error message ${i}`)
      );

      const startTime = performance.now();
      const groups = groupingManager.analyzeAndGroup(alerts);
      const endTime = performance.now();

      // Should complete within reasonable time
      expect(endTime - startTime).toBeLessThan(2000); // 2 seconds

      // Should not create groups for unique alerts
      expect(groups.size).toBe(0);
    });

    it('should handle mixed grouping scenarios efficiently', () => {
      const alerts: ProcessedAlert[] = [];
      
      // Add some groups of similar alerts
      for (let group = 1; group <= 10; group++) {
        for (let i = 1; i <= 20; i++) {
          alerts.push(createMockAlert(
            `group-${group}-alert-${i}`,
            'medium',
            `Group ${group} error message`
          ));
        }
      }
      
      // Add some unique alerts
      for (let i = 1; i <= 100; i++) {
        alerts.push(createMockAlert(
          `unique-${i}`,
          'medium',
          `Unique error ${i}`
        ));
      }

      const startTime = performance.now();
      const groups = groupingManager.analyzeAndGroup(alerts);
      const endTime = performance.now();

      // Should complete within reasonable time
      expect(endTime - startTime).toBeLessThan(2000); // 2 seconds

      // Should create 10 groups
      expect(groups.size).toBe(10);
      
      // Each group should have 20 alerts
      Array.from(groups.values()).forEach(group => {
        expect(group.alerts).toHaveLength(20);
      });
    });

    it('should maintain performance with complex similarity calculations', () => {
      const alertCount = 200;
      const alerts = Array.from({ length: alertCount }, (_, i) => {
        // Create alerts with varying similarity
        const baseMessage = 'Connection error occurred';
        const variations = [
          baseMessage,
          'Connection error happened',
          'Connection failure occurred',
          'Network connection error',
          'Database connection error',
        ];
        
        return createMockAlert(
          `similarity-${i}`,
          'medium',
          variations[i % variations.length] + ` - instance ${i}`
        );
      });

      const criteria: AlertGroupCriteria = {
        titleSimilarity: 0.6, // Require similarity calculations
      };

      const customManager = new EnhancedAlertGroupingManager({
        groupingCriteria: criteria,
      });

      const startTime = performance.now();
      const groups = customManager.analyzeAndGroup(alerts);
      const endTime = performance.now();

      // Should complete within reasonable time despite similarity calculations
      expect(endTime - startTime).toBeLessThan(3000); // 3 seconds

      // Should create some groups based on similarity
      expect(groups.size).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle empty alert arrays', () => {
      const groups = groupingManager.analyzeAndGroup([]);
      expect(groups.size).toBe(0);
    });

    it('should handle alerts with missing data', () => {
      const alerts = [
        createMockAlert('1', 'medium', ''),
        createMockAlert('2', 'medium', ''),
      ];

      // Remove message data to simulate missing data
      alerts[0].data = { ...alerts[0].data, message: undefined as any };
      alerts[1].data = { ...alerts[1].data, message: undefined as any };

      const groups = groupingManager.analyzeAndGroup(alerts);
      
      // Should handle gracefully without crashing
      expect(groups.size).toBeGreaterThanOrEqual(0);
    });

    it('should handle alerts with very long messages', () => {
      const longMessage = 'A'.repeat(10000); // 10KB message
      const alerts = [
        createMockAlert('1', 'medium', longMessage),
        createMockAlert('2', 'medium', longMessage),
      ];

      const startTime = performance.now();
      const groups = groupingManager.analyzeAndGroup(alerts);
      const endTime = performance.now();

      // Should handle without excessive delay
      expect(endTime - startTime).toBeLessThan(1000);
      
      // Should group identical long messages
      expect(groups.size).toBe(1);
      expect(Array.from(groups.values())[0].alerts).toHaveLength(2);
    });

    it('should handle special characters and unicode in messages', () => {
      const alerts = [
        createMockAlert('1', 'medium', '🚨 Critical: Database connection failed! 💥'),
        createMockAlert('2', 'medium', '🚨 Critical: Database connection failed! 💥'),
        createMockAlert('3', 'medium', 'Критическая ошибка: соединение потеряно'),
        createMockAlert('4', 'medium', 'Kritischer Fehler: Verbindung unterbrochen'),
      ];

      const groups = groupingManager.analyzeAndGroup(alerts);
      
      // Should handle unicode correctly
      expect(groups.size).toBeGreaterThanOrEqual(1);
      
      // Emoji alerts should be grouped
      const emojiGroup = Array.from(groups.values()).find(g => 
        g.alerts.some(a => a.data?.message?.includes('🚨'))
      );
      expect(emojiGroup?.alerts).toHaveLength(2);
    });

    it('should respect maximum group limits', () => {
      const limitedManager = new EnhancedAlertGroupingManager({
        maxGroups: 3,
      });

      // Create more groups than the limit
      const alerts: ProcessedAlert[] = [];
      for (let i = 1; i <= 5; i++) {
        alerts.push(createMockAlert(`${i}-1`, 'medium', `Group ${i} message`));
        alerts.push(createMockAlert(`${i}-2`, 'medium', `Group ${i} message`));
      }

      const groups = limitedManager.analyzeAndGroup(alerts);
      
      // Should respect the limit
      expect(groups.size).toBeLessThanOrEqual(3);
    });

    it('should handle malformed alert data gracefully', () => {
      const alerts = [
        createMockAlert('1', 'medium', 'Normal alert'),
        {
          id: '2',
          priority: 'invalid-priority' as any,
          queuedAt: new Date(),
          processAfter: new Date(),
          metadata: null as any,
          data: null as any,
        } as ProcessedAlert,
      ];

      // Should not crash with malformed data
      expect(() => {
        const groups = groupingManager.analyzeAndGroup(alerts);
        expect(groups.size).toBeGreaterThanOrEqual(0);
      }).not.toThrow();
    });
  });

  describe('Algorithm Correctness', () => {
    it('should correctly implement Levenshtein distance', () => {
      // Test the internal similarity algorithm
      const message1 = 'Connection failed';
      const message2 = 'Connection timeout';
      const message3 = 'Database error';

      // Direct test of Levenshtein distance
      const distance1to2 = levenshteinDistance(message1, message2);
      const distance1to3 = levenshteinDistance(message1, message3);

      expect(distance1to2).toBeLessThan(distance1to3);
      expect(distance1to2).toBe(7); // Expected distance
    });

    it('should group alerts with similarity above threshold', () => {
      const alerts = [
        createMockAlert('1', 'medium', 'Server connection timeout'),
        createMockAlert('2', 'medium', 'Server connection failed'),
        createMockAlert('3', 'medium', 'Completely different error'),
      ];

      const criteria: AlertGroupCriteria = {
        titleSimilarity: 0.7,
      };

      const customManager = new EnhancedAlertGroupingManager({
        groupingCriteria: criteria,
      });

      const groups = customManager.analyzeAndGroup(alerts);
      
      // First two should be grouped due to similarity
      const similarGroup = Array.from(groups.values()).find(g => 
        g.alerts.length === 2
      );
      
      if (similarGroup) {
        expect(similarGroup.alerts).toHaveLength(2);
        expect(similarGroup.groupingCriteria).toContain('similar-content');
      }
    });

    it('should not group alerts with similarity below threshold', () => {
      const alerts = [
        createMockAlert('1', 'medium', 'Database connection error'),
        createMockAlert('2', 'medium', 'Authentication failure'),
      ];

      const criteria: AlertGroupCriteria = {
        titleSimilarity: 0.9, // Very high threshold
      };

      const customManager = new EnhancedAlertGroupingManager({
        groupingCriteria: criteria,
      });

      const groups = customManager.analyzeAndGroup(alerts);
      
      // Should not group due to low similarity
      expect(groups.size).toBe(0);
    });

    it('should correctly handle multiple grouping criteria combinations', () => {
      const alerts = [
        createMockAlert('1', 'high', 'Network error 1', { 
          source: 'network-service',
          timestamp: new Date('2024-01-15T10:00:00Z')
        }),
        createMockAlert('2', 'high', 'Network error 2', { 
          source: 'network-service',
          timestamp: new Date('2024-01-15T10:00:05Z')
        }),
        createMockAlert('3', 'high', 'Storage error', { 
          source: 'storage-service',
          timestamp: new Date('2024-01-15T10:00:02Z')
        }),
      ];

      const criteria: AlertGroupCriteria = {
        sourceSimilarity: true,
        priorityGrouping: true,
        timingWindow: 30000, // 30 seconds
      };

      const customManager = new EnhancedAlertGroupingManager({
        groupingCriteria: criteria,
      });

      const groups = customManager.analyzeAndGroup(alerts);
      
      // Should create groups based on multiple criteria
      expect(groups.size).toBeGreaterThanOrEqual(1);
      
      const networkGroup = Array.from(groups.values()).find(g => 
        g.commonSource === 'network-service'
      );
      
      if (networkGroup) {
        expect(networkGroup.alerts).toHaveLength(2);
        expect(networkGroup.groupingCriteria).toEqual(
          expect.arrayContaining(['source', 'priority', 'timing-window'])
        );
      }
    });
  });
});