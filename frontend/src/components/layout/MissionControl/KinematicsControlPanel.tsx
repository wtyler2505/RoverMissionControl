/**
 * KinematicsControlPanel Component
 * 
 * UI panel for controlling rover articulation and kinematics.
 * Provides joint control, IK targets, and animation playback.
 * 
 * @author Mission Control Team
 * @version 1.0.0
 */

import React, { useState, useCallback, useMemo } from 'react';
import { Card, Button, Select } from '../../ui/core';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../../ui/accordion';
import { Slider } from '../../ui/slider';
import { Play, Pause, RotateCcw, Target } from 'lucide-react';
import * as THREE from 'three';
import type { Joint, IKTarget, AnimationClip } from './KinematicsSystem';
import { ROVER_ANIMATIONS } from './KinematicsSystem';

// ========== Types ==========

export interface KinematicsControlPanelProps {
  joints: Joint[];
  onJointChange: (jointId: string, angle?: number, distance?: number) => void;
  onIKTargetSet: (target: IKTarget) => void;
  onAnimationPlay: (clipId: string) => void;
  onAnimationStop: () => void;
  currentAnimation?: string | null;
  animationTime?: number;
  className?: string;
  debug?: boolean;
  onDebugToggle?: (enabled: boolean) => void;
}

interface JointGroup {
  name: string;
  joints: Joint[];
}

// ========== Component ==========

