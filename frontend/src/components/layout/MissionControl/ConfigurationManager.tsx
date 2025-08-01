/**
 * ConfigurationManager Component
 * 
 * Enterprise-grade configuration management system for rover simulations.
 * Handles saving, loading, versioning, and sharing of configuration presets.
 * 
 * @author Mission Control Team
 * @version 1.0.0
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, Button, Input } from '../../ui/core';
import { Select } from '../../ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../ui/dialog';
import { 
  Save, Upload, Download, Share2, Copy, Trash2, Plus, 
  Settings, History, Lock, Unlock, Star, StarOff 
} from 'lucide-react';
import { toast } from '../../ui/toast';

// ========== Types ==========

export interface ConfigurationPreset {
  id: string;
  name: string;
  description: string;
  category: 'physics' | 'model' | 'camera' | 'kinematics' | 'wheel' | 'complete';
  version: string;
  createdAt: Date;
  updatedAt: Date;
  author: string;
  tags: string[];
  locked: boolean;
  favorite: boolean;
  data: {
    physics?: any;
    model?: any;
    camera?: any;
    kinematics?: any;
    wheel?: any;
    [key: string]: any;
  };
  permissions: {
    read: string[];
    write: string[];
    delete: string[];
  };
}

export interface ConfigurationHistory {
  id: string;
  presetId: string;
  action: 'created' | 'updated' | 'loaded' | 'exported' | 'imported';
  timestamp: Date;
  user: string;
  changes?: string;
}

export interface ConfigurationManagerProps {
  currentConfig: any;
  onConfigLoad: (config: any) => void;
  onConfigSave?: (preset: ConfigurationPreset) => void;
  userRole?: 'admin' | 'operator' | 'viewer';
  className?: string;
}

// ========== Storage Service ==========

class ConfigurationStorage {
  private readonly STORAGE_KEY = 'rover_configuration_presets';
  private readonly HISTORY_KEY = 'rover_configuration_history';
  private readonly MAX_HISTORY = 100;

  // Get all presets
  getPresets(): ConfigurationPreset[] {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    if (!stored) return this.getDefaultPresets();
    
    try {
      const presets = JSON.parse(stored);
      return presets.map((p: any) => ({
        ...p,
        createdAt: new Date(p.createdAt),
        updatedAt: new Date(p.updatedAt)
      }));
    } catch (error) {
      console.error('Failed to load presets:', error);
      return this.getDefaultPresets();
    }
  }

  // Save preset
  savePreset(preset: ConfigurationPreset): void {
    const presets = this.getPresets();
    const existingIndex = presets.findIndex(p => p.id === preset.id);
    
    if (existingIndex >= 0) {
      presets[existingIndex] = preset;
    } else {
      presets.push(preset);
    }
    
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(presets));
    this.addHistory({
      id: `history_${Date.now()}`,
      presetId: preset.id,
      action: existingIndex >= 0 ? 'updated' : 'created',
      timestamp: new Date(),
      user: 'current_user'
    });
  }

  // Delete preset
  deletePreset(id: string): void {
    const presets = this.getPresets().filter(p => p.id !== id);
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(presets));
  }

  // Get history
  getHistory(): ConfigurationHistory[] {
    const stored = localStorage.getItem(this.HISTORY_KEY);
    if (!stored) return [];
    
    try {
      const history = JSON.parse(stored);
      return history.map((h: any) => ({
        ...h,
        timestamp: new Date(h.timestamp)
      })).slice(-this.MAX_HISTORY);
    } catch (error) {
      console.error('Failed to load history:', error);
      return [];
    }
  }

  // Add history entry
  private addHistory(entry: ConfigurationHistory): void {
    const history = this.getHistory();
    history.push(entry);
    
    // Keep only recent history
    const trimmed = history.slice(-this.MAX_HISTORY);
    localStorage.setItem(this.HISTORY_KEY, JSON.stringify(trimmed));
  }

  // Get default presets
  private getDefaultPresets(): ConfigurationPreset[] {
    return [
      {
        id: 'default_perseverance',
        name: 'Perseverance Default',
        description: 'NASA Perseverance rover configuration',
        category: 'complete',
        version: '1.0.0',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        author: 'System',
        tags: ['mars', 'nasa', 'perseverance'],
        locked: true,
        favorite: true,
        data: {
          physics: { gravity: 3.72, damping: 0.98 },
          model: { scale: 1, lod: 'auto' },
          camera: { mode: 'orbit', fov: 60 },
          kinematics: { speed: 0.5 },
          wheel: { friction: 0.8, suspension: 0.3 }
        },
        permissions: {
          read: ['*'],
          write: ['admin'],
          delete: ['admin']
        }
      },
      {
        id: 'default_testing',
        name: 'Testing Configuration',
        description: 'High-speed testing configuration',
        category: 'complete',
        version: '1.0.0',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        author: 'System',
        tags: ['testing', 'development'],
        locked: false,
        favorite: false,
        data: {
          physics: { gravity: 9.81, damping: 0.95 },
          model: { scale: 1, lod: 'high' },
          camera: { mode: 'chase', fov: 75 },
          kinematics: { speed: 1.5 },
          wheel: { friction: 1.0, suspension: 0.5 }
        },
        permissions: {
          read: ['*'],
          write: ['*'],
          delete: ['admin', 'operator']
        }
      }
    ];
  }

  // Export preset
  exportPreset(preset: ConfigurationPreset): void {
    const data = JSON.stringify(preset, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `rover_config_${preset.name.replace(/\s+/g, '_').toLowerCase()}_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    this.addHistory({
      id: `history_${Date.now()}`,
      presetId: preset.id,
      action: 'exported',
      timestamp: new Date(),
      user: 'current_user'
    });
  }

  // Import preset
  async importPreset(file: File): Promise<ConfigurationPreset> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const preset = JSON.parse(e.target?.result as string);
          preset.id = `imported_${Date.now()}`;
          preset.createdAt = new Date(preset.createdAt);
          preset.updatedAt = new Date();
          preset.locked = false;
          
          this.savePreset(preset);
          
          this.addHistory({
            id: `history_${Date.now()}`,
            presetId: preset.id,
            action: 'imported',
            timestamp: new Date(),
            user: 'current_user'
          });
          
          resolve(preset);
        } catch (error) {
          reject(error);
        }
      };
      
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  }
}

// ========== Component ==========

export const ConfigurationManager: React.FC<ConfigurationManagerProps> = ({
  currentConfig,
  onConfigLoad,
  onConfigSave,
  userRole = 'operator',
  className = ''
}) => {
  const storage = useMemo(() => new ConfigurationStorage(), []);
  const [presets, setPresets] = useState<ConfigurationPreset[]>([]);
  const [history, setHistory] = useState<ConfigurationHistory[]>([]);
  const [selectedPreset, setSelectedPreset] = useState<ConfigurationPreset | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [activeTab, setActiveTab] = useState('presets');
  
  // New preset form
  const [newPresetName, setNewPresetName] = useState('');
  const [newPresetDescription, setNewPresetDescription] = useState('');
  const [newPresetCategory, setNewPresetCategory] = useState<ConfigurationPreset['category']>('complete');
  const [newPresetTags, setNewPresetTags] = useState('');

  // Load presets and history
  useEffect(() => {
    setPresets(storage.getPresets());
    setHistory(storage.getHistory());
  }, [storage]);

  // Filter presets
  const filteredPresets = useMemo(() => {
    return presets.filter(preset => {
      const matchesSearch = searchTerm === '' || 
        preset.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        preset.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        preset.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesCategory = filterCategory === 'all' || preset.category === filterCategory;
      
      return matchesSearch && matchesCategory;
    });
  }, [presets, searchTerm, filterCategory]);

  // Check permissions
  const canWrite = useCallback((preset: ConfigurationPreset) => {
    if (userRole === 'viewer') return false;
    if (userRole === 'admin') return true;
    return preset.permissions.write.includes('*') || preset.permissions.write.includes(userRole);
  }, [userRole]);

  const canDelete = useCallback((preset: ConfigurationPreset) => {
    if (userRole === 'viewer') return false;
    if (userRole === 'admin') return true;
    return preset.permissions.delete.includes('*') || preset.permissions.delete.includes(userRole);
  }, [userRole]);

  // Load preset
  const handleLoadPreset = useCallback((preset: ConfigurationPreset) => {
    onConfigLoad(preset.data);
    setSelectedPreset(preset);
    
    storage.addHistory({
      id: `history_${Date.now()}`,
      presetId: preset.id,
      action: 'loaded',
      timestamp: new Date(),
      user: 'current_user'
    });
    
    toast.success(`Loaded configuration: ${preset.name}`);
  }, [onConfigLoad, storage]);

  // Save current config
  const handleSaveConfig = useCallback(() => {
    if (!newPresetName) {
      toast.error('Please enter a preset name');
      return;
    }

    const preset: ConfigurationPreset = {
      id: `preset_${Date.now()}`,
      name: newPresetName,
      description: newPresetDescription,
      category: newPresetCategory,
      version: '1.0.0',
      createdAt: new Date(),
      updatedAt: new Date(),
      author: 'current_user',
      tags: newPresetTags.split(',').map(t => t.trim()).filter(t => t),
      locked: false,
      favorite: false,
      data: currentConfig,
      permissions: {
        read: ['*'],
        write: [userRole],
        delete: [userRole]
      }
    };

    storage.savePreset(preset);
    setPresets(storage.getPresets());
    
    if (onConfigSave) {
      onConfigSave(preset);
    }
    
    setShowSaveDialog(false);
    setNewPresetName('');
    setNewPresetDescription('');
    setNewPresetTags('');
    
    toast.success(`Saved configuration: ${preset.name}`);
  }, [currentConfig, newPresetName, newPresetDescription, newPresetCategory, newPresetTags, userRole, storage, onConfigSave]);

  // Delete preset
  const handleDeletePreset = useCallback((preset: ConfigurationPreset) => {
    if (!canDelete(preset)) {
      toast.error('You do not have permission to delete this preset');
      return;
    }

    if (preset.locked) {
      toast.error('Cannot delete locked preset');
      return;
    }

    if (window.confirm(`Delete preset "${preset.name}"?`)) {
      storage.deletePreset(preset.id);
      setPresets(storage.getPresets());
      toast.success(`Deleted preset: ${preset.name}`);
    }
  }, [canDelete, storage]);

  // Toggle favorite
  const handleToggleFavorite = useCallback((preset: ConfigurationPreset) => {
    preset.favorite = !preset.favorite;
    storage.savePreset(preset);
    setPresets(storage.getPresets());
  }, [storage]);

  // Import preset
  const handleImport = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const imported = await storage.importPreset(file);
      setPresets(storage.getPresets());
      toast.success(`Imported configuration: ${imported.name}`);
    } catch (error) {
      toast.error('Failed to import configuration');
      console.error(error);
    }
  }, [storage]);

  // Share preset
  const handleSharePreset = useCallback((preset: ConfigurationPreset) => {
    const shareData = {
      id: preset.id,
      name: preset.name,
      data: preset.data
    };
    
    const shareUrl = `${window.location.origin}/shared-config/${btoa(JSON.stringify(shareData))}`;
    
    navigator.clipboard.writeText(shareUrl);
    toast.success('Share link copied to clipboard');
  }, []);

  // Render preset card
  const renderPresetCard = (preset: ConfigurationPreset) => (
    <Card 
      key={preset.id} 
      className={`p-4 cursor-pointer hover:shadow-lg transition-shadow ${
        selectedPreset?.id === preset.id ? 'ring-2 ring-primary' : ''
      }`}
      onClick={() => setSelectedPreset(preset)}
    >
      <div className="flex justify-between items-start mb-2">
        <div className="flex-1">
          <h4 className="font-semibold flex items-center gap-2">
            {preset.name}
            {preset.locked && <Lock className="w-4 h-4 text-muted-foreground" />}
            {preset.favorite && <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />}
          </h4>
          <p className="text-sm text-muted-foreground">{preset.description}</p>
        </div>
        <span className="text-xs text-muted-foreground">
          v{preset.version}
        </span>
      </div>
      
      <div className="flex flex-wrap gap-1 mb-3">
        {preset.tags.map(tag => (
          <span key={tag} className="text-xs bg-muted px-2 py-1 rounded">
            {tag}
          </span>
        ))}
      </div>
      
      <div className="flex justify-between items-center">
        <span className="text-xs text-muted-foreground">
          {preset.author} · {preset.updatedAt.toLocaleDateString()}
        </span>
        
        <div className="flex gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              handleLoadPreset(preset);
            }}
          >
            <Upload className="w-4 h-4" />
          </Button>
          
          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              handleToggleFavorite(preset);
            }}
          >
            {preset.favorite ? 
              <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" /> : 
              <StarOff className="w-4 h-4" />
            }
          </Button>
          
          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              storage.exportPreset(preset);
            }}
          >
            <Download className="w-4 h-4" />
          </Button>
          
          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              handleSharePreset(preset);
            }}
          >
            <Share2 className="w-4 h-4" />
          </Button>
          
          {canDelete(preset) && !preset.locked && (
            <Button
              size="sm"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                handleDeletePreset(preset);
              }}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
    </Card>
  );

  // Render history item
  const renderHistoryItem = (item: ConfigurationHistory) => {
    const preset = presets.find(p => p.id === item.presetId);
    return (
      <div key={item.id} className="flex items-center justify-between py-2 border-b">
        <div>
          <span className="font-medium">{preset?.name || 'Unknown Preset'}</span>
          <span className="text-sm text-muted-foreground ml-2">
            {item.action}
          </span>
        </div>
        <span className="text-xs text-muted-foreground">
          {item.timestamp.toLocaleString()}
        </span>
      </div>
    );
  };

  return (
    <Card className={`configuration-manager ${className}`}>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Configuration Manager
          </h3>
          
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => setShowSaveDialog(true)}
              disabled={userRole === 'viewer'}
            >
              <Save className="w-4 h-4 mr-2" />
              Save Current
            </Button>
            
            <label htmlFor="import-config">
              <Button size="sm" variant="outline" as="span">
                <Upload className="w-4 h-4 mr-2" />
                Import
              </Button>
              <input
                id="import-config"
                type="file"
                accept=".json"
                className="hidden"
                onChange={handleImport}
              />
            </label>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="presets">Presets</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>
          
          <TabsContent value="presets" className="space-y-4">
            {/* Search and filters */}
            <div className="flex gap-2">
              <Input
                placeholder="Search presets..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1"
              />
              <Select
                value={filterCategory}
                onValueChange={setFilterCategory}
              >
                <option value="all">All Categories</option>
                <option value="physics">Physics</option>
                <option value="model">Model</option>
                <option value="camera">Camera</option>
                <option value="kinematics">Kinematics</option>
                <option value="wheel">Wheel</option>
                <option value="complete">Complete</option>
              </Select>
            </div>
            
            {/* Preset grid */}
            <div className="grid gap-4 md:grid-cols-2">
              {filteredPresets.map(renderPresetCard)}
            </div>
            
            {filteredPresets.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No presets found
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="history" className="space-y-2">
            <div className="max-h-96 overflow-y-auto">
              {history.map(renderHistoryItem)}
            </div>
            
            {history.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No history available
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Save Dialog */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Configuration</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Name</label>
              <Input
                value={newPresetName}
                onChange={(e) => setNewPresetName(e.target.value)}
                placeholder="My Configuration"
              />
            </div>
            
            <div>
              <label className="text-sm font-medium">Description</label>
              <Input
                value={newPresetDescription}
                onChange={(e) => setNewPresetDescription(e.target.value)}
                placeholder="Description of this configuration..."
              />
            </div>
            
            <div>
              <label className="text-sm font-medium">Category</label>
              <Select
                value={newPresetCategory}
                onValueChange={(value) => setNewPresetCategory(value as ConfigurationPreset['category'])}
              >
                <option value="complete">Complete Configuration</option>
                <option value="physics">Physics Only</option>
                <option value="model">Model Only</option>
                <option value="camera">Camera Only</option>
                <option value="kinematics">Kinematics Only</option>
                <option value="wheel">Wheel Physics Only</option>
              </Select>
            </div>
            
            <div>
              <label className="text-sm font-medium">Tags (comma-separated)</label>
              <Input
                value={newPresetTags}
                onChange={(e) => setNewPresetTags(e.target.value)}
                placeholder="mars, testing, custom"
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSaveDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveConfig}>
              Save Configuration
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default ConfigurationManager;