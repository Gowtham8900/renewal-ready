import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "./queryClient";

export function useFrameworks() {
  return useQuery<any[]>({ queryKey: ["/api/frameworks"] });
}

export function usePacket(packetId: string) {
  return useQuery<any>({ queryKey: ["/api/packets", packetId], enabled: !!packetId });
}

export function useUpdatePacketFields(packetId: string) {
  return useMutation({
    mutationFn: async (packetFieldsJson: Record<string, any>) => {
      const res = await apiRequest("PUT", `/api/packets/${packetId}`, { packetFieldsJson });
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/packets", packetId] }),
  });
}

export function useUploadChecklistDoc(packetId: string) {
  return useMutation({
    mutationFn: async ({ file, checklistItemTemplateId }: { file: File; checklistItemTemplateId: string }) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("checklistItemTemplateId", checklistItemTemplateId);
      const res = await fetch(`/api/packets/${packetId}/documents`, { method: "POST", body: formData, credentials: "include" });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/packets", packetId] }),
  });
}
