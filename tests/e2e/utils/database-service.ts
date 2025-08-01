import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';

const execAsync = promisify(exec);

/**
 * Database Service for E2E Tests
 * 
 * Manages test database lifecycle including initialization, seeding, and cleanup.
 * Provides isolated test environments and consistent test data.
 */
export class DatabaseService {
  private readonly testDbPath = 'shared/data/test_rover_platform.db';
  private readonly backupDbPath = 'shared/data/rover_platform.db.backup';

  /**
   * Initialize test database
   */
  async initialize(): Promise<void> {
    console.log('📊 Initializing test database...');

    try {
      // Backup existing database if it exists
      await this.backupExistingDatabase();

      // Remove existing test database
      await this.removeTestDatabase();

      // Initialize new test database
      await this.createTestDatabase();

      console.log('✅ Test database initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize test database:', error);
      throw error;
    }
  }

  /**
   * Seed test database with sample data
   */
  async seedTestData(): Promise<void> {
    console.log('🌱 Seeding test database with sample data...');

    try {
      const seedData = this.generateSeedData();
      await this.insertSeedData(seedData);
      
      console.log('✅ Test database seeded successfully');
    } catch (error) {
      console.error('❌ Failed to seed test database:', error);
      throw error;
    }
  }

  /**
   * Clean up test database and restore backup
   */
  async cleanup(): Promise<void> {
    console.log('🧹 Cleaning up test database...');

    try {
      // Remove test database
      await this.removeTestDatabase();

      // Restore original database if backup exists
      await this.restoreBackupDatabase();

      console.log('✅ Test database cleanup completed');
    } catch (error) {
      console.error('❌ Failed to cleanup test database:', error);
      // Don't throw to avoid masking test failures
    }
  }

  /**
   * Reset test database to initial state
   */
  async reset(): Promise<void> {
    console.log('🔄 Resetting test database...');
    
    await this.removeTestDatabase();
    await this.createTestDatabase();
    await this.seedTestData();
  }

  /**
   * Backup existing database
   */
  private async backupExistingDatabase(): Promise<void> {
    const originalDbPath = 'shared/data/rover_platform.db';
    
    try {
      await fs.access(originalDbPath);
      await fs.copyFile(originalDbPath, this.backupDbPath);
      console.log('📁 Existing database backed up');
    } catch (error) {
      // Original database doesn't exist, which is fine
      console.log('ℹ️  No existing database to backup');
    }
  }

  /**
   * Remove test database if it exists
   */
  private async removeTestDatabase(): Promise<void> {
    try {
      await fs.unlink(this.testDbPath);
      console.log('🗑️  Existing test database removed');
    } catch (error) {
      // Test database doesn't exist, which is fine
      console.log('ℹ️  No existing test database to remove');
    }
  }

  /**
   * Create new test database
   */
  private async createTestDatabase(): Promise<void> {
    try {
      // Ensure directory exists
      await fs.mkdir(path.dirname(this.testDbPath), { recursive: true });

      // Execute database initialization script
      const { stdout, stderr } = await execAsync(
        'python -c "from backend.database import init_db; init_db()"',
        {
          env: {
            ...process.env,
            DATABASE_URL: `sqlite:///${this.testDbPath}`,
            ENVIRONMENT: 'test'
          },
          cwd: process.cwd()
        }
      );

      if (stderr && !stderr.includes('INFO')) {
        console.warn('Database creation warnings:', stderr);
      }

      console.log('✅ Test database created');
    } catch (error) {
      console.error('Database creation error:', error);
      throw error;
    }
  }

  /**
   * Restore backup database
   */
  private async restoreBackupDatabase(): Promise<void> {
    try {
      await fs.access(this.backupDbPath);
      await fs.copyFile(this.backupDbPath, 'shared/data/rover_platform.db');
      await fs.unlink(this.backupDbPath);
      console.log('🔄 Original database restored');
    } catch (error) {
      // No backup to restore, which is fine
      console.log('ℹ️  No backup database to restore');
    }
  }

  /**
   * Generate seed data for testing
   */
  private generateSeedData(): any {
    return {
      users: [
        {
          username: 'admin',
          password_hash: '$2b$12$hash_for_Admin@123',
          role: 'admin',
          email: 'admin@rover.mission',
          is_active: true,
          created_at: new Date().toISOString()
        },
        {
          username: 'operator',
          password_hash: '$2b$12$hash_for_Operator@123',
          role: 'operator',
          email: 'operator@rover.mission',
          is_active: true,
          created_at: new Date().toISOString()
        },
        {
          username: 'viewer',
          password_hash: '$2b$12$hash_for_Viewer@123',
          role: 'viewer',
          email: 'viewer@rover.mission',
          is_active: true,
          created_at: new Date().toISOString()
        }
      ],
      devices: [
        {
          device_id: 'arduino_rover_01',
          device_type: 'rover',
          name: 'Main Rover Controller',
          description: 'Primary rover navigation and control system',
          connection_type: 'serial',
          connection_params: { port: 'COM3', baudrate: 115200 },
          is_active: true,
          last_seen: new Date().toISOString(),
          firmware_version: '1.2.3',
          hardware_version: '2.0.0'
        },
        {
          device_id: 'esp32_sensor_01',
          device_type: 'sensor',
          name: 'Environmental Sensor Array',
          description: 'Temperature, humidity, and atmospheric sensors',
          connection_type: 'wifi',
          connection_params: { ip: '192.168.1.100', port: 80 },
          is_active: true,
          last_seen: new Date().toISOString(),
          firmware_version: '2.1.0',
          hardware_version: '1.5.0'
        },
        {
          device_id: 'camera_module_01',
          device_type: 'camera',
          name: 'Navigation Camera',
          description: 'Front-facing navigation and obstacle detection camera',
          connection_type: 'usb',
          connection_params: { device_path: '/dev/video0' },
          is_active: false,
          last_seen: new Date(Date.now() - 300000).toISOString(),
          firmware_version: '1.0.5',
          hardware_version: '1.0.0'
        }
      ],
      telemetry: this.generateTelemetryData(),
      commands: [
        {
          command_id: 'cmd_001',
          device_id: 'arduino_rover_01',
          command_type: 'move',
          parameters: { direction: 'forward', speed: 50, duration: 5000 },
          status: 'completed',
          created_at: new Date(Date.now() - 600000).toISOString(),
          executed_at: new Date(Date.now() - 595000).toISOString(),
          completed_at: new Date(Date.now() - 590000).toISOString()
        },
        {
          command_id: 'cmd_002',
          device_id: 'esp32_sensor_01',
          command_type: 'calibrate',
          parameters: { sensor_type: 'temperature' },
          status: 'pending',
          created_at: new Date().toISOString()
        }
      ]
    };
  }

