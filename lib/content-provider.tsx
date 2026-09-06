'use client';
import { createContext, useContext } from 'react';
import type { Curriculum } from './curriculum';
const CurriculumContext = createContext<Curriculum | null>(null);
export function CurriculumProvider({
  data,
  children,
}: {
  data: Curriculum;
  children: React.ReactNode;
}) {
  return (
    <CurriculumContext.Provider value={data}>
      {children}
    </CurriculumContext.Provider>
  );
}
export function useCurriculum() {
  const data = useContext(CurriculumContext);
  if (!data) throw new Error('Curriculum provider is missing.');
  return {
    ...data,
    shortTitle: (id: string) =>
      data.nodes.find((n) => n.id === id)?.title || id,
  };
}
