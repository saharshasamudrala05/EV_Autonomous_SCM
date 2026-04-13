import { create } from 'zustand';

const useSimulationStore = create((set) => ({
  simulatedForecast: null,
  isSimulationActive: false,
  activeScenarioId: null,
  
  setSimulatedForecast: (data) => set({ 
    simulatedForecast: data, 
    isSimulationActive: !!data 
  }),
  
  setActiveScenarioId: (id) => set({ activeScenarioId: id }),
  
  clearSimulation: () => set({ 
    simulatedForecast: null, 
    isSimulationActive: false,
    activeScenarioId: null
  })
}));

export default useSimulationStore;
