import { useQuery } from '@tanstack/react-query';
import { useRoomStore } from '../stores/roomStore';
import { api } from '../services/api';
import type { GeoLocation, RoomWithDistance } from '@socio/types';

interface DiscoveryParams {
  location: GeoLocation;
  radiusKm?: number;
  tags?: string[];
}

export function useRoomDiscovery(params: DiscoveryParams) {
  const setNearbyRooms = useRoomStore((state) => state.setNearbyRooms);

  const query = useQuery<RoomWithDistance[]>({
    queryKey: ['nearbyRooms', params.location, params.radiusKm, params.tags],
    queryFn: async () => {
      const response = await api.get<RoomWithDistance[]>('/rooms/nearby', {
        params: {
          lat: params.location.latitude,
          lng: params.location.longitude,
          radius: params.radiusKm || 5,
          tags: params.tags?.join(','),
        },
      });
      setNearbyRooms(response);
      return response;
    },
    enabled: !!params.location.latitude && !!params.location.longitude,
    staleTime: 30000, // 30 seconds
  });

  return query;
}
