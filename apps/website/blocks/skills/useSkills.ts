import { useState, useEffect } from 'react';
import { Skill } from './SkillForm';

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach(l => l());
}

// Global state to share across components
let globalSkills: Skill[] = [];

export function useSkills() {
  const [skills, setSkills] = useState<Skill[]>(globalSkills);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const handleUpdate = () => setSkills([...globalSkills]);
    listeners.add(handleUpdate);
    
    // Fetch initial skills if empty
    if (globalSkills.length === 0) {
      fetchSkills();
    }
    
    return () => {
      listeners.delete(handleUpdate);
    };
  }, []);

  const fetchSkills = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/skills');
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        // Map DTO back to Skill interface expected by UI
        globalSkills = data.data.map((item: any) => ({
          id: item.id,
          name: item.name,
          description: item.description,
          body: item.body,
          category: item.category,
        }));
        notify();
      }
    } catch (err) {
      console.error('Failed to fetch skills:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const addSkill = async (skill: Skill) => {
    try {
      const res = await fetch('/api/skills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: skill.name,
          description: skill.description,
          body: skill.body,
          category: skill.category,
        }),
      });
      const data = await res.json();
      
      if (data.success) {
        const newSkill = {
          id: data.data.id,
          name: data.data.name,
          description: data.data.description,
          body: data.data.body,
          category: data.data.category,
        };
        globalSkills.push(newSkill);
        notify();
        return newSkill;
      } else {
        throw new Error(data.error?.message || 'Failed to create skill');
      }
    } catch (err) {
      console.error('Failed to add skill:', err);
      throw err;
    }
  };

  const updateSkill = async (skill: Skill) => {
    // Implement API PUT call when you have the endpoint
    // For now, we only update locally (or you can create the PUT endpoint later)
    console.warn('API for updateSkill is not yet fully implemented on backend');
    const index = globalSkills.findIndex(s => s.id === skill.id);
    if (index !== -1) {
      globalSkills[index] = skill;
      notify();
    }
  };

  return { skills, addSkill, updateSkill, isLoading };
}