  /**
   * Generate sample telemetry data
   */
  private generateTelemetryData(): any[] {
    const telemetryData = [];
    const now = Date.now();
    
    // Generate 100 data points over the last hour
    for (let i = 0; i < 100; i++) {
      const timestamp = new Date(now - (i * 36000)); // 36 seconds apart
      
      telemetryData.push({
        device_id: 'arduino_rover_01',
        metric_name: 'battery_voltage',
        value: 12.0 + Math.random() * 2 - 1, // 11-13V range
        unit: 'V',
        timestamp: timestamp.toISOString()
      });
      
      telemetryData.push({
        device_id: 'arduino_rover_01',
        metric_name: 'motor_current',
        value: 1.5 + Math.random() * 0.5, // 1.5-2.0A range
        unit: 'A',
        timestamp: timestamp.toISOString()
      });
      
      telemetryData.push({
        device_id: 'esp32_sensor_01',
        metric_name: 'temperature',
        value: 25 + Math.random() * 10 - 5, // 20-30°C range
        unit: '°C',
        timestamp: timestamp.toISOString()
      });
      
      telemetryData.push({
        device_id: 'esp32_sensor_01',
        metric_name: 'humidity',
        value: 50 + Math.random() * 20 - 10, // 40-60% range
        unit: '%',
        timestamp: timestamp.toISOString()
      });
    }
    
    return telemetryData;
  }

  /**
   * Insert seed data into database
   */
  private async insertSeedData(seedData: any): Promise<void> {
    // Create a Python script to insert the seed data
    const seedScript = `
import sqlite3
import json
import sys
from datetime import datetime

# Connect to test database
conn = sqlite3.connect('${this.testDbPath}')
cursor = conn.cursor()

# Seed data
seed_data = ${JSON.stringify(seedData, null, 2)}

try:
    # Insert users
    for user in seed_data['users']:
        cursor.execute('''
            INSERT OR REPLACE INTO users 
            (username, password_hash, role, email, is_active, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (
            user['username'], user['password_hash'], user['role'],
            user['email'], user['is_active'], user['created_at']
        ))
    
    # Insert devices
    for device in seed_data['devices']:
        cursor.execute('''
            INSERT OR REPLACE INTO devices 
            (device_id, device_type, name, description, connection_type, 
             connection_params, is_active, last_seen, firmware_version, hardware_version)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            device['device_id'], device['device_type'], device['name'],
            device['description'], device['connection_type'], 
            json.dumps(device['connection_params']), device['is_active'],
            device['last_seen'], device['firmware_version'], device['hardware_version']
        ))
    
    # Insert telemetry data
    for telemetry in seed_data['telemetry']:
        cursor.execute('''
            INSERT OR REPLACE INTO telemetry 
            (device_id, metric_name, value, unit, timestamp)
            VALUES (?, ?, ?, ?, ?)
        ''', (
            telemetry['device_id'], telemetry['metric_name'],
            telemetry['value'], telemetry['unit'], telemetry['timestamp']
        ))
    
    # Insert commands
    for command in seed_data['commands']:
        cursor.execute('''
            INSERT OR REPLACE INTO commands 
            (command_id, device_id, command_type, parameters, status, 
             created_at, executed_at, completed_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            command['command_id'], command['device_id'], command['command_type'],
            json.dumps(command['parameters']), command['status'],
            command['created_at'], command.get('executed_at'), command.get('completed_at')
        ))
    
    conn.commit()
    print("Seed data inserted successfully")
    
except Exception as e:
    print(f"Error inserting seed data: {e}")
    conn.rollback()
    sys.exit(1)
    
finally:
    conn.close()
`;

    // Write and execute the seed script
    const scriptPath = 'temp_seed_script.py';
    await fs.writeFile(scriptPath, seedScript);
    
    try {
      const { stdout, stderr } = await execAsync(`python ${scriptPath}`);
      
      if (stderr && !stderr.includes('INFO')) {
        console.warn('Seed script warnings:', stderr);
      }
      
      console.log('📊 Seed data inserted:', stdout);
    } finally {
      // Clean up temporary script
      await fs.unlink(scriptPath).catch(() => {});
    }
  }
}