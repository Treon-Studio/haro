'use client';

import React, { useState, useEffect } from 'react';
import SkillForm from './SkillForm';
import { useSkills } from './useSkills';

export default function SkillsView() {
  const { skills, addSkill, updateSkill } = useSkills();
  const [activeSkillId, setActiveSkillId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    const isNew = window.location.pathname.endsWith('/new');
    setIsCreating(isNew);
    
    if (!isNew) {
      const pathParts = window.location.pathname.split('/');
      if (pathParts.length > 2) {
        setActiveSkillId(pathParts[2]);
      }
    }
  }, []);

  const activeSkill = skills.find(s => s.id === activeSkillId);

  const handleSave = (savedSkill: any) => {
    if (isCreating) {
      addSkill(savedSkill);
      window.location.href = `/skills/${savedSkill.id}`;
    } else {
      updateSkill(savedSkill);
    }
  };

  const handleCancel = () => {
    if (isCreating) {
      window.location.href = '/skills';
    }
  };

  return (
    <div className="flex h-full w-full flex-col bg-presentation overflow-hidden">
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-y-auto">
        {isCreating ? (
          <SkillForm 
            onSave={handleSave} 
            onCancel={handleCancel} 
          />
        ) : activeSkill ? (
          <SkillForm 
            key={activeSkill.id} 
            skill={activeSkill} 
            onSave={handleSave} 
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center p-8 text-center text-text-secondary">
            <p className="font-medium text-text-primary">No skill selected</p>
            <p className="mt-2 text-sm">Select a skill from the list or create a new one.</p>
          </div>
        )}
      </div>
    </div>
  );
}
