import { create } from 'zustand'

const useVesselFilterStore = create((set) => ({
  vesselNameInput: '',
  ownerInput: '',
  vesselTypeFilter: undefined,
  flagFilter: undefined,
  statusFilter: undefined,
  filters: {},
  page: 1,
  catalogRows: [],

  setVesselNameInput: (v) => set({ vesselNameInput: v }),
  setOwnerInput: (v) => set({ ownerInput: v }),
  setVesselTypeFilter: (v) => set({ vesselTypeFilter: v }),
  setFlagFilter: (v) => set({ flagFilter: v }),
  setStatusFilter: (v) => set({ statusFilter: v }),
  setFilters: (v) => set({ filters: v }),
  setPage: (v) => set({ page: v }),
  setCatalogRows: (v) => set({ catalogRows: v }),

  reset: () =>
    set({
      vesselNameInput: '',
      ownerInput: '',
      vesselTypeFilter: undefined,
      flagFilter: undefined,
      statusFilter: undefined,
      filters: {},
      page: 1,
      catalogRows: [],
    }),
}))

export default useVesselFilterStore