export const KinematicsControlPanel: React.FC<KinematicsControlPanelProps> = ({
  joints,
  onJointChange,
  onIKTargetSet,
  onAnimationPlay,
  onAnimationStop,
  currentAnimation,
  animationTime,
  className = '',
  debug = false,
  onDebugToggle
}) => {
  const [selectedChain, setSelectedChain] = useState<string>('robotic_arm');
  const [ikPosition, setIkPosition] = useState({ x: 1, y: 1, z: 0 });
  const [activePanel, setActivePanel] = useState<string>('joints');

  // Group joints by system
  const jointGroups = useMemo(() => {
    const groups: JointGroup[] = [
      {
        name: 'Robotic Arm',
        joints: joints.filter(j => j.id.startsWith('arm_'))
      },
      {
        name: 'Mast Camera',
        joints: joints.filter(j => j.id.startsWith('mast_'))
      },
      {
        name: 'High Gain Antenna',
        joints: joints.filter(j => j.id.startsWith('antenna_'))
      }
    ];
    return groups.filter(g => g.joints.length > 0);
  }, [joints]);

  // Handle joint slider change
  const handleJointSliderChange = useCallback((jointId: string, value: number) => {
    const joint = joints.find(j => j.id === jointId);
    if (!joint) return;

    if (joint.type === 'revolute') {
      onJointChange(jointId, value * Math.PI / 180); // Convert to radians
    } else if (joint.type === 'prismatic') {
      onJointChange(jointId, undefined, value);
    }
  }, [joints, onJointChange]);

  // Handle IK target setting
  const handleSetIKTarget = useCallback(() => {
    const target: IKTarget = {
      id: `target_${Date.now()}`,
      chainId: selectedChain,
      position: new THREE.Vector3(ikPosition.x, ikPosition.y, ikPosition.z),
      priority: 1,
      weight: 1
    };
    onIKTargetSet(target);
  }, [selectedChain, ikPosition, onIKTargetSet]);

  // Convert radians to degrees for display
  const radToDeg = (rad: number) => (rad * 180 / Math.PI).toFixed(1);

  // Render joint controls
  const renderJointControls = () => (
    <div className="space-y-3">
      {jointGroups.map(group => (
        <div key={group.name} className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground">
            {group.name}
          </h4>
          {group.joints.map(joint => {
            if (joint.type === 'fixed') return null;
            
            const isRevolute = joint.type === 'revolute';
            const currentValue = isRevolute 
              ? joint.currentAngle * 180 / Math.PI 
              : joint.currentDistance;
            const minValue = isRevolute 
              ? (joint.minAngle ?? -Math.PI) * 180 / Math.PI 
              : (joint.minDistance ?? 0);
            const maxValue = isRevolute 
              ? (joint.maxAngle ?? Math.PI) * 180 / Math.PI 
              : (joint.maxDistance ?? 1);

            return (
              <div key={joint.id} className="space-y-1">
                <div className="flex justify-between items-center text-xs">
                  <span>{joint.name}</span>
                  <span className="text-muted-foreground">
                    {isRevolute ? `${radToDeg(joint.currentAngle)}°` : `${joint.currentDistance.toFixed(2)}m`}
                  </span>
                </div>
                <Slider
                  value={[currentValue]}
                  onValueChange={([value]) => handleJointSliderChange(joint.id, value)}
                  min={minValue}
                  max={maxValue}
                  step={isRevolute ? 1 : 0.01}
                  className="w-full"
                />
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );

  // Render IK controls
  const renderIKControls = () => (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium">Target Chain</label>
        <Select
          value={selectedChain}
          onValueChange={setSelectedChain}
        >
          <option value="robotic_arm">Robotic Arm</option>
          <option value="mast_camera">Mast Camera</option>
          <option value="antenna">High Gain Antenna</option>
        </Select>
      </div>
      
      <div className="space-y-2">
        <h4 className="text-sm font-medium">Target Position</h4>
        
        <div className="space-y-1">
          <div className="flex justify-between items-center text-xs">
            <span>X</span>
            <span>{ikPosition.x.toFixed(2)}m</span>
          </div>
          <Slider
            value={[ikPosition.x]}
            onValueChange={([value]) => setIkPosition(prev => ({ ...prev, x: value }))}
            min={-2}
            max={2}
            step={0.05}
          />
        </div>
        
        <div className="space-y-1">
          <div className="flex justify-between items-center text-xs">
            <span>Y</span>
            <span>{ikPosition.y.toFixed(2)}m</span>
          </div>
          <Slider
            value={[ikPosition.y]}
            onValueChange={([value]) => setIkPosition(prev => ({ ...prev, y: value }))}
            min={0}
            max={3}
            step={0.05}
          />
        </div>
        
        <div className="space-y-1">
          <div className="flex justify-between items-center text-xs">
            <span>Z</span>
            <span>{ikPosition.z.toFixed(2)}m</span>
          </div>
          <Slider
            value={[ikPosition.z]}
            onValueChange={([value]) => setIkPosition(prev => ({ ...prev, z: value }))}
            min={-2}
            max={2}
            step={0.05}
          />
        </div>
      </div>
      
      <Button 
        onClick={handleSetIKTarget} 
        size="sm" 
        className="w-full"
        variant="secondary"
      >
        <Target className="w-4 h-4 mr-2" />
        Set IK Target
      </Button>
    </div>
  );

  // Render animation controls
  const renderAnimationControls = () => (
    <div className="space-y-4">
      <div className="space-y-2">
        {Object.entries(ROVER_ANIMATIONS).map(([key, clip]) => {
          const isPlaying = currentAnimation === clip.id;
          return (
            <div 
              key={key} 
              className="flex items-center justify-between p-2 rounded hover:bg-muted/50"
            >
              <span className="text-sm">{clip.name}</span>
              <Button
                size="sm"
                variant={isPlaying ? "default" : "outline"}
                onClick={() => isPlaying ? onAnimationStop() : onAnimationPlay(clip.id)}
              >
                {isPlaying ? (
                  <><Pause className="w-3 h-3 mr-1" /> Stop</>
                ) : (
                  <><Play className="w-3 h-3 mr-1" /> Play</>
                )}
              </Button>
            </div>
          );
        })}
      </div>
      
      {currentAnimation && animationTime !== undefined && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Progress</span>
            <span>{animationTime.toFixed(1)}s</span>
          </div>
          <div className="w-full bg-muted rounded-full h-2">
            <div 
              className="bg-primary h-2 rounded-full transition-all"
              style={{ 
                width: `${(animationTime / 6) * 100}%` // Assuming max 6s duration
              }}
            />
          </div>
        </div>
      )}
      
      <Button 
        onClick={() => {
          joints.forEach(joint => {
            if (joint.type === 'revolute') {
              onJointChange(joint.id, 0);
            }
          });
        }}
        size="sm"
        variant="outline"
        className="w-full"
      >
        <RotateCcw className="w-4 h-4 mr-2" />
        Reset All Joints
      </Button>
    </div>
  );

  return (
    <Card className={`kinematics-control-panel ${className}`}>
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Kinematics Control</h3>
          {onDebugToggle && (
            <Button
              size="sm"
              variant={debug ? "default" : "outline"}
              onClick={() => onDebugToggle(!debug)}
            >
              Debug
            </Button>
          )}
        </div>

        <Accordion value={activePanel} onValueChange={setActivePanel}>
          <AccordionItem value="joints">
            <AccordionTrigger>Joint Control</AccordionTrigger>
            <AccordionContent>
              {renderJointControls()}
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="ik">
            <AccordionTrigger>Inverse Kinematics</AccordionTrigger>
            <AccordionContent>
              {renderIKControls()}
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="animations">
            <AccordionTrigger>Animations</AccordionTrigger>
            <AccordionContent>
              {renderAnimationControls()}
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </Card>
  );
};

export default KinematicsControlPanel;