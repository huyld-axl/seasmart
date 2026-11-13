import { keyHeader } from '../lib/idempotency'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { opportunityApi } from '../api/opportunityApi'

export function useOpportunityList(params, options = {}) {
  return useQuery({
    queryKey: ['opportunities', 'list', params],
    queryFn: () => opportunityApi.list(params),
    placeholderData: (previous) => previous,
    ...options,
  })
}

export function useOpportunity(id) {
  return useQuery({
    queryKey: ['opportunities', 'item', String(id)],
    queryFn: () => opportunityApi.get(id),
    enabled: !!id,
  })
}

export function useOpportunitySuggestions(id, params, options = {}) {
  return useQuery({
    queryKey: ['opportunities', 'suggestions', String(id), params],
    queryFn: () => opportunityApi.suggestions(id, params),
    enabled: !!id,
    placeholderData: (previous) => previous,
    ...options,
  })
}

export function useRequirementPresets(params, options = {}) {
  return useQuery({
    queryKey: ['opportunities', 'presets', params],
    queryFn: () => opportunityApi.presets(params),
    enabled: !!params?.rank_id,
    ...options,
  })
}

// Chốt và huỷ chốt đổi cả chuyến và trạng thái thuyền viên.
function useRefresh() {
  const queryClient = useQueryClient()
  return () => {
    for (const key of ['opportunities', 'voyages', 'seafarers']) queryClient.invalidateQueries({ queryKey: [key] })
  }
}

export function useOpportunityMutations() {
  const options = { onSuccess: useRefresh() }
  return {
    // requestKey: mã yêu cầu chống tạo trùng của lần mở form thêm mới (lib/idempotency.js).
    save: useMutation({ mutationFn: ({ id, requestKey, ...body }) => (id ? opportunityApi.update(id, body) : opportunityApi.create(body, requestKey ? keyHeader(requestKey) : undefined)), ...options }),
    duplicate: useMutation({ mutationFn: ({ id, ...body }) => opportunityApi.duplicate(id, body), ...options }),
    close: useMutation({ mutationFn: ({ id, ...body }) => opportunityApi.close(id, body), ...options }),
    reopen: useMutation({ mutationFn: (id) => opportunityApi.reopen(id), ...options }),
    remove: useMutation({ mutationFn: (id) => opportunityApi.remove(id), ...options }),
    savePreset: useMutation({ mutationFn: ({ rankId, requirements }) => opportunityApi.savePreset(rankId, requirements), ...options }),
    addCandidates: useMutation({ mutationFn: ({ id, ...body }) => opportunityApi.addCandidates(id, body), ...options }),
    removeCandidate: useMutation({ mutationFn: ({ id, seafarerId }) => opportunityApi.removeCandidate(id, seafarerId), ...options }),
    setOwnerSelected: useMutation({
      mutationFn: ({ id, seafarerId, selected }) => (selected ? opportunityApi.selectOwner(id, seafarerId) : opportunityApi.unselectOwner(id, seafarerId)),
      ...options,
    }),
    sendMail: useMutation({ mutationFn: ({ id, ...body }) => opportunityApi.sendMail(id, body), ...options }),
    prepareMail: useMutation({ mutationFn: ({ id, candidateIds }) => opportunityApi.prepareMail(id, candidateIds) }),
    recordMail: useMutation({ mutationFn: ({ id, ...body }) => opportunityApi.recordMail(id, body), ...options }),
    place: useMutation({ mutationFn: ({ id, ...body }) => opportunityApi.place(id, body), ...options }),
  }
}
